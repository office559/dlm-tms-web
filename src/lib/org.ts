import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

/**
 * Organizația (firma-client a platformei) în numele căreia lucrează cererea curentă.
 *
 * - Un utilizator obișnuit aparține unei singure organizații (tabelul `memberships`)
 *   și vede DOAR datele ei.
 * - Proprietarul platformei (user.role = "admin" din Better Auth) poate alege, din
 *   panoul de platformă, organizația în care lucrează (cookie-ul `dlm-org`).
 *   Fără cookie, lucrează în organizația lui.
 * - Rutele fără sesiune (webhook-uri, scripturi) rulează cu `runWithOrg`.
 */

export const ORG_COOKIE = "dlm-org";

export type OrgRole = "admin" | "dispatcher" | "viewer";

export type OrgContext = {
  userId: string;
  /** Organizația activă: toate interogările se filtrează după ea. */
  organizationId: string;
  organizationName: string;
  orgRole: OrgRole;
  /** Proprietarul platformei (poate vedea panoul de platformă și toate organizațiile). */
  isPlatformAdmin: boolean;
  /** Poate administra organizația activă: admin al firmei sau proprietarul platformei. */
  isOrgAdmin: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const orgStore = new AsyncLocalStorage<string>();

/** Rulează `fn` în numele unei organizații anume (webhook-uri, scripturi — fără sesiune). */
export function runWithOrg<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  return orgStore.run(organizationId, fn);
}

async function loadContext(): Promise<OrgContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const userId = session.user.id;
  const isPlatformAdmin = session.user.role === "admin";

  const own = await pool.query<{
    organization_id: string;
    name: string;
    org_role: string;
  }>(
    `select m.organization_id, o.name, m.org_role
       from memberships m
       join organizations o on o.id = m.organization_id
      where m.user_id = $1 and o.active`,
    [userId]
  );
  let organizationId = own.rows[0]?.organization_id ?? null;
  let organizationName = own.rows[0]?.name ?? "";
  let orgRole = (own.rows[0]?.org_role ?? "viewer") as OrgRole;

  if (isPlatformAdmin) {
    // proprietarul platformei poate lucra în orice organizație
    let wanted: string | null = null;
    try {
      const c = (await cookies()).get(ORG_COOKIE)?.value ?? "";
      if (UUID_RE.test(c)) wanted = c;
    } catch {
      /* fără cookies în acest context */
    }
    const pick = wanted
      ? await pool.query<{ id: string; name: string }>(
          `select id, name from organizations where id = $1`,
          [wanted]
        )
      : { rows: [] as { id: string; name: string }[] };
    if (pick.rows[0]) {
      organizationId = pick.rows[0].id;
      organizationName = pick.rows[0].name;
      orgRole = "admin";
    } else if (!organizationId) {
      const first = await pool.query<{ id: string; name: string }>(
        `select id, name from organizations order by created_at limit 1`
      );
      organizationId = first.rows[0]?.id ?? null;
      organizationName = first.rows[0]?.name ?? "";
      orgRole = "admin";
    }
  }

  if (!organizationId) return null;

  return {
    userId,
    organizationId,
    organizationName,
    orgRole,
    isPlatformAdmin,
    isOrgAdmin: isPlatformAdmin || orgRole === "admin",
  };
}

/** Contextul utilizatorului curent (o singură dată pe cerere), sau null dacă nu e conectat. */
export const getOrgContext = cache(loadContext);

/** Organizația activă. Aruncă eroare dacă nu există sesiune (nu se întâmplă pe pagini protejate). */
export async function orgId(): Promise<string> {
  const fixed = orgStore.getStore();
  if (fixed) return fixed;
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Neautentificat: nu există organizație activă.");
  return ctx.organizationId;
}
