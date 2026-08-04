import { useEffect, useMemo, useState } from 'react'
import { listarLogs, limparLogs, excluirLog } from '../../lib/logs'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

const NIVEL_LABEL = { error: 'Erro', warning: 'Aviso', info: 'Info' }

function formatarData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export default function LogErros() {
  const { temPermissao } = useAuth()
  const podeLimpar = temPermissao('excluir_logs_erros')
  const [logs, setLogs] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false)
  const [limpando, setLimpando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      setLogs(await listarLogs())
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar o log de erros.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const origens = useMemo(() => [...new Set(logs.map((l) => l.origem).filter(Boolean))], [logs])

  const filtrados = logs.filter((l) => {
    if (filtroNivel && l.nivel !== filtroNivel) return false
    if (filtroOrigem && l.origem !== filtroOrigem) return false
    if (busca && !l.mensagem?.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const removerUm = async (id) => {
    try {
      await excluirLog(id)
      setLogs((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      window.alert('Não foi possível remover este registro: ' + err.message)
    }
  }

  const limparTudo = async () => {
    setLimpando(true)
    try {
      await limparLogs()
      setLogs([])
    } catch (err) {
      window.alert('Não foi possível limpar o log: ' + err.message)
    } finally {
      setLimpando(false)
      setConfirmarLimpeza(false)
    }
  }

  return (
    <Layout title="Log de Erros">
      <div className="fx-page-head">
        <div>
          <h1>Log de Erros</h1>
          <p>Erros capturados automaticamente na aplicação (JavaScript, promessas não tratadas e falhas de renderização).</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="fx-btn fx-btn-ghost" onClick={carregar} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </button>
          {podeLimpar && logs.length > 0 && (
            <button className="fx-btn fx-btn-danger" onClick={() => setConfirmarLimpeza(true)}>
              Limpar log
            </button>
          )}
        </div>
      </div>

      <div className="fx-panel" style={{ marginBottom: 24 }}>
        <div className="fx-toolbar">
          <div className="fx-search">
            <input placeholder="Buscar na mensagem..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="fx-select" value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)}>
            <option value="">Todos os níveis</option>
            <option value="error">Erro</option>
            <option value="warning">Aviso</option>
            <option value="info">Info</option>
          </select>
          <select className="fx-select" value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}>
            <option value="">Todas as origens</option>
            {origens.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {erro && <div className="fx-error" style={{ margin: 16 }}>{erro}</div>}

        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Nível</th>
                <th>Origem</th>
                <th>Mensagem</th>
                <th>Usuário</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id}>
                  <td className="fx-mono">{formatarData(l.created_at)}</td>
                  <td><span className={`fx-pill fx-pill--${l.nivel === 'error' ? 'urgente' : l.nivel === 'warning' ? 'alta' : 'normal'}`}>{NIVEL_LABEL[l.nivel] || l.nivel}</span></td>
                  <td>{l.origem || '—'}</td>
                  <td style={{ maxWidth: 420 }}>{l.mensagem}</td>
                  <td>{l.usuarios?.nome_completo || '—'}</td>
                  <td>
                    <div className="fx-table-actions">
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => setDetalhe(l)}>Detalhes</button>
                      {podeLimpar && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => removerUm(l.id)}>Excluir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && filtrados.length === 0 && (
            <div className="fx-empty"><strong>Nenhum erro registrado</strong>Ótimo sinal — nada por aqui até o momento.</div>
          )}
        </div>
      </div>

      {detalhe && (
        <div className="fx-modal-scrim" onClick={() => setDetalhe(null)}>
          <div className="fx-modal fx-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="fx-modal-head">
              <h3>Detalhes do erro</h3>
              <button className="fx-modal-close" onClick={() => setDetalhe(null)}>×</button>
            </div>
            <div className="fx-modal-body">
              <p><strong>Quando:</strong> {formatarData(detalhe.created_at)}</p>
              <p><strong>Origem:</strong> {detalhe.origem || '—'}</p>
              <p><strong>Página:</strong> {detalhe.pagina || '—'}</p>
              <p><strong>Usuário:</strong> {detalhe.usuarios?.nome_completo || '—'}</p>
              <p><strong>Mensagem:</strong> {detalhe.mensagem}</p>
              {detalhe.detalhes && (
                <pre className="fx-mono" style={{ whiteSpace: 'pre-wrap', background: 'var(--fx-bg)', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(detalhe.detalhes, null, 2)}
                </pre>
              )}
            </div>
            <div className="fx-modal-foot">
              <button className="fx-btn fx-btn-ghost" onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {confirmarLimpeza && (
        <ConfirmModal
          title="Limpar log de erros"
          message="Todos os registros do log serão apagados permanentemente. Esta ação não pode ser desfeita."
          confirmLabel={limpando ? 'Limpando...' : 'Limpar tudo'}
          onConfirm={limparTudo}
          onCancel={() => setConfirmarLimpeza(false)}
        />
      )}
    </Layout>
  )
}
