# RoomPulse on GitHub Pages

This repository contains the Arabic/English RoomPulse app and its Cloudflare backend source.

## Hosting and updates

GitHub Pages serves the interface. Live sessions, replies, rankings, server-synchronized deadlines and QR generation still require the existing Cloudflare Worker and D1 database at https://roompulse.s21smk.workers.dev/ . The wheel runs in the browser. This is not an offline app.

Edit `index.html` for the interface, commit to `main`, and the `Publish teaching site` Actions workflow copies it to both static routes and publishes Pages. Do not change Pages Source from GitHub Actions to branch/root. Changes to backend.js require a separately authorized Cloudflare deployment; pushing to GitHub does not deploy the backend. Worker and database identifiers are setup placeholders. No credentials or database contents are included.

The worker permits API responses to the exact browser origin `https://omarnagycd.github.io`. Browser origins do not include a project path, so this applies to other pages under the same account origin, not only /RoomPulse/. This is not a login or an access-control replacement. Existing random trainer tokens still protect results and trainer controls. No credentialed cookies or wildcard origins are enabled. Participant links and QR codes do not include trainer tokens.

Trainer/browser state is separate on the two addresses. Stay on one host for a session; switching hosts can lose control access or create a new participant identity. The backend and database remain shared, so session codes work through either interface. Free-tier limits still apply. No paid plan has been enabled.

## Original application notes

### RoomPulse, live pilot

App: https://roompulse.s21smk.workers.dev/
Participant entry: https://roompulse.s21smk.workers.dev/join
The earlier https://hall-live.s21smk.workers.dev/ app remains available. Both apps use the same D1 database, preserving existing sessions and replies. Use the same link throughout an active session: browser storage is separate for each hostname.

## Features

Arabic and English interface, with Arabic RTL, English LTR, white surfaces and #E60000 accents. A trainer creates one question, choosing a two- or three-option poll or a written reply up to 500 characters. Results refresh every five seconds while the trainer page is visible.

The question bank contains the approved 50 questions in five categories. Ten are two-option polls and forty are written questions. Selection fills editable preparation fields and never starts a session on its own.

Sessions are anonymous by default. The trainer can instead choose named participation before creating the session. Each participant then supplies a name or nickname, in any language or format, up to 200 characters. Whitespace is preserved, and markup is displayed as text. Names are self-entered, not verified identities. The trainer sees each name with that person's selected option or written reply. Participants are told their name and reply reach the trainer and may appear on a projected screen.

## Data and limits

Sessions expire after 24 hours. Expired session data is removed when another session is created. The app needs internet access. Free Cloudflare quotas can temporarily stop service; this is a pilot, not an exam or high-stakes polling system. No card or billing was added.

Trainer control uses a random token kept in that tab's session storage. Refresh works in the same tab, but closing it or switching browsers or hostnames can lose control access. Do not share trainer access. Participant links do not contain the trainer token. Results, names and open/close controls require that token.

One reply per browser identifier is enforced. A different browser, device, cleared storage or hostname can allow another reply. Names do not establish identity. Do not collect sensitive information or customer records.

Trial limits: 1,000 unexpired sessions, 5,000 replies per session. Anyone with the app link can create a session. The question bank is accessible from the start page without authentication.

The migration added session_modes, text_answers, session_identity and participant_names tables without removing existing sessions or votes. Legacy sessions default to anonymous polls.

## Source

- index.html: Arabic client and embedded bank.
- backend.js: request handling and D1 queries.
- worker.js: self-contained deployed build with QR generator.
- bank.json and bank-expanded.json: approved bank and normalized bank.
- rebuild.py: regenerates worker.js.
- wrangler.jsonc: RoomPulse deployment and shared D1 binding.
- tests-v3/result.json: final named-mode and bank test results.

Install npm dependencies, run python rebuild.py, then deploy with a separately authorized Wrangler session. No credentials are included. The original app is a separate Worker named hall-live. It is not deleted by deploying roompulse. Changes to a shared database schema must remain compatible with both.

The QR generator is qrcode-generator 2.0.4 by Kazuhiko Arase, MIT-licensed. Preserve its license notice in the generated bundle.

## Verification

The deployed RoomPulse URL passed all 50 exact bank selection checks, both named answer modes in three independent browser contexts, QR decoding and manual-code joins, exact name-to-answer mapping, required-name validation, participant privacy checks, duplicate-after-reload checks, and close/reopen controls. Any-language names, punctuation, emoji, markup and a long nickname were accepted, with exact whitespace preservation and safe text rendering. Anonymous written-answer regression tests passed. Anonymous three-option polling regression tests also passed.

Final hosted bank, named poll results, named written results and name entry were visually inspected at 320, 390 and 1280 pixels. The old app was separately checked and a session created there was read and answered through the new URL.

## Bilingual update

AR and EN buttons are visible at the top of every trainer and participant screen. Switching changes the interface without reloading or discarding draft answers, selections or trainer controls. A browser remembers a language selected with these buttons. Participant links and QR codes carry the trainer's interface language, and participants can switch independently.

All interface labels, notices, states, validation messages and all 50 question-bank entries have English and Arabic versions. Selecting a bank question uses the currently selected language. Switching the interface does not translate or overwrite an already prepared question, trainer edits, participant names or submitted replies. Those remain exactly as entered. Text fields handle either direction automatically.

The final hosted bilingual release passed test_bilingual.py on both languages, with screenshots and horizontal-overflow checks at 320, 390 and 1280 pixels across home, bank, preparation, code entry, poll/written participation, confirmations, trainer results and validation. Both named answer modes were tested through decoded QR links and manual codes with independent browser contexts. Tests also covered language preference, live counts, closing/reopening, repeat submission after refresh and preserving custom content during a language switch. Separate checks verified English interface text, language-aware navigation, translated error and selection states, and trainer-only access to named results. Final hosted screenshots were visually inspected.

Run the tests against a local development instance with `python test_bilingual.py`, or against the live app with `TEST_URL=https://roompulse.s21smk.workers.dev python test_bilingual.py`. Live tests create short-lived test sessions and replies in the shared database.

The top activity tagline was removed from the shared header in both languages. RoomPulse, navigation and AR/EN buttons remain. Final mobile and desktop headers were inspected after deployment.

Category labels updated to ضحك / Laughs and موودك / Your mood. Questions unchanged; existing session titles are not rewritten.

## Timer, appearance and title update

The optional question timer is off by default. A trainer can enable it and enter minutes (0–1439) and seconds (0–59), for a total from one second to 23:59:59. It starts when the live session is created. Both trainer and participant see a server-synchronised countdown. At zero, replies are closed in the interface and rejected by the server, including direct requests. Closing/reopening before zero does not pause or reset the timer. At zero, start a new session to continue; the old results remain available until the normal 24-hour expiry. A separate session_timers table stores deadlines. Legacy sessions remain untimed.

The header has a light/dark toggle on all screens. Light is the default, and each browser remembers its choice. Language, theme and custom content are independent. Dark mode preserves the red accent and places the QR code on a white surface. The RoomPulse title has an explicit heavy bold style.

Local tests passed both named answer types in both languages with independent browsers, visible countdown, accepted replies before zero, rejected API replies after zero, disabled late browser submission, refresh/resume, non-resetting close/reopen, invalid duration checks, untimed sessions, remembered theme and unchanged trainer control after switching theme. Hosted verification is recorded separately in tests-timer-theme/result.json when run with TEST_URL.

Optional account sign-in and a cross-device archive are not part of this release yet. Guest sessions still expire after 24 hours. Do not claim long-term saved results until the authentication/archive update is implemented and verified.

## Empty preparation fields
Title, question and all three poll options start empty. Bilingual placeholders are hints only. Switching language preserves user-entered content, and selecting a bank question still fills editable preparation fields. Optional account sign-in was deferred at the owner's request and is not part of this release.

## Ranking mode and rounds
Ranking is a separate selectable-option mode. Polls and written replies are unchanged. A ranking question can have no correct option (rank every answer) or one trainer-selected correct option (rank correct answers only). The public participant endpoint never receives the answer key or leaderboard. Trainer authorization is required for question and cumulative results.

Server SQL records immutable first-answer receipt times, measured from question creation. Client-supplied timestamps cannot change the result. Network delay and joining late affect placement; this is a training game, not a proctored assessment. Exact elapsed-millisecond ties share a place. Points per question are floor(1000 / place), minimum 1. Wrong answers earn zero when correctness is enabled.

Close replies or let the optional timer expire to reveal question ranks. Next question continues the round and uses a new participant code and QR. Participants must use the same browser for every question, including anonymous mode, to combine their points. Names are labels and do not merge participants. Name/anonymous setting stays fixed within the round. End round closes all its questions and shows cumulative scores, with equal scores sharing a place. Up to 50 questions per round. Guest results retain the existing 24-hour lifetime and trainer-tab recovery limitations. No login or permanent archive was added.

Hosted ranking tests passed for fastest/correct paths, cumulative two-question scores, cumulative ties, private results and answer key, duplicate prevention, server timing, timer reveal/cutoff, finalization/reopen rejection, refresh/resume, AR/EN and 320/390/1280 widths. Full local poll/text timer and bilingual bank regressions passed, and hosted poll/text timed submission smoke tests passed. Source patch scripts document earlier edits and should not be rerun on the final sources.

## Wheel tab
The Wheel is a trainer-side random picker, separate from live answer modes. Enter one name, number or item per line, 2 to 200 lines, up to 100 characters each. Blank lines are ignored and surrounding spaces are trimmed. Every non-empty line has the same chance. Duplicate entries increase their combined chance. The winner remains for future spins; no automatic removal or prize fulfilment is performed.

Selection uses crypto.getRandomValues with rejection sampling to avoid modulo bias. Animation lands the selected segment under the pointer. Reduced-motion preference skips the long animation. Entries cannot be edited during a spin. Long labels are shortened visually on the wheel but the full winner is shown below; for more than 40 entries labels are omitted from the wheel itself. User text is displayed as text, not HTML. Entries stay only in the open page, with no API upload or local saved list, and are cleared by refresh. UI language/theme changes preserve the list. Suitable for training activities and small prizes, not a certified or monetary lottery.

Hosted Wheel checks passed in AR/EN and light/dark at 320/390/1280 widths, including edge validation, random/pointer agreement, real animation, reduced motion, editing lock, literal HTML-like text, repeated spins, no API requests and reset on refresh. Existing Ranking full local tests and hosted poll/text timed smoke tests also passed. Quiz is canceled and not included in the deployed app.

## Liquid-glass visual refresh
The owner-approved red/white glass system covers home, preparation, bank, participation, results, ranking, timer, wheel, language/theme controls and validation. Both themes use translucent panels, high-contrast text, red actions and a white QR surface. It is a CSS-only change inside index.html, generated from the reference stylesheet liquid-glass.css; backend.js and database schema were not changed. Rebuild remains python rebuild.py. Reduced-motion and reduced-transparency preferences are handled. Live release: aad7137b-76bd-4a1d-a1b6-4aebbf4488d1.

The restyle passed bilingual 50-bank selection and poll/text/QR/manual-code tests, wheel behavior, ranking/rounds/privacy/auth/timer cutoff and all timer/theme regressions locally. Ranking/rounds/auth/privacy/cutoff were rechecked on the live release. QR tests now wait for image decode before screenshotting. Screens were checked at 320/390/1280, both languages/themes. Tests create short-lived QA sessions, not persistent user-facing demo content.

## Quiz mode (added 2026-11-24)

A Kahoot-style live quiz on top of the existing RoomPulse tabs. Nothing existing was changed. It lives in a new "Quiz" tab and under `/api/quiz/*`, with its own D1 tables (`quiz_*`). No accounts. The host page uses a passcode that the owner types on first use; only a salted hash is stored. The passcode is never in the source or in chat.

Numbered feature list (Quiz):
1. Admin quiz library behind a host passcode (set on first run): add, edit, duplicate, delete, reuse. Quizzes stay saved until deleted.
2. Quiz builder with three question types: Multiple Choice (2-4 choices), Spot the Mistake (2-6 chat lines, pick the wrong one), Word Cloud (everyone types a word, live cloud).
3. Per-question timer (5-240 s). Each question has an editable max score (1-1000, default 10). A correct answer earns the max at 0 s, falling linearly to half the max at the time limit, measured to the millisecond and kept to 2 decimals (example, max 10, 20 s: 5 s = 8.75, 6 s = 8.50). Wrong or missing answers score 0.
4. Join with code or QR from the existing join page. Participants enter a name. No account.
5. Live big-screen host view with answered count and countdown; host can show results early. Results show automatically when everyone has answered or time ends.
6. Leaderboard after every question and a top-3 podium at the end.
7. Teams mode: 2-6 teams, players are balanced automatically, team standings use the average score per member.
8. Trainer report after the session: percent correct per question, who answered wrong, who did not answer, word-cloud words. Export to CSV (opens in Excel).
9. Excel flow: download a real .xlsx template (room for 40 questions, a Read me sheet), fill it, upload it back (.xlsx or .csv) to create the quiz. Quiz export as CSV.
10. Share button on the host screen: shares the join link and code (phone share sheet, or copies to the clipboard).
11. History: every finished game is saved with date/time, quiz, players, scores, per-question points and team results, kept until the admin deletes it. Per-game CSV export.
12. Arabic and English everywhere, mobile and desktop, dark and light mode, same red/white liquid-glass look.

Not included yet (not chosen): streak, double points, kick player, lobby music, company logo, polls, type-answer, true/false, match-it, last-one-standing, self-paced mode, accounts/SSO, AI generation.

Limits: free Cloudflare plan. Players poll about every 1.5 seconds, so several large sessions in one day can hit the free request quota. Live game state is kept 3 days; the saved History of finished games has no expiry and stays until deleted (D1 free tier: 500 MB per database, 100k row writes/day). Maximum 200 players per game, 100 saved quizzes, 50 questions per quiz.

Build: `python rebuild.py` regenerates worker.js from index.html and backend.js. `quiz/` holds the quiz module sources and tests (`api_test.mjs`, `e2e.py`); `build_quiz.py` injects the client module into a clean index.html. Backend changes need a separately authorized Cloudflare deployment.
