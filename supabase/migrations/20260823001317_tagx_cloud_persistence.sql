-- Tag X cloud persistence for Supabase/Postgres.
-- The application talks to these tables only through its authenticated server API.
create extension if not exists "pgcrypto";

create table if not exists public.tagx_profiles (
  id uuid primary key default gen_random_uuid(),
  external_user_id text not null unique,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tagx_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.tagx_profiles(id) on delete cascade,
  name text not null default 'Tag X workspace',
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tagx_workspace_state_is_object check (jsonb_typeof(state) = 'object')
);

create table if not exists public.tagx_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.tagx_profiles(id) on delete cascade,
  name text not null,
  short_name text,
  crest_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table if not exists public.tagx_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.tagx_teams(id) on delete cascade,
  name text not null,
  shirt_number integer check (shirt_number between 0 and 99),
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tagx_players_team_idx on public.tagx_players(team_id);

create or replace function public.tagx_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tagx_profiles_updated_at on public.tagx_profiles;
create trigger tagx_profiles_updated_at before update on public.tagx_profiles
for each row execute function public.tagx_set_updated_at();
drop trigger if exists tagx_workspaces_updated_at on public.tagx_workspaces;
create trigger tagx_workspaces_updated_at before update on public.tagx_workspaces
for each row execute function public.tagx_set_updated_at();
drop trigger if exists tagx_teams_updated_at on public.tagx_teams;
create trigger tagx_teams_updated_at before update on public.tagx_teams
for each row execute function public.tagx_set_updated_at();
drop trigger if exists tagx_players_updated_at on public.tagx_players;
create trigger tagx_players_updated_at before update on public.tagx_players
for each row execute function public.tagx_set_updated_at();

alter table public.tagx_profiles enable row level security;
alter table public.tagx_workspaces enable row level security;
alter table public.tagx_teams enable row level security;
alter table public.tagx_players enable row level security;

-- No browser policies are intentionally defined. The service-role-backed API is
-- the only database entry point and identifies users from trusted hosting headers.
revoke all on public.tagx_profiles from anon, authenticated;
revoke all on public.tagx_workspaces from anon, authenticated;
revoke all on public.tagx_teams from anon, authenticated;
revoke all on public.tagx_players from anon, authenticated;

-- Supabase's service role does not automatically regain privileges revoked from
-- the client roles on every project, so grant the server API its explicit access.
grant select, insert, update, delete on public.tagx_profiles to service_role;
grant select, insert, update, delete on public.tagx_workspaces to service_role;
grant select, insert, update, delete on public.tagx_teams to service_role;
grant select, insert, update, delete on public.tagx_players to service_role;
