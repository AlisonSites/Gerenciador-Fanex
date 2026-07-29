-- ==========================================================
-- FANEX - Calendário de Marketing + perfis Marketing/Comercial
-- ==========================================================

-- Tabela genérica de lançamentos do calendário. As colunas "campo_dois"
-- e "campo_tres" mudam de significado dependendo da categoria:
--   categoria = 'Marketing' -> campo_dois = Postagem (Feed/Story), campo_tres = Status
--   categoria = 'Comercial' -> campo_dois = Tipo,                   campo_tres = Publicidade
create table if not exists calendario_entradas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  data date not null,
  categoria text not null check (categoria in ('Marketing', 'Comercial')),
  assunto text not null,
  campo_dois text,
  campo_tres text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendario_entradas_data on calendario_entradas(data);
create index if not exists idx_calendario_entradas_usuario on calendario_entradas(usuario_id);

alter table calendario_entradas enable row level security;

create policy "auth read calendario_entradas" on calendario_entradas for select using (auth.role() = 'authenticated');
create policy "auth write calendario_entradas" on calendario_entradas for all using (auth.role() = 'authenticated');

-- Mantém updated_at em dia.
create or replace function public.calendario_entradas_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_calendario_entradas_updated_at on calendario_entradas;
create trigger trg_calendario_entradas_updated_at
before update on calendario_entradas
for each row execute procedure public.calendario_entradas_set_updated_at();

-- Novos perfis de acesso: Marketing e Comercial.
-- Ambos enxergam o dashboard, criam suas tarefas e usam o Calendário de
-- Marketing (cada um só com as colunas do seu setor, controladas no front-end).
insert into perfis_acesso (nome, permissoes)
values
  ('Marketing', '{"dashboard":true,"criar_tarefas":true,"gerenciar_tarefas":false,"criar_usuarios":false,"gerenciar_usuarios":false,"criar_grupos":false,"gerenciar_grupos":false,"criar_perfis":false,"gerenciar_perfis":false,"relatorio_pessoal":false,"calendario_marketing":true,"relatorio_calendario":false,"configuracoes":false}'),
  ('Comercial', '{"dashboard":true,"criar_tarefas":true,"gerenciar_tarefas":false,"criar_usuarios":false,"gerenciar_usuarios":false,"criar_grupos":false,"gerenciar_grupos":false,"criar_perfis":false,"gerenciar_perfis":false,"relatorio_pessoal":false,"calendario_marketing":true,"relatorio_calendario":false,"configuracoes":false}')
on conflict (nome) do nothing;

-- Garante que perfis já existentes (criados antes desta migração) recebam
-- as duas permissões novas sem perder o que já estava configurado.
update perfis_acesso
set permissoes = permissoes || jsonb_build_object('calendario_marketing', false)
where not (permissoes ? 'calendario_marketing');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('relatorio_calendario', true)
where nome in ('Administrador', 'Coordenador')
  and not (permissoes ? 'relatorio_calendario');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('relatorio_calendario', false)
where nome not in ('Administrador', 'Coordenador')
  and not (permissoes ? 'relatorio_calendario');
