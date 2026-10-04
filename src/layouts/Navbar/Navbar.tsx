import { X } from "lucide-react";
import { logoutUser } from "../../services/authService";
import { config } from "../../config";
import { NavbarItems } from "./items";
import { Button } from "../../components/ui";

declare const __APP_VERSION__: string;

interface NavbarProps {
  open: boolean;
  onClose: () => void;
}

export const Navbar = ({ open, onClose }: NavbarProps) => {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/30 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed left-0 top-0 z-30 flex h-full w-56 flex-col bg-[var(--header-bg)] transition-transform duration-200 md:static md:translate-x-0 md:overflow-hidden md:rounded-xl md:border md:border-[var(--border)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
        >
          <X className="size-5" />
        </button>

        <div className="flex justify-center px-2 pt-3 pb-2">
          <img
            src={config.navbar}
            alt={config.name}
            className="max-h-16 w-auto object-contain"
          />
        </div>

        <nav className="flex flex-1 flex-col gap-3 px-2">
          <NavbarItems
            onNavigate={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--primary-100)] text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:border-[var(--primary)]"
              }`
            }
          />
        </nav>

        <div className="px-3 pb-5">
          <Button
            type="button"
            className="w-full rounded-lg"
            onClick={() => void logoutUser()}
          >
            <span className="text-sm sm:text-[11px] md:text-sm">Logout</span>
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-[var(--muted-foreground)]">
            v{__APP_VERSION__}
          </p>
        </div>
      </aside>
    </>
  );
};
