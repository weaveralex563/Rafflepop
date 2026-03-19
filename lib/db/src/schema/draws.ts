import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const drawsTable = pgTable("draws", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  winnerUsername: text("winner_username").notNull(),
  winnerEmoji: text("winner_emoji").notNull().default("🎉"),
  prize: doublePrecision("prize").notNull(),
  totalTickets: integer("total_tickets").notNull(),
  participants: integer("participants").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDrawSchema = createInsertSchema(drawsTable).omit({ id: true, createdAt: true });
export type InsertDraw = z.infer<typeof insertDrawSchema>;
export type Draw = typeof drawsTable.$inferSelect;
