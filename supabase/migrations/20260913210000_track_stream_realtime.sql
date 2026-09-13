do $$
begin
  alter publication supabase_realtime add table public.tracks;
exception when duplicate_object then null;
end;
$$;
