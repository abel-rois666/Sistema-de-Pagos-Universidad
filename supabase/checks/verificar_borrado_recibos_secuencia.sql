-- SOLO LECTURA. No emitir ni borrar recibos para realizar esta comprobación.
-- Una sola consulta: devuelve ambas funciones y el contador observado en la misma tabla.
with esperadas(nombre,oid) as (
  values ('borrar_recibo_prueba_v2',to_regprocedure('public.borrar_recibo_prueba_v2(uuid)')),
         ('borrar_recibo_admin',to_regprocedure('public.borrar_recibo_admin(uuid)'))
), funciones as (
  select p.oid,p.proname,p.prosrc,p.prosecdef,p.proconfig from pg_proc p
  where p.oid in (to_regprocedure('public.borrar_recibo_prueba_v2(uuid)'),
                 to_regprocedure('public.borrar_recibo_admin(uuid)'))
), secuencia as (
 select sequencename,last_value,increment_by,cycle from pg_sequences
 where schemaname='public' and sequencename='recibos_folio_seq'
)
select e.nombre funcion,f.oid is not null funcion_presente,
  coalesce(f.prosrc !~* '(setval|nextval|restart|sync_secuencia_folios)',false) sin_operaciones_de_secuencia,
  coalesce(case when e.nombre='borrar_recibo_prueba_v2' then
    f.prosrc ilike '%for update%' and f.prosrc ilike '%auth.uid()%' and f.prosrc ilike '%ADMINISTRADOR%'
    and f.prosrc ilike '%activo is true%'
  else f.prosrc ilike '%public.borrar_recibo_prueba_v2(p_recibo_id)%' end,false) controles_esperados,
  f.prosecdef security_definer,f.proconfig configuracion,
  has_function_privilege('anon',f.oid,'EXECUTE') acceso_anonimo,
  has_function_privilege('authenticated',f.oid,'EXECUTE') acceso_autenticado,
  s.sequencename,s.last_value folio_secuencia_observado,s.increment_by,s.cycle
from esperadas e left join funciones f on f.oid=e.oid left join secuencia s on true order by e.nombre;
-- Debe devolver DOS filas: funcion_presente, sin_operaciones_de_secuencia y controles_esperados=true;
-- acceso_anonimo=false; acceso_autenticado=true; search_path fijado en ambas.
-- Es una comprobación estructural, no una prueba de ejecución ni de todos los triggers.
-- El contador puede aumentar por emisiones concurrentes; no debe reajustarse a un valor fijo.
