import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { excluirUsuarioCompleto } from '../../lib/usuarios'
import { listarUnidadesAtivas, listarUnidadesDoUsuario, definirUnidadesDoUsuario } from '../../lib/unidades'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

export default function GerenciarUsuarios() {
  const { temPermissao, isAdmin } = useAuth()
  const podeEditar = temPermissao('gerenciar_usuarios')
  // Excluir usuário (remove cadastro + login) e trocar senha/e-mail de
  // outra pessoa agora são permissões próprias, separadas de
  // "gerenciar_usuarios". O Administrador sempre tem as duas.
  const podeExcluirUsuarios = temPermissao('excluir_usuarios')
  const podeGerenciarCredenciais = isAdmin || temPermissao('gerenciar_credenciais_usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('')
  const [excluirId, setExcluirId] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
  const [editando, setEditando] = useState(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [sucessoSenha, setSucessoSenha] = useState('')
  const [emailAtual, setEmailAtual] = useState('')
  const [carregandoEmail, setCarregandoEmail] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)
  const [erroEmail, setErroEmail] = useState('')
  const [sucessoEmail, setSucessoEmail] = useState('')
  const [perfis, setPerfis] = useState([])
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState([])
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState([])

  const carregar = async () => {
    const { data } = await supabase.from('usuarios').select('*, perfis_acesso(nome)').order('nome_completo')
    setUsuarios(data || [])
    const { data: p } = await supabase.from('perfis_acesso').select('*').order('nome')
    setPerfis(p || [])
    setUnidadesDisponiveis(await listarUnidadesAtivas())
  }

  useEffect(() => { carregar() }, [])

  const alternarUnidade = (unidadeId) => {
    setUnidadesSelecionadas((prev) =>
      prev.includes(unidadeId) ? prev.filter((id) => id !== unidadeId) : [...prev, unidadeId]
    )
  }



  const cargos = useMemo(() => [...new Set(usuarios.map((u) => u.cargo).filter(Boolean))], [usuarios])

  const filtrados = usuarios.filter((u) => {
    if (busca && !u.nome_completo.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroStatus && u.status !== filtroStatus) return false
    if (filtroCargo && u.cargo !== filtroCargo) return false
    return true
  })

  const alternarStatus = async (u) => {
    if (!podeEditar) return
    await supabase.from('usuarios').update({ status: u.status === 'Ativo' ? 'Inativo' : 'Ativo' }).eq('id', u.id)
    carregar()
  }

  const excluir = async () => {
    setErroExclusao('')
    setExcluindo(true)
    const resultado = await excluirUsuarioCompleto(excluirId)
    setExcluindo(false)
    if (!resultado.ok) {
      setErroExclusao(resultado.error)
      return
    }
    setExcluirId(null)
    if (resultado.aviso) window.alert(resultado.aviso)
    carregar()
  }

  const salvarEdicao = async (e) => {
    e.preventDefault()
    await supabase.from('usuarios').update({
      nome_completo: editando.nome_completo,
      cargo: editando.cargo,
      perfil_id: editando.perfil_id || null,
    }).eq('id', editando.id)
    await definirUnidadesDoUsuario(editando.id, unidadesSelecionadas)
    setEditando(null)
    carregar()
  }

  const abrirEdicao = async (u) => {
    setEditando(u)
    setNovaSenha('')
    setErroSenha('')
    setSucessoSenha('')
    setNovoEmail('')
    setErroEmail('')
    setSucessoEmail('')
    setEmailAtual('')

    const unidadesDoUsuario = await listarUnidadesDoUsuario(u.id)
    setUnidadesSelecionadas(unidadesDoUsuario.map((un) => un.id))

    if (!u.user_id) return
    setCarregandoEmail(true)
    const { data, error } = await supabase.functions.invoke('admin-obter-email', {
      body: { user_id: u.user_id },
    })
    setCarregandoEmail(false)
    if (!error && !data?.error) {
      setEmailAtual(data?.email || '')
    }
  }

  const trocarEmail = async () => {
    setErroEmail('')
    setSucessoEmail('')
    if (!editando?.user_id) {
      setErroEmail('Este usuário não tem uma conta de acesso vinculada (foi cadastrado sem e-mail/senha).')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
      setErroEmail('Informe um e-mail válido.')
      return
    }
    setSalvandoEmail(true)
    const { data, error } = await supabase.functions.invoke('admin-trocar-email', {
      body: { user_id: editando.user_id, novo_email: novoEmail },
    })
    setSalvandoEmail(false)
    if (error || data?.error) {
      setErroEmail(data?.error || error.message || 'Não foi possível trocar o e-mail. Confira se a função "admin-trocar-email" foi implantada no Supabase (veja o README).')
      return
    }
    setSucessoEmail('E-mail atualizado com sucesso.')
    setEmailAtual(novoEmail)
    setNovoEmail('')
  }

  const trocarSenha = async () => {
    setErroSenha('')
    setSucessoSenha('')
    if (!editando?.user_id) {
      setErroSenha('Este usuário não tem uma conta de acesso vinculada (foi cadastrado sem e-mail/senha).')
      return
    }
    if (novaSenha.length < 6) {
      setErroSenha('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setSalvandoSenha(true)
    const { data, error } = await supabase.functions.invoke('admin-trocar-senha', {
      body: { user_id: editando.user_id, nova_senha: novaSenha },
    })
    setSalvandoSenha(false)
    if (error || data?.error) {
      setErroSenha(data?.error || error.message || 'Não foi possível trocar a senha. Confira se a função "admin-trocar-senha" foi implantada no Supabase (veja o README).')
      return
    }
    setSucessoSenha('Senha atualizada com sucesso.')
    setNovaSenha('')
  }

  return (
    <Layout title="Gerenciar Usuários">
      <div className="fx-page-head">
        <div>
          <h1>Usuários</h1>
          <p>{podeEditar ? 'Edite, ative/inative ou remova usuários do sistema.' : 'Você tem acesso apenas para visualizar os usuários.'}</p>
        </div>
      </div>

      <div className="fx-panel">
        <div className="fx-toolbar">
          <div className="fx-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="fx-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
          <select className="fx-select" value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)}>
            <option value="">Todos os cargos</option>
            {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Perfil</th>
                <th>Status</th>
                {(podeGerenciarCredenciais || podeExcluirUsuarios) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome_completo}</strong></td>
                  <td>{u.cargo || '—'}</td>
                  <td>{u.perfis_acesso?.nome || '—'}</td>
                  <td>
                    <button
                      className={`fx-pill fx-pill--${u.status === 'Ativo' ? 'ativo' : 'inativo'}`}
                      style={{ border: 'none', cursor: podeEditar ? 'pointer' : 'default' }}
                      onClick={() => alternarStatus(u)}
                      disabled={!podeEditar}
                    >
                      {u.status}
                    </button>
                  </td>
                  {(podeGerenciarCredenciais || podeExcluirUsuarios) && (
                    <td>
                      <div className="fx-table-actions">
                        {podeGerenciarCredenciais && <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => abrirEdicao(u)}>Editar</button>}
                        {podeExcluirUsuarios && <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => { setErroExclusao(''); setExcluirId(u) }}>Excluir</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && <div className="fx-empty"><strong>Nenhum usuário encontrado</strong>Ajuste os filtros de busca.</div>}
        </div>
      </div>

      {editando && (
        <div className="fx-modal-scrim" onClick={() => setEditando(null)}>
          <div className="fx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fx-modal-head">
              <h3>Editar usuário</h3>
              <button className="fx-modal-close" onClick={() => setEditando(null)}>×</button>
            </div>
            <form onSubmit={salvarEdicao}>
              <div className="fx-modal-body">
                <label className="fx-field-group">
                  <span>Nome completo</span>
                  <input required value={editando.nome_completo} onChange={(e) => setEditando({ ...editando, nome_completo: e.target.value })} />
                </label>
                <label className="fx-field-group">
                  <span>Cargo</span>
                  <input value={editando.cargo || ''} onChange={(e) => setEditando({ ...editando, cargo: e.target.value })} />
                </label>
                <label className="fx-field-group">
                  <span>Perfil de acesso</span>
                  <select value={editando.perfil_id || ''} onChange={(e) => setEditando({ ...editando, perfil_id: e.target.value })}>
                    <option value="">Selecione um perfil</option>
                    {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </label>
                <label className="fx-field-group">
                  <span>Unidades</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                    {unidadesDisponiveis.length === 0 && (
                      <span style={{ fontSize: 13, color: 'var(--fx-muted)' }}>Nenhuma unidade cadastrada.</span>
                    )}
                    {unidadesDisponiveis.map((u) => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 400 }}>
                        <input
                          type="checkbox"
                          checked={unidadesSelecionadas.includes(u.id)}
                          onChange={() => alternarUnidade(u.id)}
                        />
                        {u.nome}
                      </label>
                    ))}
                  </div>
                </label>
              </div>
              <div className="fx-modal-foot">
                <button type="button" className="fx-btn fx-btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="fx-btn fx-btn-primary">Salvar</button>
              </div>
            </form>

            <div className="fx-modal-body" style={{ borderTop: '1px solid var(--fx-line)', paddingTop: 16 }}>
              <label className="fx-field-group">
                <span>Trocar e-mail de acesso</span>
                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder={carregandoEmail ? 'Carregando e-mail atual...' : (emailAtual ? `Atual: ${emailAtual}` : 'Novo e-mail')}
                />
              </label>
              {erroEmail && <div className="fx-error">{erroEmail}</div>}
              {sucessoEmail && <div className="fx-permission-note" style={{ borderColor: 'var(--fx-baixa)', color: 'var(--fx-baixa)' }}>{sucessoEmail}</div>}
              <div className="fx-modal-foot" style={{ padding: '14px 0 0' }}>
                <button type="button" className="fx-btn fx-btn-secondary" onClick={trocarEmail} disabled={salvandoEmail || !novoEmail}>
                  {salvandoEmail ? 'Trocando...' : 'Trocar e-mail'}
                </button>
              </div>
            </div>

            <div className="fx-modal-body" style={{ borderTop: '1px solid var(--fx-line)', paddingTop: 16 }}>
              <label className="fx-field-group">
                <span>Trocar senha de acesso</span>
                <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Nova senha (mínimo 6 caracteres)" />
              </label>
              {erroSenha && <div className="fx-error">{erroSenha}</div>}
              {sucessoSenha && <div className="fx-permission-note" style={{ borderColor: 'var(--fx-baixa)', color: 'var(--fx-baixa)' }}>{sucessoSenha}</div>}
              <div className="fx-modal-foot" style={{ padding: '14px 0 0' }}>
                <button type="button" className="fx-btn fx-btn-secondary" onClick={trocarSenha} disabled={salvandoSenha || !novaSenha}>
                  {salvandoSenha ? 'Trocando...' : 'Trocar senha'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {excluirId && (
        <ConfirmModal
          title="Excluir usuário"
          message={erroExclusao || `Tem certeza que deseja excluir "${excluirId.nome_completo}"? Isso remove o cadastro e a conta de acesso (login). Esta ação não pode ser desfeita.`}
          confirmLabel={excluindo ? 'Excluindo...' : 'Excluir'}
          onConfirm={excluir}
          onCancel={() => { setExcluirId(null); setErroExclusao('') }}
        />
      )}
    </Layout>
  )
}