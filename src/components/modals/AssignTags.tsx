import { Button, DialogContent, DialogRoot, DialogTitle, Input } from "../ui";
import { getTagName } from "../../utils/getTagName";

interface AssignTagsProps {
  open: boolean;
  onClose: () => void;
  tagsMap: Record<string, string>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}

export const AssignTags = ({
  open,
  onClose,
  tagsMap,
  selectedIds,
  onSelectionChange,
  tagInput,
  onTagInputChange,
  onSave,
  saving,
}: AssignTagsProps) => (
  <DialogRoot open={open} onOpenChange={(open) => !open && onClose()}>
    <DialogContent onClose={onClose}>
      <DialogTitle className="text-base sm:text-lg font-bold">
        Assign Tags
      </DialogTitle>
      {Object.keys(tagsMap).length > 0 && (
        <div className="mt-4">
          <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
            {Object.keys(tagsMap).map((id) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    onSelectionChange(next);
                  }}
                  className="rounded shrink-0"
                />
                <span className="truncate">{getTagName(tagsMap, id) ?? id}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        <label className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
          {Object.keys(tagsMap).length > 0 ? "Or create a new tag" : "New tag"}
        </label>
        <Input
          placeholder="Enter tag name..."
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving..." : "Assign Tags"}
        </Button>
      </div>
    </DialogContent>
  </DialogRoot>
);
