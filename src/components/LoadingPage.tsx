import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { config } from "../config";

export const LoadingPage = () => {
  useEffect(() => {
    const splash = document.getElementById("splash");
    if (splash) splash.style.display = "none";
  }, []);

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-6">
        <img
          src={config.loading}
          alt="Loading"
          className="w-auto max-w-[260px] object-contain"
          style={{
            animation: "loading-fade-in 3s ease-out forwards",
          }}
        />
        <Loader2
          className="h-6 w-6 sm:h-10 sm:w-10 animate-spin text-[var(--primary)]"
        />
      </div>
    </div>
  );
};
