import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null) // linha da tabela `usuarios`
  const [perfil, setPerfil] = useState(null) // linha da tabela `perfis_acesso`
  const [loading, setLoading] = useState(true)

  const carregarPerfilCompleto = useCallback(async (session) => {
    if (!session?.user) {
      setUsuario(null)
      setPerfil(null)
      return
    }
    const { data: usuarioRow } = await supabase
      .from('usuarios')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    setUsuario(usuarioRow || null)

    if (usuarioRow?.perfil_id) {
      const { data: perfilRow } = await supabase
        .from('perfis_acesso')
        .select('*')
        .eq('id', usuarioRow.perfil_id)
        .maybeSingle()
      setPerfil(perfilRow || null)
    } else {
      setPerfil(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      await carregarPerfilCompleto(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setLoading(true)
      await carregarPerfilCompleto(session)
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [carregarPerfilCompleto])

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const temPermissao = (chave) => {
    if (!perfil) return false
    if (perfil.nome === 'Administrador') return true
    return !!perfil.permissoes?.[chave]
  }

  const isAdmin = perfil?.nome === 'Administrador'
  const isCoordenador = perfil?.nome === 'Coordenador'
  const isColaborador = perfil?.nome === 'Colaborador'

  const value = {
    session,
    usuario,
    perfil,
    loading,
    login,
    logout,
    temPermissao,
    isAdmin,
    isCoordenador,
    isColaborador,
    refresh: () => carregarPerfilCompleto(session),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
