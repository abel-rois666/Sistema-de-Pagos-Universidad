// Edge Function: manage-users
// Supabase Dashboard → Edge Functions → New Function → nombre: "manage-users"
// Pega este código completo y haz Deploy.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
// son inyectadas automáticamente por Supabase en todas las Edge Functions.

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

  // ── LEER EL BODY INMEDIATAMENTE (solo se puede leer una vez en Deno) ──
  let body: any;
  try {
    body = await req.json();
  } catch (parseErr) {
    return json({ error: 'No se pudo leer el cuerpo de la petición. Asegúrate de enviar JSON válido.' }, 400);
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
    if (rolError) {
      return json({ error: `Error al verificar rol: ${rolError.message}` }, 500);
    }
    if (rolData !== 'ADMINISTRADOR') {
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

    const { action } = body;

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: CREATE — Crear nuevo usuario
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'CREATE') {
      const { username, password, rol, docente_id, email: userEmail } = body;

      if (!username?.trim() || !password || !rol) {
        return json({ error: 'username, password y rol son requeridos.' }, 400);
      }
      if (password.length < 8) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
      }

      const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
      
      if (!cleanUsername) {
        return json({ error: `El nombre de usuario "${username}" quedó vacío tras sanitizar.` }, 400);
      }

      const realEmail = (userEmail && userEmail.trim().includes('@')) ? userEmail.trim().toLowerCase() : null;
      // Usar el correo real si se proporciona, sino usar uno técnico
      const email = realEmail || `${cleanUsername}@cuom.sistema`;

      console.log(`[CREATE] username="${username}" → clean="${cleanUsername}" → email="${email}" realEmail="${realEmail}" rol="${rol}" docente_id="${docente_id || 'N/A'}"`);

      let authData: any;
      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            username: cleanUsername,
            rol,
            real_email: realEmail
          },
        });

        if (result.error) {
          // Extraer mensaje de CUALQUIER formato de error (AuthError, objeto plano, Error estándar)
          const e = result.error;
          const errMsg = e?.message || e?.msg || e?.error_description || e?.statusText || 
                         (typeof e === 'string' ? e : '') ||
                         (Object.keys(e).length > 0 ? JSON.stringify(e) : `[Error tipo ${typeof e}: ${String(e)}]`);
          const errLower = (errMsg || '').toLowerCase();
          
          console.log(`[CREATE ERROR] Full error object:`, JSON.stringify(e, Object.getOwnPropertyNames(e)));
          
          if (errLower.includes('already been registered') || errLower.includes('already exists')) {
            return json({ error: `Ese nombre de usuario o correo ya existe en el sistema (${email}).` }, 409);
          }
          return json({ error: `Error de Auth al crear usuario (email: ${email}): ${errMsg}` }, 500);
        }
        authData = result.data;
      } catch (authErr: any) {
        const e = authErr;
        const catchMsg = e?.message || e?.msg || e?.error_description || 
                         (typeof e === 'string' ? e : JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return json({ error: `Excepción al crear usuario en Auth (email: ${email}): ${catchMsg}` }, 500);
      }

      if (!authData?.user?.id) {
        return json({ error: 'Auth no devolvió un usuario válido tras la creación.' }, 500);
      }

      // El trigger handle_new_user() crea automáticamente el perfil en public.usuarios
      // Si se provee docente_id, lo actualizamos de inmediato.
      if (docente_id) {
        // Hacemos una pausa mínima para asegurarnos que el trigger terminó
        await new Promise(r => setTimeout(r, 500));
        const { error: linkError } = await supabaseAdmin
          .from('usuarios')
          .update({ docente_id })
          .eq('auth_id', authData.user.id);
        
        if (linkError) {
          console.error('Error vinculando docente_id:', linkError);
          // No hacemos throw porque el usuario ya fue creado exitosamente
        }
      }

      return json({ success: true, userId: authData.user.id });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: UPDATE — Cambiar contraseña y/o rol
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'UPDATE') {
      const { authId, password, rol, email: newEmail } = body;

      if (!authId) {
        return json({ error: 'authId es requerido.' }, 400);
      }

      // Actualizar contraseña y/o email
      if (password || newEmail) {
        const attributes: any = {};
        
        if (password) {
          if (password.length < 8) {
            return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
          }
          attributes.password = password;
        }

        if (newEmail && newEmail.trim().includes('@')) {
          attributes.email = newEmail.trim().toLowerCase();
          attributes.email_confirm = true;
          // Actualizamos también el real_email en la metadata
          attributes.user_metadata = { real_email: attributes.email };
        }

        const { error: updateAuthError, data: updateData } = await supabaseAdmin.auth.admin.updateUserById(authId, attributes);
        if (updateAuthError) {
          return json({ error: `Error al actualizar Auth: ${updateAuthError.message}` }, 500);
        }
        
        // Extra verificación: si data es null, la librería falló silenciosamente
        if (!updateData || !updateData.user) {
          return json({ error: 'Fallo silencioso en Auth: El usuario no existe o no pudo ser editado.' }, 500);
        }
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
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        ban_duration: '876000h',
      });
      if (banError) {
        return json({ error: `Error al desactivar: ${banError.message}` }, 500);
      }

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
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        ban_duration: 'none',
      });
      if (unbanError) {
        return json({ error: `Error al reactivar: ${unbanError.message}` }, 500);
      }

      // Marcar como activo en public.usuarios
      await supabaseAdmin.from('usuarios').update({ activo: true }).eq('auth_id', authId);

      return json({ success: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACCIÓN: DELETE — Eliminar usuario permanentemente
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'DELETE') {
      const { authId } = body;

      if (!authId) {
        return json({ error: 'authId es requerido para eliminar.' }, 400);
      }
      if (authId === callerAuthId) {
        return json({ error: 'No puedes eliminar tu propia cuenta.' }, 400);
      }

      // Eliminar de public.usuarios primero (o dejar que cascade si existe)
      const { error: dbError } = await supabaseAdmin.from('usuarios').delete().eq('auth_id', authId);
      if (dbError) {
        console.warn('Error eliminando de public.usuarios (puede ser normal si ya no existía):', dbError);
      }

      // Eliminar permanentemente de Supabase Auth
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authId);
      if (deleteError) {
        return json({ error: `Error al eliminar de Auth: ${deleteError.message}` }, 500);
      }

      return json({ success: true });
    }

    return json({ error: `Acción desconocida: "${action}"` }, 400);

  } catch (error: any) {
    console.error('manage-users Edge Function error:', error);
    const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    return json({ error: `Error interno: ${msg}` }, 500);
  }
});
