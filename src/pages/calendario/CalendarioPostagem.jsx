import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'
import '../../styles/calendario.css'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const TIPOS = ['FEED', 'STORY']
const COR_PRINCIPAL = '#000045'

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarioPostagem() {
  const { usuario, isAdmin, temPermissao, unidadeAtual } = useAuth()

  // Sem essa permissão, o usuário só enxerga os registros em que ele é o responsável.
  const podeVerTudo = isAdmin || temPermissao('ver_todas_postagens')
  // Quem pode adicionar novos registros no calendário.
  const podeCriar = isAdmin || temPermissao('criar_calendario_postagem')

  const [mesAtual, setMesAtual] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })
  const [entradas, setEntradas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [excluirId, setExcluirId] = useState(null)

  const carregar = async () => {
    setLoading(true)
    const inicio = toISODate(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1))
    const fim = toISODate(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0))

    let query = supabase
      .from('calendario_postagens')
      .select('*, usuarios(nome_completo)')
      .gte('data', inicio)
      .lte('data', fim)
      .order('created_at')

    // Reforça no próprio pedido: quem não pode ver tudo só recebe os
    // registros em que é o responsável.
    if (!podeVerTudo) {
      query = query.eq('usuario_id', usuario?.id || '00000000-0000-0000-0000-000000000000')
    }
    // Mostra só os lançamentos da unidade selecionada no momento.
    if (unidadeAtual?.id) query = query.eq('unidade_id', unidadeAtual.id)

    const [{ data }, { data: usuariosData }] = await Promise.all([
      query,
      supabase.from('usuarios').select('id, nome_completo').eq('status', 'Ativo').order('nome_completo'),
    ])
    setEntradas(data || [])
    setUsuarios(usuariosData || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [mesAtual, podeVerTudo, usuario, unidadeAtual])

  const dias = useMemo(() => {
    const primeiroDiaSemana = mesAtual.getDay()
    const totalDias = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate()
    const celulas = []
    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
    for (let dia = 1; dia <= totalDias; dia++) {
      celulas.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia))
    }
    while (celulas.length % 7 !== 0) celulas.push(null)
    return celulas
  }, [mesAtual])

  const entradasPorDia = useMemo(() => {
    const mapa = {}
    entradas.forEach((e) => {
      if (!mapa[e.data]) mapa[e.data] = []
      mapa[e.data].push(e)
    })
    return mapa
  }, [entradas])

  const hojeISO = toISODate(new Date())

  const mudarMes = (delta) => {
    setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const excluirEntrada = async () => {
    // Excluir aqui também remove, em cascata no banco, a tarefa que foi
    // criada automaticamente a partir deste lançamento (coluna
    // tarefas.postagem_id, on delete cascade).
    const { error } = await supabase.from('calendario_postagens').delete().eq('id', excluirId)
    setExcluirId(null)
    if (error) {
      window.alert('Não foi possível excluir este lançamento: ' + error.message)
      return
    }
    carregar()
  }

  // Ao criar um registro no calendário, replica ele como uma tarefa na
  // primeira coluna do quadro de tarefas do grupo do responsável, vinculando
  // as duas para que excluir uma também exclua a outra.
  const sincronizarTarefaDoResponsavel = async ({ postagemId, usuarioId, tipo, descricao, dataISO }) => {
    if (!usuarioId) return
    try {
      const { data: primeiroStatus } = await supabase
        .from('status_tarefas')
        .select('id')
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!primeiroStatus) return

      const { data: membro } = await supabase
        .from('grupo_membros')
        .select('grupo_id, grupos(unidade_id)')
        .eq('usuario_id', usuarioId)
        .limit(1)
        .maybeSingle()
      // Responsável sem grupo vinculado: não há quadro para receber a tarefa.
      if (!membro) return

      await supabase.from('tarefas').insert({
        titulo: tipo,
        descricao,
        data_vencimento: dataISO,
        prioridade: 'Normal',
        status_id: primeiroStatus.id,
        usuario_id: usuarioId,
        grupo_id: membro.grupo_id,
        unidade_id: membro.grupos?.unidade_id || null,
        postagem_id: postagemId,
      })
    } catch (err) {
      // Não deixa a criação do lançamento do calendário falhar por causa disso.
      console.error('Não foi possível criar a tarefa automática no quadro:', err)
    }
  }

  return (
    <Layout title="Calendário de Postagem">
      <div className="fx-page-head">
        <div>
          <h1>Calendário de Postagem</h1>
          <p>{podeVerTudo ? 'Organize os registros de Feed e Story de todos os responsáveis.' : 'Aqui aparecem apenas os registros em que você é o responsável.'}</p>
        </div>
      </div>

      <div className="fx-panel fx-panel-pad" style={{ marginBottom: 20 }}>
        <div className="fx-calendario-toolbar">
          <button className="fx-icon-btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h3>{MESES[mesAtual.getMonth()]} de {mesAtual.getFullYear()}</h3>
          <button className="fx-icon-btn" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => setMesAtual(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
          <div className="fx-calendario-legenda">
            <span><i style={{ background: COR_PRINCIPAL }} /> Postagens</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="fx-empty">Carregando calendário…</div>
      ) : (
        <div className="fx-panel fx-panel-pad">
          <div className="fx-calendario-grid fx-calendario-cabecalho">
            {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="fx-calendario-grid">
            {dias.map((dia, i) => {
              if (!dia) return <div key={`vazio-${i}`} className="fx-calendario-dia fx-calendario-dia--vazio" />
              const iso = toISODate(dia)
              const doDia = entradasPorDia[iso] || []
              return (
                <button
                  key={iso}
                  className={`fx-calendario-dia ${iso === hojeISO ? 'is-hoje' : ''}`}
                  onClick={() => setDiaSelecionado(dia)}
                >
                  <span className="fx-calendario-dia-numero">{dia.getDate()}</span>
                  <div className="fx-calendario-dia-badges">
                    {doDia.length > 0 && (
                      <span className="fx-calendario-badge" style={{ background: COR_PRINCIPAL }}>
                        <p>Postagens</p>
                        {doDia.length}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {diaSelecionado && (
        <DiaModal
          dia={diaSelecionado}
          entradas={entradasPorDia[toISODate(diaSelecionado)] || []}
          usuario={usuario}
          usuarios={usuarios}
          unidadeId={unidadeAtual?.id}
          isAdmin={isAdmin}
          podeCriar={podeCriar}
          onClose={() => setDiaSelecionado(null)}
          onSalvou={carregar}
          onExcluir={(id) => setExcluirId(id)}
          onRegistrado={sincronizarTarefaDoResponsavel}
        />
      )}

      {excluirId && (
        <ConfirmModal
          title="Excluir lançamento"
          message="Tem certeza que deseja excluir este lançamento do calendário?"
          onConfirm={excluirEntrada}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </Layout>
  )
}

function DiaModal({ dia, entradas, usuario, usuarios, unidadeId, isAdmin, podeCriar, onClose, onSalvou, onExcluir, onRegistrado }) {
  const [aba, setAba] = useState('lista') // 'lista' | 'nova'
  const [tipo, setTipo] = useState(TIPOS[0])
  const [descricao, setDescricao] = useState('')
  const [usuarioId, setUsuarioId] = useState(usuario?.id || '')
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [entradaDetalhe, setEntradaDetalhe] = useState(null)

  const iniciarEdicao = (e) => {
    setEntradaDetalhe(null)
    setEditandoId(e.id)
    setTipo(e.tipo)
    setDescricao(e.descricao)
    setUsuarioId(e.usuario_id || '')
    setAba('nova')
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setTipo(TIPOS[0])
    setDescricao('')
    setUsuarioId(usuario?.id || '')
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      usuario_id: usuarioId || usuario?.id,
      data: toISODate(dia),
      tipo,
      descricao,
    }
    if (editandoId) {
      await supabase.from('calendario_postagens').update(payload).eq('id', editandoId)
    } else {
      // Novo lançamento nasce vinculado à unidade ativa no momento.
      const { data: novaEntrada } = await supabase
        .from('calendario_postagens')
        .insert({ ...payload, unidade_id: unidadeId || null })
        .select('id')
        .single()
      // Só espelha no quadro de tarefas quando é um registro novo, para não
      // duplicar tarefas toda vez que o lançamento for editado.
      await onRegistrado?.({ postagemId: novaEntrada?.id, usuarioId: payload.usuario_id, tipo, descricao, dataISO: payload.data })
    }
    setSalvando(false)
    cancelarEdicao()
    onSalvou()
    setAba('lista')
  }

  // Além do próprio dono do registro, quem tem acesso total (admin) também pode editar.
  const podeEditar = (e) => isAdmin || e.usuario_id === usuario?.id

  return (
    <div className="fx-modal-scrim" onClick={onClose}>
      <div className="fx-modal fx-modal-lg" onClick={(ev) => ev.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>{dia.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
          <button className="fx-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="fx-modal-body">
          {podeCriar && (
            <div className="fx-tabs" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                className={`fx-btn ${aba === 'lista' ? 'fx-btn-primary' : 'fx-btn-ghost'}`}
                onClick={() => setAba('lista')}
              >
                Ver postagens{entradas.length > 0 ? ` (${entradas.length})` : ''}
              </button>
              <button
                type="button"
                className={`fx-btn ${aba === 'nova' ? 'fx-btn-primary' : 'fx-btn-ghost'}`}
                onClick={() => { cancelarEdicao(); setAba('nova') }}
              >
                + Nova postagem
              </button>
            </div>
          )}

          {podeCriar && aba === 'nova' && (
            <form onSubmit={salvar} className="fx-calendario-form">
              <div className="fx-calendario-form-grid">
                <label className="fx-field-group">
                  <span>Tipo</span>
                  <select value={tipo} onChange={(ev) => setTipo(ev.target.value)}>
                    {TIPOS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
                <label className="fx-field-group">
                  <span>Responsável</span>
                  <select value={usuarioId} onChange={(ev) => setUsuarioId(ev.target.value)}>
                    <option value="">Selecione…</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
                  </select>
                </label>
                <label className="fx-field-group" style={{ gridColumn: '1 / -1' }}>
                  <span>Descrição</span>
                  <textarea
                    required
                    value={descricao}
                    onChange={(ev) => setDescricao(ev.target.value)}
                    placeholder="Ex.: Post do lançamento da turma de férias"
                    rows={6}
                    style={{
                      width: '100%',
                      minHeight: 140,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', gridColumn: '1 / -1' }}>
                  <button type="submit" className="fx-btn fx-btn-primary" disabled={salvando}>
                    {salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : '+ Adicionar'}
                  </button>
                  {editandoId && (
                    <button type="button" className="fx-btn fx-btn-ghost" onClick={() => { cancelarEdicao(); setAba('lista') }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          {aba === 'lista' && (
            <TabelaEntradas entradas={entradas} podeEditar={podeEditar} onAbrir={setEntradaDetalhe} onEditar={iniciarEdicao} onExcluir={onExcluir} />
          )}
        </div>
      </div>

      {entradaDetalhe && (
        <DetalheModal
          entrada={entradaDetalhe}
          podeEditar={podeEditar(entradaDetalhe)}
          onClose={() => setEntradaDetalhe(null)}
          onEditar={() => iniciarEdicao(entradaDetalhe)}
          onExcluir={() => { setEntradaDetalhe(null); onExcluir(entradaDetalhe.id) }}
        />
      )}
    </div>
  )
}

// Modal de detalhe: abre por cima do modal do dia ao clicar em um registro,
// mostrando as informações empilhadas (sem precisar rolar a tabela pro lado).
function DetalheModal({ entrada, podeEditar, onClose, onEditar, onExcluir }) {
  return (
    <div className="fx-modal-scrim" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="fx-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>Detalhes do registro</h3>
          <button className="fx-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="fx-modal-body">
          <div className="fx-detalhe-grid">
            <div className="fx-detalhe-item">
              <span className="fx-detalhe-label">Tipo</span>
              <span className={`fx-pill fx-pill--${entrada.tipo === 'FEED' ? 'ativo' : 'normal'}`}>{entrada.tipo}</span>
            </div>
            <div className="fx-detalhe-item">
              <span className="fx-detalhe-label">Descrição</span>
              <p className="fx-detalhe-valor" style={{ whiteSpace: 'pre-wrap' }}>{entrada.descricao}</p>
            </div>
            <div className="fx-detalhe-item">
              <span className="fx-detalhe-label">Responsável</span>
              <p className="fx-detalhe-valor">{entrada.usuarios?.nome_completo || '—'}</p>
            </div>
          </div>
        </div>
        {podeEditar && (
          <div className="fx-modal-foot" style={{ justifyContent: 'space-between' }}>
            <button className="fx-btn fx-btn-danger" onClick={onExcluir}>Excluir</button>
            <button className="fx-btn fx-btn-primary" onClick={onEditar}>Editar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function TabelaEntradas({ entradas, podeEditar, onAbrir, onEditar, onExcluir }) {
  return (
    <div>
      <h4 className="fx-calendario-secao-titulo"><span className="fx-calendario-dot" style={{ background: COR_PRINCIPAL }} />Postagens</h4>
      {entradas.length === 0 ? (
        <div className="fx-empty" style={{ padding: 16 }}>Nenhum lançamento para este dia.</div>
      ) : (
        <div className="fx-lista-postagens">
          {entradas.map((e) => (
            <button key={e.id} type="button" className="fx-lista-postagem-item" onClick={() => onAbrir(e)}>
              <span className={`fx-pill fx-pill--${e.tipo === 'FEED' ? 'ativo' : 'normal'}`}>{e.tipo}</span>
              <span className="fx-lista-postagem-desc" style={{ whiteSpace: 'pre-wrap' }}>{e.descricao}</span>
              <span className="fx-lista-postagem-resp">{e.usuarios?.nome_completo || '—'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}