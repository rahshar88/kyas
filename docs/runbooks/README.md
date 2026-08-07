# Runbooks

§13.5 requires runbooks for eight incident types. Milestone 0 writes the two that apply to
the work that exists now; the rest are stubbed with the milestone that will own them, so
the list is a visible checklist rather than a silent omission.

| Runbook                                   | Status     | Owner milestone                   |
| ----------------------------------------- | ---------- | --------------------------------- |
| [Local development](local-development.md) | ✅ written | M0                                |
| [CI and quality gates](ci.md)             | ✅ written | M0                                |
| Credential or API-key exposure            | stub       | M1 (first real Supabase project)  |
| Inappropriate profile content             | stub       | M2 (first user-generated content) |
| Harassment or safety report               | stub       | M2                                |
| Incorrect approval or suspension          | stub       | M2 (admin decisions exist)        |
| Data-deletion failure                     | stub       | M3 (deletion workflow exists)     |
| Push-notification mistake                 | stub       | M3 (push foundation exists)       |
| Service outage                            | stub       | M4 (real testers to notify)       |
| Lost store-signing access                 | stub       | M4 (signing credentials exist)    |

Each stub becomes a real runbook in the milestone that creates the thing it protects. A
runbook for a system that does not exist yet cannot be tested, and an untested runbook is
worse than none — it creates false confidence during an incident.

Named response owners are a §22 founder decision (§18 "Operations": registration approval
owner, support response owner, safety escalation path). They are recorded here when named.
