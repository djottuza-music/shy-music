begin;

alter type public.release_type add value if not exists 'mixtape';
alter type public.release_type add value if not exists 'compilation';

alter table public.tracks
  add column if not exists genres text[] not null default '{}',
  add column if not exists moods text[] not null default '{}',
  add column if not exists featured_artists text[] not null default '{}',
  add column if not exists ai_tool text,
  add column if not exists bpm integer,
  add column if not exists key_signature text,
  add column if not exists description text,
  add column if not exists custom_tags text[] not null default '{}',
  add column if not exists scheduled_at timestamptz,
  add column if not exists downloads_count bigint not null default 0,
  add column if not exists is_bonus boolean not null default false;

update public.tracks set genres = array[genre] where cardinality(genres) = 0 and nullif(trim(genre), '') is not null;
update public.tracks set moods = array[mood] where cardinality(moods) = 0 and nullif(trim(mood), '') is not null;
update public.tracks set scheduled_at = release_at where release_status = 'scheduled' and scheduled_at is null;

alter table public.tracks
  add constraint tracks_genres_limit check (cardinality(genres) between 0 and 3),
  add constraint tracks_moods_limit check (cardinality(moods) between 0 and 3),
  add constraint tracks_tags_limit check (cardinality(custom_tags) <= 5),
  add constraint tracks_bpm_range check (bpm is null or bpm between 20 and 300),
  add constraint tracks_key_signature_valid check (key_signature is null or key_signature ~ '^(C|C#|D|D#|E|F|F#|G|G#|A|A#|B) (major|minor)$'),
  add constraint tracks_description_limit check (description is null or char_length(description) <= 1000);

alter table public.albums
  add column if not exists genres text[] not null default '{}',
  add column if not exists moods text[] not null default '{}',
  add column if not exists featured_artists text[] not null default '{}',
  add column if not exists description text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists total_tracks integer not null default 0,
  add column if not exists total_duration_seconds integer not null default 0;

update public.albums set scheduled_at = release_at where release_status = 'scheduled' and scheduled_at is null;

alter table public.albums
  add constraint albums_genres_limit check (cardinality(genres) between 0 and 3),
  add constraint albums_moods_limit check (cardinality(moods) between 0 and 3),
  add constraint albums_description_limit check (description is null or char_length(description) <= 500),
  add constraint albums_track_count_range check (total_tracks between 0 and 30),
  add constraint albums_duration_nonnegative check (total_duration_seconds >= 0);

create table if not exists public.album_tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  song_id uuid not null references public.tracks(id) on delete cascade,
  track_number integer not null check (track_number between 1 and 30),
  is_bonus boolean not null default false,
  created_at timestamptz not null default now(),
  unique (album_id, song_id),
  unique (album_id, track_number)
);

insert into public.album_tracks(album_id, song_id, track_number, is_bonus)
select album_id, id, track_number, is_bonus
from public.tracks
where album_id is not null and track_number is not null
on conflict do nothing;

alter table public.artists
  add column if not exists tagline text,
  add column if not exists location text,
  add column if not exists instagram_url text,
  add column if not exists twitter_url text,
  add column if not exists youtube_url text,
  add column if not exists tiktok_url text,
  add column if not exists facebook_url text,
  add column if not exists soundcloud_url text,
  add column if not exists website_url text,
  add column if not exists contact_email text,
  add column if not exists founding_artist boolean not null default false,
  add column if not exists premium boolean not null default false,
  add column if not exists motivation_count bigint not null default 0;

alter table public.artists
  add constraint artists_tagline_limit check (tagline is null or char_length(tagline) <= 80);

create table if not exists public.artist_private_details (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  mobile_phone text,
  mobile_money_number text,
  mobile_money_network text check (mobile_money_network is null or mobile_money_network in ('MTN','Airtel','Zamtel')),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_subscriptions (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  plan_name text not null default 'Founding Artist',
  status text not null default 'active' check (status in ('active','pending','expired')),
  renews_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.artist_subscriptions(artist_id)
select id from public.artists
on conflict (artist_id) do nothing;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references public.tracks(id) on delete cascade,
  album_id uuid references public.albums(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check ((track_id is not null)::integer + (album_id is not null)::integer = 1)
);

create index if not exists tracks_genres_idx on public.tracks using gin(genres);
create index if not exists tracks_moods_idx on public.tracks using gin(moods);
create index if not exists albums_genres_idx on public.albums using gin(genres);
create index if not exists albums_moods_idx on public.albums using gin(moods);
create index if not exists album_tracks_order_idx on public.album_tracks(album_id, track_number);
create index if not exists comments_track_idx on public.comments(track_id, created_at desc);
create index if not exists comments_album_idx on public.comments(album_id, created_at desc);

alter table public.album_tracks enable row level security;
alter table public.artist_private_details enable row level security;
alter table public.artist_subscriptions enable row level security;
alter table public.comments enable row level security;

create policy album_tracks_visible_select on public.album_tracks for select using (
  exists(select 1 from public.albums a where a.id = album_id and ((a.release_status = 'published' and a.release_at <= now()) or public.owns_artist(a.artist_id) or public.has_role(auth.uid(), 'admin')))
);
create policy album_tracks_owner_all on public.album_tracks for all using (
  exists(select 1 from public.albums a where a.id = album_id and (public.owns_artist(a.artist_id) or public.has_role(auth.uid(), 'admin')))
) with check (
  exists(select 1 from public.albums a where a.id = album_id and (public.owns_artist(a.artist_id) or public.has_role(auth.uid(), 'admin')))
);
create policy artist_private_owner_admin on public.artist_private_details for all using (
  exists(select 1 from public.artists a where a.id = artist_id and (a.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
) with check (
  exists(select 1 from public.artists a where a.id = artist_id and (a.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
);
create policy subscriptions_owner_admin_select on public.artist_subscriptions for select using (
  exists(select 1 from public.artists a where a.id = artist_id and (a.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
);
create policy subscriptions_admin_all on public.artist_subscriptions for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy comments_public_select on public.comments for select using (
  exists(select 1 from public.tracks t where t.id = track_id and t.release_status = 'published' and t.release_at <= now())
  or exists(select 1 from public.albums a where a.id = album_id and a.release_status = 'published' and a.release_at <= now())
);
create policy comments_owner_insert on public.comments for insert with check (user_id = auth.uid());
create policy comments_owner_delete on public.comments for delete using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy profiles_public_identity_select on public.profiles for select using (not is_suspended);
create policy plays_artist_select on public.plays for select using (
  exists(select 1 from public.tracks t where t.id = track_id and (public.owns_artist(t.artist_id) or public.has_role(auth.uid(), 'admin')))
);
create policy downloads_artist_select on public.downloads for select using (
  exists(select 1 from public.tracks t where t.id = track_id and (public.owns_artist(t.artist_id) or public.has_role(auth.uid(), 'admin')))
);
grant select on public.plays, public.downloads to authenticated;

create or replace function public.sync_album_totals(p_album_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.albums
  set total_tracks = (select count(*) from public.album_tracks where album_id = p_album_id),
      total_duration_seconds = coalesce((select sum(t.duration_seconds) from public.album_tracks at join public.tracks t on t.id = at.song_id where at.album_id = p_album_id), 0)
  where id = p_album_id;
$$;

create or replace function public.album_tracks_sync_totals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_album_totals(old.album_id);
    return old;
  end if;
  perform public.sync_album_totals(new.album_id);
  if tg_op = 'UPDATE' and old.album_id is distinct from new.album_id then
    perform public.sync_album_totals(old.album_id);
  end if;
  return new;
end;
$$;

create trigger album_tracks_totals_after
after insert or update or delete on public.album_tracks
for each row execute function public.album_tracks_sync_totals();

create or replace function public.sync_track_metadata_compatibility()
returns trigger language plpgsql set search_path = public as $$
begin
  if cardinality(new.genres) = 0 and nullif(trim(new.genre), '') is not null then new.genres := array[new.genre]; end if;
  if cardinality(new.moods) = 0 and nullif(trim(new.mood), '') is not null then new.moods := array[new.mood]; end if;
  new.genre := new.genres[1];
  new.mood := new.moods[1];
  if new.release_status = 'scheduled' then new.scheduled_at := coalesce(new.scheduled_at, new.release_at); end if;
  return new;
end;
$$;

create trigger tracks_metadata_compatibility before insert or update on public.tracks
for each row execute function public.sync_track_metadata_compatibility();

create or replace function public.count_track_download()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.tracks set downloads_count = downloads_count + 1 where id = new.track_id;
  return new;
end;
$$;

create trigger downloads_track_counter after insert on public.downloads
for each row execute function public.count_track_download();

create or replace function public.publish_due_releases()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.albums
  set release_status = 'published', release_at = scheduled_at
  where release_status = 'scheduled' and scheduled_at <= now();
  update public.tracks
  set release_status = 'published', release_at = scheduled_at
  where release_status = 'scheduled' and scheduled_at <= now();
end;
$$;
revoke all on function public.publish_due_releases() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if not exists(select 1 from cron.job where jobname = 'publish-shy-scheduled-releases') then
    perform cron.schedule('publish-shy-scheduled-releases', '* * * * *', 'select public.publish_due_releases()');
  end if;
exception when insufficient_privilege or undefined_file or undefined_table then
  raise notice 'pg_cron is unavailable; schedule public.publish_due_releases() once per minute in Supabase.';
end;
$$;

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/mp4','audio/aac']
where id = 'audio';

commit;
