-- ====================================================================================
-- SCRIPT DE ACTUALIZACIÓN DE ESQUEMAS - SISTEMA DE CONTROL DE PAGOS
-- ====================================================================================
-- Este script agrega las columnas requeridas para las nuevas funcionalidades
-- en las tablas: planes_estudio, alumnos, y carreras (oferta_educativa).
-- ====================================================================================

-- 1. Modificaciones a la tabla planes_estudio
ALTER TABLE planes_estudio
ADD COLUMN IF NOT EXISTS id_tipo_periodo INT,
ADD COLUMN IF NOT EXISTS id_plan_certificacion INT;

-- 2. Modificaciones a la tabla alumnos
ALTER TABLE alumnos
ADD COLUMN IF NOT EXISTS id_sexo INT;

-- 3. Modificaciones a la tabla carreras
ALTER TABLE carreras
ADD COLUMN IF NOT EXISTS calificacion_minima INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS calificacion_maxima INT DEFAULT 10;

-- 4. Migración de datos existentes para alumnos (sexo)
UPDATE alumnos SET id_sexo = 251 WHERE sexo = 'H';
UPDATE alumnos SET id_sexo = 250 WHERE sexo = 'M';

