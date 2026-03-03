-- Seed pricing data for both routes
-- Get route IDs
do $$
declare
  gc_to_syd uuid;
  syd_to_gc uuid;
begin
  select id into gc_to_syd from public.routes where origin = 'Gold Coast' and destination = 'Sydney' limit 1;
  select id into syd_to_gc from public.routes where origin = 'Sydney' and destination = 'Gold Coast' limit 1;

  -- Pricing for Gold Coast → Sydney
  insert into public.pricing (route_id, item_type, price_cents) values
    (gc_to_syd, 'Pallet', 45000),
    (gc_to_syd, 'Parcel', 15000),
    (gc_to_syd, 'Furniture', 60000),
    (gc_to_syd, 'Equipment', 80000),
    (gc_to_syd, 'Vehicle Parts', 35000),
    (gc_to_syd, 'General Freight', 40000);

  -- Pricing for Sydney → Gold Coast
  insert into public.pricing (route_id, item_type, price_cents) values
    (syd_to_gc, 'Pallet', 45000),
    (syd_to_gc, 'Parcel', 15000),
    (syd_to_gc, 'Furniture', 60000),
    (syd_to_gc, 'Equipment', 80000),
    (syd_to_gc, 'Vehicle Parts', 35000),
    (syd_to_gc, 'General Freight', 40000);
end;
$$;
