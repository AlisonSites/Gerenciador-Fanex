-- ==========================================================
-- FANEX - Schema inicial
-- ==========================================================
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- Perfis de acesso (papéis com permissões em JSON)
-- ---------------------------------------------------------
create table if not exists perfis_acesso (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(100) not null,
  permissoes jsonb not null default '{}',
  created_at timestamp default now()
);

-- ---------------------------------------------------------
-- Usuários (perfil de aplicação, ligado a auth.users)
-- ---------------------------------------------------------
create table if not exists usuarios (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  nome_completo varchar(200) not null,
  cargo varchar(100),
  status varchar(20) default 'Ativo',
  perfil_id uuid references perfis_acesso(id),
  created_at timestamp default now()
);

-- ---------------------------------------------------------
-- Grupos / Setores
-- ---------------------------------------------------------
create table if not exists grupos (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(150) not null,
  status varchar(20) default 'Ativo',
  created_at timestamp default now()
);

create table if not exists grupo_membros (
  id uuid primary key default uuid_generate_v4(),
  grupo_id uuid references grupos(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete cascade,
  created_at timestamp default now(),
  unique (grupo_id, usuario_id)
);

-- ---------------------------------------------------------
-- Status de tarefas (colunas do quadro Kanban, dinâmicas)
-- ---------------------------------------------------------
create table if not exists status_tarefas (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(100) not null,
  ordem integer not null,
  cor varchar(7) default '#000045',
  created_by uuid references auth.users(id),
  created_at timestamp default now()
);

-- ---------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------
create table if not exists tarefas (
  id uuid primary key default uuid_generate_v4(),
  titulo varchar(200) not null,
  descricao text,
  data_vencimento date,
  prioridade varchar(20) check (prioridade in ('Baixa', 'Normal', 'Alta', 'Urgente')) default 'Normal',
  status_id uuid references status_tarefas(id),
  usuario_id uuid references usuarios(id),
  grupo_id uuid references grupos(id),
  lida boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Atualiza updated_at automaticamente
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tarefas_updated_at on tarefas;
create trigger trg_tarefas_updated_at
before update on tarefas
for each row execute procedure set_updated_at();

-- ---------------------------------------------------------
-- Seed: perfis padrão
-- ---------------------------------------------------------
insert into perfis_acesso (nome, permissoes)
values
  ('Administrador', '{"dashboard":true,"criar_tarefas":true,"gerenciar_tarefas":true,"criar_usuarios":true,"gerenciar_usuarios":true,"criar_grupos":true,"gerenciar_grupos":true,"criar_perfis":true,"gerenciar_perfis":true,"relatorio_pessoal":true,"configuracoes":true}'),
  ('Coordenador', '{"dashboard":true,"criar_tarefas":true,"gerenciar_tarefas":true,"criar_usuarios":false,"gerenciar_usuarios":false,"criar_grupos":false,"gerenciar_grupos":false,"criar_perfis":false,"gerenciar_perfis":false,"relatorio_pessoal":true,"configuracoes":false}'),
  ('Colaborador', '{"dashboard":true,"criar_tarefas":true,"gerenciar_tarefas":false,"criar_usuarios":false,"gerenciar_usuarios":false,"criar_grupos":false,"gerenciar_grupos":false,"criar_perfis":false,"gerenciar_perfis":false,"relatorio_pessoal":false,"configuracoes":false}')
on conflict do nothing;

-- Seed: status padrão do quadro Kanban
insert into status_tarefas (nome, ordem, cor)
values
  ('A Fazer', 1, '#000045'),
  ('Em Andamento', 2, '#FF5400'),
  ('Concluído', 3, '#2ECC71')
on conflict do nothing;

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table perfis_acesso enable row level security;
alter table usuarios enable row level security;
alter table grupos enable row level security;
alter table grupo_membros enable row level security;
alter table status_tarefas enable row level security;
alter table tarefas enable row level security;

-- Política simples: qualquer usuário autenticado pode ler/gravar.
-- A aplicação faz o controle fino de permissões (RBAC) na camada de front-end.
-- Ajuste estas políticas para regras mais restritivas em produção.
create policy "auth read perfis_acesso" on perfis_acesso for select using (auth.role() = 'authenticated');
create policy "auth write perfis_acesso" on perfis_acesso for all using (auth.role() = 'authenticated');

create policy "auth read usuarios" on usuarios for select using (auth.role() = 'authenticated');
create policy "auth write usuarios" on usuarios for all using (auth.role() = 'authenticated');

create policy "auth read grupos" on grupos for select using (auth.role() = 'authenticated');
create policy "auth write grupos" on grupos for all using (auth.role() = 'authenticated');

create policy "auth read grupo_membros" on grupo_membros for select using (auth.role() = 'authenticated');
create policy "auth write grupo_membros" on grupo_membros for all using (auth.role() = 'authenticated');

create policy "auth read status_tarefas" on status_tarefas for select using (auth.role() = 'authenticated');
create policy "auth write status_tarefas" on status_tarefas for all using (auth.role() = 'authenticated');

create policy "auth read tarefas" on tarefas for select using (auth.role() = 'authenticated');
create policy "auth write tarefas" on tarefas for all using (auth.role() = 'authenticated');
