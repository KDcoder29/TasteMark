-- Tastemark: groups and shared journals
-- Run ONCE in Supabase -> SQL Editor -> New query -> Run.
-- Your existing places stay Personal (group_id stays empty).

-- 1. PROFILES (display names, so cards can say "added by Riya") ---------------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text
);
alter table profiles enable row level security;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- profiles for people who already have an account
insert into profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- 2. GROUPS AND MEMBERS ------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now()
);

create table if not exists group_members (
  group_id uuid not null references groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table groups enable row level security;
alter table group_members enable row level security;

-- empty group_id = personal entry, filled = belongs to that group
alter table places add column if not exists group_id uuid references groups on delete cascade;
create index if not exists places_group_idx on places (group_id);

-- 3. HELPER FUNCTIONS (used by the security rules) ---------------------------
create or replace function is_group_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid())
$$;

create or replace function is_group_owner(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members
                 where group_id = gid and user_id = auth.uid() and role = 'owner')
$$;

create or replace function shares_group_with(uid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members a
                 join group_members b on a.group_id = b.group_id
                 where a.user_id = auth.uid() and b.user_id = uid)
$$;

-- 4. CREATE / JOIN (run on the server so nobody can add themselves to a group) -
create or replace function create_group(gname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if char_length(trim(coalesce(gname, ''))) = 0 then raise exception 'Group name is required'; end if;
  insert into groups (name, owner_id) values (trim(gname), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end $$;

create or replace function join_group(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into gid from groups
   where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  if gid is null then raise exception 'Invalid invite code'; end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end $$;

revoke all on function create_group(text), join_group(text) from public, anon;
grant execute on function create_group(text), join_group(text) to authenticated;

-- 5. SECURITY RULES ----------------------------------------------------------
drop policy if exists "own places" on places;
drop policy if exists "own dishes" on dishes;

-- profiles: you see yourself and people who share a group with you
create policy "profiles read" on profiles for select to authenticated
  using (id = auth.uid() or shares_group_with(id));
create policy "profiles insert own" on profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles update own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: members can see them, only the owner can delete
create policy "groups read" on groups for select to authenticated
  using (is_group_member(id));
create policy "groups delete" on groups for delete to authenticated
  using (owner_id = auth.uid());

-- members: see your group's members; leave yourself, or the owner removes someone
create policy "members read" on group_members for select to authenticated
  using (is_group_member(group_id));
create policy "members leave or remove" on group_members for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or is_group_owner(group_id)));

-- places: personal = only you. group = only its members.
create policy "places read" on places for select to authenticated
  using ((group_id is null and user_id = auth.uid())
      or (group_id is not null and is_group_member(group_id)));

create policy "places insert" on places for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or is_group_member(group_id)));

create policy "places update" on places for update to authenticated
  using (user_id = auth.uid() or (group_id is not null and is_group_owner(group_id)))
  with check ((group_id is null and user_id = auth.uid())
           or (group_id is not null and is_group_member(group_id)));

create policy "places delete" on places for delete to authenticated
  using (user_id = auth.uid() or (group_id is not null and is_group_owner(group_id)));

-- dishes: you can see dishes of any place you can see,
-- and change dishes only on places you may edit (your own, or any if you own the group)
create policy "dishes read" on dishes for select to authenticated
  using (exists (select 1 from places p where p.id = dishes.place_id));

create policy "dishes insert" on dishes for insert to authenticated
  with check (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))));

create policy "dishes update" on dishes for update to authenticated
  using (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))))
  with check (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))));

create policy "dishes delete" on dishes for delete to authenticated
  using (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))));
