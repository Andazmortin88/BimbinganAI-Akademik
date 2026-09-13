"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, Bell, Bot, CalendarDays, ChevronDown, CircleHelp, Clock3,
  FileText, GraduationCap, LayoutDashboard, LogOut, Menu,
  MessageSquareText, Search, Settings, Sparkles, UserRoundCheck, UsersRound, X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";

export type DashboardStudent = {
  name: string;
  nim: string;
  program: string;
  stage: string;
  progress: number;
  status: string;
  updatedAt: string;
};

export type DashboardProps = {
  viewerName: string;
  viewerRole: string;
  period: string;
  students: DashboardStudent[];
  incomingCount: number;
  documentCount: number;
  currentTime: string;
};

const nav = [
  ["Ringkasan", LayoutDashboard], ["Mahasiswa", UsersRound],
  ["Bimbingan Masuk", MessageSquareText], ["Dokumen", FileText],
  ["AI Review Center", Bot], ["Jadwal", CalendarDays], ["Arsip Bimbingan", Archive],
] as const;

function relativeTime(value: string, currentTime: string) {
  const days = Math.max(0, Math.floor((new Date(currentTime).getTime() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  return `${days} hari lalu`;
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "green";
  if (status === "PENDING") return "yellow";
  if (status === "DISABLED" || status === "REJECTED") return "red";
  return "orange";
}

function statusLabel(status: string) {
  return ({ ACTIVE: "Aktif", PENDING: "Menunggu", DISABLED: "Nonaktif", REJECTED: "Ditolak", COMPLETED: "Selesai" } as Record<string, string>)[status] || status;
}

export default function Dashboard({ viewerName, viewerRole, period, students, incomingCount, documentCount, currentTime }: DashboardProps) {
  const router = useRouter();
  const [active, setActive] = useState("Ringkasan");
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const filtered = useMemo(
    () => students.filter(s => (s.name + s.nim + s.program).toLowerCase().includes(search.toLowerCase())),
    [search, students],
  );
  const activeStudents = students.filter(s => s.status === "ACTIVE").length;
  const referenceTime = new Date(currentTime).getTime();
  const followup = students.filter(s => referenceTime - new Date(s.updatedAt).getTime() > 14 * 86_400_000).length;
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of students) counts.set(student.stage, (counts.get(student.stage) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [students]);
  const maxStage = Math.max(...stageCounts.map(([, count]) => count), 1);
  const initials = viewerName.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();

  const choose = (label: string) => {
    setActive(label);
    setMobile(false);
    if (label !== "Ringkasan" && label !== "Mahasiswa") setToast(`${label} belum memiliki data.`);
  };

  async function logout() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return <div className="app-shell">
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <div className="side-brand"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>AKADEMIK</small></div><button aria-label="Tutup menu" onClick={() => setMobile(false)}><X/></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => choose(label)}><Icon/>{label}{label === "Bimbingan Masuk" && incomingCount > 0 && <em>{incomingCount}</em>}</button>)}</nav>
      <div className="side-bottom"><button><CircleHelp/> Pusat Bantuan</button><button><Settings/> Pengaturan</button><button onClick={logout}><LogOut/> Keluar</button><div className="profile-mini"><span>{initials || "AK"}</span><p><b>{viewerName}</b><small>{viewerRole}</small></p><ChevronDown/></div></div>
    </aside>
    {mobile && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobile(false)}/>}
    <main className="dashboard-main">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobile(true)} aria-label="Buka menu"><Menu/></button><div className="search"><Search/><input aria-label="Cari mahasiswa atau dokumen" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari mahasiswa, NIM, atau dokumen…"/></div><button className="term">{period} <ChevronDown/></button><button className="bell" aria-label="Notifikasi"><Bell/></button></header>
      <div className="content">
        <div className="welcome"><div><span>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date())}</span><h1>{active}</h1><p>Selamat datang, {viewerName}. Data berikut dibaca langsung dari Neon.</p></div><button className="button primary" onClick={() => setToast("Belum ada bimbingan baru.")}><MessageSquareText/> Buka konsultasi</button></div>
        {active === "Ringkasan" && <>
          <section className="metric-grid">
            <article><span className="metric-icon blue"><UsersRound/></span><div><small>Mahasiswa aktif</small><b>{activeStudents}</b><p>{students.length} akun terdaftar</p></div></article>
            <article><span className="metric-icon cyan"><MessageSquareText/></span><div><small>Bimbingan masuk</small><b>{incomingCount}</b><p>Menunggu ditinjau</p></div></article>
            <article><span className="metric-icon violet"><FileText/></span><div><small>Dokumen tersimpan</small><b>{documentCount}</b><p>Belum diarsipkan</p></div></article>
            <article><span className="metric-icon amber"><Clock3/></span><div><small>Perlu follow-up</small><b>{followup}</b><p>Tidak diperbarui 14 hari</p></div></article>
          </section>
          {students.length === 0 ? <section className="empty panel dashboard-empty"><span><UsersRound/></span><h2>Belum ada mahasiswa</h2><p>Data mahasiswa akan muncul otomatis setelah mahasiswa membuat akun, melengkapi profil, dan disetujui.</p></section> :
          <section className="dash-grid">
            <article className="panel stage-panel"><header><div><h2>Mahasiswa berdasarkan tahap</h2><p>Distribusi progres saat ini</p></div></header><div className="stage-bars">{stageCounts.map(([label, count]) => <div key={label}><span>{label}</span><div><i style={{ width: `${(count / maxStage) * 100}%` }}/></div><b>{count}</b></div>)}</div></article>
            <article className="panel activity-panel"><header><div><h2>Pembaruan terbaru</h2><p>Aktivitas data mahasiswa</p></div></header>{students.slice(0, 4).map((student, index) => <div className="activity-row" key={student.nim}><span className={`student-avatar a${index}`}>{student.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</span><p><b>{student.name}</b><small>{student.stage}</small></p><time>{relativeTime(student.updatedAt, currentTime)}</time></div>)}</article>
          </section>}
        </>}
        {(active === "Mahasiswa" || search) && <section className="panel student-panel"><header><div><h2>Mahasiswa bimbingan</h2><p>{filtered.length} mahasiswa ditemukan</p></div><div className="mini-search"><Search/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari mahasiswa…"/></div></header>
          {filtered.length === 0 ? <div className="empty"><span><Search/></span><h2>Tidak ada data mahasiswa</h2><p>Daftar ini akan terisi dari database Neon.</p></div> :
          <div className="student-table"><div className="table-head"><span>Mahasiswa</span><span>Program</span><span>Tahap & progres</span><span>Status</span><span>Terakhir</span></div>{filtered.map((student, index) => <button className="student-row" key={student.nim} onClick={() => setToast(`Membuka data ${student.name}`)}><span className="student-name"><i className={`student-avatar a${index}`}>{student.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</i><p><b>{student.name}</b><small>{student.nim}</small></p></span><span>{student.program}</span><span className="stage-cell"><b>{student.stage}</b><i><em style={{ width: `${student.progress}%` }}/></i><small>{student.progress}%</small></span><span><i className={`status ${statusTone(student.status)}`}>{statusLabel(student.status)}</i></span><span>{relativeTime(student.updatedAt, currentTime)}</span></button>)}</div>}
        </section>}
        {active !== "Ringkasan" && active !== "Mahasiswa" && !search && <section className="empty panel"><span><Sparkles/></span><h2>{active}</h2><p>Belum ada data pada modul ini. Data baru akan tampil setelah digunakan.</p><button className="button primary" onClick={() => setActive("Ringkasan")}>Kembali ke ringkasan</button></section>}
      </div>
    </main>
    {toast && <div className="toast" role="status"><UserRoundCheck/><span>{toast}</span><button aria-label="Tutup" onClick={() => setToast("")}><X/></button></div>}
  </div>;
}
