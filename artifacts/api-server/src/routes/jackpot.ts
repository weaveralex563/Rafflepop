import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  dailyJackpotTable,
  sundayJackpotTable,
  jackpotEntryTable,
  winnersTable,
  userStatsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function getNextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(20, 0, 0, 0);
  return nextSunday;
}

async function ensureTodayJackpot() {
  const today = new Date().toISOString().split("T")[0];
  let jackpot = await db.query.dailyJackpotTable.findFirst({
    where: eq(dailyJackpotTable.drawDate, today),
  });
  if (!jackpot) {
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

async function ensureNextSundayJackpot() {
  const nextSunday = getNextSunday();
  const sundayDate = nextSunday.toISOString().split("T")[0];
  
  let jackpot = await db.query.sundayJackpotTable.findFirst({
    where: eq(sundayJackpotTable.drawDate, sundayDate),
  });
  
  if (!jackpot) {
    const today = new Date();
    const daysSinceLastSunday = today.getDay() === 0 ? 0 : today.getDay();
    await db.insert(sundayJackpotTable).values({
      drawDate: sundayDate,
      prizeAmount: String(daysSinceLastSunday * 142.86),
      accumulatedDays: daysSinceLastSunday,
    });
    jackpot = await db.query.sundayJackpotTable.findFirst({
      where: eq(sundayJackpotTable.drawDate, sundayDate),
    });
  }
  return jackpot!;
}

router.get("/jackpot/daily", async (req, res) => {
  const jackpot = await ensureTodayJackpot();
  const today = new Date().toISOString().split("T")[0];
  const drawTime = new Date();
  drawTime.setHours(23, 59, 0, 0);

  let userTickets: number | null = null;
  let winner = null;

  if (req.isAuthenticated()) {
    const entry = await db.query.jackpotEntryTable.findFirst({
      where: and(
        eq(jackpotEntryTable.userId, req.user.id),
        eq(jackpotEntryTable.jackpotId, jackpot.id)
      ),
    });
    userTickets = entry?.tickets ?? 0;
  }

  if (jackpot.winnerId) {
    const winnerUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, jackpot.winnerId),
    });
    const winRecord = await db.query.winnersTable.findFirst({
      where: and(
        eq(winnersTable.userId, jackpot.winnerId),
        eq(winnersTable.drawDate, today),
        eq(winnersTable.drawType, "daily")
      ),
    });
    if (winnerUser && winRecord) {
      winner = {
        userId: winnerUser.id,
        username: winnerUser.username,
        profileImage: winnerUser.profileImage ?? null,
        prizeAmount: Number(winRecord.prizeAmount),
        ticketsAtDraw: winRecord.ticketsAtDraw ?? null,
        wonAt: winRecord.wonAt,
        drawDate: today,
        drawType: "daily" as const,
      };
    }
  }

  res.json({
    date: jackpot.drawDate,
    prizeAmount: Number(jackpot.prizeAmount),
    totalParticipants: jackpot.totalParticipants,
    totalTickets: jackpot.totalTickets,
    userTickets,
    drawTime: drawTime.toISOString(),
    isComplete: jackpot.isComplete,
    winner,
  });
});

router.get("/jackpot/sunday", async (req, res) => {
  const jackpot = await ensureNextSundayJackpot();
  const nextSunday = getNextSunday();

  let userIsQualified = false;
  let userBankedSundays = 0;

  if (req.isAuthenticated()) {
    const stats = await db.query.userStatsTable.findFirst({
      where: eq(userStatsTable.userId, req.user.id),
    });
    userIsQualified = (stats?.sundaysBanked ?? 0) > 0;
    userBankedSundays = stats?.sundaysBanked ?? 0;
  }

  let winner = null;
  if (jackpot.winnerId) {
    const winnerUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, jackpot.winnerId),
    });
    if (winnerUser) {
      winner = {
        userId: winnerUser.id,
        username: winnerUser.username,
        profileImage: winnerUser.profileImage ?? null,
        prizeAmount: Number(jackpot.prizeAmount),
        ticketsAtDraw: null,
        wonAt: jackpot.completedAt ?? new Date(),
        drawDate: jackpot.drawDate,
        drawType: "sunday" as const,
      };
    }
  }

  res.json({
    date: jackpot.drawDate,
    prizeAmount: Number(jackpot.prizeAmount),
    totalQualifiedUsers: jackpot.totalQualifiedUsers,
    userIsQualified,
    userBankedSundays,
    accumulatedDays: jackpot.accumulatedDays,
    drawTime: nextSunday.toISOString(),
    isComplete: jackpot.isComplete,
    winner,
  });
});

export default router;
