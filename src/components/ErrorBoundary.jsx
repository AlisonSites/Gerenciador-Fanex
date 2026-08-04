import { Component } from 'react'
import { registrarErro } from '../lib/logs'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { comErro: false }
  }

  static getDerivedStateFromError() {
    return { comErro: true }
  }

  componentDidCatch(error, info) {
    registrarErro({
      origem: 'react-error-boundary',
      mensagem: error?.message || String(error),
      detalhes: { stack: error?.stack, componentStack: info?.componentStack },
    })
  }

  render() {
    if (this.state.comErro) {
      return (
        <div className="fx-loading-screen" style={{ flexDirection: 'column', gap: 12 }}>
          <h2 style={{ color: 'var(--fx-navy)', margin: 0 }}>Algo deu errado</h2>
          <p style={{ color: 'var(--fx-muted)', margin: 0 }}>
            O erro foi registrado. Tente recarregar a página.
          </p>
          <button className="fx-btn fx-btn-primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
