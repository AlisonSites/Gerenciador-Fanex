-- ==========================================================
-- FANEX - Arquivo mensal de tarefas concluídas
-- ==========================================================
-- Quando o mês vira, as tarefas que foram concluídas no mês
-- anterior saem do Quadro de Tarefas e passam a viver só na nova
-- página "Arquivo de Tarefas", organizadas em pastas por mês e,
-- dentro de cada mês, por responsável.
--
-- Como o app já usa a convenção "o nome da coluna do quadro contém
-- 'conclu'" pra saber se uma tarefa está concluída (Dashboard e
-- Relatórios), este script segue a mesma regra — sem exigir nenhuma
-- configuração extra em "Gerenciar Colunas".
--
-- Peças:
--   1) Colunas novas em `tarefas`: concluida_em, arquivada,
--      arquivada_em, mes_arquivo.
--   2) Gatilho que preenche/limpa `concluida_em` sempre que o status
--      da tarefa muda (entrou ou saiu de uma coluna "concluído").
--   3) Função `arquivar_tarefas_concluidas()`: arquiva tudo que foi
--      concluído em um mês que já virou. É chamada automaticamente
--      pelo app assim que alguém loga (ver AuthContext no front-end)
--      — não precisa de nenhum agendamento no Supabase.
--   4) Backfill: tarefas que já estavam concluídas antes desta
--      migration ganham `concluida_em` (usando `updated_at` como
--      melhor estimativa disponível).

-- ---------------------------------------------------------
-- 1) Colunas novas
-- ---------------------------------------------------------
alter table tarefas add column if not exists concluida_em timestamptz;
alter table tarefas add column if not exists arquivada boolean not null default false;
alter table tarefas add column if not exists arquivada_em timestamptz;
alter table tarefas add column if not exists mes_arquivo text; -- formato 'AAAA-MM'

create index if not exists idx_tarefas_arquivada on tarefas(arquivada);
create index if not exists idx_tarefas_mes_arquivo on tarefas(mes_arquivo);

-- ---------------------------------------------------------
-- 2) Gatilho: marca/limpa concluida_em quando o status muda
-- ---------------------------------------------------------
create or replace function public.tarefas_marcar_conclusao()
returns trigger
language plpgsql
as $$
declare
  status_novo_nome text;
  status_antigo_nome text;
begin
  if new.status_id is not null then
    select nome into status_novo_nome from status_tarefas where id = new.status_id;
  end if;

  if TG_OP = 'UPDATE' then
    if old.status_id is not null then
      select nome into status_antigo_nome from status_tarefas where id = old.status_id;
    end if;
  end if;

  if status_novo_nome ~* 'conclu' then
    -- Só marca a hora de conclusão na transição pra "concluído" (evita
    -- resetar a data se a tarefa já estava concluída e só mudou pra
    -- outra coluna igualmente "concluído", por exemplo).
    if status_antigo_nome is null or status_antigo_nome !~* 'conclu' then
      new.concluida_em = now();
    end if;
  else
    -- Saiu de "concluído" (reaberta): limpa a marca e desfaz o arquivamento,
    -- caso um dia exista uma ação de "reabrir tarefa" na tela de Arquivo.
    new.concluida_em = null;
    new.arquivada = false;
    new.mes_arquivo = null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tarefas_marcar_conclusao on tarefas;
create trigger trg_tarefas_marcar_conclusao
before insert or update of status_id on tarefas
for each row execute procedure public.tarefas_marcar_conclusao();

-- ---------------------------------------------------------
-- 3) Função de arquivamento
--    Arquiva qualquer tarefa concluída num mês estritamente anterior
--    ao mês atual (tarefas concluídas neste mês continuam no quadro
--    até o mês virar). Idempotente — pode ser chamada quantas vezes
--    quiser, só mexe no que ainda não foi arquivado.
-- ---------------------------------------------------------
create or replace function public.arquivar_tarefas_concluidas()
returns integer
language sql
security definer
set search_path = public
as $$
  with alvo as (
    update tarefas
    set arquivada = true,
        arquivada_em = now(),
        mes_arquivo = to_char(concluida_em, 'YYYY-MM')
    where arquivada = false
      and concluida_em is not null
      and date_trunc('month', concluida_em) < date_trunc('month', now())
    returning 1
  )
  select count(*)::integer from alvo;
$$;

-- ---------------------------------------------------------
-- 4) Backfill: tarefas já concluídas antes desta migration
-- ---------------------------------------------------------
update tarefas t
set concluida_em = t.updated_at
from status_tarefas s
where t.status_id = s.id
  and s.nome ~* 'conclu'
  and t.concluida_em is null;

-- ---------------------------------------------------------
-- Opcional: automação 100% no banco (independe de alguém logar).
-- Só funciona se a extensão pg_cron estiver habilitada no seu
-- projeto Supabase (Database > Extensions > pg_cron). Descomente e
-- rode este bloco separadamente se quiser essa garantia extra —
-- o app já dispara a mesma função sozinho a cada login, então isso
-- é só um reforço.
-- ---------------------------------------------------------
-- create extension if not exists pg_cron with schema extensions;
-- select cron.schedule(
--   'arquivar-tarefas-concluidas-mensal',
--   '0 6 1 * *', -- todo dia 1 de cada mês, às 06:00 UTC
--   $$select public.arquivar_tarefas_concluidas();$$
-- );
