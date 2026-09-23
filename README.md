# DLM TMS — fundația (autentificare + dispeceri)

Prima etapă din planul de migrare pe `tms.dlmlogistic.com`: un proiect Next.js
cu autentificare (Better Auth) și fluxul de invitație pe email pentru
dispeceri (Resend), conectat la o bază de date Postgres găzduită de Supabase.

**Important:** codul a fost scris în acest workspace fără acces la
internet (nu am putut rula `npm install` sau verifica live documentația
Better Auth/Resend din sesiunea curentă) — deci nu a fost testat prin
rulare reală încă. Structura și API-urile folosite corespund versiunilor
stabile cunoscute, dar la primul `npm install` + `npm run dev` verificăm
împreună și corectăm ce nu se potrivește exact.

## Ce face

- `/login` — autentificare cu email + parolă (Better Auth).
- `/dispatchers` — (doar admin) listă dispeceri + formular „Trimite invitație”.
- `/accept-invite/[token]` — dispecerul își setează parola și contul devine activ.
- `/dashboard` — pagină de bază după autentificare.

Înregistrarea publică e dezactivată: singurul mod de a crea un cont e prin
invitație (dispeceri) sau prin scriptul de mai jos (contul tău, admin).

## Pornire locală

```bash
npm install
cp .env.example .env.local   # completează valorile (vezi mai jos)
npm run auth:migrate         # creează tabelele Better Auth (user, session, account, verification)
```

Apoi rulează migrația proprie `migrations/001_dispatchers.sql` în
Supabase → SQL Editor (creează tabelele `dispatcher_invites` și `dispatchers`).

Creează-ți contul de admin (o singură dată):

```bash
npx tsx scripts/create-admin.ts "Alex Ioan" office@dlmtrans.com parola-ta
```

Apoi:

```bash
npm run dev
```

## Ce trebuie completat în `.env.local` / Vercel

| Variabilă | De unde |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string |
| `BETTER_AUTH_SECRET` | generezi tu, o dată: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://tms.dlmlogistic.com` |
| `RESEND_API_KEY` | Resend → API Keys |
| `INVITE_EMAIL_FROM` | ex. `DLM TMS <no-reply@tms.dlmlogistic.com>` — domeniul trebuie verificat în Resend |

## Deploy pe Vercel

1. Urcă acest folder într-un repo Git (GitHub) — cel mai simplu e prin GitHub
   Desktop sau `git init && git add -A && git commit -m "fundație"`, apoi
   creezi un repo nou pe github.com și îl legi (`git remote add origin ...`).
2. În Vercel: „Add New Project” → alegi repo-ul → adaugi variabilele de mai
   sus în Environment Variables → Deploy.
3. În Vercel → Domains, adaugi `tms.dlmlogistic.com` și pui înregistrarea CNAME
   pe care ți-o dă Vercel, la panoul de domeniu dlmlogistic.com.

## Următorul pas

După ce fundația asta e testată și funcțională, urmează etapa 2 din plan:
migrarea datelor (șoferi, vehicule, clienți, curse) din aplicația de pe
Claude în această bază de date reală.
