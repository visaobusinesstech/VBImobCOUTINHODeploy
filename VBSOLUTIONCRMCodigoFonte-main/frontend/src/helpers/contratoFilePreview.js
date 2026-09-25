/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Helpers de preview / extensão de arquivos de contratos (paridade Lovable).
 */

export const DEFAULT_CONTRATO_FILE_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ods,.ppt,.pptx,.txt,.csv,.json,.xml,.jpg,.jpeg,.png,.webp,.gif,.bmp,.svg";
export const VIDEO_CONTRATO_FILE_ACCEPT = ".mp4,.mov,.webm,.m4v,.ogg";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v", "ogg"]);
const TEXT_EXTENSIONS = new Set(["txt", "csv", "json", "xml"]);
const OFFICE_EXTENSIONS = new Set(["doc", "docx", "xls", "xlsx", "ods", "ppt", "pptx"]);

const MIME_EXTENSION_MAP = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const sanitizePath = (pathOrUrl) => {
  if (!pathOrUrl) return "";

  const [withoutHash] = String(pathOrUrl).split("#");
  const [withoutQuery] = withoutHash.split("?");

  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
};

export function getContratoFileName(pathOrUrl, fallback = "arquivo") {
  const sanitized = sanitizePath(pathOrUrl);
  const fileName = sanitized.split("/").filter(Boolean).pop();
  return fileName || fallback;
}

export function getContratoFileExtension(pathOrUrl) {
  const fileName = getContratoFileName(pathOrUrl);
  const parts = fileName.split(".");

  if (parts.length < 2) return "";

  return (parts.pop() || "").toLowerCase();
}

export function getContratoFilePreviewKind(pathOrUrl) {
  const extension = getContratoFileExtension(pathOrUrl);

  if (!extension) return "unsupported";
  if (extension === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (OFFICE_EXTENSIONS.has(extension)) return "office";

  return "unsupported";
}

export function buildContratoOfficePreviewUrl(url) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export function getSafeFileExtension(file) {
  const name = file && file.name ? String(file.name) : "";
  if (name.includes(".")) {
    const fromName = (name.split(".").pop() || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (fromName) return fromName;
  }

  const mappedMime = MIME_EXTENSION_MAP[(file && file.type) || ""];
  if (mappedMime) return mappedMime;

  const fallback = ((file && file.type ? file.type.split("/").pop() : "") || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return fallback || "bin";
}
