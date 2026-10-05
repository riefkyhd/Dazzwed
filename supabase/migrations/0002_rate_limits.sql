-- Rate limiting atomic counter function
create or replace function public.check_rate_limit(
  p_key text,
  p_window_start timestamptz,
  p_max_requests int
) returns table (allowed boolean, current_count int)
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return query select (v_count <= p_max_requests), v_count;
end $$;

revoke all on function public.check_rate_limit(text, timestamptz, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, timestamptz, int) to service_role;
