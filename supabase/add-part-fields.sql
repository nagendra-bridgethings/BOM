-- ============================================================================
-- Two more fields per component:
--
--   identification_number — the MANUFACTURER's own part number
--                           (e.g. Murata GRM155R71C104KA88D), as opposed to the
--                           distributor code already held in part_number
--                           (e.g. LCSC C60474). Two different numbers for the
--                           same physical part, so they need two columns.
--
--   supply_form           — how the part is supplied: 'Cut Tape' or 'Reel'.
--                           Deliberately NOT called packaging: `package` is
--                           already the footprint (C0402), which is a different
--                           thing entirely.
--
-- Both nullable and free of constraints: every existing row keeps null, nothing
-- needs backfilling, and rows where neither applies (bare PCBs, enclosures,
-- screws) simply leave them empty. supply_form is constrained in the UI rather
-- than by a CHECK, so adding a third option later is a code change, not a
-- migration on live data.
--
-- MUST be run BEFORE deploying the build that writes these columns.
--
-- Idempotent: if not exists throughout.
-- Run in Supabase: SQL Editor -> paste -> Run.
-- ============================================================================

alter table public.bom_4g_components
  add column if not exists identification_number text,
  add column if not exists supply_form           text;

alter table public.bom_rs485_components
  add column if not exists identification_number text,
  add column if not exists supply_form           text;

alter table public.bom_lora_components
  add column if not exists identification_number text,
  add column if not exists supply_form           text;

-- Adding columns does not change table privileges, but re-granting is harmless
-- and this project has lost anon grants before.
grant all on
  public.bom_4g_components,
  public.bom_rs485_components,
  public.bom_lora_components
  to anon, authenticated;

-- Verify: expect 6 rows — two columns on each of the three tables, all nullable.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and column_name in ('identification_number', 'supply_form')
  and table_name like 'bom_%'
order by table_name, column_name;
