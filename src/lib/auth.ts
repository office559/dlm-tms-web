import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { pool } from "./db";

// Configurația centrală de autentificare (Better Auth), conectată direct la
// baza de date Postgres găzduită de Supabase prin DATABASE_URL.
//
// `disableSignUp: true` blochează înregistrarea publică — un cont nou se
// creează DOAR din fluxul de invitație (vezi /api/dispatchers/accept),
// care apelează auth.api.createUser pe server, cu rol "dispatcher".
//
// Notă: nu am putut verifica live documentația Better Auth în această
// sesiune (fără acces la internet în acest workspace) — înainte de primul
// deploy, merită confirmată denumirea exactă a opțiunilor de mai jos față
// de versiunea instalată (`npm ls better-auth`).
export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 zile
  },
  plugins: [admin()],
});

export type Session = typeof auth.$Infer.Session;
