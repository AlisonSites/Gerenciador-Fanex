import { useEffect, useState } from 'react'
import { supabase, PERMISSOES } from '../../lib/supabase'
import { registrarAuditoria } from '../../lib/auditoria'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import PermissoesSeletor from '../../components/PermissoesSeletor'
import '../../styles/crud.css'

function permissoesVazias() {
  return Object.fromEntries(PERMISSOES.map((p) => [p.key, false]))
}

export default function CriarPerfil() {
  // Excluir um perfil de acesso já existente agora exige a permissão
  // "excluir_perfis", separada de "criar_perfis".
  const { temPermissao, isAdmin } = useAuth()
  const podeExcluir = temPermissao('excluir_perfis')
  const [perfis, setPerfis] = useState([])
  const [nome, setNome] = useState('')
  const [permissoes, setPermissoes] = useState(permissoesVazias())
  const [editId, setEditId] = useState(null)
  const [excluirId, setExcluirId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    const { data } = await supabase.from('perfis_acesso').select('*').order('created_at', { ascending: false })
    setPerfis(data || [])
  }

  useEffect(() => { carregar() }, [])

  const alternarPermissao = (key) => {
    setPermissoes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editId) {
        await supabase.from('perfis_acesso').update({ nome, permissoes }).eq('id', editId)
        registrarAuditoria({ acao: 'editar', modulo: 'Perfis', descricao: `Editou o perfil de acesso "${nome}"` })
      } else {
        await supabase.from('perfis_acesso').insert({ nome, permissoes })
        registrarAuditoria({ acao: 'criar', modulo: 'Perfis', descricao: `Criou o perfil de acesso "${nome}"` })
      }
      setNome('')
      setPermissoes(permissoesVazias())
      setEditId(null)
      carregar()
    } finally {
      setSalvando(false)
    }
  }

  const editar = (p) => {
    setEditId(p.id)
    setNome(p.nome)
    setPermissoes({ ...permissoesVazias(), ...p.permissoes })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => {
    setEditId(null)
    setNome('')
    setPermissoes(permissoesVazias())
  }

  const excluir = async () => {
    const perfilAlvo = perfis.find((p) => p.id === excluirId)
    const { error } = await supabase.from('perfis_acesso').delete().eq('id', excluirId)
    setExcluirId(null)
    if (error) {
      window.alert('Não foi possível excluir este perfil: provavelmente ainda há usuários vinculados a ele. Troque o perfil desses usuários antes de excluir.')
      return
    }
    registrarAuditoria({ acao: 'excluir', modulo: 'Perfis', descricao: `Excluiu o perfil de acesso "${perfilAlvo?.nome || excluirId}"` })
    carregar()
  }

  return (
    <Layout title="Criar Perfil de Acesso">
      <div className="fx-page-head">
        <div>
          <h1>{editId ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}</h1>
          <p>Defina um nome e marque as permissões que este perfil poderá usar.</p>
        </div>
      </div>

      <div className="fx-panel fx-panel-pad" style={{ marginBottom: 24 }}>
        <form onSubmit={salvar}>
          <div className="fx-form-grid" style={{ marginBottom: 18 }}>
            <label className="fx-field-group">
              <span>ID</span>
              <input value={editId ? editId.slice(0, 8) : 'gerado automaticamente'} disabled className="fx-mono" />
            </label>
            <label className="fx-field-group">
              <span>Nome do perfil</span>
              <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Supervisor de Vendas" />
            </label>
          </div>

          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fx-navy)', marginBottom: 10 }}>Permissões</span>
          <PermissoesSeletor permissoes={permissoes} onToggle={alternarPermissao} agrupar={isAdmin} />

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="fx-btn fx-btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar perfil'}
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
                <th>Permissões ativas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nome}</strong></td>
                  <td className="fx-mono">{Object.values(p.permissoes || {}).filter(Boolean).length} / {PERMISSOES.length}</td>
                  <td>
                    <div className="fx-table-actions">
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => editar(p)}>Editar</button>
                      {podeExcluir && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => setExcluirId(p.id)}>Excluir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {perfis.length === 0 && <div className="fx-empty"><strong>Nenhum perfil cadastrado</strong>Crie o primeiro perfil de acesso acima.</div>}
        </div>
      </div>

      {excluirId && (
        <ConfirmModal
          title="Excluir perfil"
          message="Usuários vinculados a este perfil perderão as permissões associadas."
          onConfirm={excluir}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </Layout>
  )
}