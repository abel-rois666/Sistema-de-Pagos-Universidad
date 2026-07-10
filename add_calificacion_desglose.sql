-- =====================================================================================
-- MIGRACIÓN: AGREGAR COLUMNA PARA DESGLOSE DE CALIFICACIONES (NOM-035)
-- =====================================================================================

ALTER TABLE nom035_evaluaciones
ADD COLUMN IF NOT EXISTS calificacion_desglose JSONB;
