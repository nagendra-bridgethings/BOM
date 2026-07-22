-- ============================================================================
-- Put each board's rows in order so the same part sits together, then renumber.
--
-- The app groups a board's rows by component + value, so a 100nF entered at
-- three points in the BOM is shown as one run. Until the stored order matches,
-- the serials in that run read 4, 5, 9 and the list appears to skip numbers.
--
-- This sorts each board by group — a group taking the position of its earliest
-- member — and then assigns sort_order and s_no 1..n in that order. Afterwards
-- the numbering is continuous and the app's grouping is a no-op, so what is
-- stored and what is displayed agree.
--
-- NOTHING IS DELETED OR COMBINED. Every row keeps its own designators, part
-- number, stock and history; only its position and serial change.
--
-- Idempotent: run it twice and the second run finds everything already in place.
-- Run in Supabase: SQL Editor -> paste -> Run.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 4G
-- ---------------------------------------------------------------------------
with keyed as (
  select id, sub_board, sort_order,
         case
           when btrim(coalesce(component, '')) = ''
             or btrim(coalesce(nullif(btrim(value), ''), value_raw, '')) = ''
           -- nothing to match on, so it stands alone rather than pooling with
           -- every other row that also lacks a value
           then 'solo:' || id::text
           -- Same normalisation the app uses (src/lib/shared.js): the component
           -- keeps ordinary case/space folding, but the VALUE also loses the ohm
           -- symbol and the word, and micro is folded to 'u' — '10k', '10K' and
           -- '10kΩ' are one resistor. Only notation is stripped, never magnitude.
           else lower(btrim(regexp_replace(component, '\s+', ' ', 'g'))) || '|' ||
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        lower(btrim(coalesce(nullif(btrim(value), ''), value_raw))),
                      'ohms?y', '', 'g'),
                    '[Ωω]', '', 'g'),
                  '[µμ]', 'u', 'g'),
                '\s+', '', 'g')
         end as k
  from public.bom_4g_components
),
grouped as (
  select id, sub_board, sort_order, k,
         min(sort_order) over (partition by sub_board, k) as group_pos
  from keyed
),
ordered as (
  select id, row_number() over (partition by sub_board order by group_pos, sort_order, id) as n
  from grouped
)
update public.bom_4g_components c
   set sort_order = o.n, s_no = o.n, s_no_raw = o.n::text
  from ordered o
 where o.id = c.id
   and (c.sort_order is distinct from o.n or c.s_no is distinct from o.n);


-- ---------------------------------------------------------------------------
-- RS485
-- ---------------------------------------------------------------------------
with keyed as (
  select id, sub_board, sort_order,
         case
           when btrim(coalesce(component, '')) = ''
             or btrim(coalesce(nullif(btrim(value), ''), value_raw, '')) = ''
           then 'solo:' || id::text
           -- Same normalisation the app uses (src/lib/shared.js): the component
           -- keeps ordinary case/space folding, but the VALUE also loses the ohm
           -- symbol and the word, and micro is folded to 'u' — '10k', '10K' and
           -- '10kΩ' are one resistor. Only notation is stripped, never magnitude.
           else lower(btrim(regexp_replace(component, '\s+', ' ', 'g'))) || '|' ||
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        lower(btrim(coalesce(nullif(btrim(value), ''), value_raw))),
                      'ohms?y', '', 'g'),
                    '[Ωω]', '', 'g'),
                  '[µμ]', 'u', 'g'),
                '\s+', '', 'g')
         end as k
  from public.bom_rs485_components
),
grouped as (
  select id, sub_board, sort_order, k,
         min(sort_order) over (partition by sub_board, k) as group_pos
  from keyed
),
ordered as (
  select id, row_number() over (partition by sub_board order by group_pos, sort_order, id) as n
  from grouped
)
update public.bom_rs485_components c
   set sort_order = o.n, s_no = o.n, s_no_raw = o.n::text
  from ordered o
 where o.id = c.id
   and (c.sort_order is distinct from o.n or c.s_no is distinct from o.n);


-- ---------------------------------------------------------------------------
-- LORA
-- ---------------------------------------------------------------------------
with keyed as (
  select id, sub_board, sort_order,
         case
           when btrim(coalesce(component, '')) = ''
             or btrim(coalesce(nullif(btrim(value), ''), value_raw, '')) = ''
           then 'solo:' || id::text
           -- Same normalisation the app uses (src/lib/shared.js): the component
           -- keeps ordinary case/space folding, but the VALUE also loses the ohm
           -- symbol and the word, and micro is folded to 'u' — '10k', '10K' and
           -- '10kΩ' are one resistor. Only notation is stripped, never magnitude.
           else lower(btrim(regexp_replace(component, '\s+', ' ', 'g'))) || '|' ||
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        lower(btrim(coalesce(nullif(btrim(value), ''), value_raw))),
                      'ohms?y', '', 'g'),
                    '[Ωω]', '', 'g'),
                  '[µμ]', 'u', 'g'),
                '\s+', '', 'g')
         end as k
  from public.bom_lora_components
),
grouped as (
  select id, sub_board, sort_order, k,
         min(sort_order) over (partition by sub_board, k) as group_pos
  from keyed
),
ordered as (
  select id, row_number() over (partition by sub_board order by group_pos, sort_order, id) as n
  from grouped
)
update public.bom_lora_components c
   set sort_order = o.n, s_no = o.n, s_no_raw = o.n::text
  from ordered o
 where o.id = c.id
   and (c.sort_order is distinct from o.n or c.s_no is distinct from o.n);


-- ---------------------------------------------------------------------------
-- VERIFY — every board should read numbered = rows and gap_or_dupe = 0.
-- ---------------------------------------------------------------------------
select '4G' as device, sub_board, count(*) as rows, count(s_no) as numbered,
       max(s_no) - count(s_no) as gap_or_dupe
from public.bom_4g_components group by sub_board
union all
select 'RS485', sub_board, count(*), count(s_no), max(s_no) - count(s_no)
from public.bom_rs485_components group by sub_board
union all
select 'LORA', sub_board, count(*), count(s_no), max(s_no) - count(s_no)
from public.bom_lora_components group by sub_board
order by device, sub_board;
