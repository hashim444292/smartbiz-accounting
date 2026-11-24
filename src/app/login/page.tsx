"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Building2,
  User,
  KeyRound,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { unlockNotificationAudio } from "@/lib/notificationSound";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  // Mode: "LOGIN" or "SETUP"
  const [activeTab, setActiveTab] = useState<"LOGIN" | "SETUP">("LOGIN");

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup / Registration State
  const [licenseKey, setLicenseKey] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Karachi");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [machineId, setMachineId] = useState("");
  const [isLicenseActivated, setIsLicenseActivated] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [copyNotification, setCopyNotification] = useState(false);

  // Check desktop setup status on mount
  useEffect(() => {
    async function checkDesktopStatus() {
      try {
        const res = await fetch("/api/desktop/setup");
        const data = await res.json();
        if (data.success && data.isDesktop) {
          setIsLicenseActivated(Boolean(data.isActivated));
          if (!data.isSetupComplete) {
            setActiveTab("SETUP");
          }
        }
      } catch {}

      try {
        const licRes = await fetch("/api/desktop/license");
        const licData = await licRes.json();
        if (licData.machineId) {
          setMachineId(licData.machineId);
        }
        if (licData.isActivated) {
          setIsLicenseActivated(true);
        }
      } catch {}
    }
    checkDesktopStatus();
  }, []);

  const handleCopyMachineId = () => {
    if (machineId) {
      navigator.clipboard.writeText(machineId);
      setCopyNotification(true);
      setTimeout(() => setCopyNotification(false), 2000);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockNotificationAudio();
    try {
      sessionStorage.removeItem("sb_session_alarm_handled");
      sessionStorage.removeItem("sb_session_reminders_read");
      sessionStorage.removeItem("sb_bell_played_session");
      localStorage.removeItem("sb_reminders_read_sig");
    } catch {}
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || "Invalid login credentials");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockNotificationAudio();
    setError(null);
    setLoading(true);

    try {
      // 1. Activate license if key provided and not already activated
      if (licenseKey.trim() && !isLicenseActivated) {
        const licRes = await fetch("/api/desktop/license", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenseKey: licenseKey.trim(),
            clientName: ownerName.trim() || businessName.trim(),
          }),
        });
        const licData = await licRes.json();
        if (!licData.success) {
          throw new Error(licData.error || "License key activation failed");
        }
        setIsLicenseActivated(true);
      }

      // 2. Initialize Business Ledger
      const setupRes = await fetch("/api/desktop/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          email: setupEmail.trim(),
          password: setupPassword.trim(),
        }),
      });

      const setupData = await setupRes.json();
      if (!setupData.success) {
        throw new Error(setupData.error || "Failed to set up business database");
      }

      setSetupSuccess(true);

      // 3. Authenticate with the new credentials
      const loginRes = await login(setupEmail.trim(), setupPassword.trim());
      if (loginRes.success) {
        router.push("/sales/create");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during business setup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Accounts360 Desktop
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Professional Business Accounting, Inventory & FBR Digital POS
        </p>

        {/* Tab Switcher */}
        <div className="mt-5 inline-flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/80 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("LOGIN");
              setError(null);
            }}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === "LOGIN"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sign In (لاگ ان)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("SETUP");
              setError(null);
            }}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "SETUP"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Setup New Business (نیا سیٹ اپ)</span>
          </button>
        </div>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200 py-7 px-6 shadow-xl rounded-3xl sm:px-9">
          {error && (
            <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 p-3 flex items-center gap-3 text-rose-800 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {setupSuccess && (
            <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-3 text-emerald-800 text-xs animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Business setup complete! Logging into system...</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === "LOGIN" && (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address or Username
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com or username"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <span>Sign In to System</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("SETUP")}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Don't have an account? Set up your company &rarr;
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SETUP NEW BUSINESS & ACTIVATE LICENSE */}
          {activeTab === "SETUP" && (
            <form className="space-y-3.5" onSubmit={handleSetupSubmit}>
              {/* Machine ID Banner */}
              {machineId && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
                  <div className="truncate pr-2">
                    <span className="font-bold text-slate-700">Machine ID: </span>
                    <span className="font-mono">{machineId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMachineId}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-md text-[10px] font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copyNotification ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              )}

              {/* License Key Gate */}
              {!isLicenseActivated && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Software License Key <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required={!isLicenseActivated}
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="SBZ-2026-XXXX-XXXX"
                      className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Business Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Business / Company Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Hashim Trader, Hanif Mobile"
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              {/* Owner / Contact Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Owner / Administrator Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Hashim Khan"
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              {/* Phone & City Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Phone / Mobile
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0321-1234567"
                      className="block w-full pl-9 pr-2 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Karachi, Lahore"
                      className="block w-full pl-9 pr-2 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Login Email / Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Login Email or Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="admin@mycompany.com or username"
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Create Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span>Initializing Company & Ledger...</span>
                  ) : (
                    <>
                      <span>Complete Setup & Launch System</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("LOGIN")}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Already have an account? Sign in &rarr;
                </button>
              </div>
            </form>
          )}

          {/* Production Security Assurance Badge */}
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium text-[11px] text-slate-500">
              Accounts360 Standalone Edition &bull; FBR Digital POS Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
