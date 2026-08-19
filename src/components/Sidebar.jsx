import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../assets/logo-branco.png'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', perm: 'dashboard', icon: 'grid' },
  { to: '/tarefas', label: 'Quadro de Tarefas', perm: 'criar_tarefas', icon: 'board' },
  { to: '/calendario/marketing', label: 'Calendário de Marketing', perm: 'calendario_marketing', icon: 'calendar' },
  { to: '/calendario/postagem', label: 'Calendário de Postagem', perm: 'calendario_postagem', icon: 'calendar-chart' },
  { section: 'Pessoas' },
  { to: '/usuarios/criar', label: 'Criar Usuário', perm: 'criar_usuarios', icon: 'user-plus' },
  { to: '/usuarios/gerenciar', label: 'Gerenciar Usuários', perm: ['ver_usuarios', 'gerenciar_usuarios'], icon: 'users', fallbackView: true },
  { section: 'Setores' },
  { to: '/grupos/criar', label: 'Criar Grupo', perm: 'criar_grupos', icon: 'folder-plus' },
  { to: '/grupos/gerenciar', label: 'Gerenciar Grupos', perm: ['ver_grupos', 'gerenciar_grupos'], icon: 'folder', fallbackView: true },
  { section: 'Relatórios' },
  { to: '/relatorios/pessoal', label: 'Relatório por Pessoa', perm: 'relatorio_pessoal', icon: 'chart' },
  { to: '/relatorios/calendario', label: 'Relatório do Calendário', perm: 'relatorio_calendario', icon: 'calendar-chart' },
  { to: '/relatorios/unidades', label: 'Relatório por Unidade', perm: 'relatorio_unidades', icon: 'building' },
  { section: 'Acesso' },
  { to: '/perfis/criar', label: 'Criar Perfil', perm: 'criar_perfis', icon: 'shield-plus' },
  { to: '/perfis/gerenciar', label: 'Gerenciar Perfis', perm: ['ver_perfis', 'gerenciar_perfis'], icon: 'shield', fallbackView: true },
  { to: '/unidades', label: 'Unidades', perm: ['ver_unidades', 'gerenciar_unidades'], icon: 'building' },
  { section: 'Sistema' },
  { to: '/logs/erros', label: 'Log de Erros', perm: 'ver_logs_erros', icon: 'log' },
  { to: '/logs/auditoria', label: 'Log de Auditoria', perm: 'ver_auditoria', icon: 'audit' },
]

const ICONS = {
  grid: <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />,
  board: <path d="M4 4h16v16H4V4zm4 3v10m4-10v10m4-10v10" />,
  'user-plus': <path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M18 8v6m3-3h-6" />,
  users: <path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 8a4 4 0 010 7.75M23 21a6.5 6.5 0 00-5-6.32" />,
  'folder-plus': <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM12 12v4m-2-2h4" />,
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
  'shield-plus': <path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-4zM12 9v6m-3-3h6" />,
  shield: <path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-4z" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7" />,
  calendar: <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  'calendar-chart': <path d="M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM8 2v4m8-4v4M8 14v4m4-7v7m4-4v4" />,
  building: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M9 13h.01M15 9h.01M15 13h.01" />,
  log: <path d="M4 4h16v16H4V4zm3 5h10M7 12h10M7 15h6M4 4l4 4M4 8l4-4" />,
  audit: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  )
}

export default function Sidebar({ open, onClose }) {
  const { temPermissao, perfil } = useAuth()

  return (
    <>
      {open && <div className="fx-sidebar-scrim" onClick={onClose} />}
      <aside className={`fx-sidebar ${open ? 'is-open' : ''}`}>
        <div className="fx-logo fx-sidebar-logo">
          <div className="logo-principal">
            <img src={Logo} alt="" />
            <span>Gerenciador de tarefas</span>
          </div>
        </div>

        <nav className="fx-nav fx-scrollbar">
          {NAV.map((item, idx) => {
            if (item.section) {
              return <div className="fx-nav-section" key={`s-${idx}`}>{item.section}</div>
            }
            const liberadoPorPapel = item.fallbackView && perfil?.nome === 'Coordenador'
            if (item.perm && perfil && !temPermissao(item.perm) && !liberadoPorPapel) return null
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `fx-nav-item ${isActive ? 'is-active' : ''}`}
                onClick={onClose}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {perfil && (
          <div className="fx-sidebar-footer">
            <span className="fx-badge-perfil">{perfil.nome}</span>
          </div>
        )}
      </aside>
    </>
  )
}
