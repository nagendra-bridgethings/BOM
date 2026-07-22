-- ============================================================================
-- BOM (Bill of Materials) — Water Meter Inventory schema
-- SEPARATE TABLES PER DEVICE (4G / RS485 / LORA).
--
-- Each device gets its own components + transactions table so you can browse
-- one device at a time directly in the SQL editor. The sub-board (Main Board /
-- Mira Top Board / Reed Sensor / Read Sensor) is kept as a `sub_board` column
-- inside each device's components table.
--
-- All objects are namespaced "bom_<device>_*" so they coexist safely with the
-- other tables already in this shared Supabase project (csm_users, bt_*, ...).
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Then run seed.sql (or `node scripts/seed-api.mjs`) to load the components.
-- ============================================================================

create extension if not exists "pgcrypto";

-- keep updated_at fresh (shared by every device's components table)
create or replace function public.bom_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================================
-- 4G
-- ============================================================================
create table if not exists public.bom_4g_components (
  id                uuid primary key default gen_random_uuid(),
  sub_board         text not null default 'Main Board',  -- 'Main Board' | 'Mira Top Board'
  s_no              int,
  s_no_raw          text,
  component         text,               -- 'Capacitor', 'Resistor', 'IC', ...
  value_raw         text,               -- exact original VALUE cell
  value             text,               -- parsed base value  (e.g. '100nF', '10kΩ')
  voltage           text,               -- parsed voltage      (e.g. '16V')
  rating            text,               -- parsed power/current (e.g. '125mW','120mA')
  material          text,               -- dielectric / temp-coeff (e.g. 'X7R')
  tolerance         text,               -- parsed tolerance    (e.g. '10%','±1%')
  label             text,               -- reference designators (e.g. 'R2,R3,R10')
  package           text,               -- the PDF 'TYPE' column (e.g. 'R0402')
  part_number       text,               -- e.g. 'C60474' (distributor code)
  identification_number text,           -- the manufacturer's own number
  supply_form       text,               -- 'Cut Tape' | 'Reel', blank where n/a
  opening_quantity  numeric not null default 0,
  quantity_note     text,               -- 'NC' etc. when qty is not a number
  flags             text[] not null default '{}',
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_bom_4g_components_sub_board on public.bom_4g_components(sub_board);

create table if not exists public.bom_4g_transactions (
  id              uuid primary key default gen_random_uuid(),
  component_id    uuid not null references public.bom_4g_components(id) on delete cascade,
  type            text not null check (type in ('inward','outward','return')),
  qty             numeric,            -- inward added / return returned
  qty_needed      numeric,            -- outward only
  qty_sent        numeric,            -- outward only (this is what decrements stock)
  related_txn_id  uuid references public.bom_4g_transactions(id),
  txn_date        date not null default current_date,
  reason          text,
  batch_id        uuid,               -- set only by a bulk outward; groups its rows
  created_at      timestamptz not null default now()
);
create index if not exists idx_bom_4g_txn_component on public.bom_4g_transactions(component_id);
create index if not exists bom_4g_txn_batch_idx on public.bom_4g_transactions(batch_id) where batch_id is not null;

drop trigger if exists trg_bom_4g_components_touch on public.bom_4g_components;
create trigger trg_bom_4g_components_touch
  before update on public.bom_4g_components
  for each row execute function public.bom_touch_updated_at();

create or replace view public.bom_4g_component_stock
with (security_invoker = on) as
select
  c.id as component_id,
  c.opening_quantity
    + coalesce((select sum(t.qty)      from public.bom_4g_transactions t
                 where t.component_id = c.id and t.type = 'inward'),  0)
    - coalesce((select sum(t.qty_sent) from public.bom_4g_transactions t
                 where t.component_id = c.id and t.type = 'outward'), 0)
    + coalesce((select sum(t.qty)      from public.bom_4g_transactions t
                 where t.component_id = c.id and t.type = 'return'),  0)
  as quantity_in_hand
from public.bom_4g_components c;

-- ============================================================================
-- RS485
-- ============================================================================
create table if not exists public.bom_rs485_components (
  id                uuid primary key default gen_random_uuid(),
  sub_board         text not null default 'Main Board',  -- 'Main Board' | 'Reed Sensor'
  s_no              int,
  s_no_raw          text,
  component         text,
  value_raw         text,
  value             text,
  voltage           text,
  rating            text,
  material          text,
  tolerance         text,
  label             text,
  package           text,
  part_number       text,
  identification_number text,
  supply_form       text,
  opening_quantity  numeric not null default 0,
  quantity_note     text,
  flags             text[] not null default '{}',
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_bom_rs485_components_sub_board on public.bom_rs485_components(sub_board);

create table if not exists public.bom_rs485_transactions (
  id              uuid primary key default gen_random_uuid(),
  component_id    uuid not null references public.bom_rs485_components(id) on delete cascade,
  type            text not null check (type in ('inward','outward','return')),
  qty             numeric,
  qty_needed      numeric,
  qty_sent        numeric,
  related_txn_id  uuid references public.bom_rs485_transactions(id),
  txn_date        date not null default current_date,
  reason          text,
  batch_id        uuid,               -- set only by a bulk outward; groups its rows
  created_at      timestamptz not null default now()
);
create index if not exists idx_bom_rs485_txn_component on public.bom_rs485_transactions(component_id);
create index if not exists bom_rs485_txn_batch_idx on public.bom_rs485_transactions(batch_id) where batch_id is not null;

drop trigger if exists trg_bom_rs485_components_touch on public.bom_rs485_components;
create trigger trg_bom_rs485_components_touch
  before update on public.bom_rs485_components
  for each row execute function public.bom_touch_updated_at();

create or replace view public.bom_rs485_component_stock
with (security_invoker = on) as
select
  c.id as component_id,
  c.opening_quantity
    + coalesce((select sum(t.qty)      from public.bom_rs485_transactions t
                 where t.component_id = c.id and t.type = 'inward'),  0)
    - coalesce((select sum(t.qty_sent) from public.bom_rs485_transactions t
                 where t.component_id = c.id and t.type = 'outward'), 0)
    + coalesce((select sum(t.qty)      from public.bom_rs485_transactions t
                 where t.component_id = c.id and t.type = 'return'),  0)
  as quantity_in_hand
from public.bom_rs485_components c;

-- ============================================================================
-- LORA
-- ============================================================================
create table if not exists public.bom_lora_components (
  id                uuid primary key default gen_random_uuid(),
  sub_board         text not null default 'Main Board',  -- 'Main Board' | 'Read Sensor'
  s_no              int,
  s_no_raw          text,
  component         text,
  value_raw         text,
  value             text,
  voltage           text,
  rating            text,
  material          text,
  tolerance         text,
  label             text,
  package           text,
  part_number       text,
  identification_number text,
  supply_form       text,
  opening_quantity  numeric not null default 0,
  quantity_note     text,
  flags             text[] not null default '{}',
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_bom_lora_components_sub_board on public.bom_lora_components(sub_board);

create table if not exists public.bom_lora_transactions (
  id              uuid primary key default gen_random_uuid(),
  component_id    uuid not null references public.bom_lora_components(id) on delete cascade,
  type            text not null check (type in ('inward','outward','return')),
  qty             numeric,
  qty_needed      numeric,
  qty_sent        numeric,
  related_txn_id  uuid references public.bom_lora_transactions(id),
  txn_date        date not null default current_date,
  reason          text,
  batch_id        uuid,               -- set only by a bulk outward; groups its rows
  created_at      timestamptz not null default now()
);
create index if not exists idx_bom_lora_txn_component on public.bom_lora_transactions(component_id);
create index if not exists bom_lora_txn_batch_idx on public.bom_lora_transactions(batch_id) where batch_id is not null;

drop trigger if exists trg_bom_lora_components_touch on public.bom_lora_components;
create trigger trg_bom_lora_components_touch
  before update on public.bom_lora_components
  for each row execute function public.bom_touch_updated_at();

create or replace view public.bom_lora_component_stock
with (security_invoker = on) as
select
  c.id as component_id,
  c.opening_quantity
    + coalesce((select sum(t.qty)      from public.bom_lora_transactions t
                 where t.component_id = c.id and t.type = 'inward'),  0)
    - coalesce((select sum(t.qty_sent) from public.bom_lora_transactions t
                 where t.component_id = c.id and t.type = 'outward'), 0)
    + coalesce((select sum(t.qty)      from public.bom_lora_transactions t
                 where t.component_id = c.id and t.type = 'return'),  0)
  as quantity_in_hand
from public.bom_lora_components c;

-- ============================================================================
-- Row Level Security — internal tool: allow full access with the anon key.
-- (Tighten later by requiring auth if you expose this beyond your team.)
-- ============================================================================
alter table public.bom_4g_components      enable row level security;
alter table public.bom_4g_transactions    enable row level security;
alter table public.bom_rs485_components    enable row level security;
alter table public.bom_rs485_transactions  enable row level security;
alter table public.bom_lora_components     enable row level security;
alter table public.bom_lora_transactions   enable row level security;

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
