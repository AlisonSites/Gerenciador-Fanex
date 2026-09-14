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

export default function RelatorioUnidades() {
  // Igual ao Relatório por Pessoal: ver a tela exige "relatorio_unidades",
  // exportar em CSV exige "exportar_relatorios".
  const { temPermissao, unidades, isAdmin } = useAuth()
  const podeExportar = temPermissao('exportar_relatorios')
  const [tarefas, setTarefas] = useState([])
  const [statusList, setStatusList] = useState([])
  const [grupos, setGrupos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [usuarioUnidades, setUsuarioUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [campoData, setCampoData] = useState('concluida_em')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [unidadeExpandidaId, setUnidadeExpandidaId] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [{ data: tarefasData }, { data: statusData }, { data: gruposData }, { data: usuariosData }, { data: uuData }] = await Promise.all([
        supabase.from('tarefas').select('*'),
        supabase.from('status_tarefas').select('*').order('ordem'),
        supabase.from('grupos').select('*'),
        supabase.from('usuarios').select('id, nome_completo, status'),
        supabase.from('usuario_unidades').select('unidade_id, usuario_id'),
      ])
      setTarefas(tarefasData || [])
      setStatusList(statusData || [])
      setGrupos(gruposData || [])
      setUsuarios(usuariosData || [])
      setUsuarioUnidades(uuData || [])
      setLoading(false)
    }
    carregar()
  }, [])

  // Antes este relatório não tinha filtro de período nenhum — sempre somava
  // TODAS as tarefas já criadas, desde o início dos tempos. Agora aceita o
  // mesmo filtro de período do Relatório por Pessoa (por conclusão,
  // vencimento ou criação).
  const tarefasFiltradas = useMemo(() => {
    if (!dataInicio && !dataFim) return tarefas
    return tarefas.filter((t) => {
      const valorData = t[campoData] ? t[campoData].slice(0, 10) : null
      if (!valorData) return false
      if (dataInicio && valorData < dataInicio) return false
      if (dataFim && valorData > dataFim) return false
      return true
    })
  }, [tarefas, campoData, dataInicio, dataFim])

  // Este relatório sempre compara TODAS as unidades que o usuário logado
  // pode acessar (Administrador vê todas), independente da unidade
  // selecionada no cabeçalho — é justamente o ponto de comparar entre elas.
  const linhas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    return unidades.map((u) => {
      const gruposDaUnidade = grupos.filter((g) => g.unidade_id === u.id)
      const idsGrupos = new Set(gruposDaUnidade.map((g) => g.id))
      const tarefasDaUnidade = tarefasFiltradas.filter((t) => t.unidade_id === u.id || (t.grupo_id && idsGrupos.has(t.grupo_id)))
      const concluidas = tarefasDaUnidade.filter((t) => isConcluido(statusList.find((s) => s.id === t.status_id)?.nome))
      const andamento = tarefasDaUnidade.filter((t) => isAndamento(statusList.find((s) => s.id === t.status_id)?.nome))
      const atrasadas = tarefasDaUnidade.filter((t) => {
        const nome = statusList.find((s) => s.id === t.status_id)?.nome
        return t.data_vencimento && t.data_vencimento < hoje && !isConcluido(nome)
      })
      const idsUsuarios = new Set(usuarioUnidades.filter((r) => r.unidade_id === u.id).map((r) => r.usuario_id))
      const pessoas = usuarios.filter((us) => idsUsuarios.has(us.id))
      const total = tarefasDaUnidade.length
      const taxaConclusao = total > 0 ? Math.round((concluidas.length / total) * 100) : 0

      return {
        id: u.id,
        nome: u.nome,
        status: u.status,
        grupos: gruposDaUnidade.length,
        pessoas: pessoas.length,
        pessoasAtivas: pessoas.filter((p) => p.status === 'Ativo').length,
        total,
        andamento: andamento.length,
        concluidas: concluidas.length,
        atrasadas: atrasadas.length,
        taxaConclusao,
      }
    })
  }, [unidades, grupos, tarefasFiltradas, statusList, usuarios, usuarioUnidades])

  const resumo = useMemo(() => {
    const totalTarefas = linhas.reduce((acc, l) => acc + l.total, 0)
    const totalConcluidas = linhas.reduce((acc, l) => acc + l.concluidas, 0)
    const totalAtrasadas = linhas.reduce((acc, l) => acc + l.atrasadas, 0)
    const taxaMedia = totalTarefas > 0 ? Math.round((totalConcluidas / totalTarefas) * 100) : 0
    return { unidadesAtivas: linhas.filter((l) => l.status === 'Ativo').length, totalTarefas, taxaMedia, totalAtrasadas }
  }, [linhas])

  const dadosGrafico = useMemo(() => (
    [...linhas].sort((a, b) => b.total - a.total).map((l) => ({
      nome: l.nome,
      Concluídas: l.concluidas,
      'Em andamento': l.andamento,
      Pendentes: l.total - l.concluidas - l.andamento,
    }))
  ), [linhas])

  // Detalhamento: por grupo dentro da unidade, e a lista real de tarefas por
  // trás dos números, respeitando o filtro de período ativo.
  const detalheDaUnidade = (unidadeId) => {
    const gruposDaUnidade = grupos.filter((g) => g.unidade_id === unidadeId)
    const idsGrupos = new Set(gruposDaUnidade.map((g) => g.id))
    const tarefasDaUnidade = tarefasFiltradas.filter((t) => t.unidade_id === unidadeId || (t.grupo_id && idsGrupos.has(t.grupo_id)))

    const porGrupo = gruposDaUnidade.map((g) => {
      const doGrupo = tarefasDaUnidade.filter((t) => t.grupo_id === g.id)
      const concluidas = doGrupo.filter((t) => isConcluido(statusList.find((s) => s.id === t.status_id)?.nome))
      const atrasadas = doGrupo.filter((t) => {
        const nome = statusList.find((s) => s.id === t.status_id)?.nome
        const hoje = new Date().toISOString().slice(0, 10)
        return t.data_vencimento && t.data_vencimento < hoje && !isConcluido(nome)
      })
      return { id: g.id, nome: g.nome, total: doGrupo.length, concluidas: concluidas.length, atrasadas: atrasadas.length }
    }).filter((g) => g.total > 0)

    const tarefasComNomes = tarefasDaUnidade
      .map((t) => ({
        ...t,
        grupoNome: grupos.find((g) => g.id === t.grupo_id)?.nome || '—',
        statusNome: statusList.find((s) => s.id === t.status_id)?.nome || '—',
        responsavelNome: usuarios.find((u) => u.id === t.usuario_id)?.nome_completo || 'Sem responsável',
      }))
      .sort((a, b) => (b.concluida_em || b.data_vencimento || b.created_at || '').localeCompare(a.concluida_em || a.data_vencimento || a.created_at || ''))

    return { porGrupo, tarefas: tarefasComNomes }
  }

  const periodoDescricao = () => {
    if (!dataInicio && !dataFim) return 'Todo o período'
    const campoLabel = CAMPOS_DATA_FILTRO.find((c) => c.valor === campoData)?.label || 'Data'
    return `${campoLabel}: ${dataInicio ? formatarDataBR(dataInicio) : 'início'} até ${dataFim ? formatarDataBR(dataFim) : 'hoje'}`
  }

  const COLUNAS_EXPORT = [
    { header: 'Unidade', key: 'nome' },
    { header: 'Status', key: 'status' },
    { header: 'Grupos', key: 'grupos' },
    { header: 'Pessoas', key: 'pessoas' },
    { header: 'Pessoas Ativas', key: 'pessoasAtivas' },
    { header: 'Total Tarefas', key: 'total' },
    { header: 'Em Andamento', key: 'andamento' },
    { header: 'Concluídas', key: 'concluidas' },
    { header: 'Atrasadas', key: 'atrasadas' },
    { header: 'Taxa de Conclusão (%)', key: 'taxaConclusao' },
  ]

  const linhaTotalExport = {
    nome: 'Total', status: '',
    grupos: linhas.reduce((acc, l) => acc + l.grupos, 0),
    pessoas: linhas.reduce((acc, l) => acc + l.pessoas, 0),
    pessoasAtivas: linhas.reduce((acc, l) => acc + l.pessoasAtivas, 0),
    total: resumo.totalTarefas,
    andamento: linhas.reduce((acc, l) => acc + l.andamento, 0),
    concluidas: linhas.reduce((acc, l) => acc + l.concluidas, 0),
    atrasadas: resumo.totalAtrasadas,
    taxaConclusao: resumo.taxaMedia,
  }

  const exportarXlsx = () => {
    gerarXlsxRelatorio({
      titulo: 'Relatório Consolidado por Unidade',
      subtitulo: periodoDescricao(),
      colunas: COLUNAS_EXPORT,
      linhas,
      linhaTotal: linhaTotalExport,
      nomeArquivo: `relatorio-unidades-${new Date().toISOString().slice(0, 10)}.xlsx`,
      nomeAba: 'Unidades',
    })
  }

  const exportarPdf = () => {
    gerarPdfRelatorio({
      titulo: 'Relatório Consolidado por Unidade',
      subtitulo: periodoDescricao(),
      resumo: [
        { label: 'Unidades ativas', value: resumo.unidadesAtivas },
        { label: 'Tarefas no total', value: resumo.totalTarefas },
        { label: 'Taxa média de conclusão', value: `${resumo.taxaMedia}%` },
        { label: 'Tarefas atrasadas', value: resumo.totalAtrasadas },
      ],
      colunas: COLUNAS_EXPORT,
      linhas,
      linhaTotal: linhaTotalExport,
      nomeArquivo: `relatorio-unidades-${new Date().toISOString().slice(0, 10)}.pdf`,
    })
  }


  return (
    <Layout title="Relatório Consolidado por Unidade">
      <div className="fx-page-head">
        <div>
          <h1>Relatório consolidado por unidade</h1>
          <p>{isAdmin ? 'Compare produtividade, equipe e prazos entre todas as unidades.' : 'Compare as unidades às quais você está vinculado.'}</p>
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
      ) : linhas.length === 0 ? (
        <div className="fx-empty"><strong>Nenhuma unidade disponível</strong>Cadastre unidades em "Unidades" no menu para ver este relatório.</div>
      ) : (
        <>
          <div className="fx-panel fx-panel-pad" style={{ marginBottom: 20 }}>
            <div className="fx-relatorio-filtros">
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
              {(dataInicio || dataFim) && (
                <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => { setDataInicio(''); setDataFim('') }}>Limpar período</button>
              )}
            </div>
          </div>

          <div className="fx-stats">
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-normal)' }}>
              <div className="fx-stat-label">Unidades ativas</div>
              <div className="fx-stat-value">{resumo.unidadesAtivas}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-orange)' }}>
              <div className="fx-stat-label">Tarefas no total</div>
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
            <h3 style={{ marginBottom: 16 }}>Tarefas por unidade</h3>
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
          </div>

          <div className="fx-panel">
            <div className="fx-table-wrap">
              <table className="fx-table">
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th>Unidade</th>
                    <th>Grupos</th>
                    <th>Pessoas</th>
                    <th>Total</th>
                    <th>Andamento</th>
                    <th>Concluídas</th>
                    <th>Atrasadas</th>
                    <th>Conclusão</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const expandida = unidadeExpandidaId === l.id
                    return (
                      <Fragment key={l.id}>
                        <tr className="fx-relatorio-linha-clicavel" onClick={() => setUnidadeExpandidaId(expandida ? null : l.id)}>
                          <td>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: expandida ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s ease', color: 'var(--fx-muted)' }}>
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </td>
                          <td>
                            <strong>{l.nome}</strong>{' '}
                            <span className={`fx-pill fx-pill--${l.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{l.status}</span>
                          </td>
                          <td className="fx-mono">{l.grupos}</td>
                          <td className="fx-mono">{l.pessoasAtivas}/{l.pessoas}</td>
                          <td className="fx-mono">{l.total}</td>
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
                            <td colSpan={9} style={{ padding: 0, background: 'var(--fx-bg)' }}>
                              <DetalheDaUnidade detalhe={detalheDaUnidade(l.id)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

// Detalhamento de uma unidade (drill-down): quebra por grupo/setor e, logo
// abaixo, a lista real de tarefas por trás dos números, respeitando o
// filtro de período ativo no relatório.
function DetalheDaUnidade({ detalhe }) {
  const { porGrupo, tarefas } = detalhe

  if (tarefas.length === 0) {
    return <div className="fx-relatorio-detalhe"><div className="fx-empty" style={{ margin: 0 }}><strong>Nada por aqui</strong>Nenhuma tarefa desta unidade no período selecionado.</div></div>
  }

  return (
    <div className="fx-relatorio-detalhe">
      {porGrupo.length > 0 && (
        <div className="fx-relatorio-detalhe-colunas" style={{ marginBottom: 16 }}>
          {porGrupo.map((g) => (
            <div className="fx-relatorio-detalhe-bloco" key={g.id}>
              <h4>{g.nome}</h4>
              <div className="fx-relatorio-detalhe-chips">
                <span className="fx-relatorio-detalhe-chip">Total <strong>{g.total}</strong></span>
                <span className="fx-relatorio-detalhe-chip">Concluídas <strong>{g.concluidas}</strong></span>
                <span className="fx-relatorio-detalhe-chip">Atrasadas <strong>{g.atrasadas}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        <table className="fx-table fx-table-sm">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Grupo</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.titulo}</strong></td>
                <td>{t.grupoNome}</td>
                <td>{t.responsavelNome}</td>
                <td>{t.statusNome}</td>
                <td><span className={`fx-pill fx-pill--${PRIORIDADE_CLASSE[t.prioridade] || 'normal'}`}>{t.prioridade}</span></td>
                <td className="fx-mono">{formatarDataBR(t.data_vencimento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
