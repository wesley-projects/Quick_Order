-- Seed default food categories so the "Add restaurant" dropdown works on fresh deployments
INSERT INTO "FoodCategory" (id, name, icon)
VALUES
  ('cat_pizza',    'Pizza',    '🍕'),
  ('cat_burgers',  'Burgers',  '🍔'),
  ('cat_sushi',    'Sushi',    '🍣'),
  ('cat_tacos',    'Tacos',    '🌮'),
  ('cat_indian',   'Indian',   '🍛'),
  ('cat_desserts', 'Desserts', '🍰')
ON CONFLICT (name) DO NOTHING;
