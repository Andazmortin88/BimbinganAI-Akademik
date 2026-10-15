export const MAX_DOCUMENT_SIZE = 4 * 1024 * 1024;

export function validateDocumentFile(file: Pick<File, "name" | "size">): string | null {
  if (!/\.(doc|docx)$/i.test(file.name)) return "Gunakan berkas Microsoft Word .doc atau .docx.";
  if (file.size === 0) return "Berkas kosong. Pilih dokumen yang berisi data.";
  if (file.size > MAX_DOCUMENT_SIZE) return "Ukuran berkas melebihi 4 MB. Kompres gambar dalam dokumen lalu coba kembali.";
  return null;
}

export async function submitDocument(url: string, data: FormData) {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: data });
  } catch {
    throw new Error("Koneksi terputus. Periksa riwayat dokumen sebelum mencoba kembali untuk menghindari unggahan ganda.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status === 413
      ? "Ukuran unggahan terlalu besar. Gunakan berkas Word maksimum 4 MB."
      : response.status === 401
        ? "Sesi berakhir. Masuk kembali sebelum mengunggah dokumen."
        : "Dokumen belum dapat dikirim. Silakan coba kembali.";
    throw new Error(result?.error || fallback);
  }
  if (result?.ok !== true) throw new Error("Respons server tidak valid. Periksa riwayat dokumen sebelum mencoba kembali.");
  return result;
}
