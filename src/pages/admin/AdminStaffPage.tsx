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
              className="rounded-xl  border-[var(--border)] bg-white p-0.5 text-sm text-zinc-700"
            >
              <span className="font-bold">{person.email}</span>
              <span className="mx-4">
                {person.requesterEmail} @ {person.invitedAtFormatted}
              </span>
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
