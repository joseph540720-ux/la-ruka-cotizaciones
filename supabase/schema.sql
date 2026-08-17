-- Esquema relacional de La Ruka. Se puede ejecutar más de una vez.
-- coffee_break_state se conserva temporalmente solo como origen de la migración.

create table if not exists public.coffee_break_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business jsonb not null default '{}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  customers jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.negocios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'La Ruka',
  legal_name text not null default '',
  rut text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  default_recipient text not null default 'joseph540720@gmail.com',
  logo_data_url text,
  updated_at timestamptz not null default now()
);

alter table public.negocios
  alter column default_recipient set default 'joseph540720@gmail.com';

create table if not exists public.productos (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  category text not null,
  unit text not null,
  price bigint not null check (price >= 0),
  cost bigint check (cost is null or cost >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.clientes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  rut text,
  contact text,
  email text,
  phone text,
  address text,
  compra_por_mercado_publico boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.cotizaciones (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  number text not null,
  quote_date date not null,
  customer_id text not null,
  customer_name text not null,
  customer_rut text,
  customer_contact text,
  customer_email text,
  customer_phone text,
  customer_address text,
  customer_compra_por_mercado_publico boolean not null default false,
  notes text not null default '',
  status text not null check (status in ('Pendiente', 'Aceptada', 'Rechazada')),
  status_updated_at date,
  last_follow_up_at date,
  delivery_status text not null check (delivery_status in ('borrador', 'descargada', 'compartida', 'enviada_encargado', 'enviada_cliente', 'subida_mercado_publico')),
  delivery_updated_at timestamptz,
  id_adquisicion text,
  owner_copy_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, number)
);

alter table public.cotizaciones drop constraint if exists cotizaciones_delivery_status_check;
alter table public.cotizaciones add constraint cotizaciones_delivery_status_check
  check (delivery_status in ('borrador', 'descargada', 'compartida', 'enviada_encargado', 'enviada_cliente', 'subida_mercado_publico'));

create table if not exists public.cotizacion_items (
  user_id uuid not null,
  quote_id text not null,
  position integer not null check (position >= 0),
  product_id text not null,
  name text not null,
  unit text not null,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_cost bigint check (unit_cost is null or unit_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, quote_id, position),
  foreign key (user_id, quote_id) references public.cotizaciones(user_id, id) on delete cascade
);

create table if not exists public.facturas (
  user_id uuid not null,
  quote_id text not null,
  invoice_number text,
  invoiced_at date,
  amount bigint not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, quote_id),
  foreign key (user_id, quote_id) references public.cotizaciones(user_id, id) on delete cascade
);

-- Migración idempotente desde la fila JSONB anterior.
insert into public.negocios (user_id, name, legal_name, rut, address, phone, email, default_recipient, logo_data_url, updated_at)
select user_id, coalesce(nullif(business->>'name', ''), 'La Ruka'), coalesce(business->>'legalName', ''),
  coalesce(business->>'rut', ''), coalesce(business->>'address', ''), coalesce(business->>'phone', ''),
  coalesce(business->>'email', ''), coalesce(nullif(business->>'defaultRecipient', ''), 'joseph540720@gmail.com'), nullif(business->>'logoDataUrl', ''), updated_at
from public.coffee_break_state
on conflict (user_id) do nothing;

insert into public.productos (user_id, id, name, category, unit, price, cost, active, updated_at)
select state.user_id, product->>'id', product->>'name', product->>'category', product->>'unit',
  greatest(0, coalesce((product->>'price')::bigint, 0)),
  case when product ? 'cost' and nullif(product->>'cost', '') is not null then greatest(0, (product->>'cost')::bigint) end,
  coalesce((product->>'active')::boolean, true), state.updated_at
from public.coffee_break_state state
cross join lateral jsonb_array_elements(case when jsonb_typeof(state.products) = 'array' then state.products else '[]'::jsonb end) product
where nullif(product->>'id', '') is not null and nullif(product->>'name', '') is not null
on conflict (user_id, id) do nothing;

insert into public.clientes (user_id, id, name, rut, contact, email, phone, address, compra_por_mercado_publico, updated_at)
select state.user_id, customer->>'id', customer->>'name', nullif(customer->>'rut', ''), nullif(customer->>'contact', ''),
  nullif(customer->>'email', ''), nullif(customer->>'phone', ''), nullif(customer->>'address', ''),
  coalesce((customer->>'compraPorMercadoPublico')::boolean, false), state.updated_at
from public.coffee_break_state state
cross join lateral jsonb_array_elements(case when jsonb_typeof(state.customers) = 'array' then state.customers else '[]'::jsonb end) customer
where nullif(customer->>'id', '') is not null and nullif(customer->>'name', '') is not null
on conflict (user_id, id) do nothing;

insert into public.cotizaciones (
  user_id, id, number, quote_date, customer_id, customer_name, customer_rut, customer_contact, customer_email,
  customer_phone, customer_address, customer_compra_por_mercado_publico, notes, status, status_updated_at,
  last_follow_up_at, delivery_status, delivery_updated_at, id_adquisicion, owner_copy_sent_at, created_at, updated_at
)
select state.user_id, quote->>'id', quote->>'number', coalesce(nullif(quote->>'date', '')::date, current_date),
  quote->'customer'->>'id', quote->'customer'->>'name', nullif(quote->'customer'->>'rut', ''),
  nullif(quote->'customer'->>'contact', ''), nullif(quote->'customer'->>'email', ''),
  nullif(quote->'customer'->>'phone', ''), nullif(quote->'customer'->>'address', ''),
  coalesce((quote->'customer'->>'compraPorMercadoPublico')::boolean, false), coalesce(quote->>'notes', ''),
  case when quote->>'status' in ('Pendiente', 'Aceptada', 'Rechazada') then quote->>'status' else 'Pendiente' end,
  nullif(quote->>'statusUpdatedAt', '')::date, nullif(quote->>'lastFollowUpAt', '')::date,
  case when quote->>'deliveryStatus' in ('borrador', 'descargada', 'compartida', 'enviada_encargado', 'enviada_cliente', 'subida_mercado_publico') then quote->>'deliveryStatus' else 'borrador' end,
  nullif(quote->>'deliveryUpdatedAt', '')::timestamptz, nullif(quote->>'idAdquisicion', ''),
  nullif(quote->>'ownerCopySentAt', '')::timestamptz, state.updated_at, state.updated_at
from public.coffee_break_state state
cross join lateral jsonb_array_elements(case when jsonb_typeof(state.quotes) = 'array' then state.quotes else '[]'::jsonb end) quote
where nullif(quote->>'id', '') is not null and nullif(quote->>'number', '') is not null
  and nullif(quote->'customer'->>'id', '') is not null and nullif(quote->'customer'->>'name', '') is not null
on conflict (user_id, id) do nothing;

insert into public.cotizacion_items (user_id, quote_id, position, product_id, name, unit, quantity, unit_price, unit_cost, updated_at)
select state.user_id, quote->>'id', (item.ordinality - 1)::integer, item.value->>'productId', item.value->>'name',
  coalesce(nullif(item.value->>'unit', ''), 'unidad'), greatest(1, coalesce((item.value->>'quantity')::integer, 1)),
  greatest(0, coalesce((item.value->>'unitPrice')::bigint, 0)),
  case when item.value ? 'unitCost' and nullif(item.value->>'unitCost', '') is not null then greatest(0, (item.value->>'unitCost')::bigint) end,
  state.updated_at
from public.coffee_break_state state
cross join lateral jsonb_array_elements(case when jsonb_typeof(state.quotes) = 'array' then state.quotes else '[]'::jsonb end) quote
cross join lateral jsonb_array_elements(case when jsonb_typeof(quote->'items') = 'array' then quote->'items' else '[]'::jsonb end) with ordinality item(value, ordinality)
where nullif(quote->>'id', '') is not null and nullif(item.value->>'productId', '') is not null and nullif(item.value->>'name', '') is not null
on conflict (user_id, quote_id, position) do nothing;

insert into public.facturas (user_id, quote_id, invoice_number, invoiced_at, amount, updated_at)
select state.user_id, quote->>'id', nullif(quote->>'invoiceNumber', ''), nullif(quote->>'invoicedAt', '')::date,
  greatest(0, (quote->>'invoicedAmount')::bigint), state.updated_at
from public.coffee_break_state state
cross join lateral jsonb_array_elements(case when jsonb_typeof(state.quotes) = 'array' then state.quotes else '[]'::jsonb end) quote
where nullif(quote->>'id', '') is not null and nullif(quote->>'invoicedAmount', '') is not null
on conflict (user_id, quote_id) do nothing;

alter table public.coffee_break_state enable row level security;
alter table public.negocios enable row level security;
alter table public.productos enable row level security;
alter table public.clientes enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;
alter table public.facturas enable row level security;

drop policy if exists "Cada usuario lee sus datos" on public.coffee_break_state;
drop policy if exists "Cada usuario crea sus datos" on public.coffee_break_state;
drop policy if exists "Cada usuario actualiza sus datos" on public.coffee_break_state;
drop policy if exists "Cada usuario elimina sus datos" on public.coffee_break_state;
create policy "Cada usuario lee sus datos" on public.coffee_break_state for select using (auth.uid() = user_id);
create policy "Cada usuario crea sus datos" on public.coffee_break_state for insert with check (auth.uid() = user_id);
create policy "Cada usuario actualiza sus datos" on public.coffee_break_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Cada usuario elimina sus datos" on public.coffee_break_state for delete using (auth.uid() = user_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['negocios', 'productos', 'clientes', 'cotizaciones', 'cotizacion_items', 'facturas']
  loop
    execute format('drop policy if exists "Usuario lee sus filas" on public.%I', table_name);
    execute format('drop policy if exists "Usuario crea sus filas" on public.%I', table_name);
    execute format('drop policy if exists "Usuario actualiza sus filas" on public.%I', table_name);
    execute format('drop policy if exists "Usuario elimina sus filas" on public.%I', table_name);
    execute format('create policy "Usuario lee sus filas" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "Usuario crea sus filas" on public.%I for insert with check (auth.uid() = user_id)', table_name);
    execute format('create policy "Usuario actualiza sus filas" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('create policy "Usuario elimina sus filas" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;
