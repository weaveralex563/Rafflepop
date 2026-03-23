import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { winnersTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/winners/daily", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);

  const winners = await db.query.winnersTable.findMany({
    where: eq(winnersTable.drawType, "daily"),
    orderBy: [desc(winnersTable.wonAt)],
    limit,
  });

  const enriched = await Promise.all(
    winners.map(async (w) => {
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, w.userId),
      });
      return {
        userId: w.userId,
        username: user?.username ?? "Unknown",
        profileImage: user?.profileImage ?? null,
        prizeAmount: Number(w.prizeAmount),
        ticketsAtDraw: w.ticketsAtDraw ?? null,
        wonAt: w.wonAt,
        drawDate: w.drawDate,
        drawType: "daily" as const,
      };
    })
  );

  res.json({ winners: enriched, total: enriched.length });
});

router.get("/winners/sunday", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);

  const winners = await db.query.winnersTable.findMany({
    where: eq(winnersTable.drawType, "sunday"),
    orderBy: [desc(winnersTable.wonAt)],
    limit,
  });

  const enriched = await Promise.all(
    winners.map(async (w) => {
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, w.userId),
      });
      return {
        userId: w.userId,
        username: user?.username ?? "Unknown",
        profileImage: user?.profileImage ?? null,
        prizeAmount: Number(w.prizeAmount),
        ticketsAtDraw: w.ticketsAtDraw ?? null,
        wonAt: w.wonAt,
        drawDate: w.drawDate,
        drawType: "sunday" as const,
      };
    })
  );

  res.json({ winners: enriched, total: enriched.length });
});

export default router;
