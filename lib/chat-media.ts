"use client";

import { compressImageToDataUrl } from "./user-profile";

export interface PreparedMedia {
  url: string;
  type: string;
  name: string;
}

const MAX_RAW_NON_IMAGE_BYTES = 650 * 1024; // ~650KB to stay comfortably inside Firestore 1MB doc limit
const MAX_GIF_BYTES = 550 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export async function prepareMediaForChat(file: File): Promise<PreparedMedia> {
  const mime = file.type || "application/octet-stream";

  if (mime.startsWith("image/")) {
    // Preserve animated GIFs directly if within size budget
    if (mime === "image/gif") {
      if (file.size > MAX_GIF_BYTES) {
        throw new Error("GIF file is too large (max 550KB).");
      }
      const url = await readFileAsDataUrl(file);
      return { url, type: mime, name: file.name };
    }

    // Compress static images smoothly via canvas
    let compressed = await compressImageToDataUrl(file, 960);
    if (compressed.length > 720_000) {
      compressed = await compressImageToDataUrl(file, 640);
    }
    if (compressed.length > 850_000) {
      throw new Error("Image is still too large after compression. Please choose a smaller image.");
    }
    return {
      url: compressed,
      type: "image/jpeg",
      name: file.name,
    };
  }

  // Video, Audio, Documents
  if (file.size > MAX_RAW_NON_IMAGE_BYTES) {
    throw new Error("Audio, video, and document files must be under 650KB.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    url: dataUrl,
    type: mime,
    name: file.name,
  };
}

