-- =====================================================================
-- Hardening — fixa search_path nas funções do baseline (advisor
-- function_search_path_mutable). Projeto: tfupwytzrkpzocfxheeq (HOMOLOGAÇÃO).
-- APLICADA via MCP apply_migration (2026-06-29).
--
-- Apenas adiciona `set search_path = public`. Lógica, assinatura, retorno e
-- grants inalterados; os triggers que referenciam estas funções continuam
-- válidos (mesmo nome/assinatura).
-- =====================================================================

create or replace function public.fn_set_updated_at()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.fn_approval_decision_code(p_id uuid)
  returns text
  language sql
  stable
  set search_path = public
as $$
  select code from public.ref_approval_decision where id = p_id;
$$;

create or replace function public.fn_validate_event_approval()
  returns trigger
  language plpgsql
  set search_path = public
as $$
declare
  v_decision_code text;
begin
  select code into v_decision_code from public.ref_approval_decision where id = new.id_decision;
  if v_decision_code in ('rejected', 'counter_proposed') and new.reason is null then
    raise exception 'reason é obrigatório quando a decisão é "%"', v_decision_code;
  end if;
  if v_decision_code = 'counter_proposed' and new.counter_date is null then
    raise exception 'counter_date é obrigatório quando a decisão é "counter_proposed"';
  end if;
  return new;
end;
$$;
