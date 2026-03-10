alter table public.recipes
  add column if not exists is_meal_prep boolean not null default false;
