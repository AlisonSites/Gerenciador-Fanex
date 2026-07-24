-- ==========================================================
-- FANEX - Confirma automaticamente o e-mail de novos usuários
-- ==========================================================
-- PROBLEMA QUE ISSO RESOLVE:
-- Ao criar um usuário pela tela "Criar Usuário", o app chama
-- supabase.auth.signUp(). Por padrão o Supabase exige que a
-- pessoa clique em um link de confirmação enviado por e-mail
-- antes de conseguir logar. Como o projeto não tem um fluxo de
-- e-mail configurado, a conta ficava "presa" like não confirmada
-- e o login falhava com "Email not confirmed".
--
-- Este script cria um gatilho que confirma o e-mail automaticamente
-- assim que o usuário é criado no Supabase Auth, então a pessoa já
-- consegue logar com o e-mail e senha definidos na hora do cadastro.
--
-- Rode este script UMA VEZ no SQL Editor do Supabase.

create or replace function public.auto_confirmar_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    update auth.users
    set email_confirmed_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_confirmar on auth.users;

create trigger on_auth_user_created_confirmar
after insert on auth.users
for each row execute procedure public.auto_confirmar_email();

-- Também confirma quem já foi criado antes deste script e ficou
-- sem conseguir entrar no sistema.
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;
