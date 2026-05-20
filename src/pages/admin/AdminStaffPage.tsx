import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { httpsCallable } from "firebase/functions";
import { Download, FileText, Upload } from "lucide-react";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Card,
  Input,
} from "../../components/ui";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import {
  getSignedContractsForAdmin,
  getUnsignedContractInfo,
  uploadUnsignedContract,
} from "../../services/contractService";
import { functions } from "../../services/firebase";
import {
  getPayslipsForUser,
  uploadPayslip,
} from "../../services/payslipService";
import {
  checkEmailStatus,
  getAwaitingRegistrationsByAgency,
  getStaffUsersByAgency,
  getUserProfile,
} from "../../services/userService";
import type { AppUser, AwaitingRegistration } from "../../types/domain";
import { formatInvitedAt } from "../../utils/date";

type AwaitingRegistrationView = AwaitingRegistration & {
  requesterEmail: string;
  invitedAtFormatted: string;
};

export const AdminStaffPage = () => {
  useEffect(() => {
    document.title = "Home";
  }, []);
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeLoadingUid, setRemoveLoadingUid] = useState<string | null>(null);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [awaiting, setAwaiting] = useState<AwaitingRegistrationView[]>([]);
  const [openStaffUid, setOpenStaffUid] = useState<string | undefined>();

  const loadStaff = useCallback(async () => {
    if (!appUser?.agencyId) return;
    const [users, awaitingList] = await Promise.all([
      getStaffUsersByAgency(appUser.agencyId),
      getAwaitingRegistrationsByAgency(appUser.agencyId),
    ]);
    setStaff(users.filter((u) => u.registrationStatus !== "awaiting"));
    const awaitingView = await buildAwaitingView(awaitingList);
    setAwaiting(awaitingView);
  }, [appUser?.agencyId]);

  const updateSingleStaff = useCallback(async (uid: string) => {
    const updated = await getUserProfile(uid);
    if (!updated) return;
    setStaff((prev) => prev.map((m) => (m.uid === uid ? updated : m)));
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "error",
      });
      return;
    }
    if (!/.+@.+\..+/.test(normalizedEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "error",
      });
      return;
    }

    setInviteLoading(true);
    try {
      if (!appUser?.agencyId) {
        toast({
          title: "Profile issue",
          description: "Your admin profile is missing agency information.",
          variant: "error",
        });
        return;
      }

      const emailStatus = await checkEmailStatus(
        normalizedEmail,
        appUser.agencyId,
      );
      if (emailStatus.exists) {
        if (emailStatus.state === "awaiting") {
          toast({
            title: "Already awaiting",
            description: "This email is already in Awaiting Registration.",
            variant: "error",
          });
          return;
        }
        toast({
          title: "Invite blocked",
          description: `This email is already registered as ${emailStatus.role ?? "user"}.`,
          variant: "error",
        });
        return;
      }

      const callable = httpsCallable(functions, "invitePortalUser");
      await callable({ email: normalizedEmail, role: "user" });
      toast({
        title: "Invite sent",
        description: "Staff registration invite has been sent.",
      });
      setEmail("");
      const awaitingList = await getAwaitingRegistrationsByAgency(
        appUser.agencyId,
      );
      const awaitingView = await buildAwaitingView(awaitingList);
      setAwaiting(awaitingView);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Unable to send invite right now.";
      toast({
        title: "Invite failed",
        description: message,
        variant: "error",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const staffCount = useMemo(() => staff.length, [staff]);
  const awaitingCount = useMemo(() => awaiting.length, [awaiting]);

  const onRemoveAwaiting = async (uid: string) => {
    setRemoveLoadingUid(uid);
    try {
      const callable = httpsCallable(functions, "removeUnregisteredStaffUser");
      await callable({ uid });
      setAwaiting((prev) => prev.filter((item) => item.uid !== uid));
      toast({
        title: "User removed",
        description: "Awaiting Registration user removed",
      });
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Unable to remove awaiting user right now.";
      toast({
        title: "Remove failed",
        description: message,
        variant: "error",
      });
    } finally {
      setRemoveLoadingUid(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold">Register</h2>
        <form className="mt-3 flex gap-2" onSubmit={onInvite}>
          <div className="flex-1 space-y-1">
            <Input
              id="staffEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@agency.com"
            />
          </div>
          <Button type="submit" className="self-end" disabled={inviteLoading}>
            {inviteLoading ? "Sending..." : "Send Invite"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">
          Awaiting Registration ({awaitingCount})
        </h2>
        <div className="mt-3 space-y-2">
          {awaiting.map((person) => (
            <div
              key={person.id}
              className="bg-white py-1 text-sm text-zinc-700"
            >
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  aria-label={`Remove ${person.email}`}
                  disabled={removeLoadingUid === person.uid}
                  onClick={() => void onRemoveAwaiting(person.uid)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-300 text-red-500 opacity-80 transition hover:bg-red-500 hover:text-white hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ×
                </button>
                <div className="flex w-full flex-col sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold">{person.email}</span>
                  <div className="flex items-center gap-1 text-zinc-600">
                    <span>{person.requesterEmail}</span>
                    <span>{person.invitedAtFormatted}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!awaiting.length ? (
            <p className="text-sm text-zinc-500">No pending registrations.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Staff ({staffCount})</h2>
        <div className="mt-3">
          <AccordionRoot
            type="single"
            collapsible
            className="space-y-2"
            value={openStaffUid}
            onValueChange={setOpenStaffUid}
          >
            {staff.map((member) => (
              <StaffAccordion
                key={member.uid}
                member={member}
                agencyId={appUser?.agencyId ?? ""}
                adminUid={appUser?.uid ?? ""}
                open={openStaffUid === member.uid}
                onStaffUpdated={() => updateSingleStaff(member.uid)}
              />
            ))}
          </AccordionRoot>
        </div>
      </Card>
    </div>
  );
};

const buildAwaitingView = async (
  list: AwaitingRegistration[],
): Promise<AwaitingRegistrationView[]> => {
  const inviterIds = Array.from(
    new Set(list.map((item) => item.invitedByUid).filter(Boolean)),
  );
  const inviterEntries = await Promise.all(
    inviterIds.map(async (uid) => {
      const profile = await getUserProfile(uid);
      return [uid, profile?.email ?? "Unknown"] as const;
    }),
  );
  const inviterMap = new Map(inviterEntries);

  return list.map((item) => ({
    ...item,
    requesterEmail: inviterMap.get(item.invitedByUid) || "Unknown",
    invitedAtFormatted: formatInvitedAt(item.invitedAt),
  }));
};

const StaffAccordion = ({
  member,
  agencyId,
  adminUid,
  open,
  onStaffUpdated,
}: {
  member: AppUser;
  agencyId: string;
  adminUid: string;
  open?: boolean;
  onStaffUpdated?: () => Promise<void | null>;
}) => {
  const [latestPayslipLine, setLatestPayslipLine] = useState("");
  const [displayContractFileName, setDisplayContractFileName] = useState("");
  const [displayContractFileUrl, setDisplayContractFileUrl] = useState("");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);
  const [deletingContract, setDeletingContract] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const contractFileInputRef = useRef<HTMLInputElement | null>(null);
  const payslipFileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const loadedRef = useRef(false);

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      void loadSummary();
    }
  }, [open]);

  const loadSummary = async () => {
    let contracts: Array<{ fileName: string; fileUrl?: string }> = [];
    try {
      contracts = await getUnsignedContractInfo(member.uid, agencyId);
    } catch {
      contracts = [];
    }

    try {
      const [signed, payslips] = await Promise.all([
        getSignedContractsForAdmin(agencyId),
        getPayslipsForUser(member.uid, agencyId),
      ]);
      const signedForUser = signed.filter((s) => s.userId === member.uid);
      const latestSignedFileName = signedForUser[0]?.fileName ?? "";
      const latestSignedFileUrl = signedForUser[0]?.fileUrl ?? "";
      const latestUnsignedFileName = contracts[0]?.fileName ?? "";
      const latestUnsignedFileUrl = contracts[0]?.fileUrl ?? "";
      setDisplayContractFileName(
        latestUnsignedFileName || latestSignedFileName,
      );
      setDisplayContractFileUrl(latestUnsignedFileUrl || latestSignedFileUrl);
      void payslips;

      const latestPayslip = await buildLatestPayslipLine(payslips[0]);
      setLatestPayslipLine(latestPayslip);
    } catch {
      setDisplayContractFileName("");
      setDisplayContractFileUrl("");
      setLatestPayslipLine("");
    }
  };

  const onContractPicked = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !agencyId || !adminUid) return;

    setUploadingContract(true);
    try {
      const displayName =
        [member.firstName, member.lastName].filter(Boolean).join(" ") ||
        member.email;
      await uploadUnsignedContract(
        file,
        member.uid,
        agencyId,
        adminUid,
        displayName,
      );
      const markSent = httpsCallable(functions, "markContractSent");
      await markSent({ targetUserId: member.uid });
      await onStaffUpdated?.();
      toast({
        title: "Contract Sent",
        description: `${file.name} sent successfully to ${displayName}`,
        variant: "default",
      });
      await loadSummary();
    } finally {
      setUploadingContract(false);
      event.target.value = "";
    }
  };

  const onDeleteContract = async () => {
    setDeletingContract("all");
    try {
      const deleteFn = httpsCallable(functions, "deleteUserContract");
      const mode = member.contractSigned ? "signed" : "unsigned";
      await deleteFn({ targetUserId: member.uid, mode });
      await onStaffUpdated?.();
      toast({
        title: "Contract Deleted",
        description: "Contract has been deleted successfully.",
        variant: "default",
      });
      await loadSummary();
    } catch {
      toast({
        title: "Failed to Delete Contract",
        description: "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setDeletingContract(null);
    }
  };

  const onPayslipPicked = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !agencyId || !adminUid) return;

    setUploadingPayslip(true);
    try {
      await uploadPayslip(file, member.uid, agencyId, adminUid);
      const displayName =
        [member.firstName, member.lastName].filter(Boolean).join(" ") ||
        member.email;
      toast({
        title: "Payslip Sent",
        description: `${file.name} sent successfully to ${displayName}`,
        variant: "default",
      });
      await loadSummary();
    } catch {
      toast({
        title: "Failed to Send Payslip",
        description: "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setUploadingPayslip(false);
      event.target.value = "";
    }
  };

  return (
    <div>
      <AccordionItem
        value={member.uid}
        title={
          <div className="flex min-w-0 w-full items-center gap-2">
            <span className="truncate">
              {[member.firstName, member.lastName].filter(Boolean).join(" ") ||
                member.email}
            </span>
            {member.contractSigned === false && member.contractSent ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:rgba(251,191,36,0.18)] border border-[color:rgba(245,158,11,0.28)] px-3 py-1 text-xs font-semibold text-amber-700 md:ml-0">
                <FileText className="h-3.5 w-3.5" />
                <span>Not Signed</span>
              </span>
            ) : member.contractSigned === true ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:rgba(52,211,153,0.18)] border border-[color:rgba(16,185,129,0.28)] px-3 py-1 text-xs font-semibold text-emerald-700 md:ml-0">
                <FileText className="h-3.5 w-3.5" />
                <span>Signed</span>
              </span>
            ) : null}
            {member.registrationStatus === "registered" &&
            !member.contractSent ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:rgba(248,113,113,0.16)] border border-[color:rgba(239,68,68,0.26)] px-3 py-1 text-xs font-semibold text-red-600 md:ml-0">
                <FileText className="h-3.5 w-3.5" />
                <span>Not Sent</span>
              </span>
            ) : null}
          </div>
        }
        actions={
          member.registrationStatus === "registered" ? (
            <div className="hidden md:flex md:items-center md:gap-2">
              {!member.contractSent ? (
                <Button
                  type="button"
                  className="inline-flex items-center gap-1 border border-[var(--primary)] bg-[color:rgba(31,79,138,0.14)] px-2 text-xs text-[var(--foreground)] shadow-none hover:brightness-110"
                  disabled={uploadingContract}
                  onClick={() => contractFileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                  {uploadingContract ? "Sending..." : "Contract"}
                </Button>
              ) : null}
              <Button
                type="button"
                className="inline-flex items-center gap-1 border border-[var(--primary)] bg-[color:rgba(31,79,138,0.14)] px-2 text-xs text-[var(--foreground)] shadow-none hover:brightness-110"
                disabled={uploadingPayslip}
                onClick={() => payslipFileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                {uploadingPayslip ? "Sending..." : "Payslip"}
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {member.registrationStatus === "registered" ? (
            <div className="flex items-center gap-2 md:hidden">
              {!member.contractSent ? (
                <Button
                  type="button"
                  className="inline-flex items-center gap-1 border border-[var(--primary)] bg-[color:rgba(31,79,138,0.14)] px-2 text-xs text-[var(--foreground)] shadow-none hover:brightness-110"
                  disabled={uploadingContract}
                  onClick={() => contractFileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                  {uploadingContract ? "Sending..." : "Contract"}
                </Button>
              ) : null}
              <Button
                type="button"
                className="inline-flex items-center gap-1 border border-[var(--primary)] bg-[color:rgba(31,79,138,0.14)] px-2 text-xs text-[var(--foreground)] shadow-none hover:brightness-110"
                disabled={uploadingPayslip}
                onClick={() => payslipFileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                {uploadingPayslip ? "Sending..." : "Payslip"}
              </Button>
            </div>
          ) : null}
          <div className="space-y-1 text-zinc-600">
            <b>Email</b>: {member.email}
            {member.registeredAt ? (
              <p>
                <b>Registered</b>: {formatInvitedAt(member.registeredAt)}
              </p>
            ) : null}
            {member.contractSent ? (
              <p>
                <b>Sent By:</b> {member.contractSentBy ?? "Unknown"} at{" "}
                {formatInvitedAt(member.contractSent)}
              </p>
            ) : null}
            {member.contractSent && displayContractFileName && (
              <div className="flex items-center gap-2">
                <span>
                  <b>Contract</b>: {displayContractFileName}
                </span>
                {displayContractFileUrl ? (
                  <a
                    href={displayContractFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Download contract"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:rgba(77,143,224,0.55)] bg-[color:rgba(77,143,224,0.14)] text-[#4d8fe0] transition hover:bg-[#4d8fe0] hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <button
                  type="button"
                  aria-label="Delete contract"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:rgba(199,67,67,0.55)] bg-[color:rgba(199,67,67,0.12)] text-[#c74343] transition hover:bg-[#c74343] hover:text-white"
                  onClick={() => setShowDeleteModal(true)}
                >
                  ×
                </button>
              </div>
            )}
            {member.contractSignedAt ? (
              <p>
                <b>Signed At:</b> {formatInvitedAt(member.contractSignedAt)}
              </p>
            ) : null}
            {latestPayslipLine ? (
              <p>
                <b>Last Payslip:</b> {latestPayslipLine}
              </p>
            ) : null}
          </div>
        </div>
      </AccordionItem>
      <input
        ref={contractFileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onContractPicked(e)}
      />
      <input
        ref={payslipFileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onPayslipPicked(e)}
      />

      <DialogRoot open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent onClose={() => setShowDeleteModal(false)}>
          <DialogTitle className="text-lg font-bold">
            Delete Contract
          </DialogTitle>
          <p className="mt-2 text-sm text-zinc-600">
            Are you sure you want to delete this contract?
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-700">
            The user must have a new contract resent and re-signed before going
            to work.
          </p>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deletingContract === "all"}
              onClick={async () => {
                await onDeleteContract();
                setShowDeleteModal(false);
              }}
            >
              {deletingContract === "all" ? "Deleting..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
};

const buildLatestPayslipLine = async (
  payslip:
    | {
        fileName: string;
        sentBy?: string;
        timestamp?: unknown;
      }
    | undefined,
): Promise<string> => {
  if (!payslip) return "";
  const sender = payslip.sentBy ?? "Unknown";
  return `${sender} ${formatInvitedAt(payslip.timestamp)}`;
};
