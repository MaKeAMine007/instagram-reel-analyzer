"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";

export default function CampaignControl() {
  const router = useRouter();
  const [authed, setAuthed]               = useState(false);
  const [status, setStatus]               = useState<"active" | "inactive">("active");
  const [openWeeks, setOpenWeeks]         = useState<number[]>([1]);
  const [pendingStatus, setPendingStatus] = useState<"active" | "inactive">("active");
  const [pendingWeeks, setPendingWeeks]   = useState<number[]>([1]);
  const [saving, setSaving]               = useState<"status" | "weeks" | null>(null);
  const [savedOk, setSavedOk]             = useState<"status" | "weeks" | null>(null);

  useEffect(() => {
    if (localStorage.getItem("adminLoggedIn") !== "true") {
      router.replace("/admin");
      return;
    }
    setAuthed(true);
    fetch("/api/campaign")
      .then((r) => r.json())
      .then((d: { status: string; openWeeks: number[] }) => {
        setStatus(d.status as "active" | "inactive");
        setPendingStatus(d.status as "active" | "inactive");
        setOpenWeeks(d.openWeeks ?? [1]);
        setPendingWeeks(d.openWeeks ?? [1]);
      });
  }, [router]);

  async function saveStatus() {
    setSaving("status");
    try {
      const res  = await fetch("/api/campaign", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: pendingStatus }),
      });
      const data = await res.json() as { status: string; openWeeks: number[] };
      setStatus(data.status as "active" | "inactive");
      setSavedOk("status");
      setTimeout(() => setSavedOk(null), 1500);
    } finally {
      setSaving(null);
    }
  }

  async function saveWeeks() {
    setSaving("weeks");
    try {
      const res  = await fetch("/api/campaign", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ openWeeks: pendingWeeks }),
      });
      const data = await res.json() as { status: string; openWeeks: number[] };
      setOpenWeeks(data.openWeeks ?? []);
      setSavedOk("weeks");
      setTimeout(() => setSavedOk(null), 1500);
    } finally {
      setSaving(null);
    }
  }

  function toggleWeek(w: number) {
    setPendingWeeks((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort((a, b) => a - b)
    );
  }

  if (!authed) return null;

  const btnClass = "text-sm font-medium text-white bg-gray-900 border border-gray-900 rounded-md px-4 py-2 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Campaign Control</h1>
          </div>
          <a
            href="/dashboard"
            className="ml-auto text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Dashboard
          </a>
        </div>

        {/* Campaign Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Campaign Status</h2>
          <p className="text-xs text-gray-500 mb-4">
            Current:{" "}
            <span className={`font-medium ${status === "active" ? "text-green-700" : "text-red-600"}`}>
              {status === "active" ? "Active" : "Inactive"}
            </span>
          </p>
          <div className="space-y-2.5 mb-5">
            {(["active", "inactive"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={pendingStatus === s}
                  onChange={() => setPendingStatus(s)}
                  className="accent-gray-900"
                />
                <span className="text-sm text-gray-900">{s === "active" ? "Active" : "Inactive"}</span>
              </label>
            ))}
          </div>
          <button onClick={saveStatus} disabled={saving === "status"} className={btnClass}>
            {savedOk === "status" ? "Saved ✓" : saving === "status" ? "Saving…" : "Save Status"}
          </button>
        </div>

        {/* Open Weeks */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Open Weeks</h2>
          <p className="text-xs text-gray-500 mb-4">
            Current:{" "}
            <span className="font-medium text-gray-900">
              {openWeeks.length > 0
                ? openWeeks.map((w) => `Week ${w}`).join(", ")
                : "None"}
            </span>
          </p>
          <div className="space-y-2.5 mb-5">
            {[1, 2, 3, 4, 5].map((w) => (
              <label key={w} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pendingWeeks.includes(w)}
                  onChange={() => toggleWeek(w)}
                  className="accent-gray-900 w-4 h-4"
                />
                <span className="text-sm text-gray-900">Week {w}</span>
              </label>
            ))}
          </div>
          <button onClick={saveWeeks} disabled={saving === "weeks"} className={btnClass}>
            {savedOk === "weeks" ? "Saved ✓" : saving === "weeks" ? "Saving…" : "Save"}
          </button>
        </div>
      </main>
    </div>
  );
}
