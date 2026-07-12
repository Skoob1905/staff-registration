/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { signOut, type User } from "firebase/auth";
import type { Agency, AppUser, UserRole } from "../types/domain";
import { auth } from "../services/firebase";
import { initAuthPersistence, onAuthUserChanged } from "../services/authService";
import { getAgencyProfile, getUserProfile } from "../services/userService";
import { useToast } from "./ToastProvider";
import { useAppStore } from "../stores/appStore";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  agency: Agency | null;
  role: UserRole | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadProfileForUser = async (user: User | null, fromServer = false): Promise<boolean> => {
    setFirebaseUser(user);
    if (!user) {
      setAppUser(null);
      setAgency(null);
      return false;
    }

    const profile = await getUserProfile(user.uid, { fromServer });

    if (!profile) {
      setAppUser(null);
      setAgency(null);
      return false;
    }

    let agencyProfile = null;
    if (profile.agencyId && profile.role !== "client") {
      agencyProfile = await getAgencyProfile(profile.agencyId);
    }

    setAppUser(profile);
    setAgency(agencyProfile);
    return true;
  };

  const refreshProfile = async () => {
    await loadProfileForUser(firebaseUser, true);
  };

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      await initAuthPersistence();
      const unsub = onAuthUserChanged(async (user) => {
        if (!mounted) return;
        setLoading(true);
        try {
          const profileFound = await loadProfileForUser(user);
          if (user && !profileFound) {
            await signOut(auth);
            toast({
              title: "Login failed",
              description: "Profile not found. Contact your administrator.",
              variant: "error",
            });
          } else if (user) {
            useAppStore.getState().loadTags().catch(() => {});
          }
        } catch (err) {
          console.error("Failed to load user profile", err);
          if (user) await signOut(auth).catch(() => {});
          toast({
            title: "Login failed",
            description: "Could not load your profile. Check your account or try again later.",
            variant: "error",
          });
        } finally {
          setLoading(false);
        }
      });

      return unsub;
    };

    let unsub: (() => void) | undefined;
    boot().then((u) => {
      unsub = u;
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const value = useMemo(() => ({ firebaseUser, appUser, agency, role: appUser?.role ?? null, loading, refreshProfile }), [firebaseUser, appUser, agency, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
