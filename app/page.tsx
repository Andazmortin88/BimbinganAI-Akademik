import { ArrowRight, Bot, CheckCircle2, FileCheck2, FolderLock, GraduationCap, MessageSquareText, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import EmailAuth from "@/components/email-auth";

const features = [
  { icon: MessageSquareText, title: "Bimbingan dua arah", text: "Percakapan, lampiran, feedback, dan revisi tersimpan dalam satu riwayat." },
  { icon: FileCheck2, title: "Versi dokumen tertib", text: "Setiap unggahan menjadi versi baru. Dokumen lama tidak pernah tertimpa." },
  { icon: Bot, title: "AI review privat", text: "Temuan AI diperiksa dosen lebih dahulu sebelum dipilih dan dikirim." },
  { icon: FolderLock, title: "Arsip dosen", text: "Rekap bimbingan, dokumen, progres, dan laporan mudah dicari kembali." },
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="nav shell" aria-label="Navigasi utama">
        <a className="brand" href="#top"><span className="brandmark"><GraduationCap size={22}/></span><span>Bimbing<span>AI</span></span></a>
        <div className="navlinks"><a href="#fitur">Fitur</a><a href="#alur">Alur</a><a href="#keamanan">Keamanan</a></div>
        <a className="button ghost" href="#masuk">Masuk</a>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15}/> Sistem bimbingan akademik terpadu</div>
          <h1>Bimbingan lebih terarah, <span>terdokumentasi</span>, dan cerdas.</h1>
          <p>Kelola konsultasi, perkembangan penelitian, versi dokumen, revisi, jadwal, dan AI Academic Review dalam satu sistem yang aman.</p>
          <div className="hero-actions">
            <a className="button primary" href="#masuk">Daftar atau masuk <ArrowRight size={18}/></a>
            <a className="button secondary" href="#fitur">Lihat fitur</a>
          </div>
          <div className="trust-row"><span><CheckCircle2/> Skripsi S1</span><span><CheckCircle2/> KTI D3</span><span><CheckCircle2/> KIA Ners</span></div>
          <EmailAuth/>
        </div>

        <div className="hero-visual" aria-label="Pratinjau dashboard">
          <div className="glow"/><div className="orbit"><i/><i/><i/></div>
          <div className="dash-preview">
            <div className="preview-top"><span><i/> Dashboard Dosen</span><small>Semester Ganjil 2026/2027</small></div>
            <div className="metrics">
              <article><UsersRound/><div><b>0</b><small>Mahasiswa aktif</small></div></article>
              <article><FileCheck2/><div><b>0</b><small>Perlu direview</small></div></article>
              <article><MessageSquareText/><div><b>0</b><small>Bimbingan masuk</small></div></article>
            </div>
            <div className="preview-grid">
              <section className="progress-card"><header><div><small>Progres bimbingan</small><b>Semester ini</b></div><span>74%</span></header><div className="bars"><i style={{height:"52%"}}/><i style={{height:"68%"}}/><i style={{height:"49%"}}/><i style={{height:"83%"}}/><i style={{height:"72%"}}/><i style={{height:"91%"}}/></div><div className="month"><span>Apr</span><span>Mei</span><span>Jun</span><span>Jul</span><span>Agu</span><span>Sep</span></div></section>
              <section className="activity preview-empty"><small>Aktivitas terbaru</small><FileCheck2/><b>Belum ada data</b><p>Aktivitas mahasiswa akan tampil setelah akun disetujui.</p></section>
            </div>
          </div>
        </div>
      </section>

      <section className="stats"><div className="shell"><div><b>17</b><span>Tahap progres</span></div><div><b>3</b><span>Program studi</span></div><div><b>100%</b><span>Riwayat terdokumentasi</span></div><div><b>24/7</b><span>Akses aman</span></div></div></section>

      <section className="section shell" id="fitur">
        <div className="section-head"><div><span>RUANG KERJA AKADEMIK</span><h2>Satu alur untuk seluruh proses bimbingan</h2></div><p>Dosen memantau lebih cepat. Mahasiswa selalu mengetahui revisi dan langkah berikutnya.</p></div>
        <div className="feature-grid">{features.map(({icon:Icon,title,text})=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p><a href="#masuk">Mulai menggunakan <ArrowRight/></a></article>)}</div>
      </section>

      <section className="workflow" id="alur"><div className="shell"><div className="section-head inverse"><div><span>ALUR SEDERHANA</span><h2>Dari pengajuan judul hingga arsip akhir</h2></div><p>Setiap keputusan memiliki jejak waktu dan pengguna yang bertanggung jawab.</p></div><div className="steps">{["Daftar & disetujui","Ajukan judul","Bimbingan & revisi","Sidang & arsip"].map((x,i)=><article key={x}><b>{String(i+1).padStart(2,"0")}</b><h3>{x}</h3><p>{["Mahasiswa membuat akun email dan melengkapi profil.","Tiga alternatif judul ditelaah pembimbing.","Dokumen, pesan, dan feedback tercatat per versi.","Rekap PDF dan dokumen final tersimpan."][i]}</p></article>)}</div></div></section>

      <section className="security shell" id="keamanan"><div className="security-icon"><ShieldCheck/></div><div><span>PRIVASI SEJAK AWAL</span><h2>Data akademik hanya terbuka untuk orang yang berwenang</h2><p>Autentikasi dikelola Neon Auth, sedangkan akses database dijalankan melalui server dan diperiksa berdasarkan peran serta penugasan pembimbing.</p></div><a className="button dark" href="#masuk">Masuk ke sistem <ArrowRight/></a></section>

      <footer><div className="shell"><div className="brand"><span className="brandmark"><GraduationCap size={22}/></span><span>Bimbing<span>AI</span></span></div><p>Academic Supervision, Document Archive & AI Review System</p><small>© 2026 Universitas Bani Saleh</small></div></footer>
    </main>
  );
}
