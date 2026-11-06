-- Solo lectura, después de 20261018180000. Los indicadores deben ser true.
with definicion as (
  select pg_get_functiondef(
    'public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean)'::regprocedure) as cuerpo,
    pg_get_functiondef('public.vincular_recibo_detalle_planes_v3(uuid,jsonb)'::regprocedure) as vincular,
    pg_get_functiondef('public.desvincular_detalle_recibo_plan(uuid)'::regprocedure) as desvincular
)
select
  cuerpo not like '%normalizar_concepto_plan_recibo%'
    and cuerpo not like '%v_detalle.concepto%'
    as sin_comparacion_de_texto,
  cuerpo like '%v_recibo.alumno_id is distinct from v_plan.alumno_id%'
    as valida_alumno,
  cuerpo like '%origen.nombre = destino.nombre%'
    as valida_periodo_nominal,
  cuerpo like '%p_importe + v_usado > v_detalle.subtotal%'
    and cuerpo like '%p_importe + v_plan_usado > v_plan_cantidad%'
    as limita_importes_y_abonos,
  cuerpo like '%planes_pago_vinculos_recibo%'
    and cuerpo like '%actor_uid%'
    as conserva_auditoria,
  cuerpo like '%monedero_modificado'', false%'
    and cuerpo like '%remanente_historico_sin_movimiento%'
    as no_duplica_monedero_historico,
  vincular like '%vincular_recibo_detalle_planes_v2%'
    and vincular like '%planes_pago_excedentes_monedero%'
    as audita_excedente_manual,
  desvincular like '%planes_pago_excedentes_monedero%'
    and desvincular like '%excedente.*(monedero|saldo a favor)%'
    as impide_reacreditar_sin_revision,
  not has_function_privilege('authenticated',
    'public.vincular_recibo_detalle_planes_v2(uuid,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated',
      'public.vincular_recibo_detalle_planes_v3(uuid,jsonb)', 'EXECUTE')
    as usa_vinculacion_protegida
from definicion;
