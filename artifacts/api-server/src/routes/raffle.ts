import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetRaffleStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEMO_USER_ID = 1;
const TICKET_VALUE = 5;

function getNextMidnightWAT(): Date {
  const now = new Date();
  const watOffset = 60;
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const watNow = new Date(utcNow + watOffset * 60000);
  const midnight = new Date(watNow);
  midnight.setHours(24, 0, 0, 0);
  const midnightUTC = new Date(midnight.getTime() - watOffset * 60000);
  return midnightUTC;
}

router.get("/raffle/stats", async (_req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable);
  const totalTickets = allUsers.reduce((sum, u) => sum + u.tickets, 0);
  const participants = allUsers.filter(u => u.tickets > 0).length;
  const jackpot = totalTickets * TICKET_VALUE;

  const me = allUsers.find(u => u.id === DEMO_USER_ID);
  const myTickets = me?.tickets ?? 0;
  const myOdds = totalTickets > 0 ? (myTickets / totalTickets) * 100 : 0;

  res.json(GetRaffleStatsResponse.parse({
    jackpot,
    totalTickets,
    uniqueParticipants: participants,
    drawTime: getNextMidnightWAT().toISOString(),
    myTickets,
    myOdds: Math.round(myOdds * 100) / 100,
  }));
});

export default router;
