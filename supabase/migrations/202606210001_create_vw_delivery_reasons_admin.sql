-- View achatada para listagem de motivos de recusa no admin
-- Resolve joins de tipo e categoria em colunas diretas,
-- permitindo ORDER BY server-side sem depender de foreignTable do PostgREST.
CREATE OR REPLACE VIEW public.vw_delivery_reasons_admin AS
SELECT
  r.id,
  r.name,
  r.id_reason_type,
  rt.name          AS reason_type_name,
  rt.code          AS reason_type_code,
  r.id_reason_category,
  rc.name          AS reason_category_name,
  r.sort_order,
  r.is_active,
  r.is_test,
  r.created_at,
  r.updated_at
FROM  public.ref_delivery_reason r
LEFT JOIN public.ref_delivery_reason_type     rt ON rt.id = r.id_reason_type
LEFT JOIN public.ref_delivery_reason_category rc ON rc.id = r.id_reason_category;

-- Garantir acesso pelas roles do frontend
GRANT SELECT ON public.vw_delivery_reasons_admin TO anon;
GRANT SELECT ON public.vw_delivery_reasons_admin TO authenticated;
