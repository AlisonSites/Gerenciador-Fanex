import { supabase } from './supabase'

// Lista os comentários de uma tarefa, do mais antigo para o mais novo.
export async function listarComentarios(tarefaId) {
  const { data, error } = await supabase
    .from('tarefa_comentarios')
    .select('*, usuarios(nome_completo)')
    .eq('tarefa_id', tarefaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function criarComentario({ tarefaId, usuarioId, texto }) {
  const { error } = await supabase.from('tarefa_comentarios').insert({
    tarefa_id: tarefaId,
    usuario_id: usuarioId || null,
    texto: texto.trim(),
  })
  if (error) throw error
}

export async function excluirComentario(id) {
  const { error } = await supabase.from('tarefa_comentarios').delete().eq('id', id)
  if (error) throw error
}
