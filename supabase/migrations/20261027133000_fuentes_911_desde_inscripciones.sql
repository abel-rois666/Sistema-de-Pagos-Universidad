-- OPCIONAL, PREPARADA, NO EJECUTADA. Requiere Inscripciones por ciclo y base 911.
-- Solo copia fuentes seleccionadas y confirmadas por Control Escolar. Conserva las fuentes 911 existentes.
begin;
do $$ begin
 if to_regprocedure('public.ic_autorizado()') is null or to_regclass('public.s911_inscripciones') is null then raise exception 'Instala primero Inscripciones por ciclo y la base 911';end if;
end $$;
create function public.ic_acreditar_911(p_fuentes jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare f jsonb;ic public.inscripciones_ciclo;creadas integer=0;conservadas integer=0;
begin
 if not public.ic_autorizado() or not public.s911_autorizado(true) then raise exception 'Sin permiso para acreditar fuentes 911';end if;
 if jsonb_typeof(p_fuentes) is distinct from 'array' then raise exception 'Formato de fuentes inválido';end if;
 if jsonb_array_length(p_fuentes) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 fuentes';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_fuentes))<>jsonb_array_length(p_fuentes) then raise exception 'Inscripción repetida';end if;
 for f in select value from jsonb_array_elements(p_fuentes) order by value->>'id' loop
  select * into ic from public.inscripciones_ciclo where id=(f->>'id')::uuid for share;
  if not found or ic.revision is distinct from (f->>'revision')::integer then raise exception 'Una inscripción cambió. Actualiza y revisa antes de acreditar';end if;
  if ic.estado='CANCELADA' then raise exception 'Una inscripción anulada no se acredita como matrícula';end if;
  perform pg_advisory_xact_lock(hashtextextended(ic.alumno_programa_id::text||':'||ic.ciclo_id::text,911));
  if exists(select 1 from public.s911_inscripciones s where s.alumno_programa_id=ic.alumno_programa_id and s.ciclo_id=ic.ciclo_id) then
   conservadas=conservadas+1;
  else
   insert into public.s911_inscripciones(alumno_programa_id,ciclo_id,desde,hasta,tipo_ingreso,fecha_primer_ingreso,grado_personal,situacion,confirmado,evidencia)
   values(ic.alumno_programa_id,ic.ciclo_id,ic.desde,ic.hasta,ic.tipo_ingreso,ic.fecha_primer_ingreso,ic.grado_personal,'ACTIVO',true,
    ic.evidencia||' · Fuente: inscripción operativa '||ic.id::text||', revisión '||ic.revision::text||'. Confirmada para 911 por Control Escolar.');
   creadas=creadas+1;
  end if;
 end loop;
 insert into public.s911_auditoria(accion,datos) values('FUENTES_DESDE_INSCRIPCIONES',jsonb_build_object('creadas',creadas,'conservadas',conservadas,'referencias',p_fuentes));
 return jsonb_build_object('creadas',creadas,'conservadas',conservadas);
end $$;
revoke all on function public.ic_acreditar_911(jsonb) from public,anon;
grant execute on function public.ic_acreditar_911(jsonb) to authenticated;
commit;
