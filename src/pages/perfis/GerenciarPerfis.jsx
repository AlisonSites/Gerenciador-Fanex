import { useEffect, useState } from 'react'
import { supabase, PERMISSOES } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import PermissoesSeletor from '../../components/PermissoesSeletor'
import '../../styles/crud.css'

export default function GerenciarPerfis() {
  // Excluir um perfil de acesso já existente agora exige a permissão
  // "excluir_perfis", separada de "gerenciar_perfis". Quem só tem
  // "ver_perfis" enxerga a lista e pode abrir os detalhes, mas não edita.
  const { temPermissao, isAdmin } = useAuth()
  const podeEditar = temPermissao('gerenciar_perfis')
  const podeExcluir = temPermissao('excluir_perfis')
  const [perfis, setPerfis] = useState([])
  const [editando, setEditando] = useState(null)
  const [excluirId, setExcluirId] = useState(null)

  const carregar = async () => {
    const { data } = await supabase.from('perfis_acesso').select('*').order('nome')
    setPerfis(data || [])
  }

  useEffect(() => { carregar() }, [])

  const abrirEdicao = (p) => {
    setEditando({ ...p, permissoes: { ...p.permissoes } })
  }

  const alternarPermissao = (key) => {
    setEditando((prev) => ({ ...prev, permissoes: { ...prev.permissoes, [key]: !prev.permissoes[key] } }))
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!podeEditar) return
    await supabase.from('perfis_acesso').update({ nome: editando.nome, permissoes: editando.permissoes }).eq('id', editando.id)
    setEditando(null)
    carregar()
  }

  const excluir = async () => {
    const { error } = await supabase.from('perfis_acesso').delete().eq('id', excluirId)
    setExcluirId(null)
    if (error) {
      window.alert('Não foi possível excluir este perfil: provavelmente ainda há usuários vinculados a ele. Troque o perfil desses usuários antes de excluir.')
      return
    }
    carregar()
  }

  return (
    <Layout title="Gerenciar Perfis de Acesso">
      <div className="fx-page-head">
        <div>
          <h1>Perfis de acesso</h1>
          <p>{podeEditar ? 'Ajuste permissões de cada perfil a qualquer momento.' : 'Você tem acesso apenas para visualizar os perfis e suas permissões.'}</p>
        </div>
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
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => abrirEdicao(p)}>{podeEditar ? 'Editar permissões' : 'Ver permissões'}</button>
                      {podeExcluir && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => setExcluirId(p.id)}>Excluir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {perfis.length === 0 && <div className="fx-empty"><strong>Nenhum perfil cadastrado</strong></div>}
        </div>
      </div>

      {editando && (
        <div className="fx-modal-scrim" onClick={() => setEditando(null)}>
          <div className="fx-modal fx-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="fx-modal-head">
              <h3>{podeEditar ? 'Editar permissões' : 'Permissões do perfil'}</h3>
              <button className="fx-modal-close" onClick={() => setEditando(null)}>×</button>
            </div>
            <form onSubmit={salvar}>
              <div className="fx-modal-body">
                <label className="fx-field-group">
                  <span>Nome do perfil</span>
                  <input
                    required
                    value={editando.nome}
                    disabled={!podeEditar}
                    onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                  />
                </label>
                <PermissoesSeletor
                  permissoes={editando.permissoes}
                  onToggle={alternarPermissao}
                  agrupar={isAdmin}
                  somenteLeitura={!podeEditar}
                />
              </div>
              <div className="fx-modal-foot">
                <button type="button" className="fx-btn fx-btn-ghost" onClick={() => setEditando(null)}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
                {podeEditar && <button type="submit" className="fx-btn fx-btn-primary">Salvar alterações</button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {excluirId && (
        <ConfirmModal
          title="Excluir perfil"
          message="Esta ação não pode ser desfeita."
          onConfirm={excluir}
          onCancel={() => setExcluirId(null)}
        />
      )}
    </Layout>
  )
}