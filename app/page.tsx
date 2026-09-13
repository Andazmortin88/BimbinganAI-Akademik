"use client";

import { useState } from "react";
import { ArrowRight, Bot, CheckCircle2, ChevronRight, FileCheck2, FolderLock, GraduationCap, MessageSquareText, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { authClient } from "@/lib/auth/client";

const features = [
  { icon: MessageSquareText, title: "Bimbingan dua arah", text: "Percakapan, lampiran, feedback, dan revisi tersimpan dalam satu riwayat." },
  { icon: FileCheck2, title: "Versi dokumen tertib", text: "Setiap unggahan menjadi versi baru. Dokumen lama tidak pernah tertimpa." },
  { icon: Bot, title: "AI review privat", text: "Temuan AI diperiksa dosen lebih dahulu sebelum dipilih dan dikirim." },
  { icon: FolderLock, title: "Arsip dosen", text: "Rekap bimbingan, dokumen, progres, dan laporan mudah dicari kembali." },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function loginGoogle() {
    try {
      setLoading(true);
      const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${origin}/auth/callback?next=/dashboard`,
      });
      if (error) throw error;
    } catch {
      setNotice("Koneksi Neon Auth belum lengkap. Periksa environment variable aplikasi.");
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <nav className="nav shell" aria-label="Navigasi utama">
        <a className="brand" href="#top"><span className="brandmark"><GraduationCap size={22}/></span><span>Bimbing<span>AI</span></span></a>
        <div className="navlinks"><a href="#fitur">Fitur</a><a href="#alur">Alur</a><a href="#keamanan">Keamanan</a></div>
        <button className="button ghost" onClick={loginGoogle} disabled={loading}>{loading ? "Menghubungkan…" : "Masuk"}</button>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15}/> Sistem bimbingan akademik terpadu</div>
          <h1>Bimbingan lebih terarah, <span>terdokumentasi</span>, dan cerdas.</h1>
          <p>Kelola konsultasi, perkembangan penelitian, versi dokumen, revisi, jadwal, dan AI Academic Review dalam satu sistem yang aman.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={loginGoogle} disabled={loading}>Mulai dengan Google <ArrowRight size={18}/></button>
            <a className="button secondary" href="/dashboard?demo=1">Lihat demo dashboard</a>
          </div>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="trust-row"><span><CheckCircle2/> Skripsi S1</span><span><CheckCircle2/> KTI D3</span><span><CheckCircle2/> KIA Ners</span></div>
        </div>

        <div className="hero-visual" aria-label="Pratinjau dashboard">
          <div className="glow"/><div className="orbit"><i/><i/><i/></div>
          <div className="dash-preview">
            <div className="preview-top"><span><i/> Dashboard Dosen</span><small>Semester Ganjil 2026/2027</small></div>
            <div className="metrics">
              <article><UsersRound/><div><b>37</b><small>Mahasiswa aktif</small></div></article>
              <article><FileCheck2/><div><b>8</b><small>Perlu direview</small></div></article>
              <article><MessageSquareText/><div><b>12</b><small>Bimbingan masuk</small></div></article>
            </div>
            <div className="preview-grid">
              <section className="progress-card"><header><div><small>Progres bimbingan</small><b>Semester ini</b></div><span>74%</span></header><div className="bars"><i style={{height:"52%"}}/><i style={{height:"68%"}}/><i style={{height:"49%"}}/><i style={{height:"83%"}}/><i style={{height:"72%"}}/><i style={{height:"91%"}}/></div><div className="month"><span>Apr</span><span>Mei</span><span>Jun</span><span>Jul</span><span>Agu</span><span>Sep</span></div></section>
              <section className="activity"><small>Aktivitas terbaru</small><div><span className="avatar">NA</span><p><b>Nabila A.</b><br/><small>BAB III · V03</small></p><em>Baru</em></div><div><span className="avatar cyan">RF</span><p><b>Rizky F.</b><br/><small>Revisi diperbaiki</small></p><em className="done">Selesai</em></div><div><span className="avatar purple">SN</span><p><b>Siti N.</b><br/><small>Jadwal diajukan</small></p><ChevronRight/></div></section>
            </div>
          </div>
        </div>
      </section>

      <section className="stats"><div className="shell"><div><b>17</b><span>Tahap progres</span></div><div><b>3</b><span>Program studi</span></div><div><b>100%</b><span>Riwayat terdokumentasi</span></div><div><b>24/7</b><span>Akses aman</span></div></div></section>

      <section className="section shell" id="fitur">
        <div className="section-head"><div><span>RUANG KERJA AKADEMIK</span><h2>Satu alur untuk seluruh proses bimbingan</h2></div><p>Dosen memantau lebih cepat. Mahasiswa selalu mengetahui revisi dan langkah berikutnya.</p></div>
        <div className="feature-grid">{features.map(({icon:Icon,title,text})=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p><a href="/dashboard?demo=1">Lihat cara kerja <ArrowRight/></a></article>)}</div>
      </section>

      <section className="workflow" id="alur"><div className="shell"><div className="section-head inverse"><div><span>ALUR SEDERHANA</span><h2>Dari pengajuan judul hingga arsip akhir</h2></div><p>Setiap keputusan memiliki jejak waktu dan pengguna yang bertanggung jawab.</p></div><div className="steps">{["Daftar & disetujui","Ajukan judul","Bimbingan & revisi","Sidang & arsip"].map((x,i)=><article key={x}><b>{String(i+1).padStart(2,"0")}</b><h3>{x}</h3><p>{["Mahasiswa login Google dan melengkapi profil.","Tiga alternatif judul ditelaah pembimbing.","Dokumen, pesan, dan feedback tercatat per versi.","Rekap PDF dan dokumen final tersimpan."][i]}</p></article>)}</div></div></section>

      <section className="security shell" id="keamanan"><div className="security-icon"><ShieldCheck/></div><div><span>PRIVASI SEJAK AWAL</span><h2>Data akademik hanya terbuka untuk orang yang berwenang</h2><p>Autentikasi dikelola Neon Auth, sedangkan akses database dijalankan melalui server dan diperiksa berdasarkan peran serta penugasan pembimbing.</p></div><a className="button dark" href="/dashboard?demo=1">Jelajahi sistem <ArrowRight/></a></section>

      <footer><div className="shell"><div className="brand"><span className="brandmark"><GraduationCap size={22}/></span><span>Bimbing<span>AI</span></span></div><p>Academic Supervision, Document Archive & AI Review System</p><small>© 2026 Universitas Bani Saleh</small></div></footer>
    </main>
  );
}
