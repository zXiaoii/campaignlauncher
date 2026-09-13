# Deploying Campaign Launcher — GitHub + Vercel

The repo is initialised locally with a first commit. Two things need your accounts:
a GitHub repository to push to, and a Vercel project that builds from it.

## 1. GitHub (2 minutes)

1. https://github.com/new → name it `campaign-launcher` → **Private** → do **not** add
   a README / .gitignore / licence (the repo already has them) → **Create repository**.
2. Copy the repo URL it shows (`https://github.com/<you>/campaign-launcher.git`) and run,
   in this folder:

```bash
git remote add origin https://github.com/<you>/campaign-launcher.git
git push -u origin main
```

Git will open a browser window to sign you in the first time.

**Never committed, by design:** `.env.local` (Firebase config) and `CREDENTIALS.md`
(plaintext passwords) are git-ignored. Check with `git ls-files | findstr /i cred`
— it should print nothing.

## 2. Vercel (5 minutes)

1. https://vercel.com/new → **Import** the `campaign-launcher` repo (connect GitHub if
   asked).
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output
   `dist` — the defaults.
3. **Environment Variables** — add the six from `.env.local`, exactly these names:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

   Without them the deployed app would run on a browser-local database — each
   visitor alone. With them it is the shared Firebase app.
4. **Deploy.** Vercel gives you a URL like `campaign-launcher-xxxx.vercel.app`.

## 3. Tell Firebase about the new domain (1 minute)

Firebase Auth only accepts sign-ins from domains it knows.

Firebase console → **Authentication → Settings → Authorized domains → Add domain** →
paste the Vercel hostname (`campaign-launcher-xxxx.vercel.app`, no `https://`).
Do the same for any custom domain you attach later.

Until this is done, sign-in on the deployed site fails with *"This site is not on the
Firebase authorized domains list"* — the app shows that message on the sign-in card.

## After that

Every `git push` to `main` redeploys automatically. Pull requests get their own preview
URL (also needs authorising in Firebase if you want to sign in on previews — or just
test on `main`).

## Sharing with the team

Send each person the Vercel URL plus their line from `CREDENTIALS.md`. First sign-in
creates their Firebase account. Then delete `CREDENTIALS.md`.
