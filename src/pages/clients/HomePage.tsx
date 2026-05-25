import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Download, FileText } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import SignatureCanvas from "react-signature-canvas";
import { SignModal } from "../../components/SignModal";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Card,
} from "../../components/ui";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import {
  getLatestUnsignedContract,
  getPendingContracts,
  getSignedContractsForUser,
  uploadSignedContract,
} from "../../services/contractService";
import { functions } from "../../services/firebase";
import {
  getPayslipsForUser,
  markPayslipDownloaded,
} from "../../services/payslipService";
import {
  parseRegistrationForm,
  type RegistrationFormInput,
} from "../../services/registrationValidation";
import { getStatus } from "../../services/userService";
import type { Payslip, UnsignedContract } from "../../types/domain";
import { formatInvitedAt } from "../../utils/date";
import { AssignedStaffSection } from "../../components/AssignedStaffSection";

export const UserHomePage = () => {
  useEffect(() => {
    document.title = "Home";
  }, []);
  const { appUser, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<UnsignedContract[]>([]);
  const [signedContracts, setSignedContracts] = useState<
    Array<{ fileName: string; fileUrl: string; signedAt?: Date }>
  >([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [registrationStatus, setRegistrationStatus] = useState<
    "awaiting" | "registered" | undefined
  >();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [activeContract, setActiveContract] = useState<UnsignedContract | null>(
    null,
  );
  const signaturePadRef = useRef<SignatureCanvas | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [showDrawPad, setShowDrawPad] = useState(false);
  const [openingSignModal, setOpeningSignModal] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [formData, setFormData] = useState<RegistrationFormInput>({
    firstName: "",
    lastName: "",
    birthday: "",
    address: "",
    honestyConfirmed: false,
  });
  const [touched, setTouched] = useState<
    Record<keyof RegistrationFormInput, boolean>
  >({
    firstName: false,
    lastName: false,
    birthday: false,
    address: false,
    honestyConfirmed: false,
  });

  useEffect(() => {
    const run = async () => {
      if (!appUser) return;
      const immediateStatus =
        appUser.registrationStatus === "awaiting" ? "awaiting" : "registered";
      setRegistrationStatus(immediateStatus);

      const [pending, signed, slips, userStatus] = await Promise.all([
        getPendingContracts(appUser.uid, appUser.agencyId),
        getSignedContractsForUser(appUser.uid, appUser.agencyId),
        getPayslipsForUser(appUser.uid, appUser.agencyId),
        getStatus(appUser.uid),
      ]);
      setContracts(pending);
      setSignedContracts(
        signed.map((s) => ({
          fileName: s.fileName,
          fileUrl: s.fileUrl,
          signedAt: s.signedAt,
        })),
      );
      setPayslips(slips);
      setRegistrationStatus(userStatus);
    };
    void run();
  }, [appUser]);

  const parsedRegistration = useMemo(
    () => parseRegistrationForm(formData),
    [formData],
  );
  const latestUndownloadedPayslip = useMemo(
    () => payslips.find((p) => p.hasDownloaded !== true),
    [payslips],
  );
  const formErrors = parsedRegistration.success
    ? {}
    : parsedRegistration.errors;
  const isRegistrationValid = parsedRegistration.success;

  const onRegisterNow = async () => {
    if (!isRegistrationValid || !appUser) return;
    setRegistrationLoading(true);
    try {
      const callable = httpsCallable(functions, "registerStaffProfile");
      await callable(parsedRegistration.data);
      await refreshProfile();
      const nextStatus = await getStatus(appUser.uid);
      setRegistrationStatus(nextStatus);
      setShowRegistrationModal(false);
      setTouched({
        firstName: false,
        lastName: false,
        birthday: false,
        address: false,
        honestyConfirmed: false,
      });
      toast({
        title: "Registration completed",
        description: "Your registration details were saved successfully.",
      });
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not complete registration right now.";
      toast({
        title: "Registration failed",
        description: message,
        variant: "error",
      });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const onOpenSignModal = (contract: UnsignedContract) => {
    setActiveContract(contract);
    setShowDrawPad(false);
    setShowSignModal(true);
  };

  const onApplySignature = async () => {
    if (!appUser || !activeContract || !signaturePadRef.current) return;
    if (
      registrationStatus !== "registered" ||
      appUser.contractSigned === true
    ) {
      toast({
        title: "Signing not allowed",
        description:
          "Only registered users with an unsigned contract can sign.",
        variant: "error",
      });
      return;
    }
    if (signaturePadRef.current.isEmpty()) {
      toast({
        title: "Signature required",
        description: "Please draw your signature before submitting.",
        variant: "error",
      });
      return;
    }

    setSigningLoading(true);
    try {
      const signatureDataUrl = signaturePadRef.current.toDataURL("image/png");
      const existingPdfBytes = await fetch(activeContract.fileUrl).then((r) =>
        r.arrayBuffer(),
      );
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const pngImage = await pdfDoc.embedPng(signatureDataUrl);
      const pngDims = pngImage.scale(0.35);
      lastPage.drawImage(pngImage, {
        x: Math.max(40, lastPage.getWidth() - pngDims.width - 40),
        y: lastPage.getHeight() / 2,
        width: pngDims.width,
        height: pngDims.height,
      });
      const signedPdfBytes = await pdfDoc.save();
      const signedPdfBuffer = signedPdfBytes.buffer.slice(
        signedPdfBytes.byteOffset,
        signedPdfBytes.byteOffset + signedPdfBytes.byteLength,
      ) as ArrayBuffer;
      const signedFile = new File(
        [signedPdfBuffer],
        `signed-${activeContract.fileName}`,
        {
          type: "application/pdf",
        },
      );

      const uploaded = await uploadSignedContract(
        signedFile,
        appUser.uid,
        appUser.agencyId,
      );
      const markSigned = httpsCallable(functions, "markContractSigned");
      await markSigned({
        contractId: activeContract.id,
        signedFileName: uploaded.fileName,
        signedFileUrl: uploaded.fileUrl,
      });
      await refreshProfile();
      const pending = await getPendingContracts(appUser.uid, appUser.agencyId);
      setContracts(pending);
      const signed = await getSignedContractsForUser(
        appUser.uid,
        appUser.agencyId,
      );
      setSignedContracts(
        signed.map((s) => ({
          fileName: s.fileName,
          fileUrl: s.fileUrl,
          signedAt: s.signedAt,
        })),
      );

      // Close modal right before showing success feedback to avoid perceived lag.
      setShowSignModal(false);
      setActiveContract(null);
      setShowDrawPad(false);
      signaturePadRef.current.clear();

      toast({
        title: "Contract signed",
        description: "Your signed contract was uploaded successfully.",
      });
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not sign and upload the contract.";
      toast({
        title: "Signing failed",
        description: message,
        variant: "error",
      });
    } finally {
      setSigningLoading(false);
    }
  };

  const onDownloadPayslip = async (payslip: Payslip) => {
    window.open(payslip.fileUrl, "_blank", "noopener,noreferrer");
    try {
      await markPayslipDownloaded(payslip.id);
      setPayslips((prev) =>
        prev.map((item) =>
          item.id === payslip.id ? { ...item, hasDownloaded: true } : item,
        ),
      );
    } catch {
      toast({
        title: "Could not update payslip status",
        description: "The file opened but download tracking failed.",
        variant: "error",
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-lg font-bold">To Do</h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${registrationStatus === "awaiting" ? "border-[color:rgba(245,158,11,0.28)] bg-[color:rgba(251,191,36,0.18)] text-amber-700" : "border-[color:rgba(16,185,129,0.28)] bg-[color:rgba(52,211,153,0.18)] text-emerald-700"}`}
          >
            {registrationStatus === "awaiting"
              ? "Not Registered"
              : "Registered"}
          </span>
          {appUser?.contractSigned === false && appUser?.contractSent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(251,191,36,0.18)] border border-[color:rgba(245,158,11,0.28)] px-3 py-1 text-xs font-semibold text-amber-700">
              <FileText className="h-3.5 w-3.5" />
              <span>Not Signed</span>
            </span>
          ) : appUser?.contractSigned === true ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(52,211,153,0.18)] border border-[color:rgba(16,185,129,0.28)] px-3 py-1 text-xs font-semibold text-emerald-700">
              <FileText className="h-3.5 w-3.5" />
              <span>Signed</span>
            </span>
          ) : null}
          {registrationStatus === "registered" && !appUser?.contractSent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(248,113,113,0.16)] border border-[color:rgba(239,68,68,0.26)] px-3 py-1 text-xs font-semibold text-red-600">
              <FileText className="h-3.5 w-3.5" />
              <span>Not Sent</span>
            </span>
          ) : null}
        </div>
        {appUser?.contractSigned === false && appUser?.contractSentBy ? (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Sent By: {appUser.contractSentBy} at{" "}
            {formatInvitedAt(appUser.contractSent)}
          </p>
        ) : null}

        {registrationStatus === "awaiting" ? (
          <Button
            type="button"
            className="mt-3"
            onClick={() => setShowRegistrationModal(true)}
          >
            Register Now
          </Button>
        ) : appUser?.contractSigned === false && appUser?.contractSentBy ? (
          <Button
            type="button"
            className="mt-3"
            disabled={openingSignModal}
            onClick={async () => {
              if (!appUser) return;
              setOpeningSignModal(true);
              try {
                const freshContracts = await getPendingContracts(
                  appUser.uid,
                  appUser.agencyId,
                );
                setContracts(freshContracts);
                const latest = await getLatestUnsignedContract(
                  appUser.uid,
                  appUser.agencyId,
                );
                if (!latest) {
                  toast({
                    title: "No contract found",
                    description: "Please refresh and try again.",
                    variant: "error",
                  });
                  return;
                }
                onOpenSignModal(latest);
              } finally {
                setOpeningSignModal(false);
              }
            }}
          >
            {openingSignModal ? "Opening..." : "Sign Contract"}
          </Button>
        ) : registrationStatus === "registered" &&
          !latestUndownloadedPayslip ? (
          <p className="mt-3 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Relax! There is nothing to do
          </p>
        ) : null}
        {registrationStatus === "registered" && latestUndownloadedPayslip ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[color:rgba(31,79,138,0.08)] px-3 py-2">
            <p className="text-xs sm:text-sm text-[var(--foreground)]">
              Download latest payslip
            </p>
            <Button
              type="button"
              className="bg-[var(--primary)] text-white"
              onClick={() => void onDownloadPayslip(latestUndownloadedPayslip)}
            >
              Download
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <div id="contracts-section" />
        <h2 className="text-sm sm:text-lg font-bold">Contracts</h2>
        <div className="mt-1.5 rounded-xl border border-[var(--border)] bg-[color:rgba(31,79,138,0.08)] p-3 sm:mt-3">
          <div className="space-y-1 text-xs sm:text-sm text-[var(--foreground)]">
            {appUser?.contractSent ? (
              <p>
                <b>Sent By:</b> {appUser.contractSentBy ?? "Unknown"} at{" "}
                {formatInvitedAt(appUser.contractSent)}
              </p>
            ) : null}
            {contracts[0] || signedContracts[0] ? (
              <div className="flex items-center gap-2">
                <b>Contract:</b>{" "}
                {contracts[0]?.fileName ?? signedContracts[0]?.fileName}
                {contracts[0]?.fileUrl || signedContracts[0]?.fileUrl ? (
                  <a
                    href={contracts[0]?.fileUrl ?? signedContracts[0]?.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Download contract"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-500 opacity-80 transition hover:bg-blue-500 hover:text-white hover:opacity-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
            {appUser?.contractSignedAt ? (
              <p>
                <b>Signed At:</b> {formatInvitedAt(appUser.contractSignedAt)}
              </p>
            ) : appUser?.contractSigned === undefined ? (
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                No contracts signed.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm sm:text-lg font-bold">Payslips</h2>
        {payslips.length ? (
          <div className="mt-1.5 overflow-hidden rounded-xl border border-[var(--border)] sm:mt-3">
            <AccordionRoot type="single" collapsible>
              {payslips.map((payslip) => (
                <AccordionItem
                  key={payslip.id}
                  value={payslip.id}
                  title={
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{payslip.fileName}</span>
                      {!payslip.hasDownloaded && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          New
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Download payslip"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void onDownloadPayslip(payslip);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 text-blue-500 opacity-80 transition hover:bg-blue-500 hover:text-white hover:opacity-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-1 text-xs sm:text-sm text-zinc-600">
                    <p>
                      <b>Sent By:</b> {payslip.sentBy ?? "Unknown"}
                    </p>
                    <p>
                      <b>Sent At:</b> {formatInvitedAt(payslip.timestamp)}
                    </p>
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
        ) : (
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 sm:mt-3">No payslips available.</p>
        )}
      </Card> */}

      {/* <DialogRoot
        open={showRegistrationModal}
        onOpenChange={setShowRegistrationModal}
      >
        <DialogContent onClose={() => setShowRegistrationModal(false)}>
          <DialogTitle className="text-sm sm:text-lg font-bold">
            Complete Registration
          </DialogTitle>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Please provide your details to complete onboarding.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                First name
              </label>
              <input
                value={formData.firstName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, firstName: true }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
              />
              {touched.firstName && "firstName" in formErrors ? (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.firstName}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Last name
              </label>
              <input
                value={formData.lastName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, lastName: true }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
              />
              {touched.lastName && "lastName" in formErrors ? (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.lastName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Birthday
            </label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, birthday: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, birthday: true }))}
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
            />
            {touched.birthday && "birthday" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">{formErrors.birthday}</p>
            ) : null}
          </div>

          <div className="mt-3">
            <label className="text-xs sm:text-sm font-medium text-zinc-700">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
              className="mt-1 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs sm:text-sm"
            />
            {touched.address && "address" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">{formErrors.address}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={formData.honestyConfirmed}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    honestyConfirmed: e.target.checked,
                  }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, honestyConfirmed: true }))
                }
                className="h-4 w-4 rounded border border-[var(--border)]"
              />
              I have answered honestly
            </label>
            {touched.honestyConfirmed && "honestyConfirmed" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">
                {formErrors.honestyConfirmed}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={!isRegistrationValid || registrationLoading}
              onClick={() => void onRegisterNow()}
            >
              {registrationLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Registering...
                </span>
              ) : (
                "Register"
              )}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot> */}

      <AssignedStaffSection />

      {/* <SignModal
        open={showSignModal}
        contract={activeContract}
        showDrawPad={showDrawPad}
        signingLoading={signingLoading}
        signaturePadRef={signaturePadRef}
        onClose={() => {
          setShowSignModal(false);
          setActiveContract(null);
          setShowDrawPad(false);
        }}
        onStartSign={() => setShowDrawPad(true)}
        onClearSignature={() => signaturePadRef.current?.clear()}
        onSubmitSignature={onApplySignature}
      /> */}
    </div>
  );
};
