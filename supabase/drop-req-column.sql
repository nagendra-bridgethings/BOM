-- ============================================================================
-- Drop the unused req_on_board column from every device's components table.
-- Run once in the Supabase SQL Editor. Safe: removes only that column; all
-- component rows and their stock/transaction data are kept intact.
-- ============================================================================
alter table public.bom_4g_components    drop column if exists req_on_board;
alter table public.bom_rs485_components  drop column if exists req_on_board;
alter table public.bom_lora_components   drop column if exists req_on_board;
