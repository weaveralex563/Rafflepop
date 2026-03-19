import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  tickets: integer("tickets").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastStreakClaim: timestamp("last_streak_claim", { withTimezone: true }),
  adsWatchedToday: integer("ads_watched_today").notNull().default(0),
  lastAdWatchDate: text("last_ad_watch_date"),
  totalWinnings: doublePrecision("total_winnings").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
