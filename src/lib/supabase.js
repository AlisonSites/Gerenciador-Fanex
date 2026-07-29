import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Nomes de todas as permissões possíveis, usadas nos módulos de Perfil de Acesso
export const PERMISSOES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'criar_tarefas', label: 'Criar Tarefas' },
  { key: 'gerenciar_tarefas', label: 'Gerenciar Tarefas' },
  { key: 'excluir_tarefas', label: 'Excluir Tarefas' },
  { key: 'gerenciar_colunas_tarefas', label: 'Gerenciar Colunas do Quadro (Kanban)' },
  { key: 'criar_usuarios', label: 'Criar Usuários' },
  { key: 'gerenciar_usuarios', label: 'Gerenciar Usuários' },
  { key: 'excluir_usuarios', label: 'Excluir Usuários' },
  { key: 'gerenciar_credenciais_usuarios', label: 'Trocar Senha/E-mail de Usuários' },
  { key: 'criar_grupos', label: 'Criar Grupos' },
  { key: 'gerenciar_grupos', label: 'Gerenciar Grupos' },
  { key: 'excluir_grupos', label: 'Excluir Grupos' },
  { key: 'criar_perfis', label: 'Criar Perfis' },
  { key: 'gerenciar_perfis', label: 'Gerenciar Perfis' },
  { key: 'excluir_perfis', label: 'Excluir Perfis' },
  { key: 'gerenciar_unidades', label: 'Gerenciar Unidades' },
  { key: 'relatorio_pessoal', label: 'Relatório por Pessoa' },
  { key: 'calendario_marketing', label: 'Calendário de Marketing' },
  { key: 'relatorio_calendario', label: 'Relatório do Calendário por Pessoa' },
  { key: 'exportar_relatorios', label: 'Exportar Relatórios (CSV)' },
  { key: 'ver_todas_tarefas', label: 'Ver Todas as Tarefas (não só as próprias)' },
  { key: 'calendario_postagem', label: 'Calendário de Postagem' },
  { key: 'criar_calendario_postagem', label: 'Criar Registros no Calendário de Postagem' },
  { key: 'ver_todas_postagens', label: 'Ver Todas as Postagens (não só as próprias)' },
  { key: 'configuracoes', label: 'Configurações do Sistema' },
]

export const NIVEL_ADMIN = 'Administrador'
export const NIVEL_COORDENADOR = 'Coordenador'
export const NIVEL_COLABORADOR = 'Colaborador'