-- =====================================================================
--  Riwayat insight AI (penampung hasil Insight AI dashboard dan analisa)
--  Blueprint: tabel ai_reports. Setiap baris milik satu pengguna (RLS).
-- =====================================================================

create table if not exists public.ai_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('dashboard', 'analisa')),
  period_start date not null,
  period_end   date not null,
  metrics      jsonb not null default '{}'::jsonb,
  narrative    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists ai_reports_user_created_idx
  on public.ai_reports (user_id, created_at desc);

alter table public.ai_reports enable row level security;

drop policy if exists "ai_reports owner select" on public.ai_reports;
drop policy if exists "ai_reports owner insert" on public.ai_reports;
drop policy if exists "ai_reports owner delete" on public.ai_reports;

create policy "ai_reports owner select" on public.ai_reports
  for select to authenticated using (auth.uid() = user_id);
create policy "ai_reports owner insert" on public.ai_reports
  for insert to authenticated with check (auth.uid() = user_id);
create policy "ai_reports owner delete" on public.ai_reports
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.ai_reports from anon;
