-- ======================================================================================
-- ESQUEMA COMPLETO Y CONSOLIDADO DE BASE DE DATOS: SISTEMA UNIVERSITARIO / CONTROL DE PAGOS
-- ======================================================================================
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase -> SQL Editor en orden secuencial.
--   2. Las tablas, extensiones, secuencias, vistas, funciones RPC y políticas RLS están
--      ordenadas estrictamente por árbol de dependencias.
--   3. Este esquema es 100% autosuficiente para desplegar una base de datos nueva desde cero
--      o para validar/corregir instalaciones existentes.
-- ======================================================================================

-- ==========================================
-- 0. EXTENSIONES DE POSTGRESQL
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLAS INDEPENDIENTES Y CATÁLOGOS BASE
-- ==========================================

-- Configuración global de la aplicación (KV store)
CREATE TABLE IF NOT EXISTS public.configuracion_app (
  id text NOT NULL,
  valor text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT configuracion_app_pkey PRIMARY KEY (id)
);

-- Catálogos auxiliares (conceptos, becas, grados, turnos, estatus, etc.)
CREATE TABLE IF NOT EXISTS public.catalogos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY[
    'concepto'::text, 
    'licenciatura'::text, 
    'beca_tipo'::text, 
    'beca_porcentaje'::text, 
    'grado'::text, 
    'turno'::text, 
    'estatus_alumno'::text, 
    'empresa_ss'::text, 
    'modalidad_titulacion'::text,
    'observacion_plan'::text
  ])),
  valor text NOT NULL,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  CONSTRAINT catalogos_pkey PRIMARY KEY (id)
);

-- Oferta académica oficial: Carreras (Fuente única de la oferta educativa)
CREATE TABLE IF NOT EXISTS public.carreras (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  clave character varying,
  nivel_educativo text DEFAULT 'Licenciatura'::text,
  calificacion_minima integer DEFAULT 5,
  calificacion_maxima integer DEFAULT 10,
  calificacion_minima_aprobatoria numeric DEFAULT 6,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT carreras_pkey PRIMARY KEY (id)
);

-- Ciclos escolares (Periodos lectivos / cuatrimestres / semestres)
CREATE TABLE IF NOT EXISTS public.ciclos_escolares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  meses_abarca text,
  anio integer,
  anio_fin integer,
  tipo_periodo text,
  fecha_inicio date,
  fecha_termino date,
  activo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ciclos_escolares_pkey PRIMARY KEY (id)
);

-- Plantilla docente
CREATE TABLE IF NOT EXISTS public.docentes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clave_legado character varying NOT NULL UNIQUE,
  nombre_completo text NOT NULL,
  rfc character varying,
  curp character varying,
  email text,
  estatus character varying DEFAULT 'activo'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT docentes_pkey PRIMARY KEY (id)
);

-- Empleados administrativos / Recursos Humanos / Firmantes oficiales
CREATE TABLE IF NOT EXISTS public.empleados (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombres text NOT NULL,
  apellido_paterno text NOT NULL,
  apellido_materno text,
  rfc character varying,
  curp character varying,
  clave_puesto integer,
  puesto text,
  departamento text,
  tipo_contratacion text,
  tipo_jornada text,
  estatus character varying DEFAULT 'activo'::character varying,
  fecha_nacimiento date,
  sexo character varying,
  estado_civil character varying,
  nivel_estudios character varying,
  nivel_estudios_estado character varying,
  direccion text,
  fecha_ingreso date,
  telefono character varying,
  documentos_entregados jsonb DEFAULT '{}'::jsonb,
  enlace_drive text,
  firmante_certificados boolean DEFAULT false,
  firmante_titulos boolean DEFAULT false,
  firmante_boletas boolean DEFAULT false,
  titulo_academico character varying,
  firma_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT empleados_pkey PRIMARY KEY (id)
);

-- Planes de acción NOM-035 (Recursos Humanos)
CREATE TABLE IF NOT EXISTS public.nom035_planes_accion (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  titulo text NOT NULL,
  descripcion text,
  nivel_intervencion character varying NOT NULL,
  estatus character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nom035_planes_accion_pkey PRIMARY KEY (id)
);

-- ==========================================
-- 2. USUARIOS Y PREFERENCIAS (AUTH INTEGRATION)
-- ==========================================

-- Tabla de perfiles de usuario vinculada con auth.users
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text,
  rol text NOT NULL CHECK (rol = ANY (ARRAY[
    'ADMINISTRADOR'::text, 
    'COORDINADOR'::text, 
    'CAJERO'::text, 
    'DOCENTE'::text,
    'COORDINADOR CONTROL ESCOLAR'::text,
    'COORDINADOR FINANCIERO'::text,
    'COORDINADOR RECURSOS HUMANOS'::text,
    'COORDINADOR ACADEMICO'::text
  ])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  preferencia_tema text DEFAULT 'light'::text,
  ultimo_ciclo_id uuid,
  auth_id uuid,
  activo boolean DEFAULT true,
  docente_id uuid,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_ultimo_ciclo_id_fkey FOREIGN KEY (ultimo_ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL,
  CONSTRAINT usuarios_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id ON public.usuarios(auth_id);

-- Preferencias de interfaz gráfica por usuario
CREATE TABLE IF NOT EXISTS public.ui_preferencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  modulo text NOT NULL,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ui_preferencias_pkey PRIMARY KEY (id)
);

-- ==========================================
-- 3. PLANES DE ESTUDIO Y ALUMNOS (NIVEL ACADÉMICO)
-- ==========================================

-- Versiones curriculares asociadas a una carrera
CREATE TABLE IF NOT EXISTS public.planes_estudio (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clave_legado text NOT NULL UNIQUE,
  nombre text NOT NULL,
  carrera_id uuid NOT NULL,
  licenciatura_id uuid, -- Campo legado de transición hacia catalogos
  estatus text DEFAULT 'ACTIVO'::text,
  creditos_obligatorios numeric DEFAULT 0,
  tipo_periodo text DEFAULT 'Semestral'::text,
  total_periodos integer DEFAULT 10, -- Clave para reglas de negocio (ej. 8 periodos para Psicología, 10 para Derecho)
  total_asignaturas integer DEFAULT 0,
  modelo text DEFAULT 'RIGIDO'::text,
  rvoe text,
  fecha_rvoe date,
  id_tipo_periodo integer,
  id_plan_certificacion integer,
  id_autorizacion_reconocimiento integer,
  autorizacion_reconocimiento character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT planes_estudio_pkey PRIMARY KEY (id),
  CONSTRAINT planes_estudio_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id) ON DELETE RESTRICT,
  CONSTRAINT planes_estudio_licenciatura_id_fkey FOREIGN KEY (licenciatura_id) REFERENCES public.catalogos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_planes_estudio_carrera ON public.planes_estudio(carrera_id);

-- Expediente general del alumno
CREATE TABLE IF NOT EXISTS public.alumnos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  matricula text UNIQUE,
  nombre_completo text NOT NULL,
  apellido_paterno text,
  apellido_materno text,
  nombres text,
  nombre_requiere_revision boolean DEFAULT false,
  licenciatura text, -- Campo legado (la carrera vigente se deriva de alumno_programas)
  grado_actual text,
  turno text,
  estatus text DEFAULT 'ACTIVO'::text,
  beca_porcentaje text DEFAULT '0%'::text,
  beca_tipo text DEFAULT 'NINGUNA'::text,
  saldo_a_favor numeric DEFAULT 0.00,
  ciclo_ultima_asignacion_grado uuid,
  observaciones_pago_titulacion text,
  -- Datos personales y RENAPO
  curp character varying UNIQUE,
  fecha_nacimiento date,
  estado_nacimiento text,
  nacionalidad text DEFAULT 'MEXICANA'::text,
  sexo character varying CHECK (sexo::text = ANY (ARRAY['H'::character varying, 'M'::character varying]::text[])),
  id_sexo integer,
  -- Domicilio y contacto
  domicilio text,
  cp character varying,
  municipio text,
  estado text,
  telefono character varying,
  celular character varying,
  email text,
  -- Procedencia y sociodemográficos
  escuela_procedencia text,
  estado_escolaridad text,
  discapacidad text,
  lengua_indigena text,
  -- Sincronización y CRM
  crm_lead_id uuid,
  observaciones_rechazo text,
  sincronizado_el timestamp with time zone,
  kardex_sincronizado boolean DEFAULT false,
  kardex_sincronizado_at timestamp with time zone,
  numero_legado integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alumnos_pkey PRIMARY KEY (id),
  CONSTRAINT alumnos_ciclo_ultima_asignacion_grado_fkey FOREIGN KEY (ciclo_ultima_asignacion_grado) REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alumnos_matricula ON public.alumnos(matricula);
CREATE INDEX IF NOT EXISTS idx_alumnos_curp ON public.alumnos(curp);
CREATE INDEX IF NOT EXISTS idx_alumnos_apellido_paterno ON public.alumnos(apellido_paterno);
CREATE INDEX IF NOT EXISTS idx_alumnos_crm_lead_id ON public.alumnos(crm_lead_id) WHERE crm_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alumnos_estatus ON public.alumnos(estatus);

-- Evaluaciones NOM-035 (empleados)
CREATE TABLE IF NOT EXISTS public.nom035_evaluaciones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  empleado_id uuid,
  respuestas jsonb NOT NULL,
  calificacion_final numeric NOT NULL,
  nivel_riesgo character varying NOT NULL,
  tipo_guia character varying DEFAULT 'GUIA_II'::character varying,
  calificacion_desglose jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nom035_evaluaciones_pkey PRIMARY KEY (id),
  CONSTRAINT nom035_evaluaciones_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE CASCADE
);

-- ==========================================
-- 4. ESTRUCTURA CURRICULAR Y CONTROL ESCOLAR
-- ==========================================

-- Asignaturas por plan de estudios
CREATE TABLE IF NOT EXISTS public.asignaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  clave_legado text NOT NULL,
  nombre text NOT NULL,
  creditos numeric DEFAULT 0,
  numero_periodo integer DEFAULT 1,
  etapa_clave text,
  etapa_nombre text,
  clasificacion_nombre text DEFAULT 'Obligatoria'::text,
  clasificacion_clave text DEFAULT '263'::text,
  clave_certificacion integer,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asignaturas_pkey PRIMARY KEY (id),
  CONSTRAINT asignaturas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_estudio(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asignaturas_plan ON public.asignaturas(plan_id);

-- Grupos escolares
CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  codigo_grupo character varying NOT NULL,
  grado integer,
  es_multigrado boolean NOT NULL DEFAULT false,
  grado_inicio integer,
  grado_fin integer,
  turno character varying,
  estatus character varying DEFAULT 'activo'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grupos_pkey PRIMARY KEY (id),
  CONSTRAINT grupos_rango_multigrado_valido CHECK (
    (es_multigrado = false AND grado_inicio IS NULL AND grado_fin IS NULL)
    OR (es_multigrado = true AND grado_inicio >= 1 AND grado_fin >= grado_inicio)
  ),
  CONSTRAINT grupos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE CASCADE,
  CONSTRAINT grupos_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_estudio(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grupos_ciclo_plan ON public.grupos(ciclo_id, plan_id);

-- Asignación docente-grupo-materia
CREATE TABLE IF NOT EXISTS public.docentes_grupos_asignaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  docente_id uuid,
  grupo_id uuid NOT NULL,
  asignatura_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT docentes_grupos_asignaturas_pkey PRIMARY KEY (id),
  CONSTRAINT docentes_grupos_asignaturas_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id) ON DELETE SET NULL,
  CONSTRAINT docentes_grupos_asignaturas_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id) ON DELETE CASCADE,
  CONSTRAINT docentes_grupos_asignaturas_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES public.asignaturas(id) ON DELETE CASCADE
);

-- Relación histórica del alumno con planes de estudio (FUENTE OFICIAL DE CARRERA VIGENTE)
CREATE TABLE IF NOT EXISTS public.alumno_programas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  alumno_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  es_vigente boolean NOT NULL DEFAULT true,
  estatus text DEFAULT 'CURSANDO'::text,
  motivo_estatus text, -- 'REGULAR', 'CAMBIO_DE_CARRERA', 'PLAN_CONCLUIDO', 'REINGRESO', 'DESERCION_VOLUNTARIA', 'CARRERA_SIMULTANEA', 'SEGUNDA_CARRERA'
  estatus_previo text, -- Estatus previo a reactivación/reingreso para reversibilidad
  fecha_ultimo_cambio timestamp with time zone DEFAULT now(),
  fecha_inscripcion date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alumno_programas_pkey PRIMARY KEY (id),
  CONSTRAINT alumno_programas_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE,
  CONSTRAINT alumno_programas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_estudio(id) ON DELETE RESTRICT,
  CONSTRAINT uq_alumno_plan UNIQUE (alumno_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_alumno_programas_alumno ON public.alumno_programas(alumno_id);
CREATE INDEX IF NOT EXISTS idx_alumno_programas_plan ON public.alumno_programas(plan_id);
CREATE INDEX IF NOT EXISTS idx_alumno_programas_vigente ON public.alumno_programas(alumno_id, es_vigente);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_programa_vigente_unico ON public.alumno_programas(alumno_id) WHERE (es_vigente = true);

-- Función y Trigger para blindar la coherencia institucional entre estatus y motivo_estatus
CREATE OR REPLACE FUNCTION public.fn_blindar_motivo_alumno_programa()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Si el plan es un logro oficial concluido, su motivo es inalterablemente PLAN_CONCLUIDO
  IF NEW.estatus IN ('EGRESADO', 'TITULADO') THEN
    NEW.motivo_estatus := 'PLAN_CONCLUIDO';
  END IF;

  -- 2. Si el plan está en baja pero viene marcado indebidamente como PLAN_CONCLUIDO o REGULAR
  IF NEW.estatus IN ('BAJA', 'BAJA_POR_CAMBIO') AND (NEW.motivo_estatus IS NULL OR NEW.motivo_estatus IN ('PLAN_CONCLUIDO', 'REGULAR', 'CARRERA_SIMULTANEA', 'SEGUNDA_CARRERA')) THEN
    NEW.motivo_estatus := CASE 
      WHEN NEW.estatus = 'BAJA_POR_CAMBIO' THEN 'CAMBIO_DE_CARRERA'
      ELSE 'DESERCION_VOLUNTARIA'
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blindar_motivo_alumno_programa ON public.alumno_programas;
CREATE TRIGGER trg_blindar_motivo_alumno_programa
BEFORE INSERT OR UPDATE OF estatus, motivo_estatus ON public.alumno_programas
FOR EACH ROW
EXECUTE FUNCTION public.fn_blindar_motivo_alumno_programa();

-- Función y Trigger para recalcular automáticamente el estatus institucional del alumno
-- Principio Rector: El programa marcado como es_vigente = true gobierna el estatus y carrera del alumno.
-- Fallback jerárquico Saeko/Banner si ningún programa tiene la bandera vigente explícita.
CREATE OR REPLACE FUNCTION public.fn_recalcular_estatus_institucional_alumno()
RETURNS TRIGGER AS $$
DECLARE
  v_alumno_id uuid;
  v_nuevo_estatus text;
  v_vigente_estatus text;
  v_vigente_licenciatura text;
  v_has_cursando boolean;
  v_has_titulado boolean;
  v_has_egresado boolean;
  v_has_baja boolean;
BEGIN
  -- Determinar el ID del alumno involucrado
  v_alumno_id := COALESCE(NEW.alumno_id, OLD.alumno_id);

  -- 1. Buscar si existe un programa marcado como VIGENTE (Programa Rector)
  SELECT 
    ap.estatus,
    c.nombre
  INTO 
    v_vigente_estatus,
    v_vigente_licenciatura
  FROM public.alumno_programas ap
  LEFT JOIN public.planes_estudio pe ON pe.id = ap.plan_id
  LEFT JOIN public.carreras c ON c.id = pe.carrera_id
  WHERE ap.alumno_id = v_alumno_id
    AND ap.es_vigente = true
  LIMIT 1;

  -- 2. Si hay un programa vigente, dicho programa rige el estatus institucional
  IF v_vigente_estatus IS NOT NULL THEN
    IF v_vigente_estatus = 'CURSANDO' THEN
      v_nuevo_estatus := 'ACTIVO';
    ELSIF v_vigente_estatus = 'TITULADO' THEN
      v_nuevo_estatus := 'TITULADO';
    ELSIF v_vigente_estatus = 'EGRESADO' THEN
      v_nuevo_estatus := 'EGRESADO';
    ELSIF v_vigente_estatus IN ('BAJA', 'BAJA_POR_CAMBIO') THEN
      v_nuevo_estatus := 'BAJA';
    ELSE
      v_nuevo_estatus := v_vigente_estatus;
    END IF;
  ELSE
    -- 3. Fallback: Si no hay ninguno marcado explícitamente como vigente,
    --    evaluar jerarquía de estados entre todos sus programas
    SELECT 
      COALESCE(bool_or(estatus = 'CURSANDO'), false),
      COALESCE(bool_or(estatus = 'TITULADO'), false),
      COALESCE(bool_or(estatus = 'EGRESADO'), false),
      COALESCE(bool_or(estatus IN ('BAJA', 'BAJA_POR_CAMBIO')), false)
    INTO v_has_cursando, v_has_titulado, v_has_egresado, v_has_baja
    FROM public.alumno_programas
    WHERE alumno_id = v_alumno_id;

    IF v_has_cursando THEN
      v_nuevo_estatus := 'ACTIVO';
    ELSIF v_has_titulado THEN
      v_nuevo_estatus := 'TITULADO';
    ELSIF v_has_egresado THEN
      v_nuevo_estatus := 'EGRESADO';
    ELSIF v_has_baja THEN
      v_nuevo_estatus := 'BAJA';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- 4. Actualizar tabla alumnos únicamente si cambió el estatus o la licenciatura
  --    y no es un prospecto en trámite (PENDIENTE_APROBACION, RECHAZADO)
  UPDATE public.alumnos
  SET 
    estatus = v_nuevo_estatus,
    licenciatura = COALESCE(v_vigente_licenciatura, licenciatura)
  WHERE id = v_alumno_id
    AND (estatus IS DISTINCT FROM v_nuevo_estatus OR (v_vigente_licenciatura IS NOT NULL AND licenciatura IS DISTINCT FROM v_vigente_licenciatura))
    AND estatus NOT IN ('PENDIENTE_APROBACION', 'RECHAZADO');

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalcular_estatus_institucional_alumno ON public.alumno_programas;
CREATE TRIGGER trg_recalcular_estatus_institucional_alumno
AFTER INSERT OR UPDATE OF estatus, es_vigente OR DELETE ON public.alumno_programas
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalcular_estatus_institucional_alumno();

-- Asignación de alumnos a grupos
CREATE TABLE IF NOT EXISTS public.alumnos_grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL,
  grupo_id uuid NOT NULL,
  asignatura_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alumnos_grupos_pkey PRIMARY KEY (id),
  CONSTRAINT alumnos_grupos_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE,
  CONSTRAINT alumnos_grupos_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id) ON DELETE CASCADE,
  CONSTRAINT alumnos_grupos_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES public.asignaturas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alumnos_grupos_alumno ON public.alumnos_grupos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_grupos_grupo ON public.alumnos_grupos(grupo_id);

-- Kardex e historial académico de calificaciones
CREATE TABLE IF NOT EXISTS public.inscripciones_academicas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL,
  ciclo_id uuid NOT NULL,
  asignatura_id uuid NOT NULL,
  parcial_1 numeric DEFAULT NULL::numeric,
  parcial_2 numeric DEFAULT NULL::numeric,
  parcial_3 numeric DEFAULT NULL::numeric,
  promedio_calculado numeric DEFAULT NULL::numeric,
  calificacion_final numeric DEFAULT NULL::numeric,
  modificada_manualmente boolean DEFAULT false,
  observaciones text,
  tipo_evaluacion text DEFAULT 'Ordinario'::text,
  estatus text DEFAULT 'Cursando'::text,
  ciclo_legado text,
  bloqueo_p1 boolean DEFAULT false,
  bloqueo_p2 boolean DEFAULT false,
  bloqueo_p3 boolean DEFAULT false,
  bloqueo_final boolean DEFAULT false,
  solicitud_p1 boolean DEFAULT false,
  solicitud_p2 boolean DEFAULT false,
  solicitud_p3 boolean DEFAULT false,
  solicitud_final boolean DEFAULT false,
  id_observacion_certificacion integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inscripciones_academicas_pkey PRIMARY KEY (id),
  CONSTRAINT inscripciones_academicas_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE,
  CONSTRAINT inscripciones_academicas_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT,
  CONSTRAINT inscripciones_academicas_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES public.asignaturas(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_inscripciones_alumno_ciclo ON public.inscripciones_academicas(alumno_id, ciclo_id);

-- ==========================================
-- 5. MÓDULO FINANCIERO Y CONTROL DE PAGOS
-- ==========================================

-- Plantillas maestras de cobro por ciclo
CREATE TABLE IF NOT EXISTS public.plantillas_plan (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ciclo_id uuid,
  tipo_plan text DEFAULT 'Cuatrimestral'::text,
  descripcion text,
  activo boolean DEFAULT true,
  concepto_1 text, fecha_1 text, cantidad_1 numeric,
  concepto_2 text, fecha_2 text, cantidad_2 numeric,
  concepto_3 text, fecha_3 text, cantidad_3 numeric,
  concepto_4 text, fecha_4 text, cantidad_4 numeric,
  concepto_5 text, fecha_5 text, cantidad_5 numeric,
  concepto_6 text, fecha_6 text, cantidad_6 numeric,
  concepto_7 text, fecha_7 text, cantidad_7 numeric,
  concepto_8 text, fecha_8 text, cantidad_8 numeric,
  concepto_9 text, fecha_9 text, cantidad_9 numeric,
  concepto_10 text, fecha_10 date, cantidad_10 numeric,
  concepto_11 text, fecha_11 date, cantidad_11 numeric,
  concepto_12 text, fecha_12 date, cantidad_12 numeric,
  concepto_13 text, fecha_13 date, cantidad_13 numeric,
  concepto_14 text, fecha_14 date, cantidad_14 numeric,
  concepto_15 text, fecha_15 date, cantidad_15 numeric,
  concepto_16 text, fecha_16 date, cantidad_16 numeric,
  concepto_17 text, fecha_17 date, cantidad_17 numeric,
  concepto_18 text, fecha_18 date, cantidad_18 numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plantillas_plan_pkey PRIMARY KEY (id),
  CONSTRAINT plantillas_plan_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL
);

-- Planes de pago individualizados por alumno
CREATE TABLE IF NOT EXISTS public.planes_pago (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL,
  ciclo_id uuid NOT NULL,
  no_plan_pagos text,
  fecha_plan text,
  beca_porcentaje text,
  beca_tipo text,
  grado_turno_inscrito text,
  licenciatura text, -- Snapshot histórico del nombre de carrera
  tipo_plan text DEFAULT 'Cuatrimestral'::text,
  grado text,
  turno text,
  concepto_1 text, fecha_1 text, cantidad_1 numeric, estatus_1 text,
  concepto_2 text, fecha_2 text, cantidad_2 numeric, estatus_2 text,
  concepto_3 text, fecha_3 text, cantidad_3 numeric, estatus_3 text,
  concepto_4 text, fecha_4 text, cantidad_4 numeric, estatus_4 text,
  concepto_5 text, fecha_5 text, cantidad_5 numeric, estatus_5 text,
  concepto_6 text, fecha_6 text, cantidad_6 numeric, estatus_6 text,
  concepto_7 text, fecha_7 text, cantidad_7 numeric, estatus_7 text,
  concepto_8 text, fecha_8 text, cantidad_8 numeric, estatus_8 text,
  concepto_9 text, fecha_9 text, cantidad_9 numeric, estatus_9 text,
  concepto_10 text, fecha_10 date, cantidad_10 numeric, estatus_10 text DEFAULT 'PENDIENTE'::text,
  concepto_11 text, fecha_11 date, cantidad_11 numeric, estatus_11 text DEFAULT 'PENDIENTE'::text,
  concepto_12 text, fecha_12 date, cantidad_12 numeric, estatus_12 text DEFAULT 'PENDIENTE'::text,
  concepto_13 text, fecha_13 date, cantidad_13 numeric, estatus_13 text DEFAULT 'PENDIENTE'::text,
  concepto_14 text, fecha_14 date, cantidad_14 numeric, estatus_14 text DEFAULT 'PENDIENTE'::text,
  concepto_15 text, fecha_15 date, cantidad_15 numeric, estatus_15 text DEFAULT 'PENDIENTE'::text,
  concepto_16 text, fecha_16 date, cantidad_16 numeric, estatus_16 text DEFAULT 'PENDIENTE'::text,
  concepto_17 text, fecha_17 date, cantidad_17 numeric, estatus_17 text DEFAULT 'PENDIENTE'::text,
  concepto_18 text, fecha_18 date, cantidad_18 numeric, estatus_18 text DEFAULT 'PENDIENTE'::text,
  desglose_conceptos jsonb DEFAULT '[]'::jsonb,
  desglose_total_bruto numeric DEFAULT 0,
  desglose_descuento_porcentaje numeric DEFAULT 0,
  desglose_descuento_monto numeric DEFAULT 0,
  desglose_total_neto numeric DEFAULT 0,
  observaciones jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT planes_pago_pkey PRIMARY KEY (id),
  CONSTRAINT planes_pago_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE,
  CONSTRAINT planes_pago_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_planes_pago_alumno_ciclo ON public.planes_pago(alumno_id, ciclo_id);

-- Desglose normalizado de conceptos de pago
CREATE TABLE IF NOT EXISTS public.planes_pago_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  indice_concepto integer NOT NULL CHECK (indice_concepto >= 1 AND indice_concepto <= 18),
  concepto text NOT NULL,
  fecha_vencimiento date,
  cantidad numeric NOT NULL DEFAULT 0.00,
  estatus text DEFAULT 'PENDIENTE'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT planes_pago_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT planes_pago_detalles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_pago(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planes_pago_detalles_plan ON public.planes_pago_detalles(plan_id);

-- Secuencia para folios únicos de recibo (OBLIGATORIA antes de recibos)
CREATE SEQUENCE IF NOT EXISTS public.recibos_folio_seq START WITH 1000 INCREMENT BY 1;

-- Recibos oficiales de cobro
CREATE TABLE IF NOT EXISTS public.recibos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folio integer NOT NULL DEFAULT nextval('public.recibos_folio_seq'::regclass) UNIQUE,
  fecha_recibo date NOT NULL,
  fecha_pago date NOT NULL,
  alumno_id uuid,
  ciclo_id uuid,
  total numeric NOT NULL,
  forma_pago text NOT NULL,
  banco text NOT NULL,
  estatus text DEFAULT 'ACTIVO'::text CHECK (estatus = ANY (ARRAY['ACTIVO'::text, 'CANCELADO'::text])),
  uso_saldo_a_favor numeric DEFAULT 0.00,
  requiere_factura boolean DEFAULT false,
  estatus_factura character varying DEFAULT 'NO APLICA'::character varying,
  folio_fiscal character varying,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT recibos_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE SET NULL,
  CONSTRAINT recibos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recibos_alumno ON public.recibos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_recibos_folio ON public.recibos(folio);

-- Detalles de conceptos facturados en cada recibo
CREATE TABLE IF NOT EXISTS public.recibos_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recibo_id uuid NOT NULL,
  cantidad integer NOT NULL,
  concepto text NOT NULL,
  costo_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  indice_concepto_plan integer,
  observaciones text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT recibos_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_detalles_recibo_id_fkey FOREIGN KEY (recibo_id) REFERENCES public.recibos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recibos_detalles_recibo ON public.recibos_detalles(recibo_id);

-- ==========================================
-- 6. SERVICIO SOCIAL, TITULACIÓN Y CERTIFICACIÓN
-- ==========================================

-- Servicio social
CREATE TABLE IF NOT EXISTS public.servicio_social (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL,
  nombre_empresa text NOT NULL,
  tipo_empresa text NOT NULL CHECK (tipo_empresa = ANY (ARRAY['PRIVADA'::text, 'PUBLICA'::text])),
  fecha_registro date NOT NULL,
  fecha_inicio date,
  fecha_termino date,
  horas_cubrir integer NOT NULL,
  nombre_programa text,
  estatus text NOT NULL DEFAULT 'EN_CURSO'::text,
  variante_legal text NOT NULL DEFAULT 'ART_55'::text,
  art52_motivo text,
  art52_doc_acta text NOT NULL DEFAULT 'PENDIENTE'::text,
  art52_doc_expediente text NOT NULL DEFAULT 'PENDIENTE'::text,
  art91_req_constancia boolean NOT NULL DEFAULT false,
  art91_req_comprobantes boolean NOT NULL DEFAULT false,
  art91_req_informe boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT servicio_social_pkey PRIMARY KEY (id),
  CONSTRAINT servicio_social_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_servicio_social_alumno ON public.servicio_social(alumno_id);

-- Ficha de titulación DGAIR
CREATE TABLE IF NOT EXISTS public.ficha_titulacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL UNIQUE,
  modalidad text,
  pago_titulacion text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  certificado_estudios text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  ingles text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  servicio_social_req text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  fotografias text NOT NULL DEFAULT 'PENDIENTES'::text,
  doc_antecedente text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_antecedente_nota text,
  doc_acta_nacimiento text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_acta_nacimiento_nota text,
  doc_curp text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_curp_nota text,
  doc_titulo_profesional text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_titulo_profesional_nota text,
  doc_cedula_profesional text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_cedula_profesional_nota text,
  promedio_alto_rendimiento text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  fecha_inicio_tramite date,
  fecha_estimada_culminacion date,
  tramite_completado boolean NOT NULL DEFAULT false,
  fecha_completado timestamp with time zone,
  enlace_drive text,
  -- Acta de Titulación y Protocolo Oficial
  libro integer,
  foja integer,
  folio_control text,
  fecha_examen date,
  fecha_exencion date,
  alumno_programa_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ficha_titulacion_pkey PRIMARY KEY (id),
  CONSTRAINT ficha_titulacion_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE,
  CONSTRAINT ficha_titulacion_alumno_programa_id_fkey FOREIGN KEY (alumno_programa_id) REFERENCES public.alumno_programas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ficha_titulacion_folio ON public.ficha_titulacion(folio_control);

-- Ficha de certificación DGAIR
CREATE TABLE IF NOT EXISTS public.ficha_certificacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL UNIQUE,
  pago_certificado text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  tipo_certificado text,
  doc_acta_nacimiento text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_acta_nacimiento_nota text,
  doc_curp text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_curp_nota text,
  doc_antecedente text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_antecedente_nota text,
  doc_titulo_profesional text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_titulo_profesional_nota text,
  doc_cedula_profesional text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  doc_cedula_profesional_nota text,
  fecha_inicio_tramite date,
  fecha_termino_tramite date,
  tramite_completado boolean NOT NULL DEFAULT false,
  fecha_completado timestamp with time zone,
  enlace_drive text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ficha_certificacion_pkey PRIMARY KEY (id),
  CONSTRAINT ficha_certificacion_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id) ON DELETE CASCADE
);

-- ==========================================
-- 7. TABLAS LEGADAS (SOPORTE HISTÓRICO)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.control_pagos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre_alumno text NOT NULL,
  no_plan_pagos text,
  fecha_plan text,
  beca_porcentaje text,
  beca_tipo text,
  concepto_1 text, fecha_1 text, cantidad_1 numeric, estatus_1 text,
  concepto_2 text, fecha_2 text, cantidad_2 numeric, estatus_2 text,
  concepto_3 text, fecha_3 text, cantidad_3 numeric, estatus_3 text,
  concepto_4 text, fecha_4 text, cantidad_4 numeric, estatus_4 text,
  concepto_5 text, fecha_5 text, cantidad_5 numeric, estatus_5 text,
  licenciatura text,
  grado_turno text,
  CONSTRAINT control_pagos_pkey PRIMARY KEY (id)
);

-- ======================================================================================
-- 8. VISTAS DEL SISTEMA (CRÍTICAS PARA SERVICIOS FRONTEND)
-- ======================================================================================

-- Vista requerida por pagosService.ts para la consulta consolidada de planes y cobros
DROP VIEW IF EXISTS public.vista_planes_pago CASCADE;
CREATE OR REPLACE VIEW public.vista_planes_pago AS 
SELECT 
    pp.id,
    pp.alumno_id,
    pp.ciclo_id,
    pp.no_plan_pagos,
    pp.fecha_plan,
    pp.beca_porcentaje,
    pp.beca_tipo,
    pp.tipo_plan,
    pp.grado,
    pp.turno,
    pp.licenciatura,
    pp.grado_turno_inscrito AS grado_turno,
    pp.desglose_conceptos,
    pp.desglose_total_bruto,
    pp.desglose_descuento_porcentaje,
    pp.desglose_descuento_monto,
    pp.desglose_total_neto,
    pp.observaciones,
    a.nombre_completo AS nombre_alumno,
    c.nombre AS ciclo_escolar,
    pp.concepto_1, pp.fecha_1, pp.cantidad_1, pp.estatus_1,
    pp.concepto_2, pp.fecha_2, pp.cantidad_2, pp.estatus_2,
    pp.concepto_3, pp.fecha_3, pp.cantidad_3, pp.estatus_3,
    pp.concepto_4, pp.fecha_4, pp.cantidad_4, pp.estatus_4,
    pp.concepto_5, pp.fecha_5, pp.cantidad_5, pp.estatus_5,
    pp.concepto_6, pp.fecha_6, pp.cantidad_6, pp.estatus_6,
    pp.concepto_7, pp.fecha_7, pp.cantidad_7, pp.estatus_7,
    pp.concepto_8, pp.fecha_8, pp.cantidad_8, pp.estatus_8,
    pp.concepto_9, pp.fecha_9, pp.cantidad_9, pp.estatus_9,
    pp.concepto_10, pp.fecha_10, pp.cantidad_10, pp.estatus_10,
    pp.concepto_11, pp.fecha_11, pp.cantidad_11, pp.estatus_11,
    pp.concepto_12, pp.fecha_12, pp.cantidad_12, pp.estatus_12,
    pp.concepto_13, pp.fecha_13, pp.cantidad_13, pp.estatus_13,
    pp.concepto_14, pp.fecha_14, pp.cantidad_14, pp.estatus_14,
    pp.concepto_15, pp.fecha_15, pp.cantidad_15, pp.estatus_15,
    pp.concepto_16, pp.fecha_16, pp.cantidad_16, pp.estatus_16,
    pp.concepto_17, pp.fecha_17, pp.cantidad_17, pp.estatus_17,
    pp.concepto_18, pp.fecha_18, pp.cantidad_18, pp.estatus_18
FROM public.planes_pago pp
LEFT JOIN public.alumnos a ON pp.alumno_id = a.id
LEFT JOIN public.ciclos_escolares c ON pp.ciclo_id = c.id;

-- Vista para normalización de carreras: Deriva la carrera vigente del programa académico activo (Plan Rector)
DROP VIEW IF EXISTS public.v_alumno_carrera CASCADE;
CREATE OR REPLACE VIEW public.v_alumno_carrera AS
SELECT 
    a.id AS alumno_id,
    a.matricula,
    a.nombre_completo,
    a.estatus AS estatus_alumno,
    ap.id AS programa_id,
    ap.estatus AS estatus_programa,
    ap.es_vigente,
    ap.motivo_estatus,
    ap.estatus_previo,
    ap.fecha_ultimo_cambio,
    ap.fecha_inscripcion,
    p.id AS plan_id,
    p.clave_legado AS plan_clave,
    p.nombre AS plan_nombre,
    p.total_periodos,
    p.rvoe,
    p.fecha_rvoe,
    c.id AS carrera_id,
    c.nombre AS carrera_nombre,
    c.clave AS carrera_clave,
    c.nivel_educativo,
    c.calificacion_minima_aprobatoria
FROM public.alumnos a
LEFT JOIN public.alumno_programas ap ON a.id = ap.alumno_id AND ap.es_vigente = true
LEFT JOIN public.planes_estudio p ON ap.plan_id = p.id
LEFT JOIN public.carreras c ON p.carrera_id = c.id;

GRANT SELECT ON public.v_alumno_carrera TO authenticated, anon;

-- ======================================================================================
-- 9. FUNCIONES DE SEGURIDAD Y HELPERS (SECURITY DEFINER)
-- ======================================================================================

-- Función auxiliar para extraer el rol del usuario autenticado en RLS
CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS text AS $$
  SELECT rol FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT rol FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Función requerida por la pantalla de Login para buscar el email auth por username
CREATE OR REPLACE FUNCTION public.get_auth_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE raw_user_meta_data->>'username' = lower(p_username)
  LIMIT 1;
  
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_auth_email_by_username(text) TO authenticated;

-- Sincronización automática de secuencias tras importaciones CSV masivas
CREATE OR REPLACE FUNCTION public.sync_secuencia_folios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM setval(
    'public.recibos_folio_seq', 
    COALESCE((SELECT MAX(folio) FROM public.recibos), 1000), 
    (SELECT MAX(folio) IS NOT NULL FROM public.recibos)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_secuencia_folios() TO authenticated;

-- Trigger para vincular automáticamente cuentas nuevas de auth.users con public.usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios
  SET auth_id = NEW.id, activo = true
  WHERE username = COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  )
  AND auth_id IS NULL;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.usuarios (id, username, rol, auth_id, activo)
      VALUES (
        gen_random_uuid(),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'rol', 'COORDINADOR'),
        NEW.id,
        true
      ) ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo crear perfil en usuarios para auth_id %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ======================================================================================
-- 10. FUNCIONES RPC TRANSACCIONALES
-- ======================================================================================

-- Registro de pago atómico: Recibo + Detalles + Actualización de Plan + Saldo
CREATE OR REPLACE FUNCTION public.registrar_pago_transaccional(
  p_recibo jsonb,
  p_detalles jsonb,
  p_plan_id uuid DEFAULT NULL,
  p_plan_updates jsonb DEFAULT NULL,
  p_alumno_id uuid DEFAULT NULL,
  p_saldo_delta numeric DEFAULT 0
) RETURNS jsonb AS $$
DECLARE
  v_recibo_id uuid;
  v_folio integer;
  v_detalle record;
  v_key text;
  v_val text;
  v_idx integer;
  v_sql text;
BEGIN
  -- 1. Insertar Recibo
  INSERT INTO public.recibos (
    fecha_recibo, fecha_pago, alumno_id, ciclo_id, total, forma_pago, banco, 
    estatus, requiere_factura, estatus_factura, uso_saldo_a_favor
  ) 
  VALUES (
    (p_recibo->>'fecha_recibo')::date, 
    (p_recibo->>'fecha_pago')::date, 
    (p_recibo->>'alumno_id')::uuid, 
    (p_recibo->>'ciclo_id')::uuid, 
    (p_recibo->>'total')::numeric, 
    p_recibo->>'forma_pago', 
    p_recibo->>'banco', 
    COALESCE(p_recibo->>'estatus', 'ACTIVO'), 
    COALESCE((p_recibo->>'requiere_factura')::boolean, false), 
    CASE WHEN COALESCE((p_recibo->>'requiere_factura')::boolean, false) THEN 'PENDIENTE' ELSE 'NO APLICA' END, 
    COALESCE((p_recibo->>'uso_saldo_a_favor')::numeric, 0)
  ) RETURNING id, folio INTO v_recibo_id, v_folio;

  -- 2. Insertar Detalles
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.recibos_detalles (
      recibo_id, cantidad, concepto, costo_unitario, subtotal, indice_concepto_plan, observaciones
    ) 
    VALUES (
      v_recibo_id, 
      (v_detalle.value->>'cantidad')::integer, 
      v_detalle.value->>'concepto', 
      (v_detalle.value->>'costo_unitario')::numeric, 
      (v_detalle.value->>'subtotal')::numeric, 
      NULLIF(v_detalle.value->>'indice_concepto_plan', '')::integer, 
      v_detalle.value->>'observaciones'
    );
  END LOOP;

  -- 3. Actualizar Plan de Pagos
  IF p_plan_id IS NOT NULL AND p_plan_updates IS NOT NULL THEN
    FOR v_key, v_val IN SELECT key, value#>>'{}' FROM jsonb_each(p_plan_updates) LOOP
      v_val := replace(v_val, '{{FOLIO}}', v_folio::text);
      IF v_key LIKE 'estatus_%' THEN
        v_idx := cast(split_part(v_key, '_', 2) as integer);
        UPDATE public.planes_pago_detalles SET estatus = v_val WHERE plan_id = p_plan_id AND indice_concepto = v_idx;
        v_sql := format('UPDATE public.planes_pago SET %I = %L WHERE id = %L', v_key, v_val, p_plan_id); 
        EXECUTE v_sql;
      ELSE
        v_sql := format('UPDATE public.planes_pago SET %I = %L WHERE id = %L', v_key, v_val, p_plan_id); 
        EXECUTE v_sql;
      END IF;
    END LOOP;
  END IF;

  -- 4. Actualizar Monedero / Saldo a favor
  IF p_alumno_id IS NOT NULL AND p_saldo_delta <> 0 THEN
    UPDATE public.alumnos SET saldo_a_favor = COALESCE(saldo_a_favor, 0) + p_saldo_delta WHERE id = p_alumno_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'folio', v_folio, 'recibo_id', v_recibo_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminación física controlada para administradores (devuelve monedero y reajusta secuencia)
CREATE OR REPLACE FUNCTION public.borrar_recibo_admin(p_recibo_id uuid)
RETURNS void AS $$
DECLARE
  v_uso_saldo numeric;
  v_alumno_id uuid;
  v_recibo record;
BEGIN
  SELECT * INTO v_recibo FROM public.recibos WHERE id = p_recibo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;

  v_uso_saldo := v_recibo.uso_saldo_a_favor;
  v_alumno_id := v_recibo.alumno_id;

  -- Devolver saldo a favor si se usó
  IF v_uso_saldo > 0 AND v_alumno_id IS NOT NULL THEN
    UPDATE public.alumnos
    SET saldo_a_favor = COALESCE(saldo_a_favor, 0) + v_uso_saldo
    WHERE id = v_alumno_id;
  END IF;

  -- Borrar recibo (en cascada sus detalles)
  DELETE FROM public.recibos WHERE id = p_recibo_id;

  -- Reajustar secuencia de folios
  PERFORM setval(
    'public.recibos_folio_seq', 
    COALESCE((SELECT MAX(folio) FROM public.recibos), 1000), 
    (SELECT MAX(folio) IS NOT NULL FROM public.recibos)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================================
-- 11. SEGURIDAD Y POLÍTICAS ROW LEVEL SECURITY (RLS)
-- ======================================================================================

-- Habilitación general de Row Level Security (RLS) en todas las tablas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclos_escolares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carreras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_estudio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docentes_grupos_asignaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nom035_evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nom035_planes_accion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_pago_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_titulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_certificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones_academicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_preferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_pagos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
DROP POLICY IF EXISTS "usuarios: lectura" ON public.usuarios;
CREATE POLICY "usuarios: lectura" ON public.usuarios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "usuarios: gestion admin" ON public.usuarios;
CREATE POLICY "usuarios: gestion admin" ON public.usuarios FOR ALL TO authenticated 
USING (public.get_user_role() = 'ADMINISTRADOR')
WITH CHECK (public.get_user_role() = 'ADMINISTRADOR');

-- Políticas permisivas para personal universitario autenticado
DROP POLICY IF EXISTS "personal: acceso completo catalogos" ON public.catalogos;
CREATE POLICY "personal: acceso completo catalogos" ON public.catalogos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo carreras" ON public.carreras;
CREATE POLICY "personal: acceso completo carreras" ON public.carreras FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo planes_estudio" ON public.planes_estudio;
CREATE POLICY "personal: acceso completo planes_estudio" ON public.planes_estudio FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo ciclos" ON public.ciclos_escolares;
CREATE POLICY "personal: acceso completo ciclos" ON public.ciclos_escolares FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo alumnos" ON public.alumnos;
CREATE POLICY "personal: acceso completo alumnos" ON public.alumnos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo alumno_programas" ON public.alumno_programas;
CREATE POLICY "personal: acceso completo alumno_programas" ON public.alumno_programas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo asignaturas" ON public.asignaturas;
CREATE POLICY "personal: acceso completo asignaturas" ON public.asignaturas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo grupos" ON public.grupos;
CREATE POLICY "personal: acceso completo grupos" ON public.grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo docentes" ON public.docentes;
CREATE POLICY "personal: acceso completo docentes" ON public.docentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo docentes_grupos_asignaturas" ON public.docentes_grupos_asignaturas;
CREATE POLICY "personal: acceso completo docentes_grupos_asignaturas" ON public.docentes_grupos_asignaturas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo alumnos_grupos" ON public.alumnos_grupos;
CREATE POLICY "personal: acceso completo alumnos_grupos" ON public.alumnos_grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo academicos" ON public.inscripciones_academicas;
CREATE POLICY "personal: acceso completo academicos" ON public.inscripciones_academicas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo plantillas_plan" ON public.plantillas_plan;
CREATE POLICY "personal: acceso completo plantillas_plan" ON public.plantillas_plan FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo planes_pago" ON public.planes_pago;
CREATE POLICY "personal: acceso completo planes_pago" ON public.planes_pago FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo planes_pago_detalles" ON public.planes_pago_detalles;
CREATE POLICY "personal: acceso completo planes_pago_detalles" ON public.planes_pago_detalles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo recibos" ON public.recibos;
CREATE POLICY "personal: acceso completo recibos" ON public.recibos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo recibos_detalles" ON public.recibos_detalles;
CREATE POLICY "personal: acceso completo recibos_detalles" ON public.recibos_detalles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo servicio_social" ON public.servicio_social;
CREATE POLICY "personal: acceso completo servicio_social" ON public.servicio_social FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo ficha_titulacion" ON public.ficha_titulacion;
CREATE POLICY "personal: acceso completo ficha_titulacion" ON public.ficha_titulacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo ficha_certificacion" ON public.ficha_certificacion;
CREATE POLICY "personal: acceso completo ficha_certificacion" ON public.ficha_certificacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo empleados" ON public.empleados;
CREATE POLICY "personal: acceso completo empleados" ON public.empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo nom035_evaluaciones" ON public.nom035_evaluaciones;
CREATE POLICY "personal: acceso completo nom035_evaluaciones" ON public.nom035_evaluaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo nom035_planes_accion" ON public.nom035_planes_accion;
CREATE POLICY "personal: acceso completo nom035_planes_accion" ON public.nom035_planes_accion FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo configuracion_app" ON public.configuracion_app;
CREATE POLICY "personal: acceso completo configuracion_app" ON public.configuracion_app FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: lectura publica configuracion_app" ON public.configuracion_app;
CREATE POLICY "personal: lectura publica configuracion_app" ON public.configuracion_app FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "personal: acceso completo ui_preferencias" ON public.ui_preferencias;
CREATE POLICY "personal: acceso completo ui_preferencias" ON public.ui_preferencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "personal: acceso completo control_pagos" ON public.control_pagos;
CREATE POLICY "personal: acceso completo control_pagos" ON public.control_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
