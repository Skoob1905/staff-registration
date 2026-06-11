import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Label,
  ProgressBar,
} from "../components/ui";
import { ClientsDropdown } from "../components/ClientsDropdown";
import { PreviewModal } from "../components/PreviewModal";
import { Caption } from "../config/typography";
import { config } from "../config";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { uploadClientContract } from "../services/contractService";
import { functions } from "../services/firebase";
import { uploadStaffDocument } from "../services/staffUploadService";
import { getStatus } from "../services/userService";
import type { BulkStaff } from "../types/domain";

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";
const DEV_FILE_SIZE_LIMIT = 104857600;
const INVOICE_FILE_SIZE_LIMIT = 2097152;
const CV_FILE_SIZE_LIMIT = 2 * 1024 * 1024;

const ADMIN_UPLOAD_TYPES = [
  { label: "Signed Contract", value: "client_contract" },
  { label: "INVOICES", value: "invoice" },
  { label: "CV", value: "cv" },
] as const;

const CLIENT_UPLOAD_TYPES = [
  { label: "Timesheet", value: "timesheet" },
  { label: "INVOICES", value: "invoice" },
] as const;

const CATEGORIES = [
  { label: "General", value: "general" },
  { label: "Contract Response", value: "contract_response" },
  { label: "Payslip Query", value: "payslip_query" },
];

interface CvFile {
  file: File;
  base64: string;
  parsedForename: string;
  parsedSurname: string;
  match: BulkStaff | null;
  error?: "size" | "format";
}

function parseFileName(name: string): { forename: string; surname: string } | null {
  const withoutExt = name.replace(/\.pdf$/i, "").trim();
  const parts = withoutExt.split(/\s+/);
  if (parts.length < 2) return null;
  return { forename: parts[0], surname: parts.slice(1).join(" ") };
}

function findMatch(
  forename: string,
  surname: string,
  staffList: BulkStaff[],
): BulkStaff | null {
  return (
    staffList.find(
      (staff) =>
        staff.Forename?.toLowerCase() === forename.toLowerCase() &&
        staff.Surname?.toLowerCase() === surname.toLowerCase(),
    ) ?? null
  );
}

export const UploadPage = () => {
  useEffect(() => {
    document.title = "Upload";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = appUser?.role === "admin";

  const pageConfig = isAdmin
    ? { title: "Upload", uploadTypes: ADMIN_UPLOAD_TYPES }
    : { title: "Upload", uploadTypes: CLIENT_UPLOAD_TYPES };

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>(pageConfig.uploadTypes[0].value);
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<
    "awaiting" | "registered" | undefined
  >(undefined);
  const [cvMode, setCvMode] = useState(false);
  const [cvFiles, setCvFiles] = useState<CvFile[]>([]);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvReviewOpen, setCvReviewOpen] = useState(false);

  const { items: allStaff } = usePaginatedRecords<BulkStaff>({
    indexName: "staff_name_desc",
    agencyId: "all",
    hitsPerPage: 10000,
  });

  const matched = useMemo(
    () => cvFiles.filter((cvFile) => cvFile.match && !cvFile.error),
    [cvFiles],
  );
  const statusLoading = registrationStatus === undefined;
  const registrationBlocked =
    !isAdmin && (statusLoading || registrationStatus !== "registered");
  const totalCount = cvFiles.length;
  const matchedCount = matched.length;

  useEffect(() => {
    if (!isAdmin && appUser) {
      getStatus(appUser.uid)
        .then(setRegistrationStatus)
        .catch(() => setRegistrationStatus("awaiting"));
    }
  }, [appUser, isAdmin]);

  const readCvFile = useCallback(
    (selectedFile: File): Promise<CvFile> =>
      new Promise((resolve) => {
        const parsed = parseFileName(selectedFile.name);

        if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
          resolve({
            file: selectedFile,
            base64: "",
            parsedForename: "",
            parsedSurname: "",
            match: null,
            error: "format",
          });
          return;
        }

        if (selectedFile.size > CV_FILE_SIZE_LIMIT) {
          resolve({
            file: selectedFile,
            base64: "",
            parsedForename: parsed?.forename ?? "",
            parsedSurname: parsed?.surname ?? "",
            match: null,
            error: "size",
          });
          return;
        }

        if (!parsed) {
          resolve({
            file: selectedFile,
            base64: "",
            parsedForename: "",
            parsedSurname: "",
            match: null,
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve({
            file: selectedFile,
            base64: result.split(",")[1],
            parsedForename: parsed.forename,
            parsedSurname: parsed.surname,
            match: findMatch(parsed.forename, parsed.surname, allStaff),
          });
        };
        reader.onerror = () => {
          resolve({
            file: selectedFile,
            base64: "",
            parsedForename: parsed.forename,
            parsedSurname: parsed.surname,
            match: null,
          });
        };
        reader.readAsDataURL(selectedFile);
      }),
    [allStaff],
  );

  const handleCvFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const results = await Promise.all(fileArray.map(readCvFile));
      setCvFiles((previous) => [...previous, ...results]);
      setCvReviewOpen(true);
    },
    [readCvFile],
  );

  const removeCvFile = useCallback((index: number) => {
    setCvFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const handleCvUpload = useCallback(async () => {
    const valid = matched.filter((cvFile) => cvFile.base64);
    if (valid.length === 0) return;

    setCvUploading(true);

    try {
      const uploadStaffCvs = httpsCallable(functions, "uploadStaffCvs");
      await uploadStaffCvs({
        cvs: valid.map((cvFile) => ({
          staffId: cvFile.match!.id,
          fileName: cvFile.file.name,
          fileBase64: cvFile.base64,
        })),
      });
      toast({
        title: "CVs uploaded",
        description: `${valid.length} CV(s) uploaded successfully`,
        variant: "success",
      });
      setCvFiles([]);
      setCvReviewOpen(false);
      setCvMode(false);
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload CVs. Please try again.",
        variant: "error",
      });
    } finally {
      setCvUploading(false);
    }
  }, [matched, toast]);

  const handleDocTypeChange = (value: string) => {
    setDocType(value);
    setCvMode(value === "cv");
    setFile(null);
    if (value !== "invoice") {
      setInvoiceFile(null);
      setPreviewModalOpen(false);
    }
  };

  const targetClientId = isAdmin ? selectedClientId : (appUser?.agencyId ?? "");

  const canSubmit = useMemo(() => {
    if (docType === "invoice") return false;
    if (!file || !appUser?.agencyId) return false;
    if (
      docType !== "client_contract" &&
      docType !== "timesheet" &&
      docType !== "document"
    ) {
      return false;
    }
    if (docType === "client_contract" && !selectedClientId) return false;
    if (!isAdmin && registrationStatus !== "registered") return false;
    return true;
  }, [appUser?.agencyId, docType, file, isAdmin, registrationStatus, selectedClientId]);

  const handleInvoiceFile = (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (selectedFile.size > INVOICE_FILE_SIZE_LIMIT) {
      toast({
        title: "File too large",
        description: "Invoice files must be under 2MB.",
        variant: "error",
      });
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "error",
      });
      return;
    }

    setInvoiceFile(selectedFile);
    setPreviewModalOpen(true);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (
      !canSubmit ||
      uploading ||
      !file ||
      !appUser?.agencyId ||
      !targetClientId
    ) {
      return;
    }

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
        toast({
          title: `"${file.name}" uploaded to ${selectedClientName}`,
          variant: "success",
        });
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
        const recordTimesheetUpload = httpsCallable<
          {
            fileBase64: string;
            fileName: string;
            clientId: string;
            contentType: string;
          },
          { ok: boolean; url: string }
        >(functions, "recordTimesheetUpload");
        await recordTimesheetUpload({
          fileBase64: base64,
          fileName: file.name,
          clientId: appUser.agencyId,
          contentType: file.type,
        });
        toast({
          title: "Timesheet uploaded",
          description: `${config.name} has received your timesheet`,
          variant: "success",
        });
      } else {
        await uploadStaffDocument(
          file,
          appUser.uid,
          appUser.agencyId,
          category,
          setProgress,
        );
        toast({
          title: `"${file.name}" uploaded successfully`,
          variant: "success",
        });
      }

      setFile(null);
      setSelectedClientId("");
      setSelectedClientName("");
      setProgress(0);
      const uploadInput = document.getElementById("uploadFile") as HTMLInputElement;
      if (uploadInput) uploadInput.value = "";
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "already-exists" || code === "functions/already-exists") {
        toast({
          title: "Duplicate timesheet",
          description: `A timesheet named "${file.name}" has already been uploaded.`,
          variant: "error",
        });
      } else {
        toast({
          title: "Upload failed",
          description: `"${file.name}" could not be uploaded. Please try again.`,
          variant: "error",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <h2 className="text-lg font-bold">{pageConfig.title}</h2>

        {!cvMode ? (
          <form className="mt-4 space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label>Document Type</Label>
              <select
                value={docType}
                onChange={(event) => handleDocTypeChange(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                {pageConfig.uploadTypes.map((uploadType) => (
                  <option key={uploadType.value} value={uploadType.value}>
                    {uploadType.label}
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
                  onChange={(event) => setCategory(event.target.value)}
                  disabled={registrationBlocked}
                  className={`w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm transition-colors ${
                    registrationBlocked
                      ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                      : "bg-white text-zinc-900"
                  }`}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
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
                  disabled={registrationBlocked}
                  accept={
                    docType === "timesheet"
                      ? ".csv"
                      : docType === "invoice"
                        ? ".pdf"
                        : undefined
                  }
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    if (docType === "invoice") {
                      handleInvoiceFile(selectedFile);
                      event.target.value = "";
                    } else {
                      setFile(selectedFile);
                    }
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <div
                  className={`flex items-center rounded-xl border px-3 py-2 text-sm transition ${
                    registrationBlocked
                      ? "cursor-not-allowed border-[var(--border)] bg-zinc-100 text-zinc-400"
                      : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)]"
                  }`}
                >
                  {docType === "invoice"
                    ? invoiceFile?.name ?? "Choose file"
                    : file?.name ?? "Choose file"}
                </div>
                {docType === "timesheet" && (
                  <p className="mt-1 text-xs text-zinc-500">CSV format only</p>
                )}
                {docType === "invoice" && (
                  <p className="mt-1 text-xs text-zinc-500">PDF format only, max 2MB</p>
                )}
              </div>
            </div>

            <ProgressBar value={progress} />

            {!isAdmin && statusLoading ? (
              <p className="text-sm text-zinc-500">Checking registration status...</p>
            ) : null}

            {!isAdmin && !statusLoading && registrationStatus !== "registered" ? (
              <p className="text-sm text-orange-700">
                You must complete registration before uploading documents.
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={
                docType === "invoice" ||
                !canSubmit ||
                uploading ||
                (!isAdmin && statusLoading)
              }
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
        ) : (
          <div className="mt-4 space-y-3">
            <input
              id="cvFileInput"
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void handleCvFiles(event.target.files);
                event.target.value = "";
              }}
            />

            {cvFiles.length === 0 ? (
              <div
                onClick={() => document.getElementById("cvFileInput")?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#0EA5E9] bg-[#0EA5E9]/5 p-8 transition hover:scale-[1.02]"
              >
                <FileText className="h-8 w-8 text-[#0EA5E9]" />
                <span className="text-sm font-bold text-[#0EA5E9]">CV</span>
                <span className="text-center text-xs leading-tight text-zinc-500">
                  Upload CVs for your staff members
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {totalCount} CV{totalCount !== 1 ? "s" : ""}
                    {" | "}
                    <span className="text-[var(--primary)]">{matchedCount} Matched</span>
                    {" | "}
                    <span className="text-red-600">
                      {totalCount - matchedCount} Unmatched
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => document.getElementById("cvFileInput")?.click()}
                    >
                      Add More
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setCvReviewOpen(true)}
                      disabled={matchedCount === 0}
                    >
                      Upload {matchedCount} CV{matchedCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>

                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                  {cvFiles.map((cvFile, index) => (
                    <div
                      key={`${cvFile.file.name}-${index}`}
                      className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs sm:text-sm ${
                        cvFile.error || !cvFile.match
                          ? "bg-red-50 text-red-700"
                          : "bg-[color:rgba(0,95,87,0.06)] text-[var(--foreground)]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {cvFile.error || !cvFile.match ? (
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                        )}
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{cvFile.file.name}</span>
                        {cvFile.match && (
                          <span className="text-[var(--muted-foreground)]">
                            → {cvFile.match.Forename} {cvFile.match.Surname}
                          </span>
                        )}
                        {cvFile.error === "size" && (
                          <span className="text-red-600">(too large)</span>
                        )}
                        {cvFile.error === "format" && (
                          <span className="text-red-600">(not PDF)</span>
                        )}
                        {!cvFile.error && !cvFile.match && (
                          <span className="text-red-600">(no match)</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeCvFile(index);
                        }}
                        className="ml-2 shrink-0 text-[var(--muted-foreground)] hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button type="button" onClick={() => setCvMode(false)}>
              Back
            </Button>
          </div>
        )}
      </Card>

      <DialogRoot open={cvReviewOpen} onOpenChange={setCvReviewOpen}>
        <DialogContent
          className="max-w-5xl flex flex-col overflow-hidden max-sm:h-[90vh] max-sm:w-[96vw] sm:h-[85vh] sm:w-[90vw]"
          onClose={() => {
            if (!cvUploading) setCvReviewOpen(false);
          }}
        >
          <DialogTitle className="text-base font-bold sm:text-lg">
            Upload CVs
          </DialogTitle>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {totalCount} CV{totalCount !== 1 ? "s" : ""}
              {" | "}
              <span className="text-[var(--primary)]">{matchedCount} Matched</span>
              {" | "}
              <span className="text-red-600">{totalCount - matchedCount} Unmatched</span>
            </span>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">CV File</th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">Status</th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">Title</th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">Forename</th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">Surname</th>
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">NI Number</th>
                </tr>
              </thead>
              <tbody>
                {cvFiles.map((cvFile, index) => (
                  <tr
                    key={`${cvFile.file.name}-${index}`}
                    className={`border-b border-[var(--border)] last:border-0 ${cvFile.error || !cvFile.match ? "bg-red-50" : ""}`}
                  >
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      <span className={cvFile.error || !cvFile.match ? "text-red-600" : ""}>
                        {cvFile.file.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {cvFile.match ? (
                        <span className="text-[var(--primary)]">Matched</span>
                      ) : cvFile.error === "size" ? (
                        <span className="text-red-600">Too large</span>
                      ) : cvFile.error === "format" ? (
                        <span className="text-red-600">Not PDF</span>
                      ) : (
                        <span className="text-red-600">No match</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cvFile.match?.Title ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cvFile.match?.Forename ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cvFile.match?.Surname ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {cvFile.match?.email ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cvUploading && (
            <div className="mt-3">
              <ProgressBar value={50} />
              <Caption className="mt-1">Uploading CVs...</Caption>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              disabled={cvUploading}
              onClick={() => setCvReviewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={cvUploading || matchedCount === 0}
              onClick={() => void handleCvUpload()}
            >
              {cvUploading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Importing...
                </span>
              ) : (
                `Import ${matchedCount} CV${matchedCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <PreviewModal
        open={previewModalOpen}
        file={invoiceFile}
        onClose={() => {
          setPreviewModalOpen(false);
          setInvoiceFile(null);
        }}
      />
    </div>
  );
};
