import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Nomes de todas as permissões possíveis, usadas nos módulos de Perfil de Acesso
export const PERMISSOES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'criar_tarefas', label: 'Criar Tarefas' },
  { key: 'gerenciar_tarefas', label: 'Gerenciar Tarefas' },
  { key: 'criar_usuarios', label: 'Criar Usuários' },
  { key: 'gerenciar_usuarios', label: 'Gerenciar Usuários' },
  { key: 'criar_grupos', label: 'Criar Grupos' },
  { key: 'gerenciar_grupos', label: 'Gerenciar Grupos' },
  { key: 'criar_perfis', label: 'Criar Perfis' },
  { key: 'gerenciar_perfis', label: 'Gerenciar Perfis' },
  { key: 'relatorio_pessoal', label: 'Relatório por Pessoa' },
  { key: 'calendario_marketing', label: 'Calendário de Marketing' },
  { key: 'relatorio_calendario', label: 'Relatório do Calendário por Pessoa' },
  { key: 'configuracoes', label: 'Configurações do Sistema' },
]

export const NIVEL_ADMIN = 'Administrador'
export const NIVEL_COORDENADOR = 'Coordenador'
export const NIVEL_COLABORADOR = 'Colaborador'
