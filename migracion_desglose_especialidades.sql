-- ======================================================================================
-- MIGRACIÓN PARA DESGLOSE AL GUSTO DE LAS ESPECIALIDADES
-- Añade la capacidad de guardar la "cotización" de servicios dentro del mismo plan
-- Ejecutar en el SQL Editor de Supabase
-- ======================================================================================

-- 1. Eliminar la vista temporalmente para poder modificar las tablas
DROP VIEW IF EXISTS public.vista_planes_pago;

-- 2. Añadir nuevas columnas a la tabla planes_pago
ALTER TABLE public.planes_pago
ADD COLUMN IF NOT EXISTS desglose_conceptos JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS desglose_total_bruto NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS desglose_descuento_porcentaje NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS desglose_descuento_monto NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS desglose_total_neto NUMERIC(10,2) DEFAULT 0;

-- 3. Recrear la Vista Integrando Todas las Columnas Restantes + las Nuevas
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

    -- Nuevas Columnas de Desglose
    p.desglose_conceptos,
    p.desglose_total_bruto,
    p.desglose_descuento_porcentaje,
    p.desglose_descuento_monto,
    p.desglose_total_neto,
    
    a.licenciatura,
    (COALESCE(p.grado, a.grado_actual) || ' - ' || COALESCE(p.turno, a.turno)) AS grado_turno,
    p.grado,
    p.turno,
    p.tipo_plan
FROM public.planes_pago p
LEFT JOIN public.alumnos a ON p.alumno_id = a.id
LEFT JOIN public.ciclos_escolares c ON p.ciclo_id = c.id;
