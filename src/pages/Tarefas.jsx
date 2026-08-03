import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import ConfirmModal from '../components/ConfirmModal'
import '../styles/kanban.css'

const PRIORIDADES = ['Baixa', 'Normal', 'Alta', 'Urgente']
const PRIORIDADE_CLASSE = { Baixa: 'baixa', Normal: 'normal', Alta: 'alta', Urgente: 'urgente' }

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
function QuadroDoGrupo({ grupoId, podeGerenciarTudo, podeVerTudo, podeExcluirTarefas, podeGerenciarColunas, usuario, onVoltar }) {
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
    setTarefas(tarefasData || [])

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

          const dateA = new Date(a.data_vencimento);
          const dateB = new Date(b.data_vencimento);
          return dateA - dateB; // Mais recente no topo
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
                        <span className="fx-card-date">{new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                    <p className="fx-card-title">{t.titulo}</p>
                    {t.descricao && <p className="fx-card-desc">{t.descricao}</p>}
                    <div className="fx-card-foot">
                      <span className="fx-card-owner">{t.usuarios?.nome_completo || 'Sem responsável'}</span>
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
          unidadeId={grupo?.unidade_id}
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
            carregar()
          }}
          onCancel={() => setTarefaExcluindo(null)}
        />
      )}
    </>
  )
}

function NovaTarefaModal({ statusList, usuarios, usuarioAtual, grupoId, unidadeId, onClose, onSaved }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [prioridade, setPrioridade] = useState('Normal')
  const [statusId, setStatusId] = useState(statusList[0]?.id || '')
  const [usuarioId, setUsuarioId] = useState(usuarioAtual?.id || '')
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    // A tarefa herda a unidade do grupo em que está sendo criada.
    await supabase.from('tarefas').insert({
      titulo,
      descricao,
      data_vencimento: dataVencimento || null,
      prioridade,
      status_id: statusId || null,
      usuario_id: usuarioId || null,
      grupo_id: grupoId,
      unidade_id: unidadeId || null,
    })
    setSalvando(false)
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

function EditarTarefaModal({ tarefa, statusList, usuarios, podeGerenciarTudo, podeExcluir, onClose, onSaved, onExcluir }) {
  const [titulo, setTitulo] = useState(tarefa.titulo || '')
  const [descricao, setDescricao] = useState(tarefa.descricao || '')
  const [dataVencimento, setDataVencimento] = useState(tarefa.data_vencimento || '')
  const [prioridade, setPrioridade] = useState(tarefa.prioridade || 'Normal')
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
        status_id: statusId || null,
        usuario_id: usuarioId || null,
      })
      .eq('id', tarefa.id)
    setSalvando(false)
    if (error) {
      setErro(error.message || 'Não foi possível salvar as alterações.')
      return
    }
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
      </div>
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
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('status_tarefas').insert({ nome, cor, ordem: proximaOrdem, created_by: user?.id })
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