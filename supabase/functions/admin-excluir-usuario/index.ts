// ==========================================================
// FANEX - Excluir usuário por completo (somente Administrador)
// ==========================================================
// PROBLEMA QUE ISSO RESOLVE:
// A tela de usuários excluía apenas a linha da tabela `usuarios`
// (o "cadastro"), mas nunca a conta de acesso correspondente em
// auth.users (o "login"). Isso é o motivo pelo qual parecia que a
// exclusão "só tirava do aplicativo": a pessoa excluída continuava
// existindo no Supabase Auth, com e-mail e senha funcionando.
//
// O SDK do navegador não consegue apagar a conta de OUTRA pessoa —
// isso exige a Service Role Key, que só pode rodar no servidor.
// Por isso esta Edge Function apaga as duas coisas juntas: o
// cadastro em `usuarios` e a conta em auth.users.
//
// Como implantar:
//   supabase functions deploy admin-excluir-usuario

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
      return new Response(JSON.stringify({ error: 'Apenas administradores podem excluir usuários.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { usuario_id } = await req.json()
    if (!usuario_id) {
      return new Response(JSON.stringify({ error: 'Informe o usuário a excluir.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: alvo, error: erroAlvo } = await supabaseAdmin
      .from('usuarios')
      .select('id, user_id')
      .eq('id', usuario_id)
      .single()
    if (erroAlvo || !alvo) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Apaga primeiro o cadastro (evita deixar linha órfã caso a exclusão
    // do Auth falhe) e só depois a conta de acesso.
    const { error: erroExcluirCadastro } = await supabaseAdmin.from('usuarios').delete().eq('id', alvo.id)
    if (erroExcluirCadastro) {
      return new Response(JSON.stringify({ error: erroExcluirCadastro.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (alvo.user_id) {
      const { error: erroExcluirAuth } = await supabaseAdmin.auth.admin.deleteUser(alvo.user_id)
      if (erroExcluirAuth) {
        // O cadastro já foi removido; avisa que a conta de acesso precisa
        // de atenção manual, mas não trata como falha total.
        return new Response(JSON.stringify({
          ok: true,
          aviso: `Cadastro excluído, mas não foi possível remover a conta de acesso: ${erroExcluirAuth.message}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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
