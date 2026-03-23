import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { userStatsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const router: IRouter = Router();

const STREAK_MILESTONES = [
  { day: 7, label: "Week 1", reward: "1 Sunday Banked" },
  { day: 14, label: "Week 2", reward: "2nd Sunday Banked" },
  { day: 21, label: "Week 3", reward: "3rd Sunday Banked" },
  { day: 30, label: "Month 1", reward: "4th Sunday + Bonus Heat" },
  { day: 45, label: "45 Days", reward: "Sunday Banked" },
  { day: 60, label: "2 Months", reward: "Sunday Banked + Bonus" },
  { day: 90, label: "3 Months", reward: "Premium Pool Access" },
  { day: 120, label: "4 Months", reward: "Sunday Banked" },
  { day: 180, label: "6 Months", reward: "Elite Status" },
  { day: 270, label: "9 Months", reward: "Sunday Banked x2" },
  { day: 365, label: "365 Days", reward: "Legendary Status + Grand Prize" },
];

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

router.get("/streak", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const stats = await ensureUserStats(req.user.id);

  const today = new Date().toISOString().split("T")[0];
  const lastDate = stats!.lastStreakDate;

  let isFrozen = stats!.streakFrozen;
  let frozenSinceDays: number | null = null;

  if (!isFrozen && lastDate) {
    const lastActivity = new Date(lastDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 1 && lastDate !== today) {
      isFrozen = true;
      frozenSinceDays = diffDays - 1;
      await db.update(userStatsTable)
        .set({ streakFrozen: true, streakFrozenAt: new Date() })
        .where(eq(userStatsTable.userId, req.user.id));
    }
  }

  if (isFrozen && stats!.streakFrozenAt) {
    const frozenAt = new Date(stats!.streakFrozenAt);
    const todayDate = new Date();
    frozenSinceDays = Math.floor((todayDate.getTime() - frozenAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  let nextHeatAvailableAt: string | null = null;
  if (stats!.lastHeatUsedAt) {
    const nextAvailable = new Date(stats!.lastHeatUsedAt);
    nextAvailable.setDate(nextAvailable.getDate() + 30);
    nextHeatAvailableAt = nextAvailable.toISOString();
  }

  const currentStreak = stats!.currentStreakDays;
  const milestones = STREAK_MILESTONES.map((m) => ({
    day: m.day,
    label: m.label,
    reward: m.reward,
    isReached: currentStreak >= m.day,
    isNext: currentStreak < m.day && STREAK_MILESTONES.find(ms => ms.day > currentStreak)?.day === m.day,
  }));

  res.json({
    currentStreak,
    longestStreak: stats!.longestStreakDays,
    isFrozen,
    frozenSinceDays,
    heatsAvailable: stats!.heatsAvailable,
    nextHeatAvailableAt,
    milestones,
    sundaysBanked: stats!.sundaysBanked,
    lastActivityDate: stats!.lastStreakDate ?? null,
  });
});

router.post("/streak/heat", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const stats = await ensureUserStats(req.user.id);

  if (!stats!.streakFrozen) {
    res.status(400).json({ error: "Your streak is not frozen" });
    return;
  }

  if ((stats!.heatsAvailable ?? 0) <= 0) {
    let nextHeatDate: string | null = null;
    if (stats!.lastHeatUsedAt) {
      const next = new Date(stats!.lastHeatUsedAt);
      next.setDate(next.getDate() + 30);
      nextHeatDate = next.toISOString();
    }
    res.status(400).json({
      error: nextHeatDate
        ? `No heats available. Next free heat: ${new Date(nextHeatDate).toLocaleDateString()}`
        : "No heats available",
    });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const newHeats = (stats!.heatsAvailable ?? 1) - 1;

  await db.update(userStatsTable)
    .set({
      streakFrozen: false,
      streakFrozenAt: null,
      heatsAvailable: newHeats,
      lastHeatUsedAt: new Date(),
      lastStreakDate: today,
      updatedAt: new Date(),
    })
    .where(eq(userStatsTable.userId, req.user.id));

  const nextFree = new Date();
  nextFree.setDate(nextFree.getDate() + 30);

  res.json({
    success: true,
    heatsRemaining: newHeats,
    nextHeatAvailableAt: nextFree.toISOString(),
    message: "🔥 Streak heated! Keep going!",
  });
});

export default router;
