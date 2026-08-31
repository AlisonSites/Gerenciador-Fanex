-- ==========================================================
-- FANEX - Reforço de segurança + ajustes de permissões
-- ==========================================================
-- Até aqui, TODAS as tabelas tinham policy "qualquer autenticado pode
-- ler/gravar" — o controle de permissões (RBAC) era feito só na tela
-- (React). Isso significa que qualquer usuário logado, mesmo sem
-- nenhuma permissão marcada, conseguia ler/editar/apagar qualquer
-- registro chamando a API do Supabase diretamente (fora da tela).
--
-- Este script fecha isso nas duas tabelas mais sensíveis
-- (perfis_acesso e usuarios) e resolve duas falhas de escalação de
-- privilégio:
--
--   1) Funções auxiliares is_admin() / tem_permissao(chave) — usadas
--      nas policies para checar o perfil de quem está chamando.
--   2) Trava: só um Administrador pode conceder o perfil
--      "Administrador" a alguém (antes, qualquer um com acesso à tela
--      de usuários podia se autopromover).
--   3) RLS de escrita em perfis_acesso e usuarios passa a exigir a
--      permissão correspondente (criar_/gerenciar_/excluir_*), em vez
--      de liberar geral para qualquer autenticado.
--   4) Novas permissões: "ver_tarefas" (acesso só-leitura ao quadro,
--      sem precisar de "criar_tarefas") e "editar_todas_marketing"
--      (equivalente, no Calendário de Marketing, ao que já existe no
--      Calendário de Postagem).
--   5) calendario_entradas ganha a coluna `criado_por`, no mesmo
--      espírito da migration 008 (calendario_postagens).

-- ---------------------------------------------------------
-- 1) Funções auxiliares
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios u
    join perfis_acesso p on p.id = u.perfil_id
    where u.user_id = auth.uid() and p.nome = 'Administrador'
  );
$$;

create or replace function public.tem_permissao(chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (p.nome = 'Administrador') or coalesce((p.permissoes ->> chave)::boolean, false)
      from usuarios u
      join perfis_acesso p on p.id = u.perfil_id
      where u.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

-- ---------------------------------------------------------
-- 2) Trava contra autopromoção a Administrador
-- ---------------------------------------------------------
create or replace function public.bloquear_promocao_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil_alvo_nome text;
begin
  if new.perfil_id is not null then
    select nome into perfil_alvo_nome from perfis_acesso where id = new.perfil_id;
    if perfil_alvo_nome = 'Administrador' and not public.is_admin() then
      raise exception 'Somente um Administrador pode conceder o perfil Administrador a um usuário.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_bloquear_promocao_admin on usuarios;
create trigger trg_usuarios_bloquear_promocao_admin
before insert or update of perfil_id on usuarios
for each row execute procedure public.bloquear_promocao_admin();

-- ---------------------------------------------------------
-- 3) RLS de escrita — perfis_acesso e usuarios passam a exigir a
--    permissão correspondente, em vez de "qualquer autenticado".
--    A leitura continua liberada (perfis e nomes de usuários não são
--    dado sensível e são usados em vários seletores/telas).
-- ---------------------------------------------------------
drop policy if exists "auth write perfis_acesso" on perfis_acesso;
create policy "insert perfis_acesso" on perfis_acesso
  for insert with check (public.tem_permissao('criar_perfis'));
create policy "update perfis_acesso" on perfis_acesso
  for update using (public.tem_permissao('gerenciar_perfis')) with check (public.tem_permissao('gerenciar_perfis'));
create policy "delete perfis_acesso" on perfis_acesso
  for delete using (public.tem_permissao('excluir_perfis'));

drop policy if exists "auth write usuarios" on usuarios;
create policy "insert usuarios" on usuarios
  for insert with check (public.tem_permissao('criar_usuarios'));
create policy "update usuarios" on usuarios
  for update using (public.tem_permissao('gerenciar_usuarios')) with check (public.tem_permissao('gerenciar_usuarios'));
create policy "delete usuarios" on usuarios
  for delete using (public.tem_permissao('excluir_usuarios'));

-- Observação: se o banco estiver vazio (nenhum usuário/perfil ainda
-- cadastrado), tem_permissao()/is_admin() retornam false para todo
-- mundo — não tem como o primeiro Administrador se auto-cadastrar
-- pela tela. Nesse cenário (banco novo, do zero), cadastre o primeiro
-- usuário Administrador direto pelo SQL Editor do Supabase (que roda
-- como owner do banco e ignora RLS).

-- ---------------------------------------------------------
-- 4a) Nova permissão: "ver_tarefas" (acesso só-leitura ao quadro)
--     Quem já tinha criar_tarefas ou gerenciar_tarefas continua com
--     acesso normalmente (ver_tarefas true por padrão pra eles).
-- ---------------------------------------------------------
update perfis_acesso
set permissoes = permissoes || jsonb_build_object(
  'ver_tarefas',
  coalesce((permissoes ->> 'criar_tarefas')::boolean, false)
    or coalesce((permissoes ->> 'gerenciar_tarefas')::boolean, false)
)
where not (permissoes ? 'ver_tarefas');

-- ---------------------------------------------------------
-- 4b) Nova permissão: "editar_todas_marketing"
-- ---------------------------------------------------------
update perfis_acesso
set permissoes = permissoes || jsonb_build_object('editar_todas_marketing', true)
where nome in ('Administrador', 'Coordenador');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('editar_todas_marketing', false)
where nome not in ('Administrador', 'Coordenador')
  and not (permissoes ? 'editar_todas_marketing');

-- ---------------------------------------------------------
-- 5) calendario_entradas: mesma lógica de "Adicionado por" já
--    aplicada em calendario_postagens (migration 008).
-- ---------------------------------------------------------
alter table calendario_entradas
  add column if not exists criado_por uuid references usuarios(id) on delete set null;

create index if not exists idx_calendario_entradas_criado_por on calendario_entradas(criado_por);

update calendario_entradas
set criado_por = usuario_id
where criado_por is null;
