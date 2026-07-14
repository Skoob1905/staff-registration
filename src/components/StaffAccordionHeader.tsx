import type { ReactNode } from "react";
import { AccordionTitle } from "./AccordionTitle";

const STATUS_COLOR: Record<string, string> = {
  failed: "bg-red-400",
  awaiting_login: "bg-amber-400",
  password_set: "bg-blue-400",
  logged_in: "bg-emerald-400",
};

function getStatusColor(status?: string): string {
  return STATUS_COLOR[status ?? ""] ?? "bg-red-400";
}

export interface StaffAccordionHeaderProps {
  name: string;
  loginStatus?: string;
  children?: ReactNode;
}

export function StaffAccordionHeader({
  name,
  loginStatus,
  children,
}: StaffAccordionHeaderProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {loginStatus !== undefined && (
        <span
          className={`inline-block w-[3px] h-3 sm:w-1 sm:h-4 shrink-0 ${getStatusColor(loginStatus)}`}
          title={loginStatus.replace(/_/g, " ")}
        />
      )}
      <AccordionTitle className="leading-none">{name}</AccordionTitle>
      {children}
    </div>
  );
}
