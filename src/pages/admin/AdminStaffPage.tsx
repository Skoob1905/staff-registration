import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { AccordionItem, AccordionRoot, Button, Card, Input, Label } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { getPendingContracts, getSignedContractsForAdmin } from "../../services/contractService";
import { functions } from "../../services/firebase";
import { getPayslipsForUser } from "../../services/payslipService";
import { checkEmailStatus, getAwaitingRegistrationsByAgency, getStaffUsersByAgency } from "../../services/userService";
import type { AppUser, AwaitingRegistration } from "../../types/domain";

export const AdminStaffPage = () => {
  const { appUser } = useAuth();
  const [email, setEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [awaiting, setAwaiting] = useState<AwaitingRegistration[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!appUser?.agencyId) return;
      const [users, awaitingList] = await Promise.all([
        getStaffUsersByAgency(appUser.agencyId),
        getAwaitingRegistrationsByAgency(appUser.agencyId),
      ]);
      setStaff(users);
      setAwaiting(awaitingList);
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
        setInviteStatus(`This email is already registered as ${emailStatus.role ?? "user"}. Invite blocked.`);
        return;
      }

      const callable = httpsCallable(functions, "invitePortalUser");
      await callable({ email: normalizedEmail, role: "user" });
      setInviteStatus("Invite sent successfully.");
      setEmail("");
      const awaitingList = await getAwaitingRegistrationsByAgency(appUser.agencyId);
      setAwaiting(awaitingList);
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
            <Input id="staffEmail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@agency.com" />
          </div>
          <Button type="submit" className="self-end" disabled={inviteLoading}>
            {inviteLoading ? "Sending..." : "Send Invite"}
          </Button>
        </form>
        {inviteStatus ? <p className="mt-2 text-sm text-zinc-600">{inviteStatus}</p> : null}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Awaiting Registration ({awaitingCount})</h2>
        <div className="mt-3 space-y-2">
          {awaiting.map((person) => (
            <div key={person.id} className="rounded-xl border border-[var(--border)] bg-white p-3 text-sm text-zinc-700">
              {person.email}
            </div>
          ))}
          {!awaiting.length ? <p className="text-sm text-zinc-500">No pending registrations.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Staff ({staffCount})</h2>
        <div className="mt-3">
          <AccordionRoot type="single" collapsible className="space-y-2">
            {staff.map((member) => (
              <StaffAccordion key={member.uid} member={member} agencyId={appUser?.agencyId ?? ""} />
            ))}
          </AccordionRoot>
        </div>
      </Card>
    </div>
  );
};

const StaffAccordion = ({ member, agencyId }: { member: AppUser; agencyId: string }) => {
  const [summary, setSummary] = useState("Load to view contract/payslip status.");

  const loadSummary = async () => {
    try {
      const [pending, signed, payslips] = await Promise.all([
        getPendingContracts(member.uid, agencyId),
        getSignedContractsForAdmin(agencyId),
        getPayslipsForUser(member.uid, agencyId),
      ]);
      const signedForUser = signed.filter((s) => s.userId === member.uid);
      setSummary(`Pending contracts: ${pending.length} | Signed contracts: ${signedForUser.length} | Payslips: ${payslips.length}`);
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
