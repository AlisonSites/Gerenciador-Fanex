// ==========================================================
// FANEX - Consultar e-mail atual de um usuário (somente Administrador)
// ==========================================================
// Usado pela tela "Gerenciar Usuários" para mostrar o e-mail atual
// antes do administrador trocá-lo. A tabela `usuarios` não guarda
// e-mail (ele vive em auth.users), e o navegador não tem permissão
// para ler dados de outros usuários do Auth — só a Service Role Key
// consegue, por isso esta Edge Function.
//
// Como implantar:
//   supabase functions deploy admin-obter-email

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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: usuarioChamador, error: erroPerfil } = await supabaseAdmin
      .from('usuarios')
      .select('id, perfis_acesso(nome)')
      .eq('user_id', chamador.id)
      .single()

    if (erroPerfil || usuarioChamador?.perfis_acesso?.nome !== 'Administrador') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem consultar o e-mail de outros usuários.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Informe o usuário.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error: erroBusca } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (erroBusca) {
      return new Response(JSON.stringify({ error: erroBusca.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ email: data.user?.email || null }), {
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
