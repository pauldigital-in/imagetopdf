import { storage } from "@/src/utils/storage";
import type { Orientation, PageSize, Quality } from "@/src/config/defaults";

export type PdfDefaults = {
  quality: Quality;
  pageSize: PageSize;
  orientation: Orientation;
};

const KEY = "pdf_defaults_v1";

export async function getPdfDefaults(fallback: PdfDefaults): Promise<PdfDefaults> {
  const v = await storage.getItem<PdfDefaults | null>(KEY, null);
  if (!v) return fallback;
  return {
    quality: v.quality ?? fallback.quality,
    pageSize: v.pageSize ?? fallback.pageSize,
    orientation: v.orientation ?? fallback.orientation,
  };
}

export async function savePdfDefaults(v: PdfDefaults): Promise<boolean> {
  return storage.setItem(KEY, v as any);
}
