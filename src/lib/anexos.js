import { supabase } from './supabase'

const BUCKET = 'anexos-tarefas'

// Lista os anexos de uma tarefa, do mais novo para o mais antigo.
export async function listarAnexos(tarefaId) {
  const { data, error } = await supabase
    .from('tarefa_anexos')
    .select('*, usuarios(nome_completo)')
    .eq('tarefa_id', tarefaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Envia um arquivo (File do input) para o Storage e registra a referência.
export async function enviarAnexo({ tarefaId, usuarioId, arquivo }) {
  const caminho = `${tarefaId}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]+/g, '_')}`

  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600',
    upsert: false,
  })
  if (erroUpload) throw erroUpload

  const { error: erroInsert } = await supabase.from('tarefa_anexos').insert({
    tarefa_id: tarefaId,
    usuario_id: usuarioId || null,
    nome_arquivo: arquivo.name,
    caminho,
    tipo: arquivo.type || null,
    tamanho: arquivo.size || null,
  })
  if (erroInsert) {
    // Se o registro no banco falhar, remove o arquivo já enviado para não
    // deixar lixo órfão no Storage.
    await supabase.storage.from(BUCKET).remove([caminho])
    throw erroInsert
  }
}

// Gera um link temporário (1h) para baixar/visualizar o anexo.
export async function obterUrlAnexo(caminho) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600)
  if (error) throw error
  return data?.signedUrl
}

export async function excluirAnexo(anexo) {
  await supabase.storage.from(BUCKET).remove([anexo.caminho])
  const { error } = await supabase.from('tarefa_anexos').delete().eq('id', anexo.id)
  if (error) throw error
}

// Formata bytes em algo legível (KB/MB).
export function formatarTamanho(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
