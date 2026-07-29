import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function isConcluidoNome(nome) {
  return /conclu/i.test(nome || '')
}

export default function Header({ title, onMenuClick }) {
  const { usuario, perfil, logout, isColaborador, unidades, unidadeAtual, trocarUnidade } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const [unidadeOpen, setUnidadeOpen] = useState(false)
  const popRef = useRef(null)
  const unidadeRef = useRef(null)

  const carregar = useCallback(async () => {
    if (!usuario) return
    const { data: statusData } = await supabase.from('status_tarefas').select('id, nome')
    const idsConcluidos = new Set((statusData || []).filter((s) => isConcluidoNome(s.nome)).map((s) => s.id))
    const hoje = new Date().toISOString().slice(0, 10)

    let query = supabase
      .from('tarefas')
      .select('id, titulo, prioridade, data_vencimento, lida, status_id')
      .order('data_vencimento', { ascending: true, nullsFirst: false })
      .limit(50)

    if (isColaborador) {
      query = query.eq('usuario_id', usuario.id)
    }

    const { data } = await query
    const todas = data || []

    // Não lidas (novas) + atrasadas (prazo vencido e ainda não concluídas), mescladas sem duplicar.
    const mapa = new Map()
    todas.forEach((t) => {
      const concluida = idsConcluidos.has(t.status_id)
      const atrasada = !concluida && !!t.data_vencimento && t.data_vencimento < hoje
      if (!t.lida || atrasada) {
        mapa.set(t.id, { ...t, atrasada })
      }
    })

    const lista = [...mapa.values()].sort((a, b) => {
      if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1
      return 0
    })
    setNotifs(lista)
  }, [usuario, isColaborador])

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('tarefas-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [carregar])

  useEffect(() => {
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false)
      if (unidadeRef.current && !unidadeRef.current.contains(e.target)) setUnidadeOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const marcarLida = async (id) => {
    await supabase.from('tarefas').update({ lida: true }).eq('id', id)
    setNotifs((prev) => prev.filter((n) => n.id !== id || n.atrasada))
  }

  const marcarTodasLidas = async () => {
    const ids = notifs.filter((n) => !n.atrasada).map((n) => n.id)
    if (!ids.length) return
    await supabase.from('tarefas').update({ lida: true }).in('id', ids)
    setNotifs((prev) => prev.filter((n) => n.atrasada))
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const iniciais = (usuario?.nome_completo || perfil?.nome || 'U')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <header className="fx-header">
      <div className="fx-header-left">
        <button className="fx-icon-btn fx-menu-btn" onClick={onMenuClick} aria-label="Abrir menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="fx-header-title">{title}</h2>
      </div>

      <div className="fx-header-right">
        {unidades.length > 0 && (
          <div className="fx-notif" ref={unidadeRef}>
            <button
              className="fx-btn fx-btn-ghost fx-btn-sm"
              onClick={() => setUnidadeOpen((o) => !o)}
              disabled={unidades.length < 2}
              title={unidades.length < 2 ? 'Você só tem acesso a esta unidade' : 'Trocar de unidade'}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
              </svg>
              {unidadeAtual?.nome || 'Selecione a unidade'}
              {unidades.length > 1 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              )}
            </button>

            {unidadeOpen && unidades.length > 1 && (
              <div className="fx-notif-pop" style={{ width: 240 }}>
                <div className="fx-notif-pop-head">
                  <span>Trocar unidade</span>
                </div>
                <div className="fx-notif-list fx-scrollbar">
                  {unidades.map((u) => (
                    <button
                      key={u.id}
                      className="fx-notif-item"
                      style={{ width: '100%', border: 'none', background: u.id === unidadeAtual?.id ? 'rgba(0,0,69,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => { trocarUnidade(u.id); setUnidadeOpen(false) }}
                    >
                      <div className="fx-notif-item-body">
                        <strong>{u.nome}</strong>
                      </div>
                      {u.id === unidadeAtual?.id && <span className="fx-pill fx-pill--ativo">Atual</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="fx-notif" ref={popRef}>
          <button className="fx-icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Notificações">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {notifs.length > 0 && <span className="fx-notif-count">{notifs.length}</span>}
          </button>

          {open && (
            <div className="fx-notif-pop">
              <div className="fx-notif-pop-head">
                <span>Tarefas pendentes</span>
                {notifs.length > 0 && (
                  <button className="fx-link-btn" onClick={marcarTodasLidas}>Marcar todas como lidas</button>
                )}
              </div>
              <div className="fx-notif-list fx-scrollbar">
                {notifs.length === 0 && <div className="fx-notif-empty">Nenhuma notificação nova.</div>}
                {notifs.map((n) => (
                  <div className={`fx-notif-item ${n.atrasada ? 'fx-notif-item--atrasada' : ''}`} key={n.id}>
                    <span className={`fx-dot fx-dot--${n.prioridade?.toLowerCase()}`} />
                    <div className="fx-notif-item-body">
                      <strong>{n.titulo}</strong>
                      <small>{n.data_vencimento ? new Date(n.data_vencimento).toLocaleDateString('pt-BR') : 'Sem prazo'}</small>
                    </div>
                    {n.atrasada ? (
                      <span className="fx-pill fx-pill--urgente">Atrasada</span>
                    ) : (
                      <button className="fx-link-btn" onClick={() => marcarLida(n.id)}>Lida</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="fx-user">
          <div className="fx-avatar">{iniciais}</div>
          <div className="fx-user-info">
            <strong>{usuario?.nome_completo || 'Usuário'}</strong>
            <small>{perfil?.nome || '—'}</small>
          </div>
        </div>

        <button className="fx-btn fx-btn-ghost" onClick={handleLogout}>Sair</button>
      </div>
    </header>
  )
}
