-- 1. Eliminar duplicados en alumno_programas, conservando el más reciente o el que esté en estatus EGRESADO
WITH Duplicados AS (
    SELECT 
        id,
        alumno_id,
        plan_id,
        estatus,
        created_at,
        ROW_NUMBER() OVER(
            PARTITION BY alumno_id, plan_id 
            ORDER BY 
                CASE WHEN estatus ILIKE '%EGRESADO%' THEN 1 ELSE 2 END ASC,
                created_at DESC
        ) as rn
    FROM alumno_programas
)
DELETE FROM alumno_programas
WHERE id IN (
    SELECT id FROM Duplicados WHERE rn > 1
);

-- 2. Añadir restricción única para que no vuelva a ocurrir
ALTER TABLE alumno_programas
ADD CONSTRAINT uq_alumno_plan UNIQUE (alumno_id, plan_id);
