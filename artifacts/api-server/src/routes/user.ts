import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, userStatsTable, referralsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const router: IRouter = Router();

async function ensureUserStats(userId: string) {
  const existing = await db.query.userStatsTable.findFirst({
    where: eq(userStatsTable.userId, userId),
  });
  if (!existing) {
    const referralCode = nanoid(8).toUpperCase();
    await db.insert(userStatsTable).values({
      userId,
      referralCode,
      heatsAvailable: 1,
    });
    return await db.query.userStatsTable.findFirst({
      where: eq(userStatsTable.userId, userId),
    });
  }
  return existing;
}

router.get("/user/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = req.user;
  const stats = await ensureUserStats(user.id);

  res.json({
    id: user.id,
    username: user.username,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    profileImage: user.profileImage ?? null,
    totalTicketsEarned: stats!.totalTicketsEarned,
    totalAdsWatched: stats!.totalAdsWatched,
    totalReferrals: stats!.totalReferrals,
    memberSince: user.createdAt,
    currentStreakDays: stats!.currentStreakDays,
    longestStreakDays: stats!.longestStreakDays,
    sundayQualifications: stats!.sundayQualifications,
    heatsAvailable: stats!.heatsAvailable,
  });
});

router.get("/user/stats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = req.user;
  const stats = await ensureUserStats(user.id);

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { dailyActivityTable } = await import("@workspace/db");
  const { gte, and } = await import("drizzle-orm");

  const todayActivity = await db.query.dailyActivityTable.findFirst({
    where: and(
      eq(dailyActivityTable.userId, user.id),
      eq(dailyActivityTable.activityDate, today)
    ),
  });

  const weekActivities = await db.query.dailyActivityTable.findMany({
    where: and(
      eq(dailyActivityTable.userId, user.id),
      gte(dailyActivityTable.activityDate, weekAgo)
    ),
  });

  const weekTickets = weekActivities.reduce(
    (sum, a) => sum + a.ticketsFromAds + a.ticketsFromReferrals,
    0
  );

  res.json({
    todayTickets: todayActivity
      ? todayActivity.ticketsFromAds + todayActivity.ticketsFromReferrals
      : 0,
    todayAdsWatched: todayActivity?.adsWatched ?? 0,
    weekTickets,
    totalTickets: stats!.totalTicketsEarned,
    totalReferrals: stats!.totalReferrals,
    sundayQualifications: stats!.sundayQualifications,
    currentStreak: stats!.currentStreakDays,
    longestStreak: stats!.longestStreakDays,
  });
});

export default router;
