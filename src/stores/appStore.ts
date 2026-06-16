import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { getStaffName } from "../utils/keyHeaderNormalisation";
import { toDate } from "../utils/date";
import type { Agency, BulkStaff, StaffTag } from "../types/domain";

export interface CsvImport {
  id: string;
  fileName: string;
  fileUrl: string | null;
  recordCount: number;
  importedByUid: string;
  importedByEmail?: string | null;
  importedAt?: Date | { toDate?: () => Date };
  type?: string;
}

export interface AgencyDoc {
  id: string;
  [key: string]: unknown;
}

interface AppState {
  agencies: Agency[];
  agenciesLoaded: boolean;
  agenciesLoading: boolean;

  companyCache: Record<string, AgencyDoc>;

  assignedStaff: (BulkStaff & { fullName: string })[];
  assignedStaffLoaded: boolean;
  assignedStaffLoading: boolean;

  tags: StaffTag[];
  tagsLoaded: boolean;
  tagsLoading: boolean;

  admins: Record<string, unknown>[];
  adminsLoaded: boolean;
  adminsLoading: boolean;

  loadAssignedStaff: (targetAgencyId: string) => Promise<void>;
  loadAdmins: (agencyId: string, force?: boolean) => Promise<void>;
  loadAgencies: (agencyId: string, force?: boolean) => Promise<void>;
  fetchCompanyById: (companyId: string) => Promise<AgencyDoc | undefined>;
  loadTags: (force?: boolean) => Promise<void>;
  addTag: (tag: StaffTag) => void;

  importHistoryCache: Record<string, CsvImport[]>;
  importHistoryCacheLoaded: Record<string, boolean>;
  loadImportHistory: (type?: string, force?: boolean) => Promise<void>;
  addImportEntry: (type: string | undefined, entry: CsvImport) => void;
  removeImportEntry: (type: string | undefined, importId: string) => void;
  clearImportHistoryCache: () => void;
}

export const useAppStore = create<AppState>()(
  devtools((set, get) => ({
    agencies: [],
    agenciesLoaded: false,
    agenciesLoading: false,
    companyCache: {},
    tags: [],
    tagsLoaded: false,
    tagsLoading: false,

    admins: [],
    adminsLoaded: false,
    adminsLoading: false,

    assignedStaff: [],
    assignedStaffLoaded: false,
    assignedStaffLoading: false,

    importHistoryCache: {},
    importHistoryCacheLoaded: {},

    loadAssignedStaff: async (targetAgencyId) => {
      const state = get();
      if (state.assignedStaffLoaded || state.assignedStaffLoading) return;
      set({ assignedStaffLoading: true });
      try {
        const agencySnap = await getDoc(doc(db, "agencies", targetAgencyId));
        if (!agencySnap.exists()) {
          set({
            assignedStaff: [],
            assignedStaffLoaded: true,
            assignedStaffLoading: false,
          });
          return;
        }
        const agencyData = agencySnap.data() as Agency;
        const staffIds = agencyData.assignedStaff || [];
        const staffPromises = staffIds.map((id) =>
          getDoc(doc(db, "staff", id)),
        );
        const staffSnaps = await Promise.all(staffPromises);
        const loaded = staffSnaps
          .filter((snap) => snap.exists())
          .map((snap) => ({ id: snap.id, ...snap.data() }) as BulkStaff);

        const merged = loaded.map((s) => {
          return { ...s, fullName: getStaffName(s) };
        });

        set({
          assignedStaff: merged,
          assignedStaffLoaded: true,
          assignedStaffLoading: false,
        });
        console.log(
          `[store] loadAssignedStaff — loaded ${merged.length} staff records`,
        );
      } catch {
        set({
          assignedStaff: [],
          assignedStaffLoaded: true,
          assignedStaffLoading: false,
        });
        console.error("[store] loadAssignedStaff — failed");
      }
    },

    loadAdmins: async (agencyId, force) => {
      const state = get();
      if (!force && (state.adminsLoaded || state.adminsLoading)) {
        if (state.adminsLoaded)
          console.log("[store] loadAdmins — cache hit, skipping Firestore");
        return;
      }
      set({ adminsLoading: true });
      console.log("[store] loadAdmins — querying Firestore...");
      try {
        const snaps = await getDocs(
          query(
            collection(db, "users"),
            where("agencyId", "==", agencyId),
            where("role", "==", "admin"),
          ),
        );
        set({
          admins: snaps.docs.map((d) => ({ id: d.id, ...d.data() })),
          adminsLoaded: true,
          adminsLoading: false,
        });
        console.log(`[store] loadAdmins — loaded ${snaps.docs.length} admins`);
      } catch {
        set({ admins: [], adminsLoaded: true, adminsLoading: false });
        console.error("[store] loadAdmins — failed");
      }
    },

    loadAgencies: async (agencyId, force) => {
      const state = get();
      if (!force && (state.agenciesLoaded || state.agenciesLoading)) {
        if (state.agenciesLoaded)
          console.log("[store] loadAgencies — cache hit, skipping Firestore");
        return;
      }
      set({ agenciesLoading: true });
      console.log("[store] loadAgencies — querying Firestore...");
      try {
        const snaps = await getDocs(
          query(
            collection(db, "agencies"),
            where("importedByAgencyId", "==", agencyId),
          ),
        );
        set({
          agencies: snaps.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Agency,
          ),
          agenciesLoaded: true,
          agenciesLoading: false,
        });
        console.log(
          `[store] loadAgencies — loaded ${snaps.docs.length} agencies`,
        );
      } catch {
        set({ agencies: [], agenciesLoaded: true, agenciesLoading: false });
        console.error("[store] loadAgencies — failed");
      }
    },

    fetchCompanyById: async (companyId) => {
      const state = get();
      if (state.companyCache[companyId]) {
        return state.companyCache[companyId];
      }
      try {
        const snap = await getDoc(doc(db, "agencies", companyId));
        if (!snap.exists()) return undefined;
        const company = { id: snap.id, ...snap.data() } as AgencyDoc;
        set((s) => ({
          companyCache: { ...s.companyCache, [companyId]: company },
        }));
        return company;
      } catch {
        console.error("[store] fetchCompanyById — failed", companyId);
        return undefined;
      }
    },

    addTag: (tag) => {
      set((s) => {
        if (s.tags.some((t) => t.id === tag.id)) return s;
        return { tags: [...s.tags, tag] };
      });
    },

    loadTags: async (force) => {
      const state = get();
      if (!force && (state.tagsLoaded || state.tagsLoading)) {
        if (state.tagsLoaded)
          console.log("[store] loadTags — cache hit, skipping Firestore");
        return;
      }
      set({ tagsLoading: true });
      console.log("[store] loadTags — querying Firestore...");
      try {
        const snaps = await getDocs(collection(db, "tags"));
        set({
          tags: snaps.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffTag),
          tagsLoaded: true,
          tagsLoading: false,
        });
        console.log(`[store] loadTags — loaded ${snaps.docs.length} tags`);
      } catch {
        set({ tags: [], tagsLoaded: true, tagsLoading: false });
        console.error("[store] loadTags — failed");
      }
    },

    loadImportHistory: async (type, force) => {
      const cacheKey = type ?? "all";
      const state = get();
      if (!force && state.importHistoryCacheLoaded[cacheKey]) {
        return;
      }
      try {
        const constraints: import("firebase/firestore").QueryConstraint[] = [];
        if (type) constraints.push(where("type", "==", type));
        const q = query(collection(db, "csv_imports"), ...constraints);
        const snaps = await getDocs(q);
        const items = snaps.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CsvImport, "id">),
        }));
        items.sort((a, b) => {
          const dateA = toDate(a.importedAt)?.getTime() ?? 0;
          const dateB = toDate(b.importedAt)?.getTime() ?? 0;
          return dateB - dateA;
        });
        set((s) => ({
          importHistoryCache: {
            ...s.importHistoryCache,
            [cacheKey]: items.slice(0, 20),
          },
          importHistoryCacheLoaded: {
            ...s.importHistoryCacheLoaded,
            [cacheKey]: true,
          },
        }));
      } catch (err) {
        console.error("[store] loadImportHistory — failed", err);
        set((s) => ({
          importHistoryCacheLoaded: {
            ...s.importHistoryCacheLoaded,
            [cacheKey]: true,
          },
        }));
      }
    },

    addImportEntry: (type, entry) => {
      const cacheKey = type ?? "all";
      set((s) => {
        const entries = s.importHistoryCache[cacheKey] ?? [];
        const exists = entries.some((e) => e.id === entry.id);
        if (exists) return s;
        const updated = [entry, ...entries]
          .sort((a, b) => {
            const dateA = toDate(a.importedAt)?.getTime() ?? 0;
            const dateB = toDate(b.importedAt)?.getTime() ?? 0;
            return dateB - dateA;
          })
          .slice(0, 20);
        return {
          importHistoryCache: {
            ...s.importHistoryCache,
            [cacheKey]: updated,
          },
          importHistoryCacheLoaded: {
            ...s.importHistoryCacheLoaded,
            [cacheKey]: true,
          },
        };
      });
    },

    removeImportEntry: (type, importId) => {
      const cacheKey = type ?? "all";
      set((s) => {
        const entries = s.importHistoryCache[cacheKey] ?? [];
        return {
          importHistoryCache: {
            ...s.importHistoryCache,
            [cacheKey]: entries.filter((e) => e.id !== importId),
          },
        };
      });
    },

    clearImportHistoryCache: () => {
      set({ importHistoryCache: {}, importHistoryCacheLoaded: {} });
    },
  })),
);

useAppStore.subscribe((state) => {
  console.log("[store] state updated", {
    agenciesCount: state.agencies.length,
    agenciesLoaded: state.agenciesLoaded,
    assignedStaffCount: state.assignedStaff.length,
    assignedStaffLoaded: state.assignedStaffLoaded,
  });
});
