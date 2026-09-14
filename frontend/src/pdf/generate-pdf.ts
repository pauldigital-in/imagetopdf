import { PDFDocument } from "pdf-lib/dist/pdf-lib.js";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import type { Orientation, PageSize, Quality } from "@/src/config/defaults";
import type { SessionImage } from "@/src/session/image-session";
import { PDF_DIR, ensurePdfDir, sanitizeFilename } from "./file-ops";

// A4 in PostScript points (72 dpi).
const A4 = { w: 595.28, h: 841.89 };

const QUALITY_MAP: Record<Quality, { maxDim: number; compress: number }> = {
  standard: { maxDim: 1280, compress: 0.6 },
  high: { maxDim: 2000, compress: 0.82 },
  best: { maxDim: 4000, compress: 0.92 },
};

export type GenerateOptions = {
  images: SessionImage[];
  name: string;
  quality: Quality;
  pageSize: PageSize;
  orientation: Orientation;
  onProgress?: (fraction: number) => void;
  isCancelled?: () => boolean;
};

export type GenerateResult = {
  name: string;
  uri: string;
  size: number;
  pageCount: number;
};

export class PdfCancelledError extends Error {
  constructor() {
    super("PDF creation cancelled");
    this.name = "PdfCancelledError";
  }
}

async function processImage(
  img: SessionImage,
  maxDim: number,
  compress: number,
): Promise<{ base64: string; width: number; height: number }> {
  const longest = Math.max(img.width || 0, img.height || 0);
  const ctx = ImageManipulator.manipulate(img.uri);

  // Only downscale — never upscale (avoids quality loss & memory blowups).
  if (longest > maxDim && img.width && img.height) {
    const scale = maxDim / longest;
    ctx.resize({
      width: Math.round(img.width * scale),
      height: Math.round(img.height * scale),
    });
  }

  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress,
    base64: true,
  });

  return {
    base64: out.base64 ?? "",
    width: out.width,
    height: out.height,
  };
}

export async function generatePdf(opts: GenerateOptions): Promise<GenerateResult> {
  const {
    images,
    name,
    quality,
    pageSize,
    orientation,
    onProgress,
    isCancelled,
  } = opts;

  if (!images.length) throw new Error("No images to convert");

  const { maxDim, compress } = QUALITY_MAP[quality];
  const pdfDoc = await PDFDocument.create();

  const total = images.length;
  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) throw new PdfCancelledError();

    const processed = await processImage(images[i], maxDim, compress);
    if (!processed.base64) throw new Error(`Could not read image ${i + 1}`);

    const jpg = await pdfDoc.embedJpg(`data:image/jpeg;base64,${processed.base64}`);
    const iw = processed.width || jpg.width;
    const ih = processed.height || jpg.height;
    const imageIsLandscape = iw >= ih;

    if (pageSize === "a4") {
      let portrait: boolean;
      if (orientation === "portrait") portrait = true;
      else if (orientation === "landscape") portrait = false;
      else portrait = !imageIsLandscape; // auto -> match image

      const pw = portrait ? A4.w : A4.h;
      const ph = portrait ? A4.h : A4.w;
      const page = pdfDoc.addPage([pw, ph]);

      const margin = 18;
      const availW = pw - margin * 2;
      const availH = ph - margin * 2;
      const scale = Math.min(availW / iw, availH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      page.drawImage(jpg, {
        x: (pw - dw) / 2,
        y: (ph - dh) / 2,
        width: dw,
        height: dh,
      });
    } else {
      // Original: page matches the image dimensions (1px = 1pt).
      let pw = iw;
      let ph = ih;
      // Honour an explicit orientation override on Original pages.
      const forceLandscape = orientation === "landscape";
      const forcePortrait = orientation === "portrait";
      if (forceLandscape && ph > pw) {
        pw = ih;
        ph = iw;
      } else if (forcePortrait && pw > ph) {
        pw = ih;
        ph = iw;
      }
      const page = pdfDoc.addPage([pw, ph]);
      const scale = Math.min(pw / iw, ph / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      page.drawImage(jpg, {
        x: (pw - dw) / 2,
        y: (ph - dh) / 2,
        width: dw,
        height: dh,
      });
    }

    onProgress?.((i + 1) / (total + 1));
  }

  if (isCancelled?.()) throw new PdfCancelledError();

  const base64Pdf = await pdfDoc.saveAsBase64();

  await ensurePdfDir();
  const safe = sanitizeFilename(name);
  let uri = `${PDF_DIR}${safe}.pdf`;
  const existing = await FileSystem.getInfoAsync(uri);
  if (existing.exists) uri = `${PDF_DIR}${safe}-${Date.now()}.pdf`;

  await FileSystem.writeAsStringAsync(uri, base64Pdf, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const size = info.exists && "size" in info ? (info.size ?? 0) : 0;

  onProgress?.(1);

  return { name: safe, uri, size, pageCount: total };
}
