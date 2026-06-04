import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Search, Wrench } from "lucide-react";
import { functions } from "../services/firebase";
import type { ReactNode } from "react";

declare const __APP_VERSION__: string;

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";

interface MaintenanceWindow {
  show: boolean;
  start?: number | null;
  end?: number | null;
}

interface GlobalBannerProps {
  icon?: ReactNode;
  children?: ReactNode;
}

export const GlobalBanner = ({ icon, children }: GlobalBannerProps) => {
  const [maintenance, setMaintenance] = useState<MaintenanceWindow | null>(null);

  useEffect(() => {
    const callable = httpsCallable(functions, "getMaintenanceWindow");
    callable()
      .then((res) => setMaintenance(res.data as MaintenanceWindow))
      .catch(() => setMaintenance({ show: false }));
  }, []);

  const isPreview = ALGOLIA_INDEX_PREFIX === "dev_";
  const showMaintenance = maintenance?.show;

  if (children) {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-[var(--primary)]/20 bg-[var(--primary)]/80 px-4 py-1 text-center text-xs font-semibold text-[var(--primary-foreground)]/80">
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
      </div>
    );
  }

  if (showMaintenance) {
    const fmt = (ms: number) =>
      new Date(ms).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    const start = maintenance.start ? fmt(maintenance.start) : "—";
    const end = maintenance.end ? fmt(maintenance.end) : "—";
    return (
      <div className="flex items-center justify-center gap-2 border-b border-[var(--primary)]/20 bg-[var(--primary)]/80 px-4 py-1 text-center text-xs font-semibold text-[var(--primary-foreground)]/80">
        <Wrench className="size-3.5 shrink-0" />
        <span>Scheduled maintenance: {start} – {end}</span>
      </div>
    );
  }

  if (isPreview) {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-[var(--primary)]/20 bg-[var(--primary)]/80 px-4 py-1 text-center text-xs font-semibold text-[var(--primary-foreground)]/80">
        <Search className="size-3.5 shrink-0" />
        <span>You're viewing v{__APP_VERSION__}-preview</span>
      </div>
    );
  }

  return null;
};
