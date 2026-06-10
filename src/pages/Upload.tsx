import { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Loader2 } from "lucide-react";
import { Button, Card, Label, ProgressBar } from "../components/ui";
import { ClientsDropdown } from "../components/ClientsDropdown";
import { config } from "../config";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { functions } from "../services/firebase";
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
] as const;

const CATEGORIES = [
  { label: "General", value: "general" },
  { label: "Contract Response", value: "contract_response" },
  { label: "Payslip Query", value: "payslip_query" },
];

function renderToast(
  type: "success" | "error",
  docType: string,
  params: { fileName: string; clientName?: string },
): { title: string; description?: string; variant: "success" | "error" } {
  if (type === "error") {
    return {
      title: "Upload failed",
      description: `"${params.fileName}" could not be uploaded. Please try again.`,
      variant: "error",
    };
  }

  switch (docType) {
    case "client_contract":
      return {
        title: `"${params.fileName}" uploaded to ${params.clientName}`,
        variant: "success",
      };
    case "timesheet":
      return {
        title: "Timesheet uploaded",
        description: `${config.name} has received your timesheet`,
        variant: "success",
      };
    default:
      return {
        title: `"${params.fileName}" uploaded successfully`,
        variant: "success",
      };
  }
}

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
  const [selectedClientName, setSelectedClientName] = useState("");
  const [uploading, setUploading] = useState(false);
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
    if (
      !canSubmit ||
      uploading ||
      !file ||
      !appUser?.agencyId ||
      !targetClientId
    )
      return;

    if (ALGOLIA_INDEX_PREFIX === "dev_" && file.size > DEV_FILE_SIZE_LIMIT) {
      toast({
        title: "File too large",
        description: "In preview mode, files are limited to 100MB.",
        variant: "error",
      });
      return;
    }

    if (docType === "timesheet" && !file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "error",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      if (docType === "client_contract") {
        setProgress(60);
        await uploadClientContract(file, targetClientId);
        toast(
          renderToast("success", docType, {
            fileName: file.name,
            clientName: selectedClientName,
          }),
        );
      } else if (docType === "timesheet") {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const fn = httpsCallable<
          {
            fileBase64: string;
            fileName: string;
            clientId: string;
            contentType: string;
          },
          { ok: boolean; url: string }
        >(functions, "recordTimesheetUpload");
        await fn({
          fileBase64: base64,
          fileName: file.name,
          clientId: appUser.agencyId,
          contentType: file.type,
        });
        toast(renderToast("success", docType, { fileName: file.name }));
      } else {
        await uploadStaffDocument(
          file,
          appUser.uid,
          appUser.agencyId,
          category,
          setProgress,
        );
        toast(renderToast("success", docType, { fileName: file.name }));
      }

      setFile(null);
      setSelectedClientId("");
      setSelectedClientName("");
      setProgress(0);
      const el = document.getElementById("uploadFile") as HTMLInputElement;
      if (el) el.value = "";
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (
        code === "already-exists" ||
        code === "functions/already-exists"
      ) {
        toast({
          title: "Duplicate timesheet",
          description: `A timesheet named "${file.name}" has already been uploaded.`,
          variant: "error",
        });
      } else {
        toast(renderToast("error", docType, { fileName: file.name }));
      }
    } finally {
      setUploading(false);
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
                onChange={(id, name) => {
                  setSelectedClientId(id);
                  setSelectedClientName(name);
                }}
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
            <Label>File</Label>
            <div className="relative">
              <input
                id="uploadFile"
                type="file"
                disabled={
                  !isAdmin &&
                  (statusLoading || registrationStatus !== "registered")
                }
                accept={docType === "timesheet" ? ".csv" : undefined}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <div
                className={`flex items-center rounded-xl border px-3 py-2 text-sm transition ${
                  !isAdmin &&
                  (statusLoading || registrationStatus !== "registered")
                    ? "cursor-not-allowed bg-zinc-100 text-zinc-400 border-[var(--border)]"
                    : "bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--border)]"
                }`}
              >
                {file ? file.name : "Choose file"}
              </div>
              {docType === "timesheet" && (
                <p className="mt-1 text-xs text-zinc-500">
                  CSV format only
                </p>
              )}
            </div>
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
            disabled={!canSubmit || uploading || (!isAdmin && statusLoading)}
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </span>
            ) : (
              "Upload"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};
