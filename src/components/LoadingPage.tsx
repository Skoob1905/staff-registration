import loadingImg from "../assets/Loading.png";
import { Loader2 } from "lucide-react";

export const LoadingPage = () => (
  <div className="flex min-h-screen flex-col items-center justify-center">
    <div className="relative">
      <img
        src={loadingImg}
        alt="Loading"
        className="max-h-72 w-auto object-contain"
      />
      <Loader2 className="absolute left-1/2 top-[75%] -translate-x-1/2 -translate-y-1/2 h-12 w-12 animate-spin text-[var(--muted-foreground)]" />
    </div>
  </div>
);
