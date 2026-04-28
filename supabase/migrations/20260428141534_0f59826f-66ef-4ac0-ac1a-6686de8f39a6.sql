DROP VIEW IF EXISTS public.menu_hpp_view;

CREATE VIEW public.menu_hpp_view WITH (security_invoker=true) AS
SELECT 
  m.id AS menu_item_id,
  m.shop_id,
  m.name,
  m.price,
  COALESCE(SUM(r.quantity * i.cost_per_unit), 0) AS hpp,
  m.price - COALESCE(SUM(r.quantity * i.cost_per_unit), 0) AS margin,
  CASE WHEN m.price > 0 
    THEN ROUND((((m.price - COALESCE(SUM(r.quantity * i.cost_per_unit), 0)) / m.price) * 100)::numeric, 2)
    ELSE 0 END AS margin_percent,
  GREATEST(m.updated_at, COALESCE(MAX(i.updated_at), m.updated_at)) AS last_updated,
  COUNT(r.id) AS recipe_count
FROM public.menu_items m
LEFT JOIN public.recipes r ON r.menu_item_id = m.id
LEFT JOIN public.ingredients i ON i.id = r.ingredient_id
GROUP BY m.id;