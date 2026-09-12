begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('listener', 'artist', 'admin');
create type public.release_status as enum ('draft', 'scheduled', 'published', 'archived');
create type public.release_type as enum ('single', 'ep', 'album');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  username text unique,
  avatar_url text,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  bio text check (char_length(bio) <= 2000),
  avatar_url text,
  banner_url text,
  country text,
  verified boolean not null default false,
  followers_count bigint not null default 0 check (followers_count >= 0),
  tags text[] not null default '{}',
  motivation_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique,
  cover_path text,
  release_type public.release_type not null default 'album',
  release_status public.release_status not null default 'draft',
  release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (release_status not in ('scheduled', 'published') or release_at is not null)
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  album_id uuid references public.albums(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique,
  audio_path text not null unique,
  cover_path text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  track_number integer check (track_number > 0),
  genre text,
  mood text,
  lyrics text,
  explicit boolean not null default false,
  downloadable boolean not null default true,
  release_status public.release_status not null default 'draft',
  release_at timestamptz,
  plays_count bigint not null default 0 check (plays_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (release_status not in ('scheduled', 'published') or release_at is not null)
);

create table public.plays (
  id bigint generated always as identity primary key,
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid not null,
  played_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table public.follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null check (position >= 0),
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id),
  unique (playlist_id, position)
);

create table public.downloads (
  id bigint generated always as identity primary key,
  track_id uuid not null references public.tracks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid,
  downloaded_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.motivation_methods (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  provider text not null,
  account_name text not null,
  phone_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile','artist','album','track','playlist')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index albums_artist_idx on public.albums(artist_id, release_at desc);
create index tracks_artist_idx on public.tracks(artist_id, release_at desc);
create index tracks_album_idx on public.tracks(album_id, track_number);
create index tracks_popular_idx on public.tracks(plays_count desc) where release_status = 'published';
create index plays_track_time_idx on public.plays(track_id, played_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger artists_touch before update on public.artists for each row execute function public.touch_updated_at();
create trigger albums_touch before update on public.albums for each row execute function public.touch_updated_at();
create trigger tracks_touch before update on public.tracks for each row execute function public.touch_updated_at();
create trigger playlists_touch before update on public.playlists for each row execute function public.touch_updated_at();

create or replace function public.has_role(p_user_id uuid, p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = p_user_id and role = p_role);
$$;

create or replace function public.owns_artist(p_artist_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.artists where id = p_artist_id and user_id = auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1));
  v_slug text;
begin
  insert into public.profiles(id, display_name) values (new.id, left(v_name, 80));
  insert into public.user_roles(user_id, role) values (new.id, 'listener');
  if new.raw_user_meta_data->>'account_type' = 'artist' then
    insert into public.user_roles(user_id, role) values (new.id, 'artist') on conflict do nothing;
    v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')) || '-' || substring(new.id::text, 1, 8);
    insert into public.artists(user_id, display_name, slug) values (new.id, left(v_name, 100), v_slug);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.sync_follower_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_artist uuid := coalesce(new.artist_id, old.artist_id);
begin
  update public.artists set followers_count = (select count(*) from public.follows where artist_id = v_artist) where id = v_artist;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger follows_count_after after insert or delete on public.follows for each row execute function public.sync_follower_count();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.plays enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.downloads enable row level security;
alter table public.notifications enable row level security;
alter table public.motivation_methods enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy profiles_self_update on public.profiles for update using (id = auth.uid() and not is_suspended) with check (id = auth.uid());
create policy roles_self_select on public.user_roles for select using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy artists_public_select on public.artists for select using (is_active or user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy artists_owner_update on public.artists for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy artists_admin_all on public.artists for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy albums_visible_select on public.albums for select using (
  (release_status = 'published' and release_at <= now()) or public.owns_artist(artist_id) or public.has_role(auth.uid(), 'admin')
);
create policy albums_owner_insert on public.albums for insert with check (public.owns_artist(artist_id));
create policy albums_owner_update on public.albums for update using (public.owns_artist(artist_id)) with check (public.owns_artist(artist_id));
create policy albums_owner_delete on public.albums for delete using (public.owns_artist(artist_id) or public.has_role(auth.uid(), 'admin'));

create policy tracks_visible_select on public.tracks for select using (
  (release_status = 'published' and release_at <= now()) or public.owns_artist(artist_id) or public.has_role(auth.uid(), 'admin')
);
create policy tracks_owner_insert on public.tracks for insert with check (public.owns_artist(artist_id));
create policy tracks_owner_update on public.tracks for update using (public.owns_artist(artist_id)) with check (public.owns_artist(artist_id));
create policy tracks_owner_delete on public.tracks for delete using (public.owns_artist(artist_id) or public.has_role(auth.uid(), 'admin'));

create policy likes_owner_all on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy follows_owner_all on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy playlists_select on public.playlists for select using (is_public or user_id = auth.uid());
create policy playlists_owner_all on public.playlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy playlist_tracks_select on public.playlist_tracks for select using (exists(select 1 from public.playlists p where p.id = playlist_id and (p.is_public or p.user_id = auth.uid())));
create policy playlist_tracks_owner_all on public.playlist_tracks for all using (exists(select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())) with check (exists(select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));
create policy downloads_owner_select on public.downloads for select using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy notifications_owner_all on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy motivation_public_select on public.motivation_methods for select using (is_active);
create policy motivation_owner_all on public.motivation_methods for all using (public.owns_artist(artist_id)) with check (public.owns_artist(artist_id));
create policy reports_insert on public.reports for insert with check (reporter_id is null or reporter_id = auth.uid());
create policy reports_admin_select on public.reports for select using (public.has_role(auth.uid(), 'admin'));
create policy reports_admin_update on public.reports for update using (public.has_role(auth.uid(), 'admin'));
create policy audit_admin_select on public.audit_log for select using (public.has_role(auth.uid(), 'admin'));

revoke all on public.plays from anon, authenticated;
revoke all on public.downloads from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

create or replace function public.get_track_media_path(p_track_id uuid, p_download boolean default false)
returns text language plpgsql security definer set search_path = public, storage as $$
declare v_track public.tracks;
begin
  select * into v_track from public.tracks where id = p_track_id;
  if v_track.id is null then raise exception 'Track not found'; end if;
  if not (
    (v_track.release_status = 'published' and v_track.release_at <= now())
    or public.owns_artist(v_track.artist_id)
    or public.has_role(auth.uid(), 'admin')
  ) then raise exception 'Track is not available'; end if;
  if p_download and not v_track.downloadable then raise exception 'Download is disabled'; end if;
  if p_download then
    insert into public.downloads(track_id, user_id) values (p_track_id, auth.uid());
  end if;
  return v_track.audio_path;
end;
$$;

create or replace function public.record_track_play(p_track_id uuid, p_session_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_count bigint;
begin
  if not exists(select 1 from public.tracks where id = p_track_id and release_status = 'published' and release_at <= now()) then
    raise exception 'Track is not publicly playable';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_track_id::text || p_session_id::text));
  if not exists(select 1 from public.plays where track_id = p_track_id and session_id = p_session_id and played_at > now() - interval '30 minutes') then
    insert into public.plays(track_id, user_id, session_id) values (p_track_id, auth.uid(), p_session_id);
    update public.tracks set plays_count = plays_count + 1 where id = p_track_id returning plays_count into v_count;
  else
    select plays_count into v_count from public.tracks where id = p_track_id;
  end if;
  return v_count;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.app_role, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() and p_role = 'admin' and not p_enabled then raise exception 'You cannot remove your own admin role'; end if;
  if p_enabled then insert into public.user_roles(user_id, role) values (p_user_id, p_role) on conflict do nothing;
  else delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  insert into public.audit_log(actor_id, action, target_type, target_id, details) values (auth.uid(), 'role_changed', 'profile', p_user_id, jsonb_build_object('role', p_role, 'enabled', p_enabled));
end;
$$;

create or replace function public.admin_set_user_suspension(p_user_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot suspend your own account'; end if;
  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  update public.artists set is_active = not p_suspended where user_id = p_user_id;
  insert into public.audit_log(actor_id, action, target_type, target_id, details) values (auth.uid(), 'suspension_changed', 'profile', p_user_id, jsonb_build_object('suspended', p_suspended));
end;
$$;

grant execute on function public.get_track_media_path(uuid, boolean) to anon, authenticated;
grant execute on function public.record_track_play(uuid, uuid) to anon, authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role, boolean) to authenticated;
grant execute on function public.admin_set_user_suspension(uuid, boolean) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('covers', 'covers', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('audio', 'audio', false, 62914560, array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg','audio/webm']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('banners', 'banners', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy public_images_select on storage.objects for select using (bucket_id in ('covers','avatars','banners'));
create policy artist_media_insert on storage.objects for insert with check (
  bucket_id in ('covers','audio','avatars','banners') and exists(
    select 1 from public.artists a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
);
create policy artist_media_update on storage.objects for update using (
  bucket_id in ('covers','audio','avatars','banners') and exists(
    select 1 from public.artists a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
);
create policy artist_media_delete on storage.objects for delete using (
  bucket_id in ('covers','audio','avatars','banners') and exists(
    select 1 from public.artists a where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
);
create policy published_audio_select on storage.objects for select using (
  bucket_id = 'audio' and exists(
    select 1 from public.tracks t where t.audio_path = name and (
      (t.release_status = 'published' and t.release_at <= now()) or public.owns_artist(t.artist_id) or public.has_role(auth.uid(), 'admin')
    )
  )
);

commit;
