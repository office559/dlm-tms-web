-- Rulează această migrație în Supabase (SQL Editor) DUPĂ ce ai rulat
-- `npm run auth:migrate`, care creează tabelele proprii Better Auth
-- (user, session, account, verification).

create table if not exists dispatcher_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dispatcher_invites_token_idx on dispatcher_invites (token);

create table if not exists dispatchers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists dispatchers_user_id_idx on dispatchers (user_id);
