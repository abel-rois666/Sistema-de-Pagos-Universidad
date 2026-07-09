-- Migration: add_granular_grades_lock
-- Agrega columnas para el bloqueo granular y la solicitud de desbloqueo de calificaciones.

ALTER TABLE inscripciones_academicas
ADD COLUMN IF NOT EXISTS bloqueo_p1 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bloqueo_p2 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bloqueo_p3 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bloqueo_final BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS solicitud_p1 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS solicitud_p2 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS solicitud_p3 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS solicitud_final BOOLEAN DEFAULT false;
