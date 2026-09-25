import { getSafeFileExtension } from "@/lib/contratoFilePreview";
import { uploadContratoFilePrivate } from "@/lib/contratosStorage";

export async function uploadContratoFile(
  file: File,
  contratoId: string,
  tipo: "contrato" | "apolice" | "vistoria"
): Promise<string | null> {
  const ext = getSafeFileExtension(file);
  const path = `${contratoId}/${tipo}_${Date.now()}.${ext}`;

  return uploadContratoFilePrivate(file, path);
}
