-- Script para actualizar la restricción de roles permitidos en la tabla usuarios

DO $$
DECLARE
    constraint_name text;
BEGIN
    -- 1. Buscar si existe alguna restricción CHECK en la columna 'rol'
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = ANY(con.conkey)
    WHERE rel.relname = 'usuarios' 
      AND con.contype = 'c' 
      AND attr.attname = 'rol';

    -- 2. Si existe, la eliminamos
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.usuarios DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Restricción % eliminada correctamente.', constraint_name;
    ELSE
        RAISE NOTICE 'No se encontró restricción CHECK en la columna rol.';
    END IF;

    -- 3. Volvemos a crear la restricción, ahora incluyendo 'DOCENTE'
    ALTER TABLE public.usuarios 
    ADD CONSTRAINT usuarios_rol_check 
    CHECK (rol IN ('ADMINISTRADOR', 'COORDINADOR', 'CAJERO', 'DOCENTE'));
    
    RAISE NOTICE 'Nueva restricción usuarios_rol_check aplicada con éxito.';
END $$;
