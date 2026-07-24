import { Fragment, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import '../../styles/crud.css'
import '../../styles/relatorios.css'

// Mesmas colunas usadas em /calendario (CalendarioMarketing.jsx), duplicadas
// aqui só para montar os rótulos e agrupar as contagens do relatório.
const CAMPOS_POR_CATEGORIA = {
  Marketing: {
    campoDoisLabel: 'Postagem',
    campoDoisOpcoes: ['Feed', 'Story'],
    campoTresLabel: 'Status',
    campoTresOpcoes: ['Pendente', 'Em andamento', 'Concluído'],
  },
  Comercial: {
    campoDoisLabel: 'Tipo',
    campoDoisOpcoes: ['Aten. Presencial', 'Aten. Virtual', 'Mensagem RD', 'Mensagem Enviada', 'Matrículas pagas', 'Matrículas Gratuita'],
    campoTresLabel: 'Publicidade',
    campoTresOpcoes: ['Blubash', 'Anúncio', 'Whatsapp', 'Instagram', 'Visita', 'Panfleto', 'Curso gratuito'],
  },
}

export default function RelatorioCalendario() {
  const [usuarios, setUsuarios] = useState([])
  const [entradas, setEntradas] = useState([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [pessoaExpandidaId, setPessoaExpandidaId] = useState(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [{ data: usuariosData }, { data: entradasData }] = await Promise.all([
        supabase.from('usuarios').select('*, perfis_acesso(nome)').order('nome_completo'),
        supabase.from('calendario_entradas').select('*'),
      ])
      setUsuarios(usuariosData || [])
      setEntradas(entradasData || [])
      setLoading(false)
    }
    carregar()
  }, [])

  const entradasFiltradas = useMemo(() => {
    return entradas.filter((e) => {
      if (categoria && e.categoria !== categoria) return false
      if (dataInicio && e.data < dataInicio) return false
      if (dataFim && e.data > dataFim) return false
      return true
    })
  }, [entradas, categoria, dataInicio, dataFim])

  const linhas = useMemo(() => {
    return usuarios
      .filter((u) => ['Marketing', 'Comercial', 'Administrador', 'Coordenador'].includes(u.perfis_acesso?.nome))
      .map((u) => {
        const doUsuario = entradasFiltradas.filter((e) => e.usuario_id === u.id)
        const marketing = doUsuario.filter((e) => e.categoria === 'Marketing').length
        const comercial = doUsuario.filter((e) => e.categoria === 'Comercial').length
        return {
          id: u.id,
          nome: u.nome_completo,
          perfil: u.perfis_acesso?.nome || '—',
          marketing,
          comercial,
          total: marketing + comercial,
        }
      })
      .filter((l) => l.total > 0 || !busca)
      .filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => b.total - a.total)
  }, [usuarios, entradasFiltradas, busca])

  const resumo = useMemo(() => {
    const totalMarketing = entradasFiltradas.filter((e) => e.categoria === 'Marketing').length
    const totalComercial = entradasFiltradas.filter((e) => e.categoria === 'Comercial').length
    const pessoasAtivas = linhas.filter((l) => l.total > 0).length
    return { totalMarketing, totalComercial, total: totalMarketing + totalComercial, pessoasAtivas }
  }, [entradasFiltradas, linhas])

  const dadosGrafico = useMemo(() => {
    return linhas
      .filter((l) => l.total > 0)
      .slice(0, 10)
      .map((l) => ({ nome: l.nome.split(' ')[0], Marketing: l.marketing, Comercial: l.comercial }))
  }, [linhas])

  const exportarCSV = () => {
    const cabecalho = ['Nome', 'Perfil', 'Lançamentos Marketing', 'Lançamentos Comercial', 'Total']
    const linhasCSV = linhas.map((l) => [l.nome, l.perfil, l.marketing, l.comercial, l.total])
    const csv = [cabecalho, ...linhasCSV]
      .map((linha) => linha.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-calendario-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const detalheDaPessoa = (usuarioId) => {
    const doUsuario = entradasFiltradas.filter((e) => e.usuario_id === usuarioId)
    const porCategoria = { Marketing: doUsuario.filter((e) => e.categoria === 'Marketing'), Comercial: doUsuario.filter((e) => e.categoria === 'Comercial') }

    const contagemPorOpcao = (lista, campo, opcoes) => {
      return opcoes.map((opcao) => ({ opcao, total: lista.filter((e) => e[campo] === opcao).length })).filter((c) => c.total > 0)
    }

    const colunas = {}
    for (const cat of ['Marketing', 'Comercial']) {
      const lista = porCategoria[cat]
      if (lista.length === 0) continue
      const config = CAMPOS_POR_CATEGORIA[cat]
      colunas[cat] = {
        campoDoisLabel: config.campoDoisLabel,
        campoDois: contagemPorOpcao(lista, 'campo_dois', config.campoDoisOpcoes),
        campoTresLabel: config.campoTresLabel,
        campoTres: contagemPorOpcao(lista, 'campo_tres', config.campoTresOpcoes),
      }
    }

    const entradasOrdenadas = [...doUsuario].sort((a, b) => (a.data < b.data ? 1 : -1))
    return { colunas, entradasOrdenadas }
  }

  const exportarDetalhadoCSV = () => {
    const cabecalho = ['Pessoa', 'Perfil', 'Data', 'Categoria', 'Assunto', 'Coluna 2', 'Valor coluna 2', 'Coluna 3', 'Valor coluna 3']
    const linhasCSV = linhas.flatMap((l) => {
      const { entradasOrdenadas } = detalheDaPessoa(l.id)
      return entradasOrdenadas.map((e) => {
        const config = CAMPOS_POR_CATEGORIA[e.categoria] || {}
        return [
          l.nome,
          l.perfil,
          e.data,
          e.categoria,
          e.assunto,
          config.campoDoisLabel || '',
          e.campo_dois || '',
          config.campoTresLabel || '',
          e.campo_tres || '',
        ]
      })
    })
    const csv = [cabecalho, ...linhasCSV]
      .map((linha) => linha.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-calendario-detalhado-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const limparFiltros = () => {
    setBusca('')
    setCategoria('')
    setDataInicio('')
    setDataFim('')
  }

  return (
    <Layout title="Relatório do Calendário">
      <div className="fx-page-head">
        <div>
          <h1>Relatório do calendário por pessoa</h1>
          <p>Acompanhe quantos lançamentos cada pessoa fez e clique em uma linha para ver o detalhamento por coluna (Postagem, Status, Tipo, Publicidade).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="fx-btn fx-btn-secondary" onClick={exportarCSV} disabled={loading || linhas.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            Exportar resumo
          </button>
          <button className="fx-btn fx-btn-secondary" onClick={exportarDetalhadoCSV} disabled={loading || linhas.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            Exportar detalhado
          </button>
        </div>
      </div>

      {loading ? (
        <div className="fx-empty">Carregando…</div>
      ) : (
        <>
          <div className="fx-stats">
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-navy)' }}>
              <div className="fx-stat-label">Total de lançamentos</div>
              <div className="fx-stat-value">{resumo.total}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': '#3169e8' }}>
              <div className="fx-stat-label">Marketing</div>
              <div className="fx-stat-value">{resumo.totalMarketing}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': '#ff5400' }}>
              <div className="fx-stat-label">Comercial</div>
              <div className="fx-stat-value">{resumo.totalComercial}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-baixa)' }}>
              <div className="fx-stat-label">Pessoas com lançamentos</div>
              <div className="fx-stat-value">{resumo.pessoasAtivas}</div>
            </div>
          </div>

          <div className="fx-panel fx-panel-pad" style={{ marginBottom: 20 }}>
            <div className="fx-relatorio-filtros">
              <div className="fx-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                <input placeholder="Buscar pessoa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <select className="fx-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Marketing + Comercial</option>
                <option value="Marketing">Somente Marketing</option>
                <option value="Comercial">Somente Comercial</option>
              </select>
              <label className="fx-relatorio-data">
                <span>De</span>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </label>
              <label className="fx-relatorio-data">
                <span>Até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </label>
              {(busca || categoria || dataInicio || dataFim) && (
                <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={limparFiltros}>Limpar filtros</button>
              )}
            </div>
          </div>

          <div className="fx-panel fx-panel-pad" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>Top 10 — lançamentos por pessoa</h3>
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
                  <Bar dataKey="Marketing" fill="#3169e8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Comercial" fill="#ff5400" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="fx-panel">
            <div className="fx-table-wrap">
              <table className="fx-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Pessoa</th>
                    <th>Perfil</th>
                    <th>Marketing</th>
                    <th>Comercial</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const expandida = pessoaExpandidaId === l.id
                    return (
                      <Fragment key={l.id}>
                        <tr
                          key={l.id}
                          className="fx-relatorio-linha-clicavel"
                          onClick={() => setPessoaExpandidaId(expandida ? null : l.id)}
                        >
                          <td style={{ width: 24 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: expandida ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s ease', color: 'var(--fx-muted)' }}>
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </td>
                          <td>
                            <div className="fx-relatorio-nome">
                              <div className="fx-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                                {l.nome.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
                              </div>
                              <strong>{l.nome}</strong>
                            </div>
                          </td>
                          <td>{l.perfil}</td>
                          <td className="fx-mono">{l.marketing}</td>
                          <td className="fx-mono">{l.comercial}</td>
                          <td className="fx-mono"><strong>{l.total}</strong></td>
                        </tr>
                        {expandida && (
                          <tr key={`${l.id}-detalhe`}>
                            <td colSpan={6} style={{ padding: 0, background: 'var(--fx-bg)' }}>
                              <DetalhePorColuna detalhe={detalheDaPessoa(l.id)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {linhas.length === 0 && (
                <div className="fx-empty"><strong>Nenhum lançamento encontrado</strong>Ajuste os filtros acima.</div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

// Detalhamento das colunas do calendário (Postagem/Status/Tipo/Publicidade)
// para uma pessoa específica, respeitando os filtros ativos no relatório.
function DetalhePorColuna({ detalhe }) {
  const { colunas, entradasOrdenadas } = detalhe
  const categorias = Object.keys(colunas)

  if (categorias.length === 0) {
    return <div className="fx-relatorio-detalhe"><div className="fx-empty" style={{ margin: 0 }}><strong>Sem lançamentos</strong>Nenhum lançamento desta pessoa no período/filtro selecionado.</div></div>
  }

  return (
    <div className="fx-relatorio-detalhe">
      <div className="fx-relatorio-detalhe-colunas">
        {categorias.map((cat) => {
          const c = colunas[cat]
          return (
            <div className="fx-relatorio-detalhe-bloco" key={cat}>
              <h4>{cat}</h4>
              <div className="fx-relatorio-detalhe-grupo">
                <span className="fx-relatorio-detalhe-rotulo">{c.campoDoisLabel}</span>
                <div className="fx-relatorio-detalhe-chips">
                  {c.campoDois.length === 0 && <span className="fx-relatorio-detalhe-vazio">—</span>}
                  {c.campoDois.map((item) => (
                    <span className="fx-relatorio-detalhe-chip" key={item.opcao}>{item.opcao} <strong>{item.total}</strong></span>
                  ))}
                </div>
              </div>
              <div className="fx-relatorio-detalhe-grupo">
                <span className="fx-relatorio-detalhe-rotulo">{c.campoTresLabel}</span>
                <div className="fx-relatorio-detalhe-chips">
                  {c.campoTres.length === 0 && <span className="fx-relatorio-detalhe-vazio">—</span>}
                  {c.campoTres.map((item) => (
                    <span className="fx-relatorio-detalhe-chip" key={item.opcao}>{item.opcao} <strong>{item.total}</strong></span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="fx-relatorio-detalhe-lista">
        <DetalhamentoPorDia entradas={entradasOrdenadas} />
      </div>
    </div>
  )
}

// Agrupa os lançamentos da pessoa por dia de registro: um bloco por data,
// já ordenado do mais recente para o mais antigo, com a tabela de
// lançamentos daquele dia dentro do bloco.
function DetalhamentoPorDia({ entradas }) {
  const grupos = useMemo(() => {
    const mapa = new Map()
    entradas.forEach((e) => {
      if (!mapa.has(e.data)) mapa.set(e.data, [])
      mapa.get(e.data).push(e)
    })
    return Array.from(mapa.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [entradas])

  if (grupos.length === 0) {
    return <div className="fx-empty" style={{ margin: 0 }}><strong>Sem lançamentos</strong>Nenhum lançamento desta pessoa no período/filtro selecionado.</div>
  }

  return (
    <div className="fx-relatorio-detalhe-dias">
      {grupos.map(([data, doDia]) => (
        <div className="fx-relatorio-detalhe-dia" key={data}>
          <h5 className="fx-relatorio-detalhe-dia-titulo">
            {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })}
            <span className="fx-relatorio-detalhe-dia-contagem">{doDia.length} {doDia.length === 1 ? 'lançamento' : 'lançamentos'}</span>
          </h5>
          <table className="fx-table fx-table-sm">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Assunto</th>
                <th>Coluna 2</th>
                <th>Coluna 3</th>
              </tr>
            </thead>
            <tbody>
              {doDia.map((e) => (
                <tr key={e.id}>
                  <td>{e.categoria}</td>
                  <td>{e.assunto}</td>
                  <td>{e.campo_dois || '—'}</td>
                  <td>{e.campo_tres || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
