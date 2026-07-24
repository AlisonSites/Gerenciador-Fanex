import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, permissao, allowRoles = [] }) {
  const { session, loading, temPermissao, perfil } = useAuth()

  if (loading) {
    return (
      <div className="fx-loading-screen">
        <div className="fx-spinner" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  const liberadoPorPapel = perfil && allowRoles.includes(perfil.nome)
  const liberadoPorPermissao = !permissao || (perfil && temPermissao(permissao))

  if (perfil && !liberadoPorPapel && !liberadoPorPermissao) {
    return (
      <div className="fx-blocked">
        <h2>Acesso restrito</h2>
        <p>Seu perfil ({perfil.nome}) não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  return children
}
