-- ==========================================================
-- FANEX - Correções de exclusão (cascatas e restrições)
-- ==========================================================
-- PROBLEMA QUE ISSO RESOLVE:
-- Várias tabelas referenciam outras via chave estrangeira sem
-- nenhuma cláusula "on delete" definida. O padrão do Postgres nesse
-- caso é bloquear a exclusão (erro de violação de chave estrangeira)
-- quando existem linhas dependentes — por exemplo, excluir um grupo
-- ou um usuário que ainda tem tarefas vinculadas.
--
-- Como o aplicativo não conferia o erro retornado pelo Supabase
-- nessas exclusões, o pedido de exclusão falhava silenciosamente:
-- a tela fechava o modal e recarregava a lista, dando a impressão
-- de que "excluiu só no aplicativo", mas o registro continuava
-- intacto no banco (e podia reaparecer, ou gerar números errados
-- no Dashboard).
--
-- Este script ajusta as chaves estrangeiras para um comportamento
-- coerente com o restante do sistema:
--   - Excluir um GRUPO agora exclui também as tarefas daquele grupo
--     (consistente com o Quadro de Tarefas, que é organizado por grupo).
--   - Excluir um USUÁRIO agora apenas desvincula o responsável das
--     tarefas dele (fica "Sem responsável"), em vez de bloquear a exclusão.
--   - Excluir um STATUS (coluna do quadro) continua bloqueado enquanto
--     houver tarefas nele — o app já avisa isso antes de tentar excluir.
--   - Excluir um PERFIL DE ACESSO continua bloqueado enquanto houver
--     usuários com aquele perfil.
--
-- Rode este script UMA VEZ no SQL Editor do Supabase.

alter table tarefas drop constraint if exists tarefas_usuario_id_fkey;
alter table tarefas
  add constraint tarefas_usuario_id_fkey
  foreign key (usuario_id) references usuarios(id) on delete set null;

alter table tarefas drop constraint if exists tarefas_grupo_id_fkey;
alter table tarefas
  add constraint tarefas_grupo_id_fkey
  foreign key (grupo_id) references grupos(id) on delete cascade;

alter table tarefas drop constraint if exists tarefas_status_id_fkey;
alter table tarefas
  add constraint tarefas_status_id_fkey
  foreign key (status_id) references status_tarefas(id) on delete restrict;

alter table usuarios drop constraint if exists usuarios_perfil_id_fkey;
alter table usuarios
  add constraint usuarios_perfil_id_fkey
  foreign key (perfil_id) references perfis_acesso(id) on delete restrict;
