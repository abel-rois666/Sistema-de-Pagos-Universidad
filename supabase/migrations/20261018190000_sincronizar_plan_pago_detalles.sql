-- Mantiene la estructura normalizada al editar las columnas legadas del plan.
-- Solo actúa sobre cambios posteriores a la instalación; no rellena ni borra
-- información histórica al instalarse.
begin;

do $preflight$
begin
  if to_regclass('public.planes_pago') is null
    or to_regclass('public.planes_pago_detalles') is null
    or to_regclass('public.planes_pago_vinculos_recibo') is null then
    raise exception 'Instala primero la migración de conciliación de planes y recibos';
  end if;
end;
$preflight$;

create or replace function public.sincronizar_detalles_plan_pago_editado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_anterior jsonb := to_jsonb(old);
  v_actual jsonb := to_jsonb(new);
  v_indice integer;
  v_cambio_concepto boolean;
  v_cambio_fecha boolean;
  v_cambio_cantidad boolean;
  v_cambio_estatus boolean;
  v_concepto text;
  v_fecha_texto text;
  v_fecha date;
  v_cantidad numeric;
  v_estatus text;
  v_detalle public.planes_pago_detalles%rowtype;
  v_total integer;
  v_aplicado numeric;
begin
  -- Un plan que aún vive solo en columnas legadas sigue siendo legado.
  if not exists (select 1 from public.planes_pago_detalles d where d.plan_id = new.id) then
    return new;
  end if;

  for v_indice in 1..18 loop
    v_cambio_concepto := v_anterior ->> ('concepto_' || v_indice)
      is distinct from v_actual ->> ('concepto_' || v_indice);
    v_cambio_fecha := v_anterior ->> ('fecha_' || v_indice)
      is distinct from v_actual ->> ('fecha_' || v_indice);
    v_cambio_cantidad := v_anterior ->> ('cantidad_' || v_indice)
      is distinct from v_actual ->> ('cantidad_' || v_indice);
    v_cambio_estatus := v_anterior ->> ('estatus_' || v_indice)
      is distinct from v_actual ->> ('estatus_' || v_indice);
    if not (v_cambio_concepto or v_cambio_fecha or v_cambio_cantidad or v_cambio_estatus) then
      continue;
    end if;

    select count(*) into v_total from public.planes_pago_detalles d
      where d.plan_id = new.id and d.indice_concepto = v_indice;
    if v_total > 1 then
      raise exception 'El concepto % tiene detalles duplicados; revisa el plan antes de editarlo', v_indice;
    end if;
    select * into v_detalle from public.planes_pago_detalles d
      where d.plan_id = new.id and d.indice_concepto = v_indice for update;
    v_concepto := nullif(btrim(v_actual ->> ('concepto_' || v_indice)), '');

    if v_concepto is null then
      if v_detalle.id is not null then
        if coalesce(v_detalle.estatus, 'PENDIENTE') <> 'PENDIENTE'
          or exists (select 1 from public.planes_pago_vinculos_recibo v
            where v.plan_id = new.id and v.indice_concepto = v_indice and v.anulado_en is null) then
          raise exception 'El concepto % tiene pagos o vínculos; no puede eliminarse', v_indice;
        end if;
        delete from public.planes_pago_detalles where id = v_detalle.id;
      end if;
      continue;
    end if;

    v_cantidad := case when v_cambio_cantidad or v_detalle.id is null
      then coalesce((v_actual ->> ('cantidad_' || v_indice))::numeric, 0)
      else v_detalle.cantidad end;
    if v_cantidad < 0 then
      raise exception 'El concepto % no admite importe negativo', v_indice;
    end if;
    select coalesce(sum(v.importe), 0) into v_aplicado
      from public.planes_pago_vinculos_recibo v
      where v.plan_id = new.id and v.indice_concepto = v_indice and v.anulado_en is null;
    if v_cantidad + 0.005 < v_aplicado then
      raise exception 'El importe del concepto % es menor que sus vínculos confirmados', v_indice;
    end if;

    if not v_cambio_fecha and v_detalle.id is not null then
      v_fecha := v_detalle.fecha_vencimiento;
    else
      v_fecha_texto := nullif(btrim(v_actual ->> ('fecha_' || v_indice)), '');
      if v_fecha_texto is null then
        v_fecha := null;
      elsif v_fecha_texto ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        v_fecha := v_fecha_texto::date;
      elsif v_fecha_texto ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then
        v_fecha := to_date(v_fecha_texto, 'DD/MM/YYYY');
        if to_char(v_fecha, 'DD/MM/YYYY')
          <> lpad(split_part(v_fecha_texto, '/', 1), 2, '0') || '/'
            || lpad(split_part(v_fecha_texto, '/', 2), 2, '0') || '/'
            || split_part(v_fecha_texto, '/', 3) then
          raise exception 'Fecha inválida en el concepto %', v_indice;
        end if;
      else
        raise exception 'Fecha inválida en el concepto %', v_indice;
      end if;
    end if;
    v_estatus := coalesce(nullif(btrim(v_actual ->> ('estatus_' || v_indice)), ''), 'PENDIENTE');

    if v_detalle.id is null then
      -- Solo se incorpora la fila que el usuario acaba de modificar; no se
      -- reconstruyen masivamente columnas legadas que podrían ser residuales.
      insert into public.planes_pago_detalles
        (plan_id, indice_concepto, concepto, fecha_vencimiento, cantidad, estatus)
      values (new.id, v_indice, v_concepto, v_fecha, v_cantidad, v_estatus);
    else
      update public.planes_pago_detalles set
        concepto = case when v_cambio_concepto then v_concepto else v_detalle.concepto end,
        fecha_vencimiento = case when v_cambio_fecha then v_fecha else v_detalle.fecha_vencimiento end,
        cantidad = v_cantidad,
        estatus = case when v_cambio_estatus then v_estatus else v_detalle.estatus end
      where id = v_detalle.id;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.sincronizar_detalles_plan_pago_editado() from public, anon;
drop trigger if exists sincronizar_detalles_plan_pago_editado on public.planes_pago;
create trigger sincronizar_detalles_plan_pago_editado
after update on public.planes_pago
for each row execute function public.sincronizar_detalles_plan_pago_editado();

commit;
