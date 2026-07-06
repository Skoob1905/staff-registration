import { Button, DialogContent, DialogRoot, DialogTitle } from "../ui";

interface DeleteClientModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
  clientName: string;
}

export const DeleteClientModal = ({
  open,
  onClose,
  onDelete,
  deleting,
  clientName,
}: DeleteClientModalProps) => (
  <DialogRoot
    open={open}
    onOpenChange={(open) => {
      if (!open && !deleting) onClose();
    }}
  >
    <DialogContent
      closeDisabled={deleting}
      onClose={() => {
        if (!deleting) onClose();
      }}
    >
      <DialogTitle className="text-base sm:text-lg font-bold">
        Confirm Delete
      </DialogTitle>
      <p className="mt-2 text-xs sm:text-sm text-zinc-600">
        This will permanently delete <strong>{clientName}</strong> from storage.
        You will need to re-upload it.
      </p>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-700"
          disabled={deleting}
          onClick={() => void onDelete()}
        >
          {deleting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Deleting...
            </span>
          ) : (
            "Confirm"
          )}
        </Button>
      </div>
    </DialogContent>
  </DialogRoot>
);
