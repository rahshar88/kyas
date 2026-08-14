-- Goal catalogue (spec §S12)
--
-- §S12's nine options verbatim. These drive the beta home in Milestone 3 ("top selected
-- goals"), which is why the codes matter more than the labels — the home screen keys off
-- them.
--
-- No "Other" row. §S12 does not ask for one, and a free-text goal is precisely where someone
-- would type something personal; §S12 is explicit that analytics records "category
-- identifiers, not free-text personal information".

insert into public.goals (code, label, sort_order) values
  ('meet_people', 'Meet people', 10),
  ('find_events', 'Find events', 20),
  ('accommodation', 'Accommodation', 30),
  ('jobs', 'Jobs', 40),
  ('study_support', 'Study support', 50),
  ('sport', 'Sport', 60),
  ('food', 'Food', 70),
  ('local_services', 'Local services', 80),
  ('professional_networking', 'Professional networking', 90)
on conflict (code) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;
