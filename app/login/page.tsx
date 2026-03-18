"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Lock, Eye, EyeOff } from "lucide-react";

export default function CompanyLoginPage() {
  const router = useRouter();
  const [company, setCompany] = useState("AJSHRINK");
  const [password, setPassword] = useState("123");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (company.trim().toUpperCase() === "AJSHRINK" && password === "123") {
      router.push("/login/user");
    } else {
      setError("Invalid company name or password.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <span className="text-white text-2xl font-extrabold tracking-tight">AJ</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AJ Shrink ERP</h1>
          <p className="text-slate-400 text-sm mt-1">Flexible Packaging Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800">Company Login</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step 1 of 2 — Enter your company credentials</p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Company Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => { setCompany(e.target.value); setError(""); }}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g. AJSHRINK"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Company Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter company password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
          >
            Continue →
          </button>

          <p className="text-center text-xs text-gray-400 mt-5 border-t border-gray-100 pt-4">
            Demo credentials: &nbsp;
            <span className="font-mono font-semibold text-gray-600">AJSHRINK</span>
            &nbsp;/&nbsp;
            <span className="font-mono font-semibold text-gray-600">123</span>
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          v2.0 &copy; 2024 AJ Shrink ERP &mdash; Flexible Packaging
        </p>
      </div>
    </div>
  );
}
