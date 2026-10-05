import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de peticiones CORS preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { crm_lead_id, accion, observaciones } = await req.json()

    if (!crm_lead_id || !accion) {
      throw new Error('Faltan parámetros requeridos: crm_lead_id y accion')
    }

    if (accion !== 'APROBAR' && accion !== 'RECHAZAR') {
      throw new Error('La acción debe ser APROBAR o RECHAZAR')
    }

    // ==============================================================================
    // 0. Validación Extra de Seguridad (Verificación de Rol)
    // ==============================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No se proporcionó token de autorización.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Cliente para verificar quién es el usuario actual usando su token
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      throw new Error(`Token inválido o expirado: ${authError?.message || 'Usuario no encontrado'}`)
    }

    // Cliente administrador para realizar las consultas operativas
    const localSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validar el rol del usuario en la base de datos
    const { data: usuarioData, error: usuarioError } = await localSupabase
      .from('usuarios')
      .select('rol')
      .eq('auth_id', user.id)
      .single()

    if (usuarioError || !usuarioData) {
      throw new Error('No se pudo verificar el rol del usuario.')
    }

    if (usuarioData.rol !== 'ADMINISTRADOR' && usuarioData.rol !== 'COORDINADOR CONTROL ESCOLAR') {
      throw new Error(`Acceso denegado: El rol '${usuarioData.rol}' no tiene permisos para aprobar o rechazar prospectos.`)
    }

    // ==============================================================================
    // 1. Lógica de la Base de Datos Local (Control Escolar)
    // ==============================================================================

    if (accion === 'APROBAR') {
      const { data, error } = await localSupabase
        .from('alumnos')
        .update({ estatus: 'ACTIVO' })
        .eq('crm_lead_id', crm_lead_id)
        .select()
      
      if (error) throw new Error(`Error local (APROBAR): ${error.message}`)
      if (!data || data.length === 0) throw new Error(`No se encontró el alumno con crm_lead_id ${crm_lead_id} para aprobar.`)
    } else if (accion === 'RECHAZAR') {
      const { data, error } = await localSupabase
        .from('alumnos')
        .update({ 
          estatus: 'RECHAZADO',
          observaciones_rechazo: observaciones || null
        })
        .eq('crm_lead_id', crm_lead_id)
        .select()
      
      if (error) throw new Error(`Error local (RECHAZAR): ${error.message}`)
      if (!data || data.length === 0) throw new Error(`No se encontró el alumno con crm_lead_id ${crm_lead_id} para rechazar.`)
    }

    // ==============================================================================
    // 2. Lógica de la Base de Datos Externa (CRM)
    // ==============================================================================
    const crmUrl = Deno.env.get('CRM_URL')
    const crmServiceKey = Deno.env.get('CRM_SERVICE_ROLE_KEY')

    if (!crmUrl || !crmServiceKey) {
      throw new Error('Faltan variables de entorno (CRM_URL, CRM_SERVICE_ROLE_KEY)')
    }

    // Cliente con privilegios administrativos para el CRM
    const crmSupabase = createClient(crmUrl, crmServiceKey)

    if (accion === 'APROBAR') {
      const { error } = await crmSupabase
        .from('leads')
        .update({ estado_transferencia: 'APROBADO' })
        .eq('id', crm_lead_id)
      
      if (error) throw new Error(`Error CRM (APROBAR): ${error.message}`)
    } else if (accion === 'RECHAZAR') {
      const { error } = await crmSupabase
        .from('leads')
        .update({ 
          estado_transferencia: 'RECHAZADO',
          observaciones_transferencia: observaciones || null
        })
        .eq('id', crm_lead_id)
      
      if (error) throw new Error(`Error CRM (RECHAZAR): ${error.message}`)
    }

    return new Response(
      JSON.stringify({ status: 200, message: 'Proceso de homologación completado exitosamente.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
