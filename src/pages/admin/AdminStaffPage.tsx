import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Card,
  Input,
  Label,
} from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import {
  getPendingContracts,
  getSignedContractsForAdmin,
} from "../../services/contractService";
import { functions } from "../../services/firebase";
import { getPayslipsForUser } from "../../services/payslipService";
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
  const [email, setEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
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
    setInviteStatus("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setInviteStatus("Please enter an email address.");
      return;
    }
    if (!/.+@.+\..+/.test(normalizedEmail)) {
      setInviteStatus("Please enter a valid email address.");
      return;
    }

    setInviteLoading(true);
    try {
      if (!appUser?.agencyId) {
        setInviteStatus("Your admin profile is missing agency information.");
        return;
      }

      const emailStatus = await checkEmailStatus(
        normalizedEmail,
        appUser.agencyId,
      );
      if (emailStatus.exists) {
        if (emailStatus.state === "awaiting") {
          setInviteStatus("This email is already in Awaiting Registration.");
          return;
        }
        setInviteStatus(
          `This email is already registered as ${emailStatus.role ?? "user"}. Invite blocked.`,
        );
        return;
      }

      const callable = httpsCallable(functions, "invitePortalUser");
      await callable({ email: normalizedEmail, role: "user" });
      setInviteStatus("Invite sent successfully.");
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
      setInviteStatus(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const staffCount = useMemo(() => staff.length, [staff]);
  const awaitingCount = useMemo(() => awaiting.length, [awaiting]);

  const onRemoveAwaiting = async (uid: string) => {
    setInviteStatus("");
    setRemoveLoadingUid(uid);
    try {
      const callable = httpsCallable(functions, "removeUnregisteredStaffUser");
      await callable({ uid });
      setAwaiting((prev) => prev.filter((item) => item.uid !== uid));
      setInviteStatus("Awaiting registration user removed.");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Unable to remove awaiting user right now.";
      setInviteStatus(message);
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
        {inviteStatus ? (
          <p className="mt-2 text-sm text-zinc-600">{inviteStatus}</p>
        ) : null}
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
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-600 text-red-600 opacity-50 transition hover:bg-red-600 hover:text-white hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
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
}: {
  member: AppUser;
  agencyId: string;
}) => {
  const [summary, setSummary] = useState(
    "Load to view contract/payslip status.",
  );

  const loadSummary = async () => {
    try {
      const [pending, signed, payslips] = await Promise.all([
        getPendingContracts(member.uid, agencyId),
        getSignedContractsForAdmin(agencyId),
        getPayslipsForUser(member.uid, agencyId),
      ]);
      const signedForUser = signed.filter((s) => s.userId === member.uid);
      setSummary(
        `Pending contracts: ${pending.length} | Signed contracts: ${signedForUser.length} | Payslips: ${payslips.length}`,
      );
    } catch {
      setSummary("Unable to load status.");
    }
  };

  return (
    <div onClick={() => void loadSummary()}>
      <AccordionItem value={member.uid} title={member.email}>
        <p>{summary}</p>
      </AccordionItem>
    </div>
  );
};
