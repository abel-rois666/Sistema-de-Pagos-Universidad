// Edge Function: manage-users
// Supabase Dashboard → Edge Functions → New Function → nombre: "manage-users"
// Pega este código completo y haz Deploy.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
// son inyectadas automáticamente por Supabase en todas las Edge Functions.

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore
Deno.serve(async (req) => {
  // Responder preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verificar autenticación ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'No autorizado: falta el header Authorization.' }, 401);
    }

    // ── 2. Verificar rol ADMINISTRADOR con el JWT del caller ──────────────
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL')!,
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: rolData, error: rolError } = await supabaseClient.rpc('get_my_rol');
    if (rolError || rolData !== 'ADMINISTRADOR') {
      return json({ error: 'Acceso denegado: solo los administradores pueden gestionar usuarios.' }, 403);
    }

    // ── 3. Obtener el auth_id del caller (para evitar que se auto-desactive) ──
    const { data: { user: callerUser } } = await supabaseClient.auth.getUser();
    const callerAuthId = callerUser?.id;

    // ── 4. Cliente admin con service_role (nunca sale al cliente) ─────────
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL')!,
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { action } = body;

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: CREATE — Crear nuevo usuario
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'CREATE') {
      const { username, password, rol } = body;

      if (!username?.trim() || !password || !rol) {
        return json({ error: 'username, password y rol son requeridos.' }, 400);
      }
      if (password.length < 8) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
      }

      const email = `${username.trim().toLowerCase()}@cuom.sistema`;

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: username.trim(),
          rol,
        },
      });

      if (createError) {
        if (createError.message.toLowerCase().includes('already been registered') ||
            createError.message.toLowerCase().includes('already exists')) {
          return json({ error: 'Ese nombre de usuario ya existe en el sistema.' }, 409);
        }
        throw createError;
      }

      // El trigger handle_new_user() crea automáticamente el perfil en public.usuarios
      return json({ success: true, userId: authData.user.id });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: UPDATE — Cambiar contraseña y/o rol
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'UPDATE') {
      const { authId, password, rol } = body;

      if (!authId) {
        return json({ error: 'authId es requerido.' }, 400);
      }

      // Actualizar contraseña en Supabase Auth
      if (password) {
        if (password.length < 8) {
          return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
        }
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUser(authId, { password });
        if (updateAuthError) throw updateAuthError;
      }

      // Actualizar rol en public.usuarios
      if (rol) {
        await supabaseAdmin.from('usuarios').update({ rol }).eq('auth_id', authId);
      }

      return json({ success: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: DEACTIVATE — Desactivar usuario (soft delete)
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'DEACTIVATE') {
      const { authId } = body;

      if (!authId) {
        return json({ error: 'authId es requerido.' }, 400);
      }
      if (authId === callerAuthId) {
        return json({ error: 'No puedes desactivar tu propia cuenta.' }, 400);
      }

      // Banear en Supabase Auth (efectivamente permanente: 100 años)
      const { error: banError } = await supabaseAdmin.auth.admin.updateUser(authId, {
        ban_duration: '876000h',
      });
      if (banError) throw banError;

      // Marcar como inactivo en public.usuarios
      await supabaseAdmin.from('usuarios').update({ activo: false }).eq('auth_id', authId);

      return json({ success: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: REACTIVATE — Reactivar usuario previamente desactivado
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'REACTIVATE') {
      const { authId } = body;

      if (!authId) {
        return json({ error: 'authId es requerido.' }, 400);
      }

      // Eliminar el ban en Supabase Auth
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUser(authId, {
        ban_duration: 'none',
      });
      if (unbanError) throw unbanError;

      // Marcar como activo en public.usuarios
      await supabaseAdmin.from('usuarios').update({ activo: true }).eq('auth_id', authId);

      return json({ success: true });
    }

    return json({ error: `Acción desconocida: "${action}"` }, 400);

  } catch (error: any) {
    console.error('manage-users Edge Function error:', error);
    return json({ error: error.message ?? 'Error interno del servidor.' }, 500);
  }
});
