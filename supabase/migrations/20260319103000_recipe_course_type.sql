alter table public.recipes
  add column if not exists course_type text not null default 'main';

update public.recipes
set course_type = 'main'
where course_type is null
   or course_type not in ('main', 'side', 'dessert');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipes_course_type_check'
  ) then
    alter table public.recipes
      add constraint recipes_course_type_check
      check (course_type in ('main', 'side', 'dessert'));
  end if;
end
$$;
