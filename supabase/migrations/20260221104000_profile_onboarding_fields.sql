alter table public.profiles
add column if not exists phone text,
add column if not exists family_size integer,
add column if not exists goals text,
add column if not exists dietary_preferences text[] not null default '{}';
