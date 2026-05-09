import { useMemo, useState } from "react";
import { Button, Card, Input, Label, ProgressBar } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { uploadStaffDocument } from "../../services/staffUploadService";

export const UserUploadPage = () => {
  const { appUser } = useAuth();
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const canSubmit = useMemo(() => Boolean(appUser && file), [appUser, file]);

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
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="general">General</option>
            <option value="contract_response">Contract Response</option>
            <option value="payslip_query">Payslip Query</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="userUploadFile">File</Label>
          <Input id="userUploadFile" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
