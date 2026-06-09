"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import { loadHistory, saveToHistory, type HistoryItem } from "@/app/lib/history";
import { formatNumber, formatTimestamp } from "@/app/lib/formatters";

// / redirects to /form
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/form"); }, [router]);
  return null;
}

// ── Legacy Analyzer — preserved, not rendered at / ────────────────────────────

interface AnalyzeResult {
  views: number | null;
  likes: number | null;
  comments: number | null;
  caption: string | null;
  username: string | null;
  timestamp: string | null;
  thumbnail: string | null;
}

function AnalyzerPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "An unexpected error occurred.");
      } else {
        setResult(data);
        const item: HistoryItem = {
          url,
          thumbnail: data.thumbnail ?? null,
          username: data.username ?? null,
          views: data.views ?? null,
          likes: data.likes ?? null,
          comments: data.comments ?? null,
          timestamp: data.timestamp ?? null,
          analyzedAt: new Date().toISOString(),
        };
        saveToHistory(item);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />

      <main className="flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white text-center mb-3 tracking-tight">
            Analyzer
          </h1>
          <p className="text-gray-400 text-center mb-10 text-lg leading-relaxed">
            Analyze views, likes, comments, and engagement metrics from any public Instagram Reel.
          </p>

          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <label
              htmlFor="reel-url"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Reel URL
            </label>
            <input
              id="reel-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !loading) handleAnalyze();
              }}
              placeholder="https://www.instagram.com/reel/..."
              disabled={loading}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors text-sm disabled:opacity-50"
            />
            <button
              onClick={handleAnalyze}
              disabled={!url.trim() || loading}
              className="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                "Analyze Reel"
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-950/50 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm leading-relaxed">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
              {result.thumbnail && (
                <div className="flex justify-center">
                  <div className="relative w-48 aspect-[9/16] rounded-2xl overflow-hidden border border-white/10">
                    <Image
                      src={result.thumbnail}
                      alt="Reel thumbnail"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Plays",    value: formatNumber(result.views) },
                  { label: "Likes",    value: formatNumber(result.likes) },
                  { label: "Comments", value: formatNumber(result.comments) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 w-20 shrink-0 pt-0.5">Username</span>
                  <span className="text-sm text-white font-medium">@{result.username ?? "—"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 w-20 shrink-0 pt-0.5">Posted</span>
                  <span className="text-sm text-white">{formatTimestamp(result.timestamp)}</span>
                </div>
                {result.caption && (
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 w-20 shrink-0 pt-0.5">Caption</span>
                    <span className="text-sm text-gray-300 leading-relaxed line-clamp-4">{result.caption}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-gray-600 text-xs mt-6">
            Only public Reels are supported
          </p>
        </div>
      </main>
    </div>
  );
}
