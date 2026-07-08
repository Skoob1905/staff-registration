import { useMemo, useState } from "react";
import { ActionButton } from "./ui/ActionButton";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import { Button } from "./ui";
import {
  deleteModalConfig,
  type FileInteractionKey,
} from "../config/fileInteraction";

interface FileInteractionButtonsProps {
  fileUrl: string;
  fileName: string;
  name?: string;
  onDelete?: () => void | Promise<void>;
  size?: "xs" | "sm" | "md";
  interactionKey: FileInteractionKey;
}

export const FileInteractionButtons = ({
  fileUrl,
  fileName,
  onDelete,
  size = "md",
  interactionKey,
}: FileInteractionButtonsProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const config = deleteModalConfig[interactionKey];

  const messageParts = useMemo(() => config.message.split("{fileName}"), [config.message]);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <ActionButton
          variant="download"
          size={size}
          href={fileUrl}
          ariaLabel={`Download ${fileName}`}
        />
        {onDelete && (
          <ActionButton
            variant="delete"
            size={size}
            onClick={() => setConfirmOpen(true)}
            ariaLabel={`Delete ${fileName}`}
          />
        )}
      </div>

      <DialogRoot
        open={confirmOpen}
        onOpenChange={(open) => !open && !deleting && setConfirmOpen(false)}
      >
        <DialogContent
          onClose={() => !deleting && setConfirmOpen(false)}
          closeDisabled={deleting}
        >
          <DialogTitle className="font-bold">{config.title}</DialogTitle>
          <p className="mt-3 text-sm text-zinc-600 whitespace-pre-line">
            {messageParts[0]}<strong>{fileName}</strong>{messageParts[1]}
          </p>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              {deleting ? config.loadingLabel ?? "Deleting..." : config.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
