-- Interest catalogue (spec §S11)
--
-- The fourteen options are §S11's list verbatim. `category` groups them in the picker so a
-- list this long stays scannable; the grouping is presentation, and analytics only ever
-- receives `code`.
--
-- `other` is §S11's "controlled Other" — a catalogue row, not free text, so that a future
-- recommendation engine never has to interpret what someone typed, and so no personal
-- information can arrive through an interest field.

insert into public.interests (code, label, category, sort_order) values
  ('cricket', 'Cricket', 'sport', 10),
  ('gym', 'Gym and fitness', 'sport', 20),
  ('movies', 'Movies', 'culture', 30),
  ('music', 'Music', 'culture', 40),
  ('photography', 'Photography', 'culture', 50),
  ('cooking', 'Cooking', 'culture', 60),
  ('travel', 'Travel', 'lifestyle', 70),
  ('gaming', 'Gaming', 'lifestyle', 80),
  ('cars', 'Cars', 'lifestyle', 90),
  ('startups', 'Startups', 'career', 100),
  ('investing', 'Investing', 'career', 110),
  ('networking', 'Networking', 'career', 120),
  ('study_groups', 'Study groups', 'study', 130),
  ('volunteering', 'Volunteering', 'community', 140),
  ('other', 'Other', 'other', 999)
on conflict (code) do update
  set label = excluded.label,
      category = excluded.category,
      sort_order = excluded.sort_order;
