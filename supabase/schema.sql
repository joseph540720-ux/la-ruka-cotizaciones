create table if not exists public.coffee_break_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business jsonb not null default '{}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  customers jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coffee_break_state enable row level security;

create policy "Cada usuario lee sus datos"
on public.coffee_break_state for select
using (auth.uid() = user_id);

create policy "Cada usuario crea sus datos"
on public.coffee_break_state for insert
with check (auth.uid() = user_id);

create policy "Cada usuario actualiza sus datos"
on public.coffee_break_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
