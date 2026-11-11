-- PREPARADA, NO EJECUTADA. Ejecutar antes del cliente que usa borrar_recibo_prueba_v2.
-- No borra recibos al instalarse, no invoca secuencias y no cambia restricciones.
begin;

-- No sustituir silenciosamente una variante instalada con reglas adicionales.
do $revision$
declare
  actual text;
  original text := $legado$
DECLARE
  v_uso_saldo numeric;
  v_alumno_id uuid;
  v_recibo record;
BEGIN
  SELECT * INTO v_recibo FROM public.recibos WHERE id = p_recibo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;
  v_uso_saldo := v_recibo.uso_saldo_a_favor;
  v_alumno_id := v_recibo.alumno_id;
  -- Devolver saldo a favor si se usó
  IF v_uso_saldo > 0 AND v_alumno_id IS NOT NULL THEN
    UPDATE public.alumnos
    SET saldo_a_favor = COALESCE(saldo_a_favor, 0) + v_uso_saldo
    WHERE id = v_alumno_id;
  END IF;
  -- Borrar recibo (en cascada sus detalles)
  DELETE FROM public.recibos WHERE id = p_recibo_id;
  -- Reajustar secuencia de folios
  PERFORM setval(
    'public.recibos_folio_seq',
    COALESCE((SELECT MAX(folio) FROM public.recibos), 1000),
    (SELECT MAX(folio) IS NOT NULL FROM public.recibos)
  );
END;
$legado$;
  -- Variante instalada comunicada en el preflight del 09/11/2026 y revisada.
  -- Solo se reconoce este cuerpo: no se relaja la comparación de versiones desconocidas.
  instalada_revisada text := $instalada$
DECLARE
  v_uso_saldo numeric;
  v_alumno_id uuid;
  v_recibo record;
BEGIN
  -- 1. Obtener info del recibo
  SELECT * INTO v_recibo FROM recibos WHERE id = p_recibo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;

  v_uso_saldo := v_recibo.uso_saldo_a_favor;
  v_alumno_id := v_recibo.alumno_id;

  -- 2. Devolver saldo a favor si se usó
  IF v_uso_saldo > 0 THEN
    UPDATE alumnos
    SET saldo_a_favor = saldo_a_favor + v_uso_saldo
    WHERE id = v_alumno_id;
  END IF;

  -- Nota: El estatus del Plan de Pagos (planes_pago) se debe revertir manualmente
  -- en la interfaz, igual que sucede cuando se cancela un recibo.

  -- 3. Borrar el recibo (y en cascada sus detalles)
  DELETE FROM recibos WHERE id = p_recibo_id;

  -- 4. Reajustar el folio al MAX(folio) actual para no dejar huecos
  PERFORM setval(
    pg_get_serial_sequence('recibos', 'folio'),
    COALESCE((SELECT MAX(folio) FROM recibos), 1),
    (SELECT MAX(folio) IS NOT NULL FROM recibos)
  );

END;
$instalada$;
  compatible text := $compatible$
begin
  perform public.borrar_recibo_prueba_v2(p_recibo_id);
end;
$compatible$;
begin
  select prosrc into actual from pg_proc where oid=to_regprocedure('public.borrar_recibo_admin(uuid)');
  if actual is null or regexp_replace(actual,'\s+','','g') not in
    (regexp_replace(original,'\s+','','g'),regexp_replace(instalada_revisada,'\s+','','g'),regexp_replace(compatible,'\s+','','g')) then
    raise exception 'La función de borrado instalada difiere de la versión revisada. Ejecuta preflight_borrado_recibos_secuencia.sql y revisa sus reglas antes de sustituirla.';
  end if;
  -- Un disparador de DELETE desconocido podría modificar folios por una vía indirecta.
  if exists(select 1 from pg_trigger where not tgisinternal and (tgtype & 8)=8
    and tgrelid in (to_regclass('public.recibos'),to_regclass('public.recibos_detalles'))) then
    raise exception 'Existen disparadores de borrado que requieren revisión previa. No se instaló la corrección.';
  end if;
end;
$revision$;

create or replace function public.borrar_recibo_prueba_v2(p_recibo_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $borrado$
declare
  v_recibo public.recibos%rowtype;
begin
  if auth.uid() is null or not (
    select count(*)=1 and coalesce(bool_and(rol='ADMINISTRADOR' and activo is true),false)
    from public.usuarios where auth_id=auth.uid()
  ) then
    raise exception 'Solo Administración con cuenta activa puede eliminar recibos de prueba' using errcode='42501';
  end if;
  if p_recibo_id is null then raise exception 'Selecciona el recibo de prueba'; end if;

  -- Evita que dos solicitudes devuelvan dos veces el monedero del mismo recibo.
  select * into v_recibo from public.recibos where id=p_recibo_id for update;
  if not found then raise exception 'El recibo ya no existe; actualiza la consulta'; end if;

  -- Conserva la regla anterior: restituir solamente el saldo a favor utilizado.
  if v_recibo.uso_saldo_a_favor>0 and v_recibo.alumno_id is not null then
    update public.alumnos
    set saldo_a_favor=coalesce(saldo_a_favor,0)+v_recibo.uso_saldo_a_favor
    where id=v_recibo.alumno_id;
  end if;
  -- Las FK vigentes deciden si el recibo y sus detalles pueden eliminarse.
  -- Cualquier rechazo revierte también la restitución del monedero.
  -- Conserva el tratamiento manual del estatus del plan; no reescribe sus conceptos.
  delete from public.recibos where id=p_recibo_id;
  -- El hueco se conserva. No consultar ni modificar el contador de folios aquí.
end;
$borrado$;

-- Compatibilidad: los clientes anteriores tampoco deben retroceder la secuencia.
create or replace function public.borrar_recibo_admin(p_recibo_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $compatible$
begin
  perform public.borrar_recibo_prueba_v2(p_recibo_id);
end;
$compatible$;

revoke all on function public.borrar_recibo_prueba_v2(uuid) from public,anon;
revoke all on function public.borrar_recibo_admin(uuid) from public,anon;
grant execute on function public.borrar_recibo_prueba_v2(uuid) to authenticated;
grant execute on function public.borrar_recibo_admin(uuid) to authenticated;
comment on function public.borrar_recibo_prueba_v2(uuid) is 'Borrado administrativo de pruebas; conserva la secuencia de folios y restituye solo el monedero utilizado.';
commit;
