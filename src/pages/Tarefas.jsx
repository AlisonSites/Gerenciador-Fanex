import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { listarComentarios, criarComentario, excluirComentario } from '../lib/comentarios'
import { listarAnexos, enviarAnexo, obterUrlAnexo, excluirAnexo, formatarTamanho } from '../lib/anexos'
import { registrarAuditoria } from '../lib/auditoria'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import '../styles/kanban.css'

const PRIORIDADES = ['Baixa', 'Normal', 'Alta', 'Urgente']
const PRIORIDADE_CLASSE = { Baixa: 'baixa', Normal: 'normal', Alta: 'alta', Urgente: 'urgente' }

// Formata uma data "pura" (ex.: "2026-08-12", vinda de um <input type="date">
// ou de uma coluna DATE do banco) direto a partir da string, sem passar por
// `new Date(...)`. Isso evita o bug de fuso horário: `new Date("2026-08-12")`
// é interpretado como meia-noite em UTC, e ao formatar de volta para o
// horário local (Brasil, UTC-3) o dia "volta" uma unidade (ex.: 12/08 vira
// 11/08 no card).
function formatarDataBR(dataStr) {
  if (!dataStr) return ''
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function Tarefas() {
  const { usuario, temPermissao, unidadeAtual } = useAuth()
  const podeGerenciarTudo = temPermissao('gerenciar_tarefas') // Administrador e Coordenador
  // Quem enxerga TODAS as tarefas do quadro. Além de quem gerencia tudo,
  // isso também pode ser liberado separadamente pela permissão "ver_todas_tarefas".
  const podeVerTudo = podeGerenciarTudo || temPermissao('ver_todas_tarefas')
  // Excluir tarefas de qualquer pessoa e mexer nas colunas do quadro agora
  // são permissões separadas de "gerenciar_tarefas" (editar/mover cartões).
  const podeExcluirTarefas = temPermissao('excluir_tarefas')
  const podeGerenciarColunas = temPermissao('gerenciar_colunas_tarefas')
  // Comentar, anexar e etiquetar são permissões próprias — dão acesso a
  // essas ações mesmo para quem só edita as próprias tarefas.
  const podeComentar = temPermissao('comentar_tarefas')
  const podeAnexar = temPermissao('anexar_arquivos_tarefas')
  const podeEtiquetar = temPermissao('etiquetar_tarefas')
  const [searchParams, setSearchParams] = useSearchParams()
  const grupoId = searchParams.get('grupo')

  const abrirGrupo = (id) => setSearchParams(id ? { grupo: id } : {})
  const voltarParaGrupos = () => setSearchParams({})

  return (
    <Layout title="Quadro de Tarefas">
      {grupoId ? (
        <QuadroDoGrupo
          grupoId={grupoId}
          podeGerenciarTudo={podeGerenciarTudo}
          podeVerTudo={podeVerTudo}
          podeExcluirTarefas={podeExcluirTarefas}
          podeGerenciarColunas={podeGerenciarColunas}
          podeComentar={podeComentar}
          podeAnexar={podeAnexar}
          podeEtiquetar={podeEtiquetar}
          usuario={usuario}
          onVoltar={voltarParaGrupos}
        />
      ) : (
        <SeletorDeGrupos
          podeGerenciarTudo={podeGerenciarTudo}
          usuario={usuario}
          unidadeAtual={unidadeAtual}
          onAbrirGrupo={abrirGrupo}
        />
      )}
    </Layout>
  )
}

// ==========================================================
// Tela 1: cards com os grupos do usuário logado
// ==========================================================
function SeletorDeGrupos({ podeGerenciarTudo, usuario, unidadeAtual, onAbrirGrupo }) {
  const [grupos, setGrupos] = useState([])
  const [contagens, setContagens] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setLoading(true)

      let gruposData = []
      if (podeGerenciarTudo) {
        let query = supabase.from('grupos').select('*').order('nome')
        if (unidadeAtual?.id) query = query.eq('unidade_id', unidadeAtual.id)
        const { data } = await query
        gruposData = data || []
      } else if (usuario) {
        const { data } = await supabase
          .from('grupo_membros')
          .select('grupos(*)')
          .eq('usuario_id', usuario.id)
        gruposData = (data || []).map((row) => row.grupos).filter(Boolean)
        if (unidadeAtual?.id) gruposData = gruposData.filter((g) => g.unidade_id === unidadeAtual.id)
        gruposData.sort((a, b) => a.nome.localeCompare(b.nome))
      }

      const idsGrupos = gruposData.map((g) => g.id)
      let mapaTarefas = {}
      let mapaMembros = {}
      if (idsGrupos.length) {
        const { data: tarefasData } = await supabase.from('tarefas').select('grupo_id').in('grupo_id', idsGrupos)
          ; (tarefasData || []).forEach((t) => {
            mapaTarefas[t.grupo_id] = (mapaTarefas[t.grupo_id] || 0) + 1
          })
        const { data: membrosData } = await supabase.from('grupo_membros').select('grupo_id').in('grupo_id', idsGrupos)
          ; (membrosData || []).forEach((m) => {
            mapaMembros[m.grupo_id] = (mapaMembros[m.grupo_id] || 0) + 1
          })
      }

      if (!ativo) return
      setGrupos(gruposData)
      setContagens({ tarefas: mapaTarefas, membros: mapaMembros })
      setLoading(false)
    }
    carregar()
    return () => { ativo = false }
  }, [podeGerenciarTudo, usuario, unidadeAtual])

  return (
    <>
      <div className="fx-page-head">
        <div>
          <h1>Meus grupos</h1>
          <p>{podeGerenciarTudo ? 'Selecione um grupo para abrir o quadro de tarefas.' : 'Estes são os grupos aos quais você está vinculado.'}</p>
        </div>
      </div>

      {loading ? (
        <div className="fx-empty">Carregando grupos…</div>
      ) : grupos.length === 0 ? (
        <div className="fx-empty">
          <strong>Nenhum grupo disponível</strong>
          {podeGerenciarTudo ? 'Crie um grupo em "Criar Grupo" para começar.' : 'Você ainda não foi vinculado a nenhum grupo. Fale com um administrador ou coordenador.'}
        </div>
      ) : (
        <div className="fx-group-cards">
          {grupos.map((g) => (
            <button key={g.id} className="fx-group-card" onClick={() => onAbrirGrupo(g.id)}>
              <div className="fx-group-card-top">
                <span className="fx-group-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                </span>
                <span className={`fx-pill fx-pill--${g.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{g.status}</span>
              </div>
              <div className="fx-group-card-title">{g.nome}</div>
              <div className="fx-group-card-meta">
                <span>{contagens.membros?.[g.id] || 0} membro(s)</span>
                <span>{contagens.tarefas?.[g.id] || 0} tarefa(s)</span>
              </div>
              <div className="fx-group-card-cta">Abrir quadro
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ==========================================================
// Tela 2: quadro Kanban de um grupo específico
// ==========================================================
function QuadroDoGrupo({ grupoId, podeGerenciarTudo, podeVerTudo, podeExcluirTarefas, podeGerenciarColunas, podeComentar, podeAnexar, podeEtiquetar, usuario, onVoltar }) {
  const [grupo, setGrupo] = useState(null)
  const [acessoNegado, setAcessoNegado] = useState(false)
  const [statusList, setStatusList] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovaTarefa, setModalNovaTarefa] = useState(false)
  const [modalNovoStatus, setModalNovoStatus] = useState(false)
  const [statusEditando, setStatusEditando] = useState(null)
  const [statusExcluindo, setStatusExcluindo] = useState(null)
  const [tarefaEditando, setTarefaEditando] = useState(null)
  const [tarefaExcluindo, setTarefaExcluindo] = useState(null)
  const [dragTarefa, setDragTarefa] = useState(null)
  const [dragOverStatus, setDragOverStatus] = useState(null)

  const podeEditar = (t) => podeGerenciarTudo || t.usuario_id === usuario?.id

  const carregar = async () => {
    setLoading(true)
    setAcessoNegado(false)

    const { data: grupoData } = await supabase.from('grupos').select('*').eq('id', grupoId).maybeSingle()
    if (!grupoData) {
      setLoading(false)
      setAcessoNegado(true)
      return
    }

    // Confere se o usuário pode acessar este grupo (admin/coordenação sempre podem).
    if (!podeGerenciarTudo) {
      const { data: vinculo } = await supabase
        .from('grupo_membros')
        .select('id')
        .eq('grupo_id', grupoId)
        .eq('usuario_id', usuario?.id)
        .maybeSingle()
      if (!vinculo) {
        setLoading(false)
        setAcessoNegado(true)
        return
      }
    }

    setGrupo(grupoData)

    const { data: statusData } = await supabase.from('status_tarefas').select('*').order('ordem')
    setStatusList(statusData || [])

    let tarefasQuery = supabase
      .from('tarefas')
      .select('*, usuarios(nome_completo)')
      .eq('grupo_id', grupoId)
      .order('created_at', { ascending: false })

    // Sem a permissão de ver tudo, o quadro só mostra as tarefas em que
    // o usuário logado é o responsável.
    if (!podeVerTudo) {
      tarefasQuery = tarefasQuery.eq('usuario_id', usuario?.id || '00000000-0000-0000-0000-000000000000')
    }

    const { data: tarefasData } = await tarefasQuery
    let tarefasComContagens = tarefasData || []
    const idsTarefas = tarefasComContagens.map((t) => t.id)
    if (idsTarefas.length) {
      const [{ data: comentariosData }, { data: anexosData }] = await Promise.all([
        supabase.from('tarefa_comentarios').select('tarefa_id').in('tarefa_id', idsTarefas),
        supabase.from('tarefa_anexos').select('tarefa_id').in('tarefa_id', idsTarefas),
      ])
      const mapaComentarios = {}
      ;(comentariosData || []).forEach((c) => { mapaComentarios[c.tarefa_id] = (mapaComentarios[c.tarefa_id] || 0) + 1 })
      const mapaAnexos = {}
      ;(anexosData || []).forEach((a) => { mapaAnexos[a.tarefa_id] = (mapaAnexos[a.tarefa_id] || 0) + 1 })
      tarefasComContagens = tarefasComContagens.map((t) => ({
        ...t,
        comentarios_count: mapaComentarios[t.id] || 0,
        anexos_count: mapaAnexos[t.id] || 0,
      }))
    }
    setTarefas(tarefasComContagens)

    const { data: membrosData } = await supabase
      .from('grupo_membros')
      .select('usuarios(id, nome_completo)')
      .eq('grupo_id', grupoId)
    setMembros((membrosData || []).map((m) => m.usuarios).filter(Boolean))

    setLoading(false)
  }

  useEffect(() => { carregar() }, [grupoId, usuario, podeGerenciarTudo, podeVerTudo])

  const colunas = useMemo(() => {
    return statusList.map((s) => ({
      ...s,
      tarefas: tarefas
        .filter((t) => t.status_id === s.id) // Filtra pela coluna
        .sort((a, b) => {
          // Se não tiver data de vencimento, coloca no final (ou começo, como preferir)
          if (!a.data_vencimento) return 1;
          if (!b.data_vencimento) return -1;

          // Comparação simples de string funciona porque o formato é
          // "AAAA-MM-DD" (ordenável lexicograficamente), e evita o mesmo
          // problema de fuso horário do `new Date(...)`.
          return a.data_vencimento.localeCompare(b.data_vencimento);
        })
    }))
  }, [statusList, tarefas])

  const moverTarefa = async (tarefaId, novoStatusId) => {
    setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? { ...t, status_id: novoStatusId } : t)))
    await supabase.from('tarefas').update({ status_id: novoStatusId }).eq('id', tarefaId)
  }

  const handleDrop = (statusId) => {
    if (dragTarefa && dragTarefa.status_id !== statusId) {
      moverTarefa(dragTarefa.id, statusId)
    }
    setDragTarefa(null)
    setDragOverStatus(null)
  }

  const moverStatus = async (statusAtual, direcao) => {
    const idx = statusList.findIndex((s) => s.id === statusAtual.id)
    const idxAlvo = idx + direcao
    if (idxAlvo < 0 || idxAlvo >= statusList.length) return
    const alvo = statusList[idxAlvo]

    const novaLista = [...statusList]
    novaLista[idx] = { ...alvo, ordem: statusAtual.ordem }
    novaLista[idxAlvo] = { ...statusAtual, ordem: alvo.ordem }
    novaLista.sort((a, b) => a.ordem - b.ordem)
    setStatusList(novaLista)

    await Promise.all([
      supabase.from('status_tarefas').update({ ordem: statusAtual.ordem }).eq('id', alvo.id),
      supabase.from('status_tarefas').update({ ordem: alvo.ordem }).eq('id', statusAtual.id),
    ])
  }

  if (acessoNegado) {
    return (
      <div className="fx-empty">
        <strong>Acesso não permitido</strong>
        Você não está vinculado a este grupo.
        <div style={{ marginTop: 14 }}>
          <button className="fx-btn fx-btn-secondary" onClick={onVoltar}>Voltar para meus grupos</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fx-page-head">
        <div>
          <button className="fx-back-link" onClick={onVoltar}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" /></svg>
            Meus grupos
          </button>
          <h1>{grupo?.nome || 'Quadro de Tarefas'}</h1>
          <p>
            Arraste os cartões entre as colunas para atualizar o status.
            {!podeVerTudo && ' Você está vendo apenas as tarefas em que é responsável.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {podeGerenciarColunas && (
            <button className="fx-btn fx-btn-ghost" onClick={() => setModalNovoStatus(true)}>+ Novo status</button>
          )}
          <button className="fx-btn fx-btn-primary" onClick={() => setModalNovaTarefa(true)}>+ Nova tarefa</button>
        </div>
      </div>

      {loading ? (
        <div className="fx-empty">Carregando quadro…</div>
      ) : (
        <div className="fx-board fx-scrollbar">
          {colunas.map((col, idx) => (
            <div
              key={col.id}
              className={`fx-column ${dragOverStatus === col.id ? 'is-drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.id) }}
              onDragLeave={() => setDragOverStatus((s) => (s === col.id ? null : s))}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="fx-column-head">
                <div className="fx-status">
                  <span className="fx-column-dot" style={{ background: col.cor }} />
                  <span className="fx-column-title">{col.nome}</span>
                </div>
                <span className="fx-column-count">{col.tarefas.length}</span>
                {podeGerenciarColunas && (
                  <div className="fx-column-actions">
                    <button
                      className="fx-column-action-btn"
                      title="Mover para a esquerda"
                      disabled={idx === 0}
                      onClick={() => moverStatus(col, -1)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" /></svg>
                    </button>
                    <button
                      className="fx-column-action-btn"
                      title="Mover para a direita"
                      disabled={idx === colunas.length - 1}
                      onClick={() => moverStatus(col, 1)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                    <button className="fx-column-action-btn" title="Editar status" onClick={() => setStatusEditando(col)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    </button>
                    <button className="fx-column-action-btn fx-column-action-danger" title="Excluir status" onClick={() => setStatusExcluindo(col)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" /></svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="fx-column-body">
                {col.tarefas.map((t) => (
                  <div
                    key={t.id}
                    className={`fx-card fx-card--${PRIORIDADE_CLASSE[t.prioridade] || 'normal'} ${podeEditar(t) ? 'is-clickable' : ''}`}
                    draggable={podeEditar(t)}
                    onDragStart={() => setDragTarefa(t)}
                    onDragEnd={() => { setDragTarefa(null); setDragOverStatus(null) }}
                    onClick={() => podeEditar(t) && setTarefaEditando(t)}
                    title={podeEditar(t) ? 'Clique para editar' : 'Você não pode editar esta tarefa'}
                  >
                    <div className="fx-card-top">
                      <span className={`fx-pill fx-pill--${PRIORIDADE_CLASSE[t.prioridade] || 'normal'}`}>
                        {t.prioridade === 'Urgente' && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4m0 4h.01M10.3 3.9L2.5 17a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
                        )}
                        {t.prioridade}
                      </span>
                      {t.data_vencimento && (
                        <span className="fx-card-date">{formatarDataBR(t.data_vencimento)}</span>
                      )}
                    </div>
                    <p className="fx-card-title">{t.titulo}</p>
                    {t.descricao && <p className="fx-card-desc">{t.descricao}</p>}
                    {t.etiquetas?.length > 0 && (
                      <div className="fx-card-tags">
                        {t.etiquetas.map((tag) => (
                          <span className="fx-tag-chip" key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="fx-card-foot">
                      <span className="fx-card-owner">{t.usuarios?.nome_completo || 'Sem responsável'}</span>
                      <div className="fx-card-icons">
                        {t.comentarios_count > 0 && (
                          <span className="fx-card-icon-badge" title={`${t.comentarios_count} comentário(s)`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                            {t.comentarios_count}
                          </span>
                        )}
                        {t.anexos_count > 0 && (
                          <span className="fx-card-icon-badge" title={`${t.anexos_count} anexo(s)`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                            {t.anexos_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {col.tarefas.length === 0 && <div className="fx-column-empty">Solte tarefas aqui</div>}
              </div>
            </div>
          ))}
          {colunas.length === 0 && (
            <div className="fx-empty"><strong>Nenhum status criado</strong>{podeGerenciarColunas ? 'Crie o primeiro status para montar o quadro.' : 'Peça a um administrador ou coordenador para criar os status do quadro.'}</div>
          )}
        </div>
      )}

      {modalNovaTarefa && (
        <NovaTarefaModal
          statusList={statusList}
          usuarios={membros}
          usuarioAtual={usuario}
          grupoId={grupoId}
          grupoNome={grupo?.nome}
          unidadeId={grupo?.unidade_id}
          podeEtiquetar={podeEtiquetar}
          onClose={() => setModalNovaTarefa(false)}
          onSaved={() => { setModalNovaTarefa(false); carregar() }}
        />
      )}

      {podeGerenciarColunas && modalNovoStatus && (
        <StatusModal
          proximaOrdem={statusList.length + 1}
          onClose={() => setModalNovoStatus(false)}
          onSaved={() => { setModalNovoStatus(false); carregar() }}
        />
      )}

      {podeGerenciarColunas && statusEditando && (
        <StatusModal
          status={statusEditando}
          onClose={() => setStatusEditando(null)}
          onSaved={() => { setStatusEditando(null); carregar() }}
        />
      )}

      {podeGerenciarColunas && statusExcluindo && (
        statusExcluindo.tarefas.length > 0 ? (
          <ConfirmModal
            title="Não é possível excluir"
            message={`A coluna "${statusExcluindo.nome}" tem ${statusExcluindo.tarefas.length} tarefa(s). Mova ou exclua essas tarefas antes de remover o status.`}
            confirmLabel="Entendi"
            danger={false}
            onConfirm={() => setStatusExcluindo(null)}
            onCancel={() => setStatusExcluindo(null)}
          />
        ) : (
          <ConfirmModal
            title="Excluir status"
            message={`Tem certeza que deseja excluir a coluna "${statusExcluindo.nome}"? Esta ação não pode ser desfeita.`}
            onConfirm={async () => {
              const { error } = await supabase.from('status_tarefas').delete().eq('id', statusExcluindo.id)
              setStatusExcluindo(null)
              if (error) {
                window.alert('Não foi possível excluir este status: ' + error.message)
                return
              }
              registrarAuditoria({ acao: 'excluir', modulo: 'Tarefas', descricao: `Excluiu o status "${statusExcluindo.nome}" do quadro Kanban` })
              carregar()
            }}
            onCancel={() => setStatusExcluindo(null)}
          />
        )
      )}

      {tarefaEditando && (
        <EditarTarefaModal
          tarefa={tarefaEditando}
          statusList={statusList}
          usuarios={membros}
          podeGerenciarTudo={podeGerenciarTudo}
          // Quem tem a permissão "excluir_tarefas" pode excluir qualquer
          // tarefa; sem ela, cada pessoa ainda pode excluir as próprias
          // tarefas (comportamento que já existia antes).
          podeExcluir={podeExcluirTarefas || tarefaEditando.usuario_id === usuario?.id}
          podeComentar={podeComentar}
          podeAnexar={podeAnexar}
          podeEtiquetar={podeEtiquetar}
          usuarioAtual={usuario}
          onClose={() => setTarefaEditando(null)}
          onSaved={() => { setTarefaEditando(null); carregar() }}
          onExcluir={() => { setTarefaExcluindo(tarefaEditando); setTarefaEditando(null) }}
        />
      )}

      {tarefaExcluindo && (
        <ConfirmModal
          title="Excluir tarefa"
          message={
            tarefaExcluindo.postagem_id
              ? `"${tarefaExcluindo.titulo}" foi criada a partir de um lançamento no Calendário de Postagem. Excluir aqui também vai excluir esse lançamento. Esta ação não pode ser desfeita.`
              : `Tem certeza que deseja excluir "${tarefaExcluindo.titulo}"? Esta ação não pode ser desfeita.`
          }
          onConfirm={async () => {
            // Tarefas vindas do Calendário de Postagem estão vinculadas por
            // postagem_id (on delete cascade). Excluindo o lançamento de
            // origem, a própria tarefa some junto — mantendo os dois lados
            // sempre sincronizados.
            const { error } = tarefaExcluindo.postagem_id
              ? await supabase.from('calendario_postagens').delete().eq('id', tarefaExcluindo.postagem_id)
              : await supabase.from('tarefas').delete().eq('id', tarefaExcluindo.id)
            setTarefaExcluindo(null)
            if (error) {
              window.alert('Não foi possível excluir esta tarefa: ' + error.message)
              return
            }
            registrarAuditoria({
              acao: 'excluir',
              modulo: 'Tarefas',
              descricao: `Excluiu a tarefa "${tarefaExcluindo.titulo}"`,
              dadosAntes: { id: tarefaExcluindo.id, titulo: tarefaExcluindo.titulo, grupo_id: tarefaExcluindo.grupo_id },
            })
            carregar()
          }}
          onCancel={() => setTarefaExcluindo(null)}
        />
      )}
    </>
  )
}

// Campo de etiquetas: digita e aperta Enter (ou vírgula) para criar um chip.
function EtiquetasInput({ etiquetas, onChange, disabled }) {
  const [texto, setTexto] = useState('')

  const adicionar = () => {
    const valor = texto.trim()
    if (!valor) return
    if (!etiquetas.includes(valor)) onChange([...etiquetas, valor])
    setTexto('')
  }

  const remover = (tag) => onChange(etiquetas.filter((t) => t !== tag))

  return (
    <div className="fx-tags-input">
      <div className="fx-tags-input-chips">
        {etiquetas.map((tag) => (
          <span className="fx-tag-chip" key={tag}>
            {tag}
            {!disabled && <button type="button" onClick={() => remover(tag)}>×</button>}
          </span>
        ))}
        {!disabled && (
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); adicionar() }
            }}
            onBlur={adicionar}
            placeholder={etiquetas.length ? 'Adicionar outra...' : 'Ex.: urgente-cliente, backend...'}
          />
        )}
      </div>
    </div>
  )
}

function NovaTarefaModal({ statusList, usuarios, usuarioAtual, grupoId, unidadeId, podeEtiquetar, onClose, onSaved }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [prioridade, setPrioridade] = useState('Normal')
  const [etiquetas, setEtiquetas] = useState([])
  const [statusId, setStatusId] = useState(statusList[0]?.id || '')
  const [usuarioId, setUsuarioId] = useState(usuarioAtual?.id || '')
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    // A tarefa herda a unidade do grupo em que está sendo criada.
    const { data, error } = await supabase.from('tarefas').insert({
      titulo,
      descricao,
      data_vencimento: dataVencimento || null,
      prioridade,
      etiquetas,
      status_id: statusId || null,
      usuario_id: usuarioId || null,
      grupo_id: grupoId,
      unidade_id: unidadeId || null,
    }).select('id').single()
    setSalvando(false)
    if (!error) {
      registrarAuditoria({ acao: 'criar', modulo: 'Tarefas', descricao: `Criou a tarefa "${titulo}"`, dadosDepois: { id: data?.id, titulo, prioridade, status_id: statusId } })
    }
    onSaved()
  }

  return (
    <div className="fx-modal-scrim" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>Nova tarefa</h3>
          <button className="fx-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={salvar}>
          <div className="fx-modal-body">
            <label className="fx-field-group">
              <span>Nome da tarefa</span>
              <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Preparar relatório mensal" />
            </label>
            <label className="fx-field-group">
              <span>Descrição</span>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes da tarefa (opcional)" />
            </label>
            <label className="fx-field-group">
              <span>Data</span>
              <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            </label>
            <label className="fx-field-group">
              <span>Prioridade</span>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {podeEtiquetar && (
              <label className="fx-field-group">
                <span>Etiquetas</span>
                <EtiquetasInput etiquetas={etiquetas} onChange={setEtiquetas} />
              </label>
            )}
            <label className="fx-field-group">
              <span>Status inicial</span>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                {statusList.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="fx-field-group">
              <span>Responsável</span>
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Sem responsável</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
              </select>
            </label>
          </div>
          <div className="fx-modal-foot">
            <button type="button" className="fx-btn fx-btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="fx-btn fx-btn-primary" disabled={salvando}>{salvando ? 'Criando...' : 'Criar tarefa'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditarTarefaModal({ tarefa, statusList, usuarios, podeGerenciarTudo, podeExcluir, podeComentar, podeAnexar, podeEtiquetar, usuarioAtual, onClose, onSaved, onExcluir }) {
  const [titulo, setTitulo] = useState(tarefa.titulo || '')
  const [descricao, setDescricao] = useState(tarefa.descricao || '')
  const [dataVencimento, setDataVencimento] = useState(tarefa.data_vencimento || '')
  const [prioridade, setPrioridade] = useState(tarefa.prioridade || 'Normal')
  const [etiquetas, setEtiquetas] = useState(tarefa.etiquetas || [])
  const [statusId, setStatusId] = useState(tarefa.status_id || '')
  const [usuarioId, setUsuarioId] = useState(tarefa.usuario_id || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    const { error } = await supabase
      .from('tarefas')
      .update({
        titulo,
        descricao,
        data_vencimento: dataVencimento || null,
        prioridade,
        etiquetas,
        status_id: statusId || null,
        usuario_id: usuarioId || null,
      })
      .eq('id', tarefa.id)
    setSalvando(false)
    if (error) {
      setErro(error.message || 'Não foi possível salvar as alterações.')
      return
    }
    registrarAuditoria({
      acao: 'editar',
      modulo: 'Tarefas',
      descricao: `Editou a tarefa "${titulo}"`,
      dadosAntes: { titulo: tarefa.titulo, prioridade: tarefa.prioridade, status_id: tarefa.status_id, usuario_id: tarefa.usuario_id },
      dadosDepois: { titulo, prioridade, status_id: statusId, usuario_id: usuarioId },
    })
    onSaved()
  }

  return (
    <div className="fx-modal-scrim" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>Editar tarefa</h3>
          <button className="fx-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={salvar}>
          <div className="fx-modal-body">
            <label className="fx-field-group">
              <span>Nome da tarefa</span>
              <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Preparar relatório mensal" />
            </label>
            <label className="fx-field-group">
              <span>Descrição</span>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes da tarefa (opcional)" />
            </label>
            <label className="fx-field-group">
              <span>Data</span>
              <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            </label>
            <label className="fx-field-group">
              <span>Prioridade</span>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {podeEtiquetar && (
              <label className="fx-field-group">
                <span>Etiquetas</span>
                <EtiquetasInput etiquetas={etiquetas} onChange={setEtiquetas} />
              </label>
            )}
            <label className="fx-field-group">
              <span>Status</span>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                {statusList.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
            <label className="fx-field-group">
              <span>Responsável</span>
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} disabled={!podeGerenciarTudo}>
                <option value="">Sem responsável</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
              </select>
            </label>
            {erro && <div className="fx-error">{erro}</div>}
          </div>
          <div className="fx-modal-foot" style={{ justifyContent: 'space-between' }}>
            {podeExcluir
              ? <button type="button" className="fx-btn fx-btn-danger" onClick={onExcluir}>Excluir tarefa</button>
              : <span />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="fx-btn fx-btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="fx-btn fx-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </div>
        </form>

        <AnexosSecao tarefaId={tarefa.id} usuarioAtual={usuarioAtual} podeAnexar={podeAnexar} />
        <ComentariosSecao tarefaId={tarefa.id} usuarioAtual={usuarioAtual} podeComentar={podeComentar} />
      </div>
    </div>
  )
}

// ==========================================================
// Comentários e Anexos (dentro do modal de edição de tarefa)
// ==========================================================
function ComentariosSecao({ tarefaId, usuarioAtual, podeComentar }) {
  const [comentarios, setComentarios] = useState([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      setComentarios(await listarComentarios(tarefaId))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [tarefaId])

  const enviar = async (e) => {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true)
    try {
      await criarComentario({ tarefaId, usuarioId: usuarioAtual?.id, texto })
      setTexto('')
      await carregar()
    } catch (err) {
      window.alert('Não foi possível enviar o comentário: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  const remover = async (id) => {
    try {
      await excluirComentario(id)
      setComentarios((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      window.alert('Não foi possível excluir o comentário: ' + err.message)
    }
  }

  return (
    <div className="fx-modal-body fx-modal-section" style={{ borderTop: '1px solid var(--fx-line)', paddingTop: 16 }}>
      <span className="fx-modal-section-title">Comentários {comentarios.length > 0 && `(${comentarios.length})`}</span>
      {carregando ? (
        <div className="fx-empty" style={{ padding: 12 }}>Carregando comentários…</div>
      ) : (
        <div className="fx-comentarios-list">
          {comentarios.map((c) => (
            <div className="fx-comentario-item" key={c.id}>
              <div className="fx-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                {(c.usuarios?.nome_completo || '?').split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
              </div>
              <div className="fx-comentario-corpo">
                <div className="fx-comentario-head">
                  <strong>{c.usuarios?.nome_completo || 'Usuário removido'}</strong>
                  <small>{new Date(c.created_at).toLocaleString('pt-BR')}</small>
                  {c.usuario_id === usuarioAtual?.id && (
                    <button type="button" className="fx-comentario-excluir" onClick={() => remover(c.id)}>Excluir</button>
                  )}
                </div>
                <p>{c.texto}</p>
              </div>
            </div>
          ))}
          {comentarios.length === 0 && <div className="fx-empty" style={{ padding: 12 }}>Nenhum comentário ainda.</div>}
        </div>
      )}
      {podeComentar && (
        <form onSubmit={enviar} className="fx-comentario-form">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva um comentário..." rows={2} />
          <button type="submit" className="fx-btn fx-btn-secondary fx-btn-sm" disabled={enviando || !texto.trim()}>
            {enviando ? 'Enviando...' : 'Comentar'}
          </button>
        </form>
      )}
    </div>
  )
}

function AnexosSecao({ tarefaId, usuarioAtual, podeAnexar }) {
  const [anexos, setAnexos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      setAnexos(await listarAnexos(tarefaId))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [tarefaId])

  const selecionarArquivo = async (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (arquivo.size > 20 * 1024 * 1024) {
      window.alert('Arquivo muito grande. O limite é 20 MB.')
      return
    }
    setEnviando(true)
    try {
      await enviarAnexo({ tarefaId, usuarioId: usuarioAtual?.id, arquivo })
      await carregar()
    } catch (err) {
      window.alert('Não foi possível enviar o anexo: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  const abrir = async (anexo) => {
    try {
      const url = await obterUrlAnexo(anexo.caminho)
      if (url) window.open(url, '_blank')
    } catch (err) {
      window.alert('Não foi possível abrir o arquivo: ' + err.message)
    }
  }

  const remover = async (anexo) => {
    try {
      await excluirAnexo(anexo)
      setAnexos((prev) => prev.filter((a) => a.id !== anexo.id))
    } catch (err) {
      window.alert('Não foi possível excluir o anexo: ' + err.message)
    }
  }

  return (
    <div className="fx-modal-body fx-modal-section" style={{ borderTop: '1px solid var(--fx-line)', paddingTop: 16 }}>
      <div className="fx-modal-section-head">
        <span className="fx-modal-section-title">Anexos {anexos.length > 0 && `(${anexos.length})`}</span>
        {podeAnexar && (
          <label className="fx-btn fx-btn-ghost fx-btn-sm" style={{ cursor: 'pointer' }}>
            {enviando ? 'Enviando...' : '+ Anexar arquivo'}
            <input type="file" onChange={selecionarArquivo} disabled={enviando} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      {carregando ? (
        <div className="fx-empty" style={{ padding: 12 }}>Carregando anexos…</div>
      ) : (
        <div className="fx-anexos-list">
          {anexos.map((a) => (
            <div className="fx-anexo-item" key={a.id}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
              <button type="button" className="fx-anexo-nome" onClick={() => abrir(a)} title="Abrir arquivo">{a.nome_arquivo}</button>
              <span className="fx-anexo-meta">{formatarTamanho(a.tamanho)} · {a.usuarios?.nome_completo || '—'}</span>
              <button type="button" className="fx-comentario-excluir" onClick={() => remover(a)}>Excluir</button>
            </div>
          ))}
          {anexos.length === 0 && <div className="fx-empty" style={{ padding: 12 }}>Nenhum anexo ainda.</div>}
        </div>
      )}
    </div>
  )
}

// Modal único para criar OU editar um status (coluna do quadro).
// Se `status` for informado, o modal entra em modo edição.
function StatusModal({ status, proximaOrdem, onClose, onSaved }) {
  const editando = !!status
  const [nome, setNome] = useState(status?.nome || '')
  const [cor, setCor] = useState(status?.cor || '#000045')
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    if (editando) {
      await supabase.from('status_tarefas').update({ nome, cor }).eq('id', status.id)
      registrarAuditoria({ acao: 'editar', modulo: 'Tarefas', descricao: `Editou o status "${nome}" do quadro Kanban` })
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('status_tarefas').insert({ nome, cor, ordem: proximaOrdem, created_by: user?.id })
      registrarAuditoria({ acao: 'criar', modulo: 'Tarefas', descricao: `Criou o status "${nome}" no quadro Kanban` })
    }
    setSalvando(false)
    onSaved()
  }

  return (
    <div className="fx-modal-scrim" onClick={onClose}>
      <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>{editando ? 'Editar status' : 'Novo status'}</h3>
          <button className="fx-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={salvar}>
          <div className="fx-modal-body">
            <label className="fx-field-group">
              <span>Nome do status</span>
              <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Em revisão" />
            </label>
            <label className="fx-field-group">
              <span>Cor da coluna</span>
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ height: 42, padding: 4 }} />
            </label>
          </div>
          <div className="fx-modal-foot">
            <button type="button" className="fx-btn fx-btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="fx-btn fx-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar status'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}