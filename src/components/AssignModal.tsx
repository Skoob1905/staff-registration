import { useEffect, useMemo, useState } from "react";
import { Button, DialogContent, DialogRoot, DialogTitle } from "./ui";
import type { StaffTag } from "../types/domain";
import { H1, H2, Muted } from "../config/typography";

interface AssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  tags: StaffTag[];
  selectedClientId?: string;
  selectedTagIds: string[];
  onConfirm: (clientId: string | undefined, tagIds: string[]) => void;
}

export const AssignModal = ({
  open,
  onOpenChange,
  clients,
  tags,
  selectedClientId: initialClientId,
  selectedTagIds: initialTagIds,
  onConfirm,
}: AssignModalProps) => {
  const [clientId, setClientId] = useState<string | undefined>(initialClientId);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set(initialTagIds));

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  useEffect(() => {
    if (open) {
      setClientId(initialClientId);
      setTagIds(new Set(initialTagIds));
    }
  }, [open, initialClientId, initialTagIds]);

  const toggleTag = (id: string) => {
    const next = new Set(tagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTagIds(next);
  };

  const handleClientSelect = (id: string) => {
    if (clientId === id) {
      setClientId(undefined);
    } else {
      setClientId(id);
    }
  };

  const handleConfirm = () => {
    onConfirm(clientId, Array.from(tagIds));
    onOpenChange(false);
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClose={() => onOpenChange(false)}
        overlayClassName="z-[60]"
        className="z-[70]"
      >
        <DialogTitle asChild>
          <H1>
            Auto-assign
          </H1>
        </DialogTitle>

        <div className="mt-4 space-y-4">
          <div>
            <H2 as="label">
              Tags
            </H2>
            {Object.keys(tagsMap).length === 0 ? (
              <Muted className="mt-1">
                No tags have been assigned
              </Muted>
            ) : (
              <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
                {Object.keys(tagsMap).map((id) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={tagIds.has(id)}
                      onChange={() => toggleTag(id)}
                      className="rounded shrink-0"
                    />
                    <span className="truncate">{tagsMap[id]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <H2 as="label">
              Clients
            </H2>
            {clients.length === 0 ? (
              <Muted className="mt-1">
                No clients available
              </Muted>
            ) : (
              <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
                {clients.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={clientId === c.id}
                      onChange={() => handleClientSelect(c.id)}
                      className="rounded shrink-0"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
};
