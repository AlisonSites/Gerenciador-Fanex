import { supabase } from './supabase'

// Lista todas as unidades (usado nas telas de administração).
export async function listarUnidades() {
  const { data, error } = await supabase.from('unidades').select('*').order('nome')
  if (error) throw error
  return data || []
}

// Lista só as unidades ativas (usado em seletores/formulários).
export async function listarUnidadesAtivas() {
  const { data, error } = await supabase.from('unidades').select('*').eq('status', 'Ativo').order('nome')
  if (error) throw error
  return data || []
}

// Unidades às quais um usuário específico está vinculado.
export async function listarUnidadesDoUsuario(usuarioId) {
  if (!usuarioId) return []
  const { data, error } = await supabase
    .from('usuario_unidades')
    .select('unidade_id, unidades(*)')
    .eq('usuario_id', usuarioId)
  if (error) throw error
  return (data || []).map((row) => row.unidades).filter(Boolean)
}

// Substitui todas as unidades vinculadas a um usuário pela lista informada.
// Assim dá para editar (marcar/desmarcar) sem precisar excluir o usuário.
export async function definirUnidadesDoUsuario(usuarioId, unidadeIds = []) {
  const { error: erroExclusao } = await supabase.from('usuario_unidades').delete().eq('usuario_id', usuarioId)
  if (erroExclusao) throw erroExclusao

  if (!unidadeIds.length) return

  const linhas = unidadeIds.map((unidade_id) => ({ usuario_id: usuarioId, unidade_id }))
  const { error: erroInsercao } = await supabase.from('usuario_unidades').insert(linhas)
  if (erroInsercao) throw erroInsercao
}

export async function criarUnidade({ nome, status = 'Ativo' }) {
  const { error } = await supabase.from('unidades').insert({ nome, status })
  if (error) throw error
}

export async function atualizarUnidade(id, { nome, status }) {
  const { error } = await supabase.from('unidades').update({ nome, status }).eq('id', id)
  if (error) throw error
}

export async function excluirUnidade(id) {
  const { error } = await supabase.from('unidades').delete().eq('id', id)
  if (error) throw error
}
