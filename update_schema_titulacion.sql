-- Script para actualizar el esquema para el módulo de Titulación DGAIR

-- 1. Añadir campos a la tabla ciclos_escolares
ALTER TABLE public.ciclos_escolares 
ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
ADD COLUMN IF NOT EXISTS fecha_termino DATE;

-- 2. Añadir campos a la tabla planes_estudio
ALTER TABLE public.planes_estudio 
ADD COLUMN IF NOT EXISTS id_autorizacion_reconocimiento INTEGER,
ADD COLUMN IF NOT EXISTS autorizacion_reconocimiento VARCHAR;
