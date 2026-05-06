-- ======================================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS: SISTEMA DE CONTROL DE PAGOS UNIVERSIDAD
-- ======================================================================================

-- Habilitar extensión para UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLA: USUARIOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    rol TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'COORDINADOR', 'CAJERO')),
    ultimo_ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL,
    preferencia_tema TEXT DEFAULT 'light',
    auth_id UUID,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. TABLA: CICLOS ESCOLARES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ciclos_escolares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    meses_abarca TEXT NOT NULL,
    anio INTEGER NOT NULL,
    activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. TABLA: CATÁLOGOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.catalogos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('concepto', 'licenciatura', 'beca_tipo', 'beca_porcentaje', 'grado', 'turno', 'estatus_alumno')),
    valor TEXT NOT NULL,
    orden INTEGER NOT NULL,
    activo BOOLEAN DEFAULT true,
    -- Metadatos opcionales (solo para tipo='licenciatura'):
    -- { "tipo_academico": "LICENCIATURA"|"ESPECIALIDAD", "tipo_periodo": "CUATRIMESTRAL"|"SEMESTRAL" }
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Para bases de datos existentes, ejecutar:
-- ALTER TABLE public.catalogos ADD COLUMN IF NOT EXISTS metadata JSONB;


-- ==========================================
-- 4. TABLA: ALUMNOS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alumnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_completo TEXT NOT NULL,
    matricula TEXT UNIQUE,
    licenciatura TEXT,
    grado_actual TEXT,
    turno TEXT,
    estatus TEXT DEFAULT 'ACTIVO',
    beca_tipo TEXT,
    beca_porcentaje TEXT,
    ciclo_ultima_asignacion_grado TEXT,
    observaciones_pago_titulacion TEXT,
    saldo_a_favor NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alumnos_matricula ON public.alumnos(matricula);
CREATE INDEX IF NOT EXISTS idx_alumnos_nombre ON public.alumnos(nombre_completo);

-- ==========================================
-- 5. TABLA: CONFIGURACIÓN APP (NUEVA)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.configuracion_app (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 6. TABLA: PLANTILLAS DE PLAN 
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plantillas_plan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL,
    tipo_plan TEXT CHECK (tipo_plan IN ('Cuatrimestral', 'Semestral', 'Titulación', 'Especialidad Completa', 'Especialidad Cuatrimestral')),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    concepto_1 TEXT, fecha_1 DATE, cantidad_1 NUMERIC(10,2),
    concepto_2 TEXT, fecha_2 DATE, cantidad_2 NUMERIC(10,2),
    concepto_3 TEXT, fecha_3 DATE, cantidad_3 NUMERIC(10,2),
    concepto_4 TEXT, fecha_4 DATE, cantidad_4 NUMERIC(10,2),
    concepto_5 TEXT, fecha_5 DATE, cantidad_5 NUMERIC(10,2),
    concepto_6 TEXT, fecha_6 DATE, cantidad_6 NUMERIC(10,2),
    concepto_7 TEXT, fecha_7 DATE, cantidad_7 NUMERIC(10,2),
    concepto_8 TEXT, fecha_8 DATE, cantidad_8 NUMERIC(10,2),
    concepto_9 TEXT, fecha_9 DATE, cantidad_9 NUMERIC(10,2),
    concepto_10 TEXT, fecha_10 DATE, cantidad_10 NUMERIC(10,2),
    concepto_11 TEXT, fecha_11 DATE, cantidad_11 NUMERIC(10,2),
    concepto_12 TEXT, fecha_12 DATE, cantidad_12 NUMERIC(10,2),
    concepto_13 TEXT, fecha_13 DATE, cantidad_13 NUMERIC(10,2),
    concepto_14 TEXT, fecha_14 DATE, cantidad_14 NUMERIC(10,2),
    concepto_15 TEXT, fecha_15 DATE, cantidad_15 NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 7. TABLA: PLANES_PAGO (TABLA BASE)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.planes_pago (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT,
    no_plan_pagos TEXT NOT NULL,
    fecha_plan DATE NOT NULL,
    beca_porcentaje TEXT,
    beca_tipo TEXT,
    grado TEXT,
    turno TEXT,
    tipo_plan TEXT CHECK (tipo_plan IN ('Cuatrimestral', 'Semestral', 'Titulación', 'Especialidad Completa', 'Especialidad Cuatrimestral')),
    licenciatura TEXT,
    
    -- Conceptos 1 - 15 (Soporte extendido para Especialidades/Titulación)
    concepto_1 TEXT, fecha_1 DATE, cantidad_1 NUMERIC(10,2), estatus_1 TEXT DEFAULT 'PENDIENTE',
    concepto_2 TEXT, fecha_2 DATE, cantidad_2 NUMERIC(10,2), estatus_2 TEXT DEFAULT 'PENDIENTE',
    concepto_3 TEXT, fecha_3 DATE, cantidad_3 NUMERIC(10,2), estatus_3 TEXT DEFAULT 'PENDIENTE',
    concepto_4 TEXT, fecha_4 DATE, cantidad_4 NUMERIC(10,2), estatus_4 TEXT DEFAULT 'PENDIENTE',
    concepto_5 TEXT, fecha_5 DATE, cantidad_5 NUMERIC(10,2), estatus_5 TEXT DEFAULT 'PENDIENTE',
    concepto_6 TEXT, fecha_6 DATE, cantidad_6 NUMERIC(10,2), estatus_6 TEXT DEFAULT 'PENDIENTE',
    concepto_7 TEXT, fecha_7 DATE, cantidad_7 NUMERIC(10,2), estatus_7 TEXT DEFAULT 'PENDIENTE',
    concepto_8 TEXT, fecha_8 DATE, cantidad_8 NUMERIC(10,2), estatus_8 TEXT DEFAULT 'PENDIENTE',
    concepto_9 TEXT, fecha_9 DATE, cantidad_9 NUMERIC(10,2), estatus_9 TEXT DEFAULT 'PENDIENTE',
    concepto_10 TEXT, fecha_10 DATE, cantidad_10 NUMERIC(10,2), estatus_10 TEXT DEFAULT 'PENDIENTE',
    concepto_11 TEXT, fecha_11 DATE, cantidad_11 NUMERIC(10,2), estatus_11 TEXT DEFAULT 'PENDIENTE',
    concepto_12 TEXT, fecha_12 DATE, cantidad_12 NUMERIC(10,2), estatus_12 TEXT DEFAULT 'PENDIENTE',
    concepto_13 TEXT, fecha_13 DATE, cantidad_13 NUMERIC(10,2), estatus_13 TEXT DEFAULT 'PENDIENTE',
    concepto_14 TEXT, fecha_14 DATE, cantidad_14 NUMERIC(10,2), estatus_14 TEXT DEFAULT 'PENDIENTE',
    concepto_15 TEXT, fecha_15 DATE, cantidad_15 NUMERIC(10,2), estatus_15 TEXT DEFAULT 'PENDIENTE',

    -- Metadatos para Especialidad Completa (Cotización dinámica)
    desglose_conceptos JSONB,
    desglose_total_bruto NUMERIC(15,2),
    desglose_descuento_porcentaje NUMERIC(5,2),
    desglose_descuento_monto NUMERIC(15,2),
    desglose_total_neto NUMERIC(15,2),
    
    observaciones JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(alumno_id, ciclo_id, no_plan_pagos)
);
CREATE INDEX IF NOT EXISTS idx_planes_pago_alumno ON public.planes_pago(alumno_id);
CREATE INDEX IF NOT EXISTS idx_planes_pago_ciclo ON public.planes_pago(ciclo_id);

-- ==========================================
-- 8. VISTA: VISTA_PLANES_PAGO
-- Integra Tablas para la aplicación
-- ==========================================
CREATE OR REPLACE VIEW public.vista_planes_pago AS 
SELECT 
    p.id,
    p.alumno_id,
    p.ciclo_id,
    a.nombre_completo AS nombre_alumno,
    p.no_plan_pagos,
    p.fecha_plan,
    p.beca_porcentaje,
    p.beca_tipo,
    c.nombre AS ciclo_escolar,
    
    p.concepto_1, p.fecha_1, p.cantidad_1, p.estatus_1,
    p.concepto_2, p.fecha_2, p.cantidad_2, p.estatus_2,
    p.concepto_3, p.fecha_3, p.cantidad_3, p.estatus_3,
    p.concepto_4, p.fecha_4, p.cantidad_4, p.estatus_4,
    p.concepto_5, p.fecha_5, p.cantidad_5, p.estatus_5,
    p.concepto_6, p.fecha_6, p.cantidad_6, p.estatus_6,
    p.concepto_7, p.fecha_7, p.cantidad_7, p.estatus_7,
    p.concepto_8, p.fecha_8, p.cantidad_8, p.estatus_8,
    p.concepto_9, p.fecha_9, p.cantidad_9, p.estatus_9,
    p.concepto_10, p.fecha_10, p.cantidad_10, p.estatus_10,
    p.concepto_11, p.fecha_11, p.cantidad_11, p.estatus_11,
    p.concepto_12, p.fecha_12, p.cantidad_12, p.estatus_12,
    p.concepto_13, p.fecha_13, p.cantidad_13, p.estatus_13,
    p.concepto_14, p.fecha_14, p.cantidad_14, p.estatus_14,
    p.concepto_15, p.fecha_15, p.cantidad_15, p.estatus_15,
    
    -- Desglose
    p.desglose_conceptos,
    p.desglose_total_bruto,
    p.desglose_descuento_porcentaje,
    p.desglose_descuento_monto,
    p.desglose_total_neto,

    p.observaciones,

    COALESCE(p.licenciatura, a.licenciatura) AS licenciatura,
    (COALESCE(p.grado, a.grado_actual) || ' - ' || COALESCE(p.turno, a.turno)) AS grado_turno,
    p.grado,
    p.turno,
    p.tipo_plan
FROM public.planes_pago p
LEFT JOIN public.alumnos a ON p.alumno_id = a.id
LEFT JOIN public.ciclos_escolares c ON p.ciclo_id = c.id;

-- ==========================================
-- 9. TABLA: RECIBOS (CONTROL DE INGRESOS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recibos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folio SERIAL UNIQUE NOT NULL,
    folio_fiscal TEXT,        -- Para cuando se factura un recibo
    fecha_recibo DATE NOT NULL,
    fecha_pago DATE NOT NULL,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE RESTRICT,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT,
    total NUMERIC(15,2) NOT NULL,
    forma_pago TEXT NOT NULL,
    banco TEXT NOT NULL,
    estatus TEXT DEFAULT 'ACTIVO' CHECK (estatus IN ('ACTIVO', 'CANCELADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recibos_alumno ON public.recibos(alumno_id);

-- ==========================================
-- 10. TABLA: RECIBOS_DETALLES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recibos_detalles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recibo_id UUID REFERENCES public.recibos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    costo_unitario NUMERIC(15,2) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    indice_concepto_plan INTEGER, -- 1 a 15, sirve para saber a qué concepto del plan le abonó
    observaciones TEXT,           -- Nota de abono parcial: "Abono $X — Restante: $Y"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recibos_detalles_recibo ON public.recibos_detalles(recibo_id);

-- ==========================================
-- 11. TABLA: SERVICIO SOCIAL
-- ==========================================
CREATE TABLE IF NOT EXISTS public.servicio_social (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    nombre_empresa TEXT NOT NULL,
    tipo_empresa TEXT CHECK (tipo_empresa IN ('PRIVADA', 'PUBLICA')),
    fecha_registro DATE,
    fecha_inicio DATE,
    fecha_termino DATE,
    horas_cubrir INTEGER,
    estatus TEXT DEFAULT 'EN_CURSO' CHECK (estatus IN ('EN_CURSO', 'LIBERADO')),
    nombre_programa TEXT,
    variante_legal TEXT DEFAULT 'ART_55',
    art52_motivo TEXT,
    art52_doc_acta TEXT DEFAULT 'PENDIENTE',
    art52_doc_expediente TEXT DEFAULT 'PENDIENTE',
    art91_req_constancia BOOLEAN DEFAULT false,
    art91_req_comprobantes BOOLEAN DEFAULT false,
    art91_req_informe BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_servicio_social_alumno ON public.servicio_social(alumno_id);

-- ==========================================
-- 12. TABLA: FICHAS DE TITULACIÓN
-- ==========================================
CREATE TABLE IF NOT EXISTS public.fichas_titulacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    modalidad TEXT,
    pago_titulacion TEXT DEFAULT 'SIN_INICIAR',
    certificado_estudios TEXT DEFAULT 'SIN_INICIAR',
    ingles TEXT DEFAULT 'SIN_INICIAR',
    servicio_social_req TEXT DEFAULT 'SIN_INICIAR',
    fotografias TEXT DEFAULT 'PENDIENTES',
    promedio_alto_rendimiento TEXT,
    doc_antecedente TEXT DEFAULT 'SIN_INICIAR',
    doc_antecedente_nota TEXT,
    doc_acta_nacimiento TEXT DEFAULT 'SIN_INICIAR',
    doc_acta_nacimiento_nota TEXT,
    doc_curp TEXT DEFAULT 'SIN_INICIAR',
    doc_curp_nota TEXT,
    doc_titulo_profesional TEXT DEFAULT 'SIN_INICIAR',
    doc_titulo_profesional_nota TEXT,
    doc_cedula_profesional TEXT DEFAULT 'SIN_INICIAR',
    doc_cedula_profesional_nota TEXT,
    fecha_inicio_tramite DATE,
    fecha_estimada_culminacion DATE,
    tramite_completado BOOLEAN DEFAULT false,
    fecha_completado DATE,
    enlace_drive TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fichas_titulacion_alumno ON public.fichas_titulacion(alumno_id);

-- ==========================================
-- 13. TABLA: FICHAS DE CERTIFICACIÓN
-- ==========================================
CREATE TABLE IF NOT EXISTS public.fichas_certificacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    pago_certificado TEXT DEFAULT 'SIN_INICIAR',
    doc_acta_nacimiento TEXT DEFAULT 'SIN_INICIAR',
    doc_acta_nacimiento_nota TEXT,
    doc_curp TEXT DEFAULT 'SIN_INICIAR',
    doc_curp_nota TEXT,
    doc_antecedente TEXT DEFAULT 'SIN_INICIAR',
    doc_antecedente_nota TEXT,
    doc_titulo_profesional TEXT DEFAULT 'SIN_INICIAR',
    doc_titulo_profesional_nota TEXT,
    doc_cedula_profesional TEXT DEFAULT 'SIN_INICIAR',
    doc_cedula_profesional_nota TEXT,
    tipo_certificado TEXT,
    fecha_inicio_tramite DATE,
    fecha_termino_tramite DATE,
    tramite_completado BOOLEAN DEFAULT false,
    fecha_completado DATE,
    enlace_drive TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fichas_certificacion_alumno ON public.fichas_certificacion(alumno_id);

-- ==========================================
-- 14. POLÍTICAS DE SEGURIDAD (RLS)
-- ==========================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclos_escolares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_titulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_certificacion ENABLE ROW LEVEL SECURITY;

-- Nota: Como estás gestionando la sesión del usuario manualmente usando bcrypt y una consulta de login 
-- del lado del cliente, todas las políticas están abiertas para lectura/escritura pública con Anon Key. 
-- *Recomendación Futura*: Autenticación directa a través de Supabase Auth usando roles de Supabase para mayor seguridad.
CREATE POLICY "Acceso total - usuarios" ON public.usuarios FOR ALL USING (true);
CREATE POLICY "Acceso total - ciclos" ON public.ciclos_escolares FOR ALL USING (true);
CREATE POLICY "Acceso total - catalogos" ON public.catalogos FOR ALL USING (true);
CREATE POLICY "Acceso total - alumnos" ON public.alumnos FOR ALL USING (true);
CREATE POLICY "Acceso total - configuracion" ON public.configuracion_app FOR ALL USING (true);
CREATE POLICY "Acceso total - plantillas" ON public.plantillas_plan FOR ALL USING (true);
CREATE POLICY "Acceso total - planes" ON public.planes_pago FOR ALL USING (true);
CREATE POLICY "Acceso total - recibos" ON public.recibos FOR ALL USING (true);
CREATE POLICY "Acceso total - recibos_detalles" ON public.recibos_detalles FOR ALL USING (true);
CREATE POLICY "Acceso total - servicio_social" ON public.servicio_social FOR ALL USING (true);
CREATE POLICY "Acceso total - fichas_titulacion" ON public.fichas_titulacion FOR ALL USING (true);
CREATE POLICY "Acceso total - fichas_certificacion" ON public.fichas_certificacion FOR ALL USING (true);
