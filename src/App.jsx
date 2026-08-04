import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tarefas from './pages/Tarefas'
import CriarUsuario from './pages/usuarios/CriarUsuario'
import GerenciarUsuarios from './pages/usuarios/GerenciarUsuarios'
import CriarPerfil from './pages/perfis/CriarPerfil'
import GerenciarPerfis from './pages/perfis/GerenciarPerfis'
import CriarGrupo from './pages/grupos/CriarGrupo'
import GerenciarGrupos from './pages/grupos/GerenciarGrupos'
import RelatorioPessoal from './pages/relatorios/RelatorioPessoal'
import RelatorioCalendario from './pages/relatorios/RelatorioCalendario'
import CalendarioMarketing from './pages/calendario/CalendarioMarketing'
import CalendarioPostagem from './pages/calendario/CalendarioPostagem'
import GerenciarUnidades from './pages/unidades/GerenciarUnidades'
import LogErros from './pages/logs/LogErros'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={<ProtectedRoute permissao="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/tarefas" element={<ProtectedRoute permissao="criar_tarefas"><Tarefas /></ProtectedRoute>} />

          <Route path="/usuarios/criar" element={<ProtectedRoute permissao="criar_usuarios"><CriarUsuario /></ProtectedRoute>} />
          <Route path="/usuarios/gerenciar" element={<ProtectedRoute permissao={['ver_usuarios', 'gerenciar_usuarios']} allowRoles={['Coordenador']}><GerenciarUsuarios /></ProtectedRoute>} />

          <Route path="/perfis/criar" element={<ProtectedRoute permissao="criar_perfis"><CriarPerfil /></ProtectedRoute>} />
          <Route path="/perfis/gerenciar" element={<ProtectedRoute permissao={['ver_perfis', 'gerenciar_perfis']}><GerenciarPerfis /></ProtectedRoute>} />

          <Route path="/unidades" element={<ProtectedRoute permissao={['ver_unidades', 'gerenciar_unidades']}><GerenciarUnidades /></ProtectedRoute>} />

          <Route path="/grupos/criar" element={<ProtectedRoute permissao="criar_grupos"><CriarGrupo /></ProtectedRoute>} />
          <Route path="/grupos/gerenciar" element={<ProtectedRoute permissao={['ver_grupos', 'gerenciar_grupos']} allowRoles={['Coordenador']}><GerenciarGrupos /></ProtectedRoute>} />

          <Route path="/relatorios/pessoal" element={<ProtectedRoute permissao="relatorio_pessoal"><RelatorioPessoal /></ProtectedRoute>} />
          <Route path="/relatorios/calendario" element={<ProtectedRoute permissao="relatorio_calendario"><RelatorioCalendario /></ProtectedRoute>} />

          <Route path="/calendario/marketing" element={<ProtectedRoute permissao="calendario_marketing"><CalendarioMarketing /></ProtectedRoute>} />
          <Route path="/calendario/postagem" element={<ProtectedRoute permissao="calendario_postagem"><CalendarioPostagem /></ProtectedRoute>} />

          <Route path="/logs" element={<ProtectedRoute permissao="ver_logs_erros"><LogErros /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
