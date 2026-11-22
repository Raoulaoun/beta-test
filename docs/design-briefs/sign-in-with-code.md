# Design brief: signing in without links

For Claude Design. Same product, same design system as the approved screens in `design/`
(flow, account, emails). Please match them: colours, Inter / Inter Tight, the pill buttons,
24px cards, the 390px phone and 1440px desktop frames. Every screen at both widths.

## What changes and why

Today a returning trader signs in with an emailed link that works once, for 15 minutes.
Too much friction. It is replaced by:

1. **Signed in automatically when they send the lead form.** The browser that sent the form
   stays signed in for a year, renewed on every visit. No email, no code.
2. **A 6-digit code by email, on any other device.** They type their email, receive a code,
   and type it on the same screen. Phones offer the code from the email automatically.

Nothing in any email signs anyone in. A forwarded email gives no access.

## Screens and states needed

### 1. "Sign in" in the public headers
- **Landing header** (dark hero): a "Sign in" link next to "How it works".
- **App header** (results, errors, confirmation; light): a "Sign in" link on the right.
- **Signed in:** both headers show the initials avatar instead (already built; it links to
  the dashboard). Please show both states.

### 2. Sign in with a code (replaces the link screens in `design/account`)
One card, two steps, as in the current sign-in card.
- **Step 1, email:** title, one line of body copy, Email field, primary button, the small
  "no password needed" line. States: empty, invalid email.
- **Step 2, code:** "We sent a 6-digit code to {email}". A code input: six boxes, or one
  field styled as six. It must accept paste of the whole code and the phone's code
  suggestion. Primary button, "Resend code", "Use a different email". States:
  - typing (partly filled);
  - wrong code;
  - code expired (codes last 10 minutes);
  - too many wrong tries (after 5, the code stops working: ask for a new one);
  - too many codes requested (at most 5 an hour: try again later);
  - "Code sent again" after Resend;
  - checking (button busy).
- **Success** goes straight to the dashboard (no screen needed).
- The "This sign-in link has expired" screen is no longer needed.

### 3. The code email
Same frame as the report email (`design/emails/report-email`: 600px, table-based, Arial
fallback, the navy header). Subject, preview text, the code large and easy to copy, "It
works for 10 minutes", and "If you didn't ask for this, ignore this email". Light and dark
mode.

### 4. "Open my dashboard" in the report email
A block in the report email that sends the trader to their dashboard: score history,
goals, coach notes. It is a plain link to the dashboard: on their own device it opens
straight away; anywhere else it asks for a code. Please place it where it reads best (it
should not compete with "Your first fix" or the webinar). Show the full email with it.

### 5. Confirmation screen after the lead form (`design/flow`, `screen=sent`)
The trader is now signed in. Add an "Open my dashboard" action that fits next to the
existing next steps, at both widths.

### 6. Someone who already has an account, signed out
On the results screen, the banner for a browser that has signed in before currently says
"You already have a Manager Test account. Sign in to save this result to your history."
with a "Send me a sign-in link" button. It becomes "sign in with a code". Please design:
- the banner;
- what happens on click: the code step inline in the banner, or the sign-in card in a modal.

### 7. Sign out
Staying signed in for a year needs a way out on shared computers. Please add sign out:
- in the account header (for example an avatar menu with Dashboard, Settings, Sign out, at
  both widths);
- and/or in Settings;
- with the signed-out state after it (back to the landing page, or a short confirmation).

## Copy

Please write the copy for every new line, button and message (including the email subject
and preview text). It goes into `docs/advice-texts.md` once approved and is used word for
word. Rules: plain, short, no "eligible / qualified / approved / accepted".

## Accessibility

Labels on every field, errors announced (role alert), the code field with
`autocomplete="one-time-code"` and a numeric keypad, focus moving to the code field after
step 1, 44px touch targets.
