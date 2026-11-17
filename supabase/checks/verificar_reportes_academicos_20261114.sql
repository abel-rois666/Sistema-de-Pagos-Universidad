-- ============================================================================
-- VERIFICACIÓN POST-INSTALACIÓN DE SOLO LECTURA: REPORTES ACADÉMICOS (14/11/2026)
-- Ejecutar DESPUÉS de 20261114100000_reportes_academicos.sql.
-- No modifica nada. Todas las filas deben indicar 'OK'.
-- Comprueba metadatos; no acredita por sí sola la atomicidad ni los permisos
-- efectivos de cada usuario real.
-- ============================================================================
WITH tablas(nombre) AS (
  VALUES ('reportes_academicos'), ('reportes_academicos_alumnos'), ('reportes_academicos_grupos'),
         ('reportes_academicos_docentes'), ('reportes_actas_hechos'), ('reportes_academicos_bitacora')
),
checks_esperados(tabla, restriccion) AS (
  VALUES
    ('reportes_academicos', 'reportes_academicos_folio_ciclo_unico'),
    ('reportes_academicos', 'reportes_academicos_folio_formato'),
    ('reportes_academicos', 'reportes_academicos_grupo_solo_incidente'),
    ('reportes_academicos', 'reportes_academicos_evidencia_solo_incidente'),
    ('reportes_academicos', 'reportes_academicos_descripcion_no_vacia'),
    ('reportes_academicos', 'reportes_academicos_revision_positiva'),
    ('reportes_actas_hechos', 'reportes_actas_hechos_horario'),
    ('reportes_actas_hechos', 'reportes_actas_hechos_testigos_arreglo'),
    ('reportes_actas_hechos', 'reportes_actas_hechos_textos')
),
funciones(firma, publica) AS (
  VALUES
    ('public.guardar_reporte_academico_v1(jsonb)', true),
    ('public.consultar_reportes_academicos_v1(jsonb)', true),
    ('public._ra_lector_v1()', true),
    ('public._ra_rol_v1()', false),
    ('public._ra_snapshot_v1(uuid)', false),
    ('public._ra_uuid_v1(text)', false),
    ('public._ra_fecha_v1(text,text)', false),
    ('public._ra_textos_v1(jsonb)', false),
    ('public._ra_normalizar_v1(text)', false)
)
SELECT comprobacion, resultado FROM (
  SELECT 'tabla ' || t.nombre AS comprobacion,
         CASE WHEN to_regclass('public.' || t.nombre) IS NOT NULL THEN 'OK' ELSE 'FALTA' END AS resultado
  FROM tablas t

  UNION ALL
  SELECT 'RLS activa en ' || t.nombre,
         CASE WHEN coalesce((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.' || t.nombre)), false)
              THEN 'OK' ELSE 'FALLA' END
  FROM tablas t

  UNION ALL
  SELECT 'sin INSERT/UPDATE/DELETE directo (' || r.rol || ') en ' || t.nombre,
         CASE WHEN to_regclass('public.' || t.nombre) IS NULL THEN 'FALTA'
              WHEN has_table_privilege(r.rol, 'public.' || t.nombre, 'INSERT')
                OR has_table_privilege(r.rol, 'public.' || t.nombre, 'UPDATE')
                OR has_table_privilege(r.rol, 'public.' || t.nombre, 'DELETE')
                OR has_table_privilege(r.rol, 'public.' || t.nombre, 'TRUNCATE') THEN 'FALLA' ELSE 'OK' END
  FROM tablas t CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rol)

  UNION ALL
  SELECT 'anon sin SELECT en ' || t.nombre,
         CASE WHEN to_regclass('public.' || t.nombre) IS NULL THEN 'FALTA'
              WHEN has_table_privilege('anon', 'public.' || t.nombre, 'SELECT') THEN 'FALLA' ELSE 'OK' END
  FROM tablas t

  UNION ALL
  SELECT 'bitácora privada (authenticated sin SELECT)',
         CASE WHEN to_regclass('public.reportes_academicos_bitacora') IS NULL THEN 'FALTA'
              WHEN has_table_privilege('authenticated', 'public.reportes_academicos_bitacora', 'SELECT') THEN 'FALLA' ELSE 'OK' END

  UNION ALL
  SELECT 'política de lectura en ' || t.nombre,
         CASE WHEN EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.nombre
                AND p.cmd = 'SELECT') THEN 'OK' ELSE 'FALTA' END
  FROM tablas t WHERE t.nombre <> 'reportes_academicos_bitacora'

  UNION ALL
  SELECT 'sin políticas de escritura en ' || t.nombre,
         CASE WHEN EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.nombre
                AND p.cmd <> 'SELECT') THEN 'FALLA' ELSE 'OK' END
  FROM tablas t

  UNION ALL
  SELECT 'restricción ' || e.restriccion,
         CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = e.restriccion
                AND c.conrelid = to_regclass('public.' || e.tabla)) THEN 'OK' ELSE 'FALTA' END
  FROM checks_esperados e

  UNION ALL
  SELECT 'función ' || f.firma,
         CASE WHEN to_regprocedure(f.firma) IS NOT NULL THEN 'OK' ELSE 'FALTA' END
  FROM funciones f

  UNION ALL
  SELECT 'SECURITY DEFINER y search_path en ' || f.firma,
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(f.firma) AND p.prosecdef
                AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')) THEN 'OK' ELSE 'FALLA' END
  FROM funciones f
  WHERE f.firma IN ('public.guardar_reporte_academico_v1(jsonb)', 'public.consultar_reportes_academicos_v1(jsonb)',
                    'public._ra_rol_v1()', 'public._ra_lector_v1()')

  UNION ALL
  SELECT 'anon sin EXECUTE en ' || f.firma,
         CASE WHEN to_regprocedure(f.firma) IS NULL THEN 'FALTA'
              WHEN has_function_privilege('anon', to_regprocedure(f.firma), 'EXECUTE') THEN 'FALLA' ELSE 'OK' END
  FROM funciones f

  UNION ALL
  SELECT CASE WHEN f.publica THEN 'authenticated con EXECUTE en ' ELSE 'authenticated sin EXECUTE en ' END || f.firma,
         CASE WHEN to_regprocedure(f.firma) IS NULL THEN 'FALTA'
              WHEN has_function_privilege('authenticated', to_regprocedure(f.firma), 'EXECUTE') = f.publica THEN 'OK'
              ELSE 'FALLA' END
  FROM funciones f
) AS x
ORDER BY CASE WHEN resultado = 'OK' THEN 1 ELSE 0 END, comprobacion;

