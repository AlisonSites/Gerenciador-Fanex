-- ==========================================================
-- FANEX - Adiciona a permissão "Relatório por Pessoal"
-- ==========================================================
-- Rode este script se o seu banco já foi criado com o
-- 001_init.sql antes desta permissão existir. Ele só ADICIONA
-- a chave nova aos perfis existentes, sem apagar nada.

-- Administrador e Coordenador passam a ver o relatório por padrão;
-- Colaborador continua sem acesso (pode ser liberado em /perfis/gerenciar).
update perfis_acesso
set permissoes = permissoes || jsonb_build_object('relatorio_pessoal', true)
where nome in ('Administrador', 'Coordenador')
  and not (permissoes ? 'relatorio_pessoal');

update perfis_acesso
set permissoes = permissoes || jsonb_build_object('relatorio_pessoal', false)
where nome not in ('Administrador', 'Coordenador')
  and not (permissoes ? 'relatorio_pessoal');
