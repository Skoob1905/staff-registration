import { Loader2 } from "lucide-react";
import { Button, DialogContent, DialogRoot, DialogTitle } from "./ui";

interface AgencyCheckboxDialogProps {
  open: boolean;
  onClose: () => void;
  items: Array<{ id: string; name: string }>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onSave: () => void;
  saving: boolean;
}

export const AgencyCheckboxDialog = ({
  open,
  onClose,
  items,
  selectedIds,
  onSelectionChange,
  onSave,
  saving,
}: AgencyCheckboxDialogProps) => (
  <DialogRoot open={open} onOpenChange={(open) => !open && onClose()}>
    <DialogContent onClose={onClose}>
      <DialogTitle className="text-base sm:text-lg font-bold">
        Assign Agencies
      </DialogTitle>
      {items.length > 0 && (
        <div className="mt-4">
          <label className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
            Agencies
          </label>
          <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    onSelectionChange(next);
                  }}
                  className="rounded shrink-0"
                />
                <span className="truncate">{item.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </DialogContent>
  </DialogRoot>
);
