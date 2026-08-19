import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { registrarAuditoria } from '../../lib/auditoria'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

export default function CriarGrupo() {
  // Excluir um grupo já existente agora exige a permissão "excluir_grupos",
  // separada de "criar_grupos" (que só liberava criar/editar até então).
  const { temPermissao, unidades, unidadeAtual } = useAuth()
  const podeExcluir = temPermissao('excluir_grupos')
  const [grupos, setGrupos] = useState([])
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [unidadeId, setUnidadeId] = useState('')
  const [editId, setEditId] = useState(null)
  const [excluirId, setExcluirId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Ao trocar de unidade no cabeçalho (ou ao entrar na tela), o novo
  // grupo já nasce vinculado à unidade ativa.
  useEffect(() => {
    if (!editId) setUnidadeId(unidadeAtual?.id || '')
  }, [unidadeAtual, editId])

  const carregar = async () => {
    const { data } = await supabase.from('grupos').select('*').order('created_at', { ascending: false })
    setGrupos(data || [])
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    if (!unidadeId) {
      setErro('Selecione a unidade deste grupo.')
      return
    }
    setSalvando(true)
    try {
      if (editId) {
        const { error } = await supabase.from('grupos').update({ nome, status, unidade_id: unidadeId }).eq('id', editId)
        if (error) throw error
        registrarAuditoria({ acao: 'editar', modulo: 'Grupos', descricao: `Editou o grupo "${nome}"` })
      } else {
        const { error } = await supabase.from('grupos').insert({ nome, status, unidade_id: unidadeId })
        if (error) throw error
        registrarAuditoria({ acao: 'criar', modulo: 'Grupos', descricao: `Criou o grupo "${nome}"` })
      }
      setNome('')
      setStatus('Ativo')
      setUnidadeId(unidadeAtual?.id || '')
      setEditId(null)
      carregar()
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o grupo.')
    } finally {
      setSalvando(false)
    }
  }

  const editar = (g) => {
    setEditId(g.id)
    setNome(g.nome)
    setStatus(g.status)
    setUnidadeId(g.unidade_id || unidadeAtual?.id || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => {
    setEditId(null)
    setNome('')
    setStatus('Ativo')
    setUnidadeId(unidadeAtual?.id || '')
  }

  const excluir = async () => {
    const grupoAlvo = grupos.find((g) => g.id === excluirId)
    const { error } = await supabase.from('grupos').delete().eq('id', excluirId)
    setExcluirId(null)
    if (error) {
      window.alert('Não foi possível excluir o grupo: ' + error.message)
      return
    }
    registrarAuditoria({ acao: 'excluir', modulo: 'Grupos', descricao: `Excluiu o grupo "${grupoAlvo?.nome || excluirId}"` })
    carregar()
  }

  return (
    <Layout title="Criar Grupo por Setor">
      <div className="fx-page-head">
        <div>
          <h1>{editId ? 'Editar grupo' : 'Novo grupo / setor'}</h1>
          <p>Organize equipes por área para facilitar a distribuição de tarefas.</p>
        </div>
      </div>

      <div className="fx-panel fx-panel-pad" style={{ marginBottom: 24 }}>
        <form onSubmit={salvar} className="fx-form-grid">
          <label className="fx-field-group">
            <span>ID</span>
            <input value={editId ? editId.slice(0, 8) : 'gerado automaticamente'} disabled className="fx-mono" />
          </label>
          <label className="fx-field-group">
            <span>Nome do grupo / setor</span>
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Marketing" />
          </label>
          <label className="fx-field-group">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </label>
          <label className="fx-field-group">
            <span>Unidade</span>
            <select required value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Selecione a unidade</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>

          {erro && <div className="fx-error" style={{ gridColumn: '1 / -1' }}>{erro}</div>}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button className="fx-btn fx-btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar grupo'}
            </button>
            {editId && <button type="button" className="fx-btn fx-btn-ghost" onClick={cancelar}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="fx-panel">
        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Unidade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.nome}</strong></td>
                  <td>{unidades.find((u) => u.id === g.unidade_id)?.nome || '—'}</td>
                  <td><span className={`fx-pill fx-pill--${g.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{g.status}</span></td>
                  <td>
                    <div className="fx-table-actions">
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => editar(g)}>Editar</button>
                      {podeExcluir && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => setExcluirId(g.id)}>Excluir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {grupos.length === 0 && <div className="fx-empty"><strong>Nenhum grupo cadastrado</strong></div>}
        </div>
      </div>

      {excluirId && (
        <ConfirmModal
          title="Excluir grupo"
          message="Os membros vinculados serão desvinculados e as tarefas deste grupo também serão excluídas. Esta ação não pode ser desfeita."
          onConfirm={excluir}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </Layout>
  )
}