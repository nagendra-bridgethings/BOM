-- ============================================================================
-- Harden the return -> outward link: deleting an outward that still has
-- returns pointing at it must FAIL at the database (previously the link was
-- ON DELETE SET NULL, which silently orphaned the returns and overstated
-- stock if the app-level guard was raced or bypassed).
-- NO ACTION (the default) still allows a component delete to cascade away an
-- outward together with its returns in the same statement.
-- Run once in the Supabase SQL Editor. Safe: changes only the FK behaviour.
-- ============================================================================
alter table public.bom_4g_transactions
  drop constraint if exists bom_4g_transactions_related_txn_id_fkey,
  add constraint bom_4g_transactions_related_txn_id_fkey
    foreign key (related_txn_id) references public.bom_4g_transactions(id);

alter table public.bom_rs485_transactions
  drop constraint if exists bom_rs485_transactions_related_txn_id_fkey,
  add constraint bom_rs485_transactions_related_txn_id_fkey
    foreign key (related_txn_id) references public.bom_rs485_transactions(id);

alter table public.bom_lora_transactions
  drop constraint if exists bom_lora_transactions_related_txn_id_fkey,
  add constraint bom_lora_transactions_related_txn_id_fkey
    foreign key (related_txn_id) references public.bom_lora_transactions(id);
