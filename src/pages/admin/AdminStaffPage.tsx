import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { FileText } from "lucide-react";
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
  getPendingContracts,
  getSignedContractsForAdmin,
  uploadUnsignedContract,
} from "../../services/contractService";
import { functions } from "../../services/firebase";
import { getPayslipsForUser, uploadPayslip } from "../../services/payslipService";
import {
  checkEmailStatus,
  getAwaitingRegistrationsByAgency,
  getStaffUsersByAgency,
  getUserProfile,
} from "../../services/userService";
import type { AppUser, AwaitingRegistration } from "../../types/domain";

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

  useEffect(() => {
    const run = async () => {
      if (!appUser?.agencyId) return;
      const [users, awaitingList] = await Promise.all([
        getStaffUsersByAgency(appUser.agencyId),
        getAwaitingRegistrationsByAgency(appUser.agencyId),
      ]);
      setStaff(users);
      const awaitingView = await buildAwaitingView(awaitingList);
      setAwaiting(awaitingView);
    };
    void run();
  }, [appUser?.agencyId]);

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
          <AccordionRoot type="single" collapsible className="space-y-2">
            {staff.map((member) => (
              <StaffAccordion
                key={member.uid}
                member={member}
                agencyId={appUser?.agencyId ?? ""}
                adminUid={appUser?.uid ?? ""}
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

const formatInvitedAt = (value: unknown): string => {
  const parsedDate = toDate(value);
  if (!parsedDate) return "N/A";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsedDate.getDate())}-${pad(parsedDate.getMonth() + 1)}-${parsedDate.getFullYear()} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const StaffAccordion = ({
  member,
  agencyId,
  adminUid,
}: {
  member: AppUser;
  agencyId: string;
  adminUid: string;
}) => {
  const [summary, setSummary] = useState(
    "Load to view contract/payslip status.",
  );
  const [latestContractLine, setLatestContractLine] = useState("No contract sent yet.");
  const [latestPayslipLine, setLatestPayslipLine] = useState("No payslip sent yet.");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);
  const contractFileInputRef = useRef<HTMLInputElement | null>(null);
  const payslipFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSummary = async () => {
    try {
      const [pending, signed, payslips, allContracts] = await Promise.all([
        getPendingContracts(member.uid, agencyId),
        getSignedContractsForAdmin(agencyId),
        getPayslipsForUser(member.uid, agencyId),
        getContractsForUser(member.uid, agencyId),
      ]);
      const signedForUser = signed.filter((s) => s.userId === member.uid);
      setSummary(
        `Pending contracts: ${pending.length} | Signed contracts: ${signedForUser.length} | Payslips: ${payslips.length}`,
      );

      const [latestContract, latestPayslip] = await Promise.all([
        buildLatestContractLine(allContracts[0]),
        buildLatestPayslipLine(payslips[0]),
      ]);
      setLatestContractLine(latestContract);
      setLatestPayslipLine(latestPayslip);
    } catch {
      setSummary("Unable to load status.");
      setLatestContractLine("Unable to load contract history.");
      setLatestPayslipLine("Unable to load payslip history.");
    }
  };

  const onContractPicked = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !agencyId || !adminUid) return;

    setUploadingContract(true);
    try {
      await uploadUnsignedContract(file, member.uid, agencyId, adminUid);
      await loadSummary();
    } finally {
      setUploadingContract(false);
      event.target.value = "";
    }
  };

  const onPayslipPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    <div onClick={() => void loadSummary()}>
      <AccordionItem
        value={member.uid}
        title={
          <div className="flex w-full items-center justify-between gap-4 pr-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{member.email}</span>
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
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                className="px-3 py-1 text-xs"
                disabled={uploadingContract}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  contractFileInputRef.current?.click();
                }}
              >
                {uploadingContract ? "Sending..." : "Send Contract"}
              </Button>
              <Button
                type="button"
                className="px-3 py-1 text-xs"
                disabled={uploadingPayslip}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  payslipFileInputRef.current?.click();
                }}
              >
                {uploadingPayslip ? "Sending..." : "Send Payslip"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <p>{summary}</p>
          <div className="space-y-1 text-zinc-600">
            <p>{latestContractLine}</p>
            <p>{latestPayslipLine}</p>
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
  if (!contract) return "No contract sent yet.";
  const sender = contract.uploadedByUid
    ? (await getUserProfile(contract.uploadedByUid))?.email ?? "Unknown"
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
  if (!payslip) return "No payslip sent yet.";
  const sender = payslip.uploadedByUid
    ? (await getUserProfile(payslip.uploadedByUid))?.email ?? "Unknown"
    : "Unknown";
  return `${payslip.fileName} sent by ${sender} at ${formatInvitedAt(payslip.uploadedAt)}`;
};
