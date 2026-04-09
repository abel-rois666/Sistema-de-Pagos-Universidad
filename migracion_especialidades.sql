-- ======================================================================================
-- MIGRACIÓN PARA TIPO DE PLANES AMPLIADOS (15 CONCEPTOS) Y PLANES SIMULTÁNEOS
-- Ejecutar en el SQL Editor de Supabase
-- ======================================================================================

-- 1. Eliminar la restricción que impedía Múltiples Planes por Alumno en el mismo Ciclo
ALTER TABLE public.planes_pago DROP CONSTRAINT IF EXISTS planes_pago_alumno_id_ciclo_id_key;
ALTER TABLE public.planes_pago DROP CONSTRAINT IF EXISTS planes_pago_tipo_plan_check;
ALTER TABLE public.plantillas_plan DROP CONSTRAINT IF EXISTS plantillas_plan_tipo_plan_check;

-- 2. Eliminar la vista temporalmente para poder modificar las tablas
DROP VIEW IF EXISTS public.vista_planes_pago;

-- 3. Añadir columnas 10 al 15 a la tabla plantillas_plan
ALTER TABLE public.plantillas_plan
ADD COLUMN IF NOT EXISTS concepto_10 TEXT, ADD COLUMN IF NOT EXISTS fecha_10 DATE, ADD COLUMN IF NOT EXISTS cantidad_10 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS concepto_11 TEXT, ADD COLUMN IF NOT EXISTS fecha_11 DATE, ADD COLUMN IF NOT EXISTS cantidad_11 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS concepto_12 TEXT, ADD COLUMN IF NOT EXISTS fecha_12 DATE, ADD COLUMN IF NOT EXISTS cantidad_12 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS concepto_13 TEXT, ADD COLUMN IF NOT EXISTS fecha_13 DATE, ADD COLUMN IF NOT EXISTS cantidad_13 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS concepto_14 TEXT, ADD COLUMN IF NOT EXISTS fecha_14 DATE, ADD COLUMN IF NOT EXISTS cantidad_14 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS concepto_15 TEXT, ADD COLUMN IF NOT EXISTS fecha_15 DATE, ADD COLUMN IF NOT EXISTS cantidad_15 NUMERIC(10,2);

-- 4. Añadir columnas 10 al 15 a la tabla planes_pago
ALTER TABLE public.planes_pago
ADD COLUMN IF NOT EXISTS concepto_10 TEXT, ADD COLUMN IF NOT EXISTS fecha_10 DATE, ADD COLUMN IF NOT EXISTS cantidad_10 NUMERIC(10,2), ADD COLUMN IF NOT EXISTS estatus_10 TEXT DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS concepto_11 TEXT, ADD COLUMN IF NOT EXISTS fecha_11 DATE, ADD COLUMN IF NOT EXISTS cantidad_11 NUMERIC(10,2), ADD COLUMN IF NOT EXISTS estatus_11 TEXT DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS concepto_12 TEXT, ADD COLUMN IF NOT EXISTS fecha_12 DATE, ADD COLUMN IF NOT EXISTS cantidad_12 NUMERIC(10,2), ADD COLUMN IF NOT EXISTS estatus_12 TEXT DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS concepto_13 TEXT, ADD COLUMN IF NOT EXISTS fecha_13 DATE, ADD COLUMN IF NOT EXISTS cantidad_13 NUMERIC(10,2), ADD COLUMN IF NOT EXISTS estatus_13 TEXT DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS concepto_14 TEXT, ADD COLUMN IF NOT EXISTS fecha_14 DATE, ADD COLUMN IF NOT EXISTS cantidad_14 NUMERIC(10,2), ADD COLUMN IF NOT EXISTS estatus_14 TEXT DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS concepto_15 TEXT, ADD COLUMN IF NOT EXISTS fecha_15 DATE, ADD COLUMN IF NOT EXISTS cantidad_15 NUMERIC(10,2), ADD COLUMN IF NOT EXISTS estatus_15 TEXT DEFAULT 'PENDIENTE';

-- 5. Recrear la Vista Integrando los Nuevos Conceptos
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
    
    a.licenciatura,
    (COALESCE(p.grado, a.grado_actual) || ' - ' || COALESCE(p.turno, a.turno)) AS grado_turno,
    p.grado,
    p.turno,
    p.tipo_plan
FROM public.planes_pago p
LEFT JOIN public.alumnos a ON p.alumno_id = a.id
LEFT JOIN public.ciclos_escolares c ON p.ciclo_id = c.id;
