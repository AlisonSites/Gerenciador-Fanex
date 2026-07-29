import { supabase } from './supabase'

// Exclui um usuário por completo: chama a Edge Function
// "admin-excluir-usuario", que remove o cadastro (tabela `usuarios`) E a
// conta de acesso correspondente em auth.users (login/senha). Sem isso,
// a exclusão só "some" da tela, mas a conta continua existindo no Supabase.
//
// Se a função ainda não tiver sido implantada (veja o README), cai para
// excluir ao menos o cadastro e avisa que a conta de acesso pode ter
// ficado para trás.
export async function excluirUsuarioCompleto(usuario) {
  const { data, error } = await supabase.functions.invoke('admin-excluir-usuario', {
    body: { usuario_id: usuario.id },
  })

  if (!error && !data?.error) {
    return { ok: true, aviso: data?.aviso || null }
  }

  const { error: erroTabela } = await supabase.from('usuarios').delete().eq('id', usuario.id)
  if (erroTabela) {
    return { ok: false, error: erroTabela.message || 'Não foi possível excluir o usuário.' }
  }

  return {
    ok: true,
    aviso: usuario.user_id
      ? 'Cadastro excluído, mas a conta de acesso pode não ter sido removida (função "admin-excluir-usuario" não implantada — veja o README).'
      : null,
  }
}
