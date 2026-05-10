import { useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./ui";
import { DialogContent, DialogRoot, DialogTitle } from "./ui/dialog";
import {
  parseSigningForm,
  type SigningFormInput,
} from "../services/signingValidation";
import type { UnsignedContract } from "../types/domain";

interface SignModalProps {
  open: boolean;
  contract: UnsignedContract | null;
  showDrawPad: boolean;
  signingLoading: boolean;
  signaturePadRef: React.MutableRefObject<SignatureCanvas | null>;
  onClose: () => void;
  onStartSign: () => void;
  onClearSignature: () => void;
  onSubmitSignature: () => Promise<void>;
}

export const SignModal = ({
  open,
  contract,
  showDrawPad,
  signingLoading,
  signaturePadRef,
  onClose,
  onStartSign,
  onClearSignature,
  onSubmitSignature,
}: SignModalProps) => {
  const [downloadedFileUrl, setDownloadedFileUrl] = useState<string | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [signingForm, setSigningForm] = useState<SigningFormInput>({
    termsAccepted: false,
  });
  const [touched, setTouched] = useState<{ termsAccepted: boolean }>({
    termsAccepted: false,
  });
  const parsed = parseSigningForm(signingForm);
  const formErrors = parsed.success ? {} : parsed.errors;
  const canSubmit = parsed.success;

  useEffect(() => {
    if (!open || !contract?.fileUrl) {
      return;
    }

    let alive = true;
    let objectUrl: string | null = null;

    const downloadContract = async () => {
      setLoadingContract(true);
      setDownloadError(null);
      try {
        const response = await fetch(contract.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download contract (${response.status})`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!alive) return;
        setDownloadedFileUrl(objectUrl);
      } catch (error: unknown) {
        const message =
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message?: string }).message === "string"
            ? (error as { message: string }).message
            : "Could not download contract.";
        if (!alive) return;
        setDownloadError(message);
        setDownloadedFileUrl(null);
      } finally {
        if (alive) setLoadingContract(false);
      }
    };

    void downloadContract();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDownloadedFileUrl(null);
    };
  }, [open, contract?.fileUrl]);

  useEffect(() => {
    if (!open) {
      setSigningForm({ termsAccepted: false });
      setTouched({ termsAccepted: false });
    }
  }, [open]);

  return (
    <DialogRoot open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent onClose={onClose}>
        <DialogTitle className="text-lg font-bold">SignModal</DialogTitle>
        <p className="mt-1 text-sm text-zinc-600">
          Review your contract, then sign at the bottom.
        </p>

        {contract ? (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-end">
              <a
                href={downloadedFileUrl ?? contract.fileUrl}
                download={contract.fileName}
                className="text-sm font-medium text-zinc-700 underline"
              >
                Download contract
              </a>
            </div>
            <div className="h-[420px] overflow-hidden rounded-xl border border-[var(--border)] bg-white">
              {loadingContract ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Downloading contract...
                </div>
              ) : downloadError ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-600">
                  {downloadError}
                </div>
              ) : (
                <iframe
                  title={`Contract ${contract.fileName}`}
                  src={downloadedFileUrl ?? contract.fileUrl}
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        ) : null}

        {!showDrawPad ? (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={!contract || loadingContract || Boolean(downloadError)}
              onClick={onStartSign}
            >
              Sign
            </Button>
          </div>
        ) : null}

        {showDrawPad ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-zinc-600">Draw your signature below.</p>
            <div className="rounded-xl border border-[var(--border)] bg-white p-2">
              <SignatureCanvas
                ref={(ref) => {
                  signaturePadRef.current = ref;
                }}
                canvasProps={{
                  className: "h-44 w-full rounded-lg bg-zinc-50",
                }}
              />
            </div>
            <div className="mt-3 flex justify-between">
              <Button
                type="button"
                onClick={onClearSignature}
              >
                Clear
              </Button>
              <Button
                type="button"
                disabled={signingLoading || !canSubmit}
                onClick={() => void onSubmitSignature()}
              >
                {signingLoading ? "Signing..." : "Submit Signature"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={signingForm.termsAccepted}
              onChange={(e) =>
                setSigningForm({ termsAccepted: e.target.checked })
              }
              onBlur={() => setTouched({ termsAccepted: true })}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            I have read the terms and conditions in the contract
          </label>
          {touched.termsAccepted && "termsAccepted" in formErrors ? (
            <p className="mt-1 text-xs text-red-600">{formErrors.termsAccepted}</p>
          ) : null}
        </div>
      </DialogContent>
    </DialogRoot>
  );
};
