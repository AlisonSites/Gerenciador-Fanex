import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

export default function CriarGrupo() {
  const [grupos, setGrupos] = useState([])
  const [nome, setNome] = useState('')
  const [status, setStatus] = useState('Ativo')
  const [editId, setEditId] = useState(null)
  const [excluirId, setExcluirId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    const { data } = await supabase.from('grupos').select('*').order('created_at', { ascending: false })
    setGrupos(data || [])
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editId) {
        await supabase.from('grupos').update({ nome, status }).eq('id', editId)
      } else {
        await supabase.from('grupos').insert({ nome, status })
      }
      setNome('')
      setStatus('Ativo')
      setEditId(null)
      carregar()
    } finally {
      setSalvando(false)
    }
  }

  const editar = (g) => {
    setEditId(g.id)
    setNome(g.nome)
    setStatus(g.status)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => {
    setEditId(null)
    setNome('')
    setStatus('Ativo')
  }

  const excluir = async () => {
    const { error } = await supabase.from('grupos').delete().eq('id', excluirId)
    setExcluirId(null)
    if (error) {
      window.alert('Não foi possível excluir o grupo: ' + error.message)
      return
    }
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
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.nome}</strong></td>
                  <td><span className={`fx-pill fx-pill--${g.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{g.status}</span></td>
                  <td>
                    <div className="fx-table-actions">
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => editar(g)}>Editar</button>
                      <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => setExcluirId(g.id)}>Excluir</button>
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
