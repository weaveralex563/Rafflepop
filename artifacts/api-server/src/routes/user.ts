import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetMeResponse, WatchAdResponse, ClaimStreakResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEMO_USER_ID = 1;
const DEMO_USERNAME = "User_00000";
const EMOJIS = ["🦁", "🐯", "🦊", "🐺", "🦝", "🐻", "🦋", "🐬", "🦄", "🐉"];

async function getOrCreateUser(): Promise<typeof usersTable.$inferSelect> {
  const existing = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const [user] = await db.insert(usersTable).values({
    username: DEMO_USERNAME,
    tickets: 0,
    streakDays: 0,
    bestStreak: 0,
    adsWatchedToday: 0,
    totalWinnings: 0,
  }).returning();
  return user;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isNewDay(lastDate: string | null | undefined): boolean {
  if (!lastDate) return true;
  return lastDate !== todayStr();
}

router.get("/user/me", async (_req, res): Promise<void> => {
  const user = await getOrCreateUser();
  
  if (isNewDay(user.lastAdWatchDate)) {
    await db.update(usersTable).set({ adsWatchedToday: 0, lastAdWatchDate: todayStr() }).where(eq(usersTable.id, DEMO_USER_ID));
    user.adsWatchedToday = 0;
  }

  res.json(GetMeResponse.parse({
    id: String(user.id),
    username: user.username,
    tickets: user.tickets,
    streakDays: user.streakDays,
    bestStreak: user.bestStreak,
    lastStreakClaim: user.lastStreakClaim ? user.lastStreakClaim.toISOString() : null,
    adsWatchedToday: user.adsWatchedToday,
    totalWinnings: user.totalWinnings,
    createdAt: user.createdAt.toISOString(),
  }));
});

router.post("/user/watch-ad", async (_req, res): Promise<void> => {
  const user = await getOrCreateUser();

  if (isNewDay(user.lastAdWatchDate)) {
    await db.update(usersTable).set({ adsWatchedToday: 0, lastAdWatchDate: todayStr() }).where(eq(usersTable.id, DEMO_USER_ID));
    user.adsWatchedToday = 0;
  }

  const [updated] = await db.update(usersTable)
    .set({
      tickets: sql`${usersTable.tickets} + 1`,
      adsWatchedToday: sql`${usersTable.adsWatchedToday} + 1`,
      lastAdWatchDate: todayStr(),
    })
    .where(eq(usersTable.id, DEMO_USER_ID))
    .returning();

  res.json(WatchAdResponse.parse({
    success: true,
    tickets: updated.tickets,
    message: "You earned 1 ticket!",
  }));
});

router.post("/user/claim-streak", async (_req, res): Promise<void> => {
  const user = await getOrCreateUser();
  const today = todayStr();

  const lastClaim = user.lastStreakClaim;
  const lastClaimStr = lastClaim ? lastClaim.toISOString().slice(0, 10) : null;
  
  if (lastClaimStr === today) {
    res.json(ClaimStreakResponse.parse({
      success: false,
      tickets: user.tickets,
      streakDays: user.streakDays,
      bestStreak: user.bestStreak,
      message: "You already claimed your streak today!",
      alreadyClaimed: true,
    }));
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak = (lastClaimStr === yesterdayStr) ? user.streakDays + 1 : 1;
  const newBestStreak = Math.max(newStreak, user.bestStreak);

  let bonusTickets = 10;
  if (newStreak === 3) bonusTickets = 30;
  else if (newStreak === 7) bonusTickets = 70;
  else if (newStreak === 30) bonusTickets = 300;

  const [updated] = await db.update(usersTable)
    .set({
      tickets: sql`${usersTable.tickets} + ${bonusTickets}`,
      streakDays: newStreak,
      bestStreak: newBestStreak,
      lastStreakClaim: new Date(),
    })
    .where(eq(usersTable.id, DEMO_USER_ID))
    .returning();

  res.json(ClaimStreakResponse.parse({
    success: true,
    tickets: updated.tickets,
    streakDays: updated.streakDays,
    bestStreak: updated.bestStreak,
    message: `Streak claimed! +${bonusTickets} tickets. ${newStreak} day streak!`,
    alreadyClaimed: false,
  }));
});

export default router;
