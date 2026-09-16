-- Feature flags (spec §6.5)
--
-- "Server-managed feature flags. Default every future flag to false."
--
-- The split below is the whole point. Everything Milestones 1–3 actually shipped is on;
-- everything the concept artwork shows and the product does not yet have is off, and stays off
-- until the milestone that owns it says otherwise. §3.3's non-goals and §1.2's warning against
-- building "future features shown in concept artwork" are enforced here at runtime, not only
-- by intention.
--
-- Idempotent: re-seeding updates the description but never the switch. An operator who turned
-- something off in production did so for a reason, and a deploy must not turn it back on.

insert into public.feature_flags (key, enabled, description) values
  ('registration_open', true,
   'S02-S17 accept new registrations. Turning this off closes the beta to new people without taking the app down.'),
  ('invite_required', true,
   'S04 requires an invitation code. §2.3: the beta is invite-only.'),
  ('profile_photo_enabled', true,
   'S13 offers camera and photo library. Off means name only, which is a usable registration.'),
  ('referrals_enabled', true,
   'S19 issues personal referral codes. Off hides the screen and mints no new codes.'),
  ('feedback_enabled', true,
   'S20 accepts structured feedback.'),
  ('discovery_enabled', false,
   'Find Your People (P1, Milestone 6). Not built.'),
  ('scene_feed_enabled', false,
   'The Scene feed (P1). Not built — §3.3 lists it as a non-goal for P0.'),
  ('messaging_enabled', false,
   'Direct messaging (P1). Not built.'),
  ('kya_enabled', false,
   'Kya (P1). Not built.')
on conflict (key) do update
  set description = excluded.description,
      updated_at = now();
