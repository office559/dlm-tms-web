"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteDispatcherForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const res = await fetch("/api/dispatchers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "A apărut o eroare.");
      setStatus("error");
      return;
    }
    setStatus("done");
    setName("");
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label className="text-sm text-slate-600">Nume dispecer</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm text-slate-600">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition disabled:opacity-60"
      >
        {status === "loading" ? "Se trimite..." : "Trimite invitație"}
      </button>
      {status === "done" && <p className="text-sm text-green-600 w-full">Invitație trimisă.</p>}
      {error && <p className="text-sm text-red-600 w-full">{error}</p>}
    </form>
  );
}
