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
      <div className="relative flex items-center justify-center">
        <img
          src={config.loading}
          alt="Loading"
          className="w-auto max-w-[260px] object-contain"
          style={{
            animation: "loading-fade-in 3s ease-out forwards",
          }}
        />
        <Loader2
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 h-6 w-6 sm:h-10 sm:w-10 animate-spin text-[var(--primary)]"
        />
      </div>
    </div>
  );
};
