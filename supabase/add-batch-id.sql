-- ============================================================================
-- Give every bulk outward a batch id, so the rows it wrote can be found again
-- as one issue rather than as N unrelated outwards.
--
-- Nullable and unconstrained on purpose:
--   * every existing transaction keeps batch_id = null and is unaffected
--   * a single-item outward (the per-row Outward button) also writes null
-- So "is a bulk outward" is exactly "batch_id is not null", with no backfill
-- and no guessing from matching dates or reason text.
--
-- All three devices share one id per issue, which is what lets a batch spanning
-- 4G + RS485 + LORA show up as a single entry in batch history.
--
-- MUST be run BEFORE deploying the cart build — the bulk insert writes this
-- column, and against an older schema every bulk outward would fail outright.
--
-- Idempotent: if not exists / or replace throughout.
-- Run in Supabase: SQL Editor -> paste -> Run.
-- ============================================================================

alter table public.bom_4g_transactions    add column if not exists batch_id uuid;
alter table public.bom_rs485_transactions add column if not exists batch_id uuid;
alter table public.bom_lora_transactions  add column if not exists batch_id uuid;

-- History reads every batch row for a device and groups by id, so the partial
-- index is both the lookup path and a way to keep it off the single-item rows.
create index if not exists bom_4g_txn_batch_idx
  on public.bom_4g_transactions (batch_id) where batch_id is not null;
create index if not exists bom_rs485_txn_batch_idx
  on public.bom_rs485_transactions (batch_id) where batch_id is not null;
create index if not exists bom_lora_txn_batch_idx
  on public.bom_lora_transactions (batch_id) where batch_id is not null;

-- Adding a column does not change table privileges, but re-granting is harmless
-- and this project has lost anon grants before.
grant all on
  public.bom_4g_transactions,
  public.bom_rs485_transactions,
  public.bom_lora_transactions
  to anon, authenticated;

-- Verify: expect one batch_id row per device, all uuid, all nullable.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and column_name = 'batch_id'
  and table_name like 'bom_%'
order by table_name;
