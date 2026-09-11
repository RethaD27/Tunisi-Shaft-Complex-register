-- Run this once in your Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- Creates the single table the app uses as a generic shared key-value
-- store, matching the get/set/delete/list shape used in src/storage.js.

create table if not exists kv_store (
  key        text not null,
  shared     boolean not null default true,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (key, shared)
);

-- Row Level Security: this app has no login system — every visitor uses
-- the Supabase anon key, so these policies allow anyone with your project's
-- anon key (i.e. anyone who can load the deployed app) to read and write.
-- That matches an internal shift-team tool with a private link. If you need
-- tighter access control later, add Supabase Auth and scope these policies
-- to authenticated users instead.
alter table kv_store enable row level security;

create policy "Public read access"
  on kv_store for select
  using (true);

create policy "Public insert access"
  on kv_store for insert
  with check (true);

create policy "Public update access"
  on kv_store for update
  using (true);

create policy "Public delete access"
  on kv_store for delete
  using (true);

-- Enable realtime push notifications for this table so every connected
-- browser gets updates instantly instead of only on next page load.
alter publication supabase_realtime add table kv_store;
