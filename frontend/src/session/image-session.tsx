import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SessionImage = {
  id: string;
  uri: string;
  width: number;
  height: number;
};

type ImageSessionValue = {
  images: SessionImage[];
  add: (items: Omit<SessionImage, "id">[]) => void;
  remove: (id: string) => void;
  reorder: (next: SessionImage[]) => void;
  update: (id: string, patch: Partial<Omit<SessionImage, "id">>) => void;
  clear: () => void;
};

const ImageSessionContext = createContext<ImageSessionValue | null>(null);

export function useImageSession() {
  const ctx = useContext(ImageSessionContext);
  if (!ctx) throw new Error("useImageSession must be used within ImageSessionProvider");
  return ctx;
}

let counter = 0;
function newId() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export function ImageSessionProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<SessionImage[]>([]);

  const add = useCallback((items: Omit<SessionImage, "id">[]) => {
    setImages((prev) => [
      ...prev,
      ...items.map((it) => ({ ...it, id: newId() })),
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const reorder = useCallback((next: SessionImage[]) => {
    setImages(next);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Omit<SessionImage, "id">>) => {
      setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    [],
  );

  const clear = useCallback(() => setImages([]), []);

  const value = useMemo(
    () => ({ images, add, remove, reorder, update, clear }),
    [images, add, remove, reorder, update, clear],
  );

  return (
    <ImageSessionContext.Provider value={value}>
      {children}
    </ImageSessionContext.Provider>
  );
}
