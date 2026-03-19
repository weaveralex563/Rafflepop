import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, drawsTable } from "@workspace/db";
import { GetDrawsResponse, GetDrawsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

const EMOJIS = ["🦁", "🐯", "🦊", "🐺", "🦝", "🐻", "🦋", "🐬", "🦄", "🐉", "🎯", "🏆", "⭐", "🌟", "💎"];

router.get("/draws", async (req, res): Promise<void> => {
  const params = GetDrawsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  let rows = await db.select().from(drawsTable).orderBy(desc(drawsTable.createdAt)).limit(limit);

  if (rows.length === 0) {
    const seed = [
      { days: 1, winner: "Lucky_Emeka", prize: 2450, tickets: 490, participants: 38 },
      { days: 2, winner: "Gold_Amaka", prize: 1875, tickets: 375, participants: 29 },
      { days: 3, winner: "Fast_Chidi", prize: 3200, tickets: 640, participants: 51 },
      { days: 4, winner: "Star_Ngozi", prize: 1540, tickets: 308, participants: 24 },
      { days: 5, winner: "Win_Tunde", prize: 4100, tickets: 820, participants: 64 },
    ];
    for (let i = 0; i < seed.length; i++) {
      const s = seed[i];
      const d = new Date();
      d.setDate(d.getDate() - s.days);
      await db.insert(drawsTable).values({
        date: d.toISOString().slice(0, 10),
        winnerUsername: s.winner,
        winnerEmoji: EMOJIS[i % EMOJIS.length],
        prize: s.prize,
        totalTickets: s.tickets,
        participants: s.participants,
      });
    }
    rows = await db.select().from(drawsTable).orderBy(desc(drawsTable.createdAt)).limit(limit);
  }

  res.json(GetDrawsResponse.parse(rows.map(r => ({
    id: String(r.id),
    date: r.date,
    winnerUsername: r.winnerUsername,
    winnerEmoji: r.winnerEmoji,
    prize: r.prize,
    totalTickets: r.totalTickets,
    participants: r.participants,
  }))));
});

export default router;
