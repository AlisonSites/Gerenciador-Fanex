import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/login.css'

export default function Login() {
  const { login, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fx-login">
      <div className="fx-login-brand">
        <div className="fx-logo fx-logo-lg">
          fane<span>x</span>
        </div>
        <p className="fx-login-tagline">Organize equipes, fluxos e prazos em um único quadro.</p>
        <div className="fx-login-marks">
          <span className="fx-mark fx-mark--baixa" />
          <span className="fx-mark fx-mark--normal" />
          <span className="fx-mark fx-mark--alta" />
          <span className="fx-mark fx-mark--urgente" />
        </div>
      </div>

      <div className="fx-login-panel">
        <form className="fx-login-form" onSubmit={handleSubmit}>
          <h1>Entrar</h1>
          <p className="fx-login-sub">Acesse sua conta para ver suas tarefas.</p>

          <label className="fx-field">
            <span>E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              autoComplete="email"
            />
          </label>

          <label className="fx-field">
            <span>Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="fx-error">{error}</div>}

          <button className="fx-btn fx-btn-primary fx-btn-block" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
