import loadingImg from "../assets/Loading.png";
import { Loader2 } from "lucide-react";

export const LoadingPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center">
    <div className="relative">
      <img
        src={loadingImg}
        alt="Loading"
        className="max-h-72 sm:max-h-64 w-auto object-contain"
      />
      <div className="absolute left-1/2 top-[75%] -translate-x-1/2 -translate-y-1/2 animate-dissolve">
        <Loader2 className="h-4 w-4 sm:h-8 sm:w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    </div>
  </div>
);
