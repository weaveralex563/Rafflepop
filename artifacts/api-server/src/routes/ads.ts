import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  userStatsTable,
  dailyActivityTable,
  dailyJackpotTable,
  jackpotEntryTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const router: IRouter = Router();

const TICKETS_PER_AD = 5;
const ADS_PER_DAY = 7;

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

async function ensureTodayJackpot() {
  const today = new Date().toISOString().split("T")[0];
  let jackpot = await db.query.dailyJackpotTable.findFirst({
    where: eq(dailyJackpotTable.drawDate, today),
  });
  if (!jackpot) {
    const drawTime = new Date();
    drawTime.setHours(23, 59, 0, 0);
    await db.insert(dailyJackpotTable).values({
      drawDate: today,
      prizeAmount: "100",
    });
    jackpot = await db.query.dailyJackpotTable.findFirst({
      where: eq(dailyJackpotTable.drawDate, today),
    });
  }
  return jackpot!;
}

router.post("/ads/watch", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = req.user;
  const today = new Date().toISOString().split("T")[0];

  let todayActivity = await db.query.dailyActivityTable.findFirst({
    where: and(
      eq(dailyActivityTable.userId, user.id),
      eq(dailyActivityTable.activityDate, today)
    ),
  });

  if (todayActivity && todayActivity.adsWatched >= ADS_PER_DAY) {
    res.status(400).json({ error: "You have already watched all 7 ads today!" });
    return;
  }

  if (!todayActivity) {
    await db.insert(dailyActivityTable).values({
      userId: user.id,
      activityDate: today,
      adsWatched: 0,
      ticketsFromAds: 0,
      ticketsFromReferrals: 0,
    });
    todayActivity = await db.query.dailyActivityTable.findFirst({
      where: and(
        eq(dailyActivityTable.userId, user.id),
        eq(dailyActivityTable.activityDate, today)
      ),
    });
  }

  const newAdsWatched = (todayActivity!.adsWatched ?? 0) + 1;
  const ticketsEarned = TICKETS_PER_AD;
  const newTicketsFromAds = (todayActivity!.ticketsFromAds ?? 0) + ticketsEarned;
  const dailyComplete = newAdsWatched >= ADS_PER_DAY;

  await db.update(dailyActivityTable)
    .set({
      adsWatched: newAdsWatched,
      ticketsFromAds: newTicketsFromAds,
      dailyComplete,
      lastAdAt: new Date(),
    })
    .where(eq(dailyActivityTable.id, todayActivity!.id));

  const stats = await ensureUserStats(user.id);
  
  let streakUpdated = false;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  if (dailyComplete) {
    const lastDate = stats!.lastStreakDate;
    let newStreak = 1;
    
    if (lastDate === yesterday) {
      newStreak = (stats!.currentStreakDays ?? 0) + 1;
    } else if (lastDate === today) {
      newStreak = stats!.currentStreakDays ?? 1;
    }

    const newLongest = Math.max(newStreak, stats!.longestStreakDays ?? 0);
    
    const weekday = new Date().getDay();
    let sundaysBankedInc = 0;
    
    if (weekday === 0) {
      if (newStreak >= 7) {
        sundaysBankedInc = 1;
      }
    }

    await db.update(userStatsTable)
      .set({
        totalAdsWatched: (stats!.totalAdsWatched ?? 0) + 1,
        totalTicketsEarned: (stats!.totalTicketsEarned ?? 0) + ticketsEarned,
        currentStreakDays: newStreak,
        longestStreakDays: newLongest,
        lastStreakDate: today,
        streakFrozen: false,
        sundaysBanked: (stats!.sundaysBanked ?? 0) + sundaysBankedInc,
        sundayQualifications: (stats!.sundayQualifications ?? 0) + sundaysBankedInc,
        updatedAt: new Date(),
      })
      .where(eq(userStatsTable.userId, user.id));
    
    streakUpdated = true;
  } else {
    await db.update(userStatsTable)
      .set({
        totalAdsWatched: (stats!.totalAdsWatched ?? 0) + 1,
        totalTicketsEarned: (stats!.totalTicketsEarned ?? 0) + ticketsEarned,
        updatedAt: new Date(),
      })
      .where(eq(userStatsTable.userId, user.id));
  }

  const jackpot = await ensureTodayJackpot();
  const existingEntry = await db.query.jackpotEntryTable.findFirst({
    where: and(
      eq(jackpotEntryTable.userId, user.id),
      eq(jackpotEntryTable.jackpotId, jackpot.id)
    ),
  });

  if (existingEntry) {
    await db.update(jackpotEntryTable)
      .set({ tickets: existingEntry.tickets + ticketsEarned })
      .where(eq(jackpotEntryTable.id, existingEntry.id));
  } else {
    await db.insert(jackpotEntryTable).values({
      userId: user.id,
      jackpotId: jackpot.id,
      tickets: ticketsEarned,
    });
    await db.update(dailyJackpotTable)
      .set({ totalParticipants: jackpot.totalParticipants + 1 })
      .where(eq(dailyJackpotTable.id, jackpot.id));
  }

  await db.update(dailyJackpotTable)
    .set({ totalTickets: jackpot.totalTickets + ticketsEarned })
    .where(eq(dailyJackpotTable.id, jackpot.id));

  const freshActivity = await db.query.dailyActivityTable.findFirst({
    where: and(
      eq(dailyActivityTable.userId, user.id),
      eq(dailyActivityTable.activityDate, today)
    ),
  });

  res.json({
    adsWatchedToday: newAdsWatched,
    ticketsEarned,
    totalTicketsToday: (freshActivity?.ticketsFromAds ?? 0) + (freshActivity?.ticketsFromReferrals ?? 0),
    dailyComplete,
    streakUpdated,
    message: dailyComplete
      ? "Daily complete! Your streak continues! 🔥"
      : `Ad watched! +${ticketsEarned} tickets. ${ADS_PER_DAY - newAdsWatched} ads left today.`,
  });
});

router.get("/ads/progress", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = req.user;
  const today = new Date().toISOString().split("T")[0];

  const todayActivity = await db.query.dailyActivityTable.findFirst({
    where: and(
      eq(dailyActivityTable.userId, user.id),
      eq(dailyActivityTable.activityDate, today)
    ),
  });

  res.json({
    adsWatchedToday: todayActivity?.adsWatched ?? 0,
    totalAdsRequired: ADS_PER_DAY,
    ticketsFromAds: todayActivity?.ticketsFromAds ?? 0,
    ticketsFromReferrals: todayActivity?.ticketsFromReferrals ?? 0,
    totalTicketsToday: (todayActivity?.ticketsFromAds ?? 0) + (todayActivity?.ticketsFromReferrals ?? 0),
    dailyComplete: todayActivity?.dailyComplete ?? false,
    lastAdWatchedAt: todayActivity?.lastAdAt ?? null,
  });
});

export default router;
