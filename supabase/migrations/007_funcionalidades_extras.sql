-- ==========================================================
-- FANEX — Funcionalidades extras:
--   1) Etiquetas em tarefas
--   2) Comentários em tarefas
--   3) Anexos em tarefas
--   4) Log de auditoria completo
--   5) Suporte ao Relatório Consolidado por Unidade
--
-- Pode ser rodado com segurança mesmo que parte do schema (ex.: tabela
-- `unidades`) já exista — todos os comandos usam "if not exists".
-- ==========================================================

-- ---------------------------------------------------------
-- 0) Garante que `unidades` existe (caso seu banco ainda não tenha,
--    por ter sido criada manualmente fora das migrations).
-- ---------------------------------------------------------
create table if not exists unidades (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(150) not null,
  status varchar(20) default 'Ativo',
  created_at timestamp default now()
);

alter table grupos add column if not exists unidade_id uuid references unidades(id);
alter table tarefas add column if not exists unidade_id uuid references unidades(id);

-- ---------------------------------------------------------
-- 1) Etiquetas em tarefas (além da prioridade, que já existia)
-- ---------------------------------------------------------
alter table tarefas add column if not exists etiquetas text[] not null default '{}';

-- ---------------------------------------------------------
-- 2) Comentários em tarefas
-- ---------------------------------------------------------
create table if not exists tarefa_comentarios (
  id uuid primary key default uuid_generate_v4(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  texto text not null,
  created_at timestamp default now()
);

create index if not exists idx_tarefa_comentarios_tarefa on tarefa_comentarios(tarefa_id);

-- ---------------------------------------------------------
-- 3) Anexos em tarefas
--    O arquivo em si fica no Supabase Storage (bucket "anexos-tarefas");
--    esta tabela guarda só a referência/metadados.
-- ---------------------------------------------------------
create table if not exists tarefa_anexos (
  id uuid primary key default uuid_generate_v4(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  nome_arquivo varchar(255) not null,
  caminho text not null, -- caminho dentro do bucket "anexos-tarefas"
  tipo varchar(120),
  tamanho bigint,
  created_at timestamp default now()
);

create index if not exists idx_tarefa_anexos_tarefa on tarefa_anexos(tarefa_id);

-- Cria o bucket de anexos (privado — o acesso passa pelas policies abaixo).
insert into storage.buckets (id, name, public)
values ('anexos-tarefas', 'anexos-tarefas', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- 4) Log de auditoria completo (ações de negócio, não só erros técnicos)
-- ---------------------------------------------------------
create table if not exists logs_auditoria (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid references usuarios(id) on delete set null,
  acao varchar(30) not null,      -- 'criar' | 'editar' | 'excluir' | 'login' | outro
  modulo varchar(60) not null,    -- 'Usuários' | 'Grupos' | 'Perfis' | 'Unidades' | 'Tarefas' | ...
  descricao text not null,        -- frase legível do que aconteceu
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamp default now()
);

create index if not exists idx_logs_auditoria_created_at on logs_auditoria(created_at desc);
create index if not exists idx_logs_auditoria_modulo on logs_auditoria(modulo);

-- ---------------------------------------------------------
-- RLS — segue o mesmo padrão do restante do sistema: qualquer usuário
-- autenticado pode ler/gravar (o controle fino de permissões continua
-- sendo feito na camada de front-end, como já documentado no README).
-- ---------------------------------------------------------
alter table tarefa_comentarios enable row level security;
alter table tarefa_anexos enable row level security;
alter table logs_auditoria enable row level security;

drop policy if exists "auth read tarefa_comentarios" on tarefa_comentarios;
drop policy if exists "auth write tarefa_comentarios" on tarefa_comentarios;
create policy "auth read tarefa_comentarios" on tarefa_comentarios for select using (auth.role() = 'authenticated');
create policy "auth write tarefa_comentarios" on tarefa_comentarios for all using (auth.role() = 'authenticated');

drop policy if exists "auth read tarefa_anexos" on tarefa_anexos;
drop policy if exists "auth write tarefa_anexos" on tarefa_anexos;
create policy "auth read tarefa_anexos" on tarefa_anexos for select using (auth.role() = 'authenticated');
create policy "auth write tarefa_anexos" on tarefa_anexos for all using (auth.role() = 'authenticated');

drop policy if exists "auth read logs_auditoria" on logs_auditoria;
drop policy if exists "auth write logs_auditoria" on logs_auditoria;
create policy "auth read logs_auditoria" on logs_auditoria for select using (auth.role() = 'authenticated');
create policy "auth write logs_auditoria" on logs_auditoria for all using (auth.role() = 'authenticated');

-- Policies do Storage para o bucket de anexos: qualquer usuário
-- autenticado pode enviar, ler e remover arquivos desse bucket.
drop policy if exists "auth read anexos-tarefas" on storage.objects;
drop policy if exists "auth write anexos-tarefas" on storage.objects;
drop policy if exists "auth delete anexos-tarefas" on storage.objects;

create policy "auth read anexos-tarefas" on storage.objects for select
  using (bucket_id = 'anexos-tarefas' and auth.role() = 'authenticated');
create policy "auth write anexos-tarefas" on storage.objects for insert
  with check (bucket_id = 'anexos-tarefas' and auth.role() = 'authenticated');
create policy "auth delete anexos-tarefas" on storage.objects for delete
  using (bucket_id = 'anexos-tarefas' and auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- 5) Novas permissões liberadas por padrão para Administrador e
--    Coordenador (o restante dos perfis sai sem elas — ajuste em
--    /perfis/gerenciar).
-- ---------------------------------------------------------
update perfis_acesso
set permissoes = permissoes || '{
  "comentar_tarefas": true,
  "anexar_arquivos_tarefas": true,
  "etiquetar_tarefas": true,
  "definir_prioridade_tarefas": true,
  "ver_auditoria": true,
  "relatorio_unidades": true
}'::jsonb
where nome in ('Administrador', 'Coordenador');

-- Colaborador, Marketing e Comercial saem podendo comentar e anexar
-- (mas não ver a auditoria nem o relatório consolidado).
update perfis_acesso
set permissoes = permissoes || '{
  "comentar_tarefas": true,
  "anexar_arquivos_tarefas": true
}'::jsonb
where nome in ('Colaborador', 'Marketing', 'Comercial');
