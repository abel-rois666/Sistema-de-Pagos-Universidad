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
    password TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'COORDINADOR')),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. TABLA: PLANTILLAS DE PLAN (OPCIONAL/MEJORA)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plantillas_plan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL,
    tipo_plan TEXT CHECK (tipo_plan IN ('Cuatrimestral', 'Semestral')),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 6. TABLA: PLANES_PAGO (TABLA BASE)
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
    tipo_plan TEXT CHECK (tipo_plan IN ('Cuatrimestral', 'Semestral')),
    
    concepto_1 TEXT, fecha_1 DATE, cantidad_1 NUMERIC(10,2), estatus_1 TEXT DEFAULT 'PENDIENTE',
    concepto_2 TEXT, fecha_2 DATE, cantidad_2 NUMERIC(10,2), estatus_2 TEXT DEFAULT 'PENDIENTE',
    concepto_3 TEXT, fecha_3 DATE, cantidad_3 NUMERIC(10,2), estatus_3 TEXT DEFAULT 'PENDIENTE',
    concepto_4 TEXT, fecha_4 DATE, cantidad_4 NUMERIC(10,2), estatus_4 TEXT DEFAULT 'PENDIENTE',
    concepto_5 TEXT, fecha_5 DATE, cantidad_5 NUMERIC(10,2), estatus_5 TEXT DEFAULT 'PENDIENTE',
    concepto_6 TEXT, fecha_6 DATE, cantidad_6 NUMERIC(10,2), estatus_6 TEXT DEFAULT 'PENDIENTE',
    concepto_7 TEXT, fecha_7 DATE, cantidad_7 NUMERIC(10,2), estatus_7 TEXT DEFAULT 'PENDIENTE',
    concepto_8 TEXT, fecha_8 DATE, cantidad_8 NUMERIC(10,2), estatus_8 TEXT DEFAULT 'PENDIENTE',
    concepto_9 TEXT, fecha_9 DATE, cantidad_9 NUMERIC(10,2), estatus_9 TEXT DEFAULT 'PENDIENTE',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(alumno_id, ciclo_id)
);

-- ==========================================
-- 7. VISTA: VISTA_PLANES_PAGO
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
    
    a.licenciatura,
    (COALESCE(p.grado, a.grado_actual) || ' - ' || COALESCE(p.turno, a.turno)) AS grado_turno,
    p.grado,
    p.turno,
    p.tipo_plan
FROM public.planes_pago p
LEFT JOIN public.alumnos a ON p.alumno_id = a.id
LEFT JOIN public.ciclos_escolares c ON p.ciclo_id = c.id;

-- ==========================================
-- 8. POLÍTICAS DE SEGURIDAD (RLS)
-- ==========================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclos_escolares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_pago ENABLE ROW LEVEL SECURITY;

-- Nota: Como estás gestionando la sesión del usuario manualmente usando bcrypt y una consulta de login 
-- del lado del cliente, todas las políticas están abiertas para lectura/escritura pública con Anon Key. 
-- *Recomendación Futura*: Autenticación directa a través de Supabase Auth.
CREATE POLICY "Acceso total - usuarios" ON public.usuarios FOR ALL USING (true);
CREATE POLICY "Acceso total - ciclos" ON public.ciclos_escolares FOR ALL USING (true);
CREATE POLICY "Acceso total - catalogos" ON public.catalogos FOR ALL USING (true);
CREATE POLICY "Acceso total - alumnos" ON public.alumnos FOR ALL USING (true);
CREATE POLICY "Acceso total - plantillas" ON public.plantillas_plan FOR ALL USING (true);
CREATE POLICY "Acceso total - planes" ON public.planes_pago FOR ALL USING (true);
