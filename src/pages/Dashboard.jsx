import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import '../styles/dashboard.css'

const PRIORIDADE_LABEL = { Baixa: 'baixa', Normal: 'normal', Alta: 'alta', Urgente: 'urgente' }

const STAT_ICONS = {
  total: <path d="M4 4h16v16H4V4zm4 3v10m4-10v10m4-10v10" />,
  pendentes: <path d="M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z" />,
  andamento: <path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z" />,
  concluidas: <path d="M20 6L9 17l-5-5" />,
}

function StatIcon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {STAT_ICONS[name]}
    </svg>
  )
}

export default function Dashboard() {
  const { usuario, isColaborador, isCoordenador, temPermissao, unidadeAtual } = useAuth()
  const podeVerTudo = temPermissao('gerenciar_tarefas') // Administrador e Coordenador
  const [grupos, setGrupos] = useState([])
  const [escopo, setEscopo] = useState(podeVerTudo ? 'geral' : 'pessoal') // 'geral' | 'pessoal' | <grupo_id>
  const [tarefas, setTarefas] = useState([])
  const [statusList, setStatusList] = useState([])
  const [loading, setLoading] = useState(true)

  // Carrega a lista de grupos disponíveis para os atalhos do painel,
  // restrita à unidade selecionada no momento.
  useEffect(() => {
    let ativo = true
    async function carregarGrupos() {
      let gruposData = []
      if (podeVerTudo) {
        let query = supabase.from('grupos').select('*').order('nome')
        if (unidadeAtual?.id) query = query.eq('unidade_id', unidadeAtual.id)
        const { data } = await query
        gruposData = data || []
      } else if (usuario) {
        const { data } = await supabase.from('grupo_membros').select('grupos(*)').eq('usuario_id', usuario.id)
        gruposData = (data || []).map((row) => row.grupos).filter(Boolean)
        if (unidadeAtual?.id) gruposData = gruposData.filter((g) => g.unidade_id === unidadeAtual.id)
        gruposData.sort((a, b) => a.nome.localeCompare(b.nome))
      }
      if (ativo) setGrupos(gruposData)
    }
    carregarGrupos()
    return () => { ativo = false }
  }, [podeVerTudo, usuario, unidadeAtual])

  // Garante que o escopo selecionado continue válido quando os dados do usuário mudam.
  useEffect(() => {
    setEscopo(podeVerTudo ? 'geral' : 'pessoal')
  }, [podeVerTudo, usuario?.id])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setLoading(true)
      const { data: statusData } = await supabase.from('status_tarefas').select('*').order('ordem')
      if (ativo) setStatusList(statusData || [])

      let query = supabase.from('tarefas').select('*')
      if (escopo === 'pessoal') {
        query = query.eq('usuario_id', usuario?.id || '00000000-0000-0000-0000-000000000000')
      } else if (escopo !== 'geral') {
        query = query.eq('grupo_id', escopo)
      } else if (unidadeAtual?.id) {
        query = query.eq('unidade_id', unidadeAtual.id)
      }
      // Segurança extra: quem não pode ver tudo nunca busca o escopo "geral".
      if (escopo === 'geral' && !podeVerTudo) {
        if (ativo) { setTarefas([]); setLoading(false) }
        return
      }
      const { data: tarefasData } = await query
      if (ativo) {
        setTarefas(tarefasData || [])
        setLoading(false)
      }
    }
    carregar()
    return () => { ativo = false }
  }, [escopo, usuario, podeVerTudo, unidadeAtual])

  const concluido = statusList.find((s) => /conclu/i.test(s.nome))
  const pendentes = tarefas.filter((t) => t.status_id !== concluido?.id && !isConcluidoName(t, statusList))
  const emAndamento = tarefas.filter((t) => /andamento/i.test(statusNome(t, statusList) || ''))
  const concluidas = tarefas.filter((t) => /conclu/i.test(statusNome(t, statusList) || ''))

  const dadosGrafico = useMemo(() => {
    return statusList.map((s) => ({
      nome: s.nome,
      total: tarefas.filter((t) => t.status_id === s.id).length,
      cor: s.cor,
    }))
  }, [statusList, tarefas])

  // Próximos vencimentos: tarefas com data futura ou hoje, em qualquer status (exceto Concluído)
  const proximas = [...tarefas]
    .filter((t) => {
      // Verifica se tem data de vencimento
      if (!t.data_vencimento) return false;

      // Verifica se NÃO está concluída (compara pelo id do status "Concluído",
      // igual ao cálculo de "pendentes" acima, para não depender só do nome)
      if (t.status_id === concluido?.id) return false;

      // Verifica se a data de vencimento é futura ou hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const dataVencimento = new Date(t.data_vencimento);
      dataVencimento.setHours(0, 0, 0, 0);

      return dataVencimento >= hoje;
    })
    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))
    .slice(0, 5)

  // Tarefas vencidas: tarefas com data passada, em qualquer status (exceto Concluído)
  const vencidas = [...tarefas]
    .filter((t) => {
      // Verifica se tem data de vencimento
      if (!t.data_vencimento) return false;

      // Verifica se NÃO está concluída (compara pelo id do status "Concluído",
      // igual ao cálculo de "pendentes" acima, para não depender só do nome)
      if (t.status_id === concluido?.id) return false;

      // Verifica se a data de vencimento é passada
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const dataVencimento = new Date(t.data_vencimento);
      dataVencimento.setHours(0, 0, 0, 0);

      return dataVencimento < hoje;
    })
    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))

  const grupoAtivo = grupos.find((g) => g.id === escopo)
  const tituloEscopo = escopo === 'geral' ? 'Visão geral (todos os grupos)' : escopo === 'pessoal' ? 'Minhas tarefas' : grupoAtivo?.nome || 'Grupo'

  return (
    <Layout title="Dashboard">
      <div className="fx-page-head">
        <div>
          <h1>Olá, {usuario?.nome_completo?.split(' ')[0] || 'bem-vindo'} </h1>
          <p>{isColaborador ? 'Aqui está o resumo das suas tarefas.' : isCoordenador ? 'Visão geral da coordenação de tarefas.' : 'Visão geral do sistema.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {temPermissao('relatorio_pessoal') && (
            <Link to="/relatorios/pessoal" className="fx-btn fx-btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20V10m6 10V4m6 16v-7" /></svg>
              Relatório por pessoal
            </Link>
          )}
          {temPermissao('relatorio_calendario') && (
            <Link to="/relatorios/calendario" className="fx-btn fx-btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM8 2v4m8-4v4M8 14v4m4-7v7m4-4v4" /></svg>
              Relatório do calendário
            </Link>
          )}
        </div>
      </div>

      <div className="fx-dash-scope">
        {podeVerTudo && (
          <button className={`fx-dash-scope-btn ${escopo === 'geral' ? 'is-active' : ''}`} onClick={() => setEscopo('geral')}>
            Geral
          </button>
        )}
        {grupos.map((g) => (
          <button
            key={g.id}
            className={`fx-dash-scope-btn ${escopo === g.id ? 'is-active' : ''}`}
            onClick={() => setEscopo(g.id)}
          >
            {g.nome}
          </button>
        ))}
        <button className={`fx-dash-scope-btn ${escopo === 'pessoal' ? 'is-active' : ''}`} onClick={() => setEscopo('pessoal')}>
          Pessoal
        </button>
      </div>

      {loading ? (
        <div className="fx-stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="fx-stat-card fx-skeleton-card" key={i}>
              <div className="fx-skeleton fx-skeleton-label" />
              <div className="fx-skeleton fx-skeleton-value" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="fx-dash-scope-label">{tituloEscopo}</p>

          <div className="fx-stats">
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-normal)' }}>
              <div className="fx-stat-card-top">
                <div className="fx-stat-label">Total de tarefas</div>
                <div className="fx-stat-icon" style={{ color: 'var(--fx-normal)', background: 'rgba(49,105,232,0.1)' }}><StatIcon name="total" /></div>
              </div>
              <div className="fx-stat-value">{tarefas.length}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-alta)' }}>
              <div className="fx-stat-card-top">
                <div className="fx-stat-label">Pendentes</div>
                <div className="fx-stat-icon" style={{ color: 'var(--fx-alta)', background: 'rgba(255,84,0,0.1)' }}><StatIcon name="pendentes" /></div>
              </div>
              <div className="fx-stat-value">{pendentes.length}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-orange)' }}>
              <div className="fx-stat-card-top">
                <div className="fx-stat-label">Em andamento</div>
                <div className="fx-stat-icon" style={{ color: 'var(--fx-orange)', background: 'rgba(255,84,0,0.1)' }}><StatIcon name="andamento" /></div>
              </div>
              <div className="fx-stat-value">{emAndamento.length}</div>
            </div>
            <div className="fx-stat-card" style={{ '--accent': 'var(--fx-baixa)' }}>
              <div className="fx-stat-card-top">
                <div className="fx-stat-label">Concluídas</div>
                <div className="fx-stat-icon" style={{ color: 'var(--fx-baixa)', background: 'rgba(31,169,113,0.1)' }}><StatIcon name="concluidas" /></div>
              </div>
              <div className="fx-stat-value">{concluidas.length}</div>
            </div>
          </div>

          <div className="fx-dash-grid">
            <div className="fx-panel fx-panel-pad">
              <h3 style={{ marginBottom: 16 }}>Produtividade por status</h3>
              {tarefas.length === 0 ? (
                <div className="fx-empty"><strong>Sem tarefas neste escopo</strong>Selecione outro grupo ou crie uma tarefa.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--fx-line)" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 12, fill: '#6b7094' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7094' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,69,0.04)' }} contentStyle={{ borderRadius: 10, border: '1px solid var(--fx-line)' }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#000045" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="fx-panel fx-panel-pad">
              <h3 style={{ marginBottom: 16 }}>Próximos vencimentos</h3>
              {proximas.length === 0 && <div className="fx-empty"><strong>Tudo em dia</strong>Nenhuma tarefa com prazo marcado.</div>}
              <ul className="fx-upcoming">
                {proximas.map((t) => (
                  <li key={t.id}>
                    <span className={`fx-dot fx-dot--${PRIORIDADE_LABEL[t.prioridade] || 'normal'}`} />
                    <div>
                      <strong>{t.titulo}</strong>
                      <small>{new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</small>
                    </div>
                    <span className={`fx-pill fx-pill--${PRIORIDADE_LABEL[t.prioridade] || 'normal'}`}>{t.prioridade}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Nova seção: Tarefas Vencidas */}
          {vencidas.length > 0 && (
            <div className="fx-panel fx-panel-pad" style={{ marginTop: 24, borderColor: 'var(--fx-alta)' }}>
              <h3 style={{ marginBottom: 16, color: 'var(--fx-alta)' }}>
                ⚠️ Tarefas vencidas ({vencidas.length})
              </h3>
              <ul className="fx-upcoming">
                {vencidas.map((t) => (
                  <li key={t.id} style={{ backgroundColor: 'rgba(255,84,0,0.05)', borderRadius: 8, padding: '8px 12px' }}>
                    <span className={`fx-dot fx-dot--${PRIORIDADE_LABEL[t.prioridade] || 'normal'}`} />
                    <div>
                      <strong>{t.titulo}</strong>
                      <small style={{ color: 'var(--fx-alta)' }}>
                        Venceu em {new Date(t.data_vencimento).toLocaleDateString('pt-BR')}
                      </small>
                    </div>
                    <span className={`fx-pill fx-pill--${PRIORIDADE_LABEL[t.prioridade] || 'normal'}`}>{t.prioridade}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}

function statusNome(tarefa, statusList) {
  return statusList.find((s) => s.id === tarefa.status_id)?.nome
}
function isConcluidoName(tarefa, statusList) {
  return /conclu/i.test(statusNome(tarefa, statusList) || '')
}