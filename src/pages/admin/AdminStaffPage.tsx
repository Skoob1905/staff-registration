import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { httpsCallable } from "firebase/functions";
import { Download, FileText } from "lucide-react";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Card,
  Input,
  Label,
} from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import {
  getContractsForUser,
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
import type {
  AppUser,
  AwaitingRegistration,
  UnsignedContract,
} from "../../types/domain";
import { formatInvitedAt } from "../../utils/date";

type AwaitingRegistrationView = AwaitingRegistration & {
  requesterEmail: string;
  invitedAtFormatted: string;
};

export const AdminStaffPage = () => {
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
        <h2 className="text-lg font-bold">Register Member of Staff</h2>
        <form className="mt-3 flex gap-2" onSubmit={onInvite}>
          <div className="flex-1 space-y-1">
            <Label htmlFor="staffEmail">Staff Email</Label>
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
              className="bg-white px-1 py-1 text-sm text-zinc-700"
            >
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  aria-label={`Remove ${person.email}`}
                  disabled={removeLoadingUid === person.uid}
                  onClick={() => void onRemoveAwaiting(person.uid)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-300 text-red-400 opacity-80 transition duration-200 hover:border-red-400 hover:bg-red-400 hover:text-white hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ×
                </button>
                <div className="flex w-full items-center justify-between">
                  <span className="font-bold">{person.email}</span>
                  <div className="flex items-center gap-3 text-zinc-600">
                    <span>{person.requesterEmail}</span>
                    <span className="text-zinc-400">•</span>
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
  const [summary, setSummary] = useState(
    "Load to view contract/payslip status.",
  );
  const [latestContractLine, setLatestContractLine] = useState("");
  const [latestPayslipLine, setLatestPayslipLine] = useState("");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);
  const [pendingContracts, setPendingContracts] = useState<UnsignedContract[]>(
    [],
  );
  const [deletingContract, setDeletingContract] = useState<string | null>(null);
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
    let contracts: UnsignedContract[] = [];
    try {
      contracts = await getUnsignedContractInfo(member.uid, agencyId);
      setPendingContracts(contracts);

    } catch {
      setPendingContracts([]);
    }

    try {
      const [signed, payslips, allContracts] = await Promise.all([
        getSignedContractsForAdmin(agencyId),
        getPayslipsForUser(member.uid, agencyId),
        getContractsForUser(member.uid, agencyId),
      ]);
      const signedForUser = signed.filter((s) => s.userId === member.uid);
      setSummary(
        `Pending contracts: ${contracts.length} | Signed contracts: ${signedForUser.length} | Payslips: ${payslips.length}`,
      );

      const [latestContract, latestPayslip] = await Promise.all([
        buildLatestContractLine(allContracts[0]),
        buildLatestPayslipLine(payslips[0]),
      ]);
      setLatestContractLine(latestContract);
      setLatestPayslipLine(latestPayslip);
    } catch {
      setSummary("");
      setLatestContractLine("");
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
      const deleteFn = httpsCallable(functions, "deleteContract");
      await deleteFn({ targetUserId: member.uid, contractId: pendingContracts[0].id });
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
      await uploadPayslip(file, member.uid, agencyId, "N/A", adminUid);
      await loadSummary();
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
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate">
              {[member.firstName, member.lastName]
                .filter(Boolean)
                .join(" ") || member.email}
            </span>
            {member.contractSigned === false ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                <FileText className="h-3.5 w-3.5" />
                Not Signed
              </span>
            ) : member.contractSigned === true ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                <FileText className="h-3.5 w-3.5" />
                Signed
              </span>
            ) : null}
          </div>
        }
        actions={
          member.registrationStatus === "registered" ? (
            <>
              {pendingContracts[0]?.fileUrl && (
                <a
                  href={pendingContracts[0].fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" className="px-3 py-1 text-xs">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </a>
              )}
              {member.contractSigned === false ? (
                <Button
                  type="button"
                  className="px-3 py-1 text-xs"
                  disabled={deletingContract === "all"}
                  onClick={() => void onDeleteContract()}
                >
                  {deletingContract === "all"
                    ? "Deleting..."
                    : "Delete Contract"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="px-3 py-1 text-xs"
                  disabled={uploadingContract}
                  onClick={() => contractFileInputRef.current?.click()}
                >
                  {uploadingContract ? "Sending..." : "Send Contract"}
                </Button>
              )}
              <Button
                type="button"
                className="px-3 py-1 text-xs"
                disabled={uploadingPayslip}
                onClick={() => payslipFileInputRef.current?.click()}
              >
                {uploadingPayslip ? "Sending..." : "Send Payslip"}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <p>{summary}</p>

          <div className="space-y-1 text-zinc-600">
            <b>Email</b>: {member.email}
            {member.registeredAt ? (
              <p>
                <b>Registered</b>: {formatInvitedAt(member.registeredAt)}
              </p>
            ) : null}
            {member.contractSigned === false && member.contractSentBy ? (
              <p>
                <b>Contract Sent By:</b> {member.contractSentBy} at{" "}
                {formatInvitedAt(member.contractSent)}
              </p>
            ) : null}
            {pendingContracts[0] && (
              <div className="flex items-center gap-2">
                <span>
                  <b>Contract Sent</b>: {pendingContracts[0].fileName} at{" "}
                  {formatInvitedAt(pendingContracts[0].createdAt)}
                </span>
              </div>
            )}
            {latestContractLine ? <p>{latestContractLine}</p> : null}
            {latestPayslipLine ? <p>{latestPayslipLine}</p> : null}
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
    </div>
  );
};

const buildLatestContractLine = async (
  contract:
    | {
        fileName: string;
        createdAt?: unknown;
        uploadedByUid?: string;
      }
    | undefined,
): Promise<string> => {
  if (!contract) return "";
  const sender = contract.uploadedByUid
    ? ((await getUserProfile(contract.uploadedByUid))?.email ?? "Unknown")
    : "Unknown";
  return `${contract.fileName} sent by ${sender} at ${formatInvitedAt(contract.createdAt)}`;
};

const buildLatestPayslipLine = async (
  payslip:
    | {
        fileName: string;
        uploadedAt?: unknown;
        uploadedByUid?: string;
      }
    | undefined,
): Promise<string> => {
  if (!payslip) return "";
  const sender = payslip.uploadedByUid
    ? ((await getUserProfile(payslip.uploadedByUid))?.email ?? "Unknown")
    : "Unknown";
  return `${payslip.fileName} sent by ${sender} at ${formatInvitedAt(payslip.uploadedAt)}`;
};
