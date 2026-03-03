-- Trigger to call Edge Function on booking status change via pg_net
create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_function_url text;
  service_role_key text;
begin
  -- Only fire when status actually changes
  if old.status = new.status then
    return new;
  end if;

  -- Get the Edge Function URL from vault or env
  edge_function_url := current_setting('app.settings.edge_function_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings aren't configured, skip silently
  if edge_function_url is null or service_role_key is null then
    raise notice 'Edge function URL or service role key not configured, skipping notification';
    return new;
  end if;

  -- Call the Edge Function via pg_net
  perform net.http_post(
    url := edge_function_url || '/functions/v1/booking-status-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'booking_id', new.id,
      'old_status', old.status::text,
      'new_status', new.status::text
    )
  );

  return new;
end;
$$;

create trigger on_booking_status_change
  after update of status on public.bookings
  for each row
  execute function public.notify_booking_status_change();
