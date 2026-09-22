"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  isActive: boolean;
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "OWNER_ADMIN" | "ACCOUNTANT" | "STAFF";
  businessId: string;
  businessName: string;
  companyIds?: string[];
  branchId?: string | null;
  branchName?: string | null;
  canCreateBranches?: boolean;
  isSwitched?: boolean;
}

export interface Company {
  id: string;
  name: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  currency?: string;
  currencySymbol?: string;
  ntn?: string;
  strn?: string;
  businessType?: string;
  defaultHsCode?: string;
  defaultUom?: string;
  defaultTaxProfile?: string;
  defaultSalesTax?: number;
  defaultFurtherTax?: number;
  defaultExtraTax?: number;
  monthlyFee?: number;
  billingPlan?: string;
  subscriptionStatus?: string;
  billingCycleEnd?: string;
  canCreateBranches?: boolean;
  enabledModules?: string[];
}

interface AuthContextType {
  user: UserProfile | null;
  activeCompany: Company | null;
  companies: Company[];
  branches: Branch[];
  activeBranchId: string | null;
  selectedBranch: Branch | null;
  isBranchLocked: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInspectingClient: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  logout: () => Promise<void>;
  switchCompany: (businessId: string) => Promise<boolean>;
  switchBranch: (branchId: string | null) => Promise<boolean>;
  switchUser: (targetUserId: string) => Promise<boolean>;
  inspectCompany: (businessId: string) => Promise<boolean>;
  exitInspection: () => void;
  refreshSession: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [isBranchLocked, setIsBranchLocked] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInspectingClient, setIsInspectingClient] = useState<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const inspecting = localStorage.getItem("sb_inspecting_client") === "true";
      setIsInspectingClient(inspecting);
    } catch {}
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setActiveCompany(data.activeCompany || null);
        setCompanies(data.companies || []);
        setBranches(data.branches || []);
        setIsAuthenticated(Boolean(data.authenticated));

        const isLocked = Boolean(data.user?.branchId && data.user?.role !== "SUPER_ADMIN" && data.user?.role !== "OWNER_ADMIN");
        setIsBranchLocked(isLocked);

        if (isLocked) {
          setActiveBranchId(data.user.branchId);
        } else {
          const cookieMatch = document.cookie.match(/sb_active_branch_id=([^;]+)/);
          const cookieBranch = cookieMatch ? cookieMatch[1] : null;
          if (cookieBranch && cookieBranch !== "all") {
            setActiveBranchId(cookieBranch);
          } else {
            setActiveBranchId(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load auth session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setIsAuthenticated(true);
        await refreshSession();

        // Role-based redirect
        if (data.user.role === "SUPER_ADMIN") {
          router.push("/admin");
        } else {
          router.push("/");
        }
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || "Login failed" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      router.push("/login");
    }
  };

  const switchCompany = async (businessId: string) => {
    try {
      document.cookie = `sb_active_business_id=${businessId}; path=/; max-age=2592000; SameSite=Lax`;
      const res = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (data.success) {
        const target = companies.find((c) => c.id === businessId);
        if (target) {
          setActiveCompany(target);
        }
        if (user) {
          setUser({
            ...user,
            businessId,
            businessName: data.businessName || target?.name || user.businessName,
          });
        }
        await refreshSession();
        window.location.href = window.location.pathname;
        return true;
      }
      alert(data.error || "Failed to switch company");
      return false;
    } catch (err: any) {
      console.error("Switch company failed:", err);
      alert(err.message || "Network error while switching company");
      return false;
    }
  };

  const switchUser = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        if (data.activeCompany) {
          setActiveCompany(data.activeCompany);
          document.cookie = `sb_active_business_id=${data.activeCompany.id}; path=/; max-age=2592000; SameSite=Lax`;
        }
        await refreshSession();

        if (data.user.role === "SUPER_ADMIN") {
          window.location.href = "/admin/users";
        } else {
          window.location.href = "/";
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Switch user failed:", err);
      return false;
    }
  };

  const inspectCompany = async (businessId: string) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sb_inspecting_client", "true");
      }
      setIsInspectingClient(true);
      document.cookie = `sb_active_business_id=${businessId}; path=/; max-age=2592000; SameSite=Lax`;
      await switchCompany(businessId);
      window.location.href = "/";
      return true;
    } catch (err) {
      console.error("Inspect company failed:", err);
      return false;
    }
  };

  const exitInspection = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sb_inspecting_client");
      }
      setIsInspectingClient(false);
      window.location.href = "/admin";
    } catch (err) {
      console.error("Exit inspection failed:", err);
    }
  };

  const selectedBranch = branches.find((b) => b.id === activeBranchId) || null;

  const switchBranch = async (branchId: string | null) => {
    if (isBranchLocked) {
      alert("You are assigned to a specific branch and cannot switch branches.");
      return false;
    }
    try {
      if (!branchId || branchId === "all") {
        document.cookie = "sb_active_branch_id=; path=/; max-age=0; SameSite=Lax";
        setActiveBranchId(null);
      } else {
        document.cookie = `sb_active_branch_id=${branchId}; path=/; max-age=2592000; SameSite=Lax`;
        setActiveBranchId(branchId);
      }
      window.location.reload();
      return true;
    } catch (err: any) {
      console.error("Switch branch failed:", err);
      return false;
    }
  };

  const hasRole = (allowedRoles: string[]) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeCompany,
        companies,
        branches,
        activeBranchId,
        selectedBranch,
        isBranchLocked,
        isAuthenticated,
        isLoading,
        isInspectingClient,
        login,
        logout,
        switchCompany,
        switchBranch,
        switchUser,
        inspectCompany,
        exitInspection,
        refreshSession,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
