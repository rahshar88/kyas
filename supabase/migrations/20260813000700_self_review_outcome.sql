-- Milestone 2 — tell an operator that they cannot review *themselves*.
--
-- `admin_review_registration` refuses a self-review, which is right: an operator approving
-- their own registration is a conflict of interest, and the audit trail would record it as an
-- ordinary decision. But it returned `not_permitted`, the same value as "you are not an
-- operator at all", and the Edge Function mapped that to SESSION_EXPIRED with "You do not have
-- permission to do that."
--
-- So the founder — the only operator, reviewing the first registration in the system — was
-- told they lacked authority they demonstrably had, by a console they were signed into, with
-- an error code that says their session is broken. Every part of that message was false.
--
-- The original justification for one shared value was that distinguishing the two would tell
-- an unauthorised caller whether they hold admin rights. That reasoning does not survive
-- reading the function: `is_admin` is checked before anything else, so this branch is
-- reachable only by a confirmed operator. Nobody learns anything from it that they did not
-- already know about themselves.

alter type public.admin_review_outcome add value if not exists 'own_registration';

comment on type public.admin_review_outcome is
  'Result of an administrative review (§15.2). `not_permitted` means the caller is not an
   operator; `own_registration` means they are, but the registration is their own.';
