// Sign-in credentials — usernames and salted SHA-256 password hashes only. The
// plaintext passwords were generated once and handed over in CREDENTIALS.md; they
// do not exist anywhere in the source.
//
// THIS IS PROTOTYPE AUTH. It runs in the browser, so anyone with the built JS can
// read these hashes and, given time, brute-force short passwords. It keeps the
// team's seats separate and stops a stray click; it does not protect data on a
// public URL. When the app moves to Firebase, Firebase Auth replaces this file
// and `session.ts` — nothing else in the app knows how a user was verified.

export interface Credential {
  /** Matches `users.id` in the database. */
  userId: string
  username: string
  passwordHash: string
}

export const SALT = 'campaign-launcher::v1::'

export const CREDENTIALS: Credential[] = [
  {
    userId: 'u_charles',
    username: 'charles',
    passwordHash: 'fe3ca31d3fdfe0472c1bca411b79ebb1b3899e97657f4306c820669e55c6b1f3',
  },
  {
    userId: 'u_danny',
    username: 'danny',
    passwordHash: 'd14e83eaec9ff791a4a1e31e175f7a00075deca5db5d5814245d8bb9f4acacbc',
  },
  {
    userId: 'u_yzah',
    username: 'yzah',
    passwordHash: 'f493d16f02079bb4f1265fbaff81f56c1c674d664f296ca65b4c610dc6764d6d',
  },
  {
    userId: 'u_karl',
    username: 'karl',
    passwordHash: '362084de24511afa5412425686d9776bd306f6fb08bb206e76b9ff7f4b9d2bc4',
  },
  {
    userId: 'u_christian',
    username: 'christian',
    passwordHash: '3170b78f7f1888ba077859cda92f70a982de260c8c60d3629a2e85b1ca193c81',
  },
  {
    userId: 'u_mark',
    username: 'mark',
    passwordHash: '187b8e7aaf963e9f710dfe8fa1410055f952131718f9534f857d3467cac84b13',
  },
]
