import { pool, createDispatcherInvite, type DispatcherInvite } from "@/lib/db";

/**
 * Panoul de platformă (doar proprietarul platformei): firmele-client, utilizatorii lor,
 * crearea unei firme noi și invitarea administratorului ei.
 * Fișier fără legătură cu sesiunea: verificarea „ești proprietarul platformei" se face în rute / pagină.
 */

export type OrgStatus = "activa" | "asteapta" | "fara_admin";

export type OrgCard = {
  id: string;
  name: string;
  createdAt: string;
  adminEmail: string | null;
  pendingEmail: string | null;
  pendingName: string | null;
  users: number;
  vehicles: number;
  jobs: number;
  status: OrgStatus;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listOrganizationCards(): Promise<OrgCard[]> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    created_at: Date;
    admin_email: string | null;
    pending_email: string | null;
    pending_name: string | null;
    users: number;
    vehicles: number;
    jobs: number;
  }>(
    `select o.id, o.name, o.created_at,
            (select u.email
               from memberships m join "user" u on u.id = m.user_id
              where m.organization_id = o.id and m.org_role = 'admin'
              order by m.created_at limit 1) as admin_email,
            (select i.email from dispatcher_invites i
              where i.organization_id = o.id and i.org_role = 'admin'
                and i.used_at is null and i.expires_at > now()
              order by i.created_at desc limit 1) as pending_email,
            (select i.name from dispatcher_invites i
              where i.organization_id = o.id and i.org_role = 'admin'
                and i.used_at is null and i.expires_at > now()
              order by i.created_at desc limit 1) as pending_name,
            (select count(*)::int from memberships m where m.organization_id = o.id) as users,
            (select count(*)::int from vehicles v where v.organization_id = o.id) as vehicles,
            (select count(*)::int from jobs j where j.organization_id = o.id) as jobs
       from organizations o
      order by o.created_at asc, o.name asc`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: new Date(r.created_at).toISOString(),
    adminEmail: r.admin_email,
    pendingEmail: r.pending_email,
    pendingName: r.pending_name,
    users: Number(r.users) || 0,
    vehicles: Number(r.vehicles) || 0,
    jobs: Number(r.jobs) || 0,
    status: r.admin_email ? "activa" : r.pending_email ? "asteapta" : "fara_admin",
  }));
}

export async function getOrganizationName(id: string): Promise<string | null> {
  const { rows } = await pool.query<{ name: string }>(`select name from organizations where id = $1`, [id]);
  return rows[0]?.name ?? null;
}

export async function organizationExists(id: string): Promise<boolean> {
  return (await getOrganizationName(id)) !== null;
}

type Fail = { ok: false; error: string };

function checkPerson(name: string, email: string): string | null {
  if (name.length < 2 || name.length > 120) return "Numele administratorului trebuie să aibă între 2 și 120 de caractere.";
  if (!EMAIL_RE.test(email) || email.length > 200) return "Adresa de email nu este validă.";
  return null;
}

async function emailTaken(email: string): Promise<boolean> {
  const { rows } = await pool.query(`select 1 from "user" where lower(email) = lower($1) limit 1`, [email]);
  return rows.length > 0;
}

/** Invitație de administrator pentru o firmă existentă (cele vechi, neacceptate, ale aceluiași email se anulează). */
export async function inviteOrganizationAdmin(
  organizationId: string,
  nameRaw: string,
  emailRaw: string
): Promise<{ ok: true; invite: DispatcherInvite; organizationName: string } | Fail> {
  const name = nameRaw.trim();
  const email = emailRaw.trim().toLowerCase();
  const bad = checkPerson(name, email);
  if (bad) return { ok: false, error: bad };
  const organizationName = await getOrganizationName(organizationId);
  if (!organizationName) return { ok: false, error: "Firma nu există." };
  if (await emailTaken(email)) {
    return { ok: false, error: "Există deja un cont cu acest email. Folosește altă adresă." };
  }
  await pool.query(
    `update dispatcher_invites set expires_at = now()
      where organization_id = $1 and lower(email) = $2 and used_at is null and expires_at > now()`,
    [organizationId, email]
  );
  const invite = await createDispatcherInvite({ email, name, organizationId, orgRole: "admin" });
  return { ok: true, invite, organizationName };
}

/** Firmă nouă + invitația administratorului ei. */
export async function createOrganization(input: {
  name: string;
  adminName: string;
  adminEmail: string;
}): Promise<{ ok: true; organizationId: string; invite: DispatcherInvite; organizationName: string } | Fail> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Numele firmei trebuie să aibă între 2 și 120 de caractere." };
  const bad = checkPerson(adminName, adminEmail);
  if (bad) return { ok: false, error: bad };

  const dup = await pool.query(`select 1 from organizations where lower(name) = lower($1) limit 1`, [name]);
  if (dup.rows.length) return { ok: false, error: "Există deja o firmă cu acest nume." };
  if (await emailTaken(adminEmail)) {
    return { ok: false, error: "Există deja un cont cu acest email. Folosește altă adresă." };
  }

  const client = await pool.connect();
  let organizationId: string;
  try {
    await client.query("begin");
    const o = await client.query<{ id: string }>(`insert into organizations (name) values ($1) returning id`, [name]);
    organizationId = o.rows[0].id;
    // setările firmei noi pornesc goale; numele firmei apare deja în Setări
    await client.query(
      `insert into settings (id, organization_id, company, currency, updated_at)
       values (true, $1, $2, '€', now())
       on conflict (organization_id) do nothing`,
      [organizationId, name]
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  const invite = await createDispatcherInvite({
    email: adminEmail,
    name: adminName,
    organizationId,
    orgRole: "admin",
  });
  return { ok: true, organizationId, invite, organizationName: name };
}
