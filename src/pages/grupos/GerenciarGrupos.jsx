import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { registrarAuditoria } from '../../lib/auditoria'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import '../../styles/crud.css'
import '../../styles/grupos.css'

export default function GerenciarGrupos() {
  const { isAdmin, temPermissao } = useAuth()
  const podeGerenciarMembros = isAdmin || temPermissao('gerenciar_grupos')
  const [grupos, setGrupos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [membros, setMembros] = useState({}) // grupo_id -> [usuario]
  const [grupoAtivo, setGrupoAtivo] = useState(null)
  const [novoMembroId, setNovoMembroId] = useState('')

  const carregar = async () => {
    const { data: g } = await supabase.from('grupos').select('*').order('nome')
    setGrupos(g || [])
    const { data: u } = await supabase.from('usuarios').select('*').order('nome_completo')
    setUsuarios(u || [])

    const { data: gm } = await supabase.from('grupo_membros').select('grupo_id, usuarios(*)')
    const agrupado = {}
    ;(gm || []).forEach((row) => {
      if (!agrupado[row.grupo_id]) agrupado[row.grupo_id] = []
      if (row.usuarios) agrupado[row.grupo_id].push(row.usuarios)
    })
    setMembros(agrupado)
    if (g && g.length && !grupoAtivo) setGrupoAtivo(g[0].id)
  }

  useEffect(() => { carregar() }, [])

  const adicionarMembro = async () => {
    if (!podeGerenciarMembros || !novoMembroId || !grupoAtivo) return
    await supabase.from('grupo_membros').insert({ grupo_id: grupoAtivo, usuario_id: novoMembroId })
    const usuarioAlvo = usuarios.find((u) => u.id === novoMembroId)
    const grupoAlvo = grupos.find((g) => g.id === grupoAtivo)
    registrarAuditoria({ acao: 'editar', modulo: 'Grupos', descricao: `Adicionou "${usuarioAlvo?.nome_completo || novoMembroId}" ao grupo "${grupoAlvo?.nome || grupoAtivo}"` })
    setNovoMembroId('')
    carregar()
  }

  const removerMembro = async (usuarioId) => {
    if (!podeGerenciarMembros) return
    const { error } = await supabase.from('grupo_membros').delete().match({ grupo_id: grupoAtivo, usuario_id: usuarioId })
    if (error) {
      window.alert('Não foi possível remover este membro: ' + error.message)
      return
    }
    const usuarioAlvo = usuarios.find((u) => u.id === usuarioId)
    const grupoAlvo = grupos.find((g) => g.id === grupoAtivo)
    registrarAuditoria({ acao: 'editar', modulo: 'Grupos', descricao: `Removeu "${usuarioAlvo?.nome_completo || usuarioId}" do grupo "${grupoAlvo?.nome || grupoAtivo}"` })
    carregar()
  }

  const grupo = grupos.find((g) => g.id === grupoAtivo)
  const membrosDoGrupo = membros[grupoAtivo] || []
  const idsNoGrupo = new Set(membrosDoGrupo.map((m) => m.id))
  const disponiveis = usuarios.filter((u) => !idsNoGrupo.has(u.id))

  return (
    <Layout title="Gerenciar Grupos">
      <div className="fx-page-head">
        <div>
          <h1>Grupos por setor</h1>
          <p>{podeGerenciarMembros ? 'Adicione ou remova membros dos grupos.' : 'Modo somente visualização — você não tem permissão para alterar membros.'}</p>
        </div>
      </div>

      <div className="fx-grupos-grid">
        <div className="fx-panel">
          <div className="fx-grupos-list-head">Setores</div>
          <ul className="fx-grupos-list">
            {grupos.map((g) => (
              <li key={g.id}>
                <button
                  className={`fx-grupo-item ${grupoAtivo === g.id ? 'is-active' : ''}`}
                  onClick={() => setGrupoAtivo(g.id)}
                >
                  <span>{g.nome}</span>
                  <span className={`fx-pill fx-pill--${g.status === 'Ativo' ? 'ativo' : 'inativo'}`}>{g.status}</span>
                </button>
              </li>
            ))}
          </ul>
          {grupos.length === 0 && <div className="fx-empty"><strong>Nenhum grupo criado ainda</strong></div>}
        </div>

        <div className="fx-panel fx-panel-pad">
          {grupo ? (
            <>
              <h3 style={{ marginBottom: 4 }}>{grupo.nome}</h3>
              <p style={{ color: 'var(--fx-muted)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
                {membrosDoGrupo.length} membro(s)
              </p>

              {podeGerenciarMembros && (
                <div className="fx-grupo-add-row">
                  <select className="fx-select" value={novoMembroId} onChange={(e) => setNovoMembroId(e.target.value)}>
                    <option value="">Selecione um usuário para adicionar</option>
                    {disponiveis.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
                  </select>
                  <button className="fx-btn fx-btn-primary fx-btn-sm" onClick={adicionarMembro} disabled={!novoMembroId}>
                    Adicionar
                  </button>
                </div>
              )}

              {!podeGerenciarMembros && (
                <div className="fx-permission-note" style={{ marginBottom: 16 }}>
                  Você não tem permissão para adicionar ou remover membros deste grupo.
                </div>
              )}

              <div className="fx-membros-list">
                {membrosDoGrupo.map((m) => (
                  <div className="fx-membro-item" key={m.id}>
                    <div className="fx-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                      {m.nome_completo.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
                    </div>
                    <div className="fx-membro-info">
                      <strong>{m.nome_completo}</strong>
                      <small>{m.cargo || '—'}</small>
                    </div>
                    {podeGerenciarMembros && (
                      <button className="fx-btn fx-btn-ghost fx-btn-sm" onClick={() => removerMembro(m.id)}>Remover</button>
                    )}
                  </div>
                ))}
                {membrosDoGrupo.length === 0 && <div className="fx-empty"><strong>Nenhum membro</strong>Este grupo ainda não tem usuários vinculados.</div>}
              </div>
            </>
          ) : (
            <div className="fx-empty"><strong>Selecione um grupo</strong>Escolha um setor na lista ao lado.</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
