import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, ProgressBar } from "../components/ui";
import { ClientsDropdown } from "../components/ClientsDropdown";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { uploadClientContract } from "../services/contractService";
import { uploadStaffDocument } from "../services/staffUploadService";
import { getStatus } from "../services/userService";

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";
const DEV_FILE_SIZE_LIMIT = 104857600;

const ADMIN_UPLOAD_TYPES = [
  { label: "Signed Contract", value: "client_contract" },
] as const;

const CLIENT_UPLOAD_TYPES = [
  { label: "Timesheet", value: "timesheet" },
  { label: "Document", value: "document" },
] as const;

const CATEGORIES = [
  { label: "General", value: "general" },
  { label: "Contract Response", value: "contract_response" },
  { label: "Payslip Query", value: "payslip_query" },
];

export const UploadPage = () => {
  useEffect(() => {
    document.title = "Upload";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = appUser?.role === "admin";

  const config = isAdmin
    ? { title: "Upload", uploadTypes: ADMIN_UPLOAD_TYPES }
    : { title: "Upload", uploadTypes: CLIENT_UPLOAD_TYPES };

  const [selectedClientId, setSelectedClientId] = useState("");
  const [docType, setDocType] = useState<string>(config.uploadTypes[0].value);
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const [registrationStatus, setRegistrationStatus] = useState<
    "awaiting" | "registered" | undefined
  >(undefined);

  const statusLoading = registrationStatus === undefined;

  useEffect(() => {
    if (!isAdmin && appUser) {
      getStatus(appUser.uid)
        .then(setRegistrationStatus)
        .catch(() => setRegistrationStatus("awaiting"));
    }
  }, [isAdmin, appUser]);

  const targetClientId = isAdmin ? selectedClientId : (appUser?.agencyId ?? "");

  const canSubmit = useMemo(() => {
    if (!file || !appUser?.agencyId) return false;

    if (
      docType !== "client_contract" &&
      docType !== "timesheet" &&
      docType !== "document"
    )
      return false;

    if (docType === "client_contract" && !selectedClientId) return false;

    if (!isAdmin && registrationStatus !== "registered") return false;

    return true;
  }, [
    file,
    appUser?.agencyId,
    docType,
    selectedClientId,
    isAdmin,
    registrationStatus,
  ]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !file || !appUser?.agencyId || !targetClientId) return;

    if (ALGOLIA_INDEX_PREFIX === "dev_" && file.size > DEV_FILE_SIZE_LIMIT) {
      toast({
        title: "File too large",
        description: "In preview mode, files are limited to 100MB.",
        variant: "error",
      });
      return;
    }

    setProgress(0);

    try {
      if (docType === "client_contract") {
        setProgress(60);
        await uploadClientContract(file, targetClientId);
        toast({ title: "Contract uploaded successfully", variant: "default" });
      } else {
        const label =
          config.uploadTypes.find((t) => t.value === docType)?.label ??
          "Document";
        await uploadStaffDocument(
          file,
          appUser.uid,
          appUser.agencyId,
          category,
          setProgress,
        );
        toast({ title: `${label} uploaded successfully`, variant: "default" });
      }

      setFile(null);
      setSelectedClientId("");
      setProgress(0);
    } catch {
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "error",
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <h2 className="text-lg font-bold">{config.title}</h2>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label>Document Type</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              {config.uploadTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <Label>Client</Label>
              <ClientsDropdown
                value={selectedClientId}
                onChange={setSelectedClientId}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                disableWithContract
              />
            </div>
          )}

          {!isAdmin && docType === "document" && (
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
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="uploadFile">File</Label>
            <Input
              id="uploadFile"
              type="file"
              disabled={
                !isAdmin &&
                (statusLoading || registrationStatus !== "registered")
              }
              className={
                !isAdmin && statusLoading && registrationStatus !== "registered"
                  ? "cursor-not-allowed bg-zinc-100 text-zinc-400 file:cursor-not-allowed file:opacity-60"
                  : ""
              }
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <ProgressBar value={progress} />

          {!isAdmin && statusLoading ? (
            <p className="text-sm text-zinc-500">
              Checking registration status...
            </p>
          ) : null}

          {!isAdmin && !statusLoading && registrationStatus !== "registered" ? (
            <p className="text-sm text-orange-700">
              You must complete registration before uploading documents.
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!canSubmit || (!isAdmin && statusLoading)}
          >
            Upload
          </Button>
        </form>
      </Card>
    </div>
  );
};
