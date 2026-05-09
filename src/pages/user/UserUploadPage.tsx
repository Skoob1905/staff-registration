import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, ProgressBar } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { uploadStaffDocument } from "../../services/staffUploadService";
import { getStatus } from "../../services/userService";

export const UserUploadPage = () => {
  const { appUser } = useAuth();
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<
    "awaiting" | "registered" | undefined
  >(undefined);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!appUser) {
        setRegistrationStatus(undefined);
        setStatusLoading(false);
        return;
      }
      setStatusLoading(true);
      const nextStatus = await getStatus(appUser.uid);
      setRegistrationStatus(nextStatus);
      setStatusLoading(false);
    };
    void run();
  }, [appUser]);

  const canSubmit = useMemo(
    () => Boolean(appUser && file && registrationStatus === "registered"),
    [appUser, file, registrationStatus],
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!appUser || !file) return;
    setProgress(0);
    setStatus("");

    try {
      await uploadStaffDocument(file, appUser.uid, appUser.agencyId, category, setProgress);
      setStatus("Upload sent to your agency.");
      setFile(null);
    } catch {
      setStatus("Upload failed.");
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-bold">Manual Upload</h2>
      <p className="mt-1 text-sm text-zinc-600">Upload documents directly to your agency inbox.</p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-1">
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={statusLoading || registrationStatus !== "registered"}
            className={`w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm transition-colors ${
              !statusLoading && registrationStatus === "registered"
                ? "bg-white text-zinc-900"
                : "cursor-not-allowed bg-zinc-100 text-zinc-400"
            }`}
          >
            <option value="general">General</option>
            <option value="contract_response">Contract Response</option>
            <option value="payslip_query">Payslip Query</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="userUploadFile">File</Label>
          <Input
            id="userUploadFile"
            type="file"
            disabled={statusLoading || registrationStatus !== "registered"}
            className={
              !statusLoading && registrationStatus === "registered"
                ? ""
                : "cursor-not-allowed bg-zinc-100 text-zinc-400 file:cursor-not-allowed file:opacity-60"
            }
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <ProgressBar value={progress} />
        {status ? <p className="text-sm text-zinc-600">{status}</p> : null}

        {statusLoading ? (
          <p className="text-sm text-zinc-500">Checking registration status...</p>
        ) : null}

        {!statusLoading && registrationStatus !== "registered" ? (
          <p className="text-sm text-orange-700">
            You must complete registration before uploading documents.
          </p>
        ) : null}

        {!statusLoading && registrationStatus === "registered" ? (
          <Button type="submit" disabled={!canSubmit}>
            Upload
          </Button>
        ) : null}
      </form>
    </Card>
  );
};
