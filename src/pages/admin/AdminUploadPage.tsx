import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, ProgressBar } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { uploadUnsignedContract } from "../../services/contractService";
import { uploadPayslip } from "../../services/payslipService";
import { getStaffUsersByAgency } from "../../services/userService";
import type { AppUser } from "../../types/domain";

export const AdminUploadPage = () => {
  const { appUser } = useAuth();
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [uploadType, setUploadType] = useState<"contract" | "payslip">("contract");
  const [periodLabel, setPeriodLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!appUser?.agencyId) return;
      const users = await getStaffUsersByAgency(appUser.agencyId);
      setStaff(users);
      if (users[0]) setSelectedUserId(users[0].uid);
    };
    void run();
  }, [appUser?.agencyId]);

  const canSubmit = useMemo(() => Boolean(selectedUserId && file && appUser?.agencyId), [selectedUserId, file, appUser?.agencyId]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !file || !appUser?.agencyId) return;
    setStatus("");
    setProgress(0);

    try {
      if (uploadType === "contract") {
        await uploadUnsignedContract(file, selectedUserId, appUser.agencyId, setProgress);
      } else {
        await uploadPayslip(file, selectedUserId, appUser.agencyId, periodLabel || "N/A", setProgress);
      }
      setStatus("Upload complete.");
      setFile(null);
    } catch {
      setStatus("Upload failed.");
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-bold">Upload Contract or Payslip</h2>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label>Staff Member</Label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            {staff.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label>Upload Type</Label>
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as "contract" | "payslip")}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="contract">Contract (Unsigned)</option>
            <option value="payslip">Payslip</option>
          </select>
        </div>

        {uploadType === "payslip" ? (
          <div className="space-y-1">
            <Label htmlFor="period">Period Label</Label>
            <Input id="period" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="2026-05" />
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="file">File</Label>
          <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <ProgressBar value={progress} />
        {status ? <p className="text-sm text-zinc-600">{status}</p> : null}

        <Button type="submit" disabled={!canSubmit}>
          Upload
        </Button>
      </form>
    </Card>
  );
};
