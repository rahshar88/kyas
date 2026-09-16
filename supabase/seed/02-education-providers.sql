-- Greater Sydney education providers (spec §S06).
--
-- The beta is Sydney-only (§2.4), so this list covers Sydney universities and the larger
-- vocational providers. §S06 requires a searchable list plus a "Not listed" option — that
-- option is handled client-side and stored in student_profiles.provider_other, so this list
-- does not need to be exhaustive to be usable.
--
-- Operators extend this table as real registrations reveal gaps.

insert into public.education_providers (code, name, city, sort_order) values
  ('usyd', 'University of Sydney', 'Sydney', 10),
  ('unsw', 'UNSW Sydney', 'Sydney', 20),
  ('uts', 'University of Technology Sydney', 'Sydney', 30),
  ('mq', 'Macquarie University', 'Sydney', 40),
  ('wsu', 'Western Sydney University', 'Sydney', 50),
  ('acu-syd', 'Australian Catholic University (Strathfield)', 'Sydney', 60),
  ('cqu-syd', 'CQUniversity Sydney', 'Sydney', 70),
  ('uow-syd', 'University of Wollongong Sydney', 'Sydney', 80),
  ('latrobe-syd', 'La Trobe University Sydney', 'Sydney', 90),
  ('torrens-syd', 'Torrens University Sydney', 'Sydney', 100),
  ('nd-syd', 'University of Notre Dame Australia (Sydney)', 'Sydney', 110),
  ('tafe-nsw', 'TAFE NSW', 'Sydney', 120),
  ('icms', 'International College of Management Sydney', 'Sydney', 130),
  ('kaplan-syd', 'Kaplan Business School Sydney', 'Sydney', 140),
  ('sibt', 'Sydney Institute of Business and Technology', 'Sydney', 150),
  ('aiht', 'Australian Institute of Higher Education', 'Sydney', 160)
on conflict (code) do update
  set name = excluded.name,
      city = excluded.city,
      sort_order = excluded.sort_order;
