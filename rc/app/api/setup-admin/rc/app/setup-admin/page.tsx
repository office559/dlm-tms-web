"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupAdminPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/setup-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "A apărut o eroare.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-2">
          <h1 className="text-xl font-semibold text-brand-dark">Cont creat!</h1>
          <p className="text-slate-600 text-sm">Te ducem la pagina de autentificare...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-brand-dark">Configurare cont admin</h1>
          <p className="text-sm text-slate-500 mt-1">
            Se folosește o singură dată, ca să-ți creezi propriul cont. După aceea pagina nu
            mai funcționează.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Cheia BETTER_AUTH_SECRET (din Vercel)</label>
          <input
            type="password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Numele tău</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-600">Parolă (minim 8 caractere)</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand text-white font-medium py-2 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {loading ? "Se creează..." : "Creează contul de admin"}
        </button>
      </form>
    </div>
  );
}
