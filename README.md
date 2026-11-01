# 20th Maine enlistment form smoke tests

Nightly [Playwright](https://playwright.dev) checks for the online enlistment form at
<https://www.20thmainecompanyg.com/enlistment-application>. GitHub runs them at about
3 AM Pacific every night and emails you if anything fails.

## What gets tested

| File | What it checks | Submits? |
| --- | --- | --- |
| `tests/page.spec.ts` | Page loads (HTTP 200, title); all 30 fields are present; required and optional fields are marked correctly; dues ($45 / $20), check-mailing instructions and the enlistment agreement wording haven't changed; accessibility scan (report only) | No |
| `tests/validation.spec.ts` | Empty Submit shows all 13 required-field errors; optional fields never error; filling each required field clears only its own error; choosing United States adds a required State field; bad emails and phone numbers are rejected and good ones accepted; radio buttons are one-choice-only | No |
| `tests/known-gaps.spec.ts` | Behaviour we'd *like* but don't have yet (see below). Tagged `@known-gap` and **not** run nightly | No |
| `tests/submit.spec.ts` | Fills in the whole form, submits it and checks for the "Thank you for enlisting…" message | **Yes**: opt-in only |

Every test runs twice, at desktop size and at phone size (Pixel 7).

The validation tests always leave at least one required field empty. Wix catches that in
the browser, so nothing is sent, no contact is created and no officer gets an email.

## Known gaps found on Oct 30, 2026

1. **Phone numbers need a country code picked first.** Typing `(408) 555-1234` gives
   "Enter a valid phone number." until the member opens the little flag menu and picks
   United States +1. Most members won't know to do that. Fix it in the Wix form editor
   by setting the default country on both phone fields to United States.
2. A first name made only of spaces is accepted.
3. Family member ages accept negative numbers and unrealistic values like 250.
4. **Submit sometimes needs two clicks.** Click into an empty required field, then click
   Submit: only that field's error appears and nothing else happens. Pressing the mouse
   button blurs the field, its error message appears, the page reflows and Submit moves
   before the mouse is released, so the click is lost. Members have to click Submit again.
   The tests work around it by moving focus off the field and pausing briefly before
   clicking Submit (found Nov 1, 2026).

When one of these is fixed, `npm run test:gaps` will show that test passing. Move it
into `validation.spec.ts` so it's checked every night from then on.

## Setup (one time)

1. Create a **private** GitHub repo and push this folder to it.
2. In GitHub go to **Settings → Notifications → System → Actions**. Tick **Email** and
   choose **Only notify for failed workflows**.
3. Open the repo's **Actions** tab and enable workflows if prompted. Then run
   **Nightly enlistment form smoke test → Run workflow** once to confirm it passes.

GitHub sends scheduled-run failure emails to whoever last edited the `cron:` line in
`.github/workflows/nightly.yml`. That will be you. GitHub also pauses scheduled
workflows in a repo with no activity for 60 days. If that happens you'll get an email,
and one click re-enables it.

## Running locally

```bash
npm ci
npx playwright install chromium
npm test                 # everything except known gaps and the real submission
npm run test:headed      # watch it run in a real browser window
npm run test:gaps        # the known-gap checks
npm run report           # open the last HTML report
```

## The real submission test

`tests/submit.spec.ts` sends one real enlistment. All 12 officers get the notification
email and Wix creates a contact. The entry is clearly labeled (first name `SMOKETEST`).
Run it rarely, for example after editing the form, and tell the officers first.

- From GitHub: **Actions → Run workflow**, tick "Also send ONE real submission".
- Locally: `npm run test:submit`. Set `SUBMIT_TEST_EMAIL` to receive the member-side
  copy yourself.

Afterwards, delete the SMOKETEST submission (Wix → Forms & Submissions) and its contact
(Wix → Contacts).

If Wix's spam filter starts blocking automated submissions, run it locally with
`--headed` instead.

## When a nightly run fails

Open the failed run in GitHub Actions and download the **playwright-report** artifact.
Unzip it and open `index.html`. Each failed test has a screenshot, a video and a
step-by-step trace. Failing tests are retried twice before the run counts as failed, so
one slow page load won't trigger an email.

Common causes:

- **The form was edited in Wix.** A renamed label, changed price or reworded agreement
  will fail the matching test. That's intended. Update the test text in
  `tests/enlistment-form.ts` or `tests/page.spec.ts`.
- **The page was unpublished or its URL changed.** The page-load test fails.
- **Wix changed its own error messages.** Update `REQUIRED_ERRORS` in
  `tests/enlistment-form.ts`.
- **The form's JavaScript never started.** Every test waits for Wix's React code to take
  over the page before clicking anything, because clicks before that are silently lost.
  If that wait times out, the error says "form JavaScript (React) did not initialise".
