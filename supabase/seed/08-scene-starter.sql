-- The Scene: categories and a starter directory (ADR-0007)
--
-- FOUNDER REVIEW REQUIRED before the Scene is public. The places below are a starter set of
-- well-known, long-standing Sydney businesses and institutions, included so the screens have
-- real content to render during development. Every row is a claim about a real place, and the
-- founder owns the directory's accuracy (§22): verify each one still operates — and correct
-- suburbs — before the routing switch makes this surface public. Rows are trivially editable
-- or deletable in the SQL editor; `active = false` hides a row without deleting it.
--
-- No people. Nothing in this file may ever name an individual (ADR-0007).

insert into public.place_categories (code, label, sort_order) values
  ('grocery', 'Groceries & spices', 10),
  ('restaurant', 'Restaurants & sweets', 20),
  ('temple', 'Temples & gurdwaras', 30),
  ('services', 'Services', 40)
on conflict (code) do nothing;

insert into public.places (name, category_code, suburb, description, sort_order) values
  ('Patel Brothers', 'grocery', 'Harris Park', 'Indian grocery on Wigram Street — the Little India strip.', 10),
  ('Spice of Life', 'grocery', 'Westmead', 'Groceries, fresh produce and spices near the station.', 20),
  ('India At Home', 'grocery', 'Strathfield', 'Large-format Indian supermarket chain.', 30),
  ('Chatkazz', 'restaurant', 'Harris Park', 'Street-food institution — dosa, chaat, late hours.', 10),
  ('Billu''s Indian Eatery', 'restaurant', 'Harris Park', 'North Indian eatery and sweets counter on Wigram Street.', 20),
  ('Sri Venkateswara Temple', 'temple', 'Helensburgh', 'Major South Indian temple south of Sydney; weekend crowds.', 10),
  ('Gurdwara Sahib Parklea', 'temple', 'Parklea', 'Sikh gurdwara in the north-west; langar on Sundays.', 20),
  ('BAPS Shri Swaminarayan Mandir', 'temple', 'Rosehill', 'Swaminarayan mandir near Parramatta.', 30)
on conflict do nothing;
