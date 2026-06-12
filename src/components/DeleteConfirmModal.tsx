import { Button } from "./ui";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import { Muted } from "../config/typography";

interface DeleteConfirmModalProps {
  open: boolean;
  deleting: boolean;
  label: string;
  itemName: string;
  clientName: string;
  onDelete: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal = ({
  open,
  deleting,
  label,
  itemName,
  clientName,
  onDelete,
  onClose,
}: DeleteConfirmModalProps) => (
  <DialogRoot open={open} onOpenChange={(open) => !open && !deleting && onClose()}>
    <DialogContent
      closeDisabled={deleting}
      onClose={() => {
        if (!deleting) onClose();
      }}
    >
      <DialogTitle className="text-base sm:text-lg font-bold">
        Confirm Delete
      </DialogTitle>
      <Muted className="mt-2">
        Delete {label} <strong>"{itemName}"</strong> for{" "}
        <strong>{clientName}</strong>? This cannot be undone.
      </Muted>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-700"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </DialogContent>
  </DialogRoot>
);
