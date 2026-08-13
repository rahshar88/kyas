# Runbook — running the beta: flags, announcements and feedback

Day-to-day operation of Milestone 3's surfaces. Everything here is done in the Supabase SQL
editor, because §15 gives the console a deliberately small surface — review, users, audit — and
adding a settings screen for things done once a month would be more code to keep correct than
the SQL it replaces.

Every command below is safe to paste whole.

---

## Feature flags

§6.5: flags are server-managed and every unbuilt feature defaults to **off**. The app carries
the same defaults, so a flag that does not exist, and a flag fetch that fails, both mean off.

### See what is on

```sql
select key, enabled, description from public.feature_flags order by key;
```

### Turn something off

The reason to reach for this: a feature is misbehaving for testers and you want it gone
**without shipping a build**. It takes effect the next time each app fetches flags, which is on
entering the beta home.

```sql
update public.feature_flags set enabled = false, updated_at = now()
 where key = 'feedback_enabled';
```

### Turn something on

Only for features that are actually built. Turning on `discovery_enabled` today does not
produce a discovery screen — it produces a card that navigates nowhere, which is worse than the
"Coming soon" it replaced.

```sql
update public.feature_flags set enabled = true, updated_at = now()
 where key = 'referrals_enabled';
```

Re-running the seed (`supabase/seed/07-feature-flags.sql`) updates descriptions but **never**
flips a switch. An operator who turned something off did so for a reason, and a deploy must not
turn it back on.

---

## Announcements

§S18's "beta announcements". Approved testers only — an account still under review cannot read
them at all, which is enforced by the RLS policy rather than by the screen.

### Post one

```sql
insert into public.announcements (title, body) values (
  'Photos are working again',
  'Adding a profile photo failed on some phones last week. Fixed — try again if you gave up.'
);
```

Title up to 120 characters, body up to 2000. The most recent ten appear on the beta home.

### Retire one

Announcements are never deleted, so the history of what testers were told stays intact.

```sql
update public.announcements set active = false where title = 'Photos are working again';
```

---

## Reading feedback

§S20's structured reports. The category is what makes a hundred of them sortable; the comment
is what makes any one actionable.

### The queue, newest first

```sql
select f.reference, f.category, f.rating, f.comment, f.created_at,
       p.display_name, u.email
  from public.feedback f
  join public.profiles p on p.user_id = f.user_id
  join auth.users u on u.id = f.user_id
 order by f.created_at desc
 limit 50;
```

### Safety concerns first

The one category that should never wait in a queue.

```sql
select reference, comment, created_at
  from public.feedback
 where category = 'safety_concern'
 order by created_at desc;
```

### Finding one by reference

What a tester quotes when they contact support.

```sql
select * from public.feedback where reference = 'KYA-7F3K2Q';
```

Feedback cannot be edited or deleted, by anyone, including the person who filed it — a report
that changes after an operator reads it is worse than no report. Retraction is a conversation.

---

## Referral codes

§S19. Each approved tester gets one code with `referral_capacity()` seats — currently three,
changed in one place:

```sql
create or replace function public.referral_capacity()
returns integer language sql immutable as $$ select 5 $$;
```

Existing codes keep the capacity they were minted with. To widen one:

```sql
update public.invites set capacity = 5
 where owner_user_id = (select id from auth.users where email = 'asha@example.test');
```

### Who is recruiting

```sql
select u.email, i.code_plain, i.capacity, i.redeemed_count
  from public.invites i
  join auth.users u on u.id = i.owner_user_id
 where i.campaign = 'referral'
 order by i.redeemed_count desc;
```

Note that this is a **privileged** view. §S19 deliberately never shows a tester who used their
code — redeeming a code is consent to join KyaScene, not consent to being named to the person
who invited you. Do not relay these names back to inviters.

---

## Deletion requests

§S22 records a request and closes the account. **Nothing is erased yet**, and that is
deliberate: erasure has to follow an approved retention policy (§22), and one written against a
guess cannot be undone.

### Outstanding requests

```sql
select u.email, d.requested_at, d.scheduled_for, d.reason
  from public.deletion_requests d
  join auth.users u on u.id = d.user_id
 where d.state = 'requested'
 order by d.requested_at;
```

When a retention policy exists, the job that acts on `scheduled_for` is the thing to build. Until
then these rows are a list of people whose accounts are closed and whose data is still held —
which is worth knowing, and worth not leaving unattended for long.

---

## Push notifications

Milestone 3 registers device tokens and **sends nothing**. There is no send path, on purpose:
building one before anyone has agreed what is worth interrupting a person for is how a beta
teaches its testers to turn notifications off.

### Devices registered

```sql
select platform, count(*) from public.push_tokens group by platform;
```

On iOS, `getExpoPushTokenAsync` needs an `aps-environment` entitlement that EAS adds only once
an Apple push key exists — a §22 account decision. Until it is made, the notifications screen
reports "not set up on this build yet" and says it is our side, not the tester's. This table
staying empty is expected, not a fault.
