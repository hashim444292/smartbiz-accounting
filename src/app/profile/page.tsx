"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  KeyRound,
  Shield,
  ShieldCheck,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Lock,
  Mail,
  Calendar,
  Save,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandPageLoader } from "@/components/ui/loader";

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, activeCompany, switchCompany, refreshSession } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "security" | "workspaces">("security");
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile Edit Form state
  const [nameInput, setNameInput] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Change Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch full user profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/profile");
      const data = await res.json();
      if (data.success && data.user) {
        setProfileData(data.user);
        setNameInput(data.user.name || "");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle Name Update
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!nameInput.trim()) {
      setProfileMessage({ type: "error", text: "Display name cannot be blank." });
      return;
    }

    try {
      setUpdatingProfile(true);
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setProfileMessage({ type: "success", text: "Profile display name updated successfully!" });
        setProfileData((prev: any) => ({ ...prev, name: nameInput.trim() }));
        await refreshSession();
      } else {
        setProfileMessage({ type: "error", text: data.error || "Failed to update profile name." });
      }
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Network error occurred." });
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Handle Password Reset / Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: "error", text: "Please enter your current password." });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "New password must be at least 6 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordMessage({ type: "error", text: "New password must be different from your current password." });
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setPasswordMessage({
          type: "success",
          text: data.message || "Password successfully changed! Use this new password for your next login.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMessage({ type: "error", text: data.error || "Failed to change password." });
      }
    } catch (err: any) {
      setPasswordMessage({ type: "error", text: err.message || "Network error occurred." });
    } finally {
      setChangingPassword(false);
    }
  };

  // Helpers
  const roleMeta = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return {
          title: "System Super Admin",
          desc: "Full Master Access over all Tenants, Multi-Tenant Subscriptions & System Config",
          color: "bg-purple-100 text-purple-800 border-purple-200",
          badgeBg: "bg-gradient-to-br from-indigo-600 to-purple-600",
        };
      case "OWNER_ADMIN":
        return {
          title: "Business Owner / Admin",
          desc: "Authorized Administrator for Assigned Company Workspace",
          color: "bg-blue-100 text-blue-800 border-blue-200",
          badgeBg: "bg-gradient-to-br from-blue-600 to-indigo-600",
        };
      case "ACCOUNTANT":
        return {
          title: "Chief Accountant",
          desc: "Manages Financial Ledgers, Tax Invoices, Purchases & Period Closing",
          color: "bg-emerald-100 text-emerald-800 border-emerald-200",
          badgeBg: "bg-gradient-to-br from-emerald-600 to-teal-600",
        };
      default:
        return {
          title: "Staff / Cashier",
          desc: "Operational POS Invoicing & Inventory Catalog Access",
          color: "bg-amber-100 text-amber-800 border-amber-200",
          badgeBg: "bg-gradient-to-br from-amber-600 to-orange-600",
        };
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  };

  const displayUser = profileData || authUser || {
    id: "usr-1",
    name: "System Admin",
    email: "admin@smartbiz.com",
    role: "SUPER_ADMIN",
    createdAt: new Date().toISOString(),
  };

  const roleInfo = roleMeta(displayUser.role);

  if (loading && !profileData) {
    return (
      <BrandPageLoader
        message="Loading User Profile & Security Settings..."
        submessage="Retrieving authentication credentials, security logs, and company access permissions..."
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb / Return Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              User Profile & Security
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Manage your personal credentials, reset your password, and view assigned workspaces.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayUser.role === "SUPER_ADMIN" ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-sm"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Platform Admin Portal</span>
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <span>Back to Dashboard</span>
            </Link>
          )}
        </div>
      </div>

      {/* User Overview Hero Card */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl ${roleInfo.badgeBg} text-white font-black text-2xl shadow-xl ring-4 ring-white/10 shrink-0`}>
              {getInitials(displayUser.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-2xl font-bold truncate">{displayUser.name}</h2>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-white/15 text-indigo-200 backdrop-blur-md border border-white/10">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  {roleInfo.title}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Account
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-indigo-400" />
                  {displayUser.email}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  ID: <code className="text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded text-[11px]">{displayUser.id}</code>
                </span>
                {displayUser.createdAt && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {new Date(displayUser.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={fetchProfile}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-xs font-medium text-white transition backdrop-blur-sm shadow-sm"
              title="Refresh profile data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "security"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Security & Password Reset</span>
          <span className="ml-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 border border-indigo-200">
            Key
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Account Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("workspaces")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === "workspaces"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Assigned Workspaces</span>
          {displayUser.companies && (
            <span className="ml-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
              {displayUser.companies.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SECURITY & PASSWORD RESET */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Password Change Form */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Change Your Password</h3>
                  <p className="text-xs text-slate-500">
                    Verify your current password and choose a new secure password for logging into SmartBiz.
                  </p>
                </div>
              </div>
            </div>

            {/* Alert Message */}
            {passwordMessage && (
              <div
                className={`mb-5 rounded-xl p-3.5 text-xs sm:text-sm flex items-start gap-2.5 border ${
                  passwordMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {passwordMessage.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{passwordMessage.text}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Demo hint: Default initial password is typically <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">admin123</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">hanif123</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">smart123</code>, or <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">madina123</code>.
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter a new password (min. 6 characters)"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    minLength={6}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 pr-10 ${
                      confirmPassword && newPassword === confirmPassword
                        ? "border-emerald-400 focus:border-emerald-600 focus:ring-emerald-600 bg-emerald-50/20"
                        : confirmPassword && newPassword !== confirmPassword
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                        : "border-slate-300 focus:border-indigo-600 focus:ring-indigo-600"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPassword && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                    {newPassword === confirmPassword ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match!
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match yet.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Password Quality Criteria Checklist */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-slate-600">Password Checklist:</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      newPassword.length >= 6 ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span className={newPassword.length >= 6 ? "text-emerald-700 font-medium" : "text-slate-500"}>
                    At least 6 characters in length
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      newPassword && currentPassword && newPassword !== currentPassword ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span
                    className={
                      newPassword && currentPassword && newPassword !== currentPassword
                        ? "text-emerald-700 font-medium"
                        : "text-slate-500"
                    }
                  >
                    Different from current password
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {changingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Update Password Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Security Best Practices Card */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm mb-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <span>Security Guidelines</span>
              </div>
              <ul className="text-xs text-indigo-800/80 space-y-2 leading-relaxed">
                <li>• Avoid sharing account credentials with unauthorized retail staff.</li>
                <li>• Use unique passwords not shared with other personal web services.</li>
                <li>• If you are an Accountant or Owner, maintain periodic password updates for FBR and audit compliance.</li>
                <li>• Platform Super Admins can also reset passwords from the Admin User Management portal if needed.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Current Session Context
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Active Business:</span>
                  <span className="font-semibold text-slate-800">{activeCompany?.name || "Global Platform"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Security Role:</span>
                  <span className="font-semibold text-indigo-600">{displayUser.role}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Auth Token:</span>
                  <span className="font-semibold text-emerald-600">Secure HTTP-Only Cookie</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OVERVIEW & PERSONAL INFO */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
                <p className="text-xs text-slate-500">
                  Update your display name and view account identification parameters.
                </p>
              </div>
            </div>

            {profileMessage && (
              <div
                className={`mb-5 rounded-xl p-3.5 text-xs sm:text-sm flex items-start gap-2.5 border ${
                  profileMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {profileMessage.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{profileMessage.text}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Display Full Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Muhammad Hanif"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={displayUser.email || ""}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Primary email is fixed to maintain audit trail and company ownership verification.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingProfile || !nameInput.trim() || nameInput.trim() === displayUser.name}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {updatingProfile ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Profile Name</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Role & Scope Details
              </h4>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-xs text-indigo-900">{roleInfo.title}</span>
                </div>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  {roleInfo.desc}
                </p>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">System User ID:</span>
                  <code className="text-slate-800 font-bold">{displayUser.id}</code>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Companies:</span>
                  <span className="font-bold text-slate-800">
                    {displayUser.role === "SUPER_ADMIN" ? "All Organizations (Global)" : `${displayUser.companies?.length || 1} Workspace(s)`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ASSIGNED WORKSPACES */}
      {activeTab === "workspaces" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h3 className="text-base font-bold text-slate-900">Your Assigned Company Workspaces</h3>
              <p className="text-xs text-slate-500">
                Companies and retail client organizations linked to your user profile.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayUser.companies && displayUser.companies.length > 0 ? (
                displayUser.companies.map((comp: any) => {
                  const isActive = comp.id === activeCompany?.id;
                  return (
                    <div
                      key={comp.id}
                      className={`rounded-xl border p-4 transition relative flex flex-col justify-between ${
                        isActive
                          ? "border-indigo-500 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs shrink-0">
                            <Building2 className="h-5 w-5" />
                          </div>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Active Workspace
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">
                              Assigned
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm mb-1">{comp.name}</h4>
                        <p className="text-[11px] text-slate-500 mb-3">
                          ID: <code className="bg-slate-100 px-1 py-0.5 rounded">{comp.id}</code>
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Role: <strong className="text-slate-800">{comp.role || displayUser.role}</strong>
                        </span>

                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => switchCompany(comp.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            <span>Switch</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8 text-slate-400 text-xs">
                  No explicit company memberships found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
