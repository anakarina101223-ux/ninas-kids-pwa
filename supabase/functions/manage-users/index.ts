import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // El navegador manda una petición OPTIONS antes de la real (preflight) — hay que responderla
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (perfilError) {
      return new Response(JSON.stringify({
        error: `Error leyendo perfil`,
        detalle: perfilError.message,
        codigo: perfilError.code,
        hint: perfilError.hint,
        keyPresente: Boolean(Deno.env.get('SERVICE_ROLE_KEY')),
        keyLongitud: (Deno.env.get('SERVICE_ROLE_KEY') ?? '').length,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (perfil?.rol !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Solo el super admin puede gestionar usuarios' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()

    if (body.accion === 'crear') {
      const { data: nuevoUsuario, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: body.correo,
        password: body.contrasena,
        email_confirm: true,
      })
      if (authError) throw authError

      const { error: perfilError } = await supabaseAdmin.from('usuarios').insert({
        id: nuevoUsuario.user.id,
        nombre: body.nombre,
        correo: body.correo,
        rol: body.rol,
        creado_por: user.id,
      })
      if (perfilError) throw perfilError

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.accion === 'eliminar') {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(body.id)
      if (deleteError) throw deleteError
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Acción no reconocida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})