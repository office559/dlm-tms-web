"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

async function patchQuick(vehicleId: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`/api/vehicles/${vehicleId}/quick`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Alegerea tipului de echipaj: Single driver sau Team drivers. */
export function CrewSelect({
  vehicleId,
  value,
}: {
  vehicleId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setVal(value ?? "");
  }, [value]);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = val;
    setVal(next);
    setSaving(true);
    setError(false);
    const ok = await patchQuick(vehicleId, { crewType: next || null });
    setSaving(false);
    if (!ok) {
      setVal(prev);
      setError(true);
      return;
    }
    router.refresh();
  }

  const color =
    val === "team"
      ? "border-purple-300 bg-purple-50 text-purple-700"
      : val === "single"
        ? "border-sky-300 bg-sky-50 text-sky-700"
        : "border-slate-200 bg-white text-slate-500";

  return (
    <div>
      <select
        value={val}
        onChange={onChange}
        disabled={saving}
        className={`w-full rounded-lg border px-2 py-1 text-sm font-medium outline-none focus:border-brand disabled:opacity-60 ${color}`}
      >
        <option value="">— Alege —</option>
        <option value="single">Single driver</option>
        <option value="team">Team drivers</option>
      </select>
      {error && <div className="mt-1 text-xs text-red-600">Nu s-a putut salva.</div>}
    </div>
  );
}

/** Notiță liberă pe vehicul (ex. „defecțiune", „întârziere", „așteaptă piesă"). */
export function NoteControl({
  vehicleId,
  value,
}: {
  vehicleId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!editing) setText(value ?? "");
  }, [value, editing]);

  async function save() {
    setSaving(true);
    setError(false);
    const ok = await patchQuick(vehicleId, { note: text.trim() || null });
    setSaving(false);
    if (!ok) {
      setError(true);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setText(value ?? "");
    setError(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Scrie notița..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-brand"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Se salvează..." : "Salvează"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Anulează
          </button>
          {error && <span className="text-xs text-red-600">Nu s-a putut salva.</span>}
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-400 transition hover:border-brand hover:text-brand"
      >
        + Notiță
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={value}
      className="block w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-left text-xs leading-snug text-amber-900 hover:border-amber-300"
    >
      <span className="line-clamp-3 whitespace-pre-wrap break-words">{value}</span>
    </button>
  );
}
