import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const CHAVE_UNIDADE_ATUAL = 'fanex.unidadeAtualId'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null) // linha da tabela `usuarios`
  const [perfil, setPerfil] = useState(null) // linha da tabela `perfis_acesso`
  const [unidades, setUnidades] = useState([]) // unidades que o usuário pode acessar
  const [unidadeAtual, setUnidadeAtualState] = useState(null) // unidade selecionada no momento
  const [loading, setLoading] = useState(true)

  const setUnidadeAtual = useCallback((unidade) => {
    setUnidadeAtualState(unidade)
    if (unidade?.id) {
      localStorage.setItem(CHAVE_UNIDADE_ATUAL, unidade.id)
    } else {
      localStorage.removeItem(CHAVE_UNIDADE_ATUAL)
    }
  }, [])

  const trocarUnidade = useCallback((unidadeId) => {
    setUnidades((listaAtual) => {
      const alvo = listaAtual.find((u) => u.id === unidadeId)
      if (alvo) setUnidadeAtual(alvo)
      return listaAtual
    })
  }, [setUnidadeAtual])

  const carregarUnidades = useCallback(async (usuarioRow, perfilRow) => {
    if (!usuarioRow) {
      setUnidades([])
      setUnidadeAtual(null)
      return
    }

    let listaUnidades = []
    if (perfilRow?.nome === 'Administrador') {
      // Administrador enxerga e pode operar em todas as unidades ativas.
      const { data } = await supabase.from('unidades').select('*').eq('status', 'Ativo').order('nome')
      listaUnidades = data || []
    } else {
      const { data } = await supabase
        .from('usuario_unidades')
        .select('unidades(*)')
        .eq('usuario_id', usuarioRow.id)
      listaUnidades = (data || [])
        .map((row) => row.unidades)
        .filter((u) => u && u.status === 'Ativo')
        .sort((a, b) => a.nome.localeCompare(b.nome))
    }

    setUnidades(listaUnidades)

    const idSalvo = localStorage.getItem(CHAVE_UNIDADE_ATUAL)
    const unidadeSalva = listaUnidades.find((u) => u.id === idSalvo)
    setUnidadeAtual(unidadeSalva || listaUnidades[0] || null)
  }, [setUnidadeAtual])

  const carregarPerfilCompleto = useCallback(async (session) => {
    if (!session?.user) {
      setUsuario(null)
      setPerfil(null)
      setUnidades([])
      setUnidadeAtual(null)
      return
    }
    const { data: usuarioRow } = await supabase
      .from('usuarios')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    setUsuario(usuarioRow || null)

    let perfilRow = null
    if (usuarioRow?.perfil_id) {
      const { data } = await supabase
        .from('perfis_acesso')
        .select('*')
        .eq('id', usuarioRow.perfil_id)
        .maybeSingle()
      perfilRow = data || null
    }
    setPerfil(perfilRow)

    await carregarUnidades(usuarioRow, perfilRow)
  }, [carregarUnidades, setUnidadeAtual])

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
    localStorage.removeItem(CHAVE_UNIDADE_ATUAL)
  }

  // Aceita uma chave única ('gerenciar_usuarios') ou uma lista de chaves
  // (['ver_usuarios', 'gerenciar_usuarios']), liberando o acesso se o perfil
  // tiver QUALQUER uma delas. Isso permite, por exemplo, dar acesso de
  // "somente ver" a uma tela para quem tem só a permissão `ver_*`.
  const temPermissao = (chave) => {
    if (!perfil) return false
    if (perfil.nome === 'Administrador') return true
    if (Array.isArray(chave)) return chave.some((c) => !!perfil.permissoes?.[c])
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
    // Unidades: lista de unidades que o usuário logado pode acessar
    // (todas, se Administrador) e a unidade selecionada no momento.
    unidades,
    unidadeAtual,
    trocarUnidade,
    refresh: () => carregarPerfilCompleto(session),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
