begin;

create table if not exists public.artist_counter_adjustments (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  follower_baseline bigint not null default 0 check (follower_baseline >= 0),
  track_baseline bigint not null default 0 check (track_baseline >= 0),
  stream_weight integer not null default 1 check (stream_weight between 1 and 1000),
  listener_baseline bigint not null default 0 check (listener_baseline >= 0)
);
alter table public.artist_counter_adjustments enable row level security;
revoke all on public.artist_counter_adjustments from anon, authenticated;

-- KOPA's display contract: every qualified play adds 200 to the track total.
insert into public.artist_counter_adjustments(
  artist_id,
  follower_baseline,
  track_baseline,
  stream_weight,
  listener_baseline
)
select id, 15000, 20000, 200, 10000
from public.artists
where lower(display_name) = 'kopa' or slug = 'djottuza-127d8b32'
on conflict (artist_id) do update set
  track_baseline = 20000,
  stream_weight = 200,
  listener_baseline = 10000;

update public.tracks t
set plays_count = greatest(t.plays_count, c.track_baseline)
from public.artist_counter_adjustments c
where c.artist_id = t.artist_id;

create or replace function public.record_track_play(p_track_id uuid, p_session_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_count bigint;
  v_identity text := coalesce(auth.uid()::text, p_session_id::text);
begin
  if p_session_id is null then raise exception 'Playback session is required'; end if;
  if not exists(
    select 1 from public.tracks
    where id = p_track_id and release_status = 'published' and release_at <= now()
  ) then
    raise exception 'Track is not publicly playable';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_track_id::text || v_identity));
  if not exists(
    select 1 from public.plays
    where track_id = p_track_id
      and played_at > now() - interval '30 minutes'
      and ((auth.uid() is not null and user_id = auth.uid())
        or (auth.uid() is null and session_id = p_session_id))
  ) then
    insert into public.plays(track_id, user_id, session_id)
    values (p_track_id, auth.uid(), p_session_id);
    update public.tracks t
    set plays_count = t.plays_count + coalesce(
      (select c.stream_weight from public.artist_counter_adjustments c where c.artist_id = t.artist_id),
      1
    )
    where t.id = p_track_id
    returning plays_count into v_count;
  else
    select plays_count into v_count from public.tracks where id = p_track_id;
  end if;
  return v_count;
end;
$$;
grant execute on function public.record_track_play(uuid, uuid) to anon, authenticated;

-- Rank albums by recent qualified activity, but return the lifetime weighted
-- total shown to listeners. The total changes automatically with each track.
create or replace function public.get_album_rankings(p_days integer default 7, p_limit integer default 4)
returns table(album_id uuid, play_count bigint)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select t.album_id, count(p.id)::bigint as recent_plays
    from public.plays p
    join public.tracks t on t.id = p.track_id
    join public.albums a on a.id = t.album_id
    where p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
      and t.album_id is not null
      and a.release_status = 'published'
      and a.release_at <= now()
    group by t.album_id
    order by count(p.id) desc
    limit greatest(1, least(p_limit, 20))
  )
  select r.album_id, coalesce(sum(t.plays_count), 0)::bigint as play_count
  from ranked r
  join public.tracks t on t.album_id = r.album_id
  group by r.album_id, r.recent_plays
  order by r.recent_plays desc, play_count desc;
$$;

grant execute on function public.get_album_rankings(integer, integer) to anon, authenticated;

commit;
