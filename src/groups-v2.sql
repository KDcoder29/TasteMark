-- Tastemark v2: per-person ratings, reactions and comments, activity feed,
-- wishlist, and owner tools (new invite code, transfer ownership).
--
-- Run ONCE in Supabase -> SQL Editor -> New query -> Run.
-- You must have already run groups-setup.sql.

-- 0. HELPER ------------------------------------------------------------------
create or replace function dish_group_id(did uuid) returns uuid
language sql security definer stable set search_path = public as $$
  select p.group_id from dishes d join places p on p.id = d.place_id where d.id = did
$$;

-- 1. TABLES ------------------------------------------------------------------
-- one rating per person per dish (group dishes)
create table if not exists dish_ratings (
  dish_id uuid not null references dishes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  rating int not null check (rating between 1 and 5),
  order_again text check (order_again in ('yes', 'maybe', 'no')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (dish_id, user_id)
);

create table if not exists dish_reactions (
  dish_id uuid not null references dishes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz default now(),
  primary key (dish_id, user_id, emoji)
);

create table if not exists dish_comments (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dishes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz default now()
);
create index if not exists dish_comments_dish_idx on dish_comments (dish_id);

-- "want to try" list. group_id empty = personal wishlist
create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  group_id uuid references groups on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  city text,
  area text,
  categories text[] default '{}',
  note text,
  went_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists wishlist_group_idx on wishlist (group_id);

create table if not exists group_activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  user_id uuid references auth.users on delete set null,
  kind text not null,
  place_name text,
  dish_name text,
  detail text,
  created_at timestamptz default now()
);
create index if not exists group_activity_idx on group_activity (group_id, created_at desc);

alter table dish_ratings enable row level security;
alter table dish_reactions enable row level security;
alter table dish_comments enable row level security;
alter table wishlist enable row level security;
alter table group_activity enable row level security;

-- 2. MOVE EXISTING GROUP RATINGS INTO THE NEW TABLE ---------------------------
-- (done before the activity triggers exist, so it does not flood the feed)
insert into dish_ratings (dish_id, user_id, rating, order_again, note)
select d.id, d.user_id, d.rating,
       case when d.order_again in ('yes', 'maybe', 'no') then d.order_again end,
       d.note
from dishes d
join places p on p.id = d.place_id
where p.group_id is not null and d.rating between 1 and 5
on conflict do nothing;

-- 3. SECURITY RULES ----------------------------------------------------------
-- dishes: any member can add a dish to a group place;
-- a dish can be changed or removed by whoever added it, or by the group owner
drop policy if exists "dishes insert" on dishes;
drop policy if exists "dishes update" on dishes;
drop policy if exists "dishes delete" on dishes;

create policy "dishes insert" on dishes for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from places p where p.id = dishes.place_id
      and ((p.group_id is null and p.user_id = auth.uid())
        or (p.group_id is not null and is_group_member(p.group_id)))));

create policy "dishes update" on dishes for update to authenticated
  using (user_id = auth.uid() or is_group_owner(dish_group_id(id)))
  with check (user_id = auth.uid() or is_group_owner(dish_group_id(id)));

create policy "dishes delete" on dishes for delete to authenticated
  using (user_id = auth.uid() or is_group_owner(dish_group_id(id)));

-- ratings: everyone in the group sees them, you change only your own
drop policy if exists "ratings read" on dish_ratings;
drop policy if exists "ratings insert" on dish_ratings;
drop policy if exists "ratings update" on dish_ratings;
drop policy if exists "ratings delete" on dish_ratings;
create policy "ratings read" on dish_ratings for select to authenticated
  using (is_group_member(dish_group_id(dish_id)));
create policy "ratings insert" on dish_ratings for insert to authenticated
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "ratings update" on dish_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "ratings delete" on dish_ratings for delete to authenticated
  using (user_id = auth.uid());

-- reactions
drop policy if exists "reactions read" on dish_reactions;
drop policy if exists "reactions add" on dish_reactions;
drop policy if exists "reactions remove" on dish_reactions;
create policy "reactions read" on dish_reactions for select to authenticated
  using (is_group_member(dish_group_id(dish_id)));
create policy "reactions add" on dish_reactions for insert to authenticated
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "reactions remove" on dish_reactions for delete to authenticated
  using (user_id = auth.uid());

-- comments: delete your own; the group owner can delete any
drop policy if exists "comments read" on dish_comments;
drop policy if exists "comments add" on dish_comments;
drop policy if exists "comments remove" on dish_comments;
create policy "comments read" on dish_comments for select to authenticated
  using (is_group_member(dish_group_id(dish_id)));
create policy "comments add" on dish_comments for insert to authenticated
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "comments remove" on dish_comments for delete to authenticated
  using (user_id = auth.uid() or is_group_owner(dish_group_id(dish_id)));

-- wishlist: personal = only you. group = every member can see, add and mark visited;
-- only the person who added an item (or the owner) can delete it
drop policy if exists "wishlist read" on wishlist;
drop policy if exists "wishlist add" on wishlist;
drop policy if exists "wishlist update" on wishlist;
drop policy if exists "wishlist remove" on wishlist;
create policy "wishlist read" on wishlist for select to authenticated
  using ((group_id is null and user_id = auth.uid())
      or (group_id is not null and is_group_member(group_id)));
create policy "wishlist add" on wishlist for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy "wishlist update" on wishlist for update to authenticated
  using ((group_id is null and user_id = auth.uid())
      or (group_id is not null and is_group_member(group_id)))
  with check ((group_id is null and user_id = auth.uid())
           or (group_id is not null and is_group_member(group_id)));
create policy "wishlist remove" on wishlist for delete to authenticated
  using (user_id = auth.uid() or (group_id is not null and is_group_owner(group_id)));

-- activity feed: members can read. Only the triggers below can write.
drop policy if exists "activity read" on group_activity;
create policy "activity read" on group_activity for select to authenticated
  using (is_group_member(group_id));

-- 4. ACTIVITY TRIGGERS -------------------------------------------------------
create or replace function log_dish_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text;
begin
  select group_id, name into gid, pname from places where id = new.place_id;
  if gid is not null then
    insert into group_activity (group_id, user_id, kind, place_name, dish_name)
    values (gid, new.user_id, 'dish_added', pname, new.name);
  end if;
  return new;
end $$;
drop trigger if exists trg_dish_added on dishes;
create trigger trg_dish_added after insert on dishes
  for each row execute function log_dish_added();

create or replace function log_rating_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text; dname text;
begin
  select p.group_id, p.name, d.name into gid, pname, dname
    from dishes d join places p on p.id = d.place_id where d.id = new.dish_id;
  if gid is null then return new; end if;
  -- skip when the same person just added this dish (the feed would repeat itself)
  if exists (select 1 from group_activity
             where group_id = gid and kind = 'dish_added' and user_id = new.user_id
               and dish_name = dname and place_name = pname
               and created_at > now() - interval '15 seconds') then
    return new;
  end if;
  insert into group_activity (group_id, user_id, kind, place_name, dish_name, detail)
  values (gid, new.user_id, 'rated', pname, dname, new.rating::text);
  return new;
end $$;
drop trigger if exists trg_rating_added on dish_ratings;
create trigger trg_rating_added after insert on dish_ratings
  for each row execute function log_rating_added();

create or replace function log_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text; dname text;
begin
  select p.group_id, p.name, d.name into gid, pname, dname
    from dishes d join places p on p.id = d.place_id where d.id = new.dish_id;
  if gid is not null then
    insert into group_activity (group_id, user_id, kind, place_name, dish_name, detail)
    values (gid, new.user_id, 'commented', pname, dname, left(new.body, 80));
  end if;
  return new;
end $$;
drop trigger if exists trg_comment_added on dish_comments;
create trigger trg_comment_added after insert on dish_comments
  for each row execute function log_comment_added();

create or replace function log_member_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_activity (group_id, user_id, kind)
  values (new.group_id, new.user_id, case when new.role = 'owner' then 'created' else 'joined' end);
  return new;
end $$;
drop trigger if exists trg_member_added on group_members;
create trigger trg_member_added after insert on group_members
  for each row execute function log_member_added();

create or replace function log_wish_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null then
    insert into group_activity (group_id, user_id, kind, place_name)
    values (new.group_id, new.user_id, 'wish', new.name);
  end if;
  return new;
end $$;
drop trigger if exists trg_wish_added on wishlist;
create trigger trg_wish_added after insert on wishlist
  for each row execute function log_wish_added();

create or replace function log_wish_went() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.went_at is null and new.went_at is not null and new.group_id is not null then
    insert into group_activity (group_id, user_id, kind, place_name)
    values (new.group_id, auth.uid(), 'went', new.name);
  end if;
  return new;
end $$;
drop trigger if exists trg_wish_went on wishlist;
create trigger trg_wish_went after update on wishlist
  for each row execute function log_wish_went();

-- 5. OWNER TOOLS -------------------------------------------------------------
create or replace function regenerate_invite(gid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_group_owner(gid) then raise exception 'Only the group owner can do this'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update groups set invite_code = c where id = gid;
  return c;
end $$;

create or replace function transfer_ownership(gid uuid, new_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_owner(gid) then raise exception 'Only the group owner can do this'; end if;
  if new_owner = auth.uid() then raise exception 'You are already the owner'; end if;
  if not exists (select 1 from group_members where group_id = gid and user_id = new_owner) then
    raise exception 'That person is not in this group';
  end if;
  update group_members set role = 'member' where group_id = gid and user_id = auth.uid();
  update group_members set role = 'owner' where group_id = gid and user_id = new_owner;
  update groups set owner_id = new_owner where id = gid;
  insert into group_activity (group_id, user_id, kind) values (gid, new_owner, 'owner');
end $$;

revoke all on function regenerate_invite(uuid), transfer_ownership(uuid, uuid) from public, anon;
grant execute on function regenerate_invite(uuid), transfer_ownership(uuid, uuid) to authenticated;
