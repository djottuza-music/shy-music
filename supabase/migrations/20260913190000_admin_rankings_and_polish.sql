begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_platform_verified boolean not null default false;

alter table public.notifications
  add column if not exists type text not null default 'general',
  add column if not exists is_read boolean not null default false;

update public.profiles p
set is_admin = true
where p.id in (
  select id from auth.users where lower(email) in ('kundaeliko99@gmail.com', 'djottuza@gmail.com')
);

insert into public.user_roles(user_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) in ('kundaeliko99@gmail.com', 'djottuza@gmail.com')
on conflict do nothing;

update public.profiles p
set is_platform_verified = true
where exists (
  select 1 from public.artists a
  where a.user_id = p.id and (lower(a.display_name) = 'kopa' or lower(a.display_name) like 'kopa & dj ottuza%')
);

update public.artists
set verified = true
where lower(display_name) = 'kopa' or lower(display_name) like 'kopa & dj ottuza%';

create or replace function public.has_role(p_user_id uuid, p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_role = 'admin' then exists(select 1 from public.profiles where id = p_user_id and is_admin)
      or exists(select 1 from public.user_roles where user_id = p_user_id and role = p_role)
    else exists(select 1 from public.user_roles where user_id = p_user_id and role = p_role)
  end;
$$;

create or replace function public.record_track_play(p_track_id uuid, p_session_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_count bigint; v_identity text := coalesce(auth.uid()::text, p_session_id::text);
begin
  if p_session_id is null then raise exception 'Playback session is required'; end if;
  if not exists(select 1 from public.tracks where id = p_track_id and release_status = 'published' and release_at <= now()) then
    raise exception 'Track is not publicly playable';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_track_id::text || v_identity));
  if not exists(
    select 1 from public.plays
    where track_id = p_track_id and played_at > now() - interval '30 minutes'
      and ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and session_id = p_session_id))
  ) then
    insert into public.plays(track_id, user_id, session_id) values (p_track_id, auth.uid(), p_session_id);
    update public.tracks set plays_count = plays_count + 1 where id = p_track_id returning plays_count into v_count;
  else
    select plays_count into v_count from public.tracks where id = p_track_id;
  end if;
  return v_count;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role, p_enabled boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if p_role = 'admin' and not p_enabled and exists(select 1 from auth.users where id = p_user_id and lower(email) in ('kundaeliko99@gmail.com', 'djottuza@gmail.com')) then
    raise exception 'Permanent SHY admins cannot be removed';
  end if;
  if p_enabled then insert into public.user_roles(user_id, role) values (p_user_id, p_role) on conflict do nothing;
  else delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  insert into public.audit_log(actor_id, action, target_type, target_id, details) values (auth.uid(), 'role_changed', 'profile', p_user_id, jsonb_build_object('role', p_role, 'enabled', p_enabled));
end;
$$;

create or replace function public.admin_set_user_suspension(p_user_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if exists(select 1 from auth.users where id = p_user_id and lower(email) in ('kundaeliko99@gmail.com', 'djottuza@gmail.com')) then
    raise exception 'Permanent SHY admins cannot be suspended';
  end if;
  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  update public.artists set is_active = not p_suspended where user_id = p_user_id;
  insert into public.audit_log(actor_id, action, target_type, target_id, details) values (auth.uid(), 'suspension_changed', 'profile', p_user_id, jsonb_build_object('suspended', p_suspended));
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1));
  v_slug text;
  v_admin boolean := lower(coalesce(new.email, '')) in ('kundaeliko99@gmail.com', 'djottuza@gmail.com');
begin
  insert into public.profiles(id, display_name, is_admin)
  values (new.id, left(v_name, 80), v_admin);
  insert into public.user_roles(user_id, role) values (new.id, 'listener');
  if v_admin then insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing; end if;
  if new.raw_user_meta_data->>'account_type' = 'artist' then
    insert into public.user_roles(user_id, role) values (new.id, 'artist') on conflict do nothing;
    v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')) || '-' || substring(new.id::text, 1, 8);
    insert into public.artists(user_id, display_name, slug) values (new.id, left(v_name, 100), v_slug);
  end if;
  return new;
end;
$$;

create or replace function public.admin_set_artist_verified(p_artist_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid; v_name text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  select user_id, display_name into v_user_id, v_name from public.artists where id = p_artist_id;
  if v_user_id is null then raise exception 'Artist not found'; end if;
  update public.artists set verified = p_verified where id = p_artist_id;
  update public.profiles set is_platform_verified = p_verified where id = v_user_id;
  insert into public.notifications(user_id, type, title, body, link)
  values (v_user_id, 'verification', case when p_verified then 'Artist profile verified' else 'Verification removed' end,
    case when p_verified then 'Congratulations! SHY Music has verified your artist profile. A blue verified badge now appears next to your name across the platform.' else 'Your SHY verified badge has been removed by the platform.' end,
    '/artists/' || (select slug from public.artists where id = p_artist_id));
  insert into public.audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_verified then 'artist_verified' else 'artist_unverified' end, 'artist', p_artist_id, jsonb_build_object('artist_name', v_name));
end;
$$;
grant execute on function public.admin_set_artist_verified(uuid, boolean) to authenticated;

create or replace function public.admin_pending_count()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.has_role(auth.uid(), 'admin') then
    (select count(*) from public.artist_subscriptions where status = 'pending')
    + (select count(*) from public.reports where status = 'open')
    + (select count(*) from public.support_requests where status = 'open')
  else 0 end;
$$;
grant execute on function public.admin_pending_count() to authenticated;

create or replace function public.get_track_rankings(p_days integer default 7, p_limit integer default 20, p_metric text default 'plays')
returns table(track_id uuid, play_count bigint, unique_listeners bigint)
language sql stable security definer set search_path = public as $$
  select p.track_id, count(*)::bigint, count(distinct coalesce(p.user_id::text, p.session_id::text))::bigint
  from public.plays p
  join public.tracks t on t.id = p.track_id
  where p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
    and t.release_status = 'published' and t.release_at <= now()
  group by p.track_id
  order by case when p_metric = 'listeners' then count(distinct coalesce(p.user_id::text, p.session_id::text)) else count(*) end desc,
    count(*) desc
  limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.get_track_rankings(integer, integer, text) to anon, authenticated;

create or replace function public.get_album_rankings(p_days integer default 7, p_limit integer default 4)
returns table(album_id uuid, play_count bigint)
language sql stable security definer set search_path = public as $$
  select t.album_id, count(*)::bigint
  from public.plays p join public.tracks t on t.id = p.track_id join public.albums a on a.id = t.album_id
  where p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
    and t.album_id is not null and a.release_status = 'published' and a.release_at <= now()
  group by t.album_id order by count(*) desc limit greatest(1, least(p_limit, 20));
$$;
grant execute on function public.get_album_rankings(integer, integer) to anon, authenticated;

create table if not exists public.fan_of_the_week (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total_plays bigint not null check (total_plays >= 0),
  most_played_artist_id uuid references public.artists(id) on delete set null,
  most_played_song_id uuid references public.tracks(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);
alter table public.fan_of_the_week enable row level security;
create policy fan_week_public_select on public.fan_of_the_week for select using (true);

create or replace function public.refresh_fan_of_the_week()
returns void language plpgsql security definer set search_path = public as $$
declare v_start date := date_trunc('week', now())::date; v_winner record;
begin
  select p.user_id, count(*)::bigint as total_plays into v_winner
  from public.plays p where p.user_id is not null and p.played_at >= v_start
  group by p.user_id order by count(*) desc limit 1;
  if v_winner.user_id is null then return; end if;
  insert into public.fan_of_the_week(user_id, week_start, week_end, total_plays, most_played_artist_id, most_played_song_id)
  select v_winner.user_id, v_start, v_start + 7, v_winner.total_plays, t.artist_id, p.track_id
  from public.plays p join public.tracks t on t.id = p.track_id
  where p.user_id = v_winner.user_id and p.played_at >= v_start
  group by p.track_id, t.artist_id order by count(*) desc limit 1
  on conflict (user_id, week_start) do update set total_plays = excluded.total_plays, most_played_artist_id = excluded.most_played_artist_id, most_played_song_id = excluded.most_played_song_id;
  if not exists(select 1 from public.notifications where user_id = v_winner.user_id and type = 'fan_week' and created_at >= v_start) then
    insert into public.notifications(user_id, type, title, body, link) values (v_winner.user_id, 'fan_week', 'Fan of the Week', '🏆 You are SHY''s Fan of the Week! Your love for music has been noticed.', '/');
  end if;
end;
$$;

create table if not exists public.motivation_clicks (
  id bigint generated always as identity primary key,
  artist_id uuid not null references public.artists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.motivation_clicks enable row level security;
create policy motivation_click_owner_insert on public.motivation_clicks for insert with check (user_id = auth.uid());
create policy motivation_click_owner_select on public.motivation_clicks for select using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.record_motivation_click(p_artist_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_count bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to motivate an artist'; end if;
  if not exists(select 1 from public.motivation_clicks where artist_id = p_artist_id and user_id = auth.uid() and created_at > now() - interval '24 hours') then
    insert into public.motivation_clicks(artist_id, user_id) values (p_artist_id, auth.uid());
    update public.artists set motivation_count = motivation_count + 1 where id = p_artist_id;
  end if;
  select motivation_count into v_count from public.artists where id = p_artist_id;
  return coalesce(v_count, 0);
end;
$$;
grant execute on function public.record_motivation_click(uuid) to authenticated;

create or replace function public.sanitize_plain_text(value text)
returns text language sql immutable parallel safe as $$ select nullif(trim(regexp_replace(coalesce(value, ''), '<[^>]*>', '', 'g')), '') $$;

create or replace function public.comments_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 5 then raise exception 'Please wait before posting another comment'; end if;
  new.body := public.sanitize_plain_text(new.body);
  if new.body is null then raise exception 'Comment cannot be empty'; end if;
  return new;
end;
$$;
create trigger comments_guard_before before insert or update on public.comments for each row execute function public.comments_guard();

create or replace function public.sanitize_catalog_text()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'tracks' then new.description := public.sanitize_plain_text(new.description); end if;
  if tg_table_name = 'albums' then new.description := public.sanitize_plain_text(new.description); end if;
  if tg_table_name = 'artists' then new.bio := public.sanitize_plain_text(new.bio); new.tagline := public.sanitize_plain_text(new.tagline); end if;
  return new;
end;
$$;
create trigger tracks_sanitize_text before insert or update on public.tracks for each row execute function public.sanitize_catalog_text();
create trigger albums_sanitize_text before insert or update on public.albums for each row execute function public.sanitize_catalog_text();
create trigger artists_sanitize_text before insert or update on public.artists for each row execute function public.sanitize_catalog_text();

create or replace function public.notifications_read_sync()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_read and new.read_at is null then new.read_at := now(); end if;
  if new.read_at is not null then new.is_read := true; end if;
  return new;
end;
$$;
create trigger notifications_read_before before insert or update on public.notifications for each row execute function public.notifications_read_sync();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  if not exists(select 1 from cron.job where jobname = 'refresh-shy-weekly-features') then
    perform cron.schedule('refresh-shy-weekly-features', '1 0 * * 1', 'select public.refresh_fan_of_the_week()');
  end if;
exception when insufficient_privilege or undefined_file or undefined_table then
  raise notice 'pg_cron unavailable; schedule public.refresh_fan_of_the_week() every Monday at 00:01.';
end;
$$;

commit;
