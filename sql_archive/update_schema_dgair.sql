-- Actualización del esquema para el Layout DGAIR

ALTER TABLE planes_estudio ADD COLUMN IF NOT EXISTS total_asignaturas INT DEFAULT 0;
ALTER TABLE inscripciones_academicas ADD COLUMN IF NOT EXISTS id_observacion_certificacion INT;
