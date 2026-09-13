# BimbingAI Akademik

Sistem monitoring **Skripsi S1 Keperawatan, KTI D3 Keperawatan, dan KIA Profesi Ners**. Frontend menggunakan Next.js App Router; autentikasi, database, penyimpanan dokumen privat, dan Realtime menggunakan Supabase. Deployment produksi disiapkan untuk Vercel, sedangkan source code dapat disimpan di GitHub.

> Status rilis ini: fondasi produksi tahap 1–3 telah tersedia (arsitektur, database, RLS, Storage policy, Google OAuth, landing page, dashboard responsif, dan endpoint AI privat). Modul transaksi lanjutan sudah dimodelkan dalam database tetapi masih perlu dihubungkan pada seluruh tombol dashboard sebelum dipakai secara institusional.

## 1. Blueprint arsitektur

```text
Browser mahasiswa/dosen
        │ HTTPS + cookie PKCE
        ▼
Next.js di Vercel ─── server route AI ─── AI API
        │                    │
        │ publishable key    └── secret hanya di server
        ▼
Supabase
├── Auth: Google OAuth
├── PostgreSQL: 25 tabel + RLS
├── Storage: dokumen dan laporan privat
└── Realtime: pesan, notifikasi, status
```

Keputusan akses selalu diperiksa oleh RLS. Role tersimpan pada `profiles.role`, bukan `user_metadata`.

## 2. Struktur halaman

- `/` — landing page dan tombol Google Login.
- `/dashboard` — ringkasan dosen, monitoring mahasiswa, serta pintu masuk modul.
- `/auth/callback` — menukar OAuth code menjadi sesi cookie PKCE.
- `/auth/signout` — mengakhiri sesi.
- `/api/ai/review` — review AI privat, hanya melalui server.

Tahap berikutnya menghubungkan route: registrasi, approval, ruang bimbingan, review dokumen dua panel, jadwal, arsip, serta laporan PDF.

## 3. Struktur folder

```text
app/                    halaman, callback auth, dan server route
components/             komponen dashboard interaktif
lib/supabase/           client browser, server, dan proxy session
public/                 favicon
supabase/migrations/    schema, indeks, RLS, Storage policies
supabase/tests/         pemeriksaan dasar RLS
supabase/seed.sql       data referensi development
```

## 4. Skema dan alur role

- **Admin:** seluruh mahasiswa, approval, penugasan dosen, arsip, rubric, laporan, audit.
- **Dosen:** hanya project yang ada di `supervision_assignments`.
- **Mahasiswa:** hanya project dan data miliknya; catatan `PRIVATE` tidak dapat dibaca.

Tabel inti: `profiles`, `student_profiles`, `lecturer_profiles`, `research_projects`, `supervision_assignments`, `guidance_threads`, `messages`, `documents`, `document_versions`, `document_comments`, `ai_reviews`, `appointments`, `notifications`, dan `audit_logs`.

## 5. Membuat project Supabase (untuk orang awam)

1. Buka `https://supabase.com/dashboard` lalu masuk.
2. Klik **New project**.
3. Pilih organisasi, isi nama `BimbingAI Akademik`, dan buat password database yang kuat.
4. Pilih region terdekat, kemudian klik **Create new project**.
5. Tunggu sampai status project aktif.
6. Buka **SQL Editor** → **New query**.
7. Salin seluruh isi `supabase/migrations/202609130001_bimbingai_core.sql`.
8. Klik **Run**. Pastikan tidak ada pesan error.
9. Buka query baru, salin `supabase/tests/rls_smoke_test.sql`, lalu klik **Run**.
10. Pastikan lima tabel yang diuji menampilkan `rowsecurity = true` dan empat bucket tampil `public = false`.

Jangan menjalankan `supabase/seed.sql` pada project produksi. Seed hanya berisi data contoh untuk pengembangan.

## 6. Mengaktifkan Google OAuth

### A. Google Cloud

1. Buka Google Cloud Console dan buat/pilih project.
2. Buka **APIs & Services** → **OAuth consent screen**.
3. Isi nama aplikasi `BimbingAI Akademik` dan email dukungan.
4. Buka **Credentials** → **Create Credentials** → **OAuth client ID**.
5. Pilih **Web application**.
6. Pada **Authorized redirect URIs**, masukkan URL callback yang ditampilkan Supabase di **Authentication → Providers → Google**. Bentuk umumnya `https://PROJECT_REF.supabase.co/auth/v1/callback`.
7. Simpan, lalu salin Client ID dan Client Secret.

### B. Supabase

1. Buka project → **Authentication** → **Providers** → **Google**.
2. Aktifkan Google, tempel Client ID dan Client Secret, lalu simpan.
3. Buka **Authentication** → **URL Configuration**.
4. Isi **Site URL** dengan URL Vercel produksi.
5. Tambahkan **Redirect URLs**: `http://localhost:3000/**` dan `https://NAMA-APLIKASI.vercel.app/**`.

## 7. Environment variable

1. Duplikasi `.env.example` menjadi `.env.local`.
2. Di Supabase klik **Connect** dan ambil Project URL serta **Publishable key**.
3. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Secret key hanya diperlukan oleh pekerjaan server administratif. Jangan pernah menaruhnya pada variabel bernama `NEXT_PUBLIC_*`.
5. Isi `AI_API_KEY` hanya di server/Vercel.
6. Isi `NEXT_PUBLIC_SITE_URL=http://localhost:3000` untuk lokal; ganti dengan URL Vercel untuk produksi.

## 8. Menjalankan lokal

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Buka `http://localhost:3000`. Untuk melihat dashboard contoh tanpa login, buka `/dashboard?demo=1`.

## 9. Membuat admin pertama

1. Login sekali dengan Google agar user muncul di **Authentication → Users**.
2. Salin UUID user tersebut.
3. Di SQL Editor, jalankan perintah berikut setelah mengganti nilai contoh:

```sql
insert into public.profiles(id,role,status,full_name,email)
values ('UUID-USER','ADMIN','ACTIVE','Ns. Amzal Mortin Andas','EMAIL-GOOGLE')
on conflict(id) do update set role='ADMIN',status='ACTIVE';

insert into public.lecturer_profiles(profile_id,nidn,is_main_supervisor)
values ('UUID-USER','NIDN-ANDA',true)
on conflict(profile_id) do update set is_main_supervisor=true;
```

## 10. Menyimpan ke GitHub dan deploy Vercel

1. Buat repository kosong di GitHub, misalnya `bimbingai-akademik`.
2. Unggah seluruh folder proyek; **jangan unggah `.env.local`**.
3. Buka `https://vercel.com`, login dengan GitHub, klik **Add New → Project**.
4. Pilih repository tersebut, lalu klik **Import**.
5. Pada **Environment Variables**, masukkan lima variabel dari `.env.example` beserta nilainya.
6. Klik **Deploy**.
7. Setelah selesai, salin URL Vercel dan masukkan ke Supabase **Authentication → URL Configuration**.
8. Lakukan login Google dari URL produksi dan cek callback berhasil menuju dashboard.

GitHub Pages tidak dipakai untuk deployment utama karena tidak dapat menjalankan server route AI dan manajemen cookie SSR. GitHub tetap menjadi tempat source code dan riwayat perubahan.

## 11. Pengujian wajib sebelum digunakan

- Google login, callback, logout, status `PENDING`, dan approval.
- Mahasiswa A tidak dapat membaca project mahasiswa B.
- Dosen tidak dapat membaca project di luar penugasannya.
- Mahasiswa tidak dapat membaca komentar `PRIVATE` atau `ai_reviews`.
- File hanya dapat diunggah ke path `<student_uuid>/<project_uuid>/...`.
- Signed URL berumur pendek dan bucket tidak public.
- Versi baru tidak menimpa versi lama.
- Hanya dosen yang dapat menandai sesi sebagai bimbingan resmi.
- AI review tetap privat sampai dosen memilih item.
- Authenticated response tidak di-cache publik.

Jalankan `pnpm typecheck` dan `pnpm build`. Setelah migration terpasang, buka **Database → Advisors** dan perbaiki seluruh temuan security/performance yang relevan sebelum go-live.

## 12. Troubleshooting singkat

- **Google login kembali ke halaman error:** cocokkan redirect URL Google, Supabase, `.env.local`, dan Vercel.
- **Tabel tidak dapat diakses:** pastikan migration selesai, RLS aktif, dan pengguna memiliki row `profiles` dengan status `ACTIVE`.
- **Upload ditolak:** periksa struktur path, ukuran maksimum 50 MB, dan MIME type.
- **AI belum aktif:** pastikan `AI_API_KEY` hanya terisi pada Vercel/server, lalu deploy ulang.
- **Dashboard masih berisi data contoh:** ini normal sebelum query dashboard dihubungkan ke project Supabase.

## 13. Checklist keamanan

- [ ] Tidak ada secret di GitHub atau browser bundle.
- [ ] Seluruh tabel exposed memiliki RLS.
- [ ] Semua bucket dokumen `public=false`.
- [ ] Role tidak berasal dari `user_metadata`.
- [ ] Update policy mempunyai `USING` dan `WITH CHECK`.
- [ ] Fungsi privileged berada di schema `private`, memeriksa `auth.uid()`, dan membatasi `EXECUTE`.
- [ ] Semua akses file memakai signed URL singkat.
- [ ] Log tidak menyimpan token atau isi dokumen sensitif.
- [ ] Advisor Supabase tidak memiliki temuan kritis.

