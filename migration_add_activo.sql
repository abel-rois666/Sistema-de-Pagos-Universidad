-- ================================================================
-- MIGRACIÓN: Agregar campo 'activo' a public.usuarios
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Agregar columna activo (los usuarios existentes quedan activos por default)
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 2. Marcar como activos todos los usuarios existentes (por si acaso)
UPDATE public.usuarios SET activo = true WHERE activo IS NULL;

-- 3. Actualizar el trigger handle_new_user para incluir activo = true al crear nuevos perfiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Buscar perfil existente por username y actualizar auth_id
  UPDATE public.usuarios
  SET auth_id = NEW.id, activo = true
  WHERE username = COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  )
  AND auth_id IS NULL;

  -- Si no existe perfil previo, crear uno nuevo
  IF NOT FOUND THEN
    INSERT INTO public.usuarios (id, username, rol, auth_id, activo)
    VALUES (
      gen_random_uuid(),
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'rol', 'COORDINADOR'),
      NEW.id,
      true
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ================================================================
-- VERIFICAR:
-- SELECT username, rol, activo, auth_id FROM public.usuarios;
-- ================================================================
