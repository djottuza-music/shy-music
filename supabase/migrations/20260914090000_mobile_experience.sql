begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('artist-covers', 'artist-covers', true, 10485760, array['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('artist-avatars', 'artist-avatars', true, 10485760, array['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy artist_profile_images_public_select on storage.objects
for select using (bucket_id in ('artist-covers', 'artist-avatars'));

create policy artist_profile_images_owner_insert on storage.objects
for insert to authenticated with check (
  bucket_id in ('artist-covers', 'artist-avatars') and exists (
    select 1 from public.artists a
    where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
);

create policy artist_profile_images_owner_update on storage.objects
for update to authenticated using (
  bucket_id in ('artist-covers', 'artist-avatars') and exists (
    select 1 from public.artists a
    where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
) with check (
  bucket_id in ('artist-covers', 'artist-avatars') and exists (
    select 1 from public.artists a
    where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
);

create policy artist_profile_images_owner_delete on storage.objects
for delete to authenticated using (
  bucket_id in ('artist-covers', 'artist-avatars') and exists (
    select 1 from public.artists a
    where a.user_id = auth.uid() and a.id::text = (storage.foldername(name))[1]
  )
);

create or replace function public.get_top_listeners(p_days integer default 7, p_limit integer default 10)
returns table(profile_id uuid, display_name text, avatar_url text, play_count bigint)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.display_name, pr.avatar_url, count(*)::bigint
  from public.plays p
  join public.profiles pr on pr.id = p.user_id
  where p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
    and not pr.is_suspended
  group by pr.id, pr.display_name, pr.avatar_url
  order by count(*) desc, pr.display_name
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.get_top_listeners(integer, integer) to anon, authenticated;

create or replace function public.get_rising_artists(p_days integer default 30, p_limit integer default 10)
returns table(artist_id uuid, listener_count bigint, play_count bigint)
language sql stable security definer set search_path = public as $$
  select a.id,
    count(distinct coalesce(p.user_id::text, p.session_id::text))::bigint,
    count(*)::bigint
  from public.plays p
  join public.tracks t on t.id = p.track_id
  join public.artists a on a.id = t.artist_id
  where p.played_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
    and a.is_active and t.release_status = 'published' and t.release_at <= now()
  group by a.id
  order by count(distinct coalesce(p.user_id::text, p.session_id::text)) desc, count(*) desc
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.get_rising_artists(integer, integer) to anon, authenticated;

create or replace function public.get_recommended_track_ids(p_limit integer default 20)
returns table(track_id uuid, score bigint)
language sql stable security definer set search_path = public as $$
  with history_artists as (
    select t.artist_id, count(*)::bigint as affinity
    from public.plays p join public.tracks t on t.id = p.track_id
    where auth.uid() is not null and p.user_id = auth.uid()
    group by t.artist_id
  ), ranked as (
    select t.id,
      coalesce(ha.affinity * 100, 0) + least(t.plays_count, 100000)::bigint as score
    from public.tracks t
    left join history_artists ha on ha.artist_id = t.artist_id
    where t.release_status = 'published' and t.release_at <= now()
      and (auth.uid() is null or not exists (
        select 1 from public.plays seen where seen.user_id = auth.uid() and seen.track_id = t.id
      ))
  )
  select id, ranked.score from ranked order by ranked.score desc limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.get_recommended_track_ids(integer) to anon, authenticated;

commit;
