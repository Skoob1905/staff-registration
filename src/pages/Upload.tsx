import {
  type ElementType,
  useCallback,
  useEffect,
  useState,
} from "react";
import { httpsCallable } from "firebase/functions";
import {
  Building2,
  Clock,
  FileSignature,
  FileText,
  FileUser,
  Users,
} from "lucide-react";
import { AddModal } from "../components/AddModal";
import { FileDrop } from "../components/FileDrop";
import { PreviewModal } from "../components/PreviewModal";
import { CVUploadModal } from "../components/CVUploadModal";
import { Section } from "../components/Section";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { functions } from "../services/firebase";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { readCvFile, type CvFile } from "../utils/cvUpload";
import {
  hasNIColumn,
  hasBusinessNameColumn,
} from "../utils/keyHeaderNormalisation";
import type { BulkStaff } from "../types/domain";

const ALGOLIA_INDEX_PREFIX = import.meta.env.VITE_ALGOLIA_INDEX_PREFIX ?? "";
const FILE_SIZE_LIMIT = 209715200;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function parseCsvHeaders(text: string): string[] {
  const firstLine = text.trim().split("\n")[0];
  if (!firstLine) return [];
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

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
    description: "Bulk import your staff",
    color: "#4A90D9",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
  {
    id: "clients",
    icon: Building2,
    title: "Clients",
    description: "Bulk import your clients",
    color: "#34A853",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
  {
    id: "contracts",
    icon: FileSignature,
    title: "Contracts",
    description: "Upload a contract against a client",
    color: "#FB8C00",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB",
  },
  {
    id: "invoices",
    icon: FileText,
    title: "Invoices",
    description: "Upload an invoice a client to pay",
    color: "#E91E63",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB",
  },
  {
    id: "cvs",
    icon: FileUser,
    title: "CVs",
    description: "Bulk upload your staffs CV's",
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
    description: "Upload your timesheet",
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

  const [cvUploading, setCvUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalFile, setAddModalFile] = useState<File | null>(null);
  const [addModalCsvType, setAddModalCsvType] = useState<"staff" | "agency" | "timesheet">(
    "staff",
  );

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewMode, setPreviewMode] = useState<"invoice" | "contract">(
    "invoice",
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [cvFiles, setCvFiles] = useState<CvFile[]>([]);
  const [showCvModal, setShowCvModal] = useState(false);

  const { items: staffList } = usePaginatedRecords<BulkStaff>({
    indexName: "staff_name_desc",
    agencyId: appUser?.agencyId ?? "",
    hitsPerPage: 10000,
  });


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

      const text = await file.text();
      const headers = parseCsvHeaders(text);

      if (typeId === "staff") {
        if (!hasNIColumn(headers)) {
          toast({
            title: "Invalid Staff Upload",
            description:
              "No NI Number column found. Ensure your CSV has a column like 'NI Number', 'NINO', or 'National Insurance Number'.",
            variant: "error",
          });
          return;
        }
        setAddModalFile(file);
        setAddModalCsvType("staff");
        setShowAddModal(true);
      } else {
        if (!hasBusinessNameColumn(headers)) {
          toast({
            title: "Invalid Client Upload",
            description:
              "No Business Name column found. Ensure your CSV has a column like 'Business Name', 'Company', or 'Client'.",
            variant: "error",
          });
          return;
        }
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

      setAddModalFile(file);
      setAddModalCsvType("timesheet");
      setShowAddModal(true);
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
                feint={type.id === "timesheets"}
                noScale={type.id === "timesheets"}
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

      <AddModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) setAddModalFile(null);
        }}
        cloudFunction={
          addModalCsvType === "timesheet"
            ? "recordTimesheetUpload"
            : addModalCsvType === "staff"
              ? "importStaffCsv"
              : "importAgencyCsv"
        }
        storagePath={
          addModalCsvType === "timesheet"
            ? "timesheet_imports"
            : addModalCsvType === "staff"
              ? "staff_imports"
              : "agency_imports"
        }
        itemLabel={
          addModalCsvType === "timesheet"
            ? "timesheet"
            : addModalCsvType === "staff"
              ? "staff"
              : "client"
        }
        itemLabelPlural={
          addModalCsvType === "timesheet"
            ? "timesheets"
            : addModalCsvType === "staff"
              ? "staff"
              : "clients"
        }
        csvType={addModalCsvType}
        duplicateKey={
          addModalCsvType === "timesheet"
            ? "fileName"
            : addModalCsvType === "staff"
              ? "niNumber"
              : "companyName"
        }
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
