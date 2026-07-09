-- =========================================================================
-- SOLUCIÓN A CORREOS DESINCRONIZADOS DE DOCENTES EN AUTH
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- Este script busca a todos los usuarios en auth.users cuyo correo no 
-- termine en '@cuom.sistema' y lo actualiza forzosamente para que el 
-- formulario de Login pueda encontrarlos por su nombre de usuario.

UPDATE auth.users
SET email = raw_user_meta_data->>'username' || '@cuom.sistema'
WHERE email NOT LIKE '%@cuom.sistema' 
  AND raw_user_meta_data->>'username' IS NOT NULL;
