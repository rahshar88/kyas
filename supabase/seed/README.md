# supabase/seed

Reference catalogues. Idempotent — every file uses `on conflict … do update`, so re-running is
safe and is how the lists are amended.

| File                         | Contents                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| `01-india-states.sql`        | 36 states and union territories, ISO 3166-2:IN codes (§S08) |
| `02-education-providers.sql` | Sydney universities and larger vocational providers (§S06)  |

Neither list needs to be exhaustive. §S06 requires a "Not listed" option, stored in
`student_profiles.provider_other`, and operators extend the tables as real registrations reveal
gaps.

§2.3 is the reason states are a maintained list rather than free text — "India is plural… must
never be collapsed into a single identity field" — and §S10 requires that cultural community,
which Milestone 2 adds, is **never inferred** from a student's state.
