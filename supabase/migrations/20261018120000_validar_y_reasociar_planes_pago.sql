-- Preparada, no aplicada. Impide nuevas asociaciones ordinarias incompatibles
-- y habilita una revisión transaccional de planes existentes de ciclo homónimo.
-- Ejecutar el preflight antes de instalarla. No modifica planes históricos.

create table if not exists public.planes_pago_reasociaciones (
  id uuid primary key default gen_random_uuid(),
  plan_pago_id uuid not null,
  alumno_id uuid not null,
  ciclo_origen_id uuid not null,
  ciclo_destino_id uuid not null,
  tipo_plan_anterior text,
  tipo_plan_nuevo text not null,
  recibos_ids uuid[] not null default '{}',
  actor_uid uuid not null,
  creado_en timestamptz not null default now()
);

alter table public.planes_pago_reasociaciones enable row level security;
revoke all on public.planes_pago_reasociaciones from anon, authenticated;
grant select on public.planes_pago_reasociaciones to authenticated;
drop policy if exists "finanzas: leer reasociaciones de planes" on public.planes_pago_reasociaciones;
create policy "finanzas: leer reasociaciones de planes"
  on public.planes_pago_reasociaciones for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    and exists (select 1 from public.usuarios u
      where u.auth_id = auth.uid() and u.activo is true));

create or replace function public.validar_periodicidad_plan_pago()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := case
    when lower(btrim(coalesce(new.tipo_plan, ''))) like '%cuatrimestral%' then 'cuatrimestral'
    when lower(btrim(coalesce(new.tipo_plan, ''))) like '%semestral%' then 'semestral'
    else null end;
  v_ciclo_tipo text;
  v_programas integer;
  v_plan_tipo text;
begin
  if tg_op = 'UPDATE' then
    if new.ciclo_id is not distinct from old.ciclo_id
      and new.tipo_plan is not distinct from old.tipo_plan then return new; end if;
  end if;
  if v_tipo is null then return new; end if;
  select lower(btrim(c.tipo_periodo)) into v_ciclo_tipo
    from public.ciclos_escolares c where c.id = new.ciclo_id;
  if v_ciclo_tipo is distinct from v_tipo then
    raise exception 'El tipo del plan de pagos no corresponde al ciclo escolar elegido';
  end if;
  select count(distinct ap.plan_id), min(lower(btrim(pe.tipo_periodo)))
    into v_programas, v_plan_tipo
    from public.alumno_programas ap
    join public.planes_estudio pe on pe.id = ap.plan_id
    where ap.alumno_id = new.alumno_id and ap.es_vigente = true;
  if v_programas <> 1 or v_plan_tipo is distinct from v_tipo then
    raise exception 'El plan de pagos no coincide con el plan de estudios vigente del alumno';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_periodicidad_plan_pago on public.planes_pago;
create trigger validar_periodicidad_plan_pago
  before insert or update of ciclo_id, tipo_plan on public.planes_pago
  for each row execute function public.validar_periodicidad_plan_pago();
revoke all on function public.validar_periodicidad_plan_pago() from public, anon, authenticated;

create or replace function public.revisar_reasociacion_plan_pago(
  p_plan_id uuid, p_ciclo_destino_id uuid, p_aplicar boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.planes_pago%rowtype;
  v_origen public.ciclos_escolares%rowtype;
  v_destino public.ciclos_escolares%rowtype;
  v_plan_academico_id uuid;
  v_programas integer;
  v_grupos integer;
  v_recibos uuid[] := '{}';
  v_folios integer[] := '{}';
  v_inseguros integer := 0;
  v_motivo text;
  v_tipo text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u
      where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para revisar asociaciones de planes de pago';
  end if;
  if p_plan_id is null or p_ciclo_destino_id is null then
    raise exception 'Se requiere plan y ciclo de destino';
  end if;
  if p_aplicar then
    perform pg_advisory_xact_lock(hashtext('reasociar_plan_pago:' || p_plan_id::text));
  end if;
  if p_aplicar then
    select * into v_plan from public.planes_pago where id = p_plan_id for update;
  else
    select * into v_plan from public.planes_pago where id = p_plan_id;
  end if;
  if not found then raise exception 'El plan de pagos ya no existe'; end if;
  if p_aplicar then
    perform 1 from public.recibos where alumno_id = v_plan.alumno_id
      and ciclo_id in (v_plan.ciclo_id, p_ciclo_destino_id) for update;
  end if;
  select * into v_origen from public.ciclos_escolares where id = v_plan.ciclo_id;
  select * into v_destino from public.ciclos_escolares where id = p_ciclo_destino_id;
  v_tipo := lower(btrim(coalesce(v_destino.tipo_periodo, '')));
  if v_origen.id is null or v_destino.id is null or v_origen.id = v_destino.id
    or v_origen.nombre <> v_destino.nombre
    or v_tipo not in ('cuatrimestral', 'semestral') then
    v_motivo := 'El destino debe ser otro ciclo del mismo nombre y periodicidad ordinaria conocida.';
  elsif lower(btrim(coalesce(v_plan.tipo_plan, ''))) not in ('cuatrimestral', 'semestral') then
    v_motivo := 'Los planes de titulación y especialidad se revisan por separado.';
  end if;
  if v_motivo is null then
    select count(distinct g.plan_id) into v_grupos
      from public.alumnos_grupos ag join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_destino.id;
    select g.plan_id into v_plan_academico_id
      from public.alumnos_grupos ag join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_destino.id limit 1;
    select count(*) into v_programas
      from public.alumno_programas ap join public.planes_estudio pe on pe.id = ap.plan_id
      where ap.alumno_id = v_plan.alumno_id and ap.es_vigente = true
        and ap.plan_id = v_plan_academico_id
        and lower(btrim(pe.tipo_periodo)) = v_tipo;
    if v_grupos <> 1 or v_programas <> 1
      or (select count(*) from public.alumno_programas ap
          where ap.alumno_id = v_plan.alumno_id and ap.es_vigente = true) <> 1 then
      v_motivo := 'El grupo y el plan de estudios vigente no prueban una asociación única con el destino.';
    elsif exists (
      select 1 from public.alumnos_grupos ag join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_origen.id
    ) or exists (
      select 1 from public.planes_pago pp where pp.alumno_id = v_plan.alumno_id
        and pp.id <> v_plan.id and pp.ciclo_id in (v_origen.id, v_destino.id)
    ) then
      v_motivo := 'El alumno tiene un grupo o un segundo plan en los ciclos involucrados.';
    end if;
  end if;
  if v_motivo is null then
    if exists (select 1 from public.recibos r where r.alumno_id = v_plan.alumno_id
      and r.ciclo_id = v_destino.id) then
      v_motivo := 'Ya existen recibos en el ciclo de destino; requiere conciliación financiera.';
    end if;
    select coalesce(array_agg(r.id order by r.folio), '{}'),
      coalesce(array_agg(r.folio order by r.folio), '{}')
      into v_recibos, v_folios
      from public.recibos r where r.alumno_id = v_plan.alumno_id and r.ciclo_id = v_origen.id;
  end if;
  if v_motivo is null and cardinality(v_recibos) > 0 then
    select count(*) into v_inseguros from public.recibos r
      where r.id = any(v_recibos) and (
        r.estatus <> 'ACTIVO' or r.requiere_factura is distinct from false
        or upper(btrim(coalesce(r.estatus_factura, 'NO APLICA'))) <> 'NO APLICA'
        or nullif(btrim(coalesce(r.folio_fiscal, '')), '') is not null
        or not exists (select 1 from public.recibos_detalles d where d.recibo_id = r.id)
        or exists (
          select 1 from public.recibos_detalles d
          left join lateral (
            select pd.concepto from public.planes_pago_detalles pd
            where pd.plan_id = v_plan.id and pd.indice_concepto = d.indice_concepto_plan
            order by pd.created_at desc, pd.id desc limit 1
          ) pd on true
          where d.recibo_id = r.id and (
            d.indice_concepto_plan not between 1 and 18 or d.indice_concepto_plan is null
            or nullif(btrim(coalesce(pd.concepto,
              to_jsonb(v_plan) ->> ('concepto_' || d.indice_concepto_plan::text), '')), '') is null
            or lower(btrim(d.concepto)) not in (
              lower(btrim(coalesce(pd.concepto,
                to_jsonb(v_plan) ->> ('concepto_' || d.indice_concepto_plan::text)))),
              lower(btrim(coalesce(pd.concepto,
                to_jsonb(v_plan) ->> ('concepto_' || d.indice_concepto_plan::text))))
                || ' (plan ' || lower(btrim(v_plan.tipo_plan)) || ' - ' || lower(btrim(v_origen.nombre)) || ')'
            )
          )
        )
      );
    if v_inseguros > 0 then
      v_motivo := 'Hay recibos cancelados, fiscales, independientes o con vínculo no comprobado; requieren revisión financiera individual.';
    end if;
  end if;
  if v_motivo is not null then
    if p_aplicar then raise exception '%', v_motivo; end if;
    return jsonb_build_object('aplicable', false, 'motivo', v_motivo,
      'plan_id', v_plan.id, 'recibos_en_origen', cardinality(v_recibos),
      'folios', to_jsonb(v_folios));
  end if;
  if p_aplicar then
    update public.planes_pago set ciclo_id = v_destino.id,
      tipo_plan = initcap(v_tipo) where id = v_plan.id and ciclo_id = v_origen.id;
    if not found then raise exception 'El plan cambió durante la revisión'; end if;
    update public.recibos set ciclo_id = v_destino.id where id = any(v_recibos)
      and alumno_id = v_plan.alumno_id and ciclo_id = v_origen.id;
    if (select count(*) from public.recibos where id = any(v_recibos) and ciclo_id = v_destino.id)
      <> cardinality(v_recibos) then raise exception 'No se pudieron trasladar todos los recibos'; end if;
    insert into public.planes_pago_reasociaciones
      (plan_pago_id, alumno_id, ciclo_origen_id, ciclo_destino_id,
       tipo_plan_anterior, tipo_plan_nuevo, recibos_ids, actor_uid)
    values (v_plan.id, v_plan.alumno_id, v_origen.id, v_destino.id,
      v_plan.tipo_plan, initcap(v_tipo), v_recibos, auth.uid());
  end if;
  return jsonb_build_object('aplicable', true, 'aplicado', p_aplicar,
    'plan_id', v_plan.id, 'ciclo_origen_id', v_origen.id,
    'ciclo_destino_id', v_destino.id, 'tipo_plan_nuevo', initcap(v_tipo),
    'recibos_en_origen', cardinality(v_recibos), 'folios', to_jsonb(v_folios));
end;
$$;
revoke all on function public.revisar_reasociacion_plan_pago(uuid, uuid, boolean) from public, anon;
grant execute on function public.revisar_reasociacion_plan_pago(uuid, uuid, boolean) to authenticated;
