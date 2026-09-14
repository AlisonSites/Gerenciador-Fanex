import { Fragment, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { gerarPdfRelatorio, gerarXlsxRelatorio } from '../../lib/exportRelatorio'
import { PRIORIDADE_CLASSE } from '../Tarefas'
import Layout from '../../components/Layout'
import '../../styles/crud.css'
import '../../styles/relatorios.css'

function isConcluido(nome) {
  return /conclu/i.test(nome || '')
}
function isAndamento(nome) {
  return /andamento/i.test(nome || '')
}

// Campo de data usado para filtrar o período do relatório: cada um responde
// uma pergunta diferente ("o que foi concluído em agosto" x "o que vencia em
// agosto" x "o que foi criado em agosto"), então deixamos a pessoa escolher
// em vez de esconder isso atrás de um único filtro de "data".
const CAMPOS_DATA_FILTRO = [
  { valor: 'concluida_em', label: 'Data de conclusão' },
  { valor: 'data_vencimento', label: 'Data de vencimento' },
  { valor: 'created_at', label: 'Data de criação' },
]

function formatarDataBR(dataStr) {
  if (!dataStr) return '—'
  const [ano, mes, dia] = dataStr.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export default function RelatorioPessoal() {
  // Baixar o CSV agora exige a permissão "exportar_relatorios", separada
  // de "relatorio_pessoal" (que só libera ver o relatório na tela).
  const { temPermissao, unidadeAtual } = useAuth()
  const podeExportar = temPermissao('exportar_relatorios')
  const [usuarios, setUsuarios] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [statusList, setStatusList] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [campoData, setCampoData] = useState('concluida_em')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('total')
  const [ordemDesc, setOrdemDesc] = useState(true)
  const [pessoaExpandidaId, setPessoaExpandidaId] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      let tarefasQuery = supabase.from('tarefas').select('*')
      let gruposQuery = supabase.from('grupos').select('*').order('nome')
      // O relatório mostra só os dados da unidade selecionada no momento.
      if (unidadeAtual?.id) {
        tarefasQuery = tarefasQuery.eq('unidade_id', unidadeAtual.id)
        gruposQuery = gruposQuery.eq('unidade_id', unidadeAtual.id)
      }
      const [{ data: usuariosData }, { data: tarefasData }, { data: statusData }, { data: gruposData }] = await Promise.all([
        supabase.from('usuarios').select('*, perfis_acesso(nome)').order('nome_completo'),
        tarefasQuery,
        supabase.from('status_tarefas').select('*').order('ordem'),
        gruposQuery,
      ])
      setUsuarios(usuariosData || [])
      setTarefas(tarefasData || [])
      setStatusList(statusData || [])
      setGrupos(gruposData || [])
      setLoading(false)
    }
    carregar()
  }, [unidadeAtual])

  // Antes, o filtro de período comparava sempre com `created_at` (data em
  // que a tarefa foi criada) — então filtrar "Agosto" não trazia o que foi
  // de fato concluído em agosto, e sim o que tinha sido criado naquele mês.
  // Agora o campo usado na comparação é escolhido em `campoData`.
  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (filtroGrupo && t.grupo_id !== filtroGrupo) return false
      if (!dataInicio && !dataFim) return true
      const valorData = t[campoData] ? t[campoData].slice(0, 10) : null
      if (!valorData) return false
      if (dataInicio && valorData < dataInicio) return false
      if (dataFim && valorData > dataFim) return false
      return true
    })
  }, [tarefas, filtroGrupo, campoData, dataInicio, dataFim])

  const linhas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    return usuarios
      .map((u) => {
        const doUsuario = tarefasFiltradas.filter((t) => t.usuario_id === u.id)
        const concluidas = doUsuario.filter((t) => isConcluido(statusList.find((s) => s.id === t.status_id)?.nome))
        const andamento = doUsuario.filter((t) => isAndamento(statusList.find((s) => s.id === t.status_id)?.nome))
        const pendentes = doUsuario.filter((t) => {
          const nome = statusList.find((s) => s.id === t.status_id)?.nome
          return !isConcluido(nome) && !isAndamento(nome)
        })
        const atrasadas = doUsuario.filter((t) => {
          const nome = statusList.find((s) => s.id === t.status_id)?.nome
          return t.data_vencimento && t.data_vencimento < hoje && !isConcluido(nome)
        })
        const total = doUsuario.length
        const taxaConclusao = total > 0 ? Math.round((concluidas.length / total) * 100) : 0
        return {
          id: u.id,
          nome: u.nome_completo,
          cargo: u.cargo || '—',
          status: u.status,
          perfil: u.perfis_acesso?.nome || '—',
          total,
          pendentes: pendentes.length,
          andamento: andamento.length,
          concluidas: concluidas.length,
          atrasadas: atrasadas.length,
          taxaConclusao,
        }
      })
      .filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()))
  }, [usuarios, tarefasFiltradas, statusList, busca])

  const linhasOrdenadas = useMemo(() => {
    const copia = [...linhas]
    copia.sort((a, b) => {
      const va = a[ordenarPor]
      const vb = b[ordenarPor]
      if (typeof va === 'string') return ordemDesc ? vb.localeCompare(va) : va.localeCompare(vb)
      return ordemDesc ? vb - va : va - vb
    })
    return copia
  }, [linhas, ordenarPor, ordemDesc])

  const alternarOrdenacao = (campo) => {
    if (ordenarPor === campo) {
      setOrdemDesc((d) => !d)
    } else {
      setOrdenarPor(campo)
      setOrdemDesc(true)
    }
  }

  const resumo = useMemo(() => {
    const colaboradoresAtivos = linhas.filter((l) => l.status === 'Ativo').length
    const totalTarefas = linhas.reduce((acc, l) => acc + l.total, 0)
    const totalConcluidas = linhas.reduce((acc, l) => acc + l.concluidas, 0)
    const totalAtrasadas = linhas.reduce((acc, l) => acc + l.atrasadas, 0)
    const taxaMedia = totalTarefas > 0 ? Math.round((totalConcluidas / totalTarefas) * 100) : 0
    return { colaboradoresAtivos, totalTarefas, taxaMedia, totalAtrasadas }
  }, [linhas])

  const dadosGrafico = useMemo(() => {
    return [...linhas]
      .filter((l) => l.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((l) => ({
        nome: l.nome.split(' ')[0],
        Concluídas: l.concluidas,
        'Em andamento': l.andamento,
        Pendentes: l.pendentes,
      }))
  }, [linhas])

  // Detalhamento: a lista real de tarefas por trás dos números da pessoa,
  // respeitando os filtros de grupo/período ativos no relatório.
  const tarefasDaPessoa = (usuarioId) => {
    return tarefasFiltradas
      .filter((t) => t.usuario_id === usuarioId)
      .map((t) => ({
        ...t,
        statusNome: statusList.find((s) => s.id === t.status_id)?.nome || '—',
        grupoNome: grupos.find((g) => g.id === t.grupo_id)?.nome || '—',
      }))
      .sort((a, b) => (b.concluida_em || b.data_vencimento || b.created_at || '').localeCompare(a.concluida_em || a.data_vencimento || a.created_at || ''))
  }

  const periodoDescricao = () => {
    if (!dataInicio && !dataFim) return 'Todo o período'
    const campoLabel = CAMPOS_DATA_FILTRO.find((c) => c.valor === campoData)?.label || 'Data'
    return `${campoLabel}: ${dataInicio ? formatarDataBR(dataInicio) : 'início'} até ${dataFim ? formatarDataBR(dataFim) : 'hoje'}`
  }

  const COLUNAS_EXPORT = [
    { header: 'Colaborador', key: 'nome' },
    { header: 'Cargo', key: 'cargo' },
    { header: 'Perfil', key: 'perfil' },
    { header: 'Status', key: 'status' },
    { header: 'Total', key: 'total' },
    { header: 'Pendentes', key: 'pendentes' },
    { header: 'Em andamento', key: 'andamento' },
    { header: 'Concluídas', key: 'concluidas' },
    { header: 'Atrasadas', key: 'atrasadas' },
    { header: 'Conclusão (%)', key: 'taxaConclusao' },
  ]

  const linhaTotalExport = {
    nome: 'Total', cargo: '', perfil: '', status: '',
    total: resumo.totalTarefas,
    pendentes: linhasOrdenadas.reduce((acc, l) => acc + l.pendentes, 0),
    andamento: linhasOrdenadas.reduce((acc, l) => acc + l.andamento, 0),
    concluidas: linhasOrdenadas.reduce((acc, l) => acc + l.concluidas, 0),
    atrasadas: resumo.totalAtrasadas,
    taxaConclusao: resumo.taxaMedia,
  }

  const exportarXlsx = () => {
    gerarXlsxRelatorio({
      titulo: 'Relatório por Pessoa',
      subtitulo: periodoDescricao(),
      colunas: COLUNAS_EXPORT,
      linhas: linhasOrdenadas,
      linhaTotal: linhaTotalExport,
      nomeArquivo: `relatorio-pessoal-${new Date().toISOString().slice(0, 10)}.xlsx`,
      nomeAba: 'Relatório por Pessoa',
    })
  }

  const exportarPdf = () => {
    gerarPdfRelatorio({
      titulo: 'Relatório por Pessoa',
      subtitulo: periodoDescricao(),
      resumo: [
        { label: 'Colaboradores ativos', value: resumo.colaboradoresAtivos },
        { label: 'Tarefas no período', value: resumo.totalTarefas },
        { label: 'Taxa média de conclusão', value: `${resumo.taxaMedia}%` },
        { label: 'Tarefas atrasadas', value: resumo.totalAtrasadas },
      ],
      colunas: COLUNAS_EXPORT,
      linhas: linhasOrdenadas,
      linhaTotal: linhaTotalExport,
      nomeArquivo: `relatorio-pessoal-${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }


  const limparFiltros = () => {
    setBusca('')
    setFiltroGrupo('')
    setDataInicio('')
    setDataFim('')
  }

  const SetaOrdenacao = ({ campo }) => {
    if (ordenarPor !== campo) return null
    return <span className="fx-sort-arrow">{ordemDesc ? '↓' : '↑'}</span>
  }

  return (
    <Layout title="Relatório por Pessoal">
      <div className="fx-page-head">
        <div>
          <h1>Relatório por pessoal</h1>
          <p>Acompanhe a produtividade individual de cada colaborador e identifique gargalos.</p>
        </div>
        {podeExportar && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="fx-btn fx-btn-secondary" onClick={exportarXlsx} disabled={loading || linhas.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              Exportar Excel
            </button>
            <button className="fx-btn fx-btn-secondary" onClick={exportarPdf} disabled={loading || linhas.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              Exportar PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="fx-empty">Carregando…</div>
      ) : (
        <>
          <div className="fx-stats">
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-normal)' }}>
              <div className="fx-stat-label">Colaboradores ativos</div>
              <div className="fx-stat-value">{resumo.colaboradoresAtivos}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-orange)' }}>
              <div className="fx-stat-label">Tarefas no período</div>
              <div className="fx-stat-value">{resumo.totalTarefas}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-baixa)' }}>
              <div className="fx-stat-label">Taxa média de conclusão</div>
              <div className="fx-stat-value">{resumo.taxaMedia}%</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-urgente)' }}>
              <div className="fx-stat-label">Tarefas atrasadas</div>
              <div className="fx-stat-value">{resumo.totalAtrasadas}</div>
            </div>
          </div>

          <div className="fx-panel fx-panel-pad" style={{ marginBottom: 20 }}>
            <div className="fx-relatorio-filtros">
              <div className="fx-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                <input placeholder="Buscar colaborador..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <select className="fx-select" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
                <option value="">Todos os grupos</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
              <select className="fx-select" value={campoData} onChange={(e) => setCampoData(e.target.value)} title="Qual data usar para filtrar o período">
                {CAMPOS_DATA_FILTRO.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </select>
              <label className="fx-relatorio-data">
                <span>De</span>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </label>
              <label className="fx-relatorio-data">
                <span>Até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </label>
              {(busca || filtroGrupo || dataInicio || dataFim) && (
                <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={limparFiltros}>Limpar filtros</button>
              )}
            </div>
          </div>

          <div className="fx-panel fx-panel-pad" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Top 10 — tarefas por colaborador</h3>
            {dadosGrafico.length === 0 ? (
              <div className="fx-empty"><strong>Sem dados no período</strong>Ajuste os filtros para ver o gráfico.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--fx-line)" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 12, fill: '#6b7094' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7094' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,69,0.04)' }} contentStyle={{ borderRadius: 10, border: '1px solid var(--fx-line)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Concluídas" stackId="a" fill="#1fa971" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Em andamento" stackId="a" fill="#ff5400" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Pendentes" stackId="a" fill="#3169e8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="fx-panel">
            <div className="fx-table-wrap">
              <table className="fx-table">
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('nome')}>Colaborador <SetaOrdenacao campo="nome" /></th>
                    <th>Cargo</th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('total')}>Total <SetaOrdenacao campo="total" /></th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('pendentes')}>Pendentes <SetaOrdenacao campo="pendentes" /></th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('andamento')}>Andamento <SetaOrdenacao campo="andamento" /></th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('concluidas')}>Concluídas <SetaOrdenacao campo="concluidas" /></th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('atrasadas')}>Atrasadas <SetaOrdenacao campo="atrasadas" /></th>
                    <th className="fx-th-sort" onClick={() => alternarOrdenacao('taxaConclusao')}>Conclusão <SetaOrdenacao campo="taxaConclusao" /></th>
                  </tr>
                </thead>
                <tbody>
                  {linhasOrdenadas.map((l) => {
                    const expandida = pessoaExpandidaId === l.id
                    return (
                      <Fragment key={l.id}>
                        <tr className="fx-relatorio-linha-clicavel" onClick={() => setPessoaExpandidaId(expandida ? null : l.id)}>
                          <td>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: expandida ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s ease', color: 'var(--fx-muted)' }}>
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </td>
                          <td>
                            <div className="fx-relatorio-nome">
                              <div className="fx-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                                {l.nome.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
                              </div>
                              <div>
                                <strong>{l.nome}</strong>
                                <small className={`fx-pill fx-pill--${l.status === 'Ativo' ? 'ativo' : 'inativo'}`} style={{ marginTop: 2 }}>{l.status}</small>
                              </div>
                            </div>
                          </td>
                          <td>{l.cargo}</td>
                          <td className="fx-mono">{l.total}</td>
                          <td className="fx-mono">{l.pendentes}</td>
                          <td className="fx-mono">{l.andamento}</td>
                          <td className="fx-mono">{l.concluidas}</td>
                          <td className="fx-mono">
                            {l.atrasadas > 0 ? <span className="fx-pill fx-pill--urgente">{l.atrasadas}</span> : '0'}
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <div className="fx-progress-row">
                              <div className="fx-progress-track">
                                <div
                                  className="fx-progress-fill"
                                  style={{ width: `${l.taxaConclusao}%`, background: l.taxaConclusao >= 70 ? 'var(--fx-baixa)' : l.taxaConclusao >= 40 ? 'var(--fx-orange)' : 'var(--fx-urgente)' }}
                                />
                              </div>
                              <span className="fx-mono">{l.taxaConclusao}%</span>
                            </div>
                          </td>
                        </tr>
                        {expandida && (
                          <tr>
                            <td colSpan={8} style={{ padding: 0, background: 'var(--fx-bg)' }}>
                              <TarefasDaPessoa tarefas={tarefasDaPessoa(l.id)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {linhasOrdenadas.length === 0 && (
                <div className="fx-empty"><strong>Nenhum colaborador encontrado</strong>Ajuste os filtros de busca acima.</div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

// Lista real de tarefas por trás dos números de uma pessoa (drill-down),
// respeitando os filtros ativos no relatório.
function TarefasDaPessoa({ tarefas }) {
  if (tarefas.length === 0) {
    return <div className="fx-relatorio-detalhe"><div className="fx-empty" style={{ margin: 0 }}><strong>Nenhuma tarefa</strong>Nenhuma tarefa desta pessoa no período/filtro selecionado.</div></div>
  }
  return (
    <div className="fx-relatorio-detalhe">
      <table className="fx-table fx-table-sm">
        <thead>
          <tr>
            <th>Tarefa</th>
            <th>Grupo</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Vencimento</th>
            <th>Concluída em</th>
          </tr>
        </thead>
        <tbody>
          {tarefas.map((t) => (
            <tr key={t.id}>
              <td><strong>{t.titulo}</strong></td>
              <td>{t.grupoNome}</td>
              <td>{t.statusNome}</td>
              <td><span className={`fx-pill fx-pill--${PRIORIDADE_CLASSE[t.prioridade] || 'normal'}`}>{t.prioridade}</span></td>
              <td className="fx-mono">{formatarDataBR(t.data_vencimento)}</td>
              <td className="fx-mono">{t.concluida_em ? new Date(t.concluida_em).toLocaleDateString('pt-BR') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}