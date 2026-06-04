import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Search, Wrench } from "lucide-react";
import { functions } from "../services/firebase";

declare const __APP_VERSION__: string;

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";

interface MaintenanceWindow {
  show: boolean;
  start?: number | null;
  end?: number | null;
}

export const GlobalBanner = () => {
  const [maintenance, setMaintenance] = useState<MaintenanceWindow | null>(null);

  useEffect(() => {
    const callable = httpsCallable(functions, "getMaintenanceWindow");
    callable()
      .then((res) => setMaintenance(res.data as MaintenanceWindow))
      .catch(() => setMaintenance({ show: false }));
  }, []);

  const isPreview = ALGOLIA_INDEX_PREFIX === "dev_" 
  const showMaintenance = maintenance?.show;

  if (showMaintenance) {
    const fmt = (ms: number) =>
      new Date(ms).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    const start = maintenance.start ? fmt(maintenance.start) : "—";
    const end = maintenance.end ? fmt(maintenance.end) : "—";
    return (
      <div className="flex items-center justify-center gap-2 border-b border-[var(--primary)]/20 bg-[var(--primary)]/80 px-4 py-2 text-center text-sm font-bold text-[var(--primary-foreground)]/80">
        <Wrench className="size-4 shrink-0" />
        <span>Scheduled maintenance: {start} – {end}</span>
      </div>
    );
  }

  if (isPreview) {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-[var(--primary)]/20 bg-[var(--primary)]/80 px-4 py-2 text-center text-sm font-bold text-[var(--primary-foreground)]/80">
        <Search className="size-4 shrink-0" />
        <span>You're viewing v{__APP_VERSION__}</span>
      </div>
    );
  }

  return null;
};
