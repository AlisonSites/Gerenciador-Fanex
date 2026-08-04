import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registrarErro } from './lib/logs.js'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/ui.css'

// Captura erros de JavaScript não tratados em qualquer parte da aplicação
// (fora do ciclo de renderização do React, que é coberto pelo ErrorBoundary).
window.addEventListener('error', (event) => {
  registrarErro({
    origem: 'window.onerror',
    mensagem: event.message,
    detalhes: {
      stack: event.error?.stack,
      arquivo: event.filename,
      linha: event.lineno,
      coluna: event.colno,
    },
  })
})

// Captura promises rejeitadas sem .catch (ex.: falha de rede em uma chamada
// ao Supabase que não foi tratada localmente).
window.addEventListener('unhandledrejection', (event) => {
  registrarErro({
    origem: 'unhandledrejection',
    mensagem: event.reason?.message || String(event.reason),
    detalhes: { stack: event.reason?.stack },
  })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
