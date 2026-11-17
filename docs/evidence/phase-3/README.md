# Phase 3 evidence: database, accounts, lead form, CRM

Branch `phase-3-accounts`. Production build against a local Postgres 17 and the scoring
service; then again with both Docker images on a private network (Railway setup).

## Automated tests

| Suite | Result |
| --- | --- |
| Scoring service (pytest) | 131 passed in 17.53s |
| Web unit tests | # pass 10 # fail 0  |
| Database tests (real Postgres) | # pass 28 # fail 0  |
| Browser: uploads, 17 files × 2 widths | 34 passed, 0 failed |
| Browser: lead flow (390 + 1440) | 17 passed, 0 failed |
| Browser: sign-in, signed-in upload, account deletion | 12 passed, 0 failed |
| Browser: admin CRM | 15 passed, 0 failed |

### Lead flow
```
ok   @390 result saved in the browser
ok   @390 returning visitor sees the score and the form again
ok   @390 client validation as designed
ok   @390 short phone refused
ok   @390 server refuses a landline (mobile check)
ok   @390 confirmation shows the email
ok   @390 saved result cleared after the lead
ok   @390 after the lead, the landing page shows again
ok   @1440 result saved in the browser
ok   @1440 returning visitor sees the score and the form again
ok   @1440 exit prompt shows when leaving through the top
ok   @1440 client validation as designed
ok   @1440 short phone refused
ok   @1440 server refuses a landline (mobile check)
ok   @1440 confirmation shows the email
ok   @1440 saved result cleared after the lead
ok   @1440 after the lead, the landing page shows again
```

### Sign-in
```
ok   sign-in link requested
ok   sign-in email sent with a link
ok   link scanners get a confirm page, token kept
ok   opening the link signs in
ok   session cookie set
ok   session cookie is httpOnly, SameSite=Lax
ok   the same link does not work twice
ok   signed in: "Saved to your dashboard" instead of the form
ok   signed-in results are not kept as a browser saved result
ok   account deleted
ok   signed out after deletion
ok   sixth request within an hour is refused
```

### Admin
```
ok   signed-out admin is sent to the login page
ok   wrong password refused
ok   wrong code refused
ok   admin cookie httpOnly + SameSite=Strict
ok   leads list shows 8 leads
ok   band filter: 4 rows, all Professional Grade
ok   CSV export follows the filters, phone guarded
ok   note added
ok   stage change saved
ok   pipeline shows the moved lead
ok   drop-offs counted (26)
ok   non-https link refused
ok   same-origin admin request reaches validation
ok   cross-origin admin request refused
ok   signed out
```

## Docker (Railway setup)

- Migrations applied by the pre-deploy command (`node dist/migrate.cjs`) in the web image.
- Lead flow passes against the two production images; scoring reached only by its private name.
- Full `pg_dump` of that database: the synthetic account number appears **0** times; its last
  3 digits don't appear in stored results either. Container logs: 0 mentions.

## Design match

- Exit prompt: 0.00% (mobile) and 0.81% (desktop) different from the design.
- Confirmation screen: the share-card panel arrives with share cards in Phase 7; the rest
  follows the design. Links come from `/admin` → Settings.
- Admin leads, lead detail, pipeline, funnel, drop-offs: side by side in `design-vs-built/`
  (design left, built right, with local demo data).
- Built from existing design pieces, for review (`new-screens/`): admin sign-in and two-step
  check, admin settings, "Saved to your dashboard" banner.

Earlier design frames that changed on purpose (approved): MT4 error removed, error copy from
`docs/advice-texts.md`, early score instead of "not enough history", retest checkbox on every
result, footer links hidden, privacy line "We never store your statement or your account number."
