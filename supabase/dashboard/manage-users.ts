// GENERADO: npm run preparar:manage-users-dashboard
// Copiar TODO este archivo en index.ts del editor de la Edge Function manage-users.
// Incluye los módulos locales; conserva la importación HTTPS original de Supabase.
// No editar aquí: modificar supabase/functions/manage-users y volver a generar.
// SHA-256 de fuentes: 013848c50e9c2497dfd96ddd6e7cdade3c46bc7516c76142094a5bbd4024e70b

// supabase/functions/manage-users/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// supabase/functions/_shared/cuentaAdministrativa.ts
var ROLES_CUENTA_ADMINISTRATIVA = [
  "CAJERO",
  "COORDINADOR ACADEMICO",
  "COORDINADOR CONTROL ESCOLAR",
  "COORDINADOR FINANCIERO",
  "COORDINADOR RECURSOS HUMANOS",
  "ADMINISTRADOR"
];
function validarCuentaAdministrativa(datos) {
  const errores = [];
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(datos.username)) errores.push("El usuario debe tener 3–50 caracteres: minúsculas, números, punto, guion o guion bajo.");
  if (datos.password.length < 8 || datos.password.length > 128) errores.push("La contraseña debe tener entre 8 y 128 caracteres.");
  if (!ROLES_CUENTA_ADMINISTRATIVA.includes(datos.rol)) errores.push("Elige un rol de acceso. El cargo laboral no asigna permisos.");
  if (datos.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email) || datos.email.length > 254)) errores.push("Revisa el correo de la cuenta.");
  if (datos.motivo.trim().length < 10 || datos.motivo.length > 500) errores.push("Describe el respaldo de identidad con entre 10 y 500 caracteres.");
  return errores;
}

// supabase/functions/manage-users/cuentaAdministrativa.ts
async function crearCuentaAdministrativa(body, cliente, admin) {
  const datos = {
    username: String(body.username || "").trim().toLowerCase(),
    password: typeof body.password === "string" ? body.password : "",
    rol: String(body.rol || ""),
    email: String(body.email || "").trim().toLowerCase(),
    motivo: String(body.motivo || "").trim()
  };
  const errores = validarCuentaAdministrativa(datos);
  const empleado = String(body.empleado_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empleado) || !body.original || typeof body.original !== "object") errores.push("Selecciona un administrativo y revisa sus datos.");
  if (errores.length) return { status: 400, data: { error: errores.join(" ") } };
  const revision = await cliente.rpc("personal_administrativo_revisar_v1", { p_empleado: empleado });
  if (revision.error) return { status: 409, data: { error: "No se pudo revisar al administrativo. Verifica la migración y vuelve a consultar." } };
  if (revision.data?.empleado?.id !== empleado || !Array.isArray(revision.data?.cuentas)) return { status: 409, data: { error: "El servidor no confirmó la identidad administrativa. Vuelve a consultar." } };
  if (revision.data?.cuentas?.length) return { status: 409, data: { error: "La persona ya tiene una cuenta. Consúltala o vincúlala; no se creará otra." } };
  const repetido = await admin.from("usuarios").select("id").eq("username", datos.username).limit(1);
  if (repetido.error) return { status: 500, data: { error: "No se pudo comprobar el usuario existente." } };
  if (repetido.data?.length) return { status: 409, data: { error: "Ese usuario ya existe. Usa la opción de vincular cuenta existente." } };
  let authId;
  try {
    const creado = await admin.auth.admin.createUser({
      email: datos.email || `${datos.username}@cuom.sistema`,
      password: datos.password,
      email_confirm: true,
      user_metadata: { username: datos.username, rol: datos.rol, real_email: datos.email || null }
    });
    if (creado.error || !creado.data?.user?.id) throw new Error(creado.error?.message || "Auth no confirmó la creación.");
    authId = creado.data.user.id;
    const perfil = await admin.from("usuarios").select("id,username,rol,auth_id,empleado_id").eq("auth_id", authId).single();
    if (perfil.error || perfil.data?.auth_id !== authId || perfil.data?.username !== datos.username || perfil.data?.rol !== datos.rol) throw new Error("No se confirmó el perfil de la cuenta.");
    const vinculo = await cliente.rpc("personal_administrativo_vincular_cuenta_v1", {
      p_empleado: empleado,
      p_usuario: perfil.data.id,
      p_original: body.original,
      p_motivo: datos.motivo
    });
    if (vinculo.error || vinculo.data?.usuario_id !== perfil.data.id) throw new Error(vinculo.error?.message || "No se confirmó el vínculo con Personal.");
    return { status: 200, data: { success: true, userId: authId } };
  } catch (error) {
    if (authId) {
      const verificacion = await admin.from("usuarios").select("id,empleado_id,username,rol").eq("auth_id", authId).maybeSingle();
      if (!verificacion.error && verificacion.data?.empleado_id === empleado && verificacion.data?.username === datos.username && verificacion.data?.rol === datos.rol) return { status: 200, data: { success: true, userId: authId } };
      if (verificacion.error || verificacion.data?.empleado_id) return { status: 409, data: { error: "La creación necesita revisión en Usuarios. No repitas el alta hasta comprobar la cuenta." } };
      const deshacer = await admin.auth.admin.deleteUser(authId);
      if (deshacer.error) return { status: 409, data: { error: "No se pudo revertir la cuenta sin vínculo. Revisa Usuarios antes de repetir el alta." } };
      const limpiar = await admin.from("usuarios").delete().eq("auth_id", authId).is("empleado_id", null);
      if (limpiar.error) return { status: 409, data: { error: "Auth se revirtió, pero queda un perfil por revisar en Usuarios. No repitas el alta todavía." } };
    }
    return { status: 409, data: { error: error instanceof Error ? error.message : "No se pudo crear la cuenta administrativa." } };
  }
}

// supabase/functions/manage-users/cuentaDocenteExistente.ts
async function revisarCuentaDocenteExistente(docenteId, cliente, admin) {
  const vinculada = await admin.from("usuarios").select("id").eq("docente_id", docenteId).limit(1);
  if (vinculada.error) return "No se pudo comprobar la cuenta docente existente.";
  if (vinculada.data?.length) return "El docente ya tiene una cuenta; adminístrala desde Usuarios.";
  const docente = await admin.from("docentes").select("id,persona_id").eq("id", docenteId).maybeSingle();
  if (docente.error?.code === "42703") return null;
  if (docente.error || !docente.data) return "No se pudo verificar la identidad del docente.";
  if (!docente.data.persona_id) return null;
  const empleado = await admin.from("empleados").select("id").eq("persona_id", docente.data.persona_id).maybeSingle();
  if (empleado.error) return "No se pudo comprobar la función administrativa compartida.";
  if (!empleado.data) return null;
  const cuentas = await cliente.rpc("personal_cuentas_administrativas_v1", { p_ids: [empleado.data.id] });
  if (["PGRST202", "42883"].includes(cuentas.error?.code || "")) return null;
  if (cuentas.error || !Array.isArray(cuentas.data)) return "No se pudo comprobar el acceso de la función administrativa.";
  if (cuentas.data.some((f) => f.cuentas?.length)) return "Esta persona ya tiene cuenta administrativa. Completa su vínculo docente desde Recursos Humanos → Personal, sin crear otra cuenta.";
  return null;
}

// supabase/functions/manage-users/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  let body;
  try {
    body = await req.json();
  } catch (parseErr) {
    return json({ error: "No se pudo leer el cuerpo de la petición. Asegúrate de enviar JSON válido." }, 400);
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No autorizado: falta el header Authorization." }, 401);
    }
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get("SUPABASE_URL"),
      // @ts-ignore
      Deno.env.get("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: rolData, error: rolError } = await supabaseClient.rpc("get_my_rol");
    if (rolError) {
      return json({ error: `Error al verificar rol: ${rolError.message}` }, 500);
    }
    if (rolData !== "ADMINISTRADOR") {
      return json({ error: "Acceso denegado: solo los administradores pueden gestionar usuarios." }, 403);
    }
    const { data: { user: callerUser }, error: callerError } = await supabaseClient.auth.getUser();
    if (callerError || !callerUser) {
      return json({ error: "No se pudo validar la sesión del administrador." }, 401);
    }
    const { data: callerProfile, error: profileError } = await supabaseClient.from("usuarios").select("activo").eq("auth_id", callerUser.id).maybeSingle();
    if (profileError) return json({ error: "No se pudo comprobar el estado del administrador." }, 500);
    if (callerProfile?.activo !== true) {
      return json({ error: "La cuenta administradora está inactiva." }, 403);
    }
    const callerAuthId = callerUser?.id;
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get("SUPABASE_URL"),
      // @ts-ignore
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { action } = body;
    if (action === "CREATE_ADMINISTRATIVO") {
      const resultado = await crearCuentaAdministrativa(body, supabaseClient, supabaseAdmin);
      return json(resultado.data, resultado.status);
    }
    if (action === "CREATE") {
      const { username, password, rol, docente_id, email: userEmail } = body;
      if (!username?.trim() || !password || !rol) {
        return json({ error: "username, password y rol son requeridos." }, 400);
      }
      if (password.length < 8) {
        return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
      }
      if (docente_id) {
        const bloqueo = await revisarCuentaDocenteExistente(docente_id, supabaseClient, supabaseAdmin);
        if (bloqueo) return json({ error: bloqueo }, 409);
      }
      const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "");
      if (!cleanUsername) {
        return json({ error: `El nombre de usuario "${username}" quedó vacío tras sanitizar.` }, 400);
      }
      const realEmail = userEmail && userEmail.trim().includes("@") ? userEmail.trim().toLowerCase() : null;
      const email = realEmail || `${cleanUsername}@cuom.sistema`;
      console.log(`[CREATE] username="${username}" → clean="${cleanUsername}" → email="${email}" realEmail="${realEmail}" rol="${rol}" docente_id="${docente_id || "N/A"}"`);
      let authData;
      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            username: cleanUsername,
            rol,
            real_email: realEmail
          }
        });
        if (result.error) {
          const e = result.error;
          const errMsg = e?.message || e?.msg || e?.error_description || e?.statusText || (typeof e === "string" ? e : "") || (Object.keys(e).length > 0 ? JSON.stringify(e) : `[Error tipo ${typeof e}: ${String(e)}]`);
          const errLower = (errMsg || "").toLowerCase();
          console.log(`[CREATE ERROR] Full error object:`, JSON.stringify(e, Object.getOwnPropertyNames(e)));
          if (errLower.includes("already been registered") || errLower.includes("already exists")) {
            return json({ error: `Ese nombre de usuario o correo ya existe en el sistema (${email}).` }, 409);
          }
          return json({ error: `Error de Auth al crear usuario (email: ${email}): ${errMsg}` }, 500);
        }
        authData = result.data;
      } catch (authErr) {
        const e = authErr;
        const catchMsg = e?.message || e?.msg || e?.error_description || (typeof e === "string" ? e : JSON.stringify(e, Object.getOwnPropertyNames(e)));
        return json({ error: `Excepción al crear usuario en Auth (email: ${email}): ${catchMsg}` }, 500);
      }
      if (!authData?.user?.id) {
        return json({ error: "Auth no devolvió un usuario válido tras la creación." }, 500);
      }
      if (docente_id) {
        await new Promise((r) => setTimeout(r, 500));
        const { error: linkError } = await supabaseAdmin.from("usuarios").update({ docente_id }).eq("auth_id", authData.user.id);
        if (linkError) {
          console.error("Error vinculando docente_id:", linkError);
          return json({ error: "Auth creó la cuenta, pero no se confirmó su vínculo docente. Revisa Usuarios antes de repetir el alta; no se eliminaron cuentas preexistentes." }, 409);
        }
      }
      return json({ success: true, userId: authData.user.id });
    }
    if (action === "UPDATE") {
      const { authId, password, rol, email: newEmail } = body;
      if (!authId) {
        return json({ error: "authId es requerido." }, 400);
      }
      if (password || newEmail) {
        const attributes = {};
        if (password) {
          if (password.length < 8) {
            return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
          }
          attributes.password = password;
        }
        if (newEmail && newEmail.trim().includes("@")) {
          attributes.email = newEmail.trim().toLowerCase();
          attributes.email_confirm = true;
          attributes.user_metadata = { real_email: attributes.email };
        }
        const { error: updateAuthError, data: updateData } = await supabaseAdmin.auth.admin.updateUserById(authId, attributes);
        if (updateAuthError) {
          return json({ error: `Error al actualizar Auth: ${updateAuthError.message}` }, 500);
        }
        if (!updateData || !updateData.user) {
          return json({ error: "Fallo silencioso en Auth: El usuario no existe o no pudo ser editado." }, 500);
        }
      }
      if (rol) {
        await supabaseAdmin.from("usuarios").update({ rol }).eq("auth_id", authId);
      }
      return json({ success: true });
    }
    if (action === "DEACTIVATE") {
      const { authId } = body;
      if (!authId) {
        return json({ error: "authId es requerido." }, 400);
      }
      if (authId === callerAuthId) {
        return json({ error: "No puedes desactivar tu propia cuenta." }, 400);
      }
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        ban_duration: "876000h"
      });
      if (banError) {
        return json({ error: `Error al desactivar: ${banError.message}` }, 500);
      }
      await supabaseAdmin.from("usuarios").update({ activo: false }).eq("auth_id", authId);
      return json({ success: true });
    }
    if (action === "REACTIVATE") {
      const { authId } = body;
      if (!authId) {
        return json({ error: "authId es requerido." }, 400);
      }
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        ban_duration: "none"
      });
      if (unbanError) {
        return json({ error: `Error al reactivar: ${unbanError.message}` }, 500);
      }
      await supabaseAdmin.from("usuarios").update({ activo: true }).eq("auth_id", authId);
      return json({ success: true });
    }
    if (action === "DELETE") {
      const { authId } = body;
      if (!authId) {
        return json({ error: "authId es requerido para eliminar." }, 400);
      }
      if (authId === callerAuthId) {
        return json({ error: "No puedes eliminar tu propia cuenta." }, 400);
      }
      const { error: dbError } = await supabaseAdmin.from("usuarios").delete().eq("auth_id", authId);
      if (dbError) {
        console.warn("Error eliminando de public.usuarios (puede ser normal si ya no existía):", dbError);
      }
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authId);
      if (deleteError) {
        return json({ error: `Error al eliminar de Auth: ${deleteError.message}` }, 500);
      }
      return json({ success: true });
    }
    return json({ error: `Acción desconocida: "${action}"` }, 400);
  } catch (error) {
    console.error("manage-users Edge Function error:", error);
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
    return json({ error: `Error interno: ${msg}` }, 500);
  }
});
