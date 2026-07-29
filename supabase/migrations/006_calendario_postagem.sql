-- ==========================================================
-- FANEX - Calendário de Postagem + novas permissões
-- ==========================================================
-- Cria a tabela do novo "Calendário de Postagem" (Tipo: FEED/STORY,
-- Descrição, Responsável) e adiciona as permissões novas usadas
-- nele e no Quadro de Tarefas:
--
--   calendario_postagem        -> acessar a página do calendário de postagem
--   criar_calendario_postagem  -> pode adicionar registros no calendário
--   ver_todas_postagens        -> vê os registros de todo mundo (sem isso,
--                                  só vê os registros de sua responsabilidade)
--   ver_todas_tarefas          -> vê todas as tarefas do quadro (sem isso,
--                                  só vê as tarefas em que é responsável)

-- ---------------------------------------------------------
-- Tabela: calendario_postagens
-- ---------------------------------------------------------
create table if not exists calendario_postagens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  data date not null,
  tipo text not null check (tipo in ('FEED', 'STORY')),
  descricao text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendario_postagens_data on calendario_postagens(data);
create index if not exists idx_calendario_postagens_usuario on calendario_postagens(usuario_id);

alter table calendario_postagens enable row level security;

create policy "auth read calendario_postagens" on calendario_postagens for select using (auth.role() = 'authenticated');
create policy "auth write calendario_postagens" on calendario_postagens for all using (auth.role() = 'authenticated');

create or replace function public.calendario_postagens_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_calendario_postagens_updated_at on calendario_postagens;
create trigger trg_calendario_postagens_updated_at
before update on calendario_postagens
for each row execute procedure public.calendario_postagens_set_updated_at();

-- ---------------------------------------------------------
-- Permissões novas nos perfis já existentes
-- ---------------------------------------------------------
-- Administrador e Coordenador enxergam tudo por padrão.
update perfis_acesso
set permissoes = permissoes
  || jsonb_build_object('ver_todas_tarefas', true)
  || jsonb_build_object('calendario_postagem', true)
  || jsonb_build_object('criar_calendario_postagem', true)
  || jsonb_build_object('ver_todas_postagens', true)
where nome in ('Administrador', 'Coordenador');

-- Demais perfis: por padrão só enxergam/lançam o que é de sua
-- responsabilidade. Pode ser ajustado depois em "Gerenciar Perfis".
update perfis_acesso
set permissoes = permissoes
  || jsonb_build_object('ver_todas_tarefas', false)
  || jsonb_build_object('calendario_postagem', true)
  || jsonb_build_object('criar_calendario_postagem', true)
  || jsonb_build_object('ver_todas_postagens', false)
where nome not in ('Administrador', 'Coordenador')
  and not (permissoes ? 'calendario_postagem');
