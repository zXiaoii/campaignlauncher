# Connecting Campaign Launcher to Firebase

About ten minutes, all in the Firebase console. Nothing in the app's code changes.

## 1. Create the project

1. https://console.firebase.google.com → **Add project** → name it (e.g. `campaign-launcher`).
   Google Analytics can stay off.
2. In the project: **Build → Authentication → Get started → Sign-in method →
   Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database → Start in production mode**, pick the
   region closest to the team (e.g. `australia-southeast1`).
4. **Firestore → Rules** → paste the contents of `firestore.rules` from this folder →
   **Publish.**

## 2. Register the web app and copy its config

1. **Project settings (gear) → Your apps → Web (</>)** → nickname `Campaign Launcher` →
   Register app. Skip hosting for now.
2. Under **SDK setup and configuration → Config**, you get six values.
3. In this folder, copy `.env.example` to `.env.local` and paste them in:

```
VITE_FIREBASE_API_KEY=AIza…
VITE_FIREBASE_AUTH_DOMAIN=campaign-launcher-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=campaign-launcher-xxxx
VITE_FIREBASE_STORAGE_BUCKET=campaign-launcher-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc…
```

4. Restart `npm run dev`. The sign-in card now says **Firebase · campaign-launcher-xxxx**
   instead of *Local database*.

## 3. Sign in — the accounts create themselves

Nobody needs to create users in the console. On each person's **first** sign-in the app
checks the password against the same hash it used locally and, if it matches, creates
their Firebase Auth account (`charles@campaign-launcher.app` etc. — synthetic emails,
nobody reads them). From then on Firebase owns the password; change it under
**Authentication → Users** if you ever need to.

The first sign-in also writes the seed (your AUS book) to Firestore. After that the
data lives there — every machine sees the same thing, and the notification toasts are
live across machines, not just across tabs.

## What is where

- `src/firebase/env.ts` — reads `.env.local`; `isFirebaseConfigured()` is the switch
- `src/firebase/config.ts` — the SDK handles, loaded only when configured
- `src/db/firestore.ts` — the storage seam over Firestore (`db/local.ts` is the
  IndexedDB twin); `src/db/index.ts` picks one
- `src/auth/firebase.ts` — the auth seam over Firebase Auth; `src/auth/index.ts` picks one
- `firestore.rules` — team-only access

## Going back

Delete (or rename) `.env.local` and restart. The app is back on the local database.
