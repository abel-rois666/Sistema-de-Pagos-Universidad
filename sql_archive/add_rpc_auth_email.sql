-- ======================================================================================
-- PUENTE DE AUTENTICACIÓN (LOGIN POR USERNAME CON CORREO REAL)
-- ======================================================================================

-- Esta función permite a la pantalla de Login buscar el correo real de un usuario
-- (sea técnico o real) basándose únicamente en su nombre de usuario.
-- Utiliza SECURITY DEFINER para poder leer auth.users sin necesidad de estar logueado.

CREATE OR REPLACE FUNCTION get_auth_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Se asume que el username se guarda siempre en minúsculas y sin espacios
  SELECT email INTO v_email
  FROM auth.users
  WHERE raw_user_meta_data->>'username' = lower(p_username)
  LIMIT 1;
  
  RETURN v_email;
END;
$$;

-- Permitimos que los usuarios anónimos (pantalla de login) y autenticados puedan ejecutar la función
GRANT EXECUTE ON FUNCTION get_auth_email_by_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_auth_email_by_username(TEXT) TO authenticated;
