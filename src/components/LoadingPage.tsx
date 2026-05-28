import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { config } from "../config";

export const LoadingPage = () => {
  useEffect(() => {
    const el = document.getElementById("splash");
    if (el) el.style.display = "none";
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="relative flex items-center justify-center mt-4 sm:mt-12">
        <img
          src={config.loading}
          alt="Loading"
          className="max-h-70 sm:max-h-72 w-auto object-contain"
          style={{ animation: "fade-in 1.5s ease-out forwards", opacity: 0 }}
        />
        <Loader2
          className="absolute left-1/2 -translate-x-1/2 top-[65%] h-5 w-5 sm:h-9 sm:w-9 animate-spin text-[var(--muted-foreground)] opacity-0"
          style={{
            animation:
              "spin 1s linear infinite, fade-in 0.3s ease-out 0.2s forwards",
          }}
        />
      </div>
    </div>
  );
};
