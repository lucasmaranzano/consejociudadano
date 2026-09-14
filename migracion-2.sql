-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 2: cuota configurable + gastos vinculados a un evento
-- Pegar entero en: Supabase → SQL Editor → Run
-- Idempotente: se puede correr más de una vez sin romper nada.
-- Requiere haber corrido antes cobros.sql.
-- ═══════════════════════════════════════════════════════════════

-- ── CUOTAS ──
-- Una fila por cada vez que cambia el valor de la cuota mensual.
-- "desde" es el primer mes en que rige (YYYY-MM). La cuota de un mes
-- cualquiera es la fila con el "desde" más grande que sea <= ese mes.
-- Asi un pago de marzo sigue valiendo lo que valía en marzo, aunque
-- la cuota haya subido en julio.
create table if not exists public.cuotas (
  desde      text primary key,   -- 'YYYY-MM'
  monto      numeric not null,
  created_at timestamptz not null default now()
);

-- Valor inicial: el que estaba hardcodeado en el HTML desde el arranque.
insert into public.cuotas (desde, monto) values ('2026-03', 10000)
  on conflict (desde) do nothing;

alter table public.cuotas enable row level security;
drop policy if exists "cuotas_select" on public.cuotas;
drop policy if exists "cuotas_write"  on public.cuotas;
create policy "cuotas_select" on public.cuotas for select using (true);
create policy "cuotas_write"  on public.cuotas for all to authenticated
  using (true) with check (true);

grant select on public.cuotas to anon, authenticated;
grant insert, update, delete on public.cuotas to authenticated;

-- ── GASTOS → COBROS ──
-- Vincula un gasto al evento que lo origino. Nullable: los gastos
-- normales del consejo (alquiler, servicios) no tienen evento.
-- Con esto "reservado" pasa a ser recaudado menos lo ya gastado, en vez
-- de liberarse de golpe recien al cerrar el cobro.
alter table public.gastos
  add column if not exists cobro_id text references public.cobros(id) on delete set null;

create index if not exists gastos_cobro_idx on public.gastos(cobro_id);

-- ── Realtime ──
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='cuotas') then
    alter publication supabase_realtime add table public.cuotas;
  end if;
end $$;

-- Verificacion: 1 fila de cuota y la columna cobro_id en gastos.
select (select count(*) from public.cuotas) as cuotas_cargadas,
       (select count(*) from information_schema.columns
         where table_name='gastos' and column_name='cobro_id') as columna_cobro_id;
