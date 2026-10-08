-- Aditiva: no modifica datos existentes ni elimina objetos. Ejecutar después de las dos
-- migraciones de horarios. Revisar primero checks/preflight_max_horas_docente.sql.
begin;

alter table public.docente_configuraciones_horario
  add column if not exists max_horas_semanales integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'docente_config_horas_maximas_validas'
    and conrelid = 'public.docente_configuraciones_horario'::regclass) then
    alter table public.docente_configuraciones_horario
      add constraint docente_config_horas_maximas_validas
      check (max_horas_semanales is null or max_horas_semanales between 1 and 84);
  end if;
end $$;

-- La versión publicada se inserta antes de las cargas. Este disparador valida cada
-- carga dentro de la misma transacción, incluidos los otros ciclos superpuestos.
create or replace function public.validar_max_horas_docente_horario()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_ciclo_id uuid;
  v_inicio date;
  v_termino date;
  v_limite integer;
  v_horas integer;
  v_nombre text;
begin
  if new.horas_presenciales is null or new.horas_presenciales < 0 then
    raise exception 'Las horas presenciales de una carga no pueden ser negativas ni nulas';
  end if;
  if new.docente_id is null or new.horas_presenciales = 0 then
    return new;
  end if;
  select v.ciclo_id, c.fecha_inicio, c.fecha_termino
    into v_ciclo_id, v_inicio, v_termino
    from public.horarios_versiones v
    join public.ciclos_escolares c on c.id = v.ciclo_id
    where v.id = new.horario_id and v.estado = 'publicado';
  if not found then return new; end if;

  -- La función de publicación usa la misma llave: también serializa escrituras directas.
  perform pg_advisory_xact_lock(hashtext('horarios_academicos_publicacion'));

  select min(cfg.max_horas_semanales) into v_limite
    from public.docente_configuraciones_horario cfg
    join public.ciclos_escolares c on c.id = cfg.ciclo_id
    where cfg.docente_id = new.docente_id
      and (cfg.ciclo_id = v_ciclo_id or exists (
        select 1 from public.horarios_versiones v
        join public.horarios_cargas carga on carga.horario_id = v.id
        where v.ciclo_id = cfg.ciclo_id and v.estado = 'publicado'
          and carga.docente_id = new.docente_id and carga.horas_presenciales > 0
      ))
      and (cfg.ciclo_id = v_ciclo_id or c.fecha_inicio is null or c.fecha_termino is null
        or v_inicio is null or v_termino is null
        or (c.fecha_inicio <= v_termino and c.fecha_termino >= v_inicio));
  if v_limite is null then return new; end if;

  select coalesce(sum(carga.horas_presenciales), 0) into v_horas
    from public.horarios_cargas carga
    join public.horarios_versiones v on v.id = carga.horario_id
    join public.ciclos_escolares c on c.id = v.ciclo_id
    where carga.docente_id = new.docente_id and v.estado = 'publicado'
      and (v.ciclo_id = v_ciclo_id or c.fecha_inicio is null or c.fecha_termino is null
        or v_inicio is null or v_termino is null
        or (c.fecha_inicio <= v_termino and c.fecha_termino >= v_inicio))
      and (tg_op <> 'UPDATE' or carga.id <> new.id);
  if v_horas + new.horas_presenciales > v_limite then
    select nombre_completo into v_nombre from public.docentes where id = new.docente_id;
    raise exception 'El docente % sumaría % horas presenciales semanales; el máximo aplicable es %',
      coalesce(v_nombre, new.docente_id::text), v_horas + new.horas_presenciales, v_limite;
  end if;
  return new;
end;
$$;

revoke all on function public.validar_max_horas_docente_horario() from public;

do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.horarios_cargas'::regclass
    and tgname = 'trg_horarios_cargas_max_horas_docente' and not tgisinternal) then
    create trigger trg_horarios_cargas_max_horas_docente
      before insert or update of docente_id, horas_presenciales, horario_id
      on public.horarios_cargas for each row
      execute function public.validar_max_horas_docente_horario();
  end if;
end $$;

commit;
