"use client";

import React, { useState } from "react";
import {
  Building2,
  User,
  Phone,
  MapPin,
  Lock,
  Mail,
  Sparkles,
  CheckCircle2,
  Store,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DesktopSetupWizardProps {
  packageType?: "ACCOUNTING_ONLY" | "POS_COMBO" | "DI_COMBO";
  onComplete: () => void;
}

export default function DesktopSetupWizard({
  packageType = "ACCOUNTING_ONLY",
  onComplete,
}: DesktopSetupWizardProps) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Karachi");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!businessName.trim()) {
      setErrorMessage("Please enter your business or shop name.");
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage("Please enter owner or manager name.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter an email or username for admin login.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please set a password for your account.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/desktop/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to initialize business.");
      }

      // Success: reload into dashboard
      onComplete();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during setup.");
    } finally {
      setLoading(false);
    }
  };

  const getPackageBadge = () => {
    switch (packageType) {
      case "ACCOUNTING_ONLY":
        return {
          title: "Standard Accounting Package",
          desc: "Full Double-Entry Ledger, Cash Drawer & Cash Book, Returns, 80mm & A4 Invoices",
          color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        };
      case "POS_COMBO":
        return {
          title: "POS Retail & Accounting Combo",
          desc: "Fast Cashier POS, Barcode Scanner, Cash Drawer, Counter Returns + Full Accounting",
          color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        };
      case "DI_COMBO":
        return {
          title: "FBR Digital Invoicing & Accounting Combo",
          desc: "FBR Statutory E-Invoices, Annexure-C, Debit/Credit Notes + Full Accounting",
          color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        };
    }
  };

  const pkg = getPackageBadge();

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 relative">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Register Your Business (اپنا کاروبار درج کریں)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Welcome to Accounts360! Please enter your company details and create your admin account.
          </p>

          <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${pkg.color}`}>
            <Sparkles className="h-3.5 w-3.5" />
            <span>Unlocked Package: <strong>{pkg.title}</strong></span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Business / Shop Name *
              </label>
              <div className="relative">
                <Store className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Madina Traders"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Owner / Manager Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Tariq"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Phone / WhatsApp Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 0300-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                City / Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Karachi / Lahore"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Create Your Admin Login (ایڈمن لاگ ان بنائیں)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Login Email or Username *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="admin or name@shop.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Login Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Create a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Setting up your accounting system...</span>
              ) : (
                <>
                  <span>Launch Software & Open Dashboard (سافٹ ویئر شروع کریں)</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
