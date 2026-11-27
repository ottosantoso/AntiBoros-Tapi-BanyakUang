-- Satu user boleh punya beberapa role (primary key pindah ke (user_id, role)).
-- Role: super_admin, admin, support, analyst. Owner (ronin.shadow.ryu@gmail.com) mendapat keempatnya.
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles add constraint user_roles_pkey primary key (user_id, role);
alter table public.user_roles add constraint user_roles_role_check check (role in ('super_admin','admin','support','analyst'));

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role = p_role)
$$;
revoke execute on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

-- is_admin() berarti punya salah satu role panel admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = (select auth.uid()))
$$;

insert into public.user_roles (user_id, role)
select u.id, r.role from auth.users u
cross join (values ('super_admin'), ('admin'), ('support'), ('analyst')) as r(role)
where u.email = 'ronin.shadow.ryu@gmail.com'
on conflict do nothing;
