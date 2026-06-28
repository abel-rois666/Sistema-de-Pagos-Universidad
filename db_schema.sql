-- ======================================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS: CRM UNIVERSITARIO / SISTEMA DE PAGOS
-- ======================================================================================
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase -> SQL Editor (o psql) en orden.
--   2. Las tablas se crean en orden de dependencia.
-- ======================================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABLAS INDEPENDIENTES
-- ==========================================

-- 1. CICLOS ESCOLARES
CREATE TABLE IF NOT EXISTS public.ciclos_escolares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    meses_abarca TEXT,
    anio INTEGER,
    anio_fin INTEGER,
    activo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CARRERAS
CREATE TABLE IF NOT EXISTS public.carreras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    nivel_educativo TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CATALOGOS
CREATE TABLE IF NOT EXISTS public.catalogos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT NOT NULL,
    valor TEXT NOT NULL,
    orden INTEGER,
    activo BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CONFIGURACION APP
CREATE TABLE IF NOT EXISTS public.configuracion_app (
    id TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. USUARIOS
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    rol TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    preferencia_tema TEXT,
    ultimo_ciclo_id UUID REFERENCES public.ciclos_escolares(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. UI PREFERENCIAS
CREATE TABLE IF NOT EXISTS public.ui_preferencias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    modulo TEXT NOT NULL,
    preferencias JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- TABLAS CON DEPENDENCIAS (NIVEL 1)
-- ==========================================

-- 7. PLANES DE ESTUDIO
CREATE TABLE IF NOT EXISTS public.planes_estudio (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    carrera_id UUID REFERENCES public.carreras(id),
    licenciatura_id UUID REFERENCES public.carreras(id),
    clave_legado TEXT UNIQUE,
    nombre TEXT NOT NULL,
    rvoe TEXT,
    fecha_rvoe DATE,
    tipo_periodo TEXT,
    modelo TEXT,
    creditos_obligatorios NUMERIC,
    estatus TEXT DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. ALUMNOS
CREATE TABLE IF NOT EXISTS public.alumnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    matricula TEXT UNIQUE,
    curp VARCHAR UNIQUE,
    nombres TEXT,
    apellido_paterno TEXT,
    apellido_materno TEXT,
    nombre_completo TEXT NOT NULL,
    nombre_requiere_revision BOOLEAN DEFAULT false,
    fecha_nacimiento DATE,
    estado_nacimiento TEXT,
    nacionalidad TEXT,
    sexo VARCHAR,
    licenciatura TEXT,
    grado_actual TEXT,
    turno TEXT,
    estatus TEXT,
    beca_porcentaje TEXT,
    beca_tipo TEXT,
    ciclo_ultima_asignacion_grado UUID REFERENCES public.ciclos_escolares(id),
    domicilio TEXT,
    cp VARCHAR,
    municipio TEXT,
    estado TEXT,
    telefono VARCHAR,
    celular VARCHAR,
    email TEXT,
    escuela_procedencia TEXT,
    estado_escolaridad TEXT,
    discapacidad TEXT,
    lengua_indigena TEXT,
    observaciones_pago_titulacion TEXT,
    saldo_a_favor NUMERIC DEFAULT 0,
    sincronizado_el TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. PLANTILLAS PLAN
CREATE TABLE IF NOT EXISTS public.plantillas_plan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id),
    tipo_plan TEXT,
    activo BOOLEAN DEFAULT true,
    concepto_1 TEXT, fecha_1 TEXT, cantidad_1 NUMERIC,
    concepto_2 TEXT, fecha_2 TEXT, cantidad_2 NUMERIC,
    concepto_3 TEXT, fecha_3 TEXT, cantidad_3 NUMERIC,
    concepto_4 TEXT, fecha_4 TEXT, cantidad_4 NUMERIC,
    concepto_5 TEXT, fecha_5 TEXT, cantidad_5 NUMERIC,
    concepto_6 TEXT, fecha_6 TEXT, cantidad_6 NUMERIC,
    concepto_7 TEXT, fecha_7 TEXT, cantidad_7 NUMERIC,
    concepto_8 TEXT, fecha_8 TEXT, cantidad_8 NUMERIC,
    concepto_9 TEXT, fecha_9 TEXT, cantidad_9 NUMERIC,
    concepto_10 TEXT, fecha_10 DATE, cantidad_10 NUMERIC,
    concepto_11 TEXT, fecha_11 DATE, cantidad_11 NUMERIC,
    concepto_12 TEXT, fecha_12 DATE, cantidad_12 NUMERIC,
    concepto_13 TEXT, fecha_13 DATE, cantidad_13 NUMERIC,
    concepto_14 TEXT, fecha_14 DATE, cantidad_14 NUMERIC,
    concepto_15 TEXT, fecha_15 DATE, cantidad_15 NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. CONTROL PAGOS (LEGADO)
CREATE TABLE IF NOT EXISTS public.control_pagos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_alumno TEXT NOT NULL,
    licenciatura TEXT,
    grado_turno TEXT,
    no_plan_pagos TEXT,
    fecha_plan TEXT,
    beca_porcentaje TEXT,
    beca_tipo TEXT,
    concepto_1 TEXT, fecha_1 TEXT, cantidad_1 NUMERIC, estatus_1 TEXT,
    concepto_2 TEXT, fecha_2 TEXT, cantidad_2 NUMERIC, estatus_2 TEXT,
    concepto_3 TEXT, fecha_3 TEXT, cantidad_3 NUMERIC, estatus_3 TEXT,
    concepto_4 TEXT, fecha_4 TEXT, cantidad_4 NUMERIC, estatus_4 TEXT,
    concepto_5 TEXT, fecha_5 TEXT, cantidad_5 NUMERIC, estatus_5 TEXT
);

-- ==========================================
-- TABLAS CON DEPENDENCIAS (NIVEL 2)
-- ==========================================

-- 11. ASIGNATURAS
CREATE TABLE IF NOT EXISTS public.asignaturas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES public.planes_estudio(id) ON DELETE CASCADE,
    clave_legado TEXT,
    nombre TEXT NOT NULL,
    creditos NUMERIC,
    etapa_clave TEXT,
    etapa_nombre TEXT,
    clasificacion_clave TEXT,
    clasificacion_nombre TEXT,
    numero_periodo INTEGER,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. ALUMNO PROGRAMAS (MULTI-PLAN)
CREATE TABLE IF NOT EXISTS public.alumno_programas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.planes_estudio(id) ON DELETE CASCADE,
    estatus TEXT,
    fecha_inscripcion DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. PLANES PAGO
CREATE TABLE IF NOT EXISTS public.planes_pago (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id),
    licenciatura TEXT,
    grado TEXT,
    turno TEXT,
    grado_turno_inscrito TEXT,
    tipo_plan TEXT,
    no_plan_pagos TEXT,
    fecha_plan TEXT,
    beca_porcentaje TEXT,
    beca_tipo TEXT,
    desglose_total_bruto NUMERIC,
    desglose_descuento_porcentaje NUMERIC,
    desglose_descuento_monto NUMERIC,
    desglose_total_neto NUMERIC,
    desglose_conceptos JSONB,
    concepto_1 TEXT, fecha_1 TEXT, cantidad_1 NUMERIC, estatus_1 TEXT,
    concepto_2 TEXT, fecha_2 TEXT, cantidad_2 NUMERIC, estatus_2 TEXT,
    concepto_3 TEXT, fecha_3 TEXT, cantidad_3 NUMERIC, estatus_3 TEXT,
    concepto_4 TEXT, fecha_4 TEXT, cantidad_4 NUMERIC, estatus_4 TEXT,
    concepto_5 TEXT, fecha_5 TEXT, cantidad_5 NUMERIC, estatus_5 TEXT,
    concepto_6 TEXT, fecha_6 TEXT, cantidad_6 NUMERIC, estatus_6 TEXT,
    concepto_7 TEXT, fecha_7 TEXT, cantidad_7 NUMERIC, estatus_7 TEXT,
    concepto_8 TEXT, fecha_8 TEXT, cantidad_8 NUMERIC, estatus_8 TEXT,
    concepto_9 TEXT, fecha_9 TEXT, cantidad_9 NUMERIC, estatus_9 TEXT,
    concepto_10 TEXT, fecha_10 DATE, cantidad_10 NUMERIC, estatus_10 TEXT,
    concepto_11 TEXT, fecha_11 DATE, cantidad_11 NUMERIC, estatus_11 TEXT,
    concepto_12 TEXT, fecha_12 DATE, cantidad_12 NUMERIC, estatus_12 TEXT,
    concepto_13 TEXT, fecha_13 DATE, cantidad_13 NUMERIC, estatus_13 TEXT,
    concepto_14 TEXT, fecha_14 DATE, cantidad_14 NUMERIC, estatus_14 TEXT,
    concepto_15 TEXT, fecha_15 DATE, cantidad_15 NUMERIC, estatus_15 TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. PLANES PAGO DETALLES
CREATE TABLE IF NOT EXISTS public.planes_pago_detalles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES public.planes_pago(id) ON DELETE CASCADE,
    indice_concepto INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    fecha_vencimiento DATE,
    cantidad NUMERIC NOT NULL,
    estatus TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. RECIBOS
CREATE TABLE IF NOT EXISTS public.recibos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folio INTEGER UNIQUE NOT NULL,
    alumno_id UUID REFERENCES public.alumnos(id),
    ciclo_id UUID REFERENCES public.ciclos_escolares(id),
    fecha_recibo DATE NOT NULL,
    fecha_pago DATE NOT NULL,
    total NUMERIC NOT NULL,
    forma_pago TEXT NOT NULL,
    banco TEXT NOT NULL,
    estatus TEXT,
    uso_saldo_a_favor NUMERIC,
    requiere_factura BOOLEAN,
    estatus_factura VARCHAR,
    folio_fiscal VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. RECIBOS DETALLES
CREATE TABLE IF NOT EXISTS public.recibos_detalles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recibo_id UUID REFERENCES public.recibos(id) ON DELETE CASCADE,
    indice_concepto_plan INTEGER,
    concepto TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    costo_unitario NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. SERVICIO SOCIAL
CREATE TABLE IF NOT EXISTS public.servicio_social (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    nombre_empresa TEXT NOT NULL,
    tipo_empresa TEXT NOT NULL,
    nombre_programa TEXT,
    fecha_registro DATE NOT NULL,
    fecha_inicio DATE,
    fecha_termino DATE,
    horas_cubrir INTEGER NOT NULL,
    estatus TEXT NOT NULL,
    variante_legal TEXT NOT NULL,
    art52_motivo TEXT,
    art52_doc_acta TEXT,
    art52_doc_expediente TEXT,
    art91_req_constancia BOOLEAN,
    art91_req_comprobantes BOOLEAN,
    art91_req_informe BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 18. FICHA TITULACION
CREATE TABLE IF NOT EXISTS public.ficha_titulacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID UNIQUE REFERENCES public.alumnos(id) ON DELETE CASCADE,
    modalidad TEXT,
    pago_titulacion TEXT NOT NULL,
    certificado_estudios TEXT NOT NULL,
    ingles TEXT NOT NULL,
    servicio_social_req TEXT NOT NULL,
    fotografias TEXT NOT NULL,
    doc_antecedente TEXT NOT NULL,
    doc_antecedente_nota TEXT,
    doc_acta_nacimiento TEXT NOT NULL,
    doc_acta_nacimiento_nota TEXT,
    doc_curp TEXT NOT NULL,
    doc_curp_nota TEXT,
    doc_titulo_profesional TEXT NOT NULL,
    doc_titulo_profesional_nota TEXT,
    doc_cedula_profesional TEXT NOT NULL,
    doc_cedula_profesional_nota TEXT,
    promedio_alto_rendimiento TEXT NOT NULL,
    fecha_inicio_tramite DATE,
    fecha_estimada_culminacion DATE,
    tramite_completado BOOLEAN NOT NULL DEFAULT false,
    fecha_completado TIMESTAMPTZ,
    enlace_drive TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 19. FICHA CERTIFICACION
CREATE TABLE IF NOT EXISTS public.ficha_certificacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID UNIQUE REFERENCES public.alumnos(id) ON DELETE CASCADE,
    tipo_certificado TEXT,
    pago_certificado TEXT NOT NULL,
    doc_acta_nacimiento TEXT NOT NULL,
    doc_acta_nacimiento_nota TEXT,
    doc_curp TEXT NOT NULL,
    doc_curp_nota TEXT,
    doc_antecedente TEXT NOT NULL,
    doc_antecedente_nota TEXT,
    doc_titulo_profesional TEXT NOT NULL,
    doc_titulo_profesional_nota TEXT,
    doc_cedula_profesional TEXT NOT NULL,
    doc_cedula_profesional_nota TEXT,
    fecha_inicio_tramite DATE,
    fecha_termino_tramite DATE,
    tramite_completado BOOLEAN NOT NULL DEFAULT false,
    fecha_completado TIMESTAMPTZ,
    enlace_drive TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 20. INSCRIPCIONES ACADEMICAS
CREATE TABLE IF NOT EXISTS public.inscripciones_academicas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id),
    asignatura_id UUID REFERENCES public.asignaturas(id),
    ciclo_legado TEXT,
    parcial_1 NUMERIC,
    parcial_2 NUMERIC,
    parcial_3 NUMERIC,
    promedio_calculado NUMERIC,
    calificacion_final NUMERIC,
    tipo_evaluacion TEXT,
    modificada_manualmente BOOLEAN DEFAULT false,
    observaciones TEXT,
    estatus TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- TRIGGERS Y FUNCIONES RECOMENDADAS
-- ==========================================
-- (Aquí puedes añadir funciones para setear updated_at automáticamente si lo requieres)

-- FIN DEL ESQUEMA
