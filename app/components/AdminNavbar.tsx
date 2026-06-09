"use client";

import { useRouter } from "next/navigation";

export default function AdminNavbar() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("adminLoggedIn");
    router.push("/admin");
  }

  return (
    <nav className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-900">Reel Tank</span>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
