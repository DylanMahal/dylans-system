# Dylan's System

Dylan's personal all-in-one PWA — `dylan@system:~$`. Breakcore / hacker aesthetic.
Live at https://dylanmahal.github.io/dylans-system/ (GitHub Pages, this repo).

**The app is the single source of truth.** The Excel workbook is a background backup only.

## Layout of this repo

- **`source/`** — what you edit. Never edit anything else.
  - `src/*.js` — the app, split into numbered modules, concatenated in filename order
  - `src/head.html`, `src/body.html`, `src/tail.html`, `src/bootfx.html` — the page
  - `src/style.css`, `src/style2.css` — styles (style2 wins, it loads second)
  - `build.py`, `config.json`, `static/`, `vendor_keep/`, `agent/`, `functions/`, `widget/`
- **Repo root** — build output only (`app.js`, `app.css`, `index.html`, …). Generated. Don't hand-edit.

## Build and deploy

```bash
cd source && python3 build.py          # -> source/dist/
cp -r dist/* ..                        # into the repo root
cd .. && git add -A && git commit -m "…" && git push
```

GitHub Pages takes **~45–50s** to go live. Add a `?v=N` cache-buster when verifying.

`build.py` concatenates `src/*.js`, runs **purgecss**, then **esbuild --minify**.
It needs `/tmp/tools/node_modules/.bin/{purgecss,esbuild}`; without them it emits
unminified output, which is fine for a quick check but don't ship it.

Commit as Dylan:
`git -c user.name="Dylan Mahal" -c user.email="DylanMahal@users.noreply.github.com" commit`

Shortcut: `sh source/deploy.sh "message"` does tools install + build + copy + commit + push in one go.

On Dylan's Windows PC (Claude Code, repo at `C:\Users\dylan\git\dylans-system`) run the same `sh source/deploy.sh "message"`
from Git Bash. It puts the build tools in `source/.tools` (gitignored) and finds whichever Python works. Needs Git, Node and Python.
`git pull` first: the cloud sessions push to the same repo.

## Working efficiently (Dylan watches his usage — keep each task lean)

- **Don't explore.** Use the module map below, then `grep -n` for the exact function/id and read
  only those line ranges (`sed -n A,Bp`). Lines are long and dense — never Read a whole module.
- **Never read build output** (`app.js`, `app.css`, `index.html` at the root) — it's generated.
- **Scale testing to the change.** Copy, markup moves and small CSS: build + deploy, no browser.
  New logic or interactions: one headless check of just that thing. Screenshots only for real
  layout work, and only at 390px unless the change is desktop-specific.
- Ship with `deploy.sh`; don't poll GitHub Pages afterwards (the container can't reach it anyway).
- Final reply: a few lines saying what changed. No long recaps.

Module map (`source/src/`): 00 sheet parser · 01 fx · 02 store/kv/realtime (`watch`, `save`, `load`) ·
02b banner art · 03 dates · 04–07 Excel edits/editor/edit mode · 08 today · 09 gym (also `openSheet`)
· 10 body · 11 tools · 11b journal · 11c protocols · 11d leetcode · 12 week page · 13 stack · 14 money
· 15 excel sync · 16 router (`go`) · 17 command palette + keys · 18 boot/sign-in · 19 media · 20 food ·
21 sleep · 22 push notifications · 23 streaks/habits · 24 notes + tasks · 26 ranks · 27 calendar
(`cal/week`) · 28 brick · 29 alter egos · 30 ascend. Boot screen: `bootfx.html` (+ `.bfx-*` in style2).
Page markup: `body.html` (sections `#v-<view>`).

## Things that have cost hours — read before debugging

- **Minification renames every top-level name.** Browser tests must use DOM selectors
  (`document.querySelector('.apin')`), never app globals like `ALTER` or `SB`.
- **purgecss strips classes built at runtime from strings.** Anything assembled like
  `'sk-'+name` must match the safelist pattern in `build.py` or it silently vanishes.
- **Never put an `autoplay` attribute on a video.** iPadOS draws its own play button on any
  video that declares autoplay and hasn't started — including the whole gap while the source
  loads. Mute from script and call `play()` instead.
- **WebKit refuses to autoplay a video it considers invisible** (`opacity:0`, `display:none`).
  Hiding a video to tidy it up will stop it playing. Cover it with a sibling instead.
- **The boot writes a trace to `diag/boot` in kv on sign-in.** When something misbehaves on
  Dylan's iPad or iPhone, read that rather than guessing from a desktop.
- The boot's visual is an **animated WebP** (`vault:boot/anim.webp`, cached as `bootanim`),
  not the video, precisely because his iPad refuses autoplay. The video only carries sound.

## Data

Supabase project `ucnwefjblxqbmmwdbqhw`, user `ea7f3c24-4af3-4b0c-a96b-10ea7c85bd40`.
Only the anon key is ever in this repo; it is safe and already public.

- **`kv` table** `(user_id, path, data)` with RLS — every document. Paths:
  `days/d-<day>`, `weeks/w-<isoweek>`, `food/d-<day>`, `sleep/w-<day>`, `gym/w-<id>`,
  `tasks/all`, `habits/log`, `habits/list`, `journal/e-<day>`, `alter/list`,
  `alter/e-<ego>`, `tools/music`, `body/wt`, `diag/boot`
- **`vault` storage bucket**, private — all media.
- `DAYK` is the *logical* day: clock time minus 5h, so a 2am entry counts as the night before.

### Alter egos
`alter/list` holds the egos. Each board is `alter/e-<id>` = `{notes, items:[{id, k:'i'|'v', f, p, w, h}]}`
where `f` is the file in `vault:<uid>/alter/<ego>/`, `p` its poster, `w`/`h` the real pixel size (the masonry
needs true dimensions). The gym motivation board is `alter/e-` + `LX('gb')` — not an ego.

## Privacy — this repo is public

- **Personal labels never go in code, comments, CSS or commit messages.** They live in the private
  word list, kv `sys/lex` (readable only signed in; edit it in the Supabase SQL editor). Code reads it with
  `LX(key, generic)` / `LW(key, generic)` / `PT(key, generic)` (protocols) and `[data-lx]` in markup.
  Always give a bland fallback. If you need a new personal word, add a key to `sys/lex`, not the source.
- Commit messages stay generic (`update`, `fix layout`), never naming what a section tracks.

## Rules

- **Media never goes in this repo.** It lives only in the private Supabase vault.
- Private playlists live in kv, never in code.
- Never commit `source/.secrets` or `source/.vapid.json` (gitignored).
- Don't type Dylan's passwords. He signs in himself.

## His machines

- **iPad and iPhone** — primary. Most layout bugs are phone-width bugs; check at 390px.
- **Windows PC** via the device bridge. a media downloader lives in `Downloads/`; run it by writing a
  `.bat` there and double-clicking it in File Explorer (granted at click-tier, so no typing).
- The Linux shell on the PC and the cloud container can't reach some media sites. Media comes in through
  the browser instead — see the `?relay=1` mode at the end of `src/29_alter.js` (allowed origins are in `sys/lex`).
