-- ═══════════════════════════════════════════════════════════════
-- COBROS PUNTUALES (cena, rifa, regalo, campamento...)
-- Pegar entero en: Supabase → SQL Editor → Run
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════

-- Un cobro NO es un período mensual: es un evento con fecha objetivo.
-- Por eso no tiene columna "month" y no aparece en el navegador de meses.
create table if not exists public.cobros (
  id            text primary key,
  nombre        text not null,
  monto         numeric not null default 0,   -- valor por persona (sugerido)
  fecha_evento  date,
  cerrado       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Varias filas por miembro a propósito: así los pagos en cuotas salen gratis.
-- Lo que se debe = cobros.monto - sum(cobro_pagos.amount) del miembro.
create table if not exists public.cobro_pagos (
  id         text primary key,
  cobro_id   text not null references public.cobros(id)  on delete cascade,
  member_id  text not null references public.miembros(id) on delete cascade,
  amount     numeric not null default 0,
  date       date,
  ref        text default '',
  note       text default '',
  created_at timestamptz not null default now()
);
create index if not exists cobro_pagos_cobro_idx  on public.cobro_pagos(cobro_id);
create index if not exists cobro_pagos_member_idx on public.cobro_pagos(member_id);

-- RLS: mismo criterio que miembros/pagos/gastos.
-- Lectura abierta a todos; escritura sólo con sesión iniciada.
alter table public.cobros      enable row level security;
alter table public.cobro_pagos enable row level security;

drop policy if exists "cobros_select"      on public.cobros;
drop policy if exists "cobros_write"       on public.cobros;
drop policy if exists "cobro_pagos_select" on public.cobro_pagos;
drop policy if exists "cobro_pagos_write"  on public.cobro_pagos;

create policy "cobros_select" on public.cobros
  for select using (true);
create policy "cobros_write"  on public.cobros
  for all to authenticated using (true) with check (true);

create policy "cobro_pagos_select" on public.cobro_pagos
  for select using (true);
create policy "cobro_pagos_write"  on public.cobro_pagos
  for all to authenticated using (true) with check (true);

-- GRANTS: la capa gruesa de permisos, previa a RLS.
-- Sin esto PostgREST devuelve 403 aunque las policies esten bien.
-- (Supabase los aplica solo al crear tablas desde el Dashboard.)
grant select on public.cobros      to anon, authenticated;
grant select on public.cobro_pagos to anon, authenticated;
grant insert, update, delete on public.cobros      to authenticated;
grant insert, update, delete on public.cobro_pagos to authenticated;

-- Realtime: para que el 🍽️ se actualice solo en los otros celulares.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='cobros') then
    alter publication supabase_realtime add table public.cobros;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='cobro_pagos') then
    alter publication supabase_realtime add table public.cobro_pagos;
  end if;
end $$;

-- Verificacion: deberia devolver 2 filas (cobros y cobro_pagos).
select tablename from pg_publication_tables
 where pubname='supabase_realtime' and tablename in ('cobros','cobro_pagos');
