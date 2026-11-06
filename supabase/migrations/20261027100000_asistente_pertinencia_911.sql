-- Preparada, no ejecutada. Aplicar después de 20261026120000_corte_personalizado_911.sql.
-- Conserva catálogo, 16 identidades, versiones cerradas y permisos operativos.
begin;
do $$ begin
 if to_regprocedure('public.s911_validar_corte(jsonb,boolean)') is null then raise exception 'Falta la actualización de corte personalizado 911';end if;
end $$;
create or replace function public.s911_instancia_aplica(p_i jsonb) returns boolean
language sql immutable set search_path=public,pg_temp as $$
 select p_i->>'cuestionario' not in('carrera','posgrado') or coalesce(p_i#>>'{correspondencia,aplica}','APLICA')<>'NO_APLICA'
$$;
create or replace function public.s911_criterios_pertinencia() returns jsonb
language sql immutable set search_path=public,pg_temp as $$ select $criterios911${"version":"guia-911-2026-2027-v1","criterios":{"escuela:V873":{"niveles":["TSU"],"modalidad":null},"escuela:V874":{"niveles":["TSU"],"modalidad":null},"escuela:V875":{"niveles":["TSU"],"modalidad":null},"escuela:V876":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V877":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V878":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V879":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V880":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V881":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V882":{"niveles":["TSU"],"modalidad":null},"escuela:V883":{"niveles":["TSU"],"modalidad":null},"escuela:V884":{"niveles":["TSU"],"modalidad":null},"escuela:V885":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V886":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V887":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V888":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V889":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V890":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V891":{"niveles":["TSU"],"modalidad":null},"escuela:V892":{"niveles":["TSU"],"modalidad":null},"escuela:V893":{"niveles":["TSU"],"modalidad":null},"escuela:V894":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V895":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V896":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V897":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V898":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V899":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V900":{"niveles":["TSU"],"modalidad":null},"escuela:V901":{"niveles":["TSU"],"modalidad":null},"escuela:V902":{"niveles":["TSU"],"modalidad":null},"escuela:V903":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V904":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V905":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V906":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V907":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V908":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V909":{"niveles":["TSU"],"modalidad":null},"escuela:V910":{"niveles":["TSU"],"modalidad":null},"escuela:V911":{"niveles":["TSU"],"modalidad":null},"escuela:V912":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V913":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V914":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V915":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V916":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V917":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V918":{"niveles":["TSU"],"modalidad":null},"escuela:V919":{"niveles":["TSU"],"modalidad":null},"escuela:V920":{"niveles":["TSU"],"modalidad":null},"escuela:V921":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V922":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V923":{"niveles":["LICENCIATURA"],"modalidad":null},"escuela:V924":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V925":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V926":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":null},"escuela:V213":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V214":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V217":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V218":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V219":{"niveles":["ESPECIALIDAD"],"modalidad":"ESCOLAR"},"escuela:V220":{"niveles":["ESPECIALIDAD"],"modalidad":"ESCOLAR"},"escuela:V221":{"niveles":["MAESTRIA"],"modalidad":"ESCOLAR"},"escuela:V222":{"niveles":["MAESTRIA"],"modalidad":"ESCOLAR"},"escuela:V223":{"niveles":["DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V224":{"niveles":["DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V927":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V928":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V929":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V741":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V742":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V743":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V744":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V745":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V462":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V930":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V931":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V932":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V746":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V747":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V748":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V749":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V750":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V463":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V933":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V934":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V935":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V751":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V752":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V753":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V754":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V755":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V464":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V936":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V937":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V938":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V756":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V757":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V758":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V759":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V760":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V465":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V939":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V940":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V941":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V761":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V762":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V763":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V764":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V765":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V466":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V942":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V943":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V944":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"escuela:V766":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V767":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V768":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"escuela:V769":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V770":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V771":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"escuela:V467":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V468":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V471":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V472":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V473":{"niveles":["ESPECIALIDAD"],"modalidad":"NO_ESCOLAR"},"escuela:V474":{"niveles":["ESPECIALIDAD"],"modalidad":"NO_ESCOLAR"},"escuela:V475":{"niveles":["MAESTRIA"],"modalidad":"NO_ESCOLAR"},"escuela:V476":{"niveles":["MAESTRIA"],"modalidad":"NO_ESCOLAR"},"escuela:V477":{"niveles":["DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V478":{"niveles":["DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V945":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V946":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V947":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V772":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V773":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V774":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V775":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V776":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V716":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V948":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V949":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V950":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V777":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V778":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V779":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V780":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V781":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V717":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V951":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V952":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V953":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V782":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V783":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V784":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V785":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V786":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V718":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V954":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V955":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V956":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V787":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V788":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V789":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V790":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V791":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V719":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V957":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V958":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V959":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V792":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V793":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V794":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V795":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V796":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V720":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V960":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V961":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V962":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"escuela:V797":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V798":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V799":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"escuela:V800":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V801":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"escuela:V802":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"institucion:V1":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"institucion:V2":{"niveles":["TSU"],"modalidad":"ESCOLAR"},"institucion:V5":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"institucion:V6":{"niveles":["LICENCIATURA"],"modalidad":"ESCOLAR"},"institucion:V7":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"institucion:V8":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"ESCOLAR"},"institucion:V10":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"institucion:V11":{"niveles":["TSU"],"modalidad":"NO_ESCOLAR"},"institucion:V14":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"institucion:V15":{"niveles":["LICENCIATURA"],"modalidad":"NO_ESCOLAR"},"institucion:V16":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"},"institucion:V17":{"niveles":["ESPECIALIDAD","MAESTRIA","DOCTORADO"],"modalidad":"NO_ESCOLAR"}},"sha256":"5b79545e3c26e7d8739b5119548c199159e47d9f46d8e997b03c9635de71d8e1"}$criterios911$::jsonb $$;
create or replace function public.s911_validar_perfil(p_payload jsonb,p_cierre boolean default false) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare i jsonb;c jsonb;k record;regla jsonb;version text=p_payload#>>'{config,guiaVersion}';oficiales jsonb=$ofertas911${"5031100007":{"nombre":"LICENCIATURA EN PSICOLOGÍA","nivel":"LICENCIATURA"},"5042000002":{"nombre":"LICENCIATURA EN ADMINISTRACIÓN","nivel":"LICENCIATURA"},"5041200028":{"nombre":"LICENCIATURA EN MERCADOTECNIA","nivel":"LICENCIATURA"},"5041400032":{"nombre":"LICENCIATURA EN CONTADURÍA PÚBLICA","nivel":"LICENCIATURA"},"5033100011":{"nombre":"LICENCIATURA EN DERECHO","nivel":"LICENCIATURA"},"5011100015":{"nombre":"LICENCIATURA EN PEDAGOGÍA","nivel":"LICENCIATURA"},"6012500004":{"nombre":"ESPECIALIDAD EN DOCENCIA UNIVERSITARIA","nivel":"ESPECIALIDAD"},"6042100014":{"nombre":"ESPECIALIDAD EN ADMINISTRACIÓN DE NEGOCIOS","nivel":"ESPECIALIDAD"},"6033100031":{"nombre":"ESPECIALIDAD EN DERECHO PENAL","nivel":"ESPECIALIDAD"}}$ofertas911$::jsonb;hay boolean;respuesta jsonb;
begin
 if version is null then
  if exists(select 1 from jsonb_array_elements(p_payload->'instancias') x where not public.s911_instancia_aplica(x)) then raise exception 'Confirma la oferta desde el asistente antes de excluir instancias';end if;
  return;
 end if;
 if version<>public.s911_criterios_pertinencia()->>'version' then raise exception 'Versión de guía no homologada';end if;
 if p_cierre and p_payload#>'{config,ofertaConfirmada}' is distinct from 'true'::jsonb then raise exception 'Confirma la oferta educativa en el paso 2';end if;
 for i in select value from jsonb_array_elements(p_payload->'instancias') where value->>'cuestionario' in('carrera','posgrado') loop
  c=i->'correspondencia';
  if not public.s911_instancia_aplica(i) then
   if coalesce(length(trim(c->>'motivoNoAplica')),0)<20 or coalesce(length(trim(c->>'evidenciaNoAplica')),0)<5 then
    if p_cierre then raise exception 'Oferta %: documenta la ausencia de actividad actual e histórica',i->>'id';end if;
   end if;
   if p_cierre and exists(
    select 1 from public.alumno_programas ap join public.s911_inscripciones si on si.alumno_programa_id=ap.id
    where ap.plan_id::text in(select jsonb_array_elements_text(c->'planes')) and si.confirmado and
      ((si.ciclo_id::text in(select jsonb_array_elements_text(p_payload#>'{config,ciclosMatricula}')) and si.desde<=(p_payload#>>'{config,corte}')::date and (si.hasta is null or si.hasta>=(p_payload#>>'{config,corte}')::date))
       or (si.ciclo_id::text in(select jsonb_array_elements_text(p_payload#>'{config,ciclosAnteriores}')) and si.desde<=(p_payload#>>'{config,anteriorFin}')::date and (si.hasta is null or si.hasta>=(p_payload#>>'{config,anteriorInicio}')::date))))
   then raise exception 'La oferta % tiene inscripciones acreditadas en los periodos del reporte; revisa su exclusión',i->>'id';end if;
   if p_cierre and exists(select 1 from public.alumno_programas ap join public.s911_eventos se on se.alumno_programa_id=ap.id where ap.plan_id::text in(select jsonb_array_elements_text(c->'planes')) and se.confirmado and se.fecha between (p_payload#>>'{config,anteriorInicio}')::date and (p_payload#>>'{config,anteriorFin}')::date) then raise exception 'La oferta % tiene egresos o titulaciones del periodo',i->>'id';end if;
  elsif p_cierre then
   if c->'confirmada' is distinct from 'true'::jsonb or coalesce(jsonb_array_length(c->'planes'),0)=0 or coalesce(c->>'nivel','') not in('TSU','LICENCIATURA','ESPECIALIDAD','MAESTRIA','DOCTORADO') then raise exception 'Oferta % sin correspondencia o nivel confirmado',i->>'id';end if;
   if oficiales?(i#>>'{identidad,CV_CARRERA}') and c->>'nivel' is distinct from oficiales#>>array[i#>>'{identidad,CV_CARRERA}','nivel'] then raise exception 'Nivel distinto de la oferta oficial en %',i->>'id';end if;
   if exists(select 1 from jsonb_array_elements_text(c->'planes') p where not exists(select 1 from public.planes_estudio pe where pe.id::text=p)) then raise exception 'Plan interno inexistente';end if;
   if exists(select 1 from public.planes_estudio pe join public.carreras ca on ca.id=pe.carrera_id where pe.id::text in(select jsonb_array_elements_text(c->'planes')) and upper(translate(ca.nivel_educativo,'áéíóúÁÉÍÓÚ','aeiouAEIOU')) in('LICENCIATURA','ESPECIALIDAD','MAESTRIA','DOCTORADO') and upper(translate(ca.nivel_educativo,'áéíóúÁÉÍÓÚ','aeiouAEIOU')) is distinct from c->>'nivel') then raise exception 'El nivel del plan interno no corresponde a la oferta %',i->>'id';end if;
  end if;
 end loop;
 if not p_cierre then return;end if;
 for k in select key,value from jsonb_each(public.s911_criterios_pertinencia()->'criterios') loop
  regla=k.value;
  select exists(select 1 from jsonb_array_elements(p_payload->'instancias') x
    where x->>'cuestionario' in('carrera','posgrado') and public.s911_instancia_aplica(x)
    and (regla->'niveles')?(x#>>'{correspondencia,nivel}')
    and (regla->>'modalidad' is null or (regla->>'modalidad'='ESCOLAR' and x#>>'{identidad,CV_MODALIDAD}'='1') or (regla->>'modalidad'='NO_ESCOLAR' and x#>>'{identidad,CV_MODALIDAD}' in('2','3','4')))) into hay;
  if not hay then
   for i in select value from jsonb_array_elements(p_payload->'instancias') where value->>'cuestionario'=split_part(k.key,':',1) loop
    respuesta=i#>array['respuestas',split_part(k.key,':',2)];
    if coalesce(respuesta->>'declarado',respuesta->>'calculado') is distinct from '0' or respuesta->'revisada' is distinct from 'true'::jsonb then raise exception 'Desglose % fuera de la oferta: recalcula y resuelve la declaración previa',k.key;end if;
   end loop;
  end if;
 end loop;
end $$;
revoke all on function public.s911_instancia_aplica(jsonb),public.s911_criterios_pertinencia(),public.s911_validar_perfil(jsonb,boolean) from public,anon,authenticated;

create or replace function public.s911_guardar(p_id uuid, p_revision integer, p_payload jsonb, p_respaldos jsonb default '[]')
returns public.s911_expedientes language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes; rol text=public.get_my_rol(); i jsonb; anterior jsonb; q text; permitido boolean; catalogo public.s911_catalogos; total integer;rev record;corte_anterior text;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso para Estadística 911'; end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'instancias')<>'array' then raise exception 'Expediente inválido';end if;
 if p_payload#>>'{config,edicion}' is distinct from '2026-2027' or p_payload#>>'{config,plantel}' is distinct from '09PSU0509Q' or p_payload#>>'{config,institucion}' is distinct from '09MSU0509T' then raise exception 'Edición o claves fuera del piloto homologado';end if;
 perform public.s911_validar_corte(p_payload,false);
 perform public.s911_validar_perfil(p_payload,false);
 if (p_payload?'corteCalculado' or p_payload#>>'{config,corte}'<>'2026-09-30') and p_payload->>'corteCalculado' is distinct from p_payload#>>'{config,corte}' and p_respaldos is distinct from '[]'::jsonb then raise exception 'Retira el respaldo del corte anterior y recalcula';end if;
 select * into catalogo from public.s911_catalogos where edicion='2026-2027' and sha256=p_payload->>'catalogoHash';
 if not found or p_payload->>'catalogoHash' is distinct from catalogo.sha256 then raise exception 'Catálogo oficial no instalado o huella distinta';end if;
 if pg_column_size(p_payload)>20971520 or pg_column_size(p_respaldos)>52428800 then raise exception 'Expediente demasiado grande';end if;
 if jsonb_array_length(p_payload->'instancias')<>16 then raise exception 'Se esperan las 16 instancias del piloto';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_payload->'instancias'))<>16 then raise exception 'Instancias duplicadas';end if;
 for i in select value from jsonb_array_elements(p_payload->'instancias') loop
  q=i->>'cuestionario';
  if q is null or not catalogo.fuentes?q or i->>'id' !~ ('^'||q||'-[1-9][0-9]*$') then raise exception 'Cuestionario no homologado';end if;
  if q in('carrera','posgrado','escuela','institucion') then
   if (catalogo.fuentes#>array[q,'layout','identidades',((split_part(i->>'id','-',2)::integer)-1)::text]) is distinct from i->'identidad' then raise exception 'Identidad oficial distinta de la descarga';end if;
  elsif i->>'id'<>q||'-1' or i->'identidad' is distinct from jsonb_build_object('CV_CCT','09PSU0509Q','CV_TURNO','4') then raise exception 'Identidad de anexo inválida';end if;
  if jsonb_typeof(i->'respuestas')<>'object' or jsonb_typeof(i->'bloques')<>'object' then raise exception 'Estructura de respuestas inválida';end if;
 end loop;
 if p_id is null then
  if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración configura expedientes';end if;
  insert into public.s911_expedientes(nombre,payload) values(coalesce(p_payload->>'nombre','Levantamiento 2026-2027'),p_payload) returning * into e;
 else
  select * into e from public.s911_expedientes where id=p_id for update;
  if not found then raise exception 'Expediente inexistente';end if;
  corte_anterior=e.payload#>>'{config,corte}';
  if corte_anterior is distinct from p_payload#>>'{config,corte}' and not (p_payload?'corteCalculado') then raise exception 'Actualiza la aplicación y recalcula al cambiar el corte';end if;
  if e.estado<>'BORRADOR' then raise exception 'El expediente no está en borrador';end if;
  if e.revision<>p_revision then raise exception 'Otro usuario modificó el expediente. Recarga antes de guardar';end if;
  if rol<>'ADMINISTRADOR' and ((p_payload->'config')-'coberturas') is distinct from ((e.payload->'config')-'coberturas') then raise exception 'Configuración restringida a Administración';end if;
  if rol<>'ADMINISTRADOR' and exists(select 1 from jsonb_array_elements(p_payload->'instancias') n join jsonb_array_elements(e.payload->'instancias') a on n->>'id'=a->>'id' where n->'correspondencia' is distinct from a->'correspondencia') then raise exception 'Correspondencias restringidas a Administración';end if;
  if rol<>'ADMINISTRADOR' then
   for rev in select key,value from jsonb_each_text(coalesce(p_payload->'revisiones','{}')) loop
    if nullif(trim(rev.value),'') is not null and rev.value is distinct from e.payload#>>array['revisiones',rev.key] then
     permitido=(rol='COORDINADOR CONTROL ESCOLAR' and rev.key in('carrera','posgrado')) or (rol='COORDINADOR RECURSOS HUMANOS' and rev.key='escuela') or (rol='COORDINADOR FINANCIERO' and rev.key='institucion') or (rol='COORDINADOR ACADEMICO' and rev.key in('carrera','posgrado','tecnologia','infraestructura'));
     if not permitido then raise exception 'No puedes aprobar la revisión de esta sección';end if;
    end if;
   end loop;
  end if;
  if not public.s911_autorizado(true) then
   if (p_payload-'instancias'-'revisiones') is distinct from (e.payload-'instancias'-'revisiones') then raise exception 'Cambio fuera de la sección autorizada';end if;
   if jsonb_array_length(p_payload->'instancias')<>jsonb_array_length(e.payload->'instancias') then raise exception 'No se permite cambiar instancias';end if;
   for i in select value from jsonb_array_elements(p_payload->'instancias') loop
    select value into anterior from jsonb_array_elements(e.payload->'instancias') where value->>'id'=i->>'id';
    q=i->>'cuestionario';permitido=(rol='COORDINADOR RECURSOS HUMANOS' and q='escuela') or (rol='COORDINADOR FINANCIERO' and q='institucion') or (rol='COORDINADOR ACADEMICO' and q in('carrera','posgrado','tecnologia','infraestructura'));
    if anterior is null or (not permitido and i is distinct from anterior) or (i-'respuestas'-'bloques') is distinct from (anterior-'respuestas'-'bloques') then raise exception 'Cambio fuera de la sección autorizada';end if;
   end loop;
  end if;
  update public.s911_expedientes set nombre=p_payload->>'nombre',payload=p_payload,revision=revision+1,actualizado_en=now() where id=p_id returning * into e;
 end if;
 if public.s911_autorizado(true) then
  if jsonb_typeof(p_respaldos)<>'array' then raise exception 'Respaldo inválido';end if;
  if exists(select 1 from jsonb_array_elements(p_respaldos) r cross join lateral jsonb_array_elements(r->'incluidos') p
   where not exists(select 1 from public.s911_inscripciones si join public.alumno_programas ap on ap.id=si.alumno_programa_id where si.id::text=p->>'id' and si.confirmado and ap.id::text=p->>'programa_id' and ap.alumno_id::text=p->>'alumno_id')
   and not exists(select 1 from public.s911_eventos se join public.alumno_programas ap on ap.id=se.alumno_programa_id where se.id::text=p->>'id' and se.confirmado and ap.id::text=p->>'programa_id' and ap.alumno_id::text=p->>'alumno_id')) then raise exception 'El respaldo incluye personas sin inscripción o evento confirmado';end if;
  insert into public.s911_respaldos(expediente_id,version,contenido) values(e.id,e.version,p_respaldos)
  on conflict(expediente_id,version) do update set contenido=excluded.contenido;
 end if;
 if corte_anterior is not null and corte_anterior is distinct from p_payload#>>'{config,corte}' then
  insert into public.s911_auditoria(expediente_id,accion,motivo,datos) values(e.id,'CAMBIAR_CORTE',coalesce(nullif(trim(p_payload#>>'{config,motivoCorte}'),''),'Restauración de la fecha de referencia de la edición'),jsonb_build_object('anterior',corte_anterior,'nuevo',p_payload#>>'{config,corte}','referencia_edicion','2026-09-30'));
 end if;
 insert into public.s911_auditoria(expediente_id,accion) values(e.id,'GUARDAR');return e;
end $$;
create or replace function public.s911_transicion(p_id uuid,p_revision integer,p_accion text,p_motivo text)
returns public.s911_expedientes language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes; i jsonb;c record;r jsonb; v text; faltas integer=0;regla jsonb;valores jsonb;veredicto jsonb;excepcion jsonb;clave text;snapshot jsonb;
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso para cambiar el estado';end if;
 select * into e from public.s911_expedientes where id=p_id for update;
 if not found or e.revision<>p_revision then raise exception 'Expediente inexistente o revisión desactualizada';end if;
 if length(trim(p_motivo))<5 then raise exception 'Registra un motivo de al menos cinco caracteres';end if;
 if p_accion='REVISAR' and e.estado='BORRADOR' then e.estado='EN_REVISION';
 elsif p_accion='DEVOLVER' and e.estado='EN_REVISION' then e.estado='BORRADOR';
 elsif p_accion='CERRAR' and e.estado='EN_REVISION' then
  if public.get_my_rol()<>'ADMINISTRADOR' then raise exception 'Solo Administración cierra expedientes';end if;
  if not coalesce((e.payload#>>'{config,controlConfirmado}')::boolean,false) or nullif(e.payload#>>'{config,edadReferencia}','') is null or nullif(e.payload#>>'{config,responsable}','') is null then raise exception 'Configuración y responsable pendientes';end if;
  perform public.s911_validar_corte(e.payload,true);
  if (e.payload#>>'{config,fiscal}')::integer is distinct from 2025 then raise exception 'El ejercicio fiscal de la edición sigue siendo 2025';end if;
  if nullif(e.payload#>>'{config,actualInicio}','') is null or nullif(e.payload#>>'{config,anteriorInicio}','') is null or nullif(e.payload#>>'{config,anteriorFin}','') is null then raise exception 'Periodos de referencia incompletos';end if;
  if (e.payload#>>'{config,actualInicio}')::date>(e.payload#>>'{config,corte}')::date or (e.payload#>>'{config,anteriorInicio}')::date>(e.payload#>>'{config,anteriorFin}')::date then raise exception 'Fechas de referencia invertidas';end if;
  perform public.s911_validar_perfil(e.payload,true);
  if not exists(select 1 from public.s911_campos where catalogo_sha256=e.payload->>'catalogoHash') then raise exception 'Instala primero el catálogo oficial versionado';end if;
  if exists(select 1 from jsonb_array_elements(e.payload->'instancias') i cross join lateral jsonb_array_elements_text(i#>'{correspondencia,planes}') p
   where i->>'cuestionario' in('carrera','posgrado') and public.s911_instancia_aplica(i) group by p having count(distinct i->>'id')>1) then raise exception 'Un plan interno corresponde a varias instancias oficiales';end if;
  for i in select value from jsonb_array_elements(e.payload->'instancias') loop
   if not public.s911_instancia_aplica(i) then continue;end if;
   if i->>'cuestionario' in('carrera','posgrado') and (i#>>'{correspondencia,confirmada}') is distinct from 'true' then raise exception 'Correspondencia sin confirmar %',i->>'id';end if;
   if nullif(e.payload#>>array['revisiones',i->>'cuestionario'],'') is null then raise exception 'Falta revisión de sección %',i->>'cuestionario';end if;
   for c in select codigo,definicion from public.s911_campos where catalogo_sha256=e.payload->>'catalogoHash' and cuestionario=i->>'cuestionario' and codigo~'^[VE][0-9]+$' loop
    r=i#>array['respuestas',c.codigo];v=coalesce(r->>'declarado',r->>'calculado');
    if v is null or not coalesce((r->>'revisada')::boolean,false) then faltas=faltas+1;end if;
    if r?'declarado' and (nullif(trim(r->>'justificacion'),'') is null or nullif(trim(r->>'evidencia'),'') is null) then raise exception 'Ajuste sin justificación/evidencia %',c.codigo;end if;
    if c.definicion->>'tipo'~'INT' and v is not null and v!~'^\d+$' then raise exception 'Entero inválido %',c.codigo;end if;
    if c.definicion->>'tipo'='SMALLINT' and v is not null and v::numeric>32767 then raise exception 'SMALLINT fuera de rango %',c.codigo;end if;
    if c.definicion->>'tipo'~'(DECIMAL|NUMERIC|REAL|FLOAT|DOUBLE)' and v is not null and v!~'^\d+(\.\d+)?$' then raise exception 'Número inválido %',c.codigo;end if;
    if v~'[|\r\n]' then raise exception 'Separador no permitido %',c.codigo;end if;
   end loop;
   select coalesce(jsonb_object_agg(k,case when dato?'declarado' then dato->'declarado' else dato->'calculado' end),'{}') into valores from jsonb_each(i->'respuestas') t(k,dato);
   valores=valores||(i->'identidad');
   for regla in select value from public.s911_catalogos cat cross join lateral jsonb_array_elements(cat.reglas) where cat.edicion='2026-2027' and cat.sha256=e.payload->>'catalogoHash' and value->>'cuestionario'=i->>'cuestionario' loop
    veredicto=public.s911_evaluar_ast(regla->'ast',valores);
    if veredicto is distinct from 'true'::jsonb then
     clave=(i->>'id')||':R'||(regla->>'linea');excepcion=e.payload#>array['excepciones',clave];
     if coalesce(length(trim(excepcion->>'justificacion')),0)<20 or coalesce(length(trim(excepcion->>'evidencia')),0)<5 then raise exception 'Regla % incumplida, incompleta o no homologada; corrige o documenta su excepción',clave;end if;
    end if;
   end loop;
  end loop;
  if faltas>0 then raise exception 'Hay % respuestas pendientes o sin revisión',faltas;end if;
  snapshot=e.payload||jsonb_build_object('id',e.id,'revision',e.revision+1,'version',e.version,'estado','CERRADO');
  insert into public.s911_versiones(expediente_id,numero,payload,sha256,cerrado_por)
   values(e.id,e.version,snapshot,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'),auth.uid());
  e.estado='CERRADO';
 elsif p_accion='REABRIR' and e.estado='CERRADO' then
  if public.get_my_rol()<>'ADMINISTRADOR' then raise exception 'Solo Administración reabre';end if;
  insert into public.s911_respaldos(expediente_id,version,contenido) select expediente_id,e.version+1,contenido from public.s911_respaldos where expediente_id=e.id and version=e.version;
  e.version=e.version+1;e.estado='BORRADOR';e.payload=jsonb_set(e.payload,'{revisiones}','{}');
 else raise exception 'Transición no permitida';end if;
 update public.s911_expedientes set estado=e.estado,version=e.version,payload=e.payload,revision=revision+1,actualizado_en=now() where id=e.id returning * into e;
 insert into public.s911_auditoria(expediente_id,accion,motivo,datos) values(e.id,p_accion,p_motivo,jsonb_build_object('version',e.version));return e;
end $$;
create or replace function public.s911_registrar_exportacion(p_id uuid,p_version integer,p_revision integer,p_formato text,p_archivo text,p_huella text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes;r uuid;version_payload jsonb;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso para exportar';end if;
 select * into e from public.s911_expedientes where id=p_id;
 if not found then raise exception 'Expediente inexistente';end if;
 select payload into version_payload from public.s911_versiones where expediente_id=p_id and numero=p_version;
 if not found then
  if e.version<>p_version or e.revision<>p_revision then raise exception 'Guarda o recarga el expediente antes de exportar';end if;
  version_payload=e.payload;
 end if;
 perform public.s911_validar_corte(version_payload,true);
 if version_payload#>>'{config,guiaVersion}' is not null and version_payload#>'{config,ofertaConfirmada}' is distinct from 'true'::jsonb then raise exception 'Confirma la oferta antes de exportar';end if;
 perform public.s911_validar_perfil(version_payload,coalesce(version_payload->>'estado',e.estado)='CERRADO');
 if p_formato='XLSX' and not public.s911_autorizado(true) then raise exception 'Listados individuales restringidos';end if;
 if p_huella!~'^[a-f0-9]{64}$' then raise exception 'Huella inválida';end if;
 insert into public.s911_exportaciones(expediente_id,version,formato,archivo,huella) values(p_id,p_version,p_formato,p_archivo,p_huella) returning id into r;return r;
end $$;
revoke all on function public.s911_guardar(uuid,integer,jsonb,jsonb),public.s911_transicion(uuid,integer,text,text),public.s911_registrar_exportacion(uuid,integer,integer,text,text,text) from public,anon;
grant execute on function public.s911_guardar(uuid,integer,jsonb,jsonb),public.s911_transicion(uuid,integer,text,text),public.s911_registrar_exportacion(uuid,integer,integer,text,text,text) to authenticated;
commit;
