-- ======================================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS: CRM UNIVERSITARIO / SISTEMA DE PAGOS
-- ======================================================================================
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase -> SQL Editor (o psql) en orden.
--   2. Las tablas se crean en orden de dependencia.
-- ======================================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLAS INDEPENDIENTES Y CATÁLOGOS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.configuracion_app (
  id text NOT NULL,
  valor text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT configuracion_app_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.catalogos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['concepto'::text, 'licenciatura'::text, 'beca_tipo'::text, 'beca_porcentaje'::text, 'grado'::text, 'turno'::text, 'estatus_alumno'::text, 'empresa_ss'::text, 'modalidad_titulacion'::text])),
  valor text NOT NULL,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  CONSTRAINT catalogos_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.carreras (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  nivel_educativo text DEFAULT 'Licenciatura'::text,
  calificacion_minima_aprobatoria numeric DEFAULT 6,
  clave character varying,
  calificacion_minima integer DEFAULT 5,
  calificacion_maxima integer DEFAULT 10,
  CONSTRAINT carreras_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ciclos_escolares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  meses_abarca text,
  anio integer,
  activo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  anio_fin integer,
  tipo_periodo text,
  fecha_inicio date,
  fecha_termino date,
  CONSTRAINT ciclos_escolares_pkey PRIMARY KEY (id)
);

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
  created_at timestamp with time zone DEFAULT now(),
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
  titulo_academico character varying,
  firma_url text,
  firmante_boletas boolean DEFAULT false,
  CONSTRAINT empleados_pkey PRIMARY KEY (id)
);

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
-- TABLAS CON DEPENDENCIAS (NIVEL 1)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text,
  rol text NOT NULL CHECK (rol = ANY (ARRAY['ADMINISTRADOR'::text, 'COORDINADOR'::text, 'CAJERO'::text, 'DOCENTE'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  preferencia_tema text DEFAULT 'light'::text,
  ultimo_ciclo_id uuid,
  auth_id uuid,
  activo boolean DEFAULT true,
  docente_id uuid,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_ultimo_ciclo_id_fkey FOREIGN KEY (ultimo_ciclo_id) REFERENCES public.ciclos_escolares(id),
  -- CONSTRAINT usuarios_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id),
  CONSTRAINT usuarios_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id)
);

CREATE TABLE IF NOT EXISTS public.ui_preferencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  modulo text NOT NULL,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ui_preferencias_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.planes_estudio (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  licenciatura_id uuid,
  clave_legado text NOT NULL UNIQUE,
  nombre text NOT NULL,
  estatus text DEFAULT 'ACTIVO'::text,
  created_at timestamp with time zone DEFAULT now(),
  creditos_obligatorios numeric DEFAULT 0,
  tipo_periodo text DEFAULT 'Semestral'::text,
  modelo text DEFAULT 'RIGIDO'::text,
  carrera_id uuid,
  rvoe text,
  fecha_rvoe date,
  id_tipo_periodo integer,
  id_plan_certificacion integer,
  total_asignaturas integer DEFAULT 0,
  id_autorizacion_reconocimiento integer,
  autorizacion_reconocimiento character varying,
  CONSTRAINT planes_estudio_pkey PRIMARY KEY (id),
  CONSTRAINT planes_estudio_carrera_id_fkey FOREIGN KEY (carrera_id) REFERENCES public.carreras(id),
  CONSTRAINT planes_estudio_licenciatura_id_fkey FOREIGN KEY (licenciatura_id) REFERENCES public.catalogos(id)
);

CREATE TABLE IF NOT EXISTS public.alumnos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  licenciatura text,
  grado_actual text,
  turno text,
  created_at timestamp with time zone DEFAULT now(),
  estatus text DEFAULT 'ACTIVO'::text,
  beca_porcentaje text DEFAULT '0%'::text,
  beca_tipo text DEFAULT 'NINGUNA'::text,
  ciclo_ultima_asignacion_grado uuid,
  observaciones_pago_titulacion text,
  saldo_a_favor numeric DEFAULT 0.00,
  apellido_paterno text,
  apellido_materno text,
  nombres text,
  nombre_requiere_revision boolean DEFAULT false,
  matricula text UNIQUE,
  domicilio text,
  cp character varying,
  municipio text,
  estado text,
  curp character varying UNIQUE,
  fecha_nacimiento date,
  estado_nacimiento text,
  nacionalidad text DEFAULT 'MEXICANA'::text,
  escuela_procedencia text,
  estado_escolaridad text,
  telefono character varying,
  celular character varying,
  email text,
  sexo character varying CHECK (sexo::text = ANY (ARRAY['H'::character varying, 'M'::character varying]::text[])),
  discapacidad text,
  lengua_indigena text,
  sincronizado_el timestamp with time zone,
  kardex_sincronizado boolean DEFAULT false,
  kardex_sincronizado_at timestamp with time zone,
  numero_legado integer,
  id_sexo integer,
  CONSTRAINT alumnos_pkey PRIMARY KEY (id),
  CONSTRAINT alumnos_ciclo_ultima_asignacion_grado_fkey FOREIGN KEY (ciclo_ultima_asignacion_grado) REFERENCES public.ciclos_escolares(id)
);

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
  CONSTRAINT plantillas_plan_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id)
);

CREATE TABLE IF NOT EXISTS public.nom035_evaluaciones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  empleado_id uuid,
  respuestas jsonb NOT NULL,
  calificacion_final numeric NOT NULL,
  nivel_riesgo character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  tipo_guia character varying DEFAULT 'GUIA_II'::character varying,
  calificacion_desglose jsonb,
  CONSTRAINT nom035_evaluaciones_pkey PRIMARY KEY (id),
  CONSTRAINT nom035_evaluaciones_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);

-- ==========================================
-- TABLAS CON DEPENDENCIAS (NIVEL 2)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.asignaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid,
  clave_legado text NOT NULL,
  nombre text NOT NULL,
  creditos numeric DEFAULT 0,
  etapa_clave text,
  etapa_nombre text,
  created_at timestamp with time zone DEFAULT now(),
  clasificacion_nombre text DEFAULT 'Obligatoria'::text,
  clasificacion_clave text DEFAULT '263'::text,
  activo boolean DEFAULT true,
  numero_periodo integer DEFAULT 1,
  clave_certificacion integer,
  CONSTRAINT asignaturas_pkey PRIMARY KEY (id),
  CONSTRAINT asignaturas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_estudio(id)
);

CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  codigo_grupo character varying NOT NULL,
  grado integer,
  turno character varying,
  estatus character varying DEFAULT 'activo'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grupos_pkey PRIMARY KEY (id),
  CONSTRAINT grupos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id),
  CONSTRAINT grupos_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_estudio(id)
);

CREATE TABLE IF NOT EXISTS public.docentes_grupos_asignaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  docente_id uuid,
  grupo_id uuid NOT NULL,
  asignatura_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT docentes_grupos_asignaturas_pkey PRIMARY KEY (id),
  CONSTRAINT docentes_grupos_asignaturas_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES public.docentes(id),
  CONSTRAINT docentes_grupos_asignaturas_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT docentes_grupos_asignaturas_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES public.asignaturas(id)
);

CREATE TABLE IF NOT EXISTS public.alumno_programas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  alumno_id uuid,
  plan_id uuid,
  estatus text DEFAULT 'CURSANDO'::text,
  fecha_inscripcion date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alumno_programas_pkey PRIMARY KEY (id),
  CONSTRAINT alumno_programas_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id),
  CONSTRAINT alumno_programas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_estudio(id)
);

CREATE TABLE IF NOT EXISTS public.alumnos_grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL,
  grupo_id uuid NOT NULL,
  asignatura_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alumnos_grupos_pkey PRIMARY KEY (id),
  CONSTRAINT alumnos_grupos_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id),
  CONSTRAINT alumnos_grupos_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT alumnos_grupos_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES public.asignaturas(id)
);

CREATE TABLE IF NOT EXISTS public.inscripciones_academicas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid,
  ciclo_id uuid,
  asignatura_id uuid,
  parcial_1 numeric DEFAULT NULL::numeric,
  parcial_2 numeric DEFAULT NULL::numeric,
  parcial_3 numeric DEFAULT NULL::numeric,
  promedio_calculado numeric DEFAULT NULL::numeric,
  calificacion_final numeric DEFAULT NULL::numeric,
  modificada_manualmente boolean DEFAULT false,
  observaciones text,
  tipo_evaluacion text DEFAULT 'Ordinario'::text,
  estatus text DEFAULT 'Cursando'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
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
  CONSTRAINT inscripciones_academicas_pkey PRIMARY KEY (id),
  CONSTRAINT inscripciones_academicas_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id),
  CONSTRAINT inscripciones_academicas_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id),
  CONSTRAINT inscripciones_academicas_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES public.asignaturas(id)
);

CREATE TABLE IF NOT EXISTS public.planes_pago (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid,
  ciclo_id uuid,
  no_plan_pagos text,
  fecha_plan text,
  beca_porcentaje text,
  beca_tipo text,
  grado_turno_inscrito text,
  concepto_1 text, fecha_1 text, cantidad_1 numeric, estatus_1 text,
  concepto_2 text, fecha_2 text, cantidad_2 numeric, estatus_2 text,
  concepto_3 text, fecha_3 text, cantidad_3 numeric, estatus_3 text,
  concepto_4 text, fecha_4 text, cantidad_4 numeric, estatus_4 text,
  concepto_5 text, fecha_5 text, cantidad_5 numeric, estatus_5 text,
  created_at timestamp with time zone DEFAULT now(),
  licenciatura text,
  tipo_plan text DEFAULT 'Cuatrimestral'::text,
  concepto_6 text, fecha_6 text, cantidad_6 numeric, estatus_6 text,
  concepto_7 text, fecha_7 text, cantidad_7 numeric, estatus_7 text,
  concepto_8 text, fecha_8 text, cantidad_8 numeric, estatus_8 text,
  concepto_9 text, fecha_9 text, cantidad_9 numeric, estatus_9 text,
  grado text,
  turno text,
  concepto_10 text, fecha_10 date, cantidad_10 numeric, estatus_10 text DEFAULT 'PENDIENTE'::text,
  concepto_11 text, fecha_11 date, cantidad_11 numeric, estatus_11 text DEFAULT 'PENDIENTE'::text,
  concepto_12 text, fecha_12 date, cantidad_12 numeric, estatus_12 text DEFAULT 'PENDIENTE'::text,
  concepto_13 text, fecha_13 date, cantidad_13 numeric, estatus_13 text DEFAULT 'PENDIENTE'::text,
  concepto_14 text, fecha_14 date, cantidad_14 numeric, estatus_14 text DEFAULT 'PENDIENTE'::text,
  concepto_15 text, fecha_15 date, cantidad_15 numeric, estatus_15 text DEFAULT 'PENDIENTE'::text,
  desglose_conceptos jsonb DEFAULT '[]'::jsonb,
  desglose_total_bruto numeric DEFAULT 0,
  desglose_descuento_porcentaje numeric DEFAULT 0,
  desglose_descuento_monto numeric DEFAULT 0,
  desglose_total_neto numeric DEFAULT 0,
  concepto_16 text, fecha_16 date, cantidad_16 numeric, estatus_16 text DEFAULT 'PENDIENTE'::text,
  concepto_17 text, fecha_17 date, cantidad_17 numeric, estatus_17 text DEFAULT 'PENDIENTE'::text,
  concepto_18 text, fecha_18 date, cantidad_18 numeric, estatus_18 text DEFAULT 'PENDIENTE'::text,
  CONSTRAINT planes_pago_pkey PRIMARY KEY (id),
  CONSTRAINT planes_pago_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id),
  CONSTRAINT planes_pago_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id)
);

CREATE TABLE IF NOT EXISTS public.planes_pago_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  indice_concepto integer NOT NULL CHECK (indice_concepto >= 1 AND indice_concepto <= 15),
  concepto text NOT NULL,
  fecha_vencimiento date,
  cantidad numeric NOT NULL DEFAULT 0.00,
  estatus text DEFAULT 'PENDIENTE'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT planes_pago_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT planes_pago_detalles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.planes_pago(id)
);

CREATE TABLE IF NOT EXISTS public.recibos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folio integer NOT NULL DEFAULT nextval('recibos_folio_seq'::regclass) UNIQUE,
  fecha_recibo date NOT NULL,
  fecha_pago date NOT NULL,
  alumno_id uuid,
  ciclo_id uuid,
  total numeric NOT NULL,
  forma_pago text NOT NULL,
  banco text NOT NULL,
  estatus text DEFAULT 'ACTIVO'::text CHECK (estatus = ANY (ARRAY['ACTIVO'::text, 'CANCELADO'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  uso_saldo_a_favor numeric DEFAULT 0.00,
  requiere_factura boolean DEFAULT false,
  estatus_factura character varying DEFAULT 'NO APLICA'::character varying,
  folio_fiscal character varying,
  CONSTRAINT recibos_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id),
  CONSTRAINT recibos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos_escolares(id)
);

CREATE TABLE IF NOT EXISTS public.recibos_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recibo_id uuid,
  cantidad integer NOT NULL,
  concepto text NOT NULL,
  costo_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  indice_concepto_plan integer,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  observaciones text,
  CONSTRAINT recibos_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT recibos_detalles_recibo_id_fkey FOREIGN KEY (recibo_id) REFERENCES public.recibos(id)
);

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
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  estatus text NOT NULL DEFAULT 'EN_CURSO'::text,
  variante_legal text NOT NULL DEFAULT 'ART_55'::text,
  art52_motivo text,
  art52_doc_acta text NOT NULL DEFAULT 'PENDIENTE'::text,
  art52_doc_expediente text NOT NULL DEFAULT 'PENDIENTE'::text,
  art91_req_constancia boolean NOT NULL DEFAULT false,
  art91_req_comprobantes boolean NOT NULL DEFAULT false,
  art91_req_informe boolean NOT NULL DEFAULT false,
  CONSTRAINT servicio_social_pkey PRIMARY KEY (id),
  CONSTRAINT servicio_social_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id)
);

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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  promedio_alto_rendimiento text NOT NULL DEFAULT 'SIN_INICIAR'::text,
  fecha_inicio_tramite date,
  fecha_estimada_culminacion date,
  tramite_completado boolean NOT NULL DEFAULT false,
  fecha_completado timestamp with time zone,
  enlace_drive text,
  CONSTRAINT ficha_titulacion_pkey PRIMARY KEY (id),
  CONSTRAINT ficha_titulacion_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id)
);

CREATE TABLE IF NOT EXISTS public.ficha_certificacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL UNIQUE,
  pago_certificado text NOT NULL DEFAULT 'SIN_INICIAR'::text,
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
  tipo_certificado text,
  fecha_inicio_tramite date,
  fecha_termino_tramite date,
  tramite_completado boolean NOT NULL DEFAULT false,
  fecha_completado timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  enlace_drive text,
  CONSTRAINT ficha_certificacion_pkey PRIMARY KEY (id),
  CONSTRAINT ficha_certificacion_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.alumnos(id)
);

-- ==========================================
-- TABLAS LEGADAS O SIN RELACIONES DIRECTAS
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
-- FUNCIONES RPC
-- ======================================================================================
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
  INSERT INTO public.recibos (fecha_recibo, fecha_pago, alumno_id, ciclo_id, total, forma_pago, banco, estatus, requiere_factura, estatus_factura, uso_saldo_a_favor) 
  VALUES (
    (p_recibo->>'fecha_recibo')::date, (p_recibo->>'fecha_pago')::date, (p_recibo->>'alumno_id')::uuid, (p_recibo->>'ciclo_id')::uuid, (p_recibo->>'total')::numeric, p_recibo->>'forma_pago', p_recibo->>'banco', COALESCE(p_recibo->>'estatus', 'ACTIVO'), COALESCE((p_recibo->>'requiere_factura')::boolean, false), CASE WHEN COALESCE((p_recibo->>'requiere_factura')::boolean, false) THEN 'PENDIENTE' ELSE 'NO APLICA' END, COALESCE((p_recibo->>'uso_saldo_a_favor')::numeric, 0)
  ) RETURNING id, folio INTO v_recibo_id, v_folio;

  -- 2. Insertar Detalles
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.recibos_detalles (recibo_id, cantidad, concepto, costo_unitario, subtotal, indice_concepto_plan, observaciones) 
    VALUES (v_recibo_id, (v_detalle.value->>'cantidad')::integer, v_detalle.value->>'concepto', (v_detalle.value->>'costo_unitario')::numeric, (v_detalle.value->>'subtotal')::numeric, NULLIF(v_detalle.value->>'indice_concepto_plan', '')::integer, v_detalle.value->>'observaciones');
  END LOOP;

  -- 3. Actualizar Plan
  IF p_plan_id IS NOT NULL AND p_plan_updates IS NOT NULL THEN
    FOR v_key, v_val IN SELECT key, value#>>'{}' FROM jsonb_each(p_plan_updates) LOOP
      v_val := replace(v_val, '{{FOLIO}}', v_folio::text);
      IF v_key LIKE 'estatus_%' THEN
        v_idx := cast(split_part(v_key, '_', 2) as integer);
        UPDATE public.planes_pago_detalles SET estatus = v_val WHERE plan_id = p_plan_id AND indice_concepto = v_idx;
        v_sql := format('UPDATE public.planes_pago SET %I = %L WHERE id = %L', v_key, v_val, p_plan_id); EXECUTE v_sql;
      ELSE
        v_sql := format('UPDATE public.planes_pago SET %I = %L WHERE id = %L', v_key, v_val, p_plan_id); EXECUTE v_sql;
      END IF;
    END LOOP;
  END IF;

  -- 4. Monedero
  IF p_alumno_id IS NOT NULL AND p_saldo_delta <> 0 THEN
    UPDATE public.alumnos SET saldo_a_favor = COALESCE(saldo_a_favor, 0) + p_saldo_delta WHERE id = p_alumno_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'folio', v_folio, 'recibo_id', v_recibo_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
