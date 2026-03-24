// ============================================================
// RAFFLEPOP — Complete Backend
// File: server/index.ts
// ============================================================
//
// Replit Secrets tab — add these:
//   SUPABASE_URL=your_url
//   SUPABASE_KEY=your_key
//   ADMIN_SECRET=rafflepop_admin_2024
//   BOT_TOKEN=your_telegram_bot_token (optional for now)
// ============================================================

import "./bot";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// ============================================================
// SUPABASE SQL — Run ALL of this in Supabase SQL Editor first
// ============================================================
/*

-- USERS TABLE
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
  -- Streak fields
  current_streak int default 0,
  longest_streak int default 0,
  streak_status text default 'active', -- active | frozen | heat_window | liquidated
  streak_frozen_at timestamptz,
  heat_window_expires timestamptz,
  free_heats_used int default 0,
  free_heats_reset_date text, -- YYYY-MM (resets monthly)
  milestone_attempts jsonb default '{}', -- tracks rebuild attempts per milestone
  former_longest_streak int default 0,
  -- Tier anchor — last completed milestone, streak restarts within this tier
  tier_anchor int default 0,
  next_milestone_target int default 7,
  -- Sunday entries
  banked_sundays int default 0,
  -- Milestone badges (array of day numbers earned)
  badges jsonb default '[]',
  -- Draw stats
  total_draws_entered int default 0,
  total_wins int default 0,
  created_at timestamptz default now()
);

-- DAILY ACTIVITY TABLE (tracks each user's daily progress)
create table if not exists daily_activity (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  activity_date text not null, -- YYYY-MM-DD in WAT
  ads_watched int default 0,
  streak_claimed boolean default false,
  app_opened boolean default false,
  qualified boolean default false, -- true when ads_watched >= 7 AND streak_claimed
  created_at timestamptz default now(),
  unique(user_id, activity_date)
);

-- TICKETS TABLE
create table if not exists tickets (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  draw_id int,
  draw_type text not null, -- daily | weekly
  source text not null, -- ad | referral | streak_bonus
  amount int default 1,
  draw_date text not null, -- YYYY-MM-DD
  created_at timestamptz default now()
);

-- DRAWS TABLE
create table if not exists draws (
  id serial primary key,
  draw_type text not null, -- daily | weekly
  draw_date text not null,
  status text default 'open', -- open | running | completed | no_qualifiers
  prize_amount real default 0,
  total_tickets int default 0,
  total_qualifiers int default 0, -- for weekly
  winner_user_id int references users(id),
  winner_username text,
  server_seed text,
  server_seed_hash text,
  client_seed text,
  revenue_that_period real default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- REVENUE TABLE (tracks every ad watched → money allocation)
create table if not exists revenue_log (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  ad_network text not null, -- monetag | adsgram
  estimated_revenue real not null,
  daily_bucket real not null,   -- 50%
  weekly_bucket real not null,  -- 25%
  reserve_bucket real not null, -- 10%
  profit_bucket real not null,  -- 15%
  log_date text not null,
  created_at timestamptz default now()
);

-- REVENUE BUCKETS (running totals)
create table if not exists revenue_buckets (
  id serial primary key,
  bucket_name text unique not null, -- daily | weekly | reserve | profit | premium
  balance real default 0,
  total_in real default 0,
  total_out real default 0,
  updated_at timestamptz default now()
);

-- Seed buckets
insert into revenue_buckets (bucket_name, balance) values
  ('daily', 0), ('weekly', 0), ('reserve', 0),
  ('profit', 0), ('premium', 0)
on conflict (bucket_name) do nothing;

-- HEAT PURCHASES
create table if not exists heat_purchases (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  stars_spent int not null,
  heats_granted int not null,
  telegram_charge_id text,
  created_at timestamptz default now()
);

-- STREAK EVENTS LOG (audit trail)
create table if not exists streak_events (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  event_type text not null, -- increment | freeze | heat | liquidate | milestone
  streak_before int,
  streak_after int,
  banked_sundays_before int,
  banked_sundays_after int,
  details jsonb,
  created_at timestamptz default now()
);

-- WEEKLY ENTRIES (who qualifies for each Sunday draw)
create table if not exists weekly_entries (
  id serial primary key,
  user_id int references users(id),
  username text not null,
  week_start text not null, -- Monday YYYY-MM-DD
  draw_date text not null,  -- Sunday YYYY-MM-DD
  entry_count int default 1, -- always 1 per week (equal chance)
  source text default 'streak', -- streak | banked
  created_at timestamptz default now(),
  unique(user_id, draw_date)
);

-- COMPLAINTS
create table if not exists complaints (
  id serial primary key,
  user_id int,
  username text not null,
  message text not null,
  response text,
  created_at timestamptz default now(),
  responded_at timestamptz
);

-- INDEXES
create index if not exists idx_daily_activity_date on daily_activity(activity_date);
create index if not exists idx_tickets_draw_date on tickets(draw_date);
create index if not exists idx_tickets_draw_type on tickets(draw_type);
create index if not exists idx_weekly_entries_draw_date on weekly_entries(draw_date);
create index if not exists idx_streak_events_user on streak_events(user_id);

*/

// ============================================================
// CONSTANTS
// ============================================================
const WAT_OFFSET = 1; // UTC+1
const ECPM = 0.004;   // $4 per 1000 impressions = $0.004 per ad

const REVENUE_SPLIT = {
  daily:   0.50,
  weekly:  0.25,
  reserve: 0.10,
  profit:  0.15,
};

const MILESTONES: Record<number, number> = {
  7: 1, 14: 2, 30: 4, 60: 8, 90: 12, 180: 24, 365: 48
};

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
  const wat = new Date(now.getTime() + WAT_OFFSET * 3600000);
  return wat.toISOString().split("T")[0];
}

function getWATMonth(): string {
  return getWATDate().slice(0, 7); // YYYY-MM
}

function getThisSunday(): string {
  const now = new Date();
  const wat = new Date(now.getTime() + WAT_OFFSET * 3600000);
  const day = wat.getUTCDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(wat.getTime() + diff * 86400000);
  return sunday.toISOString().split("T")[0];
}

function getWeekStart(): string {
  const now = new Date();
  const wat = new Date(now.getTime() + WAT_OFFSET * 3600000);
  const day = wat.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(wat.getTime() + diff * 86400000);
  return monday.toISOString().split("T")[0];
}

function generateSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function pickWinner(tickets: any[], serverSeed: string, clientSeed: string): any {
  const combined = serverSeed + clientSeed;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  const index = parseInt(hash.slice(0, 8), 16) % tickets.length;
  return tickets[index];
}

async function addToBucket(bucket: string, amount: number) {
  await supabase.rpc("increment_bucket", {
    bucket_name: bucket, amount
}).then(null, async () => {
    const { data } = await supabase
      .from("revenue_buckets")
      .select("balance, total_in")
      .eq("bucket_name", bucket)
      .single();
    if (data) {
      await supabase
        .from("revenue_buckets")
        .update({
          balance: data.balance + amount,
          total_in: data.total_in + amount,
          updated_at: new Date().toISOString()
        })
        .eq("bucket_name", bucket);
    }
  });
}

async function deductFromBucket(bucket: string, amount: number): Promise<boolean> {
  const { data } = await supabase
    .from("revenue_buckets")
    .select("balance")
    .eq("bucket_name", bucket)
    .single();

  if (!data || data.balance < amount) return false;

  await supabase
    .from("revenue_buckets")
    .update({
      balance: data.balance - amount,
      total_out: amount,
      updated_at: new Date().toISOString()
    })
    .eq("bucket_name", bucket);

  return true;
}

async function logStreakEvent(
  userId: number, username: string, eventType: string,
  streakBefore: number, streakAfter: number,
  sundaysBefore: number, sundaysAfter: number,
  details: any = {}
) {
  await supabase.from("streak_events").insert({
    user_id: userId, username, event_type: eventType,
    streak_before: streakBefore, streak_after: streakAfter,
    banked_sundays_before: sundaysBefore, banked_sundays_after: sundaysAfter,
    details
  });
}

// ============================================================
// STREAK ENGINE
// ============================================================
async function processStreakAtMidnight() {
  console.log("[STREAK] Processing midnight streak evaluation...");
  const today = getWATDate();

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .in("streak_status", ["active", "frozen"]);

  if (!users) return;

  for (const user of users) {
    const { data: activity } = await supabase
      .from("daily_activity")
      .select("ads_watched, streak_claimed, qualified")
      .eq("username", user.username)
      .eq("activity_date", today)
      .single();

    const qualified = activity?.qualified ||
      (activity?.ads_watched >= ADS_REQUIRED_PER_DAY && activity?.streak_claimed);

    if (qualified) {
      const newStreak = user.current_streak + 1;
      const newLongest = Math.max(newStreak, user.longest_streak);

      await supabase.from("users").update({
        current_streak: newStreak,
        longest_streak: newLongest,
        former_longest_streak: Math.max(newStreak, user.former_longest_streak || 0),
        streak_status: "active",
      }).eq("id", user.id);

      await logStreakEvent(user.id, user.username, "increment",
        user.current_streak, newStreak,
        user.banked_sundays, user.banked_sundays, { date: today });

      await checkMilestones(user, newStreak);

    } else {
      const heatExpires = new Date(Date.now() + HEAT_WINDOW_HOURS * 3600000);

      await supabase.from("users").update({
        streak_status: "heat_window",
        streak_frozen_at: new Date().toISOString(),
        heat_window_expires: heatExpires.toISOString(),
      }).eq("id", user.id);

      await logStreakEvent(user.id, user.username, "freeze",
        user.current_streak, user.current_streak,
        user.banked_sundays, user.banked_sundays, { date: today });
    }
  }

  await processExpiredHeatWindows();
  console.log("[STREAK] Done.");
}

// ── TIER ANCHOR HELPERS ───────────────────────────────────
function getTierAnchor(formerLongestStreak: number): number {
  const milestones = [0, 7, 14, 30, 60, 90, 180, 365];
  return [...milestones].reverse().find(m => formerLongestStreak >= m) ?? 0;
}

function getNextTarget(tierAnchor: number): number {
  const milestones = [7, 14, 30, 60, 90, 180, 365];
  return milestones.find(m => m > tierAnchor) ?? 365;
}

function getMilestoneFloor(formerLongestStreak: number): number {
  if (formerLongestStreak >= 365) return 12;
  if (formerLongestStreak >= 180) return 6;
  if (formerLongestStreak >= 90)  return 3;
  if (formerLongestStreak >= 60)  return 2;
  if (formerLongestStreak >= 30)  return 1;
  return 0;
}

async function checkMilestones(user: any, newStreak: number) {
  if (!MILESTONE_DAYS.includes(newStreak)) return;

  const sundaysToBank = MILESTONES[newStreak];
  const sunday = getThisSunday();

  const attempts = user.milestone_attempts || {};
  const attemptCount = attempts[newStreak] || 0;

  let multiplier = 1;
  if (attemptCount === 1) multiplier = 0.5;
  if (attemptCount >= 2) multiplier = 0.25;

  const effectiveSundays = Math.floor(sundaysToBank * multiplier);
  const newBanked = (user.banked_sundays || 0) + effectiveSundays;

  attempts[newStreak] = attemptCount + 1;

  const badges: number[] = user.badges || [];
  if (!badges.includes(newStreak)) badges.push(newStreak);

  const newFormerLongest = Math.max(newStreak, user.former_longest_streak || 0);

  await supabase.from("users").update({
    banked_sundays: newBanked,
    badges,
    milestone_attempts: attempts,
    former_longest_streak: newFormerLongest,
  }).eq("id", user.id);

  await registerBankedSundayEntries(user, effectiveSundays, sunday);

  await logStreakEvent(
    user.id, user.username, "milestone",
    newStreak - 1, newStreak,
    user.banked_sundays, newBanked,
    {
      milestone: newStreak,
      sundaysGranted: effectiveSundays,
      multiplier,
      attemptNumber: attemptCount + 1,
      tierAnchor: getTierAnchor(newFormerLongest),
      nextTarget: getNextTarget(newStreak),
    }
  );

  console.log(
    `[MILESTONE] ${user.username} hit day ${newStreak}! ` +
    `+${effectiveSundays} Sundays (${multiplier * 100}% — attempt #${attemptCount + 1})`
  );
}

async function registerBankedSundayEntries(user: any, count: number, startingSunday: string) {
  const entries = [];
  let currentSunday = new Date(startingSunday + "T00:00:00Z");

  for (let i = 0; i < count; i++) {
    const sundayStr = currentSunday.toISOString().split("T")[0];
    entries.push({
      user_id: user.id,
      username: user.username,
      week_start: getWeekStart(),
      draw_date: sundayStr,
      entry_count: 1,
      source: "banked",
    });
    currentSunday = new Date(currentSunday.getTime() + 7 * 86400000);
  }

  for (const entry of entries) {
    await supabase.from("weekly_entries").upsert(entry, {
      onConflict: "user_id,draw_date"
    });
  }
}

async function processExpiredHeatWindows() {
  const now = new Date().toISOString();

  const { data: expired } = await supabase
    .from("users")
    .select("*")
    .eq("streak_status", "heat_window")
    .lt("heat_window_expires", now);

  if (!expired) return;

  for (const user of expired) {
    await liquidateStreak(user, "heat_window_expired");
  }
}

async function liquidateStreak(user: any, reason: string) {
  const sundaysBefore = user.banked_sundays || 0;
  const formerLongest = Math.max(user.current_streak, user.former_longest_streak || 0);

  const floor = getMilestoneFloor(formerLongest);
  const afterLoss = Math.floor(sundaysBefore * 0.5);
  const sundaysAfter = Math.max(afterLoss, floor);
  const sundaysLost = sundaysBefore - sundaysAfter;
  const floorProtected = sundaysAfter === floor && afterLoss < floor;

  if (sundaysLost > 0) {
    await removeFutureSundayEntries(user.id, sundaysLost);
  }

  const tierAnchor = getTierAnchor(formerLongest);
  const nextTarget = getNextTarget(tierAnchor);

  await supabase.from("users").update({
    current_streak: 0,
    streak_status: "active",
    streak_frozen_at: null,
    heat_window_expires: null,
    banked_sundays: sundaysAfter,
    former_longest_streak: formerLongest,
    tier_anchor: tierAnchor,
    next_milestone_target: nextTarget,
  }).eq("id", user.id);

  await logStreakEvent(
    user.id, user.username, "liquidate",
    user.current_streak, 0,
    sundaysBefore, sundaysAfter,
    {
      reason,
      sundaysLost,
      sundaysAfter,
      floor,
      floorProtected,
      tierAnchor,
      nextTarget,
    }
  );

  console.log(
    `[LIQUIDATE] ${user.username} — streak ${user.current_streak} → 0 | ` +
    `Sundays: ${sundaysBefore} → ${sundaysAfter} (floor: ${floor}${floorProtected ? ' — floor protected' : ''}) | ` +
    `Tier anchor: ${tierAnchor} → rebuilds toward day ${nextTarget}`
  );
}

async function removeFutureSundayEntries(userId: number, countToRemove: number) {
  const today = getWATDate();

  const { data: entries } = await supabase
    .from("weekly_entries")
    .select("id, draw_date")
    .eq("user_id", userId)
    .eq("source", "banked")
    .gte("draw_date", today)
    .order("draw_date", { ascending: false })
    .limit(countToRemove);

  if (!entries?.length) return;

  const idsToRemove = entries.map((e: any) => e.id);
  await supabase.from("weekly_entries").delete().in("id", idsToRemove);
}

// ============================================================
// DRAW ENGINE
// ============================================================
async function runDailyDraw() {
  console.log("[DAILY DRAW] Starting...");
  const today = getWATDate();

  let { data: draw } = await supabase
    .from("draws")
    .select("*")
    .eq("draw_type", "daily")
    .eq("draw_date", today)
    .single();

  if (!draw) {
    const serverSeed = generateSeed();
    const { data: newDraw } = await supabase
      .from("draws")
      .insert({
        draw_type: "daily",
        draw_date: today,
        status: "open",
        server_seed: serverSeed,
        server_seed_hash: hashSeed(serverSeed),
      })
      .select()
      .single();
    draw = newDraw;
  }

  if (!draw || draw.status !== "open") return;

  const { data: bucket } = await supabase
    .from("revenue_buckets")
    .select("balance")
    .eq("bucket_name", "daily")
    .single();

  const prizeAmount = bucket?.balance || 0;

  if (prizeAmount <= 0) {
    await supabase.from("draws").update({ status: "no_qualifiers" }).eq("id", draw.id);
    console.log("[DAILY DRAW] No prize pool today.");
    return;
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*")
    .eq("draw_type", "daily")
    .eq("draw_date", today);

  if (!tickets?.length) {
    await supabase.from("draws").update({ status: "no_qualifiers" }).eq("id", draw.id);
    console.log("[DAILY DRAW] No tickets entered.");
    return;
  }

  await supabase.from("draws").update({ status: "running" }).eq("id", draw.id);

  const clientSeed = today;
  const winner = pickWinner(tickets, draw.server_seed, clientSeed);

  await deductFromBucket("daily", prizeAmount);

  const { data: winnerUser } = await supabase
    .from("users")
    .select("balance, total_wins")
    .eq("username", winner.username)
    .single();

  await supabase.from("users").update({
    balance: (winnerUser?.balance || 0) + prizeAmount,
    total_wins: (winnerUser?.total_wins || 0) + 1,
  }).eq("username", winner.username);

  await supabase.from("draws").update({
    status: "completed",
    prize_amount: prizeAmount,
    total_tickets: tickets.length,
    winner_user_id: winner.user_id,
    winner_username: winner.username,
    client_seed: clientSeed,
    completed_at: new Date().toISOString(),
  }).eq("id", draw.id);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const newSeed = generateSeed();
  await supabase.from("draws").insert({
    draw_type: "daily",
    draw_date: tomorrow,
    status: "open",
    server_seed: newSeed,
    server_seed_hash: hashSeed(newSeed),
  });

  console.log(`[DAILY DRAW] Winner: ${winner.username} — Prize: $${prizeAmount.toFixed(2)}`);
}

async function runWeeklyDraw() {
  console.log("[WEEKLY DRAW] Starting...");
  const today = getWATDate();
  const now = new Date();
  const watDay = new Date(now.getTime() + WAT_OFFSET * 3600000).getUTCDay();

  if (watDay !== 0) {
    console.log("[WEEKLY DRAW] Not Sunday — skipping.");
    return;
  }

  let { data: draw } = await supabase
    .from("draws")
    .select("*")
    .eq("draw_type", "weekly")
    .eq("draw_date", today)
    .single();

  if (!draw) {
    const serverSeed = generateSeed();
    const { data: newDraw } = await supabase
      .from("draws")
      .insert({
        draw_type: "weekly",
        draw_date: today,
        status: "open",
        server_seed: serverSeed,
        server_seed_hash: hashSeed(serverSeed),
      })
      .select()
      .single();
    draw = newDraw;
  }

  if (!draw || draw.status !== "open") return;

  const { data: bucket } = await supabase
    .from("revenue_buckets")
    .select("balance")
    .eq("bucket_name", "weekly")
    .single();

  const prizeAmount = bucket?.balance || 0;

  if (prizeAmount <= 0) {
    await supabase.from("draws").update({ status: "no_qualifiers" }).eq("id", draw.id);
    console.log("[WEEKLY DRAW] No prize pool.");
    return;
  }

  const { data: qualifiers } = await supabase
    .from("weekly_entries")
    .select("*, users!inner(id, username, balance, total_wins)")
    .eq("draw_date", today);

  if (!qualifiers?.length) {
    await supabase.from("draws").update({ status: "no_qualifiers" }).eq("id", draw.id);
    console.log("[WEEKLY DRAW] No qualifiers.");
    return;
  }

  await supabase.from("draws").update({ status: "running" }).eq("id", draw.id);

  const clientSeed = today;
  const winner = pickWinner(qualifiers, draw.server_seed, clientSeed);
  const winnerUser = winner.users;

  await deductFromBucket("weekly", prizeAmount);

  await supabase.from("users").update({
    balance: (winnerUser.balance || 0) + prizeAmount,
    total_wins: (winnerUser.total_wins || 0) + 1,
  }).eq("username", winner.username);

  await supabase.from("draws").update({
    status: "completed",
    prize_amount: prizeAmount,
    total_tickets: qualifiers.length,
    total_qualifiers: qualifiers.length,
    winner_user_id: winnerUser.id,
    winner_username: winner.username,
    client_seed: clientSeed,
    completed_at: new Date().toISOString(),
  }).eq("id", draw.id);

  console.log(`[WEEKLY DRAW] Winner: ${winner.username} — Prize: $${prizeAmount.toFixed(2)}`);
}

// ============================================================
// CRON JOBS (WAT = UTC+1)
// ============================================================
// Daily draw: midnight WAT = 23:00 UTC
cron.schedule("0 23 * * *", async () => {
  await processStreakAtMidnight();
  await runDailyDraw();
}, { timezone: "UTC" });

// Weekly draw: Sunday midnight WAT = Saturday 23:00 UTC
cron.schedule("0 23 * * 6", async () => {
  await runWeeklyDraw();
}, { timezone: "UTC" });

// ============================================================
// RATE LIMITING
// ============================================================
const enterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests" },
});

// ============================================================
// ROUTES
// ============================================================

// ── HEALTH ────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── REGISTER / GET USER ───────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { username, telegramId, deviceId, referredBy } = req.body;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (existing) {
      return res.json({ user: existing, isNew: false });
    }

    const referralCode = `RAFF-${username.replace("User_", "").slice(0, 6).toUpperCase()}`;

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        username,
        telegram_id: telegramId || null,
        device_id: deviceId || null,
        referral_code: referralCode,
        referred_by: referredBy || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Track referral
    if (referredBy) {
      const { data: referrer } = await supabase
        .from("users")
        .select("id, referral_count")
        .eq("referral_code", referredBy)
        .single();

      if (referrer) {
        await supabase.from("referrals").insert({
          referrer_username: referrer.id,
          referee_username: username,
          status: "pending",
        });
        await supabase.from("users")
          .update({ referral_count: (referrer.referral_count || 0) + 1 })
          .eq("id", referrer.id);
      }
    }

    res.json({ user, isNew: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/user/:username", async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("username", req.params.username)
      .single();

    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── STATS ─────────────────────────────────────────────────
app.get("/api/stats", async (_req, res) => {
  try {
    const today = getWATDate();

    const [
      { data: dailyDraw },
      { data: weeklyBucket },
      { data: dailyBucket },
      { count: totalTickets },
      { data: lastDraw },
    ] = await Promise.all([
      supabase.from("draws").select("*").eq("draw_type", "daily").eq("draw_date", today).single(),
      supabase.from("revenue_buckets").select("balance").eq("bucket_name", "weekly").single(),
      supabase.from("revenue_buckets").select("balance").eq("bucket_name", "daily").single(),
      supabase.from("tickets").select("*", { count: "exact" }).eq("draw_date", today).eq("draw_type", "daily"),
      supabase.from("draws").select("winner_username, prize_amount, id").eq("status", "completed").order("completed_at", { ascending: false }).limit(1).single(),
    ]);

    res.json({
      jackpot: dailyBucket?.balance || 0,
      weeklyJackpot: weeklyBucket?.balance || 0,
      totalTickets: totalTickets || 0,
      drawDate: today,
      lastDrawWinnerUsername: lastDraw?.winner_username,
      lastDrawPrize: lastDraw?.prize_amount,
      lastDrawId: lastDraw?.id,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── USER STATS (today's activity) ─────────────────────────
app.get("/api/user/:username/stats", async (req, res) => {
  try {
    const { username } = req.params;
    const today = getWATDate();

    const [
      { data: activity },
      { count: myTickets },
    ] = await Promise.all([
      supabase.from("daily_activity").select("ads_watched, streak_claimed, qualified").eq("username", username).eq("activity_date", today).single(),
      supabase.from("tickets").select("*", { count: "exact" }).eq("username", username).eq("draw_date", today).eq("draw_type", "daily"),
    ]);

    res.json({
      adsWatchedToday: activity?.ads_watched || 0,
      streakClaimedToday: activity?.streak_claimed || false,
      qualifiedToday: activity?.qualified || false,
      myTickets: myTickets || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── ENTER DRAW (watch ad) ─────────────────────────────────
app.post("/api/enter", enterLimiter, async (req, res) => {
  try {
    const { username, adNetwork = "monetag" } = req.body;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const today = getWATDate();
    const revenue = ECPM;

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    const { data: activity } = await supabase
      .from("daily_activity")
      .select("ads_watched, streak_claimed")
      .eq("username", username)
      .eq("activity_date", today)
      .single();

    const newAdsCount = (activity?.ads_watched || 0) + 1;
    const qualified = newAdsCount >= ADS_REQUIRED_PER_DAY && (activity?.streak_claimed || false);

    await supabase.from("daily_activity").upsert({
      user_id: user.id,
      username,
      activity_date: today,
      ads_watched: newAdsCount,
      app_opened: true,
      qualified,
    }, { onConflict: "user_id,activity_date" });

    const ticketRecords = Array.from({ length: TICKETS_PER_AD }, () => ({
      user_id: user.id,
      username,
      draw_type: "daily",
      source: "ad",
      amount: 1,
      draw_date: today,
    }));

    await supabase.from("tickets").insert(ticketRecords);

    const split = {
      daily:   revenue * REVENUE_SPLIT.daily,
      weekly:  revenue * REVENUE_SPLIT.weekly,
      reserve: revenue * REVENUE_SPLIT.reserve,
      profit:  revenue * REVENUE_SPLIT.profit,
    };

    await Promise.all([
      addToBucket("daily",   split.daily),
      addToBucket("weekly",  split.weekly),
      addToBucket("reserve", split.reserve),
      addToBucket("profit",  split.profit),
    ]);

    await supabase.from("revenue_log").insert({
      user_id: user.id,
      username,
      ad_network: adNetwork,
      estimated_revenue: revenue,
      daily_bucket: split.daily,
      weekly_bucket: split.weekly,
      reserve_bucket: split.reserve,
      profit_bucket: split.profit,
      log_date: today,
    });

    await triggerReferralProgress(username);

    res.json({
      ok: true,
      adsWatched: newAdsCount,
      ticketsEarned: TICKETS_PER_AD,
      streakUnlocked: newAdsCount >= ADS_REQUIRED_PER_DAY,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── CLAIM STREAK ──────────────────────────────────────────
app.post("/api/streak/claim", async (req, res) => {
  try {
    const { username } = req.body;
    const today = getWATDate();

    const { data: activity } = await supabase
      .from("daily_activity")
      .select("ads_watched, streak_claimed")
      .eq("username", username)
      .eq("activity_date", today)
      .single();

    if (!activity || activity.ads_watched < ADS_REQUIRED_PER_DAY) {
      return res.status(400).json({
        error: `Watch ${ADS_REQUIRED_PER_DAY} ads first`,
        adsWatched: activity?.ads_watched || 0,
        adsRequired: ADS_REQUIRED_PER_DAY,
      });
    }

    if (activity.streak_claimed) {
      return res.status(400).json({ error: "Streak already claimed today" });
    }

    await supabase.from("daily_activity").update({
      streak_claimed: true,
      qualified: true,
    }).eq("username", username).eq("activity_date", today);

    res.json({ ok: true, message: "Streak claimed! Keep it up tomorrow." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── HEAT UP STREAK ────────────────────────────────────────
app.post("/api/streak/heat", async (req, res) => {
  try {
    const { username } = req.body;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.streak_status !== "heat_window") {
      return res.status(400).json({ error: "No active heat window" });
    }

    if (new Date() > new Date(user.heat_window_expires)) {
      await liquidateStreak(user, "heat_window_expired");
      return res.status(400).json({ error: "Heat window expired — streak liquidated" });
    }

    const currentMonth = getWATMonth();
    const hasUsedFreeHeat = user.free_heats_reset_date === currentMonth && user.free_heats_used >= FREE_HEATS_PER_MONTH;

    if (hasUsedFreeHeat) {
      return res.status(402).json({
        error: "No free heats remaining",
        canPurchase: true,
        purchaseOptions: [
          { heats: 1, stars: 25, label: "1 Heat — 25 Stars" },
          { heats: 3, stars: 50, label: "3 Heats — 50 Stars" },
          { heats: 999, stars: 200, label: "Unlimited — 200 Stars/month" },
        ]
      });
    }

    const newFreeHeatsUsed = user.free_heats_reset_date === currentMonth
      ? user.free_heats_used + 1 : 1;

    await supabase.from("users").update({
      streak_status: "active",
      streak_frozen_at: null,
      heat_window_expires: null,
      free_heats_used: newFreeHeatsUsed,
      free_heats_reset_date: currentMonth,
    }).eq("id", user.id);

    await logStreakEvent(user.id, username, "heat",
      user.current_streak, user.current_streak,
      user.banked_sundays, user.banked_sundays,
      { method: "free", heatsUsedThisMonth: newFreeHeatsUsed });

    res.json({
      ok: true,
      streakRestored: user.current_streak,
      message: `Streak restored! You're back to ${user.current_streak} days.`,
      freeHeatsRemaining: FREE_HEATS_PER_MONTH - newFreeHeatsUsed,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── STREAK STATUS ─────────────────────────────────────────
app.get("/api/streak/:username", async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select(`
        current_streak, longest_streak, former_longest_streak,
        streak_status, heat_window_expires, banked_sundays,
        badges, milestone_attempts, free_heats_used, free_heats_reset_date,
        vip, tier_anchor, next_milestone_target
      `)
      .eq("username", req.params.username)
      .single();

    if (!user) return res.status(404).json({ error: "Not found" });

    const currentMonth = getWATMonth();
    const freeHeatsUsed = user.free_heats_reset_date === currentMonth ? user.free_heats_used : 0;
    const freeHeatsRemaining = Math.max(0, FREE_HEATS_PER_MONTH - freeHeatsUsed);

    let heatWindowSecsLeft = 0;
    if (user.streak_status === "heat_window" && user.heat_window_expires) {
      heatWindowSecsLeft = Math.max(0,
        Math.floor((new Date(user.heat_window_expires).getTime() - Date.now()) / 1000)
      );
    }

    const formerLongest = user.former_longest_streak || 0;
    const tierAnchor = user.tier_anchor ?? getTierAnchor(formerLongest);
    const nextTarget = user.next_milestone_target ?? getNextTarget(tierAnchor);
    const floor = getMilestoneFloor(formerLongest);

    const attempts = user.milestone_attempts || {};
    const attemptCount = attempts[nextTarget] || 0;
    let rewardMultiplier = 1;
    if (attemptCount === 1) rewardMultiplier = 0.5;
    if (attemptCount >= 2) rewardMultiplier = 0.25;
    const nextRewardSundays = Math.floor((MILESTONES[nextTarget] ?? 48) * rewardMultiplier);

    res.json({
      ...user,
      freeHeatsRemaining,
      heatWindowSecsLeft,
      isVip: (user.current_streak ?? 0) >= 60 || user.vip,
      tierAnchor,
      nextTarget,
      nextRewardSundays,
      floor,
      atFloor: (user.banked_sundays ?? 0) <= floor,
      progressInTier: user.current_streak ?? 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DRAWS LIST ────────────────────────────────────────────
app.get("/api/draws", async (_req, res) => {
  try {
    const { data: draws } = await supabase
      .from("draws")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(50);

    res.json(draws || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── USER PRIZES ───────────────────────────────────────────
app.get("/api/user/:username/prizes", async (req, res) => {
  try {
    const { data: prizes } = await supabase
      .from("draws")
      .select("*")
      .eq("winner_username", req.params.username)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    res.json(prizes || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── CONTACT ───────────────────────────────────────────────
app.post("/api/contact", async (req, res) => {
  try {
    const { username, message } = req.body;
    if (!username || !message || message.length < 10) {
      return res.status(400).json({ error: "Message must be at least 10 characters" });
    }

    const { data: user } = await supabase
      .from("users").select("id").eq("username", username).single();

    const { data } = await supabase
      .from("complaints")
      .insert({ user_id: user?.id, username, message })
      .select()
      .single();

    res.json({ ok: true, id: data?.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/contact/:username", async (req, res) => {
  try {
    const { data } = await supabase
      .from("complaints")
      .select("id, message, response, created_at, responded_at")
      .eq("username", req.params.username)
      .order("created_at", { ascending: false });

    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── REFERRAL HELPERS ──────────────────────────────────────
async function triggerReferralProgress(username: string) {
  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referee_username", username)
    .neq("status", "complete")
    .single();

  if (!referral) return;

  const { count: totalAds } = await supabase
    .from("tickets")
    .select("*", { count: "exact" })
    .eq("username", username)
    .eq("source", "ad");

  const newCount = totalAds || 0;

  if (newCount >= 5 && referral.status === "pending") {
    await grantReferralReward(referral.referrer_username, 50, "milestone_1");
    await supabase.from("referrals")
      .update({ status: "milestone_1", ads_watched: newCount })
      .eq("id", referral.id);
  }

  if (newCount >= 10 && referral.status === "milestone_2") {
    await grantReferralReward(referral.referrer_username, 25, "milestone_3");
    await supabase.from("referrals")
      .update({ status: "complete", ads_watched: newCount, completed_at: new Date().toISOString() })
      .eq("id", referral.id);
  }
}

async function grantReferralReward(referrerUsername: string, tickets: number, _milestone: string) {
  const today = getWATDate();
  const { data: user } = await supabase
    .from("users").select("id, referral_tickets_earned").eq("username", referrerUsername).single();
  if (!user) return;

  const cap = 1000;
  const earned = user.referral_tickets_earned || 0;
  const grantable = Math.min(tickets, cap - earned);
  if (grantable <= 0) return;

  await supabase.from("tickets").insert(
    Array.from({ length: grantable }, () => ({
      user_id: user.id,
      username: referrerUsername,
      draw_type: "daily",
      source: "referral",
      amount: 1,
      draw_date: today,
    }))
  );

  await supabase.from("users").update({
    referral_tickets_earned: earned + grantable,
  }).eq("id", user.id);
}

// ── ADMIN ─────────────────────────────────────────────────
const adminAuth = (req: any, res: any, next: any) => {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

app.post("/api/run-draw", adminAuth, async (_req, res) => {
  try {
    await runDailyDraw();
    res.json({ ok: true, message: "Draw executed" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/buckets", adminAuth, async (_req, res) => {
  const { data } = await supabase.from("revenue_buckets").select("*");
  res.json(data);
});

app.get("/api/admin/stats", adminAuth, async (_req, res) => {
  const today = getWATDate();
  const { count: dau } = await supabase
    .from("daily_activity").select("*", { count: "exact" }).eq("activity_date", today);
  const { count: totalUsers } = await supabase
    .from("users").select("*", { count: "exact" });
  const { data: buckets } = await supabase.from("revenue_buckets").select("*");
  res.json({ dau, totalUsers, buckets, today });
});

// ── START ─────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RafflePop backend running on port ${PORT}`);
});

export default app;
