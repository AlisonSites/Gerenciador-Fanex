import { supabase } from './supabase'

// Registra uma ação de negócio no log de auditoria (criar/editar/excluir
// usuários, grupos, perfis, unidades, tarefas etc.). Nunca lança exceção —
// se o próprio registro falhar, só avisa no console, para não travar a
// ação que estava sendo auditada.
export async function registrarAuditoria({ acao, modulo, descricao, dadosAntes = null, dadosDepois = null }) {
  try {
    const { data: sessao } = await supabase.auth.getSession()
    const userId = sessao?.session?.user?.id
    let usuarioId = null

    if (userId) {
      const { data: usuarioRow } = await supabase
        .from('usuarios')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      usuarioId = usuarioRow?.id || null
    }

    await supabase.from('logs_auditoria').insert({
      usuario_id: usuarioId,
      acao,
      modulo,
      descricao: String(descricao || '').slice(0, 2000),
      dados_antes: dadosAntes,
      dados_depois: dadosDepois,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Não foi possível registrar a auditoria:', err)
  }
}

export async function listarAuditoria({ limite = 300 } = {}) {
  const { data, error } = await supabase
    .from('logs_auditoria')
    .select('*, usuarios(nome_completo)')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data || []
}

export async function limparAuditoria() {
  const { error } = await supabase.from('logs_auditoria').delete().not('id', 'is', null)
  if (error) throw error
}

export async function excluirRegistroAuditoria(id) {
  const { error } = await supabase.from('logs_auditoria').delete().eq('id', id)
  if (error) throw error
}
