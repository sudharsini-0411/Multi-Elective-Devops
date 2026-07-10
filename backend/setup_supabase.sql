-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ngondtbbrcqnchajhvew/sql

create table if not exists users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('student', 'admin')),
  historical_satisfaction float default 0.0,
  max_electives int default 1,
  name text,
  roll_no text
);

create table if not exists electives (
  id bigserial primary key,
  code text unique not null,
  name text not null,
  capacity int not null,
  seats_remaining int not null,
  instructor text
);

create table if not exists preferences (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  elective_id bigint references electives(id) on delete cascade,
  points int not null check (points >= 0 and points <= 500),
  rank int not null
);

create table if not exists allocations (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  elective_id bigint references electives(id) on delete cascade,
  semester text not null,
  created_at timestamptz default now()
);

create table if not exists satisfaction_history (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  semester text not null,
  satisfaction_score float not null,
  historical_satisfaction_after float not null,
  created_at timestamptz default now()
);

create table if not exists system_config (
  key text primary key,
  value text
);
