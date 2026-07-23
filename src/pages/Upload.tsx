import { type ElementType, useCallback, useEffect, useState } from "react";
import {
  Building2,
  Clock,
  FolderOpen,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";
import { AddModal } from "../components/AddModal";
import { FileDrop } from "../components/FileDrop";
import {
  MultipleFileUploadModal,
  PreviewModal,
  type SummaryItem,
} from "../components/modals";
import { Section } from "../components/Section";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { callBulkUploadPayslips } from "../services/payslipService";
import { editFileName } from "../utils/fileUpload/editFileName";
import { checkDuplicatePayslip } from "../utils/payslipDuplicateCheck";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { PayslipFile } from "../types/domain";
import { toast_mapper, ToastType } from "../config/toast";
import {
  hasWorkerRefColumn,
  hasAgencyRefColumn,
  hasClientRefColumn,
} from "../utils/keyHeaderNormalisation";
import { readPayslipFile } from "../utils/readPayslipFile";
import { getColumns } from "../utils/fileUpload/columns";

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

const SUPER_TYPES: UploadType[] = [
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
    id: "agencies",
    icon: Building2,
    title: "Agencies",
    description: "Bulk import agencies",
    color: "#34A853",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
  {
    id: "clients",
    icon: Building2,
    title: "Clients",
    description: "Bulk import clients",
    color: "#9C27B0",
    acceptedFiles: ".csv",
    fileLimit: "Max 2MB",
  },
  {
    id: "documents",
    icon: FolderOpen,
    title: "Documents",
    description: "Upload a staff document",
    color: "#FB8C00",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB",
  },
  {
    id: "invoices",
    icon: Receipt,
    title: "Invoices",
    description: "Upload an invoice for your client.",
    color: "#7C3AED",
    acceptedFiles: ".pdf,.docx",
    fileLimit: "Max 2MB",
  },
  {
    id: "payslips",
    icon: ScrollText,
    title: "Payslips",
    description: "Upload payslip(s) for staff",
    color: "#E65100",
    acceptedFiles: ".pdf",
    fileLimit: "Max 2MB each",
    multiple: true,
  },
];

const ADMIN_TYPES: UploadType[] = [];

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

export const Upload = () => {
  useEffect(() => {
    document.title = "Upload";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const isSuper = appUser?.role === "super";
  const isAdmin = appUser?.role === "admin";
  const types = isSuper ? SUPER_TYPES : isAdmin ? ADMIN_TYPES : CLIENT_TYPES;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalFile, setAddModalFile] = useState<File | null>(null);
  const [addModalCsvType, setAddModalCsvType] = useState<
    "staff" | "agency" | "client" | "timesheet"
  >("staff");

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "invoice" | "contract" | "payslip" | "document"
  >("invoice");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [payslipFiles, setPayslipFiles] = useState<PayslipFile[]>([]);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [uploadingPayslips, setUploadingPayslips] = useState(false);

  const handlePayslips = useCallback(
    async (files: File[]) => {
      if (files.length === 1) {
        const file = files[0];
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: "Payslip must be 2MB or less.",
            variant: "error",
          });
          return;
        }
        setPreviewFile(file);
        setPreviewMode("payslip");
        setShowPreviewModal(true);
        return;
      }

      const results = await Promise.all(files.map((f) => readPayslipFile(f)));

      const fetchExistingNames = async (
        workerRef: string,
      ): Promise<string[]> => {
        const snapshot = await getDocs(
          query(
            collection(db, "payslips"),
            where("userId", "==", workerRef.toUpperCase()),
          ),
        );
        return snapshot.docs.map(
          (doc) => (doc.data() as { fileName?: string }).fileName ?? "",
        );
      };

      const checkItems = results
        .filter((r) => r.workerRef)
        .map((r) => ({
          workerRef: r.workerRef,
          displayName: editFileName(r.file.name),
        }));

      const checked = await checkDuplicatePayslip(
        checkItems,
        fetchExistingNames,
      );

      const merged = results.map((r) => ({
        ...r,
        isDuplicate: checked.some(
          (c) =>
            c.workerRef === r.workerRef &&
            c.displayName === editFileName(r.file.name) &&
            c.isDuplicate,
        ),
      }));

      setPayslipFiles(merged);
      setShowPayslipModal(true);
    },
    [toast],
  );

  const handlePayslipUpload = async () => {
    const eligible = payslipFiles.filter(
      (f) => !f.error && !f.isDuplicate && f.status !== "missing" && f.base64,
    );
    if (eligible.length === 0) return;

    setUploadingPayslips(true);

    toast(toast_mapper[ToastType.PAYSLIP_UPLOAD_START](eligible.length));

    const entries = eligible.map((f) => ({
      fileBase64: f.base64,
      fileName: editFileName(f.file.name),
      userId: f.workerRef.toUpperCase(),
      agencyId: f.agencyId ?? "",
    }));

    try {
      const { results, queued } = await callBulkUploadPayslips(entries);

      setShowPayslipModal(false);
      setPayslipFiles([]);

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.length - succeeded;

      if (failed === 0) {
        toast(
          toast_mapper[ToastType.PAYSLIP_UPLOAD_COMPLETE](
            succeeded,
            results.length,
          ),
        );
      } else {
        toast(
          toast_mapper[ToastType.PAYSLIP_UPLOAD_PARTIAL](
            succeeded,
            results.length,
            failed,
          ),
        );
      }

      if (queued > 0) {
        toast(toast_mapper[ToastType.EMAILS_QUEUED](queued));
      }

      setUploadingPayslips(false);
    } catch {
      toast(toast_mapper[ToastType.UPLOAD_FAILED]("Bulk upload failed."));
      setUploadingPayslips(false);
    }
  };

  const handleFileSelect = async (file: File, typeId: string) => {
    if (typeId === "staff" || typeId === "agencies" || typeId === "clients") {
      const typeLabel =
        typeId === "staff"
          ? "Staff"
          : typeId === "agencies"
            ? "Agency"
            : "Client";
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${typeLabel} CSV must be 2MB or less.`,
          variant: "error",
        });
        return;
      }

      const text = await file.text();
      const headers = parseCsvHeaders(text);

      if (typeId === "staff") {
        if (!hasWorkerRefColumn(headers)) {
          toast({
            title: "Missing Worker Ref",
            description:
              "The CSV has no Ref, Reference, or Workers Ref column — staff IDs will be auto-generated.",
            variant: "error",
          });
          return;
        }
        setAddModalFile(file);
        setAddModalCsvType("staff");
        setShowAddModal(true);
      } else if (typeId === "agencies") {
        if (!hasAgencyRefColumn(headers)) {
          toast({
            title: "Invalid Agency Upload",
            description:
              "No Ref column found. Ensure your CSV has a column like 'Ref' or 'Reference'.",
            variant: "error",
          });
          return;
        }
        setAddModalFile(file);
        setAddModalCsvType("agency");
        setShowAddModal(true);
      } else {
        if (!hasClientRefColumn(headers)) {
          toast({
            title: "Invalid Client Upload",
            description:
              "No Ref column found. Ensure your CSV has a column like 'Ref' or 'Reference'.",
            variant: "error",
          });
          return;
        }
        setAddModalFile(file);
        setAddModalCsvType("client");
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
    } else if (typeId === "documents") {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Document must be 2MB or less.",
          variant: "error",
        });
        return;
      }
      setPreviewFile(file);
      setPreviewMode("document");
      setShowPreviewModal(true);
    }
  };

  const matchedCount = payslipFiles.filter(
    (f) => f.status === "matched" && !f.error && !f.isDuplicate,
  ).length;
  const wrongInfoCount = payslipFiles.filter(
    (f) => f.status === "wrong info" && !f.error && !f.isDuplicate,
  ).length;
  const duplicateCount = payslipFiles.filter(
    (f) => f.isDuplicate && !f.error,
  ).length;
  const missingCount = payslipFiles.filter(
    (f) => f.status === "missing" && !f.error,
  ).length;
  const uploadableCount = payslipFiles.filter(
    (f) => !f.error && !f.isDuplicate && f.status !== "missing" && f.base64,
  ).length;

  const payslipSummaryItems: SummaryItem[] = [
    { label: "Matched", count: matchedCount, className: "text-green-600" },
    {
      label: "Wrong Info",
      count: wrongInfoCount,
      className: "text-orange-500",
    },
    ...(duplicateCount > 0
      ? [
          {
            label: "Duplicates",
            count: duplicateCount,
            className: "text-purple-600",
          },
        ]
      : []),
    { label: "Missing", count: missingCount, className: "text-red-600" },
  ];

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
                  type.id === "payslips"
                    ? handlePayslips
                    : type.multiple
                      ? (_files: File[]) => undefined
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
              : addModalCsvType === "agency"
                ? "importAgencyCsv"
                : "importClientCsv"
        }
        storagePath={
          addModalCsvType === "timesheet"
            ? "timesheet_imports"
            : addModalCsvType === "staff"
              ? "staff"
              : addModalCsvType === "agency"
                ? "agencies"
                : "clients"
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

      <MultipleFileUploadModal
        open={showPayslipModal}
        onOpenChange={setShowPayslipModal}
        title="Upload Payslips"
        itemLabel="Payslip"
        files={payslipFiles}
        columns={getColumns("payslip")}
        summaryItems={payslipSummaryItems}
        uploadableCount={uploadableCount}
        getFileName={(f) => f.file.name}
        isError={(f) => !!(f.error || f.status === "missing")}
        onUpload={handlePayslipUpload}
        displayTotal={payslipFiles.length - duplicateCount}
        loading={uploadingPayslips}
      />
    </div>
  );
};
