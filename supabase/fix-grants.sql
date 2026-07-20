-- ============================================================================
-- Restore anon/authenticated access to the BOM tables.
-- Symptom this fixes: the app shows "permission denied for table
-- bom_4g_components" (HTTP 401) on every read/write.
-- Safe to run any number of times — it only re-applies policies + grants.
-- Run in Supabase: SQL Editor -> paste -> Run.
-- ============================================================================

-- RLS on (no-op if already enabled)
alter table public.bom_4g_components      enable row level security;
alter table public.bom_4g_transactions    enable row level security;
alter table public.bom_rs485_components   enable row level security;
alter table public.bom_rs485_transactions enable row level security;
alter table public.bom_lora_components    enable row level security;
alter table public.bom_lora_transactions  enable row level security;

-- policies (recreated idempotently)
drop policy if exists "bom public all" on public.bom_4g_components;
drop policy if exists "bom public all" on public.bom_4g_transactions;
drop policy if exists "bom public all" on public.bom_rs485_components;
drop policy if exists "bom public all" on public.bom_rs485_transactions;
drop policy if exists "bom public all" on public.bom_lora_components;
drop policy if exists "bom public all" on public.bom_lora_transactions;

create policy "bom public all" on public.bom_4g_components
  for all to anon, authenticated using (true) with check (true);
create policy "bom public all" on public.bom_4g_transactions
  for all to anon, authenticated using (true) with check (true);
create policy "bom public all" on public.bom_rs485_components
  for all to anon, authenticated using (true) with check (true);
create policy "bom public all" on public.bom_rs485_transactions
  for all to anon, authenticated using (true) with check (true);
create policy "bom public all" on public.bom_lora_components
  for all to anon, authenticated using (true) with check (true);
create policy "bom public all" on public.bom_lora_transactions
  for all to anon, authenticated using (true) with check (true);

-- table + view grants (the part that went missing)
grant usage on schema public to anon, authenticated;
grant all on
  public.bom_4g_components,   public.bom_4g_transactions,
  public.bom_rs485_components, public.bom_rs485_transactions,
  public.bom_lora_components,  public.bom_lora_transactions
  to anon, authenticated;
grant select on
  public.bom_4g_component_stock,
  public.bom_rs485_component_stock,
  public.bom_lora_component_stock
  to anon, authenticated;
