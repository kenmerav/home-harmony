
-- Create planned_meals table
CREATE TABLE public.planned_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  week_of TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access to planned_meals" ON public.planned_meals FOR SELECT USING (true);
CREATE POLICY "Allow all insert access to planned_meals" ON public.planned_meals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update access to planned_meals" ON public.planned_meals FOR UPDATE USING (true);
CREATE POLICY "Allow all delete access to planned_meals" ON public.planned_meals FOR DELETE USING (true);

-- Index for fast week lookups
CREATE INDEX idx_planned_meals_week ON public.planned_meals(week_of);
CREATE UNIQUE INDEX idx_planned_meals_day_week ON public.planned_meals(day, week_of);
