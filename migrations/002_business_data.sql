-- Etapa 2: entitățile de business (proprietari, șoferi, vehicule, remorci,
-- clienți, curse, cheltuieli, brokeraj, șabloane, setări) + migrarea
-- datelor reale din aplicația Claude Artifact veche.

create table if not exists owners (
  id text primary key,
  name text not null,
  contact text,
  phone text,
  email text,
  cui text,
  iban text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists drivers (
  id text primary key,
  name text not null,
  fictive_name text,
  owner_id text references owners (id) on delete set null,
  salary numeric,
  tm text,
  card text,
  permis_exp date,
  cpc_exp date,
  card_exp date,
  medical_exp date,
  card_last date,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists drivers_owner_id_idx on drivers (owner_id);

create table if not exists trailers (
  id text primary key,
  plate text not null,
  type text,
  owner_id text references owners (id) on delete set null,
  itp_exp date,
  rca_exp date,
  casco_exp date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists trailers_owner_id_idx on trailers (owner_id);

create table if not exists vehicles (
  id text primary key,
  plate text not null,
  type text,
  owner_id text references owners (id) on delete set null,
  price numeric,
  itp_exp date,
  rca_exp date,
  casco_exp date,
  insurance_exp date,
  tacho_exp date,
  tacho_last date,
  driver_id text references drivers (id) on delete set null,
  driver2_id text references drivers (id) on delete set null,
  trailer_id text references trailers (id) on delete set null,
  location text,
  shift text,
  pause boolean not null default false,
  program_start text,
  program_end text,
  state_override text,
  rest_type text,
  rest_start text,
  rest_start_at timestamptz,
  rest_end text,
  rest_end_at timestamptz,
  rest_dur_h numeric,
  rest_date date,
  rest_location text,
  rest_reason text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists vehicles_owner_id_idx on vehicles (owner_id);
create index if not exists vehicles_driver_id_idx on vehicles (driver_id);
create index if not exists vehicles_trailer_id_idx on vehicles (trailer_id);

create table if not exists customers (
  id text primary key,
  name text not null,
  type text,
  code text,
  term_days integer,
  commission numeric,
  terms text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  kind text not null default 'curse',
  client_id text references customers (id) on delete set null,
  ref text,
  load_place text,
  unload_place text,
  start_at timestamptz,
  end_at timestamptz,
  dist_unit text,
  miles numeric,
  currency text,
  rate numeric,
  extra numeric,
  driver_id text references drivers (id) on delete set null,
  vehicle_id text references vehicles (id) on delete set null,
  trailer_id text references trailers (id) on delete set null,
  dispatcher_id uuid references dispatchers (id) on delete set null,
  status text not null default 'planificare',
  notes text,
  invoice text not null default 'none',
  paid_at date,
  created_at timestamptz not null default now()
);
create index if not exists jobs_client_id_idx on jobs (client_id);
create index if not exists jobs_driver_id_idx on jobs (driver_id);
create index if not exists jobs_vehicle_id_idx on jobs (vehicle_id);
create index if not exists jobs_status_idx on jobs (status);

create table if not exists costs (
  id text primary key,
  date date not null,
  category text not null,
  vehicle_id text references vehicles (id) on delete set null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists costs_vehicle_id_idx on costs (vehicle_id);

create table if not exists brokerage (
  id text primary key,
  client text not null,
  ref text,
  route text,
  collect_date date,
  deliver_date date,
  client_price numeric,
  sub text,
  sub_price numeric,
  status text not null default 'În curs',
  paid_client boolean not null default false,
  paid_sub boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists job_templates (
  id text primary key,
  name text,
  client_id text references customers (id) on delete set null,
  from_place text,
  to_place text,
  miles numeric,
  rate numeric,
  start_time text,
  hours numeric,
  dow text,
  kind text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id boolean primary key default true check (id),
  company text,
  depot text,
  currency text,
  cpm numeric,
  alert_days integer,
  wa_country text,
  theme_color text,
  bg_color text,
  updated_at timestamptz not null default now()
);

-- ---------- datele reale, mutate din aplicația veche ----------

insert into settings (id, company, depot, currency, cpm, alert_days, wa_country, theme_color, bg_color)
values (true, 'DLM Trans', 'Daventry', '€', 0, 30, '40', '#2f6fed', '#e8f0fb')
on conflict (id) do update set
  company = excluded.company, depot = excluded.depot, currency = excluded.currency,
  cpm = excluded.cpm, alert_days = excluded.alert_days, wa_country = excluded.wa_country,
  theme_color = excluded.theme_color, bg_color = excluded.bg_color, updated_at = now();

insert into drivers (id, name, salary, active) values
  ('d64dtgq', 'Adrian Florin Prelipcean', 117, true)
on conflict (id) do nothing;

insert into trailers (id, plate, type, active) values
  ('tmvozh4', 'SV53DLM', 'Box', true)
on conflict (id) do nothing;

insert into vehicles (
  id, plate, type, price, active, driver_id, trailer_id, location, shift, pause,
  state_override, rest_type, rest_date, rest_dur_h, rest_start, rest_start_at, rest_end_at
) values
  ('v98sadv', 'SV54DLM', 'TRACTOR', 113500, true, 'd64dtgq', 'tmvozh4', 'DTM1', 'Zi', false,
   'disponibil', 'Odihnă Zilnică', '2026-09-22', 9, '02:09', '2026-09-22T02:09', '2026-09-22T11:09'),
  ('v7buf7c', 'SV52DLM', 'TRACTOR', 113500, true, null, null, null, null, false,
   'disponibil', null, null, null, null, null, null),
  ('v57x9v6', 'SV50DLM', 'TRACTOR', 22500, true, null, null, null, null, false,
   'disponibil', null, null, null, null, null, null),
  ('vagywxa', 'SV56DLM', 'TRACTOR', 85000, true, null, null, null, null, false,
   'disponibil', null, null, null, null, null, null),
  ('v9ut0fm', 'SV44DLM', 'TRACTOR', 30000, true, null, null, null, null, false,
   'disponibil', null, null, null, null, null, null),
  ('vhj1el0', 'SV70DLT', 'TRACTOR', 30000, true, null, null, null, null, false,
   'disponibil', null, null, null, null, null, null)
on conflict (id) do nothing;

insert into customers (id, name, type, code, term_days, commission, terms, email) values
  ('cjpo57j', 'ASCIE', 'General', 'AMA', 5, 0, '', ''),
  ('cjdqfc7', 'LKW WALTER', 'General', 'LKW', 30, 0, '', '')
on conflict (id) do nothing;
