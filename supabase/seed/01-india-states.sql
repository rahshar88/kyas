-- Indian states and union territories (spec §S08).
--
-- §2.3: "India is plural. State, city, culture, language and religion must never be collapsed
-- into a single identity field." This list exists so a student picks their own state rather
-- than having one inferred, and it is deliberately separate from the cultural-communities
-- catalogue that Milestone 2 adds — §S10 requires that a community is "never inferred from
-- state, language or religion".
--
-- Codes follow ISO 3166-2:IN.

insert into public.india_states (code, name, is_union_territory, sort_order) values
  ('IN-AP', 'Andhra Pradesh', false, 10),
  ('IN-AR', 'Arunachal Pradesh', false, 20),
  ('IN-AS', 'Assam', false, 30),
  ('IN-BR', 'Bihar', false, 40),
  ('IN-CT', 'Chhattisgarh', false, 50),
  ('IN-GA', 'Goa', false, 60),
  ('IN-GJ', 'Gujarat', false, 70),
  ('IN-HR', 'Haryana', false, 80),
  ('IN-HP', 'Himachal Pradesh', false, 90),
  ('IN-JH', 'Jharkhand', false, 100),
  ('IN-KA', 'Karnataka', false, 110),
  ('IN-KL', 'Kerala', false, 120),
  ('IN-MP', 'Madhya Pradesh', false, 130),
  ('IN-MH', 'Maharashtra', false, 140),
  ('IN-MN', 'Manipur', false, 150),
  ('IN-ML', 'Meghalaya', false, 160),
  ('IN-MZ', 'Mizoram', false, 170),
  ('IN-NL', 'Nagaland', false, 180),
  ('IN-OR', 'Odisha', false, 190),
  ('IN-PB', 'Punjab', false, 200),
  ('IN-RJ', 'Rajasthan', false, 210),
  ('IN-SK', 'Sikkim', false, 220),
  ('IN-TN', 'Tamil Nadu', false, 230),
  ('IN-TG', 'Telangana', false, 240),
  ('IN-TR', 'Tripura', false, 250),
  ('IN-UP', 'Uttar Pradesh', false, 260),
  ('IN-UT', 'Uttarakhand', false, 270),
  ('IN-WB', 'West Bengal', false, 280),
  ('IN-AN', 'Andaman and Nicobar Islands', true, 300),
  ('IN-CH', 'Chandigarh', true, 310),
  ('IN-DH', 'Dadra and Nagar Haveli and Daman and Diu', true, 320),
  ('IN-DL', 'Delhi', true, 330),
  ('IN-JK', 'Jammu and Kashmir', true, 340),
  ('IN-LA', 'Ladakh', true, 350),
  ('IN-LD', 'Lakshadweep', true, 360),
  ('IN-PY', 'Puducherry', true, 370)
on conflict (code) do update
  set name = excluded.name,
      is_union_territory = excluded.is_union_territory,
      sort_order = excluded.sort_order;
