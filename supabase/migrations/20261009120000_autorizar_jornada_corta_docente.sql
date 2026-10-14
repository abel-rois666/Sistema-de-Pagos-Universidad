-- Aditiva: conserva todas las versiones y borradores existentes.
-- Ejecutar después de 20261007200000_publicar_horario_materias_continuas.sql.
begin;
set local lock_timeout = '5s';

alter table public.horarios_versiones
  add column if not exists excepciones_jornada_docente jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.horarios_versiones'::regclass
      and conname = 'horarios_versiones_excepciones_jornada_array') then
    alter table public.horarios_versiones
      add constraint horarios_versiones_excepciones_jornada_array
      check (jsonb_typeof(excepciones_jornada_docente) = 'array');
  end if;
end $$;

-- La función anterior permanece intacta para publicaciones sin excepciones.
-- Esta envoltura reutiliza sus validaciones y verifica las jornadas autorizadas
-- en la misma transacción, antes de confirmar la nueva versión.
create or replace function public.publicar_horario_academico_con_excepciones(
  p_ciclo_id uuid,
  p_grupos uuid[],
  p_cargas jsonb,
  p_sesiones jsonb,
  p_max_hueco_grupo integer,
  p_max_hueco_docente integer,
  p_min_horas_docente integer,
  p_excepciones jsonb
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_horario_id uuid;
  v_jornada record;
  v_excepcion record;
  v_horas integer;
  v_ciclo public.ciclos_escolares%rowtype;
  v_auditoria jsonb;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO') then
    raise exception 'No tiene permiso para publicar horarios';
  end if;
  if p_min_horas_docente is null or p_min_horas_docente not between 2 and 8
    or p_excepciones is null or jsonb_typeof(p_excepciones) <> 'array' then
    raise exception 'Las excepciones docentes no son válidas';
  end if;
  if jsonb_array_length(p_excepciones) = 0 or jsonb_array_length(p_excepciones) > 100 then
    raise exception 'Las excepciones docentes no son válidas';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_excepciones)
      as e(docente_id uuid, dia integer, motivo text)
    where e.docente_id is null or e.dia is null or e.dia not between 1 and 6
      or e.motivo is null or char_length(trim(e.motivo)) not between 10 and 500
  ) or exists (
    select 1 from jsonb_to_recordset(p_excepciones)
      as e(docente_id uuid, dia integer, motivo text)
    group by e.docente_id, e.dia having count(*) > 1
  ) then
    raise exception 'Cada excepción requiere docente, día y motivo único de 10 a 500 caracteres';
  end if;

  -- La publicación original comprueba además permisos, fechas, turnos,
  -- disponibilidad, empalmes, cargas, continuidad y límites semanales.
  v_horario_id := public.publicar_horario_academico(p_ciclo_id, p_grupos, p_cargas,
    p_sesiones, p_max_hueco_grupo, p_max_hueco_docente);
  select * into v_ciclo from public.ciclos_escolares where id = p_ciclo_id;

  for v_jornada in
    select distinct s.docente_id, s.dia_semana
    from public.horarios_sesiones s where s.horario_id = v_horario_id
  loop
    select count(distinct hora.h) into v_horas
    from public.horarios_sesiones s
    join public.horarios_versiones v on v.id = s.horario_id
    join public.ciclos_escolares c on c.id = v.ciclo_id
    cross join lateral generate_series(s.hora_inicio, s.hora_fin - 1) as hora(h)
    where s.docente_id = v_jornada.docente_id and s.dia_semana = v_jornada.dia_semana
      and (s.horario_id = v_horario_id or (v.estado = 'publicado'
        and c.fecha_inicio <= v_ciclo.fecha_termino
        and c.fecha_termino >= v_ciclo.fecha_inicio));
    if v_horas < p_min_horas_docente and (
      v_horas <> 1 or not exists (
        select 1 from jsonb_to_recordset(p_excepciones)
          as e(docente_id uuid, dia integer, motivo text)
        where e.docente_id = v_jornada.docente_id and e.dia = v_jornada.dia_semana
      )
    ) then
      raise exception 'Jornada docente del día % no autorizada o menor al mínimo configurado', v_jornada.dia_semana;
    end if;
  end loop;

  -- Rechaza autorizaciones sobrantes o que hayan quedado obsoletas durante la publicación.
  for v_excepcion in select * from jsonb_to_recordset(p_excepciones)
    as e(docente_id uuid, dia integer, motivo text)
  loop
    if not exists (
      select 1 from public.horarios_sesiones s
      where s.horario_id = v_horario_id and s.docente_id = v_excepcion.docente_id
        and s.dia_semana = v_excepcion.dia
    ) then raise exception 'La excepción docente no corresponde al horario publicado'; end if;
    select count(distinct hora.h) into v_horas
    from public.horarios_sesiones s
    join public.horarios_versiones v on v.id = s.horario_id
    join public.ciclos_escolares c on c.id = v.ciclo_id
    cross join lateral generate_series(s.hora_inicio, s.hora_fin - 1) as hora(h)
    where s.docente_id = v_excepcion.docente_id and s.dia_semana = v_excepcion.dia
      and (s.horario_id = v_horario_id or (v.estado = 'publicado'
        and c.fecha_inicio <= v_ciclo.fecha_termino
        and c.fecha_termino >= v_ciclo.fecha_inicio));
    if v_horas <> 1 then raise exception 'La jornada autorizada ya no tiene exactamente una hora'; end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'docente_id', e.docente_id, 'dia', e.dia, 'motivo', trim(e.motivo),
    'horas', 1, 'minimo_configurado', p_min_horas_docente,
    'autorizado_por', auth.uid(), 'autorizado_en', now()
  )), '[]'::jsonb) into v_auditoria
  from jsonb_to_recordset(p_excepciones)
    as e(docente_id uuid, dia integer, motivo text);
  update public.horarios_versiones
    set excepciones_jornada_docente = v_auditoria where id = v_horario_id;
  return v_horario_id;
end;
$$;

revoke all on function public.publicar_horario_academico_con_excepciones(
  uuid, uuid[], jsonb, jsonb, integer, integer, integer, jsonb) from public;
grant execute on function public.publicar_horario_academico_con_excepciones(
  uuid, uuid[], jsonb, jsonb, integer, integer, integer, jsonb) to authenticated;

commit;
