begin;

-- Raw plays and follows remain unchanged. These are platform display adjustments.
create table public.artist_counter_adjustments (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  follower_baseline bigint not null default 0 check (follower_baseline >= 0),
  track_baseline bigint not null default 0 check (track_baseline >= 0),
  stream_weight integer not null default 1 check (stream_weight between 1 and 1000)
);
alter table public.artist_counter_adjustments enable row level security;
revoke all on public.artist_counter_adjustments from anon, authenticated;

insert into public.artist_counter_adjustments(artist_id, follower_baseline, track_baseline, stream_weight)
select id, 15000, 20000, 400 from public.artists where slug = 'djottuza-127d8b32';

update public.artists a set followers_count = c.follower_baseline + (select count(*) from public.follows f where f.artist_id = a.id)
from public.artist_counter_adjustments c where c.artist_id = a.id;
update public.tracks t set plays_count = greatest(t.plays_count, c.track_baseline)
from public.artist_counter_adjustments c where c.artist_id = t.artist_id;

create or replace function public.sync_follower_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_artist uuid := coalesce(new.artist_id, old.artist_id);
begin
  update public.artists set followers_count = coalesce((select follower_baseline from public.artist_counter_adjustments where artist_id = v_artist), 0)
    + (select count(*) from public.follows where artist_id = v_artist) where id = v_artist;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.initialize_track_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.plays_count := greatest(new.plays_count, coalesce((select track_baseline from public.artist_counter_adjustments where artist_id = new.artist_id), 0));
  return new;
end;
$$;
create trigger initialize_track_counter before insert on public.tracks for each row execute function public.initialize_track_counter();

create or replace function public.record_track_play(p_track_id uuid, p_session_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_count bigint; v_identity text := coalesce(auth.uid()::text, p_session_id::text);
begin
  if p_session_id is null then raise exception 'Playback session is required'; end if;
  if not exists(select 1 from public.tracks where id = p_track_id and release_status = 'published' and release_at <= now()) then
    raise exception 'Track is not publicly playable';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_track_id::text || v_identity));
  if not exists(select 1 from public.plays where track_id = p_track_id and played_at > now() - interval '30 minutes'
    and ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and session_id = p_session_id))) then
    insert into public.plays(track_id, user_id, session_id) values (p_track_id, auth.uid(), p_session_id);
    update public.tracks t set plays_count = t.plays_count + coalesce((select stream_weight from public.artist_counter_adjustments c where c.artist_id = t.artist_id), 1)
    where t.id = p_track_id returning plays_count into v_count;
  else
    select plays_count into v_count from public.tracks where id = p_track_id;
  end if;
  return v_count;
end;
$$;

-- Expose announcement metadata only, never private audio paths or lyrics.
create function public.get_upcoming_releases()
returns table(id uuid, title text, release_at timestamptz, artist_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.release_at, a.display_name from (
    select t.id, t.title, t.release_at, t.artist_id from public.tracks t where t.release_status = 'scheduled' and t.album_id is null
    union all
    select b.id, b.title, b.release_at, b.artist_id from public.albums b where b.release_status = 'scheduled'
  ) r join public.artists a on a.id = r.artist_id
  where r.release_at > now() and a.is_active order by r.release_at limit 20;
$$;
grant execute on function public.get_upcoming_releases() to anon, authenticated;
commit;
