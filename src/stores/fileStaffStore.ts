import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface FileStaffEntry {
  importId: string;
  fileName: string;
  recordCount: number;
  staff: Record<string, string>[];
}

interface FileStaffState {
  fileStaffMap: Record<string, FileStaffEntry>;

  setFileStaff: (importId: string, entry: FileStaffEntry) => void;
  removeFileStaff: (importId: string) => void;
  clear: () => void;
}

export const useFileStaffStore = create<FileStaffState>()(
  devtools((set) => ({
  fileStaffMap: {},

  setFileStaff: (importId, entry) =>
    set((state) => ({
      fileStaffMap: { ...state.fileStaffMap, [importId]: entry },
    })),

  removeFileStaff: (importId) =>
    set((state) => {
      const { [importId]: _, ...rest } = state.fileStaffMap;
      return { fileStaffMap: rest };
    }),

  clear: () => set({ fileStaffMap: {} }),
  })),
);
