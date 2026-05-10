import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { FileText } from "lucide-react";
import { Button, Card } from "../../components/ui";
import { DialogContent, DialogRoot } from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import {
  getPendingContracts,
  uploadSignedContract,
} from "../../services/contractService";
import { functions } from "../../services/firebase";
import { getPayslipsForUser } from "../../services/payslipService";
import {
  parseRegistrationForm,
  type RegistrationFormInput,
} from "../../services/registrationValidation";
import { getStatus } from "../../services/userService";
import type { Payslip, UnsignedContract } from "../../types/domain";
import { formatInvitedAt } from "../../utils/date";

export const UserHomePage = () => {
  const { appUser, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<UnsignedContract[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [status, setStatus] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<
    "awaiting" | "registered" | undefined
  >();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [formData, setFormData] = useState<RegistrationFormInput>({
    firstName: "",
    lastName: "",
    birthday: "",
    address: "",
    honestyConfirmed: false,
  });
  const [touched, setTouched] = useState<Record<keyof RegistrationFormInput, boolean>>({
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

      const [pending, slips, userStatus] = await Promise.all([
        getPendingContracts(appUser.uid, appUser.agencyId),
        getPayslipsForUser(appUser.uid, appUser.agencyId),
        getStatus(appUser.uid),
      ]);
      setContracts(pending);
      setPayslips(slips);
      setRegistrationStatus(userStatus);
    };
    void run();
  }, [appUser]);

  const parsedRegistration = useMemo(
    () => parseRegistrationForm(formData),
    [formData],
  );
  const formErrors = parsedRegistration.success
    ? {}
    : parsedRegistration.errors;
  const isRegistrationValid = parsedRegistration.success;

  const onUploadSigned = async (contractId: string, file: File | null) => {
    if (!appUser || !file) return;
    try {
      await uploadSignedContract(
        file,
        appUser.uid,
        appUser.agencyId,
        contractId,
      );
      setStatus("Signed contract uploaded.");
      const pending = await getPendingContracts(appUser.uid, appUser.agencyId);
      setContracts(pending);
    } catch {
      setStatus("Could not upload signed contract.");
    }
  };

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

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">To Do</h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${registrationStatus === "awaiting" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}
          >
            {registrationStatus === "awaiting"
              ? "Not Registered"
              : "Registered"}
          </span>
          {appUser?.contractSigned === false ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              <FileText className="h-3.5 w-3.5" />
              Not Signed
            </span>
          ) : appUser?.contractSigned === true ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              <FileText className="h-3.5 w-3.5" />
              Signed
            </span>
          ) : null}
        </div>
        {appUser?.contractSigned === false && appUser?.contractSentBy ? (
          <p className="mt-1 text-xs text-zinc-500">
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
        ) : appUser?.contractSigned === false ? (
          <Button
            type="button"
            className="mt-3"
            onClick={() => {
              const el = document.getElementById("contracts-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Sign Contract
          </Button>
        ) : null}
      </Card>

      <Card>
        <div id="contracts-section" />
        <h2 className="text-lg font-bold">Contracts</h2>
        <div className="mt-3 space-y-3">
          {contracts.map((contract) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              onUploadSigned={onUploadSigned}
            />
          ))}
          {!contracts.length ? (
            <p className="text-sm text-zinc-500">No pending contracts.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Payslips</h2>
        <div className="mt-3 space-y-2">
          {payslips.map((payslip) => (
            <a
              key={payslip.id}
              href={payslip.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-zinc-800 underline"
            >
              {payslip.fileName} ({payslip.periodLabel})
            </a>
          ))}
          {!payslips.length ? (
            <p className="text-sm text-zinc-500">No payslips available.</p>
          ) : null}
        </div>
      </Card>

      {status ? <p className="text-sm text-zinc-600">{status}</p> : null}

      <DialogRoot
        open={showRegistrationModal}
        onOpenChange={setShowRegistrationModal}
      >
        <DialogContent onClose={() => setShowRegistrationModal(false)}>
          <h3 className="text-lg font-bold">Complete Registration</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Please provide your details to complete onboarding.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-zinc-700">
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
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              />
              {touched.firstName && "firstName" in formErrors ? (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.firstName}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700">
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
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              />
              {touched.lastName && "lastName" in formErrors ? (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.lastName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium text-zinc-700">
              Birthday
            </label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, birthday: e.target.value }))
              }
              onBlur={() =>
                setTouched((prev) => ({ ...prev, birthday: true }))
              }
              className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
            {touched.birthday && "birthday" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">{formErrors.birthday}</p>
            ) : null}
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium text-zinc-700">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              onBlur={() =>
                setTouched((prev) => ({ ...prev, address: true }))
              }
              className="mt-1 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
            {touched.address && "address" in formErrors ? (
              <p className="mt-1 text-xs text-red-600">{formErrors.address}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
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
      </DialogRoot>
    </div>
  );
};

const ContractRow = ({
  contract,
  onUploadSigned,
}: {
  contract: UnsignedContract;
  onUploadSigned: (contractId: string, file: File | null) => Promise<void>;
}) => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <a
        href={contract.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-zinc-800 underline"
      >
        {contract.fileName}
      </a>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button
          type="button"
          onClick={() => void onUploadSigned(contract.id, file)}
        >
          Upload Signed
        </Button>
      </div>
    </div>
  );
};
