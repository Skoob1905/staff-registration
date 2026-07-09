import { Users } from "lucide-react";
import { Pill } from "../Pill";

interface AssignedStaffProps {
  record: Record<string, unknown>;
}

export const AssignedStaff = ({ record }: AssignedStaffProps) => {
  const meta = record.metadata as Record<string, unknown> | undefined;
  const staffArr = meta?.assignedStaff as unknown[] | undefined;
  const count = Array.isArray(staffArr) ? staffArr.length : 0;

  if (count === 0) return null;

  return (
    <Pill
      status="info"
      icon={<Users className="h-3.5 w-3.5" />}
      count={count}
      label=""
    />
  );
};
