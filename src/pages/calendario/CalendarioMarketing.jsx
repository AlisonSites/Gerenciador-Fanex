import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'
import '../../styles/calendario.css'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const CAMPOS_POR_CATEGORIA = {
  Marketing: {
    corPrincipal: '#3169e8',
    campoDoisLabel: 'Postagem',
    campoDoisOpcoes: ['Feed', 'Story'],
    campoTresLabel: 'Status',
    campoTresOpcoes: ['Pendente', 'Em andamento', 'Concluído'],
  },
  Comercial: {
    corPrincipal: '#ff5400',
    campoDoisLabel: 'Tipo',
    campoDoisOpcoes: ['Aten. Presencial', 'Aten. Virtual', 'Mensagem RD', 'Mensagem Enviada', 'Matrículas pagas', 'Matrículas Gratuita'],
    campoTresLabel: 'Publicidade',
    campoTresOpcoes: ['Blubash', 'Anúncio', 'Whatsapp', 'Instagram', 'Visita', 'Panfleto', 'Curso gratuito'],
  },
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarioMarketing() {
  const { usuario, perfil, isAdmin, isCoordenador, unidadeAtual } = useAuth()
  const podeEscolherCategoria = isAdmin || isCoordenador || !CAMPOS_POR_CATEGORIA[perfil?.nome]
  const categoriaFixa = CAMPOS_POR_CATEGORIA[perfil?.nome] ? perfil.nome : null

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
    let entradasQuery = supabase.from('calendario_entradas').select('*, usuarios(nome_completo)').gte('data', inicio).lte('data', fim).order('created_at')
    // Mostra só os lançamentos da unidade selecionada no momento.
    if (unidadeAtual?.id) entradasQuery = entradasQuery.eq('unidade_id', unidadeAtual.id)
    const [{ data: entradasData }, { data: usuariosData }] = await Promise.all([
      entradasQuery,
      supabase.from('usuarios').select('id, nome_completo').eq('status', 'Ativo'),
    ])
    setEntradas(entradasData || [])
    setUsuarios(usuariosData || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [mesAtual, unidadeAtual])

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
    const { error } = await supabase.from('calendario_entradas').delete().eq('id', excluirId)
    setExcluirId(null)
    if (error) {
      window.alert('Não foi possível excluir este lançamento: ' + error.message)
      return
    }
    carregar()
  }

  return (
    <Layout title="Calendário de Marketing">
      <div className="fx-page-head">
        <div>
          <h1>Calendário de Marketing</h1>
          <p>Organize as publicações de Marketing e os registros do Comercial, dia a dia.</p>
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
            <span><i style={{ background: CAMPOS_POR_CATEGORIA.Marketing.corPrincipal }} /> Marketing</span>
            <span><i style={{ background: CAMPOS_POR_CATEGORIA.Comercial.corPrincipal }} /> Comercial</span>
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
              const marketing = doDia.filter((e) => e.categoria === 'Marketing')
              const comercial = doDia.filter((e) => e.categoria === 'Comercial')
              return (
                <button
                  key={iso}
                  className={`fx-calendario-dia ${iso === hojeISO ? 'is-hoje' : ''}`}
                  onClick={() => setDiaSelecionado(dia)}
                >
                  <span className="fx-calendario-dia-numero">{dia.getDate()}</span>
                  <div className="fx-calendario-dia-badges">
                    {marketing.length > 0 && (
                      <span className="fx-calendario-badge" style={{ background: CAMPOS_POR_CATEGORIA.Marketing.corPrincipal }}>
                        <p className='inf-cg-calendario'>Contagem Marketing</p>
                        {marketing.length}
                        </span>
                    )}
                    {comercial.length > 0 && (
                      <span className="fx-calendario-badge" style={{ background: CAMPOS_POR_CATEGORIA.Comercial.corPrincipal }}>
                        <p>Contagem Comercial</p>
                        {comercial.length}
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
          unidadeId={unidadeAtual?.id}
          isAdmin={isAdmin}
          categoriaFixa={categoriaFixa}
          podeEscolherCategoria={podeEscolherCategoria}
          onClose={() => setDiaSelecionado(null)}
          onSalvou={carregar}
          onExcluir={(id) => setExcluirId(id)}
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

function DiaModal({ dia, entradas, usuario, unidadeId, isAdmin, categoriaFixa, podeEscolherCategoria, onClose, onSalvou, onExcluir }) {
  const [categoria, setCategoria] = useState(categoriaFixa || 'Marketing')
  const [assunto, setAssunto] = useState('')
  const [campoDois, setCampoDois] = useState(CAMPOS_POR_CATEGORIA[categoriaFixa || 'Marketing'].campoDoisOpcoes[0])
  const [campoTres, setCampoTres] = useState(CAMPOS_POR_CATEGORIA[categoriaFixa || 'Marketing'].campoTresOpcoes[0])
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const config = CAMPOS_POR_CATEGORIA[categoria]

  const trocarCategoria = (c) => {
    setCategoria(c)
    setCampoDois(CAMPOS_POR_CATEGORIA[c].campoDoisOpcoes[0])
    setCampoTres(CAMPOS_POR_CATEGORIA[c].campoTresOpcoes[0])
  }

  const iniciarEdicao = (e) => {
    setEditandoId(e.id)
    setCategoria(e.categoria)
    setAssunto(e.assunto)
    setCampoDois(e.campo_dois)
    setCampoTres(e.campo_tres)
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setAssunto('')
    trocarCategoria(categoriaFixa || 'Marketing')
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      usuario_id: usuario?.id,
      data: toISODate(dia),
      categoria,
      assunto,
      campo_dois: campoDois,
      campo_tres: campoTres,
    }
    if (editandoId) {
      await supabase.from('calendario_entradas').update(payload).eq('id', editandoId)
    } else {
      // Novo lançamento nasce vinculado à unidade ativa no momento.
      await supabase.from('calendario_entradas').insert({ ...payload, unidade_id: unidadeId || null })
    }
    setSalvando(false)
    cancelarEdicao()
    onSalvou()
  }

  const marketing = entradas.filter((e) => e.categoria === 'Marketing')
  const comercial = entradas.filter((e) => e.categoria === 'Comercial')

  const podeEditar = (e) => isAdmin || e.usuario_id === usuario?.id

  return (
    <div className="fx-modal-scrim" onClick={onClose}>
      <div className="fx-modal fx-modal-lg" onClick={(ev) => ev.stopPropagation()}>
        <div className="fx-modal-head">
          <h3>{dia.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
          <button className="fx-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="fx-modal-body">
          <form onSubmit={salvar} className="fx-calendario-form">
            {podeEscolherCategoria && !editandoId && (
              <div className="fx-calendario-tabs">
                {Object.keys(CAMPOS_POR_CATEGORIA).map((c) => (
                  <button type="button" key={c} className={`fx-calendario-tab ${categoria === c ? 'is-active' : ''}`} onClick={() => trocarCategoria(c)}>{c}</button>
                ))}
              </div>
            )}
            <div className="fx-calendario-form-grid">
              <label className="fx-field-group">
                <span>Assunto</span>
                <input required value={assunto} onChange={(ev) => setAssunto(ev.target.value)} placeholder="Ex.: Campanha de matrículas" />
              </label>
              <label className="fx-field-group">
                <span>{config.campoDoisLabel}</span>
                <select value={campoDois} onChange={(ev) => setCampoDois(ev.target.value)}>
                  {config.campoDoisOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="fx-field-group">
                <span>{config.campoTresLabel}</span>
                <select value={campoTres} onChange={(ev) => setCampoTres(ev.target.value)}>
                  {config.campoTresOpcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <button type="submit" className="fx-btn fx-btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : '+ Adicionar'}
                </button>
                {editandoId && <button type="button" className="fx-btn fx-btn-ghost" onClick={cancelarEdicao}>Cancelar</button>}
              </div>
            </div>
          </form>

          <TabelaEntradas titulo="Marketing" cor={CAMPOS_POR_CATEGORIA.Marketing.corPrincipal} config={CAMPOS_POR_CATEGORIA.Marketing} entradas={marketing} podeEditar={podeEditar} onEditar={iniciarEdicao} onExcluir={onExcluir} />
          <TabelaEntradas titulo="Comercial" cor={CAMPOS_POR_CATEGORIA.Comercial.corPrincipal} config={CAMPOS_POR_CATEGORIA.Comercial} entradas={comercial} podeEditar={podeEditar} onEditar={iniciarEdicao} onExcluir={onExcluir} />
        </div>
      </div>
    </div>
  )
}

function TabelaEntradas({ titulo, cor, config, entradas, podeEditar, onEditar, onExcluir }) {
  return (
    <div style={{ marginTop: 22 }}>
      <h4 className="fx-calendario-secao-titulo"><span className="fx-calendario-dot" style={{ background: cor }} />{titulo}</h4>
      {entradas.length === 0 ? (
        <div className="fx-empty" style={{ padding: 16 }}>Nenhum lançamento de {titulo.toLowerCase()} para este dia.</div>
      ) : (
        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Assunto</th>
                <th>{config.campoDoisLabel}</th>
                <th>{config.campoTresLabel}</th>
                <th>Responsável</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.assunto}</strong></td>
                  <td>{e.campo_dois}</td>
                  <td>{e.campo_tres}</td>
                  <td>{e.usuarios?.nome_completo || '—'}</td>
                  <td>
                    {podeEditar(e) && (
                      <div className="fx-table-actions">
                        <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => onEditar(e)}>Editar</button>
                        <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => onExcluir(e.id)}>Excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
