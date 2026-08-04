import { supabase } from './supabase'

// Registra um erro na tabela `log_erros`. Nunca lança exceção — se o
// próprio registro do log falhar (ex.: sem sessão, sem internet), só
// avisa no console para não criar um novo erro em cascata.
export async function registrarErro({ origem, mensagem, detalhes, nivel = 'error' }) {
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

    await supabase.from('log_erros').insert({
      nivel,
      origem: origem || 'desconhecido',
      mensagem: String(mensagem || 'Erro sem mensagem').slice(0, 2000),
      detalhes: detalhes || null,
      pagina: typeof window !== 'undefined' ? window.location.pathname : null,
      usuario_id: usuarioId,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Não foi possível registrar o erro no log:', err)
  }
}

export async function listarLogs({ limite = 200 } = {}) {
  const { data, error } = await supabase
    .from('log_erros')
    .select('*, usuarios(nome_completo)')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data || []
}

export async function limparLogs() {
  // Remove todos os registros (delete "em massa" via filtro sempre verdadeiro).
  const { error } = await supabase.from('log_erros').delete().not('id', 'is', null)
  if (error) throw error
}

export async function excluirLog(id) {
  const { error } = await supabase.from('log_erros').delete().eq('id', id)
  if (error) throw error
}
