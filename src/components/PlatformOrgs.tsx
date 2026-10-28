"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgCard } from "@/lib/platform";

type Notice = { orgId: string | null; text: string; link?: string; warn?: boolean };

const btnPrimary =
  "rounded-lg bg-brand text-white font-medium px-4 py-2 text-sm hover:bg-brand-dark transition disabled:opacity-60";
const btnGhost =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:border-brand transition disabled:opacity-60";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand bg-white";

function StatusBadge({ status }: { status: OrgCard["status"] }) {
  if (status === "activa")
    return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Activă</span>;
  if (status === "asteapta")
    return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Așteaptă admin</span>;
  return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Fără admin</span>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export function PlatformOrgs({ cards, activeOrgId }: { cards: OrgCard[]; activeOrgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<{ orgId: string | null; text: string } | null>(null);

  // firmă nouă
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // invitație pentru o firmă existentă
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");

  async function enter(orgId: string) {
    setBusy(`enter:${orgId}`);
    setError(null);
    const res = await fetch("/api/platform/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError({ orgId, text: d.error ?? "Nu am putut schimba firma." });
      setBusy(null);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function describe(data: { emailSent?: boolean; inviteUrl?: string }, email: string, orgId: string | null): Notice {
    return data.emailSent
      ? { orgId, text: `Invitația a fost trimisă la ${email}. Linkul e valabil 7 zile.`, link: data.inviteUrl }
      : {
          orgId,
          warn: true,
          text: `Emailul către ${email} nu s-a putut trimite. Trimite-i tu linkul de mai jos (valabil 7 zile).`,
          link: data.inviteUrl,
        };
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    setNotice(null);
    const res = await fetch("/api/platform/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, adminName: newAdminName, adminEmail: newAdminEmail }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; emailSent?: boolean; inviteUrl?: string };
    setBusy(null);
    if (!res.ok) {
      setError({ orgId: null, text: data.error ?? "Firma nu a putut fi creată." });
      return;
    }
    setNotice(describe(data, newAdminEmail.trim(), null));
    setShowNew(false);
    setNewName("");
    setNewAdminName("");
    setNewAdminEmail("");
    router.refresh();
  }

  async function sendInvite(orgId: string, name: string, email: string) {
    setBusy(`invite:${orgId}`);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/platform/organizations/${orgId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; emailSent?: boolean; inviteUrl?: string };
    setBusy(null);
    if (!res.ok) {
      setError({ orgId, text: data.error ?? "Invitația nu a putut fi trimisă." });
      return;
    }
    setNotice(describe(data, email.trim(), orgId));
    setInviteFor(null);
    setInvName("");
    setInvEmail("");
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignorăm */
    }
  }

  function NoticeBox({ orgId }: { orgId: string | null }) {
    if (!notice || notice.orgId !== orgId) return null;
    return (
      <div
        className={`mt-3 rounded-lg px-3 py-2 text-sm ${
          notice.warn ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
        }`}
      >
        <div>{notice.text}</div>
        {notice.link && (
          <div className="mt-1.5 flex items-center gap-2">
            <input readOnly value={notice.link} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700" />
            <button type="button" onClick={() => copy(notice.link!)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              Copiază
            </button>
          </div>
        )}
      </div>
    );
  }

  function ErrorBox({ orgId }: { orgId: string | null }) {
    if (!error || error.orgId !== orgId) return null;
    return <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.text}</div>;
  }

  return (
    <div className="space-y-4">
      {/* mesajul de după crearea unei firme noi */}
      {notice && notice.orgId === null && <NoticeBox orgId={null} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-brand-dark">{c.name}</div>
                {c.id === activeOrgId && (
                  <span className="mt-1 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    Lucrezi aici
                  </span>
                )}
              </div>
              <StatusBadge status={c.status} />
            </div>

            <div className="mt-1 truncate text-sm text-slate-500">
              {c.adminEmail ?? (c.pendingEmail ? <span className="text-amber-700">invitație trimisă la {c.pendingEmail}</span> : "nicio invitație de administrator")}
            </div>

            <div className="my-4 flex gap-6">
              <Stat value={c.users} label="utilizatori" />
              <Stat value={c.vehicles} label="vehicule" />
              <Stat value={c.jobs} label="curse" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => enter(c.id)}>
                {busy === `enter:${c.id}` ? "Se deschide..." : "Intră în firmă"}
              </button>
              {c.status === "asteapta" && c.pendingEmail ? (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy !== null}
                  onClick={() => sendInvite(c.id, c.pendingName ?? c.name, c.pendingEmail!)}
                >
                  {busy === `invite:${c.id}` ? "Se trimite..." : "Retrimite invitația"}
                </button>
              ) : (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy !== null}
                  onClick={() => {
                    setInviteFor(inviteFor === c.id ? null : c.id);
                    setError(null);
                  }}
                >
                  Invită admin
                </button>
              )}
            </div>

            {inviteFor === c.id && (
              <form
                className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendInvite(c.id, invName, invEmail);
                }}
              >
                <input className={inputCls} placeholder="Numele administratorului" value={invName} onChange={(e) => setInvName(e.target.value)} required />
                <input className={inputCls} type="email" placeholder="Email administrator" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} required />
                <button type="submit" className={btnPrimary} disabled={busy !== null}>
                  {busy === `invite:${c.id}` ? "Se trimite..." : "Trimite invitația"}
                </button>
              </form>
            )}

            <NoticeBox orgId={c.id} />
            <ErrorBox orgId={c.id} />
          </div>
        ))}

        {/* cardul „Firmă nouă” */}
        {!showNew ? (
          <button
            type="button"
            onClick={() => {
              setShowNew(true);
              setError(null);
              setNotice(null);
            }}
            className="flex min-h-[170px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 font-bold text-brand transition hover:border-brand"
          >
            <span className="text-3xl leading-none">+</span>
            Firmă nouă
          </button>
        ) : (
          <form onSubmit={createOrg} className="space-y-3 rounded-2xl border border-brand/40 bg-white p-5">
            <div className="text-base font-semibold text-brand-dark">Firmă nouă</div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Numele firmei</label>
              <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex. Alfa Trans SRL" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Numele administratorului</label>
              <input className={inputCls} value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="ex. Ion Popescu" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Email administrator</label>
              <input className={inputCls} type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="admin@firma.ro" required />
            </div>
            <ErrorBox orgId={null} />
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={busy !== null}>
                {busy === "new" ? "Se creează..." : "Creează firma și trimite invitația"}
              </button>
              <button type="button" className={btnGhost} onClick={() => setShowNew(false)}>
                Anulează
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
