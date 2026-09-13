begin;

create or replace function public.enroll_as_artist()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text;
  v_slug text;
  v_artist_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in before enabling artist access';
  end if;

  select display_name into v_name
  from public.profiles
  where id = v_user_id;

  if v_name is null then
    raise exception 'Complete your SHY profile before enabling artist access';
  end if;

  insert into public.user_roles(user_id, role)
  values (v_user_id, 'artist')
  on conflict do nothing;

  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || substring(v_user_id::text, 1, 8);

  insert into public.artists(user_id, display_name, slug)
  values (v_user_id, left(v_name, 100), v_slug)
  on conflict (user_id) do update
    set is_active = true
  returning id into v_artist_id;

  return v_artist_id;
end;
$$;

revoke all on function public.enroll_as_artist() from public;
grant execute on function public.enroll_as_artist() to authenticated;

commit;
