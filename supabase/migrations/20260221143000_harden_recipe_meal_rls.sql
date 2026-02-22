-- Harden multi-tenant data isolation for recipes and meal plans.
-- Scope records to authenticated user ownership instead of global access.

-- 1) Recipes ownership + RLS
alter table public.recipes
add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.recipes
alter column owner_id set default auth.uid();

with first_user as (
  select id
  from auth.users
  order by created_at asc
  limit 1
)
update public.recipes r
set owner_id = fu.id
from first_user fu
where r.owner_id is null;

create index if not exists idx_recipes_owner_id on public.recipes(owner_id);

drop policy if exists "Allow all read access to recipes" on public.recipes;
drop policy if exists "Allow all insert access to recipes" on public.recipes;
drop policy if exists "Allow all update access to recipes" on public.recipes;
drop policy if exists "Allow all delete access to recipes" on public.recipes;

drop policy if exists "Users can view own recipes" on public.recipes;
create policy "Users can view own recipes"
on public.recipes
for select
using (owner_id = auth.uid());

drop policy if exists "Users can insert own recipes" on public.recipes;
create policy "Users can insert own recipes"
on public.recipes
for insert
with check (owner_id = auth.uid());

drop policy if exists "Users can update own recipes" on public.recipes;
create policy "Users can update own recipes"
on public.recipes
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete own recipes" on public.recipes;
create policy "Users can delete own recipes"
on public.recipes
for delete
using (owner_id = auth.uid());

-- 2) Planned meals ownership + RLS
alter table public.planned_meals
add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.planned_meals
alter column owner_id set default auth.uid();

update public.planned_meals pm
set owner_id = r.owner_id
from public.recipes r
where pm.recipe_id = r.id
  and pm.owner_id is null
  and r.owner_id is not null;

with first_user as (
  select id
  from auth.users
  order by created_at asc
  limit 1
)
update public.planned_meals pm
set owner_id = fu.id
from first_user fu
where pm.owner_id is null;

create index if not exists idx_planned_meals_owner_id on public.planned_meals(owner_id);
create index if not exists idx_planned_meals_owner_week on public.planned_meals(owner_id, week_of);

drop index if exists public.idx_planned_meals_day_week;
create unique index if not exists idx_planned_meals_owner_day_week
on public.planned_meals(owner_id, day, week_of);

drop policy if exists "Allow all read access to planned_meals" on public.planned_meals;
drop policy if exists "Allow all insert access to planned_meals" on public.planned_meals;
drop policy if exists "Allow all update access to planned_meals" on public.planned_meals;
drop policy if exists "Allow all delete access to planned_meals" on public.planned_meals;

drop policy if exists "Users can view own planned meals" on public.planned_meals;
create policy "Users can view own planned meals"
on public.planned_meals
for select
using (owner_id = auth.uid());

drop policy if exists "Users can insert own planned meals" on public.planned_meals;
create policy "Users can insert own planned meals"
on public.planned_meals
for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.recipes r
    where r.id = planned_meals.recipe_id
      and r.owner_id = auth.uid()
  )
);

drop policy if exists "Users can update own planned meals" on public.planned_meals;
create policy "Users can update own planned meals"
on public.planned_meals
for update
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.recipes r
    where r.id = planned_meals.recipe_id
      and r.owner_id = auth.uid()
  )
);

drop policy if exists "Users can delete own planned meals" on public.planned_meals;
create policy "Users can delete own planned meals"
on public.planned_meals
for delete
using (owner_id = auth.uid());

-- 3) Storage object ownership for cookbook uploads
with first_user as (
  select id
  from auth.users
  order by created_at asc
  limit 1
)
update storage.objects o
set owner = fu.id
from first_user fu
where o.bucket_id = 'cookbooks'
  and o.owner is null;

drop policy if exists "Users can upload cookbook PDFs" on storage.objects;
drop policy if exists "Users can read cookbook PDFs" on storage.objects;
drop policy if exists "Users can delete cookbook PDFs" on storage.objects;

drop policy if exists "Users can upload own cookbook PDFs" on storage.objects;
create policy "Users can upload own cookbook PDFs"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'cookbooks' and owner = auth.uid());

drop policy if exists "Users can read own cookbook PDFs" on storage.objects;
create policy "Users can read own cookbook PDFs"
on storage.objects
for select
to authenticated
using (bucket_id = 'cookbooks' and owner = auth.uid());

drop policy if exists "Users can update own cookbook PDFs" on storage.objects;
create policy "Users can update own cookbook PDFs"
on storage.objects
for update
to authenticated
using (bucket_id = 'cookbooks' and owner = auth.uid())
with check (bucket_id = 'cookbooks' and owner = auth.uid());

drop policy if exists "Users can delete own cookbook PDFs" on storage.objects;
create policy "Users can delete own cookbook PDFs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'cookbooks' and owner = auth.uid());
