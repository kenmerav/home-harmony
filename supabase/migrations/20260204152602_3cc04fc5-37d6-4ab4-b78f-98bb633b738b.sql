-- Create recipes table to persist imported recipes
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  servings INTEGER NOT NULL DEFAULT 4,
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  ingredients_raw TEXT,
  instructions TEXT,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g INTEGER NOT NULL DEFAULT 0,
  carbs_g INTEGER NOT NULL DEFAULT 0,
  fat_g INTEGER NOT NULL DEFAULT 0,
  fiber_g INTEGER DEFAULT 0,
  meal_type TEXT NOT NULL DEFAULT 'dinner',
  is_anchored BOOLEAN NOT NULL DEFAULT false,
  default_day TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (no auth required) - can add user_id later
CREATE POLICY "Allow all read access to recipes" 
ON public.recipes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all insert access to recipes" 
ON public.recipes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all update access to recipes" 
ON public.recipes 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow all delete access to recipes" 
ON public.recipes 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_recipes_updated_at();