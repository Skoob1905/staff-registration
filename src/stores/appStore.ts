import { create } from "zustand";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import type { Agency, BulkStaff, StaffTag, StaffType } from "../types/domain";

export interface AgencyDoc {
  id: string;
  [key: string]: unknown;
}

interface AppState {
  staff: BulkStaff[];
  staffLoaded: boolean;
  staffLoading: boolean;

  agencies: Agency[];
  agenciesLoaded: boolean;
  agenciesLoading: boolean;

  staffTypes: StaffType[];
  staffTypesLoaded: boolean;
  staffTypesLoading: boolean;

  clients: AgencyDoc[];
  clientsLoaded: boolean;
  clientsLoading: boolean;

  companyCache: Record<string, AgencyDoc>;

  logins: Record<string, unknown>[];
  loginsLoaded: boolean;
  loginsLoading: boolean;

  assignedStaff: (BulkStaff & { fullName: string })[];
  assignedStaffLoaded: boolean;
  assignedStaffLoading: boolean;

  tags: StaffTag[];
  tagsLoaded: boolean;
  tagsLoading: boolean;

  admins: Record<string, unknown>[];
  adminsLoaded: boolean;
  adminsLoading: boolean;

  loadStaff: (agencyId: string, force?: boolean) => Promise<void>;
  loadAssignedStaff: (targetAgencyId: string) => Promise<void>;
  loadAdmins: (agencyId: string, force?: boolean) => Promise<void>;
  loadAgencies: (agencyId: string, force?: boolean) => Promise<void>;
  loadStaffTypes: (force?: boolean) => Promise<void>;
  loadClients: (agencyId: string, force?: boolean) => Promise<void>;
  fetchCompanyById: (companyId: string) => Promise<AgencyDoc | undefined>;
  loadLogins: (agencyId: string, force?: boolean) => Promise<void>;
  addLogin: (login: Record<string, unknown>) => void;
  removeLogin: (id: string) => void;
  loadTags: (force?: boolean) => Promise<void>;
  addTag: (tag: StaffTag) => void;
  updateStaffInStore: (staffId: string, updates: Partial<BulkStaff>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  staff: [],
  staffLoaded: false,
  staffLoading: false,
  agencies: [],
  agenciesLoaded: false,
  agenciesLoading: false,
  staffTypes: [],
  staffTypesLoaded: false,
  staffTypesLoading: false,
  clients: [],
  clientsLoaded: false,
  clientsLoading: false,
  companyCache: {},
  logins: [],
  loginsLoaded: false,
  loginsLoading: false,
  tags: [],
  tagsLoaded: false,
  tagsLoading: false,

  admins: [],
  adminsLoaded: false,
  adminsLoading: false,

  assignedStaff: [],
  assignedStaffLoaded: false,
  assignedStaffLoading: false,

  loadStaff: async (agencyId, force) => {
    const state = get();
    if (!force && (state.staffLoaded || state.staffLoading)) {
      if (state.staffLoaded) console.log("[store] loadStaff — cache hit, skipping Firestore");
      return;
    }
    set({ staffLoading: true });
    console.log("[store] loadStaff — querying Firestore...");
    try {
      const [oldSnaps, newSnaps] = await Promise.all([
        getDocs(
          query(collection(db, "staff"), where("agencyId", "==", agencyId)),
        ),
        getDocs(
          query(
            collection(db, "staff"),
            where("metadata.uploadedBy", "==", agencyId),
          ),
        ),
      ]);
      const seen = new Set<string>();
      const loaded = [...oldSnaps.docs, ...newSnaps.docs]
        .filter((snap) => !seen.has(snap.id) && !!seen.add(snap.id))
        .map((snap) => ({ id: snap.id, ...snap.data() }) as BulkStaff);
      set({ staff: loaded, staffLoaded: true, staffLoading: false });
      console.log(`[store] loadStaff — loaded ${loaded.length} staff records`);
    } catch {
      set({ staff: [], staffLoaded: true, staffLoading: false });
      console.error("[store] loadStaff — failed");
    }
  },

  loadAssignedStaff: async (targetAgencyId) => {
    const state = get();
    if (state.assignedStaffLoaded || state.assignedStaffLoading) return;
    set({ assignedStaffLoading: true });
    try {
      const agencySnap = await getDoc(doc(db, "agencies", targetAgencyId));
      if (!agencySnap.exists()) {
        set({ assignedStaff: [], assignedStaffLoaded: true, assignedStaffLoading: false });
        return;
      }
      const agencyData = agencySnap.data() as Agency;
      const staffIds = agencyData.assignedStaff || [];
      const staffPromises = staffIds.map((id) => getDoc(doc(db, "staff", id)));
      const staffSnaps = await Promise.all(staffPromises);
      const loaded = staffSnaps
        .filter((snap) => snap.exists())
        .map((snap) => ({ id: snap.id, ...snap.data() }) as BulkStaff);

      const merged = loaded.map((s) => {
        const displayName =
          [s.Title, s.Forename, s.Surname].filter(Boolean).join(" ") ||
          s.email;
        return { ...s, fullName: displayName };
      });

      set({ assignedStaff: merged, assignedStaffLoaded: true, assignedStaffLoading: false });
      console.log(`[store] loadAssignedStaff — loaded ${merged.length} staff records`);
    } catch {
      set({ assignedStaff: [], assignedStaffLoaded: true, assignedStaffLoading: false });
      console.error("[store] loadAssignedStaff — failed");
    }
  },

  loadAdmins: async (agencyId, force) => {
    const state = get();
    if (!force && (state.adminsLoaded || state.adminsLoading)) {
      if (state.adminsLoaded) console.log("[store] loadAdmins — cache hit, skipping Firestore");
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
      if (state.agenciesLoaded) console.log("[store] loadAgencies — cache hit, skipping Firestore");
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
        agencies: snaps.docs.map((d) => ({ id: d.id, ...d.data() }) as Agency),
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

  loadStaffTypes: async (force) => {
    const state = get();
    if (!force && (state.staffTypesLoaded || state.staffTypesLoading)) {
      if (state.staffTypesLoaded) console.log("[store] loadStaffTypes — cache hit, skipping Firestore");
      return;
    }
    set({ staffTypesLoading: true });
    console.log("[store] loadStaffTypes — querying Firestore...");
    try {
      const snaps = await getDocs(collection(db, "staffType"));
      set({
        staffTypes: snaps.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as StaffType,
        ),
        staffTypesLoaded: true,
        staffTypesLoading: false,
      });
      console.log(`[store] loadStaffTypes — loaded ${snaps.docs.length} types`);
    } catch {
      set({ staffTypes: [], staffTypesLoaded: true, staffTypesLoading: false });
      console.error("[store] loadStaffTypes — failed");
    }
  },

  loadClients: async (agencyId, force) => {
    const state = get();
    if (!force && (state.clientsLoaded || state.clientsLoading)) {
      if (state.clientsLoaded) console.log("[store] loadClients — cache hit, skipping Firestore");
      return;
    }
    set({ clientsLoading: true });
    console.log("[store] loadClients — querying Firestore...");
    try {
      const [oldSnaps, newSnaps] = await Promise.all([
        getDocs(
          query(
            collection(db, "agencies"),
            where("importedByAgencyId", "==", agencyId),
          ),
        ),
        getDocs(
          query(
            collection(db, "agencies"),
            where("metadata.uploadedBy", "==", agencyId),
          ),
        ),
      ]);
      const seen = new Set<string>();
      const loaded = [...oldSnaps.docs, ...newSnaps.docs]
        .filter((snap) => !seen.has(snap.id) && !!seen.add(snap.id))
        .map((d) => ({ id: d.id, ...d.data() }) as AgencyDoc);
      set({ clients: loaded, clientsLoaded: true, clientsLoading: false });
      console.log(`[store] loadClients — loaded ${loaded.length} clients`);
    } catch {
      set({ clients: [], clientsLoaded: true, clientsLoading: false });
      console.error("[store] loadClients — failed");
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

  loadLogins: async (agencyId, force) => {
    const state = get();
    if (!force && (state.loginsLoaded || state.loginsLoading)) {
      if (state.loginsLoaded) console.log("[store] loadLogins — cache hit, skipping Firestore");
      return;
    }
    set({ loginsLoading: true });
    console.log("[store] loadLogins — querying Firestore...");
    try {
      const snaps = await getDocs(
        query(
          collection(db, "users"),
          where("invitedByAgencyId", "==", agencyId),
          where("role", "==", "client"),
        ),
      );
      const loaded = snaps.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA =
            a.invitedAt instanceof Date
              ? a.invitedAt.getTime()
              : (a.invitedAt?.toDate?.()?.getTime() ?? 0);
          const dateB =
            b.invitedAt instanceof Date
              ? b.invitedAt.getTime()
              : (b.invitedAt?.toDate?.()?.getTime() ?? 0);
          return dateA - dateB;
        });
      set({ logins: loaded, loginsLoaded: true, loginsLoading: false });
      console.log(`[store] loadLogins — loaded ${loaded.length} logins`);
    } catch {
      set({ logins: [], loginsLoaded: true, loginsLoading: false });
      console.error("[store] loadLogins — failed");
    }
  },

  addLogin: (login) => {
    set((s) => {
      if (s.logins.some((l) => l.id === login.id)) return s;
      return { logins: [login, ...s.logins] };
    });
  },

  addTag: (tag) => {
    set((s) => {
      if (s.tags.some((t) => t.id === tag.id)) return s;
      return { tags: [...s.tags, tag] };
    });
  },

  removeLogin: (id) => {
    set((s) => ({
      logins: s.logins.filter((l) => l.id !== id),
    }));
  },

  loadTags: async (force) => {
    const state = get();
    if (!force && (state.tagsLoaded || state.tagsLoading)) {
      if (state.tagsLoaded) console.log("[store] loadTags — cache hit, skipping Firestore");
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

  updateStaffInStore: (staffId, updates) => {
    set((s) => ({
      staff: s.staff.map((member) =>
        member.id === staffId ? { ...member, ...updates } : member,
      ),
    }));
  },
}));

useAppStore.subscribe((state) => {
  console.log("[store] state updated", {
    staffCount: state.staff.length,
    staffLoaded: state.staffLoaded,
    agenciesCount: state.agencies.length,
    agenciesLoaded: state.agenciesLoaded,
    staffTypesCount: state.staffTypes.length,
    staffTypesLoaded: state.staffTypesLoaded,
    clientsCount: state.clients.length,
    clientsLoaded: state.clientsLoaded,
    loginsCount: state.logins.length,
    loginsLoaded: state.loginsLoaded,
    assignedStaffCount: state.assignedStaff.length,
    assignedStaffLoaded: state.assignedStaffLoaded,
  });
});
