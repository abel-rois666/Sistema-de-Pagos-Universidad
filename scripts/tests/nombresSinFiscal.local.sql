-- PREPARADA, NO EJECUTADA. EXCLUSIVAMENTE base LOCAL, VACÍA, DESECHABLE y datos ficticios.
-- No ejecutar en Supabase. Reutiliza el montaje y las pruebas anteriores de nombres.
\set ON_ERROR_STOP on
\ir nombresPersonal.local.sql
\ir ../../supabase/migrations/20261110150000_revision_nombres_sin_validacion_fiscal.sql

insert into public.docentes(id,clave_legado,nombre_completo,rfc,curp,email,estatus) values
('70000000-0000-4000-8000-000000000001','PF7001','HISTÓRICO UNO','RFC INCOMPLETO','CURP HISTÓRICA','CORREO ANTERIOR','activo'),
('70000000-0000-4000-8000-000000000002','PF7002','HISTÓRICO DOS','RFC INCOMPLETO',null,'','inactivo');

do $$declare lote jsonb;r jsonb;f jsonb;antes jsonb;repetido boolean;cuenta integer;
begin
  select jsonb_agg(jsonb_build_object('docente_id',d.id,'revision',0,'original',public._personal_fuente_v1('DOCENTE',d.id)->'original',
    'revisado',true,'nombres',case when d.clave_legado='PF7001' then 'UNO' else 'DOS' end,'apellido_paterno','REVISADO','apellido_materno','')) into lote
    from public.docentes d where d.clave_legado in ('PF7001','PF7002');
  select jsonb_agg(to_jsonb(d)-array['nombre_completo','persona_id'] order by d.id) into antes
    from public.docentes d where d.clave_legado in ('PF7001','PF7002');
  -- La segunda fila inválida revierte incluso la creación de identidad de la primera.
  repetido=false;
  begin perform public.personal_nombres_revisar_lote_v1(jsonb_set(lote,'{1,nombres}','""'::jsonb),'Lote inválido ficticio');
  exception when others then repetido=true;end;
  perform public.ensayo_exigir(repetido and not exists(select 1 from public.docentes where clave_legado in ('PF7001','PF7002') and persona_id is not null),'lote inválido sin residuos');
  r=public.personal_nombres_revisar_lote_v1(lote,'Nombres cotejados ficticios');
  perform public.ensayo_exigir(r->>'revisados'='2','dos UUID con mismo RFC se revisan independientemente');
  perform public.ensayo_exigir(antes=(select jsonb_agg(to_jsonb(d)-array['nombre_completo','persona_id'] order by d.id) from public.docentes d where d.clave_legado in ('PF7001','PF7002')),'fiscal y contacto originales exactos');
  perform public.ensayo_exigir((select count(*)=2 from public.personal_auditoria a join public.docentes d on d.persona_id=a.persona_id where d.clave_legado in ('PF7001','PF7002') and a.seccion='nombres'),'auditoría de cada docente');
  repetido=false;begin perform public.personal_nombres_revisar_lote_v1(lote,'Reintento obsoleto ficticio');exception when sqlstate '40001' then repetido=true;end;
  perform public.ensayo_exigir(repetido,'reintento obsoleto bloqueado');
  -- El formulario general sigue rechazando cambiar/guardar RFC inválido.
  f=public.personal_consultar_v2('DOCENTE','70000000-0000-4000-8000-000000000001');repetido=false;
  begin perform public.personal_guardar_v1('DOCENTE','70000000-0000-4000-8000-000000000001',(f->>'revision')::integer,f->'original','generales',jsonb_build_object('datos',f->'datos','nombre_revisado',true,'docente',jsonb_build_object('clave_legado','PF7001','estatus','activo')),'Formulario general ficticio');
  exception when others then repetido=sqlerrm='Revisa el formato del RFC';end;
  perform public.ensayo_exigir(repetido,'validación fiscal general conservada');
  -- Inyectar fiscal fuera del testigo no es una operación de nombres permitida.
  lote=jsonb_build_array((lote->0)||jsonb_build_object('original',f->'original','revision',(f->>'revision')::integer,'rfc','RFC INYECTADO'));
  repetido=false;begin perform public.personal_nombres_revisar_lote_v1(lote,'Inyección ficticia bloqueada');exception when others then repetido=true;end;
  perform public.ensayo_exigir(repetido,'lista cerrada de campos');
  raise notice 'Preparado: nominal con fiscal histórico, UUID, atomicidad, concurrencia, auditoría y validación general';
end $$;

-- Persona ya compartida: actualizar únicamente nombres y conservar incluso vacíos/fuentes diferentes.
do $$declare p uuid;f jsonb;e_antes jsonb;d_antes jsonb;datos_antes jsonb;lote jsonb;rechazado boolean;
begin
  perform set_config('app.personal_operacion','v1',true);
  insert into public.personal_personas(datos) values('{"nombre_completo":"COMPARTIDO HISTÓRICO","rfc":"","curp":"CURP HISTÓRICA","email":"CORREO ANTERIOR","fecha_nacimiento":"FECHA POR REVISAR","adicional":"CONSERVAR"}') returning id into p;
  insert into public.docentes(id,clave_legado,nombre_completo,rfc,email,estatus,persona_id) values('70000000-0000-4000-8000-000000000003','PF7003','COMPARTIDO HISTÓRICO','RFC DOCENTE','','activo',p);
  insert into public.empleados(id,nombres,apellido_paterno,rfc,fecha_nacimiento,persona_id) values('70000000-0000-4000-8000-000000000004','ANTERIOR','COMPARTIDO','RFC ADMINISTRATIVO','1980-01-01',p);
  select to_jsonb(e)-array['nombres','apellido_paterno','apellido_materno'] into e_antes from public.empleados e where persona_id=p;
  select to_jsonb(d)-'nombre_completo' into d_antes from public.docentes d where persona_id=p;
  select datos-array['nombres','apellido_paterno','apellido_materno','nombre_completo'] into datos_antes from public.personal_personas where id=p;
  f=public.personal_consultar_v2('DOCENTE','70000000-0000-4000-8000-000000000003');
  lote=jsonb_build_array(jsonb_build_object('docente_id','70000000-0000-4000-8000-000000000003','revision',(f->>'revision')::integer,'original',f->'original','revisado',true,'nombres','ANA MARÍA','apellido_paterno','DE LA CRUZ','apellido_materno',null));
  perform public.personal_nombres_revisar_lote_v1(lote,'Identidad compartida cotejada');
  perform public.ensayo_exigir(e_antes=(select to_jsonb(e)-array['nombres','apellido_paterno','apellido_materno'] from public.empleados e where persona_id=p),'datos administrativos conservados exactamente');
  perform public.ensayo_exigir(d_antes=(select to_jsonb(d)-'nombre_completo' from public.docentes d where persona_id=p),'datos docentes conservados exactamente');
  perform public.ensayo_exigir(datos_antes=(select datos-array['nombres','apellido_paterno','apellido_materno','nombre_completo'] from public.personal_personas where id=p),'JSON no nominal conservado, sin convertir fecha histórica');
  perform public.ensayo_exigir((select nombres='ANA MARÍA' and apellido_paterno='DE LA CRUZ' from public.empleados where persona_id=p),'nombre compartido reflejado');
  update public.usuarios set rol='COORDINADOR RECURSOS HUMANOS';rechazado=false;
  begin perform public.personal_nombres_revisar_lote_v1(lote,'Intento sin permiso');exception when insufficient_privilege then rechazado=true;end;
  perform public.ensayo_exigir(rechazado,'RH no adquiere escritura por esta corrección');
  update public.usuarios set rol='ADMINISTRADOR';
end $$;
