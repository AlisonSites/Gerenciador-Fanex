-- ==========================================================
-- FANEX - Escopo de visibilidade próprio pro Arquivo de Tarefas
-- ==========================================================
-- Até aqui, "ver o arquivo de todo mundo" na tela de Arquivo estava
-- amarrado às permissões do Quadro de Tarefas (gerenciar_tarefas /
-- ver_todas_tarefas). Agora vira uma permissão própria do módulo:
--
--   ver_arquivo_tarefas       -> já existia: acessar a página, vendo
--                                 pelo menos as próprias tarefas arquivadas
--   ver_todos_arquivos_tarefas -> nova: vê o arquivo de todos os
--                                 usuários, não só o próprio
--
-- Pra ninguém perder acesso que já tinha: quem já enxergava o
-- arquivo de todo mundo (por ter gerenciar_tarefas ou
-- ver_todas_tarefas) continua enxergando, com o novo flag herdando
-- esse valor. Pode ser ajustado depois em "Gerenciar Perfis".
update perfis_acesso
set permissoes = permissoes || jsonb_build_object(
  'ver_todos_arquivos_tarefas',
  coalesce((permissoes ->> 'gerenciar_tarefas')::boolean, false)
    or coalesce((permissoes ->> 'ver_todas_tarefas')::boolean, false)
)
where not (permissoes ? 'ver_todos_arquivos_tarefas');
