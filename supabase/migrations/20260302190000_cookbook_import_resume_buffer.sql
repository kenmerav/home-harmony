-- Store partial extraction state so cookbook imports can resume chunk-by-chunk.

alter table public.cookbook_import_jobs
  add column if not exists recipes_buffer jsonb not null default '[]'::jsonb;
