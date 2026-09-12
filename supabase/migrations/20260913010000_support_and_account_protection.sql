begin;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  contact_email text not null check (char_length(contact_email) between 5 and 254),
  category text not null check (category in ('account','artist','copyright','safety','technical','other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text check (char_length(reason) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index account_deletion_one_active_idx on public.account_deletion_requests(user_id)
where status in ('open','reviewing');
create index support_requests_status_idx on public.support_requests(status, created_at desc);

create trigger support_requests_touch before update on public.support_requests for each row execute function public.touch_updated_at();
create trigger account_deletion_requests_touch before update on public.account_deletion_requests for each row execute function public.touch_updated_at();

alter table public.support_requests enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy albums_admin_update on public.albums for update using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy tracks_admin_update on public.tracks for update using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy support_owner_select on public.support_requests for select using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy support_admin_update on public.support_requests for update using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy deletion_owner_select on public.account_deletion_requests for select using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy deletion_admin_update on public.account_deletion_requests for update using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.support_requests from anon, authenticated;
revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
grant select on public.account_deletion_requests to authenticated;

create or replace function public.submit_support_request(
  p_email text,
  p_category text,
  p_subject text,
  p_message text
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  if p_category not in ('account','artist','copyright','safety','technical','other') then raise exception 'Choose a valid support category'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid contact email'; end if;
  if char_length(trim(p_subject)) not between 3 and 120 then raise exception 'Subject must be between 3 and 120 characters'; end if;
  if char_length(trim(p_message)) not between 10 and 3000 then raise exception 'Message must be between 10 and 3000 characters'; end if;
  if exists (
    select 1 from public.support_requests
    where created_at > now() - interval '10 minutes'
      and ((auth.uid() is not null and user_id = auth.uid()) or contact_email = v_email)
    group by coalesce(user_id::text, contact_email)
    having count(*) >= 3
  ) then raise exception 'Please wait before sending another request'; end if;
  insert into public.support_requests(user_id, contact_email, category, subject, message)
  values (auth.uid(), v_email, p_category, trim(p_subject), trim(p_message))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.request_account_deletion(p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to request account deletion'; end if;
  insert into public.account_deletion_requests(user_id, reason)
  values (auth.uid(), nullif(trim(p_reason), ''))
  on conflict (user_id) where status in ('open','reviewing')
  do update set reason = excluded.reason, updated_at = now()
  returning id into v_id;
  insert into public.audit_log(actor_id, action, target_type, target_id)
  values (auth.uid(), 'deletion_requested', 'profile', auth.uid());
  return v_id;
end;
$$;

create or replace function public.admin_set_case_status(p_table text, p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if p_table = 'support_requests' and p_status in ('open','reviewing','resolved','closed') then
    update public.support_requests set status = p_status where id = p_id;
  elsif p_table = 'reports' and p_status in ('open','reviewing','resolved','dismissed') then
    update public.reports set status = p_status, resolved_at = case when p_status in ('resolved','dismissed') then now() else null end where id = p_id;
  elsif p_table = 'account_deletion_requests' and p_status in ('open','reviewing','completed','cancelled') then
    update public.account_deletion_requests set status = p_status where id = p_id;
  else
    raise exception 'Invalid case type or status';
  end if;
  if not found then raise exception 'Case not found'; end if;
  insert into public.audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'case_status_changed', p_table, p_id, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.admin_set_release_status(p_table text, p_id uuid, p_status public.release_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if p_table = 'tracks' then
    update public.tracks set release_status = p_status where id = p_id;
  elsif p_table = 'albums' then
    update public.albums set release_status = p_status where id = p_id;
  else
    raise exception 'Invalid release type';
  end if;
  if not found then raise exception 'Release not found'; end if;
  insert into public.audit_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'release_status_changed', p_table, p_id, jsonb_build_object('status', p_status));
end;
$$;

grant execute on function public.submit_support_request(text, text, text, text) to anon, authenticated;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.admin_set_case_status(text, uuid, text) to authenticated;
grant execute on function public.admin_set_release_status(text, uuid, public.release_status) to authenticated;

commit;
