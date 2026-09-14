import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";

export const PDF_DIR = `${FileSystem.documentDirectory}PDFs/`;

export async function ensurePdfDir() {
  const info = await FileSystem.getInfoAsync(PDF_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PDF_DIR, { intermediates: true });
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return info.exists && "size" in info ? (info.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

// Share a PDF using the OS share sheet.
export async function sharePdf(uri: string): Promise<boolean> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return false;
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share PDF",
      UTI: "com.adobe.pdf",
    });
    return true;
  } catch {
    return false;
  }
}

// Open a PDF in an external viewer.
export async function openPdf(uri: string): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: "application/pdf",
      });
      return true;
    }
    // iOS / other: fall back to the share sheet ("Open in...").
    return await sharePdf(uri);
  } catch {
    // Last-resort fallback so the user is never dead-ended.
    return await sharePdf(uri);
  }
}

export async function deletePdfFile(uri: string): Promise<boolean> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

// Rename by moving the file to a new name in the same directory.
export async function renamePdfFile(
  oldUri: string,
  newBaseName: string,
): Promise<string | null> {
  try {
    await ensurePdfDir();
    const safe = sanitizeFilename(newBaseName);
    const newUri = `${PDF_DIR}${safe}.pdf`;
    if (newUri === oldUri) return oldUri;
    // Avoid clobbering an existing file.
    const exists = await fileExists(newUri);
    const finalUri = exists ? `${PDF_DIR}${safe}-${Date.now()}.pdf` : newUri;
    await FileSystem.moveAsync({ from: oldUri, to: finalUri });
    return finalUri;
  } catch {
    return null;
  }
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : defaultPdfName();
}

export function defaultPdfName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `IMG_to_PDF_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate(),
  )}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
