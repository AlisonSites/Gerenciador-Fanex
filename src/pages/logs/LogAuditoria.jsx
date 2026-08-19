import { useEffect, useMemo, useState } from 'react'
import { listarAuditoria, limparAuditoria, excluirRegistroAuditoria } from '../../lib/auditoria'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

const ACAO_LABEL = { criar: 'Criação', editar: 'Edição', excluir: 'Exclusão' }
const ACAO_PILL = { criar: 'ativo', editar: 'normal', excluir: 'urgente' }

function formatarData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export default function LogAuditoria() {
  const { temPermissao } = useAuth()
  const podeLimpar = temPermissao('excluir_auditoria')
  const [logs, setLogs] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false)
  const [limpando, setLimpando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      setLogs(await listarAuditoria())
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar o log de auditoria.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const modulos = useMemo(() => [...new Set(logs.map((l) => l.modulo).filter(Boolean))], [logs])

  const filtrados = logs.filter((l) => {
    if (filtroAcao && l.acao !== filtroAcao) return false
    if (filtroModulo && l.modulo !== filtroModulo) return false
    if (busca && !l.descricao?.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const removerUm = async (id) => {
    try {
      await excluirRegistroAuditoria(id)
      setLogs((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      window.alert('Não foi possível remover este registro: ' + err.message)
    }
  }

  const limparTudo = async () => {
    setLimpando(true)
    try {
      await limparAuditoria()
      setLogs([])
    } catch (err) {
      window.alert('Não foi possível limpar a auditoria: ' + err.message)
    } finally {
      setLimpando(false)
      setConfirmarLimpeza(false)
    }
  }

  return (
    <Layout title="Log de Auditoria">
      <div className="fx-page-head">
        <div>
          <h1>Log de Auditoria</h1>
          <p>Registro de quem criou, editou ou excluiu cada informação sensível do sistema (usuários, grupos, perfis, unidades e tarefas).</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="fx-btn fx-btn-ghost" onClick={carregar} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </button>
          {podeLimpar && logs.length > 0 && (
            <button className="fx-btn fx-btn-danger" onClick={() => setConfirmarLimpeza(true)}>
              Limpar auditoria
            </button>
          )}
        </div>
      </div>

      <div className="fx-panel" style={{ marginBottom: 24 }}>
        <div className="fx-toolbar">
          <div className="fx-search">
            <input placeholder="Buscar na descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="fx-select" value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)}>
            <option value="">Todas as ações</option>
            <option value="criar">Criação</option>
            <option value="editar">Edição</option>
            <option value="excluir">Exclusão</option>
          </select>
          <select className="fx-select" value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)}>
            <option value="">Todos os módulos</option>
            {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {erro && <div className="fx-error" style={{ margin: 16 }}>{erro}</div>}

        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Módulo</th>
                <th>Descrição</th>
                <th>Usuário</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id}>
                  <td className="fx-mono">{formatarData(l.created_at)}</td>
                  <td><span className={`fx-pill fx-pill--${ACAO_PILL[l.acao] || 'normal'}`}>{ACAO_LABEL[l.acao] || l.acao}</span></td>
                  <td>{l.modulo}</td>
                  <td style={{ maxWidth: 420 }}>{l.descricao}</td>
                  <td>{l.usuarios?.nome_completo || '—'}</td>
                  <td>
                    <div className="fx-table-actions">
                      {(l.dados_antes || l.dados_depois) && (
                        <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => setDetalhe(l)}>Detalhes</button>
                      )}
                      {podeLimpar && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => removerUm(l.id)}>Excluir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && filtrados.length === 0 && (
            <div className="fx-empty"><strong>Nenhum registro de auditoria</strong>Ações de criação, edição e exclusão vão aparecer aqui automaticamente.</div>
          )}
        </div>
      </div>

      {detalhe && (
        <div className="fx-modal-scrim" onClick={() => setDetalhe(null)}>
          <div className="fx-modal fx-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="fx-modal-head">
              <h3>Detalhes do registro</h3>
              <button className="fx-modal-close" onClick={() => setDetalhe(null)}>×</button>
            </div>
            <div className="fx-modal-body">
              <p><strong>Quando:</strong> {formatarData(detalhe.created_at)}</p>
              <p><strong>Módulo:</strong> {detalhe.modulo}</p>
              <p><strong>Usuário:</strong> {detalhe.usuarios?.nome_completo || '—'}</p>
              <p><strong>Descrição:</strong> {detalhe.descricao}</p>
              {detalhe.dados_antes && (
                <>
                  <strong>Antes</strong>
                  <pre className="fx-mono" style={{ whiteSpace: 'pre-wrap', background: 'var(--fx-bg)', padding: 12, borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(detalhe.dados_antes, null, 2)}
                  </pre>
                </>
              )}
              {detalhe.dados_depois && (
                <>
                  <strong>Depois</strong>
                  <pre className="fx-mono" style={{ whiteSpace: 'pre-wrap', background: 'var(--fx-bg)', padding: 12, borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(detalhe.dados_depois, null, 2)}
                  </pre>
                </>
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
          title="Limpar log de auditoria"
          message="Todos os registros de auditoria serão apagados permanentemente. Esta ação não pode ser desfeita."
          confirmLabel={limpando ? 'Limpando...' : 'Limpar tudo'}
          onConfirm={limparTudo}
          onCancel={() => setConfirmarLimpeza(false)}
        />
      )}
    </Layout>
  )
}
