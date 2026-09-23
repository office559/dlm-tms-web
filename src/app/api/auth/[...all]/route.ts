import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Predă toate rutele de autentificare (login, logout, sesiune etc.)
// către Better Auth. Înregistrarea publică e dezactivată din lib/auth.ts —
// conturile de dispecer se creează doar prin /api/dispatchers/accept.
export const { GET, POST } = toNextJsHandler(auth);
