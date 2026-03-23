import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  userStatsTable,
  dailyActivityTable,
  jackpotEntryTable,
  dailyJackpotTable,
  referralsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const router: IRouter = Router();

const REFERRAL_TICKETS = 25;

async function ensureUserStats(userId: string) {
  const existing = await db.query.userStatsTable.findFirst({
    where: eq(userStatsTable.userId, userId),
  });
  if (!existing) {
    const referralCode = nanoid(8).toUpperCase();
    await db.insert(userStatsTable).values({ userId, referralCode, heatsAvailable: 1 });
    return await db.query.userStatsTable.findFirst({ where: eq(userStatsTable.userId, userId) });
  }
  return existing;
}

router.get("/referral/code", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const stats = await ensureUserStats(req.user.id);
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost";

  res.json({
    code: stats!.referralCode,
    totalReferrals: stats!.totalReferrals,
    ticketsEarnedFromReferrals: stats!.totalReferrals * REFERRAL_TICKETS,
    referralUrl: `https://${domain}?ref=${stats!.referralCode}`,
  });
});

router.post("/referral/apply", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Referral code is required" });
    return;
  }

  const myStats = await ensureUserStats(req.user.id);

  if (myStats!.referredByUserId) {
    res.status(400).json({ error: "You have already used a referral code" });
    return;
  }

  if (myStats!.referralCode === code.toUpperCase()) {
    res.status(400).json({ error: "You cannot use your own referral code" });
    return;
  }

  const referrerStats = await db.query.userStatsTable.findFirst({
    where: eq(userStatsTable.referralCode, code.toUpperCase()),
  });

  if (!referrerStats) {
    res.status(400).json({ error: "Invalid referral code" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  await db.update(userStatsTable)
    .set({ referredByUserId: referrerStats.userId })
    .where(eq(userStatsTable.userId, req.user.id));

  await db.update(userStatsTable)
    .set({
      totalReferrals: (referrerStats.totalReferrals ?? 0) + 1,
      totalTicketsEarned: (referrerStats.totalTicketsEarned ?? 0) + REFERRAL_TICKETS,
      updatedAt: new Date(),
    })
    .where(eq(userStatsTable.userId, referrerStats.userId));

  await db.insert(referralsTable).values({
    referrerId: referrerStats.userId,
    referredId: req.user.id,
    ticketsAwarded: REFERRAL_TICKETS,
  });

  let referrerActivity = await db.query.dailyActivityTable.findFirst({
    where: and(
      eq(dailyActivityTable.userId, referrerStats.userId),
      eq(dailyActivityTable.activityDate, today)
    ),
  });

  if (!referrerActivity) {
    await db.insert(dailyActivityTable).values({
      userId: referrerStats.userId,
      activityDate: today,
      adsWatched: 0,
      ticketsFromAds: 0,
      ticketsFromReferrals: REFERRAL_TICKETS,
    });
  } else {
    await db.update(dailyActivityTable)
      .set({
        ticketsFromReferrals: (referrerActivity.ticketsFromReferrals ?? 0) + REFERRAL_TICKETS,
      })
      .where(eq(dailyActivityTable.id, referrerActivity.id));
  }

  let jackpot = await db.query.dailyJackpotTable.findFirst({
    where: eq(dailyJackpotTable.drawDate, today),
  });
  if (!jackpot) {
    await db.insert(dailyJackpotTable).values({ drawDate: today, prizeAmount: "100" });
    jackpot = await db.query.dailyJackpotTable.findFirst({
      where: eq(dailyJackpotTable.drawDate, today),
    });
  }

  const existingEntry = await db.query.jackpotEntryTable.findFirst({
    where: and(
      eq(jackpotEntryTable.userId, referrerStats.userId),
      eq(jackpotEntryTable.jackpotId, jackpot!.id)
    ),
  });

  if (existingEntry) {
    await db.update(jackpotEntryTable)
      .set({ tickets: existingEntry.tickets + REFERRAL_TICKETS })
      .where(eq(jackpotEntryTable.id, existingEntry.id));
  } else {
    await db.insert(jackpotEntryTable).values({
      userId: referrerStats.userId,
      jackpotId: jackpot!.id,
      tickets: REFERRAL_TICKETS,
    });
    await db.update(dailyJackpotTable)
      .set({ totalParticipants: jackpot!.totalParticipants + 1 })
      .where(eq(dailyJackpotTable.id, jackpot!.id));
  }

  await db.update(dailyJackpotTable)
    .set({ totalTickets: jackpot!.totalTickets + REFERRAL_TICKETS })
    .where(eq(dailyJackpotTable.id, jackpot!.id));

  const { usersTable } = await import("@workspace/db");
  const referrerUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, referrerStats.userId),
  });

  res.json({
    success: true,
    ticketsAwarded: REFERRAL_TICKETS,
    referrerUsername: referrerUser?.username ?? "User",
    message: `Success! ${referrerUser?.username ?? "Your friend"} earned ${REFERRAL_TICKETS} tickets!`,
  });
});

export default router;
