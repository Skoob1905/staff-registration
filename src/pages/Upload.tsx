import { type ElementType, useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  Building2,
  Clock,
  FileSignature,
  FileText,
  FileUser,
  Loader2,
  Users,
} from "lucide-react";
import { AddModal } from "../components/AddModal";
import { Card, ProgressBar } from "../components/ui";
import { FileDrop } from "../components/FileDrop";
import { PreviewModal } from "../components/PreviewModal";
import { CVUploadModal } from "../components/CVUploadModal";
import { Section } from "../components/Section";
import { config } from "../config";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { functions } from "../services/firebase";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { readCvFile, type CvFile } from "../utils/cvUpload";
import type { BulkStaff } from "../types/domain";

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";
const FILE_SIZE_LIMIT = 209715200;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

interface UploadType {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  color: string;
  acceptedFiles?: string;
  fileLimit?: string;
  multiple?: boolean;
}

const ADMIN_TYPES: UploadType[] = [
  {
    id: "staff",
    icon: Users,
    title: "Staff",
    description: "Bulk import staff records",
    color: "#4A90D9",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
  {
    id: "clients",
    icon: Building2,
    title: "Clients",
    description: "Bulk import client records",
    color: "#34A853",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
  {
    id: "contracts",
    icon: FileSignature,
    title: "Contracts",
    description: "Upload signed contracts for your clients",
    color: "#FB8C00",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB",
  },
  {
    id: "invoices",
    icon: FileText,
    title: "Invoices",
    description: "Upload invoices for your clients",
    color: "#E91E63",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB",
  },
  {
    id: "cvs",
    icon: FileUser,
    title: "CVs",
    description: "Bulk upload staff CVs",
    color: "#AB47BC",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB per file",
    multiple: true,
  },
];

const CLIENT_TYPES: UploadType[] = [
  {
    id: "timesheets",
    icon: Clock,
    title: "Timesheets",
    description: "Upload your timesheet as a CSV file",
    color: "#005F57",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
];

export const UploadPage = () => {
  useEffect(() => {
    document.title = "Upload";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = appUser?.role === "admin";
  const types = isAdmin ? ADMIN_TYPES : CLIENT_TYPES;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalFile, setAddModalFile] = useState<File | null>(null);
  const [addModalCsvType, setAddModalCsvType] = useState<"staff" | "agency">(
    "staff",
  );

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewMode, setPreviewMode] = useState<"invoice" | "contract">(
    "invoice",
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [cvFiles, setCvFiles] = useState<CvFile[]>([]);
  const [cvUploading, setCvUploading] = useState(false);
  const [showCvModal, setShowCvModal] = useState(false);

  const { items: staffList } = usePaginatedRecords<BulkStaff>({
    indexName: "staff_name_desc",
    agencyId: appUser?.agencyId ?? "",
    hitsPerPage: 10000,
  });

  useEffect(() => {
    if (uploading) {
      loadingTimerRef.current = setTimeout(() => {
        toast({
          title: "Still uploading...",
          variant: "info",
          replaceToast: true,
        });
      }, 5000);
    }
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [uploading, toast]);

  const handleCvUpload = useCallback(async () => {
    const valid = cvFiles.filter((f) => f.match && !f.error && f.base64);
    if (valid.length === 0) return;

    setCvUploading(true);

    try {
      const fn = httpsCallable(functions, "uploadStaffCvs");
      await fn({
        cvs: valid.map((f) => ({
          staffId: f.match!.id,
          fileName: f.file.name,
          fileBase64: f.base64,
        })),
      });

      toast({
        title: "CVs uploaded",
        description: `${valid.length} CV(s) uploaded successfully`,
        variant: "success",
      });

      setCvFiles([]);
      setShowCvModal(false);
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload CVs. Please try again.",
        variant: "error",
      });
    } finally {
      setCvUploading(false);
    }
  }, [cvFiles, toast]);

  const handleFileSelect = async (file: File, typeId: string) => {
    if (typeId === "staff" || typeId === "clients") {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${typeId === "staff" ? "Staff" : "Client"} CSV must be 2MB or less.`,
          variant: "error",
        });
        return;
      }
      if (typeId === "staff") {
        setAddModalFile(file);
        setAddModalCsvType("staff");
        setShowAddModal(true);
      } else {
        setAddModalFile(file);
        setAddModalCsvType("agency");
        setShowAddModal(true);
      }
    } else if (typeId === "timesheets") {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file.",
          variant: "error",
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Timesheet must be 2MB or less.",
          variant: "error",
        });
        return;
      }
      if (ALGOLIA_INDEX_PREFIX === "dev_" && file.size > FILE_SIZE_LIMIT) {
        toast({
          title: "File too large",
          description: "In preview mode, files are limited to 200MB.",
          variant: "error",
        });
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
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
          clientId: appUser?.agencyId ?? "",
          contentType: file.type,
        });

        toast({
          title: "Timesheet uploaded",
          description: `${config.name} has received your timesheet`,
          variant: "success",
        });
      } catch (err) {
        const code = (err as { code?: string })?.code;
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
        setProgress(0);
      }
    } else if (typeId === "contracts") {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Contracts must be 2MB or less.",
          variant: "error",
        });
        return;
      }
      setPreviewFile(file);
      setPreviewMode("contract");
      setShowPreviewModal(true);
    } else if (typeId === "invoices") {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Invoices must be 2MB or less.",
          variant: "error",
        });
        return;
      }
      setPreviewFile(file);
      setPreviewMode("invoice");
      setShowPreviewModal(true);
    }
  };

  const handleFilesSelect = useCallback(
    async (files: File[]) => {
      const results = await Promise.all(
        files.map((file) => readCvFile(file, staffList)),
      );
      setCvFiles((prev) => [...prev, ...results]);
      setShowCvModal(true);
    },
    [staffList],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
        <Section title="Upload">
          <div className="flex flex-wrap justify-center gap-3">
          {types.map((type) => (
            <div
              key={type.id}
              className="w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)] max-w-[200px]"
            >
              <FileDrop
                icon={type.icon}
                title={type.title}
                description={type.description}
                color={type.color}
                acceptedFiles={type.acceptedFiles}
                fileLimit={type.fileLimit}
                multiple={type.multiple}
                onFileSelect={
                  type.multiple
                    ? undefined
                    : (file) => handleFileSelect(file, type.id)
                }
                onFilesSelect={
                  type.multiple
                    ? (files) => {
                        void handleFilesSelect(files);
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
        </Section>

        {uploading && (
        <Card>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
          <ProgressBar value={progress} />
        </Card>
      )}

      <AddModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) setAddModalFile(null);
        }}
        cloudFunction={
          addModalCsvType === "staff" ? "importStaffCsv" : "importAgencyCsv"
        }
        storagePath={
          addModalCsvType === "staff" ? "staff_imports" : "agency_imports"
        }
        itemLabel={addModalCsvType === "staff" ? "staff" : "client"}
        itemLabelPlural={addModalCsvType === "staff" ? "staff" : "clients"}
        csvType={addModalCsvType}
        duplicateKey={addModalCsvType === "staff" ? "niNumber" : "companyName"}
        initialFile={addModalFile}
      />

      <PreviewModal
        open={showPreviewModal}
        file={previewFile}
        mode={previewMode}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewFile(null);
        }}
      />

      <CVUploadModal
        open={showCvModal}
        cvFiles={cvFiles}
        cvUploading={cvUploading}
        onOpenChange={(open) => {
          if (!cvUploading) {
            setShowCvModal(open);
            if (!open) setCvFiles([]);
          }
        }}
        onUpload={handleCvUpload}
      />
    </div>
  );
};
