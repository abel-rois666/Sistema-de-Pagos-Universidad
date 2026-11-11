-- SOLO LECTURA. No archiva, reasocia ni modifica fichas.
-- Localiza el caso mostrado por nombre; si hay homónimos, distinguir alumno_id.
-- La salida omite contacto, importes y documentos personales.
with alumnos_caso as (
  select id from public.alumnos
  where upper(btrim(nombre_completo))='RIVERA RAMIREZ MARIA ALICIA'
)
select p.alumno_id,p.id alumno_programa_id,e.clave_legado plan_estudios,
       p.es_vigente programa_principal,p.estatus estatus_programa,
       f.id ficha_id,f.archivado_en,f.revision,f.pago_certificado,
       f.tramite_completado,f.fecha_inicio_tramite,f.fecha_completado,
       case when f.id is null then 'SIN FICHA'
            when f.archivado_en is not null then 'ARCHIVADA; NO DEBE APORTAR ESTATUS AL REPORTE'
            when f.tramite_completado then 'ACTIVA; COMPLETADO'
            when f.fecha_inicio_tramite is not null then 'ACTIVA; EN TRÁMITE'
            else 'ACTIVA; EN PREPARACIÓN' end diagnostico
from public.alumno_programas p
join public.planes_estudio e on e.id=p.plan_id
left join public.ficha_certificacion f on f.alumno_programa_id=p.id and f.alumno_id=p.alumno_id
where p.alumno_id in (select id from alumnos_caso)
order by p.alumno_id,e.clave_legado,p.id,f.archivado_en nulls first,f.id;

-- Fichas anteriores sin asociación: también pueden archivarse de forma independiente.
select f.alumno_id,f.id ficha_id,f.alumno_programa_id,f.archivado_en,f.revision,
       f.pago_certificado,f.tramite_completado
from public.ficha_certificacion f
join public.alumnos a on a.id=f.alumno_id
where upper(btrim(a.nombre_completo))='RIVERA RAMIREZ MARIA ALICIA'
  and f.alumno_programa_id is null
order by f.alumno_id,f.id;

-- Confirma la definición instalada sin ejecutar la RPC (SQL Editor no representa la sesión del usuario).
select p.proname funcion,pg_get_functiondef(p.oid) definicion
from pg_proc p where p.oid=to_regprocedure('public.certificacion_resumen_v1(uuid[],integer,integer)');
