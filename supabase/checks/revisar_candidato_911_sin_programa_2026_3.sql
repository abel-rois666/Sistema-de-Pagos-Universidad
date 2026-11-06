-- SOLO LECTURA. Identifica las parejas alumno-plan sin alumno_programas detectadas por el preflight.
-- No crea programas ni cambia el plan de materias o grupos. No devuelve nombres ni matrículas.
with objetivo as (
 select '511fffc3-11d4-4055-b114-bbe82ed1b0b0'::uuid ciclo_id
), fuentes as (
 select ia.alumno_id,a.plan_id,ia.ciclo_id,'MATERIAS'::text origen
 from public.inscripciones_academicas ia
 join public.asignaturas a on a.id=ia.asignatura_id
 join objetivo o on o.ciclo_id=ia.ciclo_id
 union all
 select ag.alumno_id,g.plan_id,g.ciclo_id,'GRUPOS'::text origen
 from public.alumnos_grupos ag join public.grupos g on g.id=ag.grupo_id
 join objetivo o on o.ciclo_id=g.ciclo_id
), parejas as (
 select alumno_id,plan_id,ciclo_id,array_agg(distinct origen order by origen) origenes
 from fuentes where alumno_id is not null and plan_id is not null
 group by alumno_id,plan_id,ciclo_id
)
select ca.alumno_id,ca.plan_id,ca.ciclo_id,p.clave_legado clave_plan,p.tipo_periodo,
 ca.origenes,
 (select count(*) from public.alumno_programas ap where ap.alumno_id=ca.alumno_id) programas_registrados_del_alumno
from parejas ca left join public.planes_estudio p on p.id=ca.plan_id
where not exists(select 1 from public.alumno_programas ap
 where ap.alumno_id=ca.alumno_id and ap.plan_id=ca.plan_id)
order by ca.alumno_id,ca.plan_id;
