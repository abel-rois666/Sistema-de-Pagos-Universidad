-- =====================================================================================
-- MIGRACIÓN: AGREGAR TIPO DE GUÍA A EVALUACIONES NOM-035
-- =====================================================================================

ALTER TABLE nom035_evaluaciones
ADD COLUMN IF NOT EXISTS tipo_guia VARCHAR(20) DEFAULT 'GUIA_II';

-- Aseguramos que los registros futuros también deban indicar de qué guía provienen,
-- pero mantenemos el default por retrocompatibilidad con las que ya existan.
