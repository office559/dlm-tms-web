import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDispatcherInviteEmail(params: {
  to: string;
  name: string;
  inviteUrl: string;
}) {
  const { to, name, inviteUrl } = params;
  const from = process.env.INVITE_EMAIL_FROM ?? "DLM TMS <no-reply@tms.dlmlogistic.com>";

  await resend.emails.send({
    from,
    to,
    subject: "Invitație cont DLM TMS",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e4d8b">Ai fost invitat pe DLM TMS</h2>
        <p>Salut, ${escapeHtml(name)},</p>
        <p>Ai fost adăugat ca dispecer în aplicația DLM TMS. Apasă pe linkul de mai jos ca să îți setezi parola și să îți activezi contul.</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}" style="background:#1e4d8b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Activează-ți contul
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Linkul este valabil 7 zile. Dacă nu te așteptai la acest email, îl poți ignora.</p>
      </div>
    `,
  });
}

export async function sendOrgAdminInviteEmail(params: {
  to: string;
  name: string;
  organizationName: string;
  inviteUrl: string;
}) {
  const { to, name, organizationName, inviteUrl } = params;
  const from = process.env.INVITE_EMAIL_FROM ?? "DLM TMS <no-reply@tms.dlmlogistic.com>";

  await resend.emails.send({
    from,
    to,
    subject: `Contul tău de administrator pentru ${organizationName} pe DLM TMS`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e4d8b">Bine ai venit pe DLM TMS</h2>
        <p>Salut, ${escapeHtml(name)},</p>
        <p>Firma <b>${escapeHtml(organizationName)}</b> a fost creată în aplicația DLM TMS, iar tu ești administratorul ei. Apasă pe linkul de mai jos ca să îți setezi parola și să îți activezi contul. După ce intri, poți adăuga dispecerii și colegii tăi.</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}" style="background:#1e4d8b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Activează-ți contul
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Linkul este valabil 7 zile. Dacă nu te așteptai la acest email, îl poți ignora.</p>
      </div>
    `,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}
