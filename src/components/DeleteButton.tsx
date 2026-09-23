"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ url, confirmText }: { url: string; confirmText: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (!window.confirm(confirmText)) return;
    setLoading(true);
    await fetch(url, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="text-red-600 hover:text-red-700 text-sm disabled:opacity-60"
    >
      {loading ? "Se șterge..." : "Șterge"}
    </button>
  );
}
