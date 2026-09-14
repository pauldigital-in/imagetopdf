import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage } from "@/src/utils/storage";
import {
  deletePdfFile,
  fileExists,
  renamePdfFile,
} from "./file-ops";

export type PdfRecord = {
  id: string;
  name: string;
  uri: string;
  size: number;
  pageCount: number;
  createdAt: string; // ISO
  missing?: boolean;
};

const KEY = "recent_pdfs_v1";

type RecentPdfsValue = {
  pdfs: PdfRecord[];
  ready: boolean;
  add: (record: Omit<PdfRecord, "id" | "createdAt">) => Promise<PdfRecord>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, newName: string) => Promise<PdfRecord | null>;
  getById: (id: string) => PdfRecord | undefined;
  refresh: () => Promise<void>;
};

const RecentPdfsContext = createContext<RecentPdfsValue | null>(null);

export function useRecentPdfs() {
  const ctx = useContext(RecentPdfsContext);
  if (!ctx) throw new Error("useRecentPdfs must be used within RecentPdfsProvider");
  return ctx;
}

async function persist(list: PdfRecord[]) {
  await storage.setItem(KEY, list as any);
}

export function RecentPdfsProvider({ children }: { children: ReactNode }) {
  const [pdfs, setPdfs] = useState<PdfRecord[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const stored = await storage.getItem<PdfRecord[]>(KEY, []);
    const list = stored ?? [];
    // Verify each file still exists (handle deletions outside the app).
    const verified = await Promise.all(
      list.map(async (r) => ({ ...r, missing: !(await fileExists(r.uri)) })),
    );
    setPdfs(verified);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback<RecentPdfsValue["add"]>(async (record) => {
    const full: PdfRecord = {
      ...record,
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      createdAt: new Date().toISOString(),
      missing: false,
    };
    setPdfs((prev) => {
      const next = [full, ...prev];
      void persist(next);
      return next;
    });
    return full;
  }, []);

  const remove = useCallback<RecentPdfsValue["remove"]>(async (id) => {
    let target: PdfRecord | undefined;
    setPdfs((prev) => {
      target = prev.find((p) => p.id === id);
      const next = prev.filter((p) => p.id !== id);
      void persist(next);
      return next;
    });
    if (target) await deletePdfFile(target.uri);
  }, []);

  const rename = useCallback<RecentPdfsValue["rename"]>(async (id, newName) => {
    const current = pdfs.find((p) => p.id === id);
    if (!current) return null;
    const newUri = await renamePdfFile(current.uri, newName);
    if (!newUri) return null;
    const updated: PdfRecord = {
      ...current,
      name: newName.replace(/\.pdf$/i, ""),
      uri: newUri,
    };
    setPdfs((prev) => {
      const next = prev.map((p) => (p.id === id ? updated : p));
      void persist(next);
      return next;
    });
    return updated;
  }, [pdfs]);

  const getById = useCallback(
    (id: string) => pdfs.find((p) => p.id === id),
    [pdfs],
  );

  const value = useMemo(
    () => ({ pdfs, ready, add, remove, rename, getById, refresh }),
    [pdfs, ready, add, remove, rename, getById, refresh],
  );

  return (
    <RecentPdfsContext.Provider value={value}>
      {children}
    </RecentPdfsContext.Provider>
  );
}
