import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Upload } from "lucide-react";
import { Body, BodyMedium, Caption, Muted } from "../config/typography";
import { AssignModal } from "./AssignModal";
import { Button, DialogContent, DialogRoot, DialogTitle } from "./ui";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { functions, storage } from "../services/firebase";
import { useFileStaffStore } from "../stores/fileStaffStore";
import { useAppStore } from "../stores/appStore";
import {
  normalizeKey,
  findValueByNormalizedKey,
  hasNIColumn,
  hasBusinessNameColumn,
} from "../utils/keyHeaderNormalisation";

type CsvRow = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
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
  };

  const rawHeaders = parseLine(lines[0]);
  const seen = new Set<string>();
  const headers: string[] = [];
  const headerIndices: number[] = [];
  rawHeaders.forEach((h, idx) => {
    if (!seen.has(h)) {
      seen.add(h);
      headers.push(h);
      headerIndices.push(idx);
    }
  });

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 1 && values[0] === "") continue;
    const row: CsvRow = {};
    headerIndices.forEach((rawIdx, mappedIdx) => {
      row[headers[mappedIdx]] = values[rawIdx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

interface AddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloudFunction: string;
  storagePath: string;
  itemLabel: string;
  itemLabelPlural: string;
  csvType?: string;
  duplicateKey: string;
  onSuccess?: (importId?: string) => Promise<void>;
  clients?: { id: string; name: string }[];
  confirmText?: (additions: number) => string;
}

export const AddModal = ({
  open,
  onOpenChange,
  cloudFunction,
  storagePath,
  itemLabel,
  itemLabelPlural,
  csvType,
  onSuccess,
  confirmText,
}: AddModalProps) => {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (open) loadTags(true).catch(() => {});
  }, [open, loadTags]);

  const clientFacetFilters = useMemo(
    () => isAdmin ? [] : [[`metadata.uploadedBy:${appUser?.agencyId ?? ""}`]],
    [isAdmin, appUser?.agencyId],
  );

  const { items: clients } = usePaginatedRecords({
    indexName: "clients_name_desc",
    agencyId: isAdmin ? "all" : (appUser?.agencyId ?? ""),
    facetFilters: clientFacetFilters,
    hitsPerPage: 1000,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: CsvRow[];
    fileName: string;
    rawFile: File;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<
    string | undefined
  >();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const hasAssignment =
    selectedClientId !== undefined || selectedTagIds.length > 0;

  const selectedClientName = useMemo(() => {
    if (!selectedClientId) return "";
    const c = clients.find((c) => c.id === selectedClientId);
    if (!c) return "Unknown";
    return (
      (c.name as string) ||
      (c.business_name as string) ||
      (c.Company_Name as string) ||
      (c.company_name as string) ||
      (c.agencyName as string) ||
      findValueByNormalizedKey(
        c as Record<string, unknown>,
        "businessname",
        "companyname",
        "name",
        "agencyname",
        "organisation",
        "company",
      ) ||
      "Unknown"
    );
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (loading) {
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
  }, [loading, toast]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file.",
        variant: "error",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        toast({
          title: "Empty CSV",
          description: "The CSV file has no headers.",
          variant: "error",
        });
        return;
      }
      if (!parsed.rows.length) {
        toast({
          title: "Empty CSV",
          description:
            "The CSV has headers but no data rows. Add data and try again.",
          variant: "error",
        });
        return;
      }

      if (csvType === "staff") {
        const normalizedHeaders = parsed.headers.map(normalizeKey);
        if (!hasNIColumn(parsed.headers)) {
          console.warn(
            "[AddModal] No NI column found. Headers:",
            parsed.headers,
          );
          toast({
            title: "Invalid staff file",
            description: "The CSV must contain an NI Number column.",
            variant: "error",
          });
          return;
        }
        const hasForename = normalizedHeaders.some(
          (h) => h === "forename" || h === "firstname",
        );
        const hasSurname = normalizedHeaders.some(
          (h) => h === "surname" || h === "lastname",
        );
        const hasFullName = normalizedHeaders.some((h) => h === "fullname");
        if (!(hasForename && hasSurname) && !hasFullName) {
          toast({
            title: "Invalid staff file",
            description:
              "The CSV must contain First Name + Surname columns, or a Full Name column.",
            variant: "error",
          });
          return;
        }
      }

      if (csvType === "agency") {
        if (!hasBusinessNameColumn(parsed.headers)) {
          toast({
            title: "Invalid client file",
            description:
              "The CSV must contain a Company/Company Name/Business/Business Name column.",
            variant: "error",
          });
          return;
        }
      }

      setCsvData({ ...parsed, fileName: file.name, rawFile: file });
    };
    reader.readAsText(file);
  };

  const onUpload = async () => {
    if (!csvData || !appUser) return;
    setLoading(true);
    setUploadProgress(0);
    setProcessing(false);
    try {
      const path = `${storagePath}/${appUser.agencyId}/${Date.now()}-${csvData.fileName}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, csvData.rawFile);
      task.on("state_changed", (snapshot) => {
        const raw = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        setUploadProgress(Math.min(raw, 90));
      });
      await task;
      setProcessing(true);
      const fileUrl = await getDownloadURL(storageRef);

      const recordsToSend = csvData.rows;

      const callable = httpsCallable(functions, cloudFunction);
      const selectedCompany = selectedClientId
        ? clients.find((c) => c.id === selectedClientId)
        : null;
      const result = await callable({
        records: recordsToSend,
        totalRecords: csvData.rows.length,
        fileName: csvData.fileName,
        fileUrl,
        ...(selectedCompany
          ? {
              assignedToId: selectedCompany.id,
              assignedToName:
                (selectedCompany.business_name as string) ||
                (selectedCompany.name as string) ||
                (selectedCompany.Company_Name as string) ||
                (selectedCompany.company_name as string) ||
                (selectedCompany.agencyName as string) ||
                findValueByNormalizedKey(
                  selectedCompany as Record<string, unknown>,
                  "businessname",
                  "name",
                  "agencyname",
                  "organisation",
                  "company",
                ) ||
                "Unknown",
            }
          : {}),
        ...(selectedTagIds.length > 0 ? { tagIds: selectedTagIds } : {}),
      });
      setProcessing(false);

      const data = result.data as {
        added: number;
        duplicates: number;
        importId?: string;
      };

      if (data.importId && recordsToSend.length > 0) {
        useFileStaffStore.getState().setFileStaff(data.importId, {
          importId: data.importId,
          fileName: csvData.fileName,
          recordCount: recordsToSend.length,
          staff: recordsToSend,
        });
        useAppStore.getState().addImportEntry(csvType, {
          id: data.importId,
          fileName: csvData.fileName,
          fileUrl,
          recordCount: data.added,
          importedByUid: appUser.uid,
          importedByEmail: appUser.email,
          importedAt: new Date(),
          type: csvType,
        });
      }

      const dupMsg =
        data.duplicates > 0
          ? ` with ${data.duplicates} duplicate${data.duplicates === 1 ? "" : "s"}`
          : "";

      toast({
        title: "File uploaded",
        description: `${data.added} ${data.added === 1 ? itemLabel : itemLabelPlural} added${dupMsg}.`,
        replaceToast: true,
      });
      setUploadProgress(0);
      setCsvData(null);
      setSelectedClientId(undefined);
      setSelectedTagIds([]);
      onOpenChange(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await onSuccess?.(data.importId);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Upload failed. Please try again.";
      toast({
        title: "Upload failed",
        description: message,
        variant: "error",
        replaceToast: true,
      });
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  };

  const csvDupInfo = useMemo(() => {
    if (!csvData) return { total: 0 };
    return { total: csvData.rows.length };
  }, [csvData]);

  return (
    <>
      <DialogRoot
        open={open}
        onOpenChange={(o) => {
          if (o !== false || !loading) onOpenChange(o);
        }}
      >
        <DialogContent
          closeDisabled={loading}
          onClose={() => {
            if (loading) return;
            onOpenChange(false);
            setCsvData(null);
            setUploadProgress(0);
            setSelectedClientId(undefined);
            setSelectedTagIds([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className={`max-w-none flex flex-col overflow-hidden ${
            csvData
              ? "max-sm:w-[90vw] max-sm:h-[80vh] sm:w-[80vw] sm:h-[60vh]"
              : "max-sm:w-[95vw] sm:max-w-lg"
          }`}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Bulk Upload
          </DialogTitle>

          {!csvData ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 transition ${
                dragOver
                  ? "border-[var(--primary)] bg-[color:rgba(0,95,87,0.06)]"
                  : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[color:rgba(0,95,87,0.04)]"
              }`}
            >
              <Upload className="h-6 w-6 text-[var(--muted-foreground)]" />
              <BodyMedium>Drop your CSV here or click to browse</BodyMedium>
              <Caption>Only .csv files are accepted</Caption>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          ) : null}

          {csvData ? (
            <div className="mt-4 flex flex-1 min-h-0 flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">{csvData.fileName}</h3>
                <Muted as="span">
                  {csvDupInfo.total} {itemLabelPlural}
                </Muted>
              </div>

              <div className="mt-2 flex-1 min-h-0 overflow-auto rounded-xl border border-[var(--border)]">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[color:rgba(0,95,87,0.06)]">
                      {csvData.headers.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 font-medium text-[var(--foreground)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        {csvData.headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-2 text-[var(--muted-foreground)]"
                          >
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {loading && uploadProgress > 0 ? (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-[color:rgba(0,95,87,0.15)]">
                    <div
                      className="h-2 rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <Caption className="mt-1">
                    {processing
                      ? "Processing..."
                      : `Uploading... ${uploadProgress}%`}
                  </Caption>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div>
                  {csvType === "staff" && hasAssignment && (
                    <Body as="div">
                      {selectedTagIds.length > 0 && (
                        <div>
                          <span className="font-semibold">Tags:</span>{" "}
                          {selectedTagIds
                            .map((id) => tagsMap[id] || id)
                            .join(", ")}
                        </div>
                      )}
                      {selectedClientId && (
                        <div>
                          <span className="font-semibold">Client:</span>{" "}
                          {selectedClientName}
                        </div>
                      )}
                    </Body>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {csvType === "staff" && (
                    <Button
                      type="button"
                      disabled={loading}
                      onClick={() => setShowAssignModal(true)}
                    >
                      {hasAssignment ? "Edit" : "Auto-Assign"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={() => void onUpload()}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Importing...
                      </span>
                    ) : confirmText ? (
                      confirmText(csvDupInfo.total)
                    ) : (
                      `Import ${csvDupInfo.total} record(s)`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>

      <AssignModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        clients={clients.map((c) => ({
          id: c.id as string,
          name:
            (c.name as string) ||
            (c.business_name as string) ||
            (c.Company_Name as string) ||
            (c.company_name as string) ||
            (c.agencyName as string) ||
            findValueByNormalizedKey(
              c as Record<string, unknown>,
              "businessname",
              "name",
              "agencyname",
              "organisation",
              "company",
            ) ||
            "Unknown",
        }))}
        tags={tags}
        selectedClientId={selectedClientId}
        selectedTagIds={selectedTagIds}
        onConfirm={(clientId, tagIds) => {
          setSelectedClientId(clientId);
          setSelectedTagIds(tagIds);
        }}
      />
    </>
  );
};
