-- Rulează această migrație în Supabase (SQL Editor).
-- Ține istoricul pauzelor săptămânale (45h / 24h) per vehicul, ca să se
-- poată calcula automat ce pauză urmează săptămâna viitoare — chiar și
-- după ce pauza curentă din `vehicles` e finalizată/resetată la nimic.

create table if not exists vehicle_weekly_rest_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  type text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_weekly_rest_log_vehicle_idx
  on vehicle_weekly_rest_log (vehicle_id, start_at desc);
