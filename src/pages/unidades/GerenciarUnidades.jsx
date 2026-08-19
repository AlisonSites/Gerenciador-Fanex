import { useEffect, useState } from 'react'
import { listarUnidades, criarUnidade, atualizarUnidade, excluirUnidade } from '../../lib/unidades'
import { registrarAuditoria } from '../../lib/auditoria'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

export default function GerenciarUnidades() {
  const { refresh, temPermissao } = useAuth()
  // "ver_unidades" dá acesso somente leitura à tela; "gerenciar_unidades"
  // libera criar/editar; "excluir_unidades" é exigida separadamente para excluir.
  const podeEditar = temPermissao('gerenciar_unidades')
  const podeExcluir = temPermissao('excluir_unidades')
  const [unidades, setUnidades] = useState([])
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [editId, setEditId] = useState(null)
  const [excluirId, setExcluirId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = async () => {
    try {
      const data = await listarUnidades()
      setUnidades(data)
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar as unidades.')
    }
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    if (!podeEditar) return
    setErro('')
    setSalvando(true)
    try {
      if (editId) {
        await atualizarUnidade(editId, { nome, status })
        registrarAuditoria({ acao: 'editar', modulo: 'Unidades', descricao: `Editou a unidade "${nome}"` })
      } else {
        await criarUnidade({ nome, status })
        registrarAuditoria({ acao: 'criar', modulo: 'Unidades', descricao: `Criou a unidade "${nome}"` })
      }
      setNome('')
      setStatus('Ativo')
      setEditId(null)
      await carregar()
      // A lista de unidades disponíveis no seletor do cabeçalho pode ter mudado.
      await refresh()
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a unidade.')
    } finally {
      setSalvando(false)
    }
  }

  const editar = (u) => {
    setEditId(u.id)
    setNome(u.nome)
    setStatus(u.status || 'Ativo')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => {
    setEditId(null)
    setNome('')
    setStatus('Ativo')
  }

  const excluir = async () => {
    if (!podeExcluir) return
    setErro('')
    const unidadeAlvo = unidades.find((u) => u.id === excluirId)
    try {
      await excluirUnidade(excluirId)
      registrarAuditoria({ acao: 'excluir', modulo: 'Unidades', descricao: `Excluiu a unidade "${unidadeAlvo?.nome || excluirId}"` })
      setExcluirId(null)
      await carregar()
      await refresh()
    } catch (err) {
      setErro(err.message || 'Não foi possível excluir a unidade. Verifique se ainda há usuários ou registros vinculados a ela.')
      setExcluirId(null)
    }
  }

  return (
    <Layout title="Unidades">
      <div className="fx-page-head">
        <div>
          <h1>{podeEditar ? (editId ? 'Editar unidade' : 'Nova unidade') : 'Unidades'}</h1>
          <p>{podeEditar
            ? 'Cada usuário só acessa (e só cria dados em) as unidades às quais está vinculado. O Administrador acessa todas.'
            : 'Você tem acesso apenas para visualizar as unidades cadastradas.'}</p>
        </div>
      </div>

      {podeEditar && (
        <div className="fx-panel fx-panel-pad" style={{ marginBottom: 24 }}>
          <form onSubmit={salvar} className="fx-form-grid">
            <label className="fx-field-group">
              <span>Nome da unidade</span>
              <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Matriz, Filial Sul..." />
            </label>
            <label className="fx-field-group">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </label>

            {erro && <div className="fx-error" style={{ gridColumn: '1 / -1' }}>{erro}</div>}

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button className="fx-btn fx-btn-primary" type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar unidade'}
              </button>
              {editId && <button type="button" className="fx-btn fx-btn-ghost" onClick={cancelar}>Cancelar</button>}
            </div>
          </form>
        </div>
      )}

      <div className="fx-panel">
        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome}</strong></td>
                  <td><span className={`fx-pill fx-pill--${u.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{u.status}</span></td>
                  <td>
                    {(podeEditar || podeExcluir) && (
                      <div className="fx-table-actions">
                        {podeEditar && <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => editar(u)}>Editar</button>}
                        {podeExcluir && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => setExcluirId(u.id)}>Excluir</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {unidades.length === 0 && <div className="fx-empty"><strong>Nenhuma unidade cadastrada</strong>Crie a primeira unidade acima.</div>}
        </div>
      </div>

      {excluirId && (
        <ConfirmModal
          title="Excluir unidade"
          message="Usuários e registros vinculados a esta unidade perdem esse vínculo (não são excluídos). Esta ação não pode ser desfeita."
          onConfirm={excluir}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </Layout>
  )
}
