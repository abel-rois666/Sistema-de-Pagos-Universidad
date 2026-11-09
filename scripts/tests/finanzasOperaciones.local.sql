-- SOLO PostgreSQL local desechable. El runner crea una base vacía y no usa .env.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'ensayo_finanzas' OR to_regclass('public.alumnos') is not null THEN RAISE EXCEPTION 'Requiere ensayo_finanzas vacía'; END IF; END $$;
create role authenticated; create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.get_my_rol() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.rol',true),'')$$;
create table public.usuarios(id uuid primary key default gen_random_uuid(),auth_id uuid,activo boolean);
create table public.alumnos(id uuid primary key,saldo_a_favor numeric default 0);
create table public.ciclos_escolares(id uuid primary key,nombre text,tipo_periodo text);
create table public.planes_estudio(id uuid primary key,tipo_periodo text);
create table public.alumno_programas(id uuid primary key default gen_random_uuid(),alumno_id uuid,plan_id uuid,es_vigente boolean);
CREATE TABLE IF NOT EXISTS public.planes_pago (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL,
  ciclo_id uuid NOT NULL,
  no_plan_pagos text,
  fecha_plan text,
  beca_porcentaje text,
  beca_tipo text,
  grado_turno_inscrito text,
  licenciatura text, -- Snapshot histórico del nombre de carrera
  tipo_plan text DEFAULT 'Cuatrimestral'::text,
  grado text,
  turno text,
  concepto_1 text, fecha_1 text, cantidad_1 numeric, estatus_1 text,
  concepto_2 text, fecha_2 text, cantidad_2 numeric, estatus_2 text,
  concepto_3 text, fecha_3 text, cantidad_3 numeric, estatus_3 text,
  concepto_4 text, fecha_4 text, cantidad_4 numeric, estatus_4 text,
  concepto_5 text, fecha_5 text, cantidad_5 numeric, estatus_5 text,
  concepto_6 text, fecha_6 text, cantidad_6 numeric, estatus_6 text,
  concepto_7 text, fecha_7 text, cantidad_7 numeric, estatus_7 text,
  concepto_8 text, fecha_8 text, cantidad_8 numeric, estatus_8 text,
  concepto_9 text, fecha_9 text, cantidad_9 numeric, estatus_9 text,
  concepto_10 text, fecha_10 date, cantidad_10 numeric, estatus_10 text DEFAULT 'PENDIENTE'::text,
  concepto_11 text, fecha_11 date, cantidad_11 numeric, estatus_11 text DEFAULT 'PENDIENTE'::text,
  concepto_12 text, fecha_12 date, cantidad_12 numeric, estatus_12 text DEFAULT 'PENDIENTE'::text,
  concepto_13 text, fecha_13 date, cantidad_13 numeric, estatus_13 text DEFAULT 'PENDIENTE'::text,
  concepto_14 text, fecha_14 date, cantidad_14 numeric, estatus_14 text DEFAULT 'PENDIENTE'::text,
  concepto_15 text, fecha_15 date, cantidad_15 numeric, estatus_15 text DEFAULT 'PENDIENTE'::text,
  concepto_16 text, fecha_16 date, cantidad_16 numeric, estatus_16 text DEFAULT 'PENDIENTE'::text,
  concepto_17 text, fecha_17 date, cantidad_17 numeric, estatus_17 text DEFAULT 'PENDIENTE'::text,
  concepto_18 text, fecha_18 date, cantidad_18 numeric, estatus_18 text DEFAULT 'PENDIENTE'::text,
  desglose_conceptos jsonb DEFAULT '[]'::jsonb,
  desglose_total_bruto numeric DEFAULT 0,
  desglose_descuento_porcentaje numeric DEFAULT 0,
  desglose_descuento_monto numeric DEFAULT 0,
  desglose_total_neto numeric DEFAULT 0,
  observaciones jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT planes_pago_pkey PRIMARY KEY (id),
  CONSTRAINT planes_pago_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE,
  CONSTRAINT planes_pago_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_planes_pago_alumno_ciclo ON public.planes_pago(alumno_id, ciclo_id);

-- Desglose normalizado de conceptos de pago
CREATE TABLE IF NOT EXISTS public.planes_pago_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  indice_concepto integer NOT NULL CHECK (indice_concepto >= 1 AND indice_concepto <= 18),
  concepto text NOT NULL,
  fecha_vencimiento date,
  cantidad numeric NOT NULL DEFAULT 0.00,
  estatus text DEFAULT 'PENDIENTE'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT planes_pago_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT planes_pago_detalles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_pago(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planes_pago_detalles_plan ON public.planes_pago_detalles(plan_id);

-- Secuencia para folios únicos de recibo (OBLIGATORIA antes de recibos)
CREATE SEQUENCE IF NOT EXISTS public.recibos_folio_seq START WITH 1000 INCREMENT BY 1;

-- Recibos oficiales de cobro
CREATE TABLE IF NOT EXISTS public.recibos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folio integer NOT NULL DEFAULT nextval('public.recibos_folio_seq'::regclass) UNIQUE,
  fecha_recibo date NOT NULL,
  fecha_pago date NOT NULL,
  alumno_id uuid,
  ciclo_id uuid,
  total numeric NOT NULL,
  forma_pago text NOT NULL,
  banco text NOT NULL,
  estatus text DEFAULT 'ACTIVO'::text CHECK (estatus = ANY (ARRAY['ACTIVO'::text, 'CANCELADO'::text])),
  uso_saldo_a_favor numeric DEFAULT 0.00,
  requiere_factura boolean DEFAULT false,
  estatus_factura character varying DEFAULT 'NO APLICA'::character varying,
  folio_fiscal character varying,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT recibos_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE SET NULL,
  CONSTRAINT recibos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recibos_alumno ON public.recibos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_recibos_folio ON public.recibos(folio);

-- Detalles de conceptos facturados en cada recibo
CREATE TABLE IF NOT EXISTS public.recibos_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recibo_id uuid NOT NULL,
  cantidad integer NOT NULL,
  concepto text NOT NULL,
  costo_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  indice_concepto_plan integer,
  observaciones text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT recibos_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_detalles_recibo_id_fkey FOREIGN KEY (recibo_id) REFERENCES public.recibos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recibos_detalles_recibo ON public.recibos_detalles(recibo_id);


create table if not exists public.planes_pago_vinculos_recibo (
  id uuid primary key default gen_random_uuid(),
  recibo_detalle_id uuid not null references public.recibos_detalles(id) on delete cascade,
  plan_id uuid not null references public.planes_pago(id) on delete restrict,
  indice_concepto integer not null check (indice_concepto between 1 and 18),
  importe numeric(12,2) not null check (importe > 0),
  origen text not null check (origen in ('COBRO', 'CONCILIACION')),
  actor_uid uuid not null,
  creado_en timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por uuid
);
create index if not exists idx_vinculos_plan_pago on public.planes_pago_vinculos_recibo(plan_id, indice_concepto);
create index if not exists idx_vinculos_recibo_detalle on public.planes_pago_vinculos_recibo(recibo_detalle_id);
create unique index if not exists idx_vinculo_recibo_activo
  on public.planes_pago_vinculos_recibo(recibo_detalle_id, plan_id, indice_concepto)
  where anulado_en is null;
alter table public.planes_pago_vinculos_recibo enable row level security;
revoke all on public.planes_pago_vinculos_recibo from public, anon, authenticated;
grant select on public.planes_pago_vinculos_recibo to authenticated;
drop policy if exists "finanzas: leer vínculos de recibos" on public.planes_pago_vinculos_recibo;
create policy "finanzas: leer vínculos de recibos"
  on public.planes_pago_vinculos_recibo for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO',
      'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR RECURSOS HUMANOS', 'COORDINADOR ACADEMICO')
    and exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true));

-- Una cancelación posterior no puede dejar vínculos vigentes a un recibo inactivo.
create or replace function public.validar_vinculo_explicito_detalle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Las correcciones de textos de detalles históricos no deben exigir una
  -- conciliación retroactiva si el índice no cambió.
  if TG_OP = 'UPDATE' and new.indice_concepto_plan is not distinct from old.indice_concepto_plan then
    return new;
  end if;
  if new.indice_concepto_plan is null then
    if exists (select 1 from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = new.id and v.anulado_en is null) then
      raise exception 'Desvincula el detalle con la función auditada antes de quitar su índice';
    end if;
  elsif not exists (select 1 from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = new.id and v.indice_concepto = new.indice_concepto_plan
        and v.anulado_en is null) then
    raise exception 'El detalle de un recibo vinculado requiere el ID explícito del plan';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_vinculo_explicito_detalle on public.recibos_detalles;
create constraint trigger validar_vinculo_explicito_detalle
  after insert or update of indice_concepto_plan on public.recibos_detalles
  deferrable initially deferred for each row
  execute function public.validar_vinculo_explicito_detalle();
create or replace function public.vincular_recibo_detalle_planes_v2(
  p_detalle_id uuid, p_seleccion jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_recibo public.recibos%rowtype;
  v_plan public.planes_pago%rowtype;
  v_tipo_ciclo text;
  v_item jsonb;
  v_plan_id uuid;
  v_indice integer;
  v_primero integer;
  v_concepto text;
  v_cantidad numeric;
  v_previo text;
  v_restante numeric;
  v_abono numeric;
  v_acumulado numeric;
  v_saldo numeric;
  v_folios text;
  v_nuevo text;
  v_aplicaciones integer := 0;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para vincular recibos';
  end if;
  if p_detalle_id is null or p_seleccion is null or jsonb_typeof(p_seleccion) <> 'array'
    or jsonb_array_length(p_seleccion) = 0 then
    raise exception 'Selecciona al menos un concepto del plan';
  end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select * into v_detalle from public.recibos_detalles where id = p_detalle_id for update;
  select * into v_recibo from public.recibos where id = v_detalle.recibo_id for update;
  if v_detalle.id is null or v_recibo.id is null or v_recibo.estatus <> 'ACTIVO'
    or v_detalle.indice_concepto_plan is not null
    or exists (select 1 from public.planes_pago_vinculos_recibo
      where recibo_detalle_id = p_detalle_id and anulado_en is null) then
    raise exception 'El detalle no está disponible para vincular';
  end if;
  v_saldo := v_detalle.subtotal;
  if v_saldo <= 0 then raise exception 'El detalle no tiene un importe positivo'; end if;
  for v_item in select value from jsonb_array_elements(p_seleccion) loop
    v_plan_id := (v_item->>'plan_id')::uuid;
    v_indice := (v_item->>'indice')::integer;
    if v_plan_id is null or v_indice is null or v_indice not between 1 and 18 then
      raise exception 'La selección contiene un plan o índice inválido';
    end if;
    select * into v_plan from public.planes_pago where id = v_plan_id for update;
    if v_plan.id is null or v_plan.alumno_id is distinct from v_recibo.alumno_id
      or v_plan.ciclo_id is distinct from v_recibo.ciclo_id then
      raise exception 'El plan no pertenece al alumno y ciclo exactos del recibo';
    end if;
    select lower(btrim(tipo_periodo)) into v_tipo_ciclo
      from public.ciclos_escolares where id = v_plan.ciclo_id;
    if (lower(btrim(v_plan.tipo_plan)) like '%cuatrimestral%' and v_tipo_ciclo <> 'cuatrimestral')
      or (lower(btrim(v_plan.tipo_plan)) like '%semestral%' and v_tipo_ciclo <> 'semestral') then
      raise exception 'El tipo del plan no corresponde al ciclo exacto del recibo';
    end if;
    if exists (select 1 from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = p_detalle_id and v.plan_id = v_plan_id
        and v.indice_concepto = v_indice and v.anulado_en is null) then
      raise exception 'La selección repite un concepto del plan';
    end if;
    select pd.concepto, pd.cantidad, pd.estatus
      into v_concepto, v_cantidad, v_previo from public.planes_pago_detalles pd
      where pd.plan_id = v_plan_id and pd.indice_concepto = v_indice limit 1;
    if v_concepto is null then
      v_concepto := to_jsonb(v_plan) ->> ('concepto_' || v_indice);
      v_cantidad := (to_jsonb(v_plan) ->> ('cantidad_' || v_indice))::numeric;
      v_previo := to_jsonb(v_plan) ->> ('estatus_' || v_indice);
    end if;
    if nullif(btrim(v_concepto), '') is null or v_cantidad is null or v_cantidad <= 0 then
      raise exception 'El concepto seleccionado no tiene importe válido';
    end if;
    if v_previo ~* 'Resta\s*\$[0-9,]+(\.[0-9]+)?' then
      v_restante := replace((regexp_match(v_previo, 'Resta\s*\$([0-9,]+(\.[0-9]+)?)', 'i'))[1], ',', '')::numeric;
    elsif upper(coalesce(v_previo, '')) like '%PAGADO%' then
      v_restante := 0;
    elsif upper(btrim(coalesce(v_previo, ''))) in ('', 'PENDIENTE') then
      v_restante := v_cantidad;
    else
      raise exception 'El estado del concepto % requiere revisión antes de aplicar otro recibo', v_indice;
    end if;
    if v_restante <= 0 then raise exception 'El concepto % ya está pagado', v_indice; end if;
    v_abono := least(v_saldo, v_restante);
    if v_abono <= 0 then exit; end if;
    v_acumulado := v_cantidad - v_restante + v_abono;
    select string_agg(m[1], '; ') into v_folios
      from regexp_matches(coalesce(v_previo, ''), '(R-[0-9]+|F-[A-Za-z0-9-]+)', 'g') m;
    if v_restante - v_abono <= 0.005 then
      v_nuevo := concat_ws('; ', nullif(v_folios, ''),
        'R-' || v_recibo.folio || ' (Pagado $' || to_char(v_acumulado, 'FM999999990.00') || ')');
    else
      v_nuevo := concat_ws('; ', nullif(v_folios, ''),
        'R-' || v_recibo.folio || ' (Abono $' || to_char(v_acumulado, 'FM999999990.00')
          || ', Resta $' || to_char(v_restante - v_abono, 'FM999999990.00') || ')');
    end if;
    execute format('update public.planes_pago set %I = $1 where id = $2', 'estatus_' || v_indice)
      using v_nuevo, v_plan_id;
    update public.planes_pago_detalles set estatus = v_nuevo
      where plan_id = v_plan_id and indice_concepto = v_indice;
    insert into public.planes_pago_vinculos_recibo
      (recibo_detalle_id, plan_id, indice_concepto, importe, origen, actor_uid)
    values (p_detalle_id, v_plan_id, v_indice, v_abono, 'CONCILIACION', auth.uid());
    v_primero := coalesce(v_primero, v_indice);
    v_saldo := v_saldo - v_abono;
    v_aplicaciones := v_aplicaciones + 1;
    if v_saldo <= 0.005 then exit; end if;
  end loop;
  if v_aplicaciones = 0 then raise exception 'No quedó importe aplicado a ningún concepto'; end if;
  update public.recibos_detalles set indice_concepto_plan = v_primero,
    observaciones = case when v_saldo > 0.005 then
      'Vinculación parcial; excedente enviado a saldo a favor'
      else 'Vinculado al plan de pagos' end
    where id = p_detalle_id;
  if v_saldo > 0.005 then
    update public.alumnos set saldo_a_favor = coalesce(saldo_a_favor, 0) + v_saldo
      where id = v_recibo.alumno_id;
  end if;
  return jsonb_build_object('aplicado', true, 'aplicaciones', v_aplicaciones,
    'excedente', greatest(v_saldo, 0));
end;
$$;

create or replace function public.conciliar_recibo_detalle_plan(
  p_detalle_id uuid, p_plan_id uuid, p_indice integer,
  p_importe numeric, p_aplicar boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_recibo public.recibos%rowtype;
  v_plan public.planes_pago%rowtype;
  v_usado numeric;
  v_plan_usado numeric;
  v_plan_cantidad numeric;
  v_remanente numeric;
  v_motivo text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para conciliar recibos';
  end if;
  if p_detalle_id is null or p_plan_id is null or p_indice is null or p_indice not between 1 and 18
    or p_importe is null or p_importe <= 0 then
    raise exception 'Se requiere detalle, plan, índice e importe positivo';
  end if;
  if p_aplicar then
    perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
    perform pg_advisory_xact_lock(hashtext('aplicar_plan:' || p_plan_id::text || ':' || p_indice::text));
    select * into v_detalle from public.recibos_detalles where id = p_detalle_id for update;
  else
    select * into v_detalle from public.recibos_detalles where id = p_detalle_id;
  end if;
  if p_aplicar then
    select * into v_recibo from public.recibos where id = v_detalle.recibo_id for update;
    select * into v_plan from public.planes_pago where id = p_plan_id for update;
  else
    select * into v_recibo from public.recibos where id = v_detalle.recibo_id;
    select * into v_plan from public.planes_pago where id = p_plan_id;
  end if;
  if v_detalle.id is null or v_recibo.id is null or v_plan.id is null then
    v_motivo := 'El detalle, recibo o plan ya no existe.';
  elsif v_recibo.alumno_id is distinct from v_plan.alumno_id or v_recibo.estatus <> 'ACTIVO' then
    v_motivo := 'El recibo no está activo o pertenece a otro alumno.';
  elsif not exists (select 1 from public.ciclos_escolares origen
    join public.ciclos_escolares destino on destino.id = v_plan.ciclo_id
    where origen.id = v_recibo.ciclo_id and origen.nombre = destino.nombre
      and lower(btrim(destino.tipo_periodo)) = lower(btrim(v_plan.tipo_plan))) then
    v_motivo := 'El recibo y el plan no pertenecen al mismo periodo nominal.';
  elsif not exists (select 1 from public.alumno_programas ap
    join public.planes_estudio pe on pe.id = ap.plan_id
    where ap.alumno_id = v_plan.alumno_id and ap.es_vigente is true
      and lower(btrim(pe.tipo_periodo)) = lower(btrim(v_plan.tipo_plan))) then
    v_motivo := 'El tipo del plan no coincide con el programa académico vigente.';
  elsif exists (select 1 from public.planes_pago_vinculos_recibo v
    where v.recibo_detalle_id = p_detalle_id and v.plan_id = p_plan_id
      and v.indice_concepto = p_indice and v.anulado_en is null) then
    v_motivo := 'Este vínculo ya está registrado.';
  end if;
  if v_motivo is null then
    select cantidad into v_plan_cantidad from public.planes_pago_detalles
      where plan_id = p_plan_id and indice_concepto = p_indice limit 1;
    v_plan_cantidad := coalesce(v_plan_cantidad,
      (to_jsonb(v_plan) ->> ('cantidad_' || p_indice))::numeric);
    if not exists (select 1 from public.planes_pago_detalles d
        where d.plan_id = p_plan_id and d.indice_concepto = p_indice
          and nullif(btrim(d.concepto), '') is not null)
      and nullif(btrim(to_jsonb(v_plan) ->> ('concepto_' || p_indice)), '') is null then
      v_motivo := 'El concepto seleccionado no existe en el plan.';
    end if;
  end if;
  if v_motivo is null then
    select coalesce(sum(v.importe), 0) into v_usado
      from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = p_detalle_id and v.anulado_en is null;
    select coalesce(sum(v.importe), 0) into v_plan_usado
      from public.planes_pago_vinculos_recibo v
      where v.plan_id = p_plan_id and v.indice_concepto = p_indice and v.anulado_en is null;
    if p_importe + v_usado > v_detalle.subtotal + 0.005 then
      v_motivo := 'La distribución supera el importe del detalle del recibo.';
    elsif v_plan_cantidad is null or p_importe + v_plan_usado > v_plan_cantidad + 0.005 then
      v_motivo := 'La distribución supera el importe del concepto del plan.';
    elsif v_detalle.indice_concepto_plan is not null
      and v_detalle.indice_concepto_plan <> p_indice then
      v_motivo := 'El índice legado apunta a otro concepto; requiere revisión individual.';
    end if;
    v_remanente := greatest(v_detalle.subtotal - v_usado - p_importe, 0);
  end if;
  if v_motivo is not null then
    if p_aplicar then raise exception '%', v_motivo; end if;
    return jsonb_build_object('aplicable', false, 'motivo', v_motivo);
  end if;
  if p_aplicar then
    insert into public.planes_pago_vinculos_recibo
      (recibo_detalle_id, plan_id, indice_concepto, importe, origen, actor_uid)
    values (p_detalle_id, p_plan_id, p_indice, p_importe, 'CONCILIACION', auth.uid());
    update public.recibos_detalles set indice_concepto_plan = p_indice
      where id = p_detalle_id and indice_concepto_plan is null;
  end if;
  return jsonb_build_object('aplicable', true, 'aplicado', p_aplicar,
    'recibo_detalle_id', p_detalle_id, 'plan_id', p_plan_id,
    'indice_concepto', p_indice, 'importe', p_importe,
    'remanente_historico_sin_movimiento', v_remanente,
    'monedero_modificado', false);
end;
$$;
revoke all on function public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean) from public, anon;
grant execute on function public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean) to authenticated;

-- El cobro manual del mismo ID sí conserva la regla vigente: aplica abonos
-- parciales y acredita el sobrante al monedero. Esta bitácora impide volver a
-- acreditar ese mismo excedente tras desvincular y vincular de nuevo.
create table if not exists public.planes_pago_excedentes_monedero (
  recibo_detalle_id uuid primary key references public.recibos_detalles(id) on delete restrict,
  alumno_id uuid not null references public.alumnos(id) on delete restrict,
  importe numeric(12,2) not null check (importe > 0),
  actor_uid uuid not null,
  creado_en timestamptz not null default now()
);
alter table public.planes_pago_excedentes_monedero enable row level security;
revoke all on public.planes_pago_excedentes_monedero from public, anon, authenticated;
grant select on public.planes_pago_excedentes_monedero to authenticated;
drop policy if exists "finanzas: leer excedentes de recibos" on public.planes_pago_excedentes_monedero;
create policy "finanzas: leer excedentes de recibos"
  on public.planes_pago_excedentes_monedero for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    and exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true));

create or replace function public.vincular_recibo_detalle_planes_v3(
  p_detalle_id uuid, p_seleccion jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_alumno_id uuid;
  v_resultado jsonb;
  v_excedente numeric;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para vincular recibos';
  end if;
  if p_detalle_id is null then raise exception 'Selecciona un detalle del recibo'; end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select * into v_detalle from public.recibos_detalles where id = p_detalle_id for update;
  if not found then raise exception 'El detalle del recibo ya no existe'; end if;
  if exists (select 1 from public.planes_pago_excedentes_monedero e
      where e.recibo_detalle_id = p_detalle_id)
    or coalesce(v_detalle.observaciones, '') ~* 'excedente.*(monedero|saldo a favor)' then
    raise exception 'Este detalle ya generó un excedente de monedero; requiere revisión financiera antes de volver a vincular';
  end if;
  select alumno_id into v_alumno_id from public.recibos where id = v_detalle.recibo_id;
  v_resultado := public.vincular_recibo_detalle_planes_v2(p_detalle_id, p_seleccion);
  v_excedente := coalesce((v_resultado->>'excedente')::numeric, 0);
  if v_excedente > 0 then
    insert into public.planes_pago_excedentes_monedero
      (recibo_detalle_id, alumno_id, importe, actor_uid)
    values (p_detalle_id, v_alumno_id, v_excedente, auth.uid());
  end if;
  return v_resultado;
end;
$$;
revoke all on function public.vincular_recibo_detalle_planes_v2(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.vincular_recibo_detalle_planes_v3(uuid,jsonb) from public, anon;
grant execute on function public.vincular_recibo_detalle_planes_v3(uuid,jsonb) to authenticated;

-- Desvincular un recibo con excedente sin revertir primero el movimiento
-- duplicaría el monedero si se aplicara de nuevo. Se bloquea para revisión.
create or replace function public.desvincular_detalle_recibo_plan(p_detalle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_recibo_id uuid;
  v_observaciones text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para desvincular recibos';
  end if;
  if p_detalle_id is null then raise exception 'Selecciona un detalle del recibo'; end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select recibo_id, observaciones into v_recibo_id, v_observaciones
    from public.recibos_detalles where id = p_detalle_id for update;
  if not found then raise exception 'El detalle del recibo ya no existe'; end if;
  if exists (select 1 from public.planes_pago_excedentes_monedero e
      where e.recibo_detalle_id = p_detalle_id)
    or coalesce(v_observaciones, '') ~* 'excedente.*(monedero|saldo a favor)' then
    raise exception 'Este detalle generó monedero; concilia el saldo antes de desvincularlo';
  end if;
  update public.planes_pago_vinculos_recibo
    set anulado_en = now(), anulado_por = auth.uid()
    where recibo_detalle_id = p_detalle_id and anulado_en is null;
  update public.recibos_detalles set indice_concepto_plan = null
    where id = p_detalle_id;
  return jsonb_build_object('aplicado', true, 'recibo_id', v_recibo_id);
end;
$$;
revoke all on function public.desvincular_detalle_recibo_plan(uuid) from public, anon;
grant execute on function public.desvincular_detalle_recibo_plan(uuid) to authenticated;

\ir ../../supabase/migrations/20261018190000_sincronizar_plan_pago_detalles.sql
\ir ../../supabase/migrations/20261106120000_consulta_y_operaciones_financieras.sql
