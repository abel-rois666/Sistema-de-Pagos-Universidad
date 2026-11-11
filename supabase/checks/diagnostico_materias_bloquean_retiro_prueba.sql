-- SOLO LECTURA. No elimina filas, no cambia notas ni invoca el retiro.
-- Sustituir SOLO la matrícula entre comillas en la siguiente línea.
with parametros(matricula) as (values('ESCRIBE_MATRICULA_AQUI'::text)),
alumnos_encontrados as (
 select a.id from public.alumnos a cross join parametros q
 where nullif(btrim(q.matricula),'') is not null and q.matricula<>'ESCRIBE_MATRICULA_AQUI'
 and upper(regexp_replace(coalesce(a.matricula,''),'\s+','','g'))=upper(regexp_replace(q.matricula,'\s+','','g'))
),
programas as (
 select p.id,p.alumno_id,p.plan_id,p.es_vigente,e.clave_legado
 from public.alumno_programas p join alumnos_encontrados a on a.id=p.alumno_id
 join public.planes_estudio e on e.id=p.plan_id
), materias as (
 select p.id programa_id,i.id,to_jsonb(i) j from programas p
 join public.inscripciones_academicas i on i.alumno_id=p.alumno_id
 join public.asignaturas a on a.id=i.asignatura_id and a.plan_id=p.plan_id
), permitidos(campos) as (values(array['id','alumno_id','ciclo_id','asignatura_id','created_at','updated_at',
 'parcial_1','parcial_2','parcial_3','promedio_calculado','calificacion_final','modificada_manualmente',
 'observaciones','tipo_evaluacion','estatus','ciclo_legado','bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final',
 'solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final','id_observacion_certificacion']::text[])),
motivos as (
 select m.programa_id,m.id,x.key campo,
 case
 when not(x.key=any(p.campos)) then 'Columna no contemplada por el clasificador, incluso si está vacía'
 when x.key in ('parcial_1','parcial_2','parcial_3','promedio_calculado','calificacion_final') then
   case when x.value='0'::jsonb then 'Cero capturado: se protege como nota'
        when x.value='-555'::jsonb then 'NP capturado: se protege como nota' else 'Valor de calificación registrado' end
 when x.key='id_observacion_certificacion' then 'Referencia de observación de certificación registrada'
 when x.key in ('estatus','tipo_evaluacion') then 'Estado o evaluación no admitido como captura vacía'
 when x.key in ('observaciones','ciclo_legado') then 'Texto o referencia histórica registrada'
 else 'Marca de edición, bloqueo o solicitud registrada' end motivo,
 case when x.key in ('estatus','tipo_evaluacion') then x.value#>>'{}' else null end valor_de_catalogo
 from materias m cross join permitidos p cross join lateral jsonb_each(m.j) x
 where not(x.key=any(p.campos))
 or (x.key in ('parcial_1','parcial_2','parcial_3','promedio_calculado','calificacion_final','id_observacion_certificacion') and x.value<>'null'::jsonb)
 or (x.key in ('modificada_manualmente','bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final','solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final') and x.value not in ('null'::jsonb,'false'::jsonb))
 or (x.key='ciclo_legado' and nullif(btrim(x.value#>>'{}'),'') is not null)
 or (x.key='observaciones' and upper(btrim(coalesce(x.value#>>'{}',''))) not in ('','CARGA INICIAL','CARGA DE REINSCRIPCIÓN','CARGA DE REINSCRIPCION','IMPORTADO DE GES 4'))
 or (x.key='estatus' and upper(btrim(coalesce(x.value#>>'{}',''))) not in ('','CURSANDO','SIN_EVALUAR','SIN EVALUAR'))
 or (x.key='tipo_evaluacion' and upper(btrim(coalesce(x.value#>>'{}','ORDINARIO')))<>'ORDINARIO')
), resumen as (
 select p.id alumno_programa_id,p.alumno_id,p.clave_legado,p.es_vigente,
 count(m.id) registros_materias,
 count(m.id) filter(where public._ap_materia_prueba_v1(m.j)) materias_clasificadas_vacias,
 count(m.id) filter(where not public._ap_materia_prueba_v1(m.j)) materias_protegidas
 from programas p left join materias m on m.programa_id=p.id group by p.id,p.alumno_id,p.clave_legado,p.es_vigente
), agrupado as (
 select programa_id alumno_programa_id,campo,motivo,valor_de_catalogo,count(*) registros_afectados
 from motivos group by programa_id,campo,motivo,valor_de_catalogo
)
select '0_resultado_busqueda' seccion,jsonb_build_object(
 'matricula_configurada',(select nullif(btrim(matricula),'') is not null and matricula<>'ESCRIBE_MATRICULA_AQUI' from parametros),
 'alumnos_encontrados',(select count(*) from alumnos_encontrados),
 'programas_encontrados',(select count(*) from programas),
 'alcance','Todos los programas de la matrícula; sin filtro por clave del plan') datos
union all
select '1_clasificador_instalado',jsonb_build_object('definicion',pg_get_functiondef(to_regprocedure('public._ap_materia_prueba_v1(jsonb)')))
union all
select '2_programa_y_conteos',coalesce(jsonb_agg(to_jsonb(r) order by alumno_programa_id),'[]') from resumen r
union all
select '3_campos_que_bloquean',coalesce(jsonb_agg(to_jsonb(a) order by alumno_programa_id,campo,motivo),'[]') from agrupado a
order by seccion;
-- Devuelve UNA tabla de cuatro filas. Compartir las cuatro; no contiene nombre,
-- matrícula, valores de notas, contenido de observaciones ni importes.
-- 0_resultado_busqueda distingue matrícula sin configurar, cero coincidencias y alumno sin programa.
-- Si hay varias coincidencias de matrícula, no elegir automáticamente ni ejecutar depuración.
