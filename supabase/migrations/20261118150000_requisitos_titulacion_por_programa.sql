-- PREPARADA; probada solo en base local ficticia, no instalada en Supabase.
-- Leer docs/REQUISITOS_TITULACION.md antes de instalar.
begin;
-- La función de guardado se incorpora al final con una comprobación de versión.
alter table public.ficha_titulacion
 add column plan_pago_requisito_id uuid references public.planes_pago(id) on delete restrict,
 add column servicio_social_requisito_id uuid references public.servicio_social(id) on delete restrict,
 add column requisitos_verificados jsonb;
create index titulacion_fuente_pago on public.ficha_titulacion(plan_pago_requisito_id);
create index titulacion_fuente_ss on public.ficha_titulacion(servicio_social_requisito_id);
create unique index titulacion_pago_un_programa on public.ficha_titulacion(plan_pago_requisito_id) where archivado_en is null;
create unique index titulacion_ss_un_programa on public.ficha_titulacion(servicio_social_requisito_id) where archivado_en is null;

create function public._titulacion_estado_pago_v1(p_texto text) returns text
language plpgsql immutable set search_path=pg_catalog,public as $$
declare t text;medio text;comprobante text;
begin
 t=regexp_replace(btrim(translate(upper(coalesce(p_texto,'')),'ÁÉÍÓÚÜÑ','AEIOUUN')),'\s+',' ','g');
 if t='' or t ~ '\m(NO\s+PAGADO|PENDIENTE|CANCELADO|BAJA|ABONO|RESTA)\M' then return 'pendiente';end if;
 if t ~ '^(PAGADO|LIQUIDADO)(\M|$)' then return 'pagado';end if;
 medio='(EFECTIVO|DEPOSITO( BANCARIO)?|TRANSFERENCIA( BANCARIA)?|TARJETA( DE)? (DEBITO|CREDITO))';
 comprobante='[RF]-\d+(\s*\(('||medio||'|PAGADO( \$\s*[\d,.]+| CON BECA))\))?';
 if t ~ ('^'||comprobante||'(\s*[;,]\s*'||comprobante||')*$') then return 'pagado';end if;
 return 'revisar';
end $$;
revoke all on function public._titulacion_estado_pago_v1(text) from public,anon,authenticated;

create function public._titulacion_requisitos_v1(p_alumno uuid,p_programa uuid,p_pago uuid,p_ss uuid,p_bloquear boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare pr public.alumno_programas;minima numeric;esp boolean;cert public.ficha_certificacion;
 total_ing integer;aprobadas_ing integer;total_prom integer;con_nota integer;media numeric;total_plan integer;
 ss_id uuid=p_ss;ss_estado text='SIN_INICIAR';pago_estado text='SIN_INICIAR';pago_revision boolean=false;
 estados jsonb;total integer=0;pagados integer=0;fila record;importe numeric;hay_vinculos boolean;estado text;
begin
 select * into pr from public.alumno_programas where id=p_programa and alumno_id=p_alumno;
 if pr.id is null then raise exception 'Selecciona un programa del alumno';end if;
 select coalesce(nullif(to_jsonb(c)->>'calificacion_minima_aprobatoria','')::numeric,nullif(to_jsonb(c)->>'calificacion_minima','')::numeric,6),upper(c.nivel_educativo)='ESPECIALIDAD'
 into minima,esp from public.planes_estudio e join public.carreras c on c.id=e.carrera_id where e.id=pr.plan_id;
 if minima is null or minima<=0 or minima>10 then raise exception 'Revisa la calificación mínima de la carrera';end if;
 if p_bloquear then
  perform id from public.asignaturas where plan_id=pr.plan_id for share;
  perform h.id from public.inscripciones_academicas h join public.asignaturas a on a.id=h.asignatura_id where h.alumno_id=p_alumno and a.plan_id=pr.plan_id for share of h;
  perform id from public.ficha_certificacion where alumno_programa_id=p_programa for share;
 end if;
 select * into cert from public.ficha_certificacion where alumno_id=p_alumno and alumno_programa_id=p_programa and archivado_en is null and tipo_certificado='TOTAL' order by created_at desc limit 1;
 -- Mejor nota por asignatura, como el historial: incluye reprobadas; NP=-555 se representa como cero.
 -- Inglés/complementarias se excluyen del promedio. No se mezclan planes ni intentos duplicados.
 with materias as (
  select a.id,a.nombre,coalesce(a.clasificacion_clave,'') clave,
   lower(coalesce(a.clasificacion_nombre,'')) clasificacion,
   upper(translate(btrim(a.nombre),'áéíóúÁÉÍÓÚ','aeiouAEIOU')) ~ '^INGLES\M' ingles,
   (select max(case when h.calificacion_final=-555 then 0 else h.calificacion_final end)
    from public.inscripciones_academicas h where h.alumno_id=p_alumno and h.asignatura_id=a.id
    and (h.calificacion_final between 0 and 10 or h.calificacion_final=-555)) nota
  from public.asignaturas a where a.plan_id=pr.plan_id and a.activo is not false
 ), computables as (
  select *,not ingles and clave<>'266' and (clave in ('263','264') or (clave='' and clasificacion<>'complementaria')) promedio from materias
 ) select count(*),count(*) filter(where ingles),count(*) filter(where ingles and nota>=minima),
 count(*) filter(where promedio and (clave<>'264' or nota is not null)),count(*) filter(where promedio and nota is not null),trunc(avg(nota) filter(where promedio),2)
 into total_plan,total_ing,aprobadas_ing,total_prom,con_nota,media from computables;

 -- Solo puede sugerirse automáticamente un SS global cuando no hay otra carrera posible.
 if ss_id is null and not coalesce(esp,false) and (select count(*) from public.alumno_programas where alumno_id=p_alumno)=1
   and (select count(*) from public.servicio_social where alumno_id=p_alumno)=1 then
  select id into ss_id from public.servicio_social where alumno_id=p_alumno;
 end if;
 if ss_id is not null then
  if p_bloquear then perform id from public.servicio_social where id=ss_id for share;end if;
  select case when estatus='LIBERADO' then 'COMPLETADO' else 'EN_CURSO' end into ss_estado from public.servicio_social where id=ss_id and alumno_id=p_alumno;
  if not found then raise exception 'El servicio social no pertenece al alumno';end if;
  if exists(select 1 from public.ficha_titulacion where alumno_programa_id<>p_programa and servicio_social_requisito_id=ss_id and archivado_en is null) then raise exception 'Ese servicio social ya respalda otro programa; requiere revisión individual';end if;
 end if;
 if p_pago is not null then
  if p_bloquear then
   perform id from public.planes_pago where id=p_pago for share;
   perform id from public.planes_pago_detalles where plan_id=p_pago for share;
   perform v.id from public.planes_pago_vinculos_recibo v where v.plan_id=p_pago for share;
   perform r.id from public.recibos r join public.recibos_detalles d on d.recibo_id=r.id join public.planes_pago_vinculos_recibo v on v.recibo_detalle_id=d.id where v.plan_id=p_pago for share of r;
  end if;
  if not exists(select 1 from public.planes_pago where id=p_pago and alumno_id=p_alumno and tipo_plan='Titulación') then raise exception 'Selecciona un plan de Titulación del alumno';end if;
  if exists(select 1 from public.ficha_titulacion where alumno_programa_id<>p_programa and plan_pago_requisito_id=p_pago and archivado_en is null) then raise exception 'El plan de titulación ya respalda otro programa';end if;
  for fila in
   select d.indice_concepto indice,d.concepto,d.cantidad,d.estatus from public.planes_pago_detalles d where d.plan_id=p_pago
   union all
   select i,to_jsonb(p)->>('concepto_'||i),nullif(to_jsonb(p)->>('cantidad_'||i),'')::numeric,to_jsonb(p)->>('estatus_'||i)
    from public.planes_pago p cross join generate_series(1,18) i where p.id=p_pago and not exists(select 1 from public.planes_pago_detalles where plan_id=p_pago)
  loop
   if coalesce(btrim(fila.concepto),'') in ('','0') then continue;end if;
   total=total+1;
   select count(*)>0,coalesce(sum(v.importe) filter(where r.estatus='ACTIVO' and v.anulado_en is null),0) into hay_vinculos,importe
    from public.planes_pago_vinculos_recibo v join public.recibos_detalles d on d.id=v.recibo_detalle_id join public.recibos r on r.id=d.recibo_id
    where v.plan_id=p_pago and v.indice_concepto=fila.indice;
   estado=public._titulacion_estado_pago_v1(fila.estatus);
   if hay_vinculos then
    if fila.cantidad>0 and importe>=fila.cantidad then pagados=pagados+1;end if;
   elsif estado='pagado' then pagados=pagados+1;
   elsif estado='revisar' then pago_revision=true;end if;
  end loop;
  if total>0 then pago_estado=case when total=pagados and not pago_revision then 'COMPLETADO' else 'EN_CURSO' end;end if;
 end if;
 estados=jsonb_build_object('certificado_estudios',case when cert.id is null then 'SIN_INICIAR' when cert.tramite_completado then 'TRAMITADO' else 'EN_TRAMITE' end,
  'ingles',case when total_plan>0 and aprobadas_ing=total_ing then 'COMPLETADO' when aprobadas_ing>0 then 'EN_CURSO' else 'SIN_INICIAR' end,
  'servicio_social_req',ss_estado,'pago_titulacion',pago_estado,
  'promedio_alto_rendimiento',case when total_prom=0 or con_nota<total_prom then 'SIN_INICIAR' when media>=9.50 then 'APLICA' else 'NO_APLICA' end);
 return jsonb_build_object('estados',estados,'alumno_id',p_alumno,'alumno_programa_id',p_programa,'plan_id',pr.plan_id,'plan_pago_id',p_pago,'servicio_social_id',ss_id,'certificacion_id',cert.id,
  'ingles_total',total_ing,'ingles_aprobadas',aprobadas_ing,'materias_plan',total_plan,'promedio',media,'materias_promedio',total_prom,'materias_con_nota',con_nota,
  'pago_revisar',pago_revision,'pago_conceptos',total,'pago_pagados',pagados,'verificado_en',now(),'criterio_promedio','>=9.50');
end $$;
revoke all on function public._titulacion_requisitos_v1(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;

create function public.titulacion_requisitos_v1(p_alumno uuid,p_programa uuid,p_pago uuid default null,p_ss uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;
begin
 perform public._titulacion_autorizar_v1(false);
 r=public._titulacion_requisitos_v1(p_alumno,p_programa,p_pago,p_ss);
 return r||jsonb_build_object('planes_pago',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'folio',p.no_plan_pagos,'licenciatura',p.licenciatura,'ciclo',c.nombre,'tipo_periodo',c.tipo_periodo) order by c.nombre desc,p.no_plan_pagos,p.id) from public.planes_pago p join public.ciclos_escolares c on c.id=p.ciclo_id where p.alumno_id=p_alumno and p.tipo_plan='Titulación'),'[]'::jsonb),
 'servicios_sociales',coalesce((select jsonb_agg(jsonb_build_object('id',id,'empresa',nombre_empresa,'estado',estatus,'fecha',fecha_inicio) order by fecha_inicio desc,id) from public.servicio_social where alumno_id=p_alumno),'[]'::jsonb));
end $$;
revoke all on function public.titulacion_requisitos_v1(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.titulacion_requisitos_v1(uuid,uuid,uuid,uuid) to authenticated;


-- No sustituir una función instalada diferente de la base revisada.
do $guard$ begin
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.oid=to_regprocedure('public.titulacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text)')
   and md5(btrim(replace(p.prosrc,E'\r',''),E' \n\t'))= '9c2be376908ca437e2818ff17888c92d') then
  raise exception 'La función de titulación instalada difiere de la base revisada. Ejecuta preflight_requisitos_titulacion.sql antes de sustituirla.';
 end if;
end $guard$;
create or replace function public.titulacion_guardar_v1(p_alumno uuid,p_programa uuid,p_id uuid,p_revision integer,p_datos jsonb,p_accion text,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_titulacion;n public.ficha_titulacion;pr public.alumno_programas;esp boolean;skip boolean;requisitos boolean;k text;verificados jsonb;
begin
 perform public._titulacion_autorizar_v1(true);
 if p_accion not in ('GUARDAR','COMPLETAR','REABRIR','ARCHIVAR') or p_accion is null or length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Revisa la acción y su motivo';end if;
 perform id from public.alumnos where id=p_alumno for update;
 select * into pr from public.alumno_programas where id=p_programa and alumno_id=p_alumno for update;
 if pr.id is null then raise exception 'Selecciona un programa del alumno';end if;
 if p_id is not null then
 select * into f from public.ficha_titulacion where id=p_id and alumno_id=p_alumno and alumno_programa_id=p_programa and archivado_en is null for update;
 if f.id is null or f.revision is distinct from p_revision then raise exception 'La ficha cambió. Consulta y revisa antes de guardar' using errcode='40001';end if;
 else
 if p_accion<>'GUARDAR' or exists(select 1 from public.ficha_titulacion where alumno_id=p_alumno and alumno_programa_id is null and archivado_en is null) then raise exception 'Asocia primero la ficha anterior pendiente';end if;
 end if;
 if p_accion='GUARDAR' and f.tramite_completado then raise exception 'Reabre el trámite antes de editar';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos';end if;
 for k in select jsonb_object_keys(p_datos) loop
 if k not in ('modalidad','pago_titulacion','certificado_estudios','ingles','servicio_social_req','fotografias','doc_antecedente','doc_antecedente_nota','doc_acta_nacimiento','doc_acta_nacimiento_nota','doc_curp','doc_curp_nota','doc_titulo_profesional','doc_titulo_profesional_nota','doc_cedula_profesional','doc_cedula_profesional_nota','promedio_alto_rendimiento','fecha_inicio_tramite','fecha_estimada_culminacion','enlace_drive','libro','foja','folio_control','fecha_examen','fecha_exencion','plan_pago_requisito_id','servicio_social_requisito_id') then raise exception 'Campo no permitido: %',k;end if;end loop;
 if f.id is null then insert into public.ficha_titulacion(alumno_id,alumno_programa_id) values(p_alumno,p_programa) returning * into f;end if;
 n=jsonb_populate_record(f,p_datos);
 if p_accion in ('GUARDAR','COMPLETAR') then
  verificados=public._titulacion_requisitos_v1(p_alumno,p_programa,n.plan_pago_requisito_id,n.servicio_social_requisito_id,true);
  n=jsonb_populate_record(n,verificados->'estados');
  n.servicio_social_requisito_id=(verificados->>'servicio_social_id')::uuid;
  n.requisitos_verificados=verificados;
 end if;
 if n.pago_titulacion not in ('SIN_INICIAR','EN_CURSO','COMPLETADO') or n.certificado_estudios not in ('SIN_INICIAR','EN_TRAMITE','TRAMITADO') then raise exception 'Estado de pago o certificado inválido';end if;
 if n.libro<0 or n.foja<0 then raise exception 'Libro y foja deben ser no negativos';end if;
 if n.fecha_examen is not null and n.fecha_exencion is not null then raise exception 'Elige examen o exención, no ambos';end if;
 if n.fecha_examen<n.fecha_inicio_tramite or n.fecha_exencion<n.fecha_inicio_tramite then raise exception 'La fecha del acta no puede preceder al trámite';end if;
 if n.fecha_inicio_tramite>n.fecha_estimada_culminacion then raise exception 'La fecha inicial supera la final';end if;
 if coalesce(n.modalidad,'')='' then raise exception 'Selecciona una modalidad';end if;
 select upper(c.nivel_educativo)='ESPECIALIDAD' into esp from public.planes_estudio e join public.carreras c on c.id=e.carrera_id where e.id=pr.plan_id;
 skip=coalesce(esp,false) and n.modalidad in ('TESINA','ALTO RENDIMIENTO ACADÉMICO');
 requisitos=(n.modalidad<>'ALTO RENDIMIENTO ACADÉMICO' or n.promedio_alto_rendimiento='APLICA') and n.pago_titulacion='COMPLETADO' and n.certificado_estudios='TRAMITADO' and n.fotografias='ENTREGADAS' and n.doc_antecedente='APROBADO' and n.doc_acta_nacimiento='APROBADO' and n.doc_curp='APROBADO' and (skip or (n.ingles='COMPLETADO' and n.servicio_social_req='COMPLETADO')) and (not skip or (n.doc_titulo_profesional='APROBADO' and n.doc_cedula_profesional='APROBADO'));
 if p_accion='COMPLETAR' then
 if f.tramite_completado then raise exception 'El trámite ya está completado';end if;
 if (upper(n.modalidad) like '%TESIS%' or upper(n.modalidad) like '%TESINA%') and n.fecha_examen is null then raise exception 'Registra la fecha de examen';end if;
 if not (upper(n.modalidad) like '%TESIS%' or upper(n.modalidad) like '%TESINA%') and n.fecha_exencion is null then raise exception 'Registra la fecha de exención';end if;
 if not coalesce(requisitos,false) or n.libro is null or n.foja is null or coalesce(n.folio_control,'')='' or (n.fecha_examen is null and n.fecha_exencion is null) then raise exception 'Faltan requisitos o datos del acta';end if;
 if not exists(select 1 from public.ficha_certificacion c where c.alumno_programa_id=p_programa and c.archivado_en is null and c.tramite_completado and c.tipo_certificado='TOTAL') then raise exception 'El certificado de este programa no está completado';end if;
 n.tramite_completado=true;n.fecha_completado=now();
 update public.alumno_programas set estatus='TITULADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=now() where id=p_programa;
 elsif p_accion='REABRIR' then
 if not f.tramite_completado then raise exception 'El trámite no está completado';end if;
 n.tramite_completado=false;n.fecha_completado=null;
 update public.alumno_programas set estatus='EGRESADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=now() where id=p_programa and estatus='TITULADO';
 elsif p_accion='ARCHIVAR' then
 if f.tramite_completado or f.libro is not null or f.foja is not null or f.fecha_examen is not null or f.fecha_exencion is not null then raise exception 'La ficha tiene acta o trámite concluido: requiere revisión individual';end if;n.archivado_en=now();
 elsif coalesce(requisitos,false) then
 update public.alumno_programas set estatus='EGRESADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=now() where id=p_programa and estatus in ('CURSANDO','ACTIVO');
 end if;
 n.revision=f.revision+1;n.updated_at=now();
 -- Lista explícita: el JSON nunca puede escribir identidad, revisión o asociación.
 update public.ficha_titulacion set plan_pago_requisito_id=n.plan_pago_requisito_id,servicio_social_requisito_id=n.servicio_social_requisito_id,requisitos_verificados=n.requisitos_verificados,modalidad=n.modalidad,pago_titulacion=n.pago_titulacion,certificado_estudios=n.certificado_estudios,ingles=n.ingles,servicio_social_req=n.servicio_social_req,fotografias=n.fotografias,doc_antecedente=n.doc_antecedente,doc_antecedente_nota=n.doc_antecedente_nota,doc_acta_nacimiento=n.doc_acta_nacimiento,doc_acta_nacimiento_nota=n.doc_acta_nacimiento_nota,doc_curp=n.doc_curp,doc_curp_nota=n.doc_curp_nota,doc_titulo_profesional=n.doc_titulo_profesional,doc_titulo_profesional_nota=n.doc_titulo_profesional_nota,doc_cedula_profesional=n.doc_cedula_profesional,doc_cedula_profesional_nota=n.doc_cedula_profesional_nota,promedio_alto_rendimiento=n.promedio_alto_rendimiento,fecha_inicio_tramite=n.fecha_inicio_tramite,fecha_estimada_culminacion=n.fecha_estimada_culminacion,enlace_drive=n.enlace_drive,libro=n.libro,foja=n.foja,folio_control=n.folio_control,fecha_examen=n.fecha_examen,fecha_exencion=n.fecha_exencion,tramite_completado=n.tramite_completado,fecha_completado=n.fecha_completado,revision=n.revision,archivado_en=n.archivado_en,updated_at=n.updated_at where id=f.id;
 insert into public.titulacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(f.id,auth.uid(),p_accion,p_motivo,to_jsonb(f),to_jsonb(n));
 return to_jsonb(n);
end $$;

commit;
