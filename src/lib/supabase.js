import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Nomes de todas as permissões possíveis, usadas nos módulos de Perfil de Acesso.
// Cada permissão pertence a um "grupo" (módulo do sistema), usado apenas para
// organizar a visualização na tela de Perfis de Acesso quando quem está
// olhando é o Administrador (ver `agruparPermissoes` mais abaixo).
//
// Convenção de granularidade adotada nos módulos de cadastro (Usuários,
// Grupos, Perfis, Unidades, Tarefas, Postagens):
//   ver_*       -> acesso somente leitura à tela (lista/consulta), sem poder
//                  criar, editar ou excluir nada.
//   criar_*     -> permite cadastrar novos registros.
//   gerenciar_* -> permite editar registros já existentes (inclui, na prática,
//                  o acesso de leitura da tela).
//   excluir_*   -> permite remover registros. Fica sempre separada de
//                  "gerenciar_*" para permitir perfis que editam mas não
//                  podem excluir.
export const PERMISSOES = [
  // Geral
  { key: 'dashboard', label: 'Ver Dashboard', grupo: 'Geral' },
  { key: 'configuracoes', label: 'Configurações do Sistema', grupo: 'Geral' },

  // Tarefas
  { key: 'criar_tarefas', label: 'Criar Tarefas', grupo: 'Tarefas' },
  { key: 'gerenciar_tarefas', label: 'Editar/Gerenciar Tarefas', grupo: 'Tarefas' },
  { key: 'excluir_tarefas', label: 'Excluir Tarefas', grupo: 'Tarefas' },
  { key: 'ver_todas_tarefas', label: 'Ver Todas as Tarefas (não só as próprias)', grupo: 'Tarefas' },
  { key: 'gerenciar_colunas_tarefas', label: 'Gerenciar Colunas do Quadro (Kanban)', grupo: 'Tarefas' },
  { key: 'definir_prioridade_tarefas', label: 'Definir Prioridade das Tarefas', grupo: 'Tarefas' },
  { key: 'etiquetar_tarefas', label: 'Adicionar/Editar Etiquetas em Tarefas', grupo: 'Tarefas' },
  { key: 'comentar_tarefas', label: 'Comentar em Tarefas', grupo: 'Tarefas' },
  { key: 'anexar_arquivos_tarefas', label: 'Anexar Arquivos em Tarefas', grupo: 'Tarefas' },
  { key: 'ver_tarefas_atrasadas_todos', label: 'Ver Tarefas Atrasadas de Todos', grupo: 'Tarefas' },

  // Usuários
  { key: 'ver_usuarios', label: 'Ver Usuários (somente leitura)', grupo: 'Usuários' },
  { key: 'criar_usuarios', label: 'Criar Usuários', grupo: 'Usuários' },
  { key: 'gerenciar_usuarios', label: 'Editar/Gerenciar Usuários', grupo: 'Usuários' },
  { key: 'excluir_usuarios', label: 'Excluir Usuários', grupo: 'Usuários' },
  { key: 'gerenciar_credenciais_usuarios', label: 'Trocar Senha/E-mail de Usuários', grupo: 'Usuários' },
  { key: 'inativar_usuarios', label: 'Inativar/Reativar Usuário', grupo: 'Usuários' },
  { key: 'ver_historico_usuario', label: 'Ver Histórico de Atividade do Usuário', grupo: 'Usuários' },
  { key: 'impersonar_usuario', label: 'Acessar o Sistema Como Outro Usuário (Suporte)', grupo: 'Usuários' },

  // Grupos / Setores
  { key: 'ver_grupos', label: 'Ver Grupos (somente leitura)', grupo: 'Grupos / Setores' },
  { key: 'criar_grupos', label: 'Criar Grupos', grupo: 'Grupos / Setores' },
  { key: 'gerenciar_grupos', label: 'Editar/Gerenciar Grupos (membros)', grupo: 'Grupos / Setores' },
  { key: 'excluir_grupos', label: 'Excluir Grupos', grupo: 'Grupos / Setores' },
  { key: 'transferir_membros_grupos', label: 'Transferir Membro entre Grupos', grupo: 'Grupos / Setores' },

  // Perfis de acesso
  { key: 'ver_perfis', label: 'Ver Perfis de Acesso (somente leitura)', grupo: 'Perfis de Acesso' },
  { key: 'criar_perfis', label: 'Criar Perfis', grupo: 'Perfis de Acesso' },
  { key: 'gerenciar_perfis', label: 'Editar/Gerenciar Perfis', grupo: 'Perfis de Acesso' },
  { key: 'excluir_perfis', label: 'Excluir Perfis', grupo: 'Perfis de Acesso' },

  // Unidades
  { key: 'ver_unidades', label: 'Ver Unidades (somente leitura)', grupo: 'Unidades' },
  { key: 'gerenciar_unidades', label: 'Criar/Editar Unidades', grupo: 'Unidades' },
  { key: 'excluir_unidades', label: 'Excluir Unidades', grupo: 'Unidades' },

  // Relatórios
  { key: 'relatorio_pessoal', label: 'Ver Relatório por Pessoa', grupo: 'Relatórios' },
  { key: 'relatorio_calendario', label: 'Ver Relatório do Calendário por Pessoa', grupo: 'Relatórios' },
  { key: 'relatorio_grupo', label: 'Ver Relatório por Grupo/Setor', grupo: 'Relatórios' },
  { key: 'relatorio_unidades', label: 'Ver Relatório Consolidado por Unidade', grupo: 'Relatórios' },
  { key: 'relatorio_produtividade_geral', label: 'Ver Relatório de Produtividade Geral', grupo: 'Relatórios' },
  { key: 'exportar_relatorios', label: 'Exportar Relatórios (CSV)', grupo: 'Relatórios' },
  { key: 'exportar_relatorios_pdf', label: 'Exportar Relatórios em PDF', grupo: 'Relatórios' },

  // Calendário de Marketing
  { key: 'calendario_marketing', label: 'Ver Calendário de Marketing', grupo: 'Calendário de Marketing' },

  // Calendário de Postagem
  { key: 'calendario_postagem', label: 'Ver Calendário de Postagem', grupo: 'Calendário de Postagem' },
  { key: 'criar_calendario_postagem', label: 'Criar Registros no Calendário de Postagem', grupo: 'Calendário de Postagem' },
  { key: 'ver_todas_postagens', label: 'Ver Todas as Postagens (não só as próprias)', grupo: 'Calendário de Postagem' },

  // Financeiro
  { key: 'ver_financeiro', label: 'Ver Financeiro', grupo: 'Financeiro' },
  { key: 'gerenciar_financeiro', label: 'Gerenciar Financeiro', grupo: 'Financeiro' },

  // Sistema / Log de erros / Auditoria
  { key: 'ver_logs_erros', label: 'Ver Log de Erros', grupo: 'Sistema' },
  { key: 'excluir_logs_erros', label: 'Limpar Log de Erros', grupo: 'Sistema' },
  { key: 'ver_auditoria', label: 'Ver Log de Auditoria', grupo: 'Sistema' },
  { key: 'excluir_auditoria', label: 'Limpar Log de Auditoria', grupo: 'Sistema' },
  { key: 'gerenciar_notificacoes', label: 'Configurar Notificações do Sistema', grupo: 'Sistema' },
]

// Ordem em que os grupos aparecem na tela de Perfis de Acesso.
export const ORDEM_GRUPOS_PERMISSOES = [
  'Geral',
  'Tarefas',
  'Calendário de Marketing',
  'Calendário de Postagem',
  'Usuários',
  'Grupos / Setores',
  'Perfis de Acesso',
  'Unidades',
  'Relatórios',
  'Financeiro',
  'Sistema',
]

// Agrupa a lista de permissões por módulo, respeitando ORDEM_GRUPOS_PERMISSOES.
// Usado apenas para exibição (ex.: tela de Perfis de Acesso para o Administrador).
export function agruparPermissoes(lista = PERMISSOES) {
  const porGrupo = new Map()
  lista.forEach((p) => {
    const grupo = p.grupo || 'Outros'
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, [])
    porGrupo.get(grupo).push(p)
  })
  const ordenados = ORDEM_GRUPOS_PERMISSOES.filter((g) => porGrupo.has(g))
  ;[...porGrupo.keys()].forEach((g) => { if (!ordenados.includes(g)) ordenados.push(g) })
  return ordenados.map((grupo) => ({ grupo, itens: porGrupo.get(grupo) }))
}

export const NIVEL_ADMIN = 'Administrador'
export const NIVEL_COORDENADOR = 'Coordenador'
export const NIVEL_COLABORADOR = 'Colaborador'