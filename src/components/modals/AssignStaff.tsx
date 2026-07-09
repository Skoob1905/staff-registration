import { useState } from "react";
import { Button, DialogContent, DialogRoot, DialogTitle } from "../ui";
import { AgenciesDropdown } from "../AgenciesDropdown";

interface AssignStaffProps {
  open: boolean;
  onClose: () => void;
  onAssign: (agencyId: string, agencyName: string) => void;
  saving: boolean;
}

export const AssignStaff = ({
  open,
  onClose,
  onAssign,
  saving,
}: AssignStaffProps) => {
  const [selectedId, setSelectedId] = useState("");
  const [selectedName, setSelectedName] = useState("");

  const handleChange = (value: string, name: string) => {
    setSelectedId(value);
    setSelectedName(name);
  };

  const handleSave = () => {
    if (!selectedId) return;
    onAssign(selectedId, selectedName);
    setSelectedId("");
    setSelectedName("");
  };

  return (
    <DialogRoot open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose}>
        <DialogTitle className="text-base sm:text-lg font-bold">
          Assign Staff
        </DialogTitle>
        <div className="mt-4">
          <AgenciesDropdown
            value={selectedId}
            onChange={handleChange}
            disabled={saving}
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
            placeholder="Select an agency..."
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            disabled={!selectedId || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
};
