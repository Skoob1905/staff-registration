export type FileInteractionKey =
  | "invoice"
  | "staff"
  | "client"
  | "timesheet"
  | "contract";

export interface DeleteModalConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  loadingLabel?: string;
}

export const deleteModalConfig: Record<FileInteractionKey, DeleteModalConfig> = {
  invoice: {
    title: "Delete Invoice",
    message: "Are you sure you want to delete {fileName}? This action cannot be undone.",
  },
  staff: {
    title: "Remove Staff",
    message: "Are you sure you want to remove {fileName}?",
  },
  client: {
    title: "Delete Client",
    message: "Are you sure you want to delete {fileName}? All associated data will be removed.",
  },
  timesheet: {
    title: "Delete Timesheet",
    message: "Are you sure you want to delete {fileName}?",
  },
  contract: {
    title: "Delete Contract",
    message: "This will permanently delete the signed contract {fileName} from storage.",
  },
};
