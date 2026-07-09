import { Building } from "lucide-react";
import { Pill } from "../Pill";

interface AgencyPillProps {
  record: Record<string, unknown>;
}

export const AgencyPill = ({ record }: AgencyPillProps) => {
  const meta = record.metadata as Record<string, unknown> | undefined;
  const agenciesArr = meta?.assignedAgencies as unknown[] | undefined;
  const count = Array.isArray(agenciesArr) ? agenciesArr.length : 0;

  if (count === 0) return null;

  return (
    <Pill
      status="info"
      icon={<Building className="h-3.5 w-3.5" />}
      count={count}
      label=""
    />
  );
};
