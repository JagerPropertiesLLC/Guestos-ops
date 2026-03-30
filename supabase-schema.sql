-- GuestOS Operations Database Schema
-- Run this in your Supabase SQL Editor

-- ─── CLEANING SCHEDULES ───────────────────────────────────────────────────────
-- One row per day
create table if not exists cleaning_schedules (
  id              uuid primary key default gen_random_uuid(),
  date            date not null unique,
  generated_at    timestamptz not null default now(),
  overall_status  text not null default 'pending' check (overall_status in ('pending','in_progress','complete')),
  total_units     int not null default 0,
  completed_units int not null default 0,
  updated_at      timestamptz not null default now()
);

-- ─── SCHEDULE UNITS ───────────────────────────────────────────────────────────
-- One row per unit/property being cleaned that day
create table if not exists schedule_units (
  id                  uuid primary key default gen_random_uuid(),
  schedule_id         uuid not null references cleaning_schedules(id) on delete cascade,
  sort_order          int not null default 0,
  property_name       text not null,
  unit_number         text,
  guest_name          text,
  checkout_time       text,
  early_checkin_time  text,
  early_checkin_fee   numeric,
  payment_method      text,
  is_priority         boolean not null default false,
  no_reply            boolean not null default false,
  prior_stay_nights   int,
  status              text not null default 'pending' check (status in ('pending','in_progress','done','issue')),
  notes               jsonb not null default '[]',
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- ─── GUEST FEEDBACK ───────────────────────────────────────────────────────────
-- Stores checkout feedback from guests
create table if not exists guest_feedback (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  text,
  guest_name      text,
  property_name   text,
  rating          int check (rating between 1 and 5),
  feedback_text   text,
  flagged         boolean not null default false,
  source          text default 'sms',
  created_at      timestamptz not null default now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists idx_schedule_units_schedule_id on schedule_units(schedule_id);
create index if not exists idx_cleaning_schedules_date on cleaning_schedules(date);
create index if not exists idx_guest_feedback_property on guest_feedback(property_name);

-- ─── REALTIME ─────────────────────────────────────────────────────────────────
-- Enable real-time so the web app updates live
alter publication supabase_realtime add table cleaning_schedules;
alter publication supabase_realtime add table schedule_units;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Allow reads without auth (schedule page is internal, not public)
alter table cleaning_schedules enable row level security;
alter table schedule_units enable row level security;
alter table guest_feedback enable row level security;

create policy "Allow all reads" on cleaning_schedules for select using (true);
create policy "Allow all writes" on cleaning_schedules for all using (true);
create policy "Allow all reads" on schedule_units for select using (true);
create policy "Allow all writes" on schedule_units for all using (true);
create policy "Allow all reads" on guest_feedback for select using (true);
create policy "Allow all writes" on guest_feedback for all using (true);
