# ADR-0007 — The Scene: a public directory beside a private community

- **Status:** accepted
- **Date:** 2026-09-16
- **Milestone:** M5 (the Scene)
- **Decided by:** the founder (§22 — product scope), mechanism debated and locked with
  engineering on 16 September 2026.

## Context

Through Milestone 4, nothing in this product is reachable before sign-in, and
`20260808000400_lock_down_anon.sql` enforces that posture at the grant layer: the anonymous
role cannot even resolve names in `public`. The product was a private, invite-gated community
for Indian students in Sydney, and every design rule — membership privacy (§2.3, §13),
count-never-names (§S19), owner-only RLS — protects the people in it.

The founder's expansion: KyaScene should also be **the public Indian database in Australia**
— a surface with value to people who will never join the student beta, and the funnel through
which some of them do. That collides with the closed posture, so the boundary had to be drawn
deliberately rather than eroded feature by feature.

## Decision

**Places are public. People are never public.**

1. **The public side ("the Scene") is a curated directory of places and services** — Indian
   groceries, restaurants, temples and gurdwaras, services. v1 is places and services only;
   events and editorial guides are future candidates. No table reachable by `anon` may carry
   a `user_id` or any other person-shaped column, and no policy for a person-shaped table may
   ever name `anon`. `supabase/tests/m5.test.sql` proves both directions on every run: the
   directory reads anonymously, and all sixteen person-shaped tables refuse `anon` at the
   grant layer.

2. **One app, and sign-in state decides the front door — there is no chooser screen.**
   Signed out, the app opens into the Scene, which carries one clearly-marked entry:
   "Students — sign in". Signed in and approved, the app opens to the student home exactly
   as before, with the Scene reachable inside. Rejected alternatives: a start-screen
   chooser (a lobby both audiences must tap through every launch), and two separate apps
   (double the builds, releases, review surface and update pipeline this project has
   already paid for once).

3. **The directory is read-only to every client.** No insert/update/delete policy and no
   write grant exists for `anon` or `authenticated`; curation is an operator act through the
   console or SQL editor. The founder owns the directory's accuracy (§22) — the starter seed
   in `seed/08-scene-starter.sql` says so at the top.

4. **Schema usage returns to `anon`, and that is the entire concession.** Defence in depth
   still holds for everything else: person-shaped tables have no anon grant (layer one) and
   owner-scoped policies (layer two). The lock-down migration's comment — "nothing in P0 is
   meant to be reachable before sign-in" — is superseded by this ADR for exactly two tables.

## Consequences

- The `(scene)` route group has no auth guard — the first such group. The launch route's
  signed-out destination changes from S01 Welcome to the Scene; that change ships alone,
  after the screens are device-verified, per the launch-path rule in the build log.
- Public content means public scrutiny: listings are claims about real businesses, so rows
  ship inactive-by-default in future imports until reviewed, and `active = false` retires a
  listing without deleting its history.
- The privacy disclosures do not change: the Scene stores and reads no personal data. The
  `scene_viewed` analytics event carries a two-value audience enum and nothing else (§14.3).
- `scope-boundaries.md` is amended: "no public surface" is no longer a P0 non-goal; "no
  public *people*" is permanent.
