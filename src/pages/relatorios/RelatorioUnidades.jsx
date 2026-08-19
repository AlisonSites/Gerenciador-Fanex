import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import '../../styles/crud.css'
import '../../styles/relatorios.css'

function isConcluido(nome) {
  return /conclu/i.test(nome || '')
}
function isAndamento(nome) {
  return /andamento/i.test(nome || '')
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

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const [{ data: tarefasData }, { data: statusData }, { data: gruposData }, { data: usuariosData }, { data: uuData }] = await Promise.all([
        supabase.from('tarefas').select('*'),
        supabase.from('status_tarefas').select('*').order('ordem'),
        supabase.from('grupos').select('*'),
        supabase.from('usuarios').select('id, status'),
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

  // Este relatório sempre compara TODAS as unidades que o usuário logado
  // pode acessar (Administrador vê todas), independente da unidade
  // selecionada no cabeçalho — é justamente o ponto de comparar entre elas.
  const linhas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    return unidades.map((u) => {
      const gruposDaUnidade = grupos.filter((g) => g.unidade_id === u.id)
      const idsGrupos = new Set(gruposDaUnidade.map((g) => g.id))
      const tarefasDaUnidade = tarefas.filter((t) => t.unidade_id === u.id || (t.grupo_id && idsGrupos.has(t.grupo_id)))
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
  }, [unidades, grupos, tarefas, statusList, usuarios, usuarioUnidades])

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

  const exportarCSV = () => {
    const cabecalho = ['Unidade', 'Status', 'Grupos', 'Pessoas', 'Pessoas Ativas', 'Total Tarefas', 'Em Andamento', 'Concluídas', 'Atrasadas', 'Taxa de Conclusão (%)']
    const linhasCSV = linhas.map((l) => [l.nome, l.status, l.grupos, l.pessoas, l.pessoasAtivas, l.total, l.andamento, l.concluidas, l.atrasadas, l.taxaConclusao])
    const csv = [cabecalho, ...linhasCSV]
      .map((linha) => linha.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-unidades-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout title="Relatório Consolidado por Unidade">
      <div className="fx-page-head">
        <div>
          <h1>Relatório consolidado por unidade</h1>
          <p>{isAdmin ? 'Compare produtividade, equipe e prazos entre todas as unidades.' : 'Compare as unidades às quais você está vinculado.'}</p>
        </div>
        {podeExportar && (
          <button className="fx-btn fx-btn-secondary" onClick={exportarCSV} disabled={loading || linhas.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            Exportar CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="fx-empty">Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="fx-empty"><strong>Nenhuma unidade disponível</strong>Cadastre unidades em "Unidades" no menu para ver este relatório.</div>
      ) : (
        <>
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
                  {linhas.map((l) => (
                    <tr key={l.id}>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
