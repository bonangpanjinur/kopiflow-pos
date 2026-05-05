-- Supplier: lead time & payment terms
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS lead_time_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms text;

-- Ingredients: category & default supplier
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ingredients_default_supplier ON public.ingredients(default_supplier_id);

-- Menu items: recipe yield (how many portions one recipe produces)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS recipe_yield numeric NOT NULL DEFAULT 1;

-- Sanity: yield must be positive
ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_recipe_yield_positive;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_recipe_yield_positive CHECK (recipe_yield > 0);