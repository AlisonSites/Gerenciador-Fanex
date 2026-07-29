// ==========================================================
// FANEX - Trocar e-mail de usuário (somente Administrador)
// ==========================================================
// Mesmo motivo da função "admin-trocar-senha": o SDK do Supabase
// no navegador só altera o e-mail do PRÓPRIO usuário logado (e ainda
// exige confirmação por link). Para o administrador trocar o e-mail
// de outra pessoa diretamente, é necessário usar a Service Role Key,
// que só pode rodar no servidor — por isso esta Edge Function.
//
// Como implantar:
//   1. Instale a Supabase CLI: https://supabase.com/docs/guides/cli
//   2. No terminal, dentro da pasta do projeto: `supabase login`
//   3. `supabase link --project-ref SEU_PROJECT_REF`
//   4. `supabase functions deploy admin-trocar-email`
//
// A função exige um JWT válido e confere no banco se quem está
// chamando tem perfil "Administrador" antes de trocar o e-mail de
// qualquer pessoa. O e-mail novo já sai confirmado, para não travar
// o próximo login.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    // Cliente "do usuário" só pra descobrir quem está chamando.
    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: chamador }, error: erroChamador } = await supabaseCaller.auth.getUser()
    if (erroChamador || !chamador) {
      return new Response(JSON.stringify({ error: 'Sessão inválida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente com Service Role para checar o perfil e trocar o e-mail.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: usuarioChamador, error: erroPerfil } = await supabaseAdmin
      .from('usuarios')
      .select('id, perfis_acesso(nome)')
      .eq('user_id', chamador.id)
      .single()

    if (erroPerfil || usuarioChamador?.perfis_acesso?.nome !== 'Administrador') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem trocar o e-mail de outros usuários.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id, novo_email } = await req.json()
    const emailValido = typeof novo_email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo_email)
    if (!user_id || !emailValido) {
      return new Response(JSON.stringify({ error: 'Informe um usuário e um e-mail válido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: erroUpdate } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: novo_email,
      email_confirm: true,
    })
    if (erroUpdate) {
      return new Response(JSON.stringify({ error: erroUpdate.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro inesperado.'
    return new Response(JSON.stringify({ error: mensagem }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
