-- ============================================================================
-- Give every component a serial number, so the # column matches the header count.
--
-- Symptom this fixes: "61 components" but the # column stops at 60 (4G), and
-- "52 components" but it stops at 51 (LORA), so a row looks missing. Nothing was
-- missing — two rows came in from the spreadsheet with no usable S.No and were
-- rendering their raw text instead of a number:
--
--   4G   Main Board, position 33 — MOSFET-PCHANNEL (alt part), DMP2035U, Q1/Q3/Q5
--        showed "32b" (an alternate for #32: same designators, different part).
--        Takes 33; rows 33..60 shift to 34..61.
--
--   LORA Main Board, position 36 — FRAM MB85C04V, U9
--        showed "(no S.No)" (the cell was simply blank).
--        Takes 36; rows 36..51 shift to 37..52.
--
-- The "alternate part" meaning survives: it is stated in the component name and
-- the row still sits directly beneath the part it substitutes for.
--
-- Row order on screen does NOT change — sort_order is untouched, only the numbers.
-- RS485 needs nothing; both its boards already number cleanly.
--
-- Idempotent: each guard means a second run does nothing.
-- Run in Supabase: SQL Editor -> paste -> Run.
-- ============================================================================

-- ---- 4G Main Board ---------------------------------------------------------
do $$
begin
  -- only act while an unnumbered row still exists, so re-running can't shift twice
  if exists (
    select 1 from public.bom_4g_components
    where sub_board = 'Main Board' and s_no is null
  ) then

    -- make room. s_no on the right is the pre-update value, so both columns
    -- take the same new number in one pass.
    update public.bom_4g_components
    set s_no     = s_no + 1,
        s_no_raw = (s_no + 1)::text
    where sub_board = 'Main Board'
      and s_no >= 33;

    update public.bom_4g_components
    set s_no     = 33,
        s_no_raw = '33'
    where sub_board = 'Main Board'
      and s_no is null;

  end if;
end $$;

-- ---- LORA Main Board -------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.bom_lora_components
    where sub_board = 'Main Board' and s_no is null
  ) then

    update public.bom_lora_components
    set s_no     = s_no + 1,
        s_no_raw = (s_no + 1)::text
    where sub_board = 'Main Board'
      and s_no >= 36;

    update public.bom_lora_components
    set s_no     = 36,
        s_no_raw = '36'
    where sub_board = 'Main Board'
      and s_no is null;

  end if;
end $$;

-- Verify: every board should show numbered = rows, gap_or_dupe = 0.
select '4G'    as device, sub_board, count(*) as rows, count(s_no) as numbered,
       max(s_no) - count(s_no) as gap_or_dupe
from public.bom_4g_components    group by sub_board
union all
select 'RS485', sub_board, count(*), count(s_no), max(s_no) - count(s_no)
from public.bom_rs485_components group by sub_board
union all
select 'LORA',  sub_board, count(*), count(s_no), max(s_no) - count(s_no)
from public.bom_lora_components  group by sub_board
order by device, sub_board;
