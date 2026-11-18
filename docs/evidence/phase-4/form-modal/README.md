# Lead form in a modal

Every button that leads to the lead form opens it in a modal. Desktop (900px and up): a centered
dialog. Phones: a full-height bottom sheet that follows the visible area, so fields stay above
the keyboard. The inline form beside the score stays, and both views share one form state.

Built from the design's exit prompt (overlay, white card, close button) and the existing form.

## Screenshots

- `modal-desktop-1440-open.png`: just opened (focus on Full name)
- `modal-desktop-1440.png`: opened from the exit prompt, with the name and choice typed inline beforehand
- `modal-phone-390.png`: bottom sheet on a 390px phone
- `modal-phone-390-keyboard.png`: keyboard up (visible height 508px), phone field in view

## Browser test (`apps/web/tests/e2e/modal_flow.js`): 24 checks, all pass

See `modal_flow.txt`. Turnstile: Cloudflare is not reachable from the test machine, so its
script is replaced in the test by a stand-in with the same API; the checks cover where the
widget renders and which token the lead sends. Server-side verification has its own tests.

Also re-run after the change: lead flow (18 checks), sign-in flow (12), upload (all), DB tests (31), unit tests (10).
