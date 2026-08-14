-- Cultural community catalogue (spec §S10)
--
-- The list is taken verbatim from §S10 and deliberately not extended: these are identities
-- people claim for themselves, and inventing categories on their behalf is the opposite of
-- what the screen is for. §S10: "never inferred from state, language or religion."
--
-- There is no religion row and never will be in P0 — §13.2: "No religion field in P0."
--
-- "Prefer not to specify" is NOT a row here. It is a column on student_profiles, so declining
-- to answer stays distinguishable from having answered with nothing, and so selecting it can
-- clear the rest (§S10 acceptance) rather than sitting alongside them as a contradiction.

insert into public.communities (code, label, sort_order) values
  ('punjabi', 'Punjabi', 10),
  ('gujarati', 'Gujarati', 20),
  ('marathi', 'Marathi', 30),
  ('bengali', 'Bengali', 40),
  ('tamil', 'Tamil', 50),
  ('telugu', 'Telugu', 60),
  ('malayali', 'Malayali', 70),
  ('kannada', 'Kannada', 80),
  ('rajasthani', 'Rajasthani', 90),
  ('haryanvi', 'Haryanvi', 100),
  ('bihari', 'Bihari', 110),
  ('goan', 'Goan', 120),
  ('kashmiri', 'Kashmiri', 130),
  ('assamese', 'Assamese', 140),
  ('odia', 'Odia', 150),
  ('sindhi', 'Sindhi', 160),
  ('konkani', 'Konkani', 170),
  ('pahadi', 'Pahadi', 180),
  ('north_east_indian', 'North-East Indian', 190),
  ('other', 'Other', 999)
on conflict (code) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;
