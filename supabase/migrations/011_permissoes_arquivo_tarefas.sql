-- ==========================================================
-- FANEX - Permissões próprias para a página "Arquivo de Tarefas"
-- ==========================================================
-- Antes, a tela de Arquivo reaproveitava as permissões do Quadro de
-- Tarefas (criar_tarefas/gerenciar_tarefas/excluir_tarefas/etc).
-- Agora ela tem as próprias, configuráveis independente do quadro:
--
--   ver_arquivo_tarefas      -> acessar a página do Arquivo
--   editar_arquivo_tarefas   -> editar título/descrição/prioridade de
--                                uma tarefa já arquivada
--   excluir_arquivo_tarefas  -> excluir uma tarefa arquivada
--   comentar_arquivo_tarefas -> comentar numa tarefa arquivada
--   anexar_arquivo_tarefas   -> anexar arquivo numa tarefa arquivada
--
-- Valores padrão pra quem já tinha perfil antes desta migration,
-- pensados pra não travar ninguém que já devia ter acesso:
--   - ver_arquivo_tarefas herda de quem já podia ver o quadro
--     (ver_tarefas/criar_tarefas/gerenciar_tarefas).
--   - comentar/anexar herdam do valor equivalente no quadro.
--   - editar/excluir (ações mais sensíveis em registros já
--     concluídos) saem ligadas só pra Administrador e Coordenador;
--     demais perfis saem desligadas e podem ser ligadas depois em
--     "Gerenciar Perfis".
update perfis_acesso
set permissoes = permissoes || jsonb_build_object(
  'ver_arquivo_tarefas',
  coalesce((permissoes ->> 'ver_tarefas')::boolean, false)
    or coalesce((permissoes ->> 'criar_tarefas')::boolean, false)
    or coalesce((permissoes ->> 'gerenciar_tarefas')::boolean, false),
  'comentar_arquivo_tarefas',
  coalesce((permissoes ->> 'comentar_tarefas')::boolean, false),
  'anexar_arquivo_tarefas',
  coalesce((permissoes ->> 'anexar_arquivos_tarefas')::boolean, false)
)
where not (permissoes ? 'ver_arquivo_tarefas');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('editar_arquivo_tarefas', true, 'excluir_arquivo_tarefas', true)
where nome in ('Administrador', 'Coordenador');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('editar_arquivo_tarefas', false, 'excluir_arquivo_tarefas', false)
where nome not in ('Administrador', 'Coordenador')
  and not (permissoes ? 'editar_arquivo_tarefas');
