# Campaign Launcher

An implementation of the **Media Buying Task & Launch Management System** PRD (v2),
running entirely on the machine: React front end, **IndexedDB** as the database, no
server, no auth, no Meta API. Data you create persists across reloads.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The first thing anyone sees is **sign in** — one username
and password per person, listed in `CREDENTIALS.md` (hand them out, then delete that
file). Each account lands in its own role's screens; **Sign out** is in the header.

**How the sign-in works, honestly:** `src/auth/credentials.ts` holds usernames and salted
SHA-256 hashes; `src/auth/session.ts` verifies with Web Crypto and remembers the session
in `localStorage`. It all runs in the browser, so it separates seats and stops mistakes
— it does not secure a public URL, because the hashes ship in the JavaScript. It is
built as a seam: Firebase Auth replaces those two files and nothing else changes.

## Firebase

Built in, switched by config. With the six `VITE_FIREBASE_*` values in `.env.local`
the app uses **Firebase Auth** and **Firestore**; without them it runs on the local
browser database exactly as before. Setup is in **`FIREBASE.md`** — about ten minutes
in the console, no code changes, and the six accounts create themselves on first
sign-in.

- `src/db/index.ts` picks `db/firestore.ts` or `db/local.ts` (same four functions)
- `src/auth/index.ts` picks `auth/firebase.ts` or `auth/session.ts` (same four functions)
- Firestore collections use the PRD table names; `persistChanges` diffs and writes only
  the documents that changed; `onSnapshot` feeds the same `onRemoteChange` callback the
  local `BroadcastChannel` does, so notifications become cross-machine for free.

Firestore is a document store, not relational; at this team's data size that is fine.
The reason to choose Firebase is auth + realtime sync + hosting with no server to run,
not raw speed — nothing here is large enough for database speed to matter.

The app runs on the real clock (`src/clock.ts` is the one place to substitute a fixed
date for tests).

`npm run dev:local` starts a second server on http://localhost:5175 that ignores the
Firebase config (`.env.nofb` blanks it) and runs on the in-browser database — handy for
trying things against the seed without touching the team's live data.

## The seeded book

`src/data/seed.ts` holds the team's real accounts and campaigns: 17 ADSC, 18 RHKA and
17 GO DGTL accounts across UK, CANADA, AUSTRALIA and US (each with the supplier's own
label and the account's timezone). Campaigns and ad sets are complete for AUSTRALIA as
of 14 Sep 2026 (eight CBOs, every ad set with its real name and launch date); the other
markets' campaigns arrive next. Campaigns keep their Meta names verbatim
(`MAIN CBO Revida 4`) with a **MAIN** type; the app only generates §4.1 names for CBOs
it creates. A campaign whose ad sets have not been supplied yet carries one placeholder
ad set, `existing ads`, with no launch date or history — it makes the CBO read as live
and gives Next batch something to sit under, and is replaced when the real names come
in. Killed campaigns are not seeded. Spend and results are not stored (the PRD rules
metrics out).

## Design

Dark by default — Vercel-style monochrome surfaces with Apple-grade chrome: SF-first
type, translucent blurred bars, hairline top-highlights on raised surfaces, one shared
easing curve. The PRD's original light palette (§3.2) is still there behind the
moon/sun toggle in the top bar, so §3 remains reachable rather than deleted.

Styling is **Tailwind v4**. The tokens are CSS variables in `src/index.css`, mapped
into Tailwind's namespace with `@theme inline`, so components say `bg-surface` /
`text-fg-secondary` / `border-line` and never a hex — the theme toggle is one
attribute flip and no component knows which theme it is in. Repeated recipes
(buttons, inputs, chips, table cells) are components or exported class strings in
`src/components/ui.tsx`, not CSS classes, so a screen's styling is fully legible in
the screen's own file.

## Status model

Deliberately no "in progress" anywhere. A **setup task** is *Waiting for Creative*,
*Ready*, or *Completed*. A **creative task** is *To Do*, *Submitted*, or *Completed*.
There is no Start button to forget; completing setup is the single event that makes a
launch live.

## No setup assignment

Setup tasks are not assigned. Karl and Christian share one queue and split it between
themselves; whoever hits **Complete** is recorded as `completedBy`, and that is the
"setup person" Danny's day view and Mark's overview show. The launch drawer has no
assignee field — only the two deadlines. (This replaces PRD §6.5 / §10.5's
assign-or-claim model at the team's request.)

## UI density

The chrome is kept out of the way of the data: one 44px header row that holds the nav,
the prototype seat switcher, theme and reset; counters are an inline strip rather than
tiles; tables use 40px rows and two-line cells (product over country, due over time,
person over timestamp) so no screen needs more than eight columns; Mark's three
dropdown filters are one search box. `allLaunchRows` is memoized per database state
with a `WeakMap`, so every table on a screen derives from one denormalization pass.

## Colour

One hue means one thing everywhere (`src/labels.tsx`): **blue** NEW / planned / normal
priority / to do · **violet** SWE · **amber** REL / waiting / stopped · **rose** DIT /
high priority · **green** ready / live / submitted · **red** late / blocked / killed.
Primary actions, the active nav underline, focus rings and links use the accent blue.
Campaign cards carry their type's colour as a left edge. Typeface is **Geist** (with
Geist Mono for exact names), loaded from Google Fonts with a system fallback stack.

## Ad Accounts directory

One card per supplier account across every market: campaigns on it with LIVE / planned
state and slot count, open task count, blockers, and a **View tasks** drawer listing the
open work on that account. Charles adds accounts here — the §4.2 number extraction runs
as he types, with an override for messy display names. Danny browses read-only.

## Yzah's submission is editable

Until setup completes the launch, Yzah can change the Drive link or note and hit
**Update submission** — same action as the first submit, so the batch's `driveUrl` is
always the latest. Once the launch is live the record locks. She can also send a
**request to Charles** on any task ("source Drive only has 3 files"); it shows as a
⚠ Request chip on the task and a callout in the drawer until Charles marks it handled.

## Team

Charles builds the team from the **Team** screen: name, role (setup, creative, setup
QA, media buyer, executive), username, password. On Firebase the Auth account is
created on the spot through a throwaway secondary app instance, so the admin stays
signed in; locally the password is hashed onto the user record. People are
deactivated, never deleted — they can't sign in, but their name stays on everything
they did. Guards: you can't deactivate yourself, and the last active media buyer can't
be deactivated. A user's id is always `u_` + username, which is how a Firebase sign-in
maps back to a user without a lookup table.

## Account health — problem accounts

Every ad account has a health state: **Healthy**, or one of the problem states
**Restricted** (BM/account restriction), **In review** (verification, spend cap),
**Disabled**, **Paused**. A problem needs a one-line reason; setting the account back to
Healthy clears it. Separately, **Off-boarded** is for accounts that are banned, dead or
no longer used: not a problem to fix, just gone. Off-boarded accounts vanish from the
workspace and every launch picker, are excluded from all counts, and sit in their own
**Off-boarded (N)** tab in the directory with their campaigns kept for history. A note is
optional; **Bring back** restores one. Charles and the setup team can set it (setup is usually first to find
out); Danny and Mark see it.

Where it shows: the Ad Accounts directory has a **Problems (N)** category, problem cards
float to the top with a red edge, the status chip and the reason; the workspace account
header carries the chip; every setup task on that account gets a red callout with the
reason. A problem does **not** block work: Next batch and the launch drawer still go
through, with an amber warning carrying the reason, so creative can be queued while the
account is sorted out — setup sees the same warning on the task. Only an off-boarded
account blocks. Blockers (below) are per-task; this is per-account.

## Setup-team notifications

A bell in the header with an unread count and a feed of everything the setup side did —
Karl or Christian launching a task, raising or clearing a blocker, reporting an account
problem; Mark's QA checks — newest first, each one clickable to the ad set. The feed is
derived from the activity log (`setupEvents`), so it is complete and identical for
everyone; the unread line is per viewer. A **toast** pops for anything that arrives
while the page is open and was not the viewer's own action.

Live delivery uses a `BroadcastChannel` in `db/local.ts`: every persisted write tells
the other tabs on this machine, which reload from IndexedDB. That is the local stand-in
for a realtime backend — with Firestore, `onSnapshot` calls the same `onRemoteChange`
callback and the toasts become cross-machine.

## Setup blockers

Karl or Christian can raise a blocker on any open setup task with a reason — BM
restriction, account under review, payment method — and clear it when it lifts.
Blockers are orthogonal to status (a Ready task can be blocked), show as a ⛔ chip on
every setup view, count in Mark's and the Ad Accounts overview, have their own tab in
the setup queue, and clear automatically on completion.

## Add existing CBO — importing without a reset

The seed is for day one. Once the app is live, **↓ Add existing CBO** (Workspace header,
Charles only) brings a campaign that already runs in Meta into the workspace without
touching anything else: pick the country and ad account, type the campaign name exactly
as it is in Meta, the product (free text, existing ones suggest) and the type (MAIN by
default), then paste the ad-set names one per line. Each line is parsed the way the seed
is: the leading `MM/DD/YY` becomes the launch date at noon, "swipes" / "iterations" /
"deep" set the framework Next batch copies, anything else is a custom label. Duplicates
and lines that would push the CBO past four ad sets are flagged before saving. A CBO
pasted without ad sets gets the `existing ads` placeholder; the same drawer's second mode,
**Add ad sets to a CBO already here**, replaces that placeholder with the real names
later.

**Paste a Meta export** is the third mode and the fastest for a whole market: in Ads
Manager, Ad sets tab → Reports → Export table data → CSV (or select the rows and copy the
table). Drop the file in or paste the text. The parser finds the *Campaign name* and *Ad
set name* columns by header (casing and order do not matter), de-duplicates ad-level rows,
and, when an *Ad set delivery* column is present, skips ad sets Meta reports as off,
inactive, completed or deleted (toggle). Every campaign in the file becomes a card: new
CBOs get their product guessed from the name (editable), CBOs already in the account
only receive their missing ad sets, and a campaign whose ad sets are all off is left out
as killed. Anything that would exceed four ad sets is flagged. One click adds them all,
atomically. Excel (.xlsx) files are not read — choose CSV in the export dialog.

`src/importing.ts` holds the parsers; the reducer's `CAMPAIGN_IMPORT` /
`CAMPAIGN_IMPORT_MANY` enforce the rules.

## Instructions for setup — typed, in Charles's words

The app never holds the ads themselves; they live in Meta and in Drive. So every launch
has a free-text **Instructions for setup** box: *"just use the 09/18/26 swipes and
relaunch it here"*, *"duplicate the top 3 ads only, same budget"*. It is stored on the
setup task and shown at the top of the task drawer (a blue "Instructions from Charles"
panel), as a column in the setup queue, and as an `Instructions:` line in the copy
block. Charles can edit it in place — in the task drawer or the ad-set drawer — until
setup completes; each edit notifies the setup team through the bell and a toast.

**Relaunching an imported ad set.** The ad sets seeded from Meta have no Drive folder
here, so they used to be unselectable as a source. Now any live or old ad set is a valid
source, including imported ones (labelled *in Meta only* in the picker). Choosing one
with *Reuse exactly* creates no batch and no creative task: the setup task starts
**Ready**, its Creative row reads *Duplicate the ads from "09/11/26 SWIPES 2" in MAIN CBO
Revida 4*, and the instructions say which ones. The imported ad-set drawer has a
one-click **Relaunch these ads here** button that opens the launch drawer with all of
this preselected and a suggested sentence Charles can drop in and edit.

## Own Drive batch

The launch drawer's fifth source, **My own Drive batch**: Charles pastes the link to
creatives he made himself; what to do with them goes in the instructions box. No
creative task is created; the batch is stored complete with its Drive link and the
setup task starts **Ready** with that link on the copy block. Setup's table shows *From
Charles* in the Creative column.

## Cancelling a planned ad set

Any ad set that has not gone live has a red **Cancel launch** button in its drawer
(Charles only). The ad set, its launch and both tasks are removed. If the batch already
has a Drive link — Yzah submitted, or Charles supplied it — the batch stays in the
Library for reuse; an untouched empty batch is removed with it.

## Next batch — one click

Every campaign card with room has **⚡ Next batch**. One click creates a launch
modelled on that CBO's most recent active ad set: same framework and concept label,
same creative quantity as last time, the source ad set's Drive and direction attached to
Yzah's brief through the normal lineage path, today's date on the new ad set, deadlines
at noon / 6 pm (pushed out if the day is already past them). A Yzah task and a waiting
setup task appear immediately; a green line in the workspace says what was made. No
form, no confirmation — the button's tooltip tells you exactly what it will do.

Two rules keep a spammed click harmless. **One batch in flight per CBO**: while a
planned ad set is still waiting on Yzah or setup, the button reads *⏳ Batch in flight*
and is off. **Ad-set names are unique within a CBO**, enforced in the store like the slot
maximum — names go into Meta verbatim, so twins are refused, not suffixed. A planned
launch nobody has worked on can be undone with **Cancel this launch** in the ad-set
drawer (removes the ad set, launch and both tasks).

The toolbar's **⚡ Next batch · all ready (N)** does the same for every CBO on screen
that passes both rules, in one click. Both go through the same `CREATE_LAUNCH` path as the drawer
(`planNextBatch` in `store.tsx` builds the input), so naming, the slot maximum and the
log are identical, and the bulk action is atomic. Per §8.4 hooks and references are
never carried over silently; a CBO that has never launched gets a plain Swipes +
Playbook batch. **Launch…** next to it still opens the full drawer when you want to
shape the brief by hand.

## Creative priority

Charles sets **High / Normal / Low** on every creative task — in the launch brief, and
afterwards from the task drawer. Yzah's queue sorts by priority first and due date
second. It is Charles's field: Yzah sees it, cannot change it (`editBrief` permission).

## Local database

`src/db/local.ts` is the whole storage layer. IndexedDB, one object store per table in
PRD §14, named in the spec's snake_case so the browser's Application tab reads like the
data model document:

```
users · countries · ad_accounts · products · campaigns · adsets
creative_batches · launches · creative_tasks · setup_tasks · followups · activity_logs
```

The reducer only allocates a new array for the collections an action actually touched,
so `persistChanges` compares array identity against the previous state and rewrites just
those stores — writes stay proportional to the edit, not to the size of the database.
On a cold start the seed is written once; **Reset data** wipes and rewrites it.

This module is the seam: moving to a real API means reimplementing `loadDatabase`,
`persistChanges` and `resetDatabase` and touching nothing else.

## Workspace layouts

Three views over the same data, because the workspace does two different jobs — deciding
what to launch next, and scanning what exists:

- **Grid** — uniform cards, slot state as the headline (the §5.1 layout). A
  self-reflowing `auto-fill` grid, so column count follows available width.
- **Bento** — a dense 12-column mosaic with `grid-auto-flow: dense`. A CBO's tile grows
  with what is in it: 3–4 ad sets span half the row and lay their ad sets out two-up;
  2 span a third; 0–1 span a quarter. Full campaigns dominate the mosaic at a glance
  and the empty ones tuck into the gaps. (`bentoSpan()` in `Workspace.tsx`.)
- **Table** — every live ad set in the country as one flat table

**Filters** sit under the toolbar: campaign **state** — Ready / In flight / Launched
today / Full / Problem account, each with a live count — campaign **type**, and
**product**, on top of the text search. State is classified with exactly the rules the
Next batch button uses, in the same order, so "Ready (N)" is always the N the bulk
button will launch into. Layout, country and per-account collapse state persist per
user; filters reset each visit.

## QA checkmark

Mark can tick any setup record as checked, with an optional note (`src/screens/
SetupOverview.tsx`, and the QA section of the setup drawer). It writes three fields —
`checkedBy`, `checkedAt`, `checkNote` — and **§11.2's condition is enforced by
construction: nothing in the app reads them to decide whether work may proceed.** Karl
and Christian can complete setup, and Charles can launch, whether or not Mark has
ticked anything. Unchecking is always available. Only `SETUP_QA` can set it; everyone
else sees the state read-only, including the setup users on their own rows.

## What is actually wired up

This is not a click-through of static screens. The rules from the PRD are implemented,
and the state changes propagate:

- **Naming is generated, never typed.** `src/naming.ts` builds campaign names as
  `[TYPE] [PRODUCT] [ACCOUNT#]`, appends `-2`/`-3` only when that exact name is taken,
  and builds ad-set names as `MM/DD/YY <concept label>` from the *new* launch date. The
  seed data itself is generated through the same functions, so it can't drift.
- **The ad-set maximum is enforced in the store, not the UI.** `MAX_ADSETS_PER_CAMPAIGN`
  in `src/naming.ts` is **4** (the PRD shipped 3; raised on request). `src/store.tsx`
  throws before creating a fifth; the UI additionally disables full CBOs in the
  destination picker and offers "Create new CBO with this source". Both layers exist on
  purpose — §2.3 says a hidden button must never be the only guard.
- **Source lineage survives.** Reusing or relaunching stores `sourceAdsetId` /
  `sourceBatchId` and shows the source date as history in the workspace, the ad-set
  drawer, Danny's day view and Mark's history — while the destination always gets
  today's date.
- **Exact reuse creates no creative task.** Pick an old/killed ad set → Reuse exactly →
  the review block reads "Creates 1 setup task only, starting at *Ready for Setup*."
  Anything that needs new work creates a Yzah task and a setup task at
  *Waiting for Creative*.
- **The handoff runs end to end.** Yzah submits a Drive link → the linked setup task
  flips Waiting → Ready → Karl or Christian completes it → the launch gets a
  `launchedAt`, the ad set goes Active, and it appears in Danny's day view and Mark's
  history with the time and the person.
- **Permissions are a table, not hidden buttons.** `src/permissions.ts` holds the §2.2
  matrix; it drives navigation *and* guards every mutation. Mark has no route to the
  creative queue and `assertCanWrite` would reject one anyway.

## Where things live

| Path | What it is |
| --- | --- |
| `src/types.ts` | The §14 data model, camelCase |
| `src/naming.ts` | §4 naming service — the only place names are built |
| `src/permissions.ts` | §2.2 matrix + §2.1 navigation |
| `src/selectors.ts` | Pure queries over the data — what the API would expose |
| `src/store.tsx` | State + every mutation; where the business rules are enforced |
| `src/data/seed.ts` | Mock data for the seeded day |
| `src/db/local.ts` | IndexedDB — the only storage code |
| `src/index.css` | Visual system — dark tokens, light overrides, components |
| `src/theme.ts` | Theme toggle and pre-paint restore |
| `src/screens/` | One file per screen; `LaunchDrawer.tsx` is the §6 flow |

## Decisions I made that the PRD does not settle

These are the places where the spec was silent and the prototype had to pick something.
Each is a one-line change if you want it the other way.

1. **Killed and archived ad sets release their slot** (`OCCUPYING_STATUSES` in
   `selectors.ts`). Planned, Active and Stopped ad sets occupy one of the three. If
   killed ad sets kept their slot, a CBO could never be refreshed and §7's relaunches
   would be impossible — but this does mean a campaign card can show `1 / 3` while
   holding four historical ad sets, which the ••• menu reveals under "Show history".
2. **A launch becomes "launched" when setup is completed.** The PRD shows a launch time
   next to the setup person (§12.2) but never says what stamps it. Completing setup is
   the only event that fits.
3. **The §6 five steps are one scrollable drawer, not a five-click wizard.** §15.1
   budgets 20–30 seconds for a normal launch; a wizard spends most of that on Next
   buttons. The numbered sections keep the PRD's order and the naming preview is pinned
   in the footer throughout.
4. **Overdue setup tasks carry forward into Mark's Today window.** Otherwise yesterday's
   unfinished setup disappears from the one counter he is watching.
5. **For Reuse + add new creatives, the ad set points at the new batch** and the launch
   keeps `sourceBatchId` pointing at the old one, with the source Drive link auto-added
   to Yzah's references. The PRD implies two batches on one ad set; this keeps one
   creative record per ad set and the lineage intact.
6. **Suggested campaign type**: DIT for a deep iteration, REL when the source is an
   old/killed ad set or an exact reuse, NEW when the product has no campaign in that
   account yet, otherwise SWE. Always overridable. §4.1 only specifies the NEW case.
7. **Dark is the default, against §3.1's white surfaces.** Requested by the team after
   the first build. The light palette is intact behind the toggle, so nothing was lost.
8. **An IndexedDB schema upgrade discards rows rather than migrating them** (`DB_VERSION`
   in `src/db/local.ts`). Fine for prototype data; a production migration would rewrite
   rows in place.
9. **`getAll()` returns key order, not insertion order**, so `User` gained a `sortOrder`
   field and `normalizeOrder()` re-sorts countries, users, products and accounts once at
   the load seam instead of every consumer sorting defensively.

## Known gaps — deliberately not built

- No auth. The view-as bar stands in for it, and the current seat persists in the
  database's `meta` store.
- The database is per-browser-profile. Two people opening the app on different machines
  see different data — there is no sync, by design.
- Setup tasks are the only thing that can be "completed" — there is no way to move an
  ad set to Stopped or Killed from the UI yet, so the Library is seeded rather than
  reachable. Archive works from the ad-set drawer.
- No Meta API, no metrics, no analytics — and per §13.4 and §17.3 that is the point,
  not an omission.
