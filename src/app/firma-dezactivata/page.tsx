"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function FirmaDezactivataPage() {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-4">
        <h1 className="text-xl font-semibold text-brand-dark">Contul firmei este dezactivat</h1>
        <p className="text-sm text-slate-600">
          Accesul la aplicație pentru firma ta a fost oprit. Datele nu au fost șterse. Pentru reactivare, contactează
          furnizorul platformei.
        </p>
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg bg-brand text-white font-medium py-2 hover:bg-brand-dark transition"
        >
          Deconectare
        </button>
      </div>
    </div>
  );
}
