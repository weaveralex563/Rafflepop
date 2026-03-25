// ============================================================
// RAFFLEPOP — Complete Backend v3 (fixed)
// File: server/index.ts
// ============================================================
import "./bot";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const app = express();

app.use(cors({
  origin: [
    'https://rafflepop.vercel.app',
    'https://rafflepop.onrender.com',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ MISSING SUPABASE CREDENTIALS");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// ============================================================
// SUPABASE SQL — Run in Supabase SQL Editor
// ============================================================
/*
create table if not exists users (
  id serial primary key,
  username text unique not null,
  telegram_id bigint unique,
  device_id text,
  ip_address text,
  balance real default 0 not null,
  vip boolean default false not null,
  referral_code text unique,
  referred_by text,
  referral_count int default 0,
  referral_tickets_earned int default 0,
  current_streak int default 0,
  longest_streak int default 0,
  streak_status text default 'active',
  streak_frozen_at timestamptz,
  heat_window_expires timestamptz,
  free_heats_used int default 0,
  free_heats_reset_date text,
  milestone_attempts jsonb default '{}',
  former_longest_streak int default 0,
  tier_anchor int default 0,
  next_milestone_target int default 7,
  banked_sundays int default 0,
  badges jsonb default '[]',
  total_draws_entered int default 0,
  total_wins int default 0,
  created_at timestamptz default now()
);

create table if not exists daily_activity (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  activity_date text not null,
  ads_watched int default 0,
  streak_claimed boolean default false,
  app_opened boolean default false,
  qualified boolean default false,
  created_at timestamptz default now(),
  unique(user_id, activity_date)
);

create table if not exists tickets (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  draw_id int,
  draw_type text not null,
  source text not null,
  amount int default 1,
  draw_date text not null,
  created_at timestamptz default now()
);

create table if not exists draws (
  id serial primary key,
  draw_type text not null,
  draw_date text not null,
  status text default 'open',
  prize_amount real default 0,
  total_tickets int default 0,
  total_qualifiers int default 0,
  winner_user_id int references users(id),
  winner_username text,
  server_seed text,
  server_seed_hash text,
  client_seed text,
  revenue_that_period real default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists revenue_log (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  ad_network text not null,
  estimated_revenue real not null,
  daily_bucket real not null,
  weekly_bucket real not null,
  reserve_bucket real not null,
  profit_bucket real not null,
  log_date text not null,
  created_at timestamptz default now()
);

create table if not exists revenue_buckets (
  id serial primary key,
  bucket_name text unique not null,
  balance real default 0,
  total_in real default 0,
  total_out real default 0,
  updated_at timestamptz default now()
);

insert into revenue_buckets (bucket_name, balance) values
  ('daily', 0), ('weekly', 0), ('reserve', 0), ('profit', 0), ('premium', 0)
on conflict (bucket_name) do nothing;

create table if not exists heat_purchases (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  stars_spent int not null,
  heats_granted int not null,
  telegram_charge_id text,
  created_at timestamptz default now()
);

create table if not exists streak_events (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  event_type text not null,
  streak_before int,
  streak_after int,
  banked_sundays_before int,
  banked_sundays_after int,
  details jsonb,
  created_at timestamptz default now()
);

create table if not exists weekly_entries (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  week_start text not null,
  draw_date text not null,
  entry_count int default 1,
  source text default 'streak',
  created_at timestamptz default now(),
  unique(user_id, draw_date)
);

-- complaints: add type column if missing
create table if not exists complaints (
  id serial primary key,
  user_id int,
  username text not null,
  type text default 'Issue',
  message text not null,
  response text,
  created_at timestamptz default now(),
  responded_at timestamptz
);

-- referrals table
create table if not exists referrals (
  id serial primary key,
  referrer_username text not null,
  referee_username text not null unique,
  status text default 'pending',
  ads_watched int default 0,
  returned_day2 boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Atomic ads_watched increment function (prevents race conditions)
create or replace function increment_ads_watched(p_user_id int, p_date text)
returns int language plpgsql as $$
declare new_count int;
begin
  insert into daily_activity (user_id, username, activity_date, ads_watched, app_opened)
  select p_user_id, u.username, p_date, 1, true
  from users u where u.id = p_user_id
  on conflict (user_id, activity_date)
  do update set ads_watched = daily_activity.ads_watched + 1
  returning ads_watched into new_count;
  return new_count;
end; $$;

create index if not exists idx_daily_activity_date on daily_activity(activity_date);
create index if not exists idx_tickets_draw_date on tickets(draw_date);
create index if not exists idx_tickets_draw_type on tickets(draw_type);
create index if not exists idx_tickets_username_date on tickets(username, draw_date, draw_type);
create index if not exists idx_weekly_entries_draw_date on weekly_entries(draw_date);
create index if not exists idx_streak_events_user on streak_events(user_id);
*/

// ============================================================
// CONSTANTS
// ============================================================
const WAT_OFFSET = 1;
const ECPM = 0.004;
const REVENUE_SPLIT = { daily: 0.50, weekly: 0.25, reserve: 0.10, profit: 0.15 };
const MILESTONES: Record<number, number> = { 7:1, 14:2, 30:4, 60:8, 90:12, 180:24, 365:48 };
const MILESTONE_DAYS = Object.keys(MILESTONES).map(Number);
const FREE_HEATS_PER_MONTH = 1;
const HEAT_WINDOW_HOURS = 24;
const ADS_REQUIRED_PER_DAY = 7;
const TICKETS_PER_AD = 5;

// ============================================================
// HELPERS
// ============================================================
function getWATDate(): string {
  const now = new Date();
  return new Date(now.getTime() + WAT_OFFSET * 3600000).toISOString().split("T")[0];
}
function getWATMonth(): string { return getWATDate().slice(0, 7); }

function getThisSunday(): string {
  const wat = new Date(Date.now() + WAT_OFFSET * 3600000);
  const day = wat.getUTCDay();
  const diff = day === 0 ? 0 : 7 - day;
  return new Date(wat.getTime() + diff * 86400000).toISOString().split("T")[0];
}

function getWeekStart(): string {
  const wat = new Date(Date.now() + WAT_OFFSET * 3600000);
  const day = wat.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(wat.getTime() + diff * 86400000).toISOString().split("T")[0];
}

function generateSeed(): string { return crypto.randomBytes(32).toString("hex"); }
function hashSeed(seed: string): string { return crypto.createHash("sha256").update(seed).digest("hex"); }

function pickWinner(tickets: any[], serverSeed: string, clientSeed: string): any {
  const hash = crypto.createHash("sha256").update(serverSeed + clientSeed).digest("hex");
  return tickets[parseInt(hash.slice(0, 8), 16) % tickets.length];
}

async function addToBucket(bucket: string, amount: number) {
  const { data } = await supabase.from("revenue_buckets").select("balance, total_in").eq("bucket_name", bucket).single();
  if (data) {
    await supabase.from("revenue_buckets").update({
      balance: data.balance + amount,
      total_in: data.total_in + amount,
      updated_at: new Date().toISOString()
    }).eq("bucket_name", bucket);
  }
}

async function deductFromBucket(bucket: string, amount: number): Promise<boolean> {
  const { data } = await supabase.from("revenue_buckets").select("balance, total_out").eq("bucket_name", bucket).single();
  if (!data || data.balance < amount) return false;
  await supabase.from("revenue_buckets").update({
    balance: data.balance - amount,
    total_out: (data.total_out || 0) + amount,
    updated_at: new Date().toISOString()
  }).eq("bucket_name", bucket);
  return true;
}

async function logStreakEvent(userId: number, username: string, eventType: string, streakBefore: number, streakAfter: number, sundaysBefore: number, sundaysAfter: number, details: any = {}) {
  await supabase.from("streak_events").insert({ user_id: userId, username, event_type: eventType, streak_before: streakBefore, streak_after: streakAfter, banked_sundays_before: sundaysBefore, banked_sundays_after: sundaysAfter, details });
}

function getTierAnchor(f: number): number {
  return ([0,7,14,30,60,90,180,365] as number[]).reverse().find(m => f >= m) ?? 0;
}
function getNextTarget(anchor: number): number {
  return [7,14,30,60,90,180,365].find(m => m > anchor) ?? 365;
}
function getMilestoneFloor(f: number): number {
  if (f >= 365) return 12; if (f >= 180) return 6; if (f >= 90) return 3;
  if (f >= 60) return 2; if (f >= 30) return 1; return 0;
}

// ============================================================
// STREAK ENGINE
// ============================================================
async function processStreakAtMidnight() {
  console.log("[STREAK] Processing...");
  const today = getWATDate();
  const { data: users } = await supabase.from("users").select("*").in("streak_status", ["active", "frozen"]);
  if (!users) return;
  for (const user of users) {
    const { data: activity } = await supabase.from("daily_activity").select("ads_watched, streak_claimed, qualified").eq("username", user.username).eq("activity_date", today).single();
    const qualified = activity?.qualified || (activity?.ads_watched >= ADS_REQUIRED_PER_DAY && activity?.streak_claimed);
    if (qualified) {
      const newStreak = user.current_streak + 1;
      await supabase.from("users").update({ current_streak: newStreak, longest_streak: Math.max(newStreak, user.longest_streak), former_longest_streak: Math.max(newStreak, user.former_longest_streak || 0), streak_status: "active" }).eq("id", user.id);
      await logStreakEvent(user.id, user.username, "increment", user.current_streak, newStreak, user.banked_sundays, user.banked_sundays, { date: today });
      await checkMilestones(user, newStreak);
    } else {
      const heatExpires = new Date(Date.now() + HEAT_WINDOW_HOURS * 3600000);
      await supabase.from("users").update({ streak_status: "heat_window", streak_frozen_at: new Date().toISOString(), heat_window_expires: heatExpires.toISOString() }).eq("id", user.id);
      await logStreakEvent(user.id, user.username, "freeze", user.current_streak, user.current_streak, user.banked_sundays, user.banked_sundays, { date: today });
    }
  }
  await processExpiredHeatWindows();
  console.log("[STREAK] Done.");
}

async function checkMilestones(user: any, newStreak: number) {
  if (!MILESTONE_DAYS.includes(newStreak)) return;
  const attempts = user.milestone_attempts || {};
  const attemptCount = attempts[newStreak] || 0;
  let multiplier = attemptCount === 0 ? 1 : attemptCount === 1 ? 0.5 : 0.25;
  const effectiveSundays = Math.floor(MILESTONES[newStreak] * multiplier);
  const newBanked = (user.banked_sundays || 0) + effectiveSundays;
  attempts[newStreak] = attemptCount + 1;
  const badges: number[] = user.badges || [];
  if (!badges.includes(newStreak)) badges.push(newStreak);
  const newFormerLongest = Math.max(newStreak, user.former_longest_streak || 0);
  await supabase.from("users").update({ banked_sundays: newBanked, badges, milestone_attempts: attempts, former_longest_streak: newFormerLongest }).eq("id", user.id);
  await registerBankedSundayEntries(user, effectiveSundays, getThisSunday());
  await logStreakEvent(user.id, user.username, "milestone", newStreak-1, newStreak, user.banked_sundays, newBanked, { milestone: newStreak, sundaysGranted: effectiveSundays, multiplier });
}

async function registerBankedSundayEntries(user: any, count: number, startingSunday: string) {
  let currentSunday = new Date(startingSunday + "T00:00:00Z");
  for (let i = 0; i < count; i++) {
    await supabase.from("weekly_entries").upsert({ user_id: user.id, username: user.username, week_start: getWeekStart(), draw_date: currentSunday.toISOString().split("T")[0], entry_count: 1, source: "banked" }, { onConflict: "user_id,draw_date" });
    currentSunday = new Date(currentSunday.getTime() + 7 * 86400000);
  }
}

async function processExpiredHeatWindows() {
  const { data: expired } = await supabase.from("users").select("*").eq("streak_status", "heat_window").lt("heat_window_expires", new Date().toISOString());
  if (!expired) return;
  for (const user of expired) await liquidateStreak(user, "heat_window_expired");
}

async function liquidateStreak(user: any, reason: string) {
  const sundaysBefore = user.banked_sundays || 0;
  const formerLongest = Math.max(user.current_streak, user.former_longest_streak || 0);
  const floor = getMilestoneFloor(formerLongest);
  const sundaysAfter = Math.max(Math.floor(sundaysBefore * 0.5), floor);
  const sundaysLost = sundaysBefore - sundaysAfter;
  if (sundaysLost > 0) await removeFutureSundayEntries(user.id, sundaysLost);
  const tierAnchor = getTierAnchor(formerLongest);
  await supabase.from("users").update({ current_streak: 0, streak_status: "active", streak_frozen_at: null, heat_window_expires: null, banked_sundays: sundaysAfter, former_longest_streak: formerLongest, tier_anchor: tierAnchor, next_milestone_target: getNextTarget(tierAnchor) }).eq("id", user.id);
  await logStreakEvent(user.id, user.username, "liquidate", user.current_streak, 0, sundaysBefore, sundaysAfter, { reason, sundaysLost, floor, tierAnchor });
}

async function removeFutureSundayEntries(userId: number, countToRemove: number) {
  const { data: entries } = await supabase.from("weekly_entries").select("id").eq("user_id", userId).eq("source", "banked").gte("draw_date", getWATDate()).order("draw_date", { ascending: false }).limit(countToRemove);
  if (!entries?.length) return;
  await supabase.from("weekly_entries").delete().in("id", entries.map((e: any) => e.id));
}

// ============================================================
// DRAW ENGINE
// ============================================================
async function runDailyDraw() {
  const today = getWATDate();
  let { data: draw } = await supabase.from("draws").select("*").eq("draw_type", "daily").eq("draw_date", today).single();
  if (!draw) {
    const seed = generateSeed();
    const { data: d } = await supabase.from("draws").insert({ draw_type: "daily", draw_date: today, status: "open", server_seed: seed, server_seed_hash: hashSeed(seed) }).select().single();
    draw = d;
  }
  if (!draw || draw.status !== "open") return;
  const { data: bucket } = await supabase.from("revenue_buckets").select("balance").eq("bucket_name", "daily").single();
  const prize = bucket?.balance || 0;
  if (prize <= 0) { await supabase.from("draws").update({ status: "no_qualifiers" }).eq("id", draw.id); return; }
  const { data: tickets } = await supabase.from("tickets").select("*").eq("draw_type", "daily").eq("draw_date", today);
  if (!tickets?.length) { await supabase.from("draws").update({ status: "no_qualifiers" }).eq("id", draw.id); return; }
  await supabase.from("draws").update({ status: "running" }).eq("id", draw.id);
  const winner = pickWinner(tickets, draw.server_seed, today);
  await deductFromBucket("daily", prize);
  const { data: wu } = await supabase.from("users").select("balance, total_wins").eq("username", winner.username).single();
  await supabase.from("users").update({ balance: (wu?.balance || 0) + prize, total_wins: (wu?.total_wins || 0) + 1 }).eq("username", winner.username);
  await supabase.from("draws").update({ status: "completed", prize_amount: prize, total_tickets: tickets.length, winner_user_id: winner.user_id, winner_username: winner.username, client_seed: today, completed_at: new Date().toISOString() }).eq("id", draw.id);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const ns = generateSeed();
  await supabase.from("draws").insert({ draw_type: "daily", draw_date: tomorrow, status: "open", server_seed: ns, server_seed_hash: hashSeed(ns) });
  console.log(`[DRAW] Winner: ${winner.username} $${prize.toFixed(2)}`);
}

async function runWeeklyDraw() {
  const today = getWATDate();
  const watDay = new Date(Date.now() + WAT_OFFSET * 3600000).getUTCDay();
  if (watDay !== 0) return;
  const { data: bucket } = await supabase.from("revenue_buckets").select("balance").eq("bucket_name", "weekly").single();
  const prize = bucket?.balance || 0;
  const { data: qualifiers } = await supabase.from("weekly_entries").select("*").eq("draw_date", today);
  if (!qualifiers?.length || prize <= 0) { if (prize > 0) { await deductFromBucket("weekly", prize); await addToBucket("profit", prize); } return; }
  const seed = generateSeed();
  const winner = pickWinner(qualifiers, seed, today);
  await deductFromBucket("weekly", prize);
  const { data: wu } = await supabase.from("users").select("balance, total_wins").eq("username", winner.username).single();
  await supabase.from("users").update({ balance: (wu?.balance||0)+prize, total_wins: (wu?.total_wins||0)+1 }).eq("username", winner.username);
  await supabase.from("draws").insert({ draw_type: "weekly", draw_date: today, status: "completed", prize_amount: prize, total_qualifiers: qualifiers.length, winner_user_id: winner.user_id, winner_username: winner.username, server_seed: seed, server_seed_hash: hashSeed(seed), client_seed: today, completed_at: new Date().toISOString() });
  console.log(`[WEEKLY] Winner: ${winner.username} $${prize.toFixed(2)}`);
}

// ============================================================
// CRON
// ============================================================
cron.schedule("0 23 * * *", async () => { await processStreakAtMidnight(); await runDailyDraw(); }, { timezone: "UTC" });
cron.schedule("0 23 * * 6", async () => { await runWeeklyDraw(); }, { timezone: "UTC" });
cron.schedule("*/30 * * * *", async () => { await processExpiredHeatWindows(); });

// ============================================================
// RATE LIMITING
// ============================================================
const enterLimiter = rateLimit({ windowMs: 60000, max: 10, message: { error: "Too many requests" } });
const generalLimiter = rateLimit({ windowMs: 60000, max: 60 });
app.use("/api", generalLimiter);

// ============================================================
// ROUTES
// ============================================================

app.get("/", (_req, res) => res.json({ ok: true, service: "RafflePop API" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── AUTH ─────────────────────────────────────────────────
// ✅ FIX: Frontend calls /api/auth — this was missing from new backend
app.post("/api/auth", async (req, res) => {
  try {
    const { username, telegram_id, referredBy } = req.body;

    // Build a safe username — never allow undefined
    const safeUsername = username && username !== 'undefined' && username !== 'null'
      ? String(username)
      : telegram_id ? `tg_${telegram_id}` : `user_${Date.now()}`;

    const { data: existing } = await supabase.from("users").select("*").eq("username", safeUsername).single();
    if (existing) {
      // Mark app opened today
      await supabase.from("daily_activity").upsert({
        user_id: existing.id, username: safeUsername,
        activity_date: getWATDate(), app_opened: true,
      }, { onConflict: "user_id,activity_date" });
      return res.json({ ok: true, user: existing });
    }

    // Also try by telegram_id if provided
    if (telegram_id) {
      const { data: byTg } = await supabase.from("users").select("*").eq("telegram_id", telegram_id).single();
      if (byTg) return res.json({ ok: true, user: byTg });
    }

    // Create new user
    const referralCode = `RAFF-${safeUsername.replace(/^(User_|tg_)/, '').slice(0, 6).toUpperCase()}`;
    const { data: newUser, error } = await supabase.from("users").insert({
      username: safeUsername,
      telegram_id: telegram_id || null,
      referral_code: referralCode,
      referred_by: referredBy || null,
    }).select().single();

    if (error) throw error;

    // Create today's activity record
    await supabase.from("daily_activity").upsert({
      user_id: newUser.id, username: safeUsername,
      activity_date: getWATDate(), app_opened: true,
    }, { onConflict: "user_id,activity_date" });

    // Handle referral
    if (referredBy) {
      const { data: referrer } = await supabase.from("users").select("id, referral_count").eq("referral_code", referredBy).single();
      if (referrer) {
        await supabase.from("referrals").insert({ referrer_username: referrer.id, referee_username: safeUsername, status: "pending" }).then(null, () => {});
        await supabase.from("users").update({ referral_count: (referrer.referral_count || 0) + 1 }).eq("id", referrer.id);
      }
    }

    console.log(`[AUTH] New user created: ${safeUsername}`);
    return res.json({ ok: true, user: newUser });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Keep /api/register as alias
app.post("/api/register", async (req, res) => {
  req.body.username = req.body.username || (req.body.telegramId ? `tg_${req.body.telegramId}` : undefined);
  req.body.telegram_id = req.body.telegramId;
  return app._router.handle({ ...req, url: '/api/auth', path: '/api/auth' } as any, res, () => {});
});

// ── USER ─────────────────────────────────────────────────
app.get("/api/user/:username", async (req, res) => {
  try {
    const { data: user } = await supabase.from("users").select("*").eq("username", req.params.username).single();
    if (!user) return res.status(404).json({ error: "Not found" });
    await supabase.from("daily_activity").upsert({ user_id: user.id, username: user.username, activity_date: getWATDate(), app_opened: true }, { onConflict: "user_id,activity_date" });
    res.json(user);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── STATS ─────────────────────────────────────────────────
// ✅ FIX: Returns both poolSize AND totalTickets so frontend works regardless of field name
app.get("/api/stats", async (_req, res) => {
  try {
    const today = getWATDate();
    const sunday = getThisSunday();

    // Get all today's tickets and sum amounts
    const { data: ticketRows } = await supabase.from("tickets").select("amount, username").eq("draw_type", "daily").eq("draw_date", today);
    const poolSize = (ticketRows || []).reduce((sum: number, r: any) => sum + (r.amount || 1), 0);
    const uniquePlayers = new Set((ticketRows || []).map((r: any) => r.username)).size;

    const { data: dailyBucket } = await supabase.from("revenue_buckets").select("balance").eq("bucket_name", "daily").single();
    const { data: weeklyBucket } = await supabase.from("revenue_buckets").select("balance").eq("bucket_name", "weekly").single();
    const { data: lastDraw } = await supabase.from("draws").select("id, winner_username, prize_amount").eq("status", "completed").order("completed_at", { ascending: false }).limit(1).single();
    const { count: weeklyQualifiers } = await supabase.from("weekly_entries").select("*", { count: "exact" }).eq("draw_date", sunday);

    res.json({
      poolSize,             // ✅ what frontend uses
      totalTickets: poolSize, // ✅ alias
      jackpot: dailyBucket?.balance || 0,
      weeklyJackpot: weeklyBucket?.balance || 0,
      weeklyQualifiers: weeklyQualifiers || 0,
      totalPlayers: uniquePlayers,
      nextSunday: sunday,
      drawDate: today,
      lastDrawId: lastDraw?.id,
      lastDrawPrize: lastDraw?.prize_amount,
      lastDrawWinnerUsername: lastDraw?.winner_username,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── USER STATS ────────────────────────────────────────────
app.get("/api/user/:username/stats", async (req, res) => {
  try {
    const { username } = req.params;
    const today = getWATDate();
    const sunday = getThisSunday();

    const { data: allTickets } = await supabase.from("tickets").select("amount, username").eq("draw_type", "daily").eq("draw_date", today);
    const totalTickets = (allTickets || []).reduce((s: number, r: any) => s + (r.amount || 1), 0);
    const myTickets = (allTickets || []).filter((r: any) => r.username === username).reduce((s: number, r: any) => s + (r.amount || 1), 0);
    const uniquePlayers = new Set((allTickets || []).map((r: any) => r.username)).size;
    const myChances = totalTickets > 0 && myTickets > 0 ? ((myTickets / totalTickets) * 100).toFixed(2) + "%" : "0%";

    const { data: activity } = await supabase.from("daily_activity").select("ads_watched, streak_claimed, qualified").eq("username", username).eq("activity_date", today).single();
    const { data: sundayEntry } = await supabase.from("weekly_entries").select("id").eq("username", username).eq("draw_date", sunday).single();

    res.json({
      totalTickets,
      totalPlayers: uniquePlayers,
      myTickets,
      myChances,
      adsWatchedToday: activity?.ads_watched || 0,
      streakClaimedToday: activity?.streak_claimed || false,
      qualifiedToday: activity?.qualified || false,
      qualifiesThisSunday: !!sundayEntry,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── ENTER DRAW ────────────────────────────────────────────
app.post("/api/enter", enterLimiter, async (req, res) => {
  try {
    const { username, adNetwork = "monetag" } = req.body;
    if (!username || username === 'undefined') return res.status(400).json({ error: "Missing username" });
    const today = getWATDate();

    const { data: user } = await supabase.from("users").select("id").eq("username", username).single();
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ FIX: Use atomic RPC if available, else safe fallback
    let newAdsCount: number;
    let streakClaimed = false;
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("increment_ads_watched", { p_user_id: user.id, p_date: today });
    if (!rpcErr && rpcResult !== null) {
      newAdsCount = rpcResult;
      const { data: act } = await supabase.from("daily_activity").select("streak_claimed").eq("user_id", user.id).eq("activity_date", today).single();
      streakClaimed = act?.streak_claimed || false;
    } else {
      // Fallback
      const { data: activity } = await supabase.from("daily_activity").select("ads_watched, streak_claimed").eq("username", username).eq("activity_date", today).single();
      newAdsCount = (activity?.ads_watched || 0) + 1;
      streakClaimed = activity?.streak_claimed || false;
      const qualified = newAdsCount >= ADS_REQUIRED_PER_DAY && streakClaimed;
      await supabase.from("daily_activity").upsert({ user_id: user.id, username, activity_date: today, ads_watched: newAdsCount, app_opened: true, qualified }, { onConflict: "user_id,activity_date" });
    }

    // Insert 5 ticket rows
    await supabase.from("tickets").insert(
      Array.from({ length: TICKETS_PER_AD }, () => ({ user_id: user.id, username, draw_type: "daily", source: "ad", amount: 1, draw_date: today }))
    );

    // Revenue buckets
    const revenue = ECPM;
    await Promise.all([
      addToBucket("daily", revenue * REVENUE_SPLIT.daily),
      addToBucket("weekly", revenue * REVENUE_SPLIT.weekly),
      addToBucket("reserve", revenue * REVENUE_SPLIT.reserve),
      addToBucket("profit", revenue * REVENUE_SPLIT.profit),
    ]);

    await supabase.from("revenue_log").insert({ user_id: user.id, username, ad_network: adNetwork, estimated_revenue: revenue, daily_bucket: revenue*0.5, weekly_bucket: revenue*0.25, reserve_bucket: revenue*0.1, profit_bucket: revenue*0.15, log_date: today });

    await triggerReferralProgress(username);

    res.json({ ok: true, adsWatched: newAdsCount, ticketsEarned: TICKETS_PER_AD, streakUnlocked: newAdsCount >= ADS_REQUIRED_PER_DAY });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── STREAK CLAIM ──────────────────────────────────────────
app.post("/api/streak/claim", async (req, res) => {
  try {
    const { username } = req.body;
    const today = getWATDate();
    const { data: activity } = await supabase.from("daily_activity").select("ads_watched, streak_claimed").eq("username", username).eq("activity_date", today).single();
    if (!activity || activity.ads_watched < ADS_REQUIRED_PER_DAY) return res.status(400).json({ error: `Watch ${ADS_REQUIRED_PER_DAY} ads first`, adsWatched: activity?.ads_watched || 0, adsRequired: ADS_REQUIRED_PER_DAY });
    if (activity.streak_claimed) return res.status(400).json({ error: "Already claimed today" });
    await supabase.from("daily_activity").update({ streak_claimed: true, qualified: true }).eq("username", username).eq("activity_date", today);
    res.json({ ok: true, message: "Streak claimed!" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── HEAT UP ───────────────────────────────────────────────
app.post("/api/streak/heat", async (req, res) => {
  try {
    const { username } = req.body;
    const { data: user } = await supabase.from("users").select("*").eq("username", username).single();
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.streak_status !== "heat_window") return res.status(400).json({ error: "No active heat window" });
    if (new Date() > new Date(user.heat_window_expires)) { await liquidateStreak(user, "heat_window_expired"); return res.status(400).json({ error: "Heat window expired" }); }
    const currentMonth = getWATMonth();
    const freeUsed = user.free_heats_reset_date === currentMonth ? user.free_heats_used : 0;
    if (freeUsed >= FREE_HEATS_PER_MONTH) return res.status(402).json({ error: "No free heats remaining", canPurchase: true, purchaseOptions: [{ heats:1, stars:25 }, { heats:3, stars:50 }, { heats:999, stars:200 }] });
    await supabase.from("users").update({ streak_status: "active", streak_frozen_at: null, heat_window_expires: null, free_heats_used: freeUsed + 1, free_heats_reset_date: currentMonth }).eq("id", user.id);
    await logStreakEvent(user.id, username, "heat", user.current_streak, user.current_streak, user.banked_sundays, user.banked_sundays, { method: "free" });
    res.json({ ok: true, streakRestored: user.current_streak, freeHeatsRemaining: FREE_HEATS_PER_MONTH - freeUsed - 1 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── STREAK STATUS ─────────────────────────────────────────
app.get("/api/streak/:username", async (req, res) => {
  try {
    const { data: user } = await supabase.from("users").select("current_streak, longest_streak, former_longest_streak, streak_status, heat_window_expires, banked_sundays, badges, milestone_attempts, free_heats_used, free_heats_reset_date, vip, tier_anchor, next_milestone_target").eq("username", req.params.username).single();
    if (!user) return res.status(404).json({ error: "Not found" });
    const currentMonth = getWATMonth();
    const freeUsed = user.free_heats_reset_date === currentMonth ? user.free_heats_used : 0;
    const freeHeatsRemaining = Math.max(0, FREE_HEATS_PER_MONTH - freeUsed);
    let heatWindowSecsLeft = 0;
    if (user.streak_status === "heat_window" && user.heat_window_expires) {
      heatWindowSecsLeft = Math.max(0, Math.floor((new Date(user.heat_window_expires).getTime() - Date.now()) / 1000));
    }
    const formerLongest = user.former_longest_streak || 0;
    const tierAnchor = user.tier_anchor ?? getTierAnchor(formerLongest);
    const nextTarget = user.next_milestone_target ?? getNextTarget(tierAnchor);
    const floor = getMilestoneFloor(formerLongest);
    const attempts = user.milestone_attempts || {};
    const attemptCount = attempts[nextTarget] || 0;
    const mult = attemptCount === 0 ? 1 : attemptCount === 1 ? 0.5 : 0.25;
    const nextRewardSundays = Math.floor((MILESTONES[nextTarget] ?? 48) * mult);
    res.json({ ...user, freeHeatsRemaining, heatWindowSecsLeft, isVip: (user.current_streak ?? 0) >= 60 || user.vip, tierAnchor, nextTarget, nextRewardSundays, floor, atFloor: (user.banked_sundays ?? 0) <= floor, progressInTier: user.current_streak ?? 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DRAWS ─────────────────────────────────────────────────
app.get("/api/draws", async (_req, res) => {
  try {
    const { data } = await supabase.from("draws").select("*").eq("status", "completed").order("completed_at", { ascending: false }).limit(50);
    res.json(data || []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/user/:username/prizes", async (req, res) => {
  try {
    const { data } = await supabase.from("draws").select("*").eq("winner_username", req.params.username).eq("status", "completed").order("completed_at", { ascending: false });
    res.json(data || []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── CONTACT ───────────────────────────────────────────────
app.post("/api/contact", async (req, res) => {
  try {
    const { username, userId, type, message } = req.body;
    if (!username || !message || message.length < 5) return res.status(400).json({ error: "Message too short" });
    const { data: user } = await supabase.from("users").select("id").eq("username", username).single();
    const { data } = await supabase.from("complaints").insert({ user_id: user?.id, username, type: type || "Issue", message }).select().single();
    res.json({ ok: true, id: data?.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/contact/:username", async (req, res) => {
  try {
    const { data } = await supabase.from("complaints").select("id, message, type, response, created_at, responded_at").eq("username", req.params.username).order("created_at", { ascending: true });
    res.json(data || []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ✅ FIX: This route was missing — frontend polls it for admin replies
app.get("/api/contact/:username/responses", async (req, res) => {
  try {
    const { data } = await supabase.from("complaints").select("id, response, responded_at").eq("username", req.params.username).not("response", "is", null).order("responded_at", { ascending: true });
    const responses = (data || []).map((r: any) => ({
      ts: new Date(r.responded_at).getTime(),
      message: r.response,
      date: new Date(r.responded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      complaintId: r.id,
    }));
    res.json({ responses });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN ─────────────────────────────────────────────────
// Declared here so it's available to all routes that use it below
const adminAuth = (req: any, res: any, next: any) => {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  next();
};

// ── ADMIN RESPOND TO COMPLAINT ────────────────────────────
app.post("/api/admin/respond", adminAuth, async (req, res) => {
  try {
    const { complaintId, response } = req.body;
    if (!complaintId || !response) return res.status(400).json({ error: "Missing fields" });
    await supabase.from("complaints").update({ response, responded_at: new Date().toISOString() }).eq("id", complaintId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── REFERRAL HELPERS ──────────────────────────────────────
async function triggerReferralProgress(username: string) {
  const { data: referral } = await supabase.from("referrals").select("*").eq("referee_username", username).neq("status", "complete").single();
  if (!referral) return;
  const { count: totalAds } = await supabase.from("tickets").select("*", { count: "exact" }).eq("username", username).eq("source", "ad");
  const n = totalAds || 0;
  if (n >= 5 && referral.status === "pending") {
    await grantReferralReward(referral.referrer_username, 50);
    await supabase.from("referrals").update({ status: "milestone_1", ads_watched: n }).eq("id", referral.id);
  }
  if (n >= 10 && referral.status === "milestone_2") {
    await grantReferralReward(referral.referrer_username, 25);
    await supabase.from("referrals").update({ status: "complete", ads_watched: n, completed_at: new Date().toISOString() }).eq("id", referral.id);
  }
}

async function grantReferralReward(referrerUsername: string, tickets: number) {
  const today = getWATDate();
  const { data: user } = await supabase.from("users").select("id, referral_tickets_earned").eq("username", referrerUsername).single();
  if (!user) return;
  const grantable = Math.min(tickets, 1000 - (user.referral_tickets_earned || 0));
  if (grantable <= 0) return;
  await supabase.from("tickets").insert(Array.from({ length: grantable }, () => ({ user_id: user.id, username: referrerUsername, draw_type: "daily", source: "referral", amount: 1, draw_date: today })));
  await supabase.from("users").update({ referral_tickets_earned: (user.referral_tickets_earned || 0) + grantable }).eq("id", user.id);
}

// ── REMAINING ADMIN ROUTES ────────────────────────────────
app.post("/api/run-draw", adminAuth, async (_req, res) => {
  try { await runDailyDraw(); res.json({ ok: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/buckets", adminAuth, async (_req, res) => {
  const { data } = await supabase.from("revenue_buckets").select("*");
  res.json(data);
});

app.get("/api/admin/stats", adminAuth, async (_req, res) => {
  const today = getWATDate();
  const { count: dau } = await supabase.from("daily_activity").select("*", { count: "exact" }).eq("activity_date", today);
  const { count: totalUsers } = await supabase.from("users").select("*", { count: "exact" });
  const { data: buckets } = await supabase.from("revenue_buckets").select("*");
  res.json({ dau, totalUsers, buckets, today });
});

app.get("/api/admin/complaints", adminAuth, async (_req, res) => {
  const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
  res.json(data || []);
});

// ── START ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000");
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RafflePop backend running on port ${PORT}`);
});

export default app;
