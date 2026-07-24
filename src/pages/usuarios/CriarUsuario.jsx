import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { excluirUsuarioCompleto } from '../../lib/usuarios'
import Layout from '../../components/Layout'
import ConfirmModal from '../../components/ConfirmModal'
import '../../styles/crud.css'

const VAZIO = { nome_completo: '', cargo: '', status: 'Ativo', perfil_id: '', email: '', senha: '' }

export default function CriarUsuario() {
  const [usuarios, setUsuarios] = useState([])
  const [perfis, setPerfis] = useState([])
  const [form, setForm] = useState(VAZIO)
  const [busca, setBusca] = useState('')
  const [editId, setEditId] = useState(null)
  const [excluirId, setExcluirId] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = async () => {
    const { data: u } = await supabase.from('usuarios').select('*, perfis_acesso(nome)').order('created_at', { ascending: false })
    setUsuarios(u || [])
    const { data: p } = await supabase.from('perfis_acesso').select('*').order('nome')
    setPerfis(p || [])
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      if (editId) {
        const { error } = await supabase
          .from('usuarios')
          .update({
            nome_completo: form.nome_completo,
            cargo: form.cargo,
            status: form.status,
            perfil_id: form.perfil_id || null,
          })
          .eq('id', editId)
        if (error) throw error
      } else {
        let userId = null
        if (form.email && form.senha) {
          // Guarda a sessão do admin: signUp() troca a sessão ativa do navegador
          // para o usuário recém-criado, o que "deslogaria" quem está cadastrando.
          const { data: { session: sessaoAdmin } } = await supabase.auth.getSession()

          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: form.email,
            password: form.senha,
          })

          // Restaura a sessão de quem está logado (admin/coordenador) imediatamente.
          if (sessaoAdmin) {
            await supabase.auth.setSession({
              access_token: sessaoAdmin.access_token,
              refresh_token: sessaoAdmin.refresh_token,
            })
          }

          if (authError) {
            if (/already registered|already exists/i.test(authError.message)) {
              throw new Error('Já existe uma conta com este e-mail.')
            }
            throw authError
          }
          userId = authData.user?.id || null
        }
        const { error } = await supabase.from('usuarios').insert({
          user_id: userId,
          nome_completo: form.nome_completo,
          cargo: form.cargo,
          status: form.status,
          perfil_id: form.perfil_id || null,
        })
        if (error) throw error
      }
      setForm(VAZIO)
      setEditId(null)
      carregar()
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o usuário.')
    } finally {
      setSalvando(false)
    }
  }

  const editar = (u) => {
    setEditId(u.id)
    setForm({
      nome_completo: u.nome_completo || '',
      cargo: u.cargo || '',
      status: u.status || 'Ativo',
      perfil_id: u.perfil_id || '',
      email: '',
      senha: '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicao = () => {
    setEditId(null)
    setForm(VAZIO)
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

  const filtrados = usuarios.filter((u) =>
    u.nome_completo.toLowerCase().includes(busca.toLowerCase()) ||
    (u.cargo || '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <Layout title="Criar Usuário">
      <div className="fx-page-head">
        <div>
          <h1>{editId ? 'Editar usuário' : 'Novo usuário'}</h1>
          <p>Cadastre pessoas e vincule um perfil de acesso.</p>
        </div>
      </div>

      <div className="fx-panel fx-panel-pad" style={{ marginBottom: 24 }}>
        <form onSubmit={salvar} className="fx-form-grid">
          <label className="fx-field-group">
            <span>ID</span>
            <input value={editId ? editId.slice(0, 8) : 'gerado automaticamente'} disabled className="fx-mono" />
          </label>

          <label className="fx-field-group">
            <span>Nome completo</span>
            <input required value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} placeholder="Ex.: Ana Beatriz Souza" />
          </label>

          <label className="fx-field-group">
            <span>Cargo</span>
            <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex.: Analista de Projetos" />
          </label>

          <label className="fx-field-group">
            <span>Status</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </label>

          <label className="fx-field-group">
            <span>Perfil de acesso</span>
            <select value={form.perfil_id} onChange={(e) => setForm({ ...form, perfil_id: e.target.value })}>
              <option value="">Selecione um perfil</option>
              {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>

          {!editId && (
            <>
              <label className="fx-field-group">
                <span>E-mail de acesso</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pessoa@empresa.com" />
              </label>
              <label className="fx-field-group">
                <span>Senha provisória</span>
                <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </label>
              <div className="fx-permission-note" style={{ gridColumn: '1 / -1' }}>
                Para a pessoa conseguir logar imediatamente após o cadastro, rode uma vez o script <code>supabase/migrations/003_auto_confirmar_email.sql</code> no SQL Editor do Supabase (confirma o e-mail automaticamente, sem precisar de link de confirmação).
              </div>
            </>
          )}

          {erro && <div className="fx-error" style={{ gridColumn: '1 / -1' }}>{erro}</div>}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button className="fx-btn fx-btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar usuário'}
            </button>
            {editId && <button type="button" className="fx-btn fx-btn-ghost" onClick={cancelarEdicao}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="fx-panel">
        <div className="fx-toolbar">
          <div className="fx-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input placeholder="Buscar por nome ou cargo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="fx-table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Perfil</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome_completo}</strong></td>
                  <td>{u.cargo || '—'}</td>
                  <td>{u.perfis_acesso?.nome || '—'}</td>
                  <td><span className={`fx-pill fx-pill--${u.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{u.status}</span></td>
                  <td>
                    <div className="fx-table-actions">
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => editar(u)}>Editar</button>
                      <button className="fx-btn fx-btn-danger fx-btn-sm" onClick={() => { setErroExclusao(''); setExcluirId(u) }}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && <div className="fx-empty"><strong>Nenhum usuário encontrado</strong>Ajuste a busca ou cadastre um novo usuário.</div>}
        </div>
      </div>

      {excluirId && (
        <ConfirmModal
          title="Excluir usuário"
          message={erroExclusao || `Tem certeza que deseja excluir "${excluirId.nome_completo}"? Isso remove o cadastro e a conta de acesso (login) — o usuário perde o acesso ao sistema. Esta ação não pode ser desfeita.`}
          confirmLabel={excluindo ? 'Excluindo...' : 'Excluir'}
          onConfirm={excluir}
          onCancel={() => { setExcluirId(null); setErroExclusao('') }}
        />
      )}
    </Layout>
  )
}
