-- ============================================================================
-- MIGRACIÓN ADITIVA PREPARADA (NO EJECUTADA): REPORTES ACADÉMICOS
-- Fecha: 14/11/2026
-- Requisito: ejecutar antes supabase/checks/preflight_reportes_academicos_20261114.sql
--            y confirmar que todas las filas indiquen OK.
-- Después:   supabase/checks/verificar_reportes_academicos_20261114.sql
--
-- Alcance:
--   * Seis tablas nuevas (reportes, alumnos, grupos, docentes, acta de hechos y
--     bitácora privada). No modifica ni borra tablas, datos o funciones existentes.
--   * Escritura exclusiva mediante guardar_reporte_academico_v1 (revisión
--     optimista + bitácora). Lectura mediante consultar_reportes_academicos_v1.
--   * Roles: ADMINISTRADOR, COORDINADOR ACADEMICO y COORDINADOR CONTROL ESCOLAR
--     con cuenta activa en public.usuarios.
--
-- Adaptaciones al esquema real (documentadas en docs/MEMORIA_FUNCIONAL.md):
--   * ciclos_escolares usa tipo_periodo (no existe la columna tipo).
--   * docentes y empleados no tienen columna booleana activo; se considera
--     activo cuando lower(estatus) = 'activo', igual que la publicación de horarios.
-- ============================================================================
begin;

do $preflight$
begin
  if to_regclass('public.ciclos_escolares') is null or to_regclass('public.alumnos') is null
    or to_regclass('public.grupos') is null or to_regclass('public.alumnos_grupos') is null
    or to_regclass('public.docentes') is null or to_regclass('public.empleados') is null
    or to_regclass('public.carreras') is null or to_regclass('public.planes_estudio') is null
    or to_regclass('public.alumno_programas') is null or to_regclass('public.usuarios') is null
    or to_regprocedure('public.get_my_rol()') is null then
    raise exception 'Faltan tablas o funciones base; ejecuta el preflight de reportes académicos';
  end if;
  if to_regclass('public.reportes_academicos') is not null
    or to_regclass('public.reportes_academicos_alumnos') is not null
    or to_regclass('public.reportes_academicos_grupos') is not null
    or to_regclass('public.reportes_academicos_docentes') is not null
    or to_regclass('public.reportes_actas_hechos') is not null
    or to_regclass('public.reportes_academicos_bitacora') is not null
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'guardar_reporte_academico_v1', 'consultar_reportes_academicos_v1', '_ra_uuid_v1', '_ra_fecha_v1',
        '_ra_textos_v1', '_ra_normalizar_v1', '_ra_rol_v1', '_ra_lector_v1', '_ra_snapshot_v1')) then
    raise exception 'Los objetos de reportes académicos ya existen; revisa la instalación antes de continuar';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'docentes' and column_name in ('activo', 'estatus'))
    or not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'empleados' and column_name = 'puesto')
    or not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'grupos' and column_name = 'es_multigrado') then
    raise exception 'El esquema de docentes, empleados o grupos no coincide con el revisado';
  end if;
end;
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. Tablas
-- ----------------------------------------------------------------------------
create table public.reportes_academicos (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  ciclo_id uuid not null references public.ciclos_escolares(id) on delete restrict,
  flujo_registro text not null check (flujo_registro in ('ALUMNO_DOCENTE', 'GRUPO')),
  tipo_reporte text not null check (tipo_reporte in ('INASISTENCIAS', 'PROBLEMA_RENDIMIENTO', 'INCIDENTE')),
  fecha_reporte date not null,
  descripcion text not null,
  estatus text not null default 'EN_PROCESO' check (estatus in ('EN_PROCESO', 'RESUELTO')),
  tiene_acta_hechos boolean not null default false,
  enlace_drive text null,
  notas_evidencia text null,
  revision integer not null default 1,
  creado_por uuid null,
  actualizado_por uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reportes_academicos_folio_ciclo_unico unique (ciclo_id, folio),
  constraint reportes_academicos_folio_formato check (folio ~ '^REP-[A-Z0-9]+-[0-9]{4,}$'),
  constraint reportes_academicos_grupo_solo_incidente check (flujo_registro <> 'GRUPO' or tipo_reporte = 'INCIDENTE'),
  constraint reportes_academicos_evidencia_solo_incidente
    check ((tiene_acta_hechos = false and enlace_drive is null) or tipo_reporte = 'INCIDENTE'),
  constraint reportes_academicos_descripcion_no_vacia check (length(btrim(descripcion)) > 0),
  constraint reportes_academicos_revision_positiva check (revision >= 1)
);
create index reportes_academicos_ciclo_fecha on public.reportes_academicos(ciclo_id, fecha_reporte desc);
create index reportes_academicos_fecha on public.reportes_academicos(fecha_reporte desc);

create table public.reportes_academicos_alumnos (
  reporte_id uuid not null references public.reportes_academicos(id) on delete cascade,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  grupo_id uuid null references public.grupos(id) on delete set null,
  matricula_snapshot text,
  nombre_snapshot text,
  carrera_snapshot text,
  grado_snapshot text,
  primary key (reporte_id, alumno_id)
);
create index reportes_academicos_alumnos_alumno on public.reportes_academicos_alumnos(alumno_id);
create index reportes_academicos_alumnos_grupo on public.reportes_academicos_alumnos(grupo_id);

create table public.reportes_academicos_grupos (
  reporte_id uuid not null references public.reportes_academicos(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  alcance_alumnos text not null default 'TODO_EL_GRUPO' check (alcance_alumnos in ('TODO_EL_GRUPO', 'PARCIAL')),
  codigo_grupo_snapshot text,
  carrera_snapshot text,
  grado_snapshot text,
  turno_snapshot text,
  primary key (reporte_id, grupo_id)
);
create index reportes_academicos_grupos_grupo on public.reportes_academicos_grupos(grupo_id);

create table public.reportes_academicos_docentes (
  reporte_id uuid not null references public.reportes_academicos(id) on delete cascade,
  docente_id uuid not null references public.docentes(id) on delete cascade,
  nombre_docente_snapshot text,
  clave_docente_snapshot text,
  primary key (reporte_id, docente_id)
);
create index reportes_academicos_docentes_docente on public.reportes_academicos_docentes(docente_id);

create table public.reportes_actas_hechos (
  reporte_id uuid primary key references public.reportes_academicos(id) on delete cascade,
  nombre_institucion text not null default 'Centro Universitario Oriente de México',
  titulo_documento text not null default 'Acta de Hechos',
  lugar text not null,
  fecha_levantamiento date not null,
  hora_inicio time not null,
  hora_conclusion time not null,
  empleado_levanta_id uuid not null references public.empleados(id),
  empleado_levanta_nombre text not null,
  empleado_levanta_cargo text not null,
  testigos_json jsonb not null default '[]'::jsonb,
  relatoria_hechos text not null,
  pruebas_anexos text null,
  constraint reportes_actas_hechos_horario check (hora_conclusion >= hora_inicio),
  constraint reportes_actas_hechos_testigos_arreglo check (jsonb_typeof(testigos_json) = 'array'),
  constraint reportes_actas_hechos_textos check (
    length(btrim(lugar)) > 0 and length(btrim(relatoria_hechos)) > 0
    and length(btrim(empleado_levanta_nombre)) > 0 and length(btrim(empleado_levanta_cargo)) > 0)
);
create index reportes_actas_hechos_empleado on public.reportes_actas_hechos(empleado_levanta_id);

-- Bitácora privada: sin claves foráneas para no impedir depuraciones futuras.
create table public.reportes_academicos_bitacora (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null,
  accion text not null check (accion in ('CREAR', 'EDITAR', 'CAMBIAR_ESTATUS')),
  actor_uid uuid,
  actor_rol text,
  antes_json jsonb,
  despues_json jsonb,
  created_at timestamptz not null default now()
);
create index reportes_academicos_bitacora_reporte on public.reportes_academicos_bitacora(reporte_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Funciones auxiliares (internas)
-- ----------------------------------------------------------------------------
create function public._ra_uuid_v1(p_texto text)
returns uuid language sql immutable set search_path = public as $$
  select case when btrim(coalesce(p_texto, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then btrim(p_texto)::uuid end
$$;

create function public._ra_fecha_v1(p_texto text, p_campo text)
returns date language plpgsql immutable set search_path = public as $$
begin
  if nullif(btrim(coalesce(p_texto, '')), '') is null then return null; end if;
  if btrim(p_texto) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Fecha inválida en %', p_campo;
  end if;
  begin
    return btrim(p_texto)::date;
  exception when others then
    raise exception 'Fecha inválida en %', p_campo;
  end;
end
$$;

-- Acepta un texto o un arreglo de textos (filtros de multiselección).
create function public._ra_textos_v1(p_valor jsonb)
returns text[] language sql immutable set search_path = public as $$
  select case jsonb_typeof(p_valor)
    when 'string' then coalesce(array_remove(array[nullif(btrim(p_valor #>> '{}'), '')], null), '{}'::text[])
    when 'array' then coalesce(array(
      select nullif(btrim(x), '') from jsonb_array_elements_text(p_valor) x where nullif(btrim(x), '') is not null), '{}'::text[])
    else '{}'::text[] end
$$;

create function public._ra_normalizar_v1(p_texto text)
returns text language sql immutable set search_path = public as $$
  select lower(translate(btrim(coalesce(p_texto, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
$$;

-- Autorización de escritura/consulta: lanza error si no procede.
create function public._ra_rol_v1()
returns text language plpgsql stable security definer set search_path = public as $$
declare v_rol text;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para gestionar reportes académicos' using errcode = '42501';
  end if;
  v_rol := coalesce(public.get_my_rol(), '');
  if v_rol not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para gestionar reportes académicos' using errcode = '42501';
  end if;
  return v_rol;
end
$$;

-- Variante booleana para políticas RLS de lectura (no lanza error).
create function public._ra_lector_v1()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true
      and u.rol in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR'))
$$;

-- Instantánea completa y determinista de un reporte (bitácora y consulta).
create function public._ra_snapshot_v1(p_reporte_id uuid)
returns jsonb language sql stable set search_path = public as $$
  select to_jsonb(r) || jsonb_build_object(
    'alumnos', coalesce((select jsonb_agg(to_jsonb(a) - 'reporte_id' order by a.alumno_id)
      from public.reportes_academicos_alumnos a where a.reporte_id = r.id), '[]'::jsonb),
    'grupos', coalesce((select jsonb_agg(to_jsonb(g) - 'reporte_id' order by g.grupo_id)
      from public.reportes_academicos_grupos g where g.reporte_id = r.id), '[]'::jsonb),
    'docentes', coalesce((select jsonb_agg(to_jsonb(d) - 'reporte_id' order by d.docente_id)
      from public.reportes_academicos_docentes d where d.reporte_id = r.id), '[]'::jsonb),
    'acta', (select to_jsonb(h) - 'reporte_id' from public.reportes_actas_hechos h where h.reporte_id = r.id))
  from public.reportes_academicos r
  where r.id = p_reporte_id
$$;

-- ----------------------------------------------------------------------------
-- 3. Guardado transaccional (alta y edición con revisión optimista)
-- ----------------------------------------------------------------------------
-- Contrato de p_payload:
-- {
--   id?: uuid, revision?: int (obligatoria en edición),
--   ciclo_id, flujo_registro, tipo_reporte, fecha_reporte (YYYY-MM-DD), descripcion,
--   estatus?, tiene_acta_hechos?, enlace_drive?, notas_evidencia?,
--   alumnos?:  [{ alumno_id, grupo_id? }],
--   grupos?:   [{ grupo_id, alcance_alumnos: 'TODO_EL_GRUPO' | 'PARCIAL' }],
--   docentes?: [{ docente_id }],
--   acta?: { lugar, fecha_levantamiento, hora_inicio, hora_conclusion, empleado_levanta_id,
--            empleado_levanta_cargo?, testigos: [...], relatoria_hechos, pruebas_anexos?,
--            nombre_institucion?, titulo_documento? }
-- }
create function public.guardar_reporte_academico_v1(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_id uuid;
  v_es_edicion boolean;
  v_revision integer;
  v_actual public.reportes_academicos%rowtype;
  v_ciclo public.ciclos_escolares%rowtype;
  v_ciclo_id uuid;
  v_flujo text;
  v_tipo text;
  v_fecha date;
  v_descripcion text;
  v_estatus text;
  v_tiene_acta boolean;
  v_enlace text;
  v_notas text;
  v_alumnos jsonb;
  v_grupos jsonb;
  v_docentes jsonb;
  v_item jsonb;
  v_alumno_id uuid;
  v_grupo_id uuid;
  v_docente_id uuid;
  v_alcance text;
  v_grupo public.grupos%rowtype;
  v_docente public.docentes%rowtype;
  v_grupos_todo uuid[] := '{}';
  v_grupos_parcial uuid[] := '{}';
  v_ids_alumnos uuid[] := '{}';
  v_ids_grupos uuid[] := '{}';
  v_ids_docentes uuid[] := '{}';
  v_antes jsonb;
  v_despues jsonb;
  v_accion text;
  v_token text;
  v_consecutivo integer;
  v_folio text;
  -- Acta de hechos
  v_acta jsonb;
  v_acta_previa public.reportes_actas_hechos%rowtype;
  v_hay_acta_previa boolean := false;
  v_lugar text;
  v_fecha_lev date;
  v_hora_ini time;
  v_hora_fin time;
  v_empleado_id uuid;
  v_empleado public.empleados%rowtype;
  v_empleado_nombre text;
  v_empleado_cargo text;
  v_testigos_entrada jsonb;
  v_testigos jsonb := '[]'::jsonb;
  v_testigo jsonb;
  v_t_tipo text;
  v_t_persona uuid;
  v_t_nombre text;
  v_t_cargo text;
  v_existe boolean;
  v_relatoria text;
  v_pruebas text;
  v_institucion text;
  v_titulo text;
  v_excluir_cambio text[] := array['revision', 'updated_at', 'actualizado_por'];
  v_excluir_estatus text[] := array['estatus', 'revision', 'updated_at', 'actualizado_por'];
begin
  v_rol := public._ra_rol_v1();
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Envía los datos del reporte';
  end if;

  -- Identidad y concurrencia optimista
  v_id := public._ra_uuid_v1(p_payload ->> 'id');
  if nullif(btrim(coalesce(p_payload ->> 'id', '')), '') is not null and v_id is null then
    raise exception 'El identificador del reporte no es válido';
  end if;
  v_es_edicion := v_id is not null;
  if v_es_edicion then
    if coalesce(p_payload ->> 'revision', '') !~ '^[0-9]+$' then
      raise exception 'Se requiere la revisión vigente del reporte';
    end if;
    v_revision := (p_payload ->> 'revision')::integer;
    perform set_config('lock_timeout', '3s', true);
    select * into v_actual from public.reportes_academicos where id = v_id for update;
    if not found then
      raise exception 'El reporte ya no existe; actualiza la consulta';
    end if;
    if v_actual.revision <> v_revision then
      raise exception 'El reporte fue modificado por otra persona; actualiza antes de guardar' using errcode = '40001';
    end if;
    v_antes := public._ra_snapshot_v1(v_id);
    select * into v_acta_previa from public.reportes_actas_hechos where reporte_id = v_id;
    v_hay_acta_previa := found;
  end if;

  -- Datos generales
  v_ciclo_id := public._ra_uuid_v1(p_payload ->> 'ciclo_id');
  if v_ciclo_id is null then raise exception 'Selecciona el ciclo escolar'; end if;
  select * into v_ciclo from public.ciclos_escolares where id = v_ciclo_id;
  if not found then raise exception 'El ciclo escolar no existe'; end if;
  if v_es_edicion and v_actual.ciclo_id <> v_ciclo_id then
    raise exception 'El ciclo de un reporte registrado no puede cambiarse porque determina su folio';
  end if;

  v_flujo := upper(btrim(coalesce(p_payload ->> 'flujo_registro', '')));
  if v_flujo not in ('ALUMNO_DOCENTE', 'GRUPO') then raise exception 'Flujo de registro no válido'; end if;
  v_tipo := upper(btrim(coalesce(p_payload ->> 'tipo_reporte', '')));
  if v_tipo not in ('INASISTENCIAS', 'PROBLEMA_RENDIMIENTO', 'INCIDENTE') then raise exception 'Tipo de reporte no válido'; end if;
  v_fecha := public._ra_fecha_v1(p_payload ->> 'fecha_reporte', 'la fecha del reporte');
  if v_fecha is null then raise exception 'Indica la fecha del reporte'; end if;
  v_descripcion := btrim(coalesce(p_payload ->> 'descripcion', ''));
  if v_descripcion = '' then raise exception 'Describe el reporte'; end if;
  if length(v_descripcion) > 10000 then raise exception 'La descripción excede 10 000 caracteres'; end if;

  v_estatus := coalesce(nullif(upper(btrim(coalesce(p_payload ->> 'estatus', ''))), ''),
    case when v_es_edicion then v_actual.estatus else 'EN_PROCESO' end);
  if v_estatus not in ('EN_PROCESO', 'RESUELTO') then raise exception 'Estatus no válido'; end if;

  if p_payload -> 'tiene_acta_hechos' is null or jsonb_typeof(p_payload -> 'tiene_acta_hechos') = 'null' then
    v_tiene_acta := false;
  elsif jsonb_typeof(p_payload -> 'tiene_acta_hechos') = 'boolean' then
    v_tiene_acta := (p_payload ->> 'tiene_acta_hechos')::boolean;
  else
    raise exception 'Indica si el reporte tiene acta de hechos';
  end if;

  v_enlace := nullif(btrim(coalesce(p_payload ->> 'enlace_drive', '')), '');
  if v_enlace is not null and (v_enlace !~* '^https://[^[:space:]]+$' or length(v_enlace) > 2000) then
    raise exception 'El enlace de evidencia debe ser una dirección https válida';
  end if;
  v_notas := nullif(btrim(coalesce(p_payload ->> 'notas_evidencia', '')), '');
  if length(coalesce(v_notas, '')) > 5000 then raise exception 'Las notas de evidencia exceden 5000 caracteres'; end if;

  v_alumnos := coalesce(p_payload -> 'alumnos', '[]'::jsonb);
  v_grupos := coalesce(p_payload -> 'grupos', '[]'::jsonb);
  v_docentes := coalesce(p_payload -> 'docentes', '[]'::jsonb);
  if jsonb_typeof(v_alumnos) = 'null' then v_alumnos := '[]'::jsonb; end if;
  if jsonb_typeof(v_grupos) = 'null' then v_grupos := '[]'::jsonb; end if;
  if jsonb_typeof(v_docentes) = 'null' then v_docentes := '[]'::jsonb; end if;
  if jsonb_typeof(v_alumnos) <> 'array' or jsonb_typeof(v_grupos) <> 'array' or jsonb_typeof(v_docentes) <> 'array' then
    raise exception 'Alumnos, grupos y docentes deben enviarse como listas';
  end if;

  -- Reglas por tipo y flujo
  if v_tipo in ('INASISTENCIAS', 'PROBLEMA_RENDIMIENTO') then
    if v_flujo <> 'ALUMNO_DOCENTE' then
      raise exception 'Las inasistencias y problemas de rendimiento se registran por alumno';
    end if;
    if jsonb_array_length(v_alumnos) = 0 then
      raise exception 'Selecciona al menos un alumno';
    end if;
    if jsonb_array_length(v_grupos) > 0 or jsonb_array_length(v_docentes) > 0 then
      raise exception 'Las inasistencias y problemas de rendimiento solo admiten alumnos individuales';
    end if;
    if v_tiene_acta or v_enlace is not null then
      raise exception 'El acta de hechos y el enlace de evidencia solo aplican a incidentes';
    end if;
  end if;
  if v_flujo = 'GRUPO' then
    if v_tipo <> 'INCIDENTE' then raise exception 'Los reportes por grupo solo pueden ser incidentes'; end if;
    if jsonb_array_length(v_grupos) = 0 then raise exception 'Selecciona al menos un grupo'; end if;
  else
    if jsonb_array_length(v_grupos) > 0 then
      raise exception 'Los grupos se registran en el flujo por grupo';
    end if;
    if jsonb_array_length(v_alumnos) = 0 and jsonb_array_length(v_docentes) = 0 then
      raise exception 'Selecciona al menos un alumno o docente';
    end if;
  end if;
  if (v_tiene_acta or v_enlace is not null) and v_tipo <> 'INCIDENTE' then
    raise exception 'El acta de hechos y el enlace de evidencia solo aplican a incidentes';
  end if;

  -- Grupos: deben pertenecer exactamente al ciclo del reporte
  for v_item in select value from jsonb_array_elements(v_grupos) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Formato de grupo no válido'; end if;
    v_grupo_id := public._ra_uuid_v1(v_item ->> 'grupo_id');
    if v_grupo_id is null then raise exception 'Identificador de grupo no válido'; end if;
    if v_grupo_id = any(v_ids_grupos) then raise exception 'Un grupo está repetido en el reporte'; end if;
    select * into v_grupo from public.grupos where id = v_grupo_id;
    if not found then raise exception 'Uno de los grupos ya no existe'; end if;
    if v_grupo.ciclo_id <> v_ciclo_id then
      raise exception 'El grupo % no pertenece al ciclo del reporte', v_grupo.codigo_grupo;
    end if;
    v_alcance := coalesce(nullif(upper(btrim(coalesce(v_item ->> 'alcance_alumnos', ''))), ''), 'TODO_EL_GRUPO');
    if v_alcance not in ('TODO_EL_GRUPO', 'PARCIAL') then raise exception 'Alcance de alumnos no válido'; end if;
    v_ids_grupos := array_append(v_ids_grupos, v_grupo_id);
    if v_alcance = 'TODO_EL_GRUPO' then
      v_grupos_todo := array_append(v_grupos_todo, v_grupo_id);
    else
      v_grupos_parcial := array_append(v_grupos_parcial, v_grupo_id);
    end if;
  end loop;

  -- Alumnos individuales (nunca de un grupo con alcance TODO_EL_GRUPO)
  for v_item in select value from jsonb_array_elements(v_alumnos) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Formato de alumno no válido'; end if;
    v_alumno_id := public._ra_uuid_v1(v_item ->> 'alumno_id');
    if v_alumno_id is null then raise exception 'Identificador de alumno no válido'; end if;
    if v_alumno_id = any(v_ids_alumnos) then raise exception 'Un alumno está repetido en el reporte'; end if;
    if not exists (select 1 from public.alumnos where id = v_alumno_id) then
      raise exception 'Uno de los alumnos ya no existe';
    end if;
    v_grupo_id := public._ra_uuid_v1(v_item ->> 'grupo_id');
    if nullif(btrim(coalesce(v_item ->> 'grupo_id', '')), '') is not null and v_grupo_id is null then
      raise exception 'Identificador de grupo del alumno no válido';
    end if;
    if v_flujo = 'GRUPO' then
      if v_grupo_id is null then
        raise exception 'Cada alumno de un reporte grupal debe indicar su grupo';
      end if;
      if v_grupo_id = any(v_grupos_todo) then
        raise exception 'Un grupo con alcance «todo el grupo» no admite alumnos seleccionados';
      end if;
      if not (v_grupo_id = any(v_grupos_parcial)) then
        raise exception 'Un alumno se asoció a un grupo que no forma parte del reporte';
      end if;
    end if;
    if cardinality(v_grupos_todo) > 0 and exists (
      select 1 from public.alumnos_grupos ag where ag.alumno_id = v_alumno_id and ag.grupo_id = any(v_grupos_todo)) then
      raise exception 'Un alumno pertenece a un grupo reportado completo; no se registra de forma individual';
    end if;
    if v_grupo_id is not null then
      select * into v_grupo from public.grupos where id = v_grupo_id;
      if not found then raise exception 'El grupo indicado para un alumno ya no existe'; end if;
      if v_grupo.ciclo_id <> v_ciclo_id then
        raise exception 'El grupo % no pertenece al ciclo del reporte', v_grupo.codigo_grupo;
      end if;
      if not exists (select 1 from public.alumnos_grupos ag where ag.alumno_id = v_alumno_id and ag.grupo_id = v_grupo_id) then
        raise exception 'Un alumno no está inscrito en el grupo %', v_grupo.codigo_grupo;
      end if;
    end if;
    v_ids_alumnos := array_append(v_ids_alumnos, v_alumno_id);
  end loop;

  if exists (
    select 1 from unnest(v_grupos_parcial) g(id)
    where not exists (select 1 from jsonb_array_elements(v_alumnos) a where public._ra_uuid_v1(a ->> 'grupo_id') = g.id)) then
    raise exception 'Un grupo con alcance parcial requiere al menos un alumno seleccionado';
  end if;

  -- Docentes: los nuevos deben estar activos; los ya asociados se conservan
  for v_item in select value from jsonb_array_elements(v_docentes) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Formato de docente no válido'; end if;
    v_docente_id := public._ra_uuid_v1(v_item ->> 'docente_id');
    if v_docente_id is null then raise exception 'Identificador de docente no válido'; end if;
    if v_docente_id = any(v_ids_docentes) then raise exception 'Un docente está repetido en el reporte'; end if;
    select * into v_docente from public.docentes where id = v_docente_id;
    if not found then raise exception 'Uno de los docentes ya no existe'; end if;
    if not coalesce((to_jsonb(v_docente) ->> 'activo')::boolean,
        lower(btrim(coalesce(to_jsonb(v_docente) ->> 'estatus', 'activo'))) = 'activo')
      and not (v_es_edicion and exists (select 1 from public.reportes_academicos_docentes d
        where d.reporte_id = v_id and d.docente_id = v_docente_id)) then
      raise exception 'El docente % no está activo', v_docente.nombre_completo;
    end if;
    v_ids_docentes := array_append(v_ids_docentes, v_docente_id);
  end loop;

  -- Acta de hechos
  if v_tiene_acta then
    v_acta := p_payload -> 'acta';
    if v_acta is null or jsonb_typeof(v_acta) <> 'object' then raise exception 'Captura los datos del acta de hechos'; end if;
    v_lugar := btrim(coalesce(v_acta ->> 'lugar', ''));
    if v_lugar = '' or length(v_lugar) > 500 then raise exception 'Indica el lugar del acta (máximo 500 caracteres)'; end if;
    v_fecha_lev := public._ra_fecha_v1(v_acta ->> 'fecha_levantamiento', 'la fecha del acta');
    if v_fecha_lev is null then raise exception 'Indica la fecha de levantamiento del acta'; end if;
    if coalesce(v_acta ->> 'hora_inicio', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      or coalesce(v_acta ->> 'hora_conclusion', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
      raise exception 'Indica las horas de inicio y conclusión del acta (HH:MM)';
    end if;
    v_hora_ini := (v_acta ->> 'hora_inicio')::time;
    v_hora_fin := (v_acta ->> 'hora_conclusion')::time;
    if v_hora_fin < v_hora_ini then raise exception 'La hora de conclusión no puede ser anterior a la de inicio'; end if;

    v_empleado_id := public._ra_uuid_v1(v_acta ->> 'empleado_levanta_id');
    if v_empleado_id is null then raise exception 'Selecciona a quien levanta el acta'; end if;
    select * into v_empleado from public.empleados where id = v_empleado_id;
    if not found then raise exception 'La persona que levanta el acta ya no existe'; end if;
    if not coalesce((to_jsonb(v_empleado) ->> 'activo')::boolean,
        lower(btrim(coalesce(to_jsonb(v_empleado) ->> 'estatus', 'activo'))) = 'activo')
      and not (v_hay_acta_previa and v_acta_previa.empleado_levanta_id = v_empleado_id) then
      raise exception 'La persona que levanta el acta no está activa';
    end if;
    v_empleado_nombre := btrim(concat_ws(' ', btrim(v_empleado.nombres), btrim(v_empleado.apellido_paterno), nullif(btrim(coalesce(v_empleado.apellido_materno, '')), '')));
    v_empleado_cargo := coalesce(nullif(btrim(coalesce(v_acta ->> 'empleado_levanta_cargo', '')), ''), nullif(btrim(coalesce(v_empleado.puesto, '')), ''));
    if v_empleado_cargo is null then raise exception 'Indica el cargo de quien levanta el acta'; end if;
    if length(v_empleado_cargo) > 300 then raise exception 'El cargo excede 300 caracteres'; end if;

    v_testigos_entrada := coalesce(v_acta -> 'testigos', v_acta -> 'testigos_json', '[]'::jsonb);
    if jsonb_typeof(v_testigos_entrada) = 'null' then v_testigos_entrada := '[]'::jsonb; end if;
    if jsonb_typeof(v_testigos_entrada) <> 'array' then raise exception 'Los testigos deben enviarse como lista'; end if;
    if jsonb_array_length(v_testigos_entrada) > 20 then raise exception 'El acta admite como máximo 20 testigos'; end if;
    for v_testigo in select value from jsonb_array_elements(v_testigos_entrada) loop
      if jsonb_typeof(v_testigo) <> 'object' then raise exception 'Formato de testigo no válido'; end if;
      v_t_tipo := upper(btrim(coalesce(v_testigo ->> 'tipo', '')));
      if v_t_tipo not in ('PERSONAL', 'EXTERNO') then raise exception 'Tipo de testigo no válido'; end if;
      v_t_nombre := btrim(coalesce(v_testigo ->> 'nombre_completo', ''));
      v_t_cargo := btrim(coalesce(v_testigo ->> 'cargo_identificacion', ''));
      if v_t_nombre = '' or v_t_cargo = '' or length(v_t_nombre) > 300 or length(v_t_cargo) > 300 then
        raise exception 'Cada testigo requiere nombre completo y cargo o identificación (máximo 300 caracteres)';
      end if;
      v_t_persona := public._ra_uuid_v1(v_testigo ->> 'persona_id');
      if v_t_tipo = 'PERSONAL' then
        if v_t_persona is null then raise exception 'Selecciona al testigo del personal'; end if;
        v_existe := exists (select 1 from public.empleados where id = v_t_persona)
          or exists (select 1 from public.docentes where id = v_t_persona);
        if not v_existe and to_regclass('public.personal_personas') is not null then
          execute 'select exists (select 1 from public.personal_personas where id = $1)' into v_existe using v_t_persona;
        end if;
        if not coalesce(v_existe, false) then raise exception 'Un testigo del personal no existe'; end if;
        v_testigos := v_testigos || jsonb_build_array(jsonb_build_object('tipo', 'PERSONAL', 'persona_id', v_t_persona,
          'nombre_completo', v_t_nombre, 'cargo_identificacion', v_t_cargo));
      else
        v_testigos := v_testigos || jsonb_build_array(jsonb_build_object('tipo', 'EXTERNO',
          'nombre_completo', v_t_nombre, 'cargo_identificacion', v_t_cargo));
      end if;
    end loop;

    v_relatoria := btrim(coalesce(v_acta ->> 'relatoria_hechos', ''));
    if v_relatoria = '' or length(v_relatoria) > 20000 then
      raise exception 'Captura la relatoría de hechos (máximo 20 000 caracteres)';
    end if;
    v_pruebas := nullif(btrim(coalesce(v_acta ->> 'pruebas_anexos', '')), '');
    if length(coalesce(v_pruebas, '')) > 10000 then raise exception 'Las pruebas y anexos exceden 10 000 caracteres'; end if;
    v_institucion := coalesce(nullif(btrim(coalesce(v_acta ->> 'nombre_institucion', '')), ''), 'Centro Universitario Oriente de México');
    v_titulo := coalesce(nullif(btrim(coalesce(v_acta ->> 'titulo_documento', '')), ''), 'Acta de Hechos');
  end if;

  -- Persistencia del encabezado
  if not v_es_edicion then
    perform pg_advisory_xact_lock(hashtext('reportes_academicos_folio:' || v_ciclo_id::text));
    v_token := upper(regexp_replace(translate(coalesce(v_ciclo.nombre, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[^A-Za-z0-9]+', '', 'g'));
    if v_token = '' then v_token := 'CICLO'; end if;
    select coalesce(max((substring(r.folio from '-([0-9]+)$'))::integer), 0) + 1 into v_consecutivo
      from public.reportes_academicos r where r.ciclo_id = v_ciclo_id;
    v_folio := format('REP-%s-%s', v_token, lpad(v_consecutivo::text, 4, '0'));
    insert into public.reportes_academicos (
      folio, ciclo_id, flujo_registro, tipo_reporte, fecha_reporte, descripcion, estatus,
      tiene_acta_hechos, enlace_drive, notas_evidencia, revision, creado_por, actualizado_por)
    values (
      v_folio, v_ciclo_id, v_flujo, v_tipo, v_fecha, v_descripcion, v_estatus,
      v_tiene_acta, v_enlace, v_notas, 1, v_uid, v_uid)
    returning id into v_id;
  else
    update public.reportes_academicos set
      flujo_registro = v_flujo, tipo_reporte = v_tipo, fecha_reporte = v_fecha, descripcion = v_descripcion,
      estatus = v_estatus, tiene_acta_hechos = v_tiene_acta, enlace_drive = v_enlace, notas_evidencia = v_notas,
      revision = revision + 1, actualizado_por = v_uid, updated_at = now()
    where id = v_id;
  end if;

  -- Alumnos: conserva instantáneas de los ya asociados
  delete from public.reportes_academicos_alumnos where reporte_id = v_id and not (alumno_id = any(v_ids_alumnos));
  insert into public.reportes_academicos_alumnos (
    reporte_id, alumno_id, grupo_id, matricula_snapshot, nombre_snapshot, carrera_snapshot, grado_snapshot)
  select v_id, a.id, x.grupo_id, a.matricula, a.nombre_completo,
    coalesce((select c.nombre from public.alumno_programas ap
        join public.planes_estudio pe on pe.id = ap.plan_id
        join public.carreras c on c.id = pe.carrera_id
        where ap.alumno_id = a.id and ap.es_vigente is true
        order by ap.fecha_inscripcion desc nulls last limit 1), a.licenciatura),
    coalesce(case when g.es_multigrado is false then g.grado::text end, a.grado_actual)
  from (
    select public._ra_uuid_v1(e ->> 'alumno_id') as alumno_id, public._ra_uuid_v1(e ->> 'grupo_id') as grupo_id
    from jsonb_array_elements(v_alumnos) e
  ) x
  join public.alumnos a on a.id = x.alumno_id
  left join public.grupos g on g.id = x.grupo_id
  on conflict (reporte_id, alumno_id) do update set
    grado_snapshot = case when reportes_academicos_alumnos.grupo_id is distinct from excluded.grupo_id
      then excluded.grado_snapshot else reportes_academicos_alumnos.grado_snapshot end,
    grupo_id = excluded.grupo_id;

  -- Grupos
  delete from public.reportes_academicos_grupos where reporte_id = v_id and not (grupo_id = any(v_ids_grupos));
  insert into public.reportes_academicos_grupos (
    reporte_id, grupo_id, alcance_alumnos, codigo_grupo_snapshot, carrera_snapshot, grado_snapshot, turno_snapshot)
  select v_id, g.id, x.alcance, g.codigo_grupo, c.nombre,
    case when g.es_multigrado then g.grado_inicio::text || '-' || g.grado_fin::text else g.grado::text end,
    g.turno
  from (
    select public._ra_uuid_v1(e ->> 'grupo_id') as grupo_id,
      coalesce(nullif(upper(btrim(coalesce(e ->> 'alcance_alumnos', ''))), ''), 'TODO_EL_GRUPO') as alcance
    from jsonb_array_elements(v_grupos) e
  ) x
  join public.grupos g on g.id = x.grupo_id
  left join public.planes_estudio pe on pe.id = g.plan_id
  left join public.carreras c on c.id = pe.carrera_id
  on conflict (reporte_id, grupo_id) do update set alcance_alumnos = excluded.alcance_alumnos;

  -- Docentes
  delete from public.reportes_academicos_docentes where reporte_id = v_id and not (docente_id = any(v_ids_docentes));
  insert into public.reportes_academicos_docentes (reporte_id, docente_id, nombre_docente_snapshot, clave_docente_snapshot)
  select v_id, d.id, d.nombre_completo, d.clave_legado
  from public.docentes d
  where d.id = any(v_ids_docentes)
  on conflict (reporte_id, docente_id) do nothing;

  -- Acta: se crea/actualiza o se elimina (la instantánea previa queda en la bitácora)
  if v_tiene_acta then
    insert into public.reportes_actas_hechos (
      reporte_id, nombre_institucion, titulo_documento, lugar, fecha_levantamiento, hora_inicio, hora_conclusion,
      empleado_levanta_id, empleado_levanta_nombre, empleado_levanta_cargo, testigos_json, relatoria_hechos, pruebas_anexos)
    values (
      v_id, v_institucion, v_titulo, v_lugar, v_fecha_lev, v_hora_ini, v_hora_fin,
      v_empleado_id, v_empleado_nombre, v_empleado_cargo, v_testigos, v_relatoria, v_pruebas)
    on conflict (reporte_id) do update set
      nombre_institucion = excluded.nombre_institucion, titulo_documento = excluded.titulo_documento,
      lugar = excluded.lugar, fecha_levantamiento = excluded.fecha_levantamiento,
      hora_inicio = excluded.hora_inicio, hora_conclusion = excluded.hora_conclusion,
      empleado_levanta_id = excluded.empleado_levanta_id,
      empleado_levanta_nombre = case when reportes_actas_hechos.empleado_levanta_id = excluded.empleado_levanta_id
        then reportes_actas_hechos.empleado_levanta_nombre else excluded.empleado_levanta_nombre end,
      empleado_levanta_cargo = excluded.empleado_levanta_cargo, testigos_json = excluded.testigos_json,
      relatoria_hechos = excluded.relatoria_hechos, pruebas_anexos = excluded.pruebas_anexos;
  else
    delete from public.reportes_actas_hechos where reporte_id = v_id;
  end if;

  -- Bitácora
  v_despues := public._ra_snapshot_v1(v_id);
  if v_es_edicion then
    if (v_antes - v_excluir_cambio) = (v_despues - v_excluir_cambio) then
      raise exception 'No hay cambios que guardar';
    end if;
    v_accion := case when (v_antes - v_excluir_estatus) = (v_despues - v_excluir_estatus)
      then 'CAMBIAR_ESTATUS' else 'EDITAR' end;
  else
    v_accion := 'CREAR';
  end if;
  insert into public.reportes_academicos_bitacora (reporte_id, accion, actor_uid, actor_rol, antes_json, despues_json)
  values (v_id, v_accion, v_uid, v_rol, v_antes, v_despues);

  return jsonb_build_object(
    'id', v_id,
    'folio', v_despues ->> 'folio',
    'revision', (v_despues ->> 'revision')::integer,
    'accion', v_accion,
    'reporte', v_despues);
end
$$;

-- ----------------------------------------------------------------------------
-- 4. Consulta enriquecida
-- ----------------------------------------------------------------------------
-- Filtros opcionales: ciclo_id, fecha_desde, fecha_hasta, carrera (texto o lista),
-- tipo_reporte (texto o lista), estatus (texto o lista), busqueda, alumno_id,
-- grupo_id, docente_id. alumno_id solo devuelve reportes con el alumno en
-- reportes_academicos_alumnos (un grupo reportado completo no aparece en la ficha).
create function public.consultar_reportes_academicos_v1(p_filtros jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_ciclo uuid;
  v_desde date;
  v_hasta date;
  v_carreras text[];
  v_tipos text[];
  v_estatus text[];
  v_busqueda text;
  v_alumno uuid;
  v_grupo uuid;
  v_docente uuid;
  v_total integer;
  v_reportes jsonb;
begin
  perform public._ra_rol_v1();
  if jsonb_typeof(v_f) <> 'object' then raise exception 'Los filtros deben enviarse como objeto'; end if;

  v_ciclo := public._ra_uuid_v1(v_f ->> 'ciclo_id');
  v_alumno := public._ra_uuid_v1(v_f ->> 'alumno_id');
  v_grupo := public._ra_uuid_v1(v_f ->> 'grupo_id');
  v_docente := public._ra_uuid_v1(v_f ->> 'docente_id');
  if (nullif(btrim(coalesce(v_f ->> 'ciclo_id', '')), '') is not null and v_ciclo is null)
    or (nullif(btrim(coalesce(v_f ->> 'alumno_id', '')), '') is not null and v_alumno is null)
    or (nullif(btrim(coalesce(v_f ->> 'grupo_id', '')), '') is not null and v_grupo is null)
    or (nullif(btrim(coalesce(v_f ->> 'docente_id', '')), '') is not null and v_docente is null) then
    raise exception 'Un identificador de filtro no es válido';
  end if;
  v_desde := public._ra_fecha_v1(v_f ->> 'fecha_desde', 'la fecha inicial');
  v_hasta := public._ra_fecha_v1(v_f ->> 'fecha_hasta', 'la fecha final');
  if v_desde is not null and v_hasta is not null and v_desde > v_hasta then
    raise exception 'La fecha inicial no puede ser posterior a la final';
  end if;
  v_carreras := array(select public._ra_normalizar_v1(x) from unnest(public._ra_textos_v1(v_f -> 'carrera')) x);
  v_tipos := array(select upper(x) from unnest(public._ra_textos_v1(v_f -> 'tipo_reporte')) x);
  v_estatus := array(select upper(x) from unnest(public._ra_textos_v1(v_f -> 'estatus')) x);
  v_busqueda := nullif(public._ra_normalizar_v1(v_f ->> 'busqueda'), '');

  with base as (
    select r.id, r.fecha_reporte, r.created_at, r.folio, c.nombre as ciclo_nombre,
      coalesce(to_jsonb(c) ->> 'tipo_periodo', to_jsonb(c) ->> 'tipo') as ciclo_tipo_periodo
    from public.reportes_academicos r
    join public.ciclos_escolares c on c.id = r.ciclo_id
    where (v_ciclo is null or r.ciclo_id = v_ciclo)
      and (v_desde is null or r.fecha_reporte >= v_desde)
      and (v_hasta is null or r.fecha_reporte <= v_hasta)
      and (cardinality(v_tipos) = 0 or r.tipo_reporte = any(v_tipos))
      and (cardinality(v_estatus) = 0 or r.estatus = any(v_estatus))
      and (v_alumno is null or exists (select 1 from public.reportes_academicos_alumnos a
        where a.reporte_id = r.id and a.alumno_id = v_alumno))
      and (v_grupo is null or exists (select 1 from public.reportes_academicos_grupos g
        where g.reporte_id = r.id and g.grupo_id = v_grupo))
      and (v_docente is null or exists (select 1 from public.reportes_academicos_docentes d
        where d.reporte_id = r.id and d.docente_id = v_docente))
      and (cardinality(v_carreras) = 0
        or exists (select 1 from public.reportes_academicos_alumnos a
          where a.reporte_id = r.id and public._ra_normalizar_v1(a.carrera_snapshot) = any(v_carreras))
        or exists (select 1 from public.reportes_academicos_grupos g
          where g.reporte_id = r.id and public._ra_normalizar_v1(g.carrera_snapshot) = any(v_carreras)))
      and (v_busqueda is null
        or strpos(public._ra_normalizar_v1(r.folio), v_busqueda) > 0
        or exists (select 1 from public.reportes_academicos_alumnos a where a.reporte_id = r.id
          and strpos(public._ra_normalizar_v1(coalesce(a.nombre_snapshot, '') || ' ' || coalesce(a.matricula_snapshot, '')), v_busqueda) > 0)
        or exists (select 1 from public.reportes_academicos_docentes d where d.reporte_id = r.id
          and strpos(public._ra_normalizar_v1(coalesce(d.nombre_docente_snapshot, '') || ' ' || coalesce(d.clave_docente_snapshot, '')), v_busqueda) > 0)
        or exists (select 1 from public.reportes_academicos_grupos g where g.reporte_id = r.id
          and strpos(public._ra_normalizar_v1(g.codigo_grupo_snapshot), v_busqueda) > 0))
  )
  select count(*)::integer,
    coalesce(jsonb_agg(public._ra_snapshot_v1(b.id)
      || jsonb_build_object('ciclo_nombre', b.ciclo_nombre, 'ciclo_tipo_periodo', b.ciclo_tipo_periodo)
      order by b.fecha_reporte desc, b.created_at desc, b.folio desc), '[]'::jsonb)
  into v_total, v_reportes
  from base b;

  return jsonb_build_object('total', v_total, 'reportes', v_reportes);
end
$$;

-- ----------------------------------------------------------------------------
-- 5. Seguridad: RLS, privilegios y ejecución
-- ----------------------------------------------------------------------------
alter table public.reportes_academicos enable row level security;
alter table public.reportes_academicos_alumnos enable row level security;
alter table public.reportes_academicos_grupos enable row level security;
alter table public.reportes_academicos_docentes enable row level security;
alter table public.reportes_actas_hechos enable row level security;
alter table public.reportes_academicos_bitacora enable row level security;

revoke all on public.reportes_academicos, public.reportes_academicos_alumnos, public.reportes_academicos_grupos,
  public.reportes_academicos_docentes, public.reportes_actas_hechos, public.reportes_academicos_bitacora
  from public, anon, authenticated;

-- Lectura directa opcional para los tres perfiles (la bitácora permanece privada).
grant select on public.reportes_academicos, public.reportes_academicos_alumnos, public.reportes_academicos_grupos,
  public.reportes_academicos_docentes, public.reportes_actas_hechos to authenticated;

create policy reportes_academicos_lectura_v1 on public.reportes_academicos
  for select to authenticated using ((select public._ra_lector_v1()));
create policy reportes_academicos_alumnos_lectura_v1 on public.reportes_academicos_alumnos
  for select to authenticated using ((select public._ra_lector_v1()));
create policy reportes_academicos_grupos_lectura_v1 on public.reportes_academicos_grupos
  for select to authenticated using ((select public._ra_lector_v1()));
create policy reportes_academicos_docentes_lectura_v1 on public.reportes_academicos_docentes
  for select to authenticated using ((select public._ra_lector_v1()));
create policy reportes_actas_hechos_lectura_v1 on public.reportes_actas_hechos
  for select to authenticated using ((select public._ra_lector_v1()));

revoke all on function public._ra_uuid_v1(text), public._ra_fecha_v1(text, text), public._ra_textos_v1(jsonb),
  public._ra_normalizar_v1(text), public._ra_rol_v1(), public._ra_snapshot_v1(uuid)
  from public, anon, authenticated;
revoke all on function public._ra_lector_v1() from public, anon;
grant execute on function public._ra_lector_v1() to authenticated;

revoke all on function public.guardar_reporte_academico_v1(jsonb), public.consultar_reportes_academicos_v1(jsonb)
  from public, anon;
grant execute on function public.guardar_reporte_academico_v1(jsonb), public.consultar_reportes_academicos_v1(jsonb)
  to authenticated;

commit;

