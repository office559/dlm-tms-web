// Creează contul tău (admin) o singură dată, direct din linia de comandă.
// Rulare: npx tsx scripts/create-admin.ts "Numele tău" tu@dlmtrans.com parola-ta
//
// Necesită DATABASE_URL și BETTER_AUTH_SECRET setate în mediu (.env.local).
// (tsx nu e în package.json — se instalează o singură dată, temporar: `npx tsx ...` îl descarcă automat)

import "dotenv/config";
import { auth } from "../src/lib/auth";

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error("Folosire: npx tsx scripts/create-admin.ts \"Nume\" email parola");
  process.exit(1);
}

const result = await auth.api.createUser({
  body: { name, email, password, role: "admin" },
});

console.log("Cont admin creat:", result.user.email);
process.exit(0);
