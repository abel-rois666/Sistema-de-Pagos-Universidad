-- Script para limpiar inscripciones sin calificaciones para un alumno específico
DELETE FROM public.inscripciones_academicas
WHERE id IN (
  SELECT ia.id
  FROM public.inscripciones_academicas ia
  JOIN public.alumnos a ON ia.alumno_id = a.id
  WHERE a.matricula = 'AQUI_PON_LA_MATRICULA'
    AND (ia.parcial_1 IS NULL OR ia.parcial_1::text = '')
    AND (ia.parcial_2 IS NULL OR ia.parcial_2::text = '')
    AND (ia.parcial_3 IS NULL OR ia.parcial_3::text = '')
    AND (ia.calificacion_final IS NULL)
);
