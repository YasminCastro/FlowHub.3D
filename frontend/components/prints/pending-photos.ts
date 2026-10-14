import { PRINT_MAX_PHOTOS, PRINT_PHOTO_MAX_BYTES } from "@/lib/api/print";

// Foto escolhida agora, ainda não enviada: o preview é um object URL.
export type PendingPhoto = { file: File; preview: string };

// Mesmos limites do backend; o que passa disso fica de fora com um aviso.
export function pickPhotos(files: FileList, alreadyPicked: number) {
  const images = [...files].filter((file) => file.type.startsWith("image/"));
  const fitting = images.filter((file) => file.size <= PRINT_PHOTO_MAX_BYTES);
  const accepted = fitting
    .slice(0, Math.max(0, PRINT_MAX_PHOTOS - alreadyPicked))
    .map((file) => ({ file, preview: URL.createObjectURL(file) }));

  let error: string | null = null;
  if (fitting.length < images.length) {
    error = "Cada foto pode ter até 10 MB.";
  } else if (accepted.length < images.length) {
    error = `Cada registro aceita até ${PRINT_MAX_PHOTOS} fotos.`;
  }
  return { accepted, error };
}
