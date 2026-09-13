# BimbingAI Akademik — Neon Edition

Sistem monitoring **Skripsi S1 Keperawatan, KTI D3 Keperawatan, dan KIA Profesi Ners**. Aplikasi menggunakan Next.js App Router di Vercel, Neon Auth untuk autentikasi, serta Lakebase Postgres pada Neon untuk data akademik.

## Status

- Proyek Neon `BimbingAI Akademik` aktif di region Singapore.
- Database `bimbingai` dan branch `main` aktif.
- Sebanyak 26 tabel aplikasi dan 17 tahap progres telah dibuat.
- Managed Better Auth aktif dengan Google OAuth bersama untuk pengujian.
- Kode Supabase telah diganti dengan paket resmi Neon.
- Registrasi mahasiswa memakai transaksi database dari server.
- Build produksi Next.js telah lulus.

## Arsitektur

```text
Browser mahasiswa/dosen
        │ HTTPS + cookie terenkripsi
        ▼
Next.js 16 di Vercel
├── Neon Auth proxy       → login, sesi, logout
├── Server API            → validasi role dan kepemilikan
├── Lakebase Postgres     → data akademik
└── Server route AI       → AI_API_KEY tetap privat
```

Koneksi `DATABASE_URL` hanya digunakan pada server dan tidak pernah memakai awalan `NEXT_PUBLIC_`.

## Environment variables

Tambahkan variabel berikut pada `.env.local` untuk pengembangan dan pada Vercel untuk Production, Preview, dan Development:

```env
DATABASE_URL=postgresql://...
NEON_AUTH_BASE_URL=https://ep-tiny-hat-b3imoxg4.neonauth.c-4.ap-southeast-1.aws.neon.tech/bimbingai/auth
NEON_AUTH_COOKIE_SECRET=rahasia-acak-minimal-32-karakter
ADMIN_EMAIL=email-pemilik-aplikasi
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AI_API_KEY=
```

Untuk produksi, ubah `NEXT_PUBLIC_SITE_URL` menjadi URL aplikasi Vercel tanpa garis miring di belakang.
`ADMIN_EMAIL` adalah satu-satunya akun yang otomatis menerima peran Administrator saat login pertama.

## Struktur penting

```text
app/api/auth/[...path]/  proxy API Neon Auth
app/api/register/        registrasi mahasiswa secara transaksional
app/api/ai/review/       review AI dengan pemeriksaan akses
app/auth/callback/       pengarah pengguna setelah login
lib/auth/                klien dan server Neon Auth
lib/db.ts                koneksi database khusus server
neon/                    catatan konfigurasi Neon
```

## Menjalankan aplikasi

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Buka `http://localhost:3000`, lalu daftar atau masuk menggunakan email dan kata sandi.

## Google OAuth (opsional)

Login utama menggunakan email dan kata sandi Neon Auth. Jika institusi ingin menambahkan Google:

1. Buat OAuth Client bertipe **Web application** pada Google Cloud.
2. Salin Authorized Redirect URI yang ditampilkan Neon Auth ke Google Cloud secara persis.
3. Tambahkan domain Vercel sebagai trusted domain di Neon Auth.
4. Masukkan Client ID dan Client Secret Google pada konfigurasi Neon Auth.
5. Publikasikan OAuth consent screen setelah pengujian selesai.

## Alur registrasi

1. Pengguna mendaftar atau masuk menggunakan email.
2. Neon Auth membuat sesi aman.
3. Pengguna baru diarahkan ke `/register`.
4. Server menyimpan `profiles`, `student_profiles`, dan `research_projects` dalam satu transaksi.
5. Mahasiswa mendapat status `PENDING` sampai disetujui admin/dosen.

## Keamanan produksi

- Jangan memasukkan `DATABASE_URL`, cookie secret, atau `AI_API_KEY` ke GitHub.
- Gunakan URL pooled Neon untuk trafik aplikasi serverless.
- Tambahkan domain produksi ke trusted domains Neon Auth.
- Ganti kredensial Google bersama dengan kredensial milik institusi.
- Aktifkan verifikasi email sebelum menerima pengguna umum.
- Nonaktifkan localhost pada Neon Auth setelah pengujian produksi selesai.
- Semua perubahan penting pada database dilakukan melalui server.

## Pengujian wajib

```bash
pnpm typecheck
pnpm build
```

Uji pendaftaran email, login, registrasi, status pending, logout, pembatasan dokumen, penugasan pembimbing, dan endpoint review AI sebelum digunakan mahasiswa.
