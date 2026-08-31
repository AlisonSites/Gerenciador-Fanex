-- ==========================================================
-- FANEX - Calendário de Postagem: quem criou o registro também
-- pode editar, além do responsável e de quem tem a permissão de
-- "editar todas as postagens".
-- ==========================================================
-- Hoje só o responsável pelo lançamento (usuario_id) e o
-- Administrador conseguem editar/excluir um registro do calendário
-- de postagem. Quem só adicionou a postagem para outra pessoa
-- (ex.: Marketing lança e define outro colega como responsável)
-- ficava sem poder corrigir o próprio lançamento depois.
--
-- Este script:
--   1) adiciona a coluna `criado_por` em calendario_postagens,
--      guardando quem de fato criou o registro;
--   2) faz backfill dos registros existentes usando o responsável
--      atual como criador (melhor suposição possível, já que o
--      dado não existia antes);
--   3) cria a permissão nova `editar_todas_postagens`, que libera
--      editar/excluir qualquer lançamento (não só os próprios ou os
--      que a pessoa criou) — igual já existe hoje para "ver_todas_postagens".

-- ---------------------------------------------------------
-- 1) Nova coluna
-- ---------------------------------------------------------
alter table calendario_postagens
  add column if not exists criado_por uuid references usuarios(id) on delete set null;

create index if not exists idx_calendario_postagens_criado_por on calendario_postagens(criado_por);

-- ---------------------------------------------------------
-- 2) Backfill: assume o responsável atual como criador nos
--    registros que ainda não têm essa informação.
-- ---------------------------------------------------------
update calendario_postagens
set criado_por = usuario_id
where criado_por is null;

-- ---------------------------------------------------------
-- 3) Permissão nova: "editar_todas_postagens"
--    Administrador e Coordenador saem com ela ligada por padrão,
--    igual às demais permissões "ver/editar tudo" do sistema.
-- ---------------------------------------------------------
update perfis_acesso
set permissoes = permissoes || jsonb_build_object('editar_todas_postagens', true)
where nome in ('Administrador', 'Coordenador');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('editar_todas_postagens', false)
where nome not in ('Administrador', 'Coordenador')
  and not (permissoes ? 'editar_todas_postagens');
