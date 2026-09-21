create table if not exists public.house_state (
  id text primary key,
  lists jsonb not null,
  "occupiedBy" text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id text not null check (user_id in ('carlos', 'jorge', 'luis')),
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

insert into public.house_state (id, lists, "occupiedBy") values (
  'main-home',
  '{"carlos":[{"id":1,"text":"Leche","done":false},{"id":2,"text":"Papel de cocina","done":true}],"jorge":[{"id":3,"text":"Jabón para platos","done":false}],"luis":[{"id":4,"text":"Café","done":false},{"id":5,"text":"Bombillas","done":false}]}',
  null
) on conflict (id) do nothing;

alter table public.house_state enable row level security;
alter table public.push_subscriptions enable row level security;
