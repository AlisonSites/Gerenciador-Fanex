# Fanex — Gerenciamento de Tarefas

Aplicação React + Vite + Supabase para gestão de tarefas, usuários, perfis de acesso e grupos por setor, com quadro Kanban (drag and drop).

## Stack

- React 19 + Vite 5 (bundler estável, testado no Windows)
- CSS puro (sem frameworks de UI)
- Supabase (Postgres + Auth + Realtime)
- react-router-dom
- recharts (gráfico de produtividade)

## Como rodar no Windows

Abra o PowerShell na pasta do projeto (a que tem o `package.json`) e rode:

```powershell
npm install
npm run dev
```

Depois abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).

> Se der algum erro de dependência nativa, apague a pasta `node_modules` e rode `npm install` de novo. Não copie `node_modules` de um computador para outro — sempre rode `npm install` na própria máquina.

O projeto já vem com um arquivo `.env` configurado com as credenciais do Supabase informadas:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Banco de dados (Supabase)

Rode os scripts abaixo **na ordem**, no SQL Editor do seu projeto Supabase (Supabase → seu projeto → SQL Editor → New query → colar → Run). Pode colar e rodar um de cada vez.

1. `supabase/migrations/001_init.sql` — cria as tabelas principais, RLS e os perfis padrão (Administrador, Coordenador, Colaborador) e os status do quadro Kanban.
2. `supabase/migrations/002_relatorio_pessoal.sql` — adiciona a permissão "Relatório por Pessoal" aos perfis.
3. `supabase/migrations/003_auto_confirmar_email.sql` — **resolve o bug de login após criar usuário**: confirma automaticamente o e-mail de quem for cadastrado pela tela do sistema (sem isso, a pessoa cadastrada não consegue entrar).
4. `supabase/migrations/004_calendario_marketing.sql` — cria a tabela do Calendário de Marketing e os perfis **Marketing** e **Comercial**, além da permissão "Relatório do Calendário por Pessoa".
5. `supabase/migrations/005_correcoes_exclusao.sql` — **corrige um bug de exclusão**: antes, excluir um grupo ou usuário que ainda tivesse tarefas vinculadas falhava silenciosamente (o registro sumia da tela por um instante, mas continuava no banco). Agora excluir um grupo também exclui as tarefas dele, e excluir um usuário apenas desvincula (sem apagar) as tarefas em que ele era responsável.

Se o seu banco já rodou o `001_init.sql` antes desta atualização, é só rodar 002, 003, 004 e 005 agora — eles só adicionam/ajustam o que falta, sem apagar dados que já existem.

### Deploy da função de troca de senha (opcional, mas necessário para o botão "Trocar senha")

Trocar a senha de **outra** pessoa não é algo que o navegador consegue fazer sozinho por segurança — isso exige rodar código no servidor com a chave "service role" do Supabase, que nunca deve ficar exposta no site. Por isso criamos uma Edge Function.

1. Instale a Supabase CLI (uma vez só): https://supabase.com/docs/guides/cli
2. No PowerShell, dentro da pasta do projeto:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy admin-trocar-senha
```

> O `SEU_PROJECT_REF` você encontra em Supabase → Project Settings → General → "Reference ID".

Depois disso, o botão **"Trocar senha"** em `/usuarios/gerenciar` (visível só para Administrador) passa a funcionar. Sem esse deploy, o botão mostra um aviso explicando que a função ainda não foi publicada — o resto do sistema continua funcionando normalmente.

### Deploy das funções de troca de e-mail (opcional, mas necessário para o botão "Trocar e-mail")

Pelo mesmo motivo da senha, trocar o e-mail de **outra** pessoa também exige rodar no servidor. São duas funções: uma consulta o e-mail atual (para mostrar no campo) e outra faz a troca.

```powershell
npx supabase functions deploy admin-obter-email
npx supabase functions deploy admin-trocar-email
```

Depois disso, o campo **"Trocar e-mail de acesso"** em `/usuarios/gerenciar` (visível só para Administrador) passa a mostrar o e-mail atual e permitir a troca.

### Deploy da função de exclusão completa de usuário (opcional, mas recomendado)

Sem essa função, excluir um usuário pela tela remove apenas o cadastro (nome, cargo, perfil) — a conta de acesso (e-mail/senha) continua existindo no Supabase Auth. Com a função implantada, a exclusão apaga as duas coisas juntas.

```powershell
npx supabase functions deploy admin-excluir-usuario
```

Sem esse deploy, o botão "Excluir" em `/usuarios/gerenciar` e `/usuarios/criar` continua funcionando (remove o cadastro), mas mostra um aviso de que a conta de acesso pode não ter sido removida.

### Criando o primeiro usuário administrador

1. No painel do Supabase, vá em **Authentication → Users → Add user** e crie um usuário com e-mail e senha (esse será seu login, ex.: `admin@fanex.com`).
   - Em **Authentication → Settings**, se possível desative a confirmação obrigatória de e-mail, ou confirme o e-mail manualmente na tela de usuários, para não travar o primeiro login.
2. Volte ao **SQL Editor** e rode (trocando o e-mail pelo que você usou):

```sql
insert into usuarios (user_id, nome_completo, cargo, status, perfil_id)
select
  au.id,
  'Seu Nome',
  'Administrador do Sistema',
  'Ativo',
  (select id from perfis_acesso where nome = 'Administrador')
from auth.users au
where au.email = 'admin@fanex.com';
```

3. Rode o projeto (`npm run dev`) e faça login em `/login` com esse e-mail e senha.

A partir daí, você pode criar os demais usuários direto pela tela `/usuarios/criar` do próprio sistema.

> **Nota de segurança**: as políticas de RLS incluídas liberam leitura/gravação para qualquer usuário autenticado, e o controle fino de permissões (RBAC) é feito na camada de front-end. Para produção, recomenda-se reforçar as políticas de RLS por tabela e mover a criação de usuários (Auth) para uma Edge Function com a service role key, em vez do client-side `supabase.auth.signUp`.

## Estrutura

```
src/
  components/     Layout, Sidebar, Header (notificações), ProtectedRoute, ConfirmModal
  context/        AuthContext (sessão, perfil, permissões)
  lib/            cliente Supabase + lista de permissões
  pages/          Dashboard, Tarefas (Kanban), Usuários, Perfis, Grupos, Calendário, Relatórios, Login
  styles/         design tokens (cores/tipografia), layout, componentes de UI
supabase/
  migrations/     schema SQL completo com seeds e RLS (rodar em ordem, 001 a 004)
  functions/      Edge Functions admin-trocar-senha, admin-trocar-email, admin-obter-email e admin-excluir-usuario (gestão de acesso por um Administrador)
```

## Perfis e permissões

- **Administrador**: acesso total; único que pode adicionar/remover membros de grupos, editar outros usuários, trocar a senha e o e-mail deles, e o único (junto com Coordenador) que gerencia os status do quadro de tarefas.
- **Coordenador**: dashboard e tarefas completos em todos os grupos; usuários e grupos em modo visualização; sem acesso a perfis de acesso.
- **Colaborador**: dashboard pessoal; no Quadro de Tarefas só vê os grupos aos quais está vinculado e, dentro deles, só edita/move as tarefas das quais é responsável.
- **Marketing** e **Comercial** (novos): dashboard pessoal, criam suas tarefas e usam o Calendário de Marketing com as colunas do seu setor.

As permissões de cada perfil podem ser ajustadas em `/perfis/gerenciar` (ou criadas do zero em `/perfis/criar`).

## Dashboard por escopo

O Dashboard (`/dashboard`) agora tem abas para trocar o escopo dos números exibidos:
- **Pessoal**: só as tarefas em que o próprio usuário é responsável. Disponível para todo mundo.
- **Um botão por grupo**: Administrador e Coordenação veem um botão para cada grupo cadastrado; os demais perfis só veem botões dos grupos aos quais estão vinculados.
- **Geral**: soma de todas as tarefas de todos os grupos. Só aparece para Administrador e Coordenação.

## Quadro de Tarefas por grupo

Em `/tarefas`, a primeira tela mostra cards com os **grupos do usuário logado**:
- Administrador e Coordenador veem cards de todos os grupos cadastrados.
- Os demais perfis só veem cards dos grupos aos quais foram vinculados em `/grupos/gerenciar`.

Ao clicar em um card, abre o quadro Kanban daquele grupo, com as tarefas filtradas por `grupo_id`:
- Qualquer membro do grupo vê todas as tarefas do grupo, mas só pode **arrastar, editar ou excluir** as tarefas das quais é o responsável.
- Administrador e Coordenador podem ver, mover, editar e excluir qualquer tarefa de qualquer grupo.
- Administrador e Coordenador também podem **criar, editar, excluir e reordenar** (setas ⟵/⟶ no cabeçalho da coluna) os status (colunas) do quadro. Um status só pode ser excluído se estiver vazio.

## Relatório por Pessoal

Nova tela em `/relatorios/pessoal`, disponível no menu lateral (seção "Relatórios") para qualquer perfil com a permissão **Relatório por Pessoal** marcada — por padrão, Administrador e Coordenador já saem com ela ativada.

O relatório mostra, por colaborador:
- Total de tarefas, pendentes, em andamento, concluídas e atrasadas
- Taxa de conclusão individual (barra de progresso)
- Gráfico comparativo dos 10 colaboradores com mais tarefas
- Filtros por nome, grupo/setor e período (data de criação da tarefa)
- Exportação dos dados filtrados em CSV

Como qualquer outra permissão, o acesso a essa tela é controlado por perfil em `/perfis/gerenciar` — desmarque a permissão para qualquer perfil que não deva ver o relatório.

## Calendário de Marketing

Nova tela em `/calendario`, no menu lateral, para quem tiver a permissão **Calendário de Marketing** (por padrão, os perfis Marketing e Comercial já vêm com ela ativada; Administrador e Coordenador também têm acesso e podem lançar em nome de qualquer um dos dois setores).

Como funciona:
- Clique em um dia do calendário para abrir o formulário de lançamento daquele dia.
- Quem é do perfil **Marketing** vê as colunas: **Assunto**, **Postagem** (Feed ou Story) e **Status** (Pendente, Em andamento ou Concluído).
- Quem é do perfil **Comercial** vê as colunas: **Assunto**, **Tipo** (Aten. Presencial, Aten. Virtual, Mensagem RD, Mensagem Enviada, Matrículas pagas, Matrículas Gratuita) e **Publicidade** (Blubash, Anúncio, Whatsapp, Instagram, Visita, Panfleto, Curso gratuito).
- Administrador e Coordenador escolhem entre as duas abas (Marketing/Comercial) ao lançar.
- Cada pessoa só edita/exclui os próprios lançamentos; o Administrador pode editar/excluir qualquer um.
- O relatório em `/relatorios/calendario` (link também no Dashboard) mostra quantos lançamentos de cada categoria cada pessoa fez, com gráfico e exportação em CSV. Clicando em uma pessoa, a linha expande e mostra o detalhamento por coluna do calendário (Postagem, Status, Tipo, Publicidade) e a lista de lançamentos dela no período filtrado — também exportável em CSV detalhado.

## Adicionando os 6 usuários novos

O jeito mais rápido e seguro é pela própria tela do sistema (ela já cria a conta de acesso e o cadastro junto, e agora com o bug de login corrigido a pessoa já consegue entrar na hora):

1. Rode as migrations 001 a 004 (seção acima) — isso já cria os perfis **Marketing** e **Comercial**.
2. Logado como Administrador, vá em **Criar Usuário** (`/usuarios/criar`) e cadastre cada pessoa abaixo, escolhendo o **Perfil de acesso** correspondente no menu:

| Nome | Cargo | Perfil de acesso | E-mail | Senha |
|---|---|---|---|---|
| Maria Zilda | Coordenação Geral - Técnico | Administrador | coordenacao.tecnico@fanex.com.br | Fanex2026 |
| Alison Ryan | Gerente de TI | Administrador | ti1@fanex.com.br | Alison_Ryan22 |
| Marcos Vinicius | Designer | Marketing | marketingmacau@fanex.com.br | Fanex2026 |
| João Marcos | Designer | Marketing | marketingmacau03@fanex.com.br | Fanex2026 |
| Talita Carvalho | Vendedora | Comercial | orientacaoprofissional1@fanex.com.br | Fanex2026 |
| Fernanda Beatriz | Vendedora | Comercial | orientacaoprofissional4@fanex.com.br | Fanex2026 |

3. Deixe o **Status** como "Ativo" em todos.

> Por que não mandei um script SQL pronto para inserir direto no `auth.users`? Esse tipo de inserção manual no schema interno de autenticação do Supabase depende da versão exata do GoTrue do seu projeto (ele exige linhas relacionadas em `auth.identities` também) e pode simplesmente não funcionar ou até quebrar o login de todo mundo se algo estiver diferente. Como a tela `/usuarios/criar` já faz isso do jeito certo (e agora com o e-mail confirmado automaticamente), é o caminho garantido de funcionar no seu projeto.

## Bugs corrigidos nesta atualização

- **Não conseguia logar após criar um usuário**: o cadastro trocava a sessão de quem estava logado pela do usuário novo, e o e-mail ficava sem confirmar (o Supabase exige confirmação por padrão). Agora a sessão de quem está cadastrando é preservada, e a migration `003_auto_confirmar_email.sql` confirma o e-mail automaticamente.
- **Não dava para editar uma tarefa depois de criada**: essa função simplesmente não existia. Agora, clicar em um cartão do quadro abre um modal de edição completo (e um botão para excluir), respeitando quem pode editar o quê.
- **Notificação de tarefa atrasada não aparecia**: o sininho só avisava sobre tarefas novas ("não lidas"). Agora ele também detecta tarefas com prazo vencido que ainda não foram concluídas e destaca com a etiqueta "Atrasada" — essas ficam visíveis até a tarefa ser concluída ou o prazo ser ajustado.
- **Exclusão "só sumia do aplicativo"**: excluir um usuário não apagava a conta de acesso (login) dele no Supabase Auth, e excluir grupos/usuários com tarefas vinculadas falhava silenciosamente por causa de chaves estrangeiras sem `on delete` definido — o app não conferia o erro retornado, então parecia ter funcionado. Corrigido com a migration `005_correcoes_exclusao.sql` e a Edge Function `admin-excluir-usuario`, além de checagem de erro em todas as exclusões do sistema.
