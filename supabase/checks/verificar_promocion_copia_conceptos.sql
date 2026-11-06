-- Solo lectura. Ejecutar después de 20261018140000_promocion_copia_conceptos_validada.sql.
select
  to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') is not null
    as promocion_instalada,
  exists (select 1 from pg_proc p
    where p.oid = to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)')
      and position('No existe un plan anterior de la misma periodicidad con conceptos para copiar' in p.prosrc) > 0)
    as evita_copia_vacia,
  exists (select 1 from pg_proc p
    where p.oid = to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)')
      and position('La periodicidad del ciclo no corresponde al plan de estudios vigente' in p.prosrc) > 0)
    as valida_periodicidad_academica;
