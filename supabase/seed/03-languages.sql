-- Language catalogue (spec §S09)
--
-- The languages an Indian student in Sydney is most likely to speak, plus English. §S09:
-- "English may be selected like any other language" — it is not special-cased and carries no
-- implied proficiency, because assuming fluency from nationality is exactly the inference the
-- specification's tone guidance (§7.6) warns against.
--
-- `other` is the controlled Other option §S09 requires. It is a real catalogue row rather than
-- a free-text escape hatch so that analytics keeps receiving a code (§S12), and so the picker
-- has one consistent shape.
--
-- Codes are permanent once shipped. Labels may change; codes may not.

insert into public.languages (code, name, sort_order) values
  ('english', 'English', 10),
  ('hindi', 'Hindi', 20),
  ('punjabi', 'Punjabi', 30),
  ('gujarati', 'Gujarati', 40),
  ('marathi', 'Marathi', 50),
  ('bengali', 'Bengali', 60),
  ('tamil', 'Tamil', 70),
  ('telugu', 'Telugu', 80),
  ('malayalam', 'Malayalam', 90),
  ('kannada', 'Kannada', 100),
  ('urdu', 'Urdu', 110),
  ('odia', 'Odia', 120),
  ('assamese', 'Assamese', 130),
  ('konkani', 'Konkani', 140),
  ('kashmiri', 'Kashmiri', 150),
  ('sindhi', 'Sindhi', 160),
  ('nepali', 'Nepali', 170),
  ('sinhala', 'Sinhala', 180),
  ('rajasthani', 'Rajasthani', 190),
  ('haryanvi', 'Haryanvi', 200),
  ('bhojpuri', 'Bhojpuri', 210),
  ('maithili', 'Maithili', 220),
  ('tulu', 'Tulu', 230),
  ('other', 'Other', 999)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;
