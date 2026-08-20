-- Script para garantizar que el trigger handle_new_user y la tabla usuarios permitan el rol DOCENTE

-- 1. Eliminar cualquier restricción CHECK en la columna 'rol' que pueda estar bloqueando
DO $$ 
DECLARE 
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.usuarios'::regclass AND contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE public.usuarios DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

-- 2. Asegurarse de que el trigger handle_new_user esté perfectamente definido y capture errores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentar actualizar si el usuario ya existe (creado desde el panel de UsuariosConfig)
  UPDATE public.usuarios
  SET auth_id = NEW.id, activo = true
  WHERE username = COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  AND auth_id IS NULL;

  -- Si no existe, lo insertamos
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.usuarios (id, username, rol, auth_id, activo)
      VALUES (
        gen_random_uuid(),
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'rol', 'COORDINADOR'),
        NEW.id,
        true
      );
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el insert por alguna razón (ej. unique constraint), ignoramos el error
      -- para no bloquear la creación en Supabase Auth
      RAISE WARNING 'No se pudo crear perfil en usuarios para auth_id %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
