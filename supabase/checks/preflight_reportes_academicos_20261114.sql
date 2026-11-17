-- ============================================================================
-- PREFLIGHT DE SOLO LECTURA: REPORTES ACADÉMICOS (14/11/2026)
-- Ejecutar ANTES de 20261114100000_reportes_academicos.sql.
-- No crea, modifica ni elimina nada. Comparte el resultado completo.
-- Todas las filas deben indicar 'OK'. 'INFO' es solo informativo.
-- ============================================================================
WITH columnas AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
requeridas(tabla, columna) AS (
  VALUES
    ('ciclos_escolares', 'id'), ('ciclos_escolares', 'nombre'),
    ('ciclos_escolares', 'activo'), ('ciclos_escolares', 'fecha_inicio'), ('ciclos_escolares', 'fecha_termino'),
    ('alumnos', 'id'), ('alumnos', 'matricula'), ('alumnos', 'nombre_completo'), ('alumnos', 'licenciatura'), ('alumnos', 'grado_actual'),
    ('grupos', 'id'), ('grupos', 'ciclo_id'), ('grupos', 'plan_id'), ('grupos', 'codigo_grupo'), ('grupos', 'grado'),
    ('grupos', 'es_multigrado'), ('grupos', 'grado_inicio'), ('grupos', 'grado_fin'), ('grupos', 'turno'),
    ('alumnos_grupos', 'alumno_id'), ('alumnos_grupos', 'grupo_id'),
    ('alumno_programas', 'alumno_id'), ('alumno_programas', 'plan_id'), ('alumno_programas', 'es_vigente'), ('alumno_programas', 'fecha_inscripcion'),
    ('docentes', 'id'), ('docentes', 'nombre_completo'), ('docentes', 'clave_legado'),
    ('empleados', 'id'), ('empleados', 'nombres'), ('empleados', 'apellido_paterno'), ('empleados', 'apellido_materno'),
    ('empleados', 'puesto'),
    ('carreras', 'id'), ('carreras', 'nombre'),
    ('planes_estudio', 'id'), ('planes_estudio', 'carrera_id'),
    ('usuarios', 'auth_id'), ('usuarios', 'rol'), ('usuarios', 'activo')
)
SELECT comprobacion, resultado FROM (
SELECT 'columna ' || r.tabla || '.' || r.columna AS comprobacion,
       CASE WHEN c.column_name IS NOT NULL THEN 'OK' ELSE 'FALTA' END AS resultado
FROM requeridas r
LEFT JOIN columnas c ON c.table_name = r.tabla AND c.column_name = r.columna

UNION ALL
SELECT 'columna ciclos_escolares.(tipo o tipo_periodo)',
       CASE WHEN EXISTS (
         SELECT 1 FROM columnas
         WHERE table_name = 'ciclos_escolares' AND column_name IN ('tipo', 'tipo_periodo')
       ) THEN 'OK' ELSE 'FALTA' END

UNION ALL
SELECT 'columna de estado en docentes (activo o estatus)',
       CASE WHEN EXISTS (
         SELECT 1 FROM columnas
         WHERE table_name = 'docentes' AND column_name IN ('activo', 'estatus')
       ) THEN 'OK' ELSE 'FALTA' END

UNION ALL
SELECT 'columna de estado en empleados (activo o estatus)',
       CASE WHEN EXISTS (
         SELECT 1 FROM columnas
         WHERE table_name = 'empleados' AND column_name IN ('activo', 'estatus')
       ) THEN 'OK' ELSE 'FALTA' END

UNION ALL
SELECT 'función public.get_my_rol()',
       CASE WHEN to_regprocedure('public.get_my_rol()') IS NOT NULL THEN 'OK' ELSE 'FALTA' END

UNION ALL
SELECT 'función gen_random_uuid()',
       CASE WHEN to_regprocedure('gen_random_uuid()') IS NOT NULL
              OR to_regprocedure('public.gen_random_uuid()') IS NOT NULL THEN 'OK' ELSE 'FALTA' END

UNION ALL
SELECT 'nombre libre: tabla public.' || t,
       CASE WHEN to_regclass('public.' || t) IS NULL THEN 'OK' ELSE 'YA EXISTE' END
FROM unnest(ARRAY[
  'reportes_academicos', 'reportes_academicos_alumnos', 'reportes_academicos_grupos',
  'reportes_academicos_docentes', 'reportes_actas_hechos', 'reportes_academicos_bitacora'
]) AS t

UNION ALL
SELECT 'nombre libre: función public.' || f,
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = f
       ) THEN 'OK' ELSE 'YA EXISTE' END
FROM unnest(ARRAY[
  'guardar_reporte_academico_v1', 'consultar_reportes_academicos_v1',
  '_ra_uuid_v1', '_ra_fecha_v1', '_ra_textos_v1', '_ra_normalizar_v1',
  '_ra_rol_v1', '_ra_lector_v1', '_ra_snapshot_v1'
]) AS f

-- Informativo: la especificación mencionaba ciclos_escolares.tipo; el esquema usa tipo_periodo.
UNION ALL
SELECT 'INFO ciclos_escolares.tipo (no requerido; se usa tipo_periodo)',
       CASE WHEN EXISTS (SELECT 1 FROM columnas WHERE table_name = 'ciclos_escolares' AND column_name = 'tipo')
            THEN 'INFO: existe' ELSE 'INFO: no existe' END

-- Informativo: si existe, los testigos PERSONAL también se validan contra personal_personas.
UNION ALL
SELECT 'INFO tabla public.personal_personas',
       CASE WHEN to_regclass('public.personal_personas') IS NOT NULL THEN 'INFO: existe' ELSE 'INFO: no existe' END

-- Informativo: valores de estatus de docentes y empleados (se considera activo = 'activo').
UNION ALL
SELECT 'INFO docentes.estatus = ' || coalesce(estatus::text, 'NULL') || ' (' || count(*) || ')', 'INFO'
FROM public.docentes GROUP BY estatus

UNION ALL
SELECT 'INFO empleados.estatus = ' || coalesce(estatus::text, 'NULL') || ' (' || count(*) || ')', 'INFO'
FROM public.empleados GROUP BY estatus
) AS x
-- Primero lo que bloquea (FALTA / YA EXISTE), luego OK y al final lo informativo.
ORDER BY CASE WHEN resultado IN ('FALTA', 'YA EXISTE') THEN 0 WHEN resultado = 'OK' THEN 1 ELSE 2 END, comprobacion;
