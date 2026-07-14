import {
  CircleCheck,
  CircleX,
  Copy,
  TriangleAlert,
} from "lucide-react";
import type { ColumnDef } from "../../components/modals/MultipleFileUpload";
import type { PayslipFile } from "../../types/domain";
import { editFileName } from "./editFileName";

const payslipColumns: ColumnDef<PayslipFile>[] = [
  {
    header: "Status",
    cell: (file) => {
      if (file.error === "size")
        return (
          <span className="inline-flex items-center gap-1 text-red-600">
            <CircleX className="h-4 w-4" /> Too large
          </span>
        );
      if (file.error === "format")
        return (
          <span className="inline-flex items-center gap-1 text-red-600">
            <CircleX className="h-4 w-4" /> Not PDF
          </span>
        );
      if (file.isDuplicate)
        return (
          <span className="inline-flex items-center gap-1 text-purple-600">
            <Copy className="h-4 w-4" /> Duplicate
          </span>
        );
      if (file.status === "matched")
        return (
          <span className="inline-flex items-center gap-1 text-green-600">
            <CircleCheck className="h-4 w-4" /> Matched
          </span>
        );
      if (file.status === "wrong info")
        return (
          <span className="inline-flex items-center gap-1 text-orange-500">
            <TriangleAlert className="h-4 w-4" /> Wrong Info
          </span>
        );
      return (
        <span className="inline-flex items-center gap-1 text-red-600">
          <CircleX className="h-4 w-4" /> Missing
        </span>
      );
    },
  },
  {
    header: "File Name",
    cell: (file) => (
      <span className={file.error || file.status === "missing" ? "text-red-600" : ""}>
        {editFileName(file.file.name)}
      </span>
    ),
  },
  {
    header: "First Name",
    cell: (file) => file.parsedFirstname || "-",
  },
  {
    header: "Last Name",
    cell: (file) => file.parsedLastname || "-",
  },
  {
    header: "Worker Ref",
    cell: (file) => file.workerRef || "-",
  },
  {
    header: "Email",
    cell: (file) => file.email || "-",
  },
];

/**
 * Returns the column definitions for the multi-file upload modal based on the
 * upload type.
 *
 * @param type - The upload type.
 * @returns An array of `ColumnDef` objects. Returns an empty array for unknown types.
 */
export function getColumns(type: string): ColumnDef<PayslipFile>[] {
  if (type === "payslip") {
    return payslipColumns;
  }
  return [];
}
