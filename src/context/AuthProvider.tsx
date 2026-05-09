import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import type { Agency, AppUser } from "../types/domain";
import { initAuthPersistence, onAuthUserChanged } from "../services/authService";
import { getAgencyProfile, getUserProfile } from "../services/userService";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  agency: Agency | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileForUser = async (user: User | null, fromServer = false) => {
    setFirebaseUser(user);
    if (!user) {
      setAppUser(null);
      setAgency(null);
      return;
    }

    const profile = await getUserProfile(user.uid, { fromServer });
    setAppUser(profile);

    if (profile?.agencyId) {
      const agencyProfile = await getAgencyProfile(profile.agencyId);
      setAgency(agencyProfile);
    } else {
      setAgency(null);
    }
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
        await loadProfileForUser(user);
        setLoading(false);
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
  }, []);

  const value = useMemo(() => ({ firebaseUser, appUser, agency, loading, refreshProfile }), [firebaseUser, appUser, agency, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
