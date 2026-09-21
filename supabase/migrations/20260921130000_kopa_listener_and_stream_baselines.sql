begin;

alter table public.artist_counter_adjustments
  add column if not exists listener_baseline bigint not null default 0
  check (listener_baseline >= 0);

insert into public.artist_counter_adjustments(artist_id, follower_baseline, track_baseline, stream_weight, listener_baseline)
select id, 15000, 20000, 400, 10000
from public.artists
where lower(display_name) = 'kopa' or slug = 'djottuza-127d8b32'
on conflict (artist_id) do update
set track_baseline = 20000,
    listener_baseline = 10000;

update public.tracks t
set plays_count = greatest(t.plays_count, 20000)
from public.artists a
where a.id = t.artist_id
  and (lower(a.display_name) = 'kopa' or a.slug = 'djottuza-127d8b32');

create or replace function public.get_artist_listener_count(p_artist_id uuid, p_days integer default 30)
returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select listener_baseline from public.artist_counter_adjustments where artist_id = p_artist_id), 0)
    + count(distinct coalesce(p.user_id::text, p.session_id::text))::bigint
  from public.plays p
  join public.tracks t on t.id = p.track_id
  where t.artist_id = p_artist_id
    and p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)));
$$;
grant execute on function public.get_artist_listener_count(uuid, integer) to anon, authenticated;

create or replace function public.get_rising_artists(p_days integer default 30, p_limit integer default 10)
returns table(artist_id uuid, listener_count bigint, play_count bigint)
language sql stable security definer set search_path = public as $$
  select a.id,
    coalesce(c.listener_baseline, 0) + count(distinct coalesce(p.user_id::text, p.session_id::text))::bigint,
    count(p.id)::bigint
  from public.artists a
  left join public.artist_counter_adjustments c on c.artist_id = a.id
  left join public.tracks t on t.artist_id = a.id and t.release_status = 'published' and t.release_at <= now()
  left join public.plays p on p.track_id = t.id and p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
  where a.is_active
  group by a.id, c.listener_baseline
  having coalesce(c.listener_baseline, 0) > 0 or count(p.id) > 0
  order by coalesce(c.listener_baseline, 0) + count(distinct coalesce(p.user_id::text, p.session_id::text)) desc, count(p.id) desc
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.get_rising_artists(integer, integer) to anon, authenticated;

commit;
