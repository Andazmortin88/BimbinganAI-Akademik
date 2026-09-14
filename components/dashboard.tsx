"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, Bell, Bot, CalendarDays, ChevronDown, CircleHelp, Clock3, Download,
  FileText, GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquareText,
  Search, Send, Settings, Sparkles, UserRoundCheck, UsersRound, X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import type { DashboardAppointment, DashboardConsultation, DashboardDocument, DashboardReview, DashboardStudent } from "@/components/dashboard-types";

export type { DashboardStudent } from "@/components/dashboard-types";

type Props = {
  viewerName: string;
  viewerRole: "ADMIN" | "LECTURER";
  period: string;
  students: DashboardStudent[];
  consultations: DashboardConsultation[];
  documents: DashboardDocument[];
  appointments: DashboardAppointment[];
  reviews: DashboardReview[];
  currentTime: string;
};

const adminNav = [
  ["Ringkasan", LayoutDashboard], ["Mahasiswa", UsersRound], ["Bimbingan Masuk", MessageSquareText],
  ["Dokumen", FileText], ["AI Review Center", Bot], ["Jadwal", CalendarDays], ["Arsip Bimbingan", Archive],
] as const;
const lecturerNav = [
  ["Ringkasan", LayoutDashboard], ["Mahasiswa Bimbingan", UsersRound], ["Bimbingan Masuk", MessageSquareText],
  ["Dokumen", FileText], ["Jadwal", CalendarDays], ["Arsip Bimbingan", Archive],
] as const;

const statusLabel = (status: string) => ({ ACTIVE: "Aktif", PENDING: "Menunggu", DISABLED: "Nonaktif", REJECTED: "Ditolak", COMPLETED: "Selesai", SUBMITTED: "Dikirim", IN_REVIEW: "Ditinjau", REVISION: "Revisi", APPROVED: "Disetujui", DONE: "Selesai", FAILED: "Gagal" } as Record<string, string>)[status] || status;
const statusTone = (status: string) => status === "ACTIVE" || status === "APPROVED" || status === "COMPLETED" ? "green" : status === "PENDING" || status === "SUBMITTED" ? "yellow" : status === "REJECTED" || status === "FAILED" ? "red" : "orange";
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function Dashboard({ viewerName, viewerRole, period, students, consultations, documents, appointments, reviews, currentTime }: Props) {
  const router = useRouter();
  const nav = viewerRole === "ADMIN" ? adminNav : lecturerNav;
  const [studentRecords, setStudentRecords] = useState(students);
  const [active, setActive] = useState("Ringkasan");
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [aiDocument, setAiDocument] = useState(documents.find(item => item.canAiReview)?.id || "");
  const [aiMode, setAiMode] = useState("QUICK");
  const [aiItems, setAiItems] = useState<Array<{ category: string; severity: string; finding: string; suggestion: string }>>([]);
  const filtered = useMemo(() => studentRecords.filter(s => `${s.name} ${s.nim} ${s.program}`.toLowerCase().includes(search.toLowerCase())), [search, studentRecords]);
  const activeStudents = studentRecords.filter(s => s.status === "ACTIVE").length;
  const incomingCount = consultations.filter(c => c.status === "SUBMITTED" || c.status === "WAITING_REVIEW").length;
  const referenceTime = new Date(currentTime).getTime();
  const followup = studentRecords.filter(s => referenceTime - new Date(s.updatedAt).getTime() > 14 * 86_400_000).length;
  const initials = viewerName.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

  async function logout() { await authClient.signOut(); router.replace("/"); router.refresh(); }
  async function updateStudentStatus(student: DashboardStudent, status: "ACTIVE" | "REJECTED") {
    if (status === "REJECTED" && !window.confirm(`Tolak registrasi ${student.name}?`)) return;
    setBusy(student.id);
    const response = await fetch(`/api/admin/students/${student.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "Status gagal diperbarui.");
    setStudentRecords(list => list.map(item => item.id === student.id ? { ...item, status } : item));
    setToast(status === "ACTIVE" ? `${student.name} berhasil diaktifkan.` : `${student.name} ditolak.`);
    router.refresh();
  }
  async function sendReply(event: FormEvent, threadId: string) {
    event.preventDefault();
    const message = reply[threadId]?.trim();
    if (!message) return;
    setBusy(threadId);
    const response = await fetch(`/api/consultations/${threadId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "Balasan gagal dikirim.");
    setReply(value => ({ ...value, [threadId]: "" }));
    setToast("Balasan berhasil dikirim.");
    router.refresh();
  }
  async function runAiReview() {
    if (!aiDocument) return setToast("Pilih dokumen .docx terlebih dahulu.");
    setBusy("ai"); setAiItems([]);
    const response = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentVersionId: aiDocument, mode: aiMode }) });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "AI Review gagal dijalankan.");
    setAiItems(result.items || []); setToast("AI Review selesai dan hasil telah disimpan."); router.refresh();
  }

  const choose = (label: string) => { setActive(label); setMobile(false); setSearch(""); };
  return <div className="app-shell admin-shell">
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <div className="side-brand"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>{viewerRole === "ADMIN" ? "PANEL ADMIN" : "PANEL DOSEN"}</small></div><button aria-label="Tutup menu" onClick={() => setMobile(false)}><X/></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => choose(label)}><Icon/>{label}{label === "Bimbingan Masuk" && incomingCount > 0 && <em>{incomingCount}</em>}</button>)}</nav>
      <div className="side-bottom"><button><CircleHelp/> Pusat Bantuan</button><button><Settings/> Pengaturan</button><button onClick={logout}><LogOut/> Keluar</button><div className="profile-mini"><span>{initials}</span><p><b>{viewerName}</b><small>{viewerRole === "ADMIN" ? "Administrator" : "Dosen"}</small></p><ChevronDown/></div></div>
    </aside>
    {mobile && <button className="scrim" aria-label="Tutup menu" onClick={() => setMobile(false)}/>}
    <main className="dashboard-main">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobile(true)}><Menu/></button><div className="search"><Search/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari mahasiswa atau NIM…"/></div><button className="term">{period} <ChevronDown/></button><button className="bell"><Bell/></button></header>
      <div className="content">
        <div className="welcome"><div><span>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date())}</span><h1>{active}</h1><p>{viewerRole === "ADMIN" ? "Kelola layanan akademik dan akun mahasiswa." : "Kelola mahasiswa yang ditugaskan kepada Anda."}</p></div><button className="button primary" onClick={() => setActive("Bimbingan Masuk")}><MessageSquareText/> Buka konsultasi</button></div>

        {active === "Ringkasan" && <><section className="metric-grid">
          <article><span className="metric-icon blue"><UsersRound/></span><div><small>Mahasiswa aktif</small><b>{activeStudents}</b><p>{studentRecords.length} akun terlihat</p></div></article>
          <article><span className="metric-icon cyan"><MessageSquareText/></span><div><small>Bimbingan masuk</small><b>{incomingCount}</b><p>Menunggu balasan</p></div></article>
          <article><span className="metric-icon violet"><FileText/></span><div><small>Dokumen</small><b>{documents.length}</b><p>Versi tersimpan</p></div></article>
          <article><span className="metric-icon amber"><Clock3/></span><div><small>Perlu tindak lanjut</small><b>{followup}</b><p>Lebih dari 14 hari</p></div></article>
        </section><section className="panel module-panel"><header><div><h2>Aktivitas terbaru</h2><p>Data langsung dari Neon</p></div></header><div className="record-list">{consultations.slice(0, 5).map(c => <button key={c.id} onClick={() => setActive("Bimbingan Masuk")}><MessageSquareText/><span><b>{c.studentName}</b><small>{c.subject}</small></span><i className={`status ${statusTone(c.status)}`}>{statusLabel(c.status)}</i></button>)}{consultations.length === 0 && <Empty text="Belum ada konsultasi masuk."/>}</div></section></>}

        {(active === "Mahasiswa" || active === "Mahasiswa Bimbingan" || search) && <section className="panel student-panel"><header><div><h2>{viewerRole === "ADMIN" ? "Semua mahasiswa" : "Mahasiswa bimbingan"}</h2><p>{filtered.length} mahasiswa ditemukan</p></div></header>{filtered.length === 0 ? <Empty text="Belum ada mahasiswa pada daftar ini."/> : <div className="student-table"><div className="table-head"><span>Mahasiswa</span><span>Program</span><span>Tahap & progres</span><span>Status / tindakan</span><span>Terakhir</span></div>{filtered.map((student, i) => <div className="student-row" key={student.id}><span className="student-name"><i className={`student-avatar a${i % 5}`}>{student.name.split(" ").map(x => x[0]).join("").slice(0,2)}</i><p><b>{student.name}</b><small>{student.nim}</small></p></span><span>{student.program}</span><span className="stage-cell"><b>{student.stage}</b><i><em style={{width:`${student.progress}%`}}/></i><small>{student.progress}%</small></span><span className="approval-cell"><i className={`status ${statusTone(student.status)}`}>{statusLabel(student.status)}</i>{viewerRole === "ADMIN" && student.status === "PENDING" && <span className="approval-actions"><button disabled={busy===student.id} onClick={() => updateStudentStatus(student,"ACTIVE")}>Setujui</button><button className="reject" disabled={busy===student.id} onClick={() => updateStudentStatus(student,"REJECTED")}>Tolak</button></span>}</span><span>{formatDate(student.updatedAt)}</span></div>)}</div>}</section>}

        {active === "Bimbingan Masuk" && <section className="module-grid">{consultations.map(c => <article className="panel conversation" key={c.id}><header><div><h2>{c.subject}</h2><p>{c.studentName} · {statusLabel(c.status)}</p></div></header><div className="messages">{c.messages.map(m => <div className={m.senderRole === viewerRole ? "mine" : ""} key={m.id}><b>{m.senderName}</b><p>{m.body}</p><small>{formatDate(m.createdAt)}</small></div>)}</div><form className="reply-form" onSubmit={e => sendReply(e,c.id)}><input value={reply[c.id] || ""} onChange={e => setReply(v => ({...v,[c.id]:e.target.value}))} placeholder="Tulis balasan…"/><button disabled={busy===c.id}><Send/></button></form></article>)}{consultations.length===0 && <section className="panel"><Empty text="Belum ada konsultasi dari mahasiswa."/></section>}</section>}

        {active === "Dokumen" && <section className="panel module-panel"><header><div><h2>Dokumen mahasiswa</h2><p>{documents.length} versi dokumen tersedia</p></div></header><div className="document-list">{documents.map(d => <div key={d.id}><FileText/><span><b>{d.name}</b><small>{d.studentName} · {d.category} · Versi {d.version} · {formatSize(d.sizeBytes)}</small></span><i className={`status ${statusTone(d.status)}`}>{statusLabel(d.status)}</i><a className="icon-action" href={`/api/documents/${d.id}/download`} title="Unduh"><Download/></a></div>)}{documents.length===0 && <Empty text="Belum ada dokumen yang diunggah."/>}</div></section>}

        {active === "AI Review Center" && viewerRole === "ADMIN" && <><section className="panel ai-console"><header><div><h2>AI Review privat</h2><p>Hanya administrator yang dapat menjalankan dan melihat hasil awal.</p></div></header><div className="ai-controls"><label>Dokumen<select value={aiDocument} onChange={e => setAiDocument(e.target.value)}><option value="">Pilih dokumen .docx</option>{documents.filter(d=>d.canAiReview).map(d=><option value={d.id} key={d.id}>{d.studentName} — {d.name}</option>)}</select></label><label>Mode<select value={aiMode} onChange={e=>setAiMode(e.target.value)}><option value="QUICK">Pemeriksaan cepat</option><option value="LANGUAGE">Bahasa akademik</option><option value="FULL">Review lengkap</option><option value="EXAMINER">Pertanyaan penguji</option></select></label><button className="button primary" disabled={busy==="ai" || !aiDocument} onClick={runAiReview}><Sparkles/> {busy==="ai" ? "Sedang meninjau…" : "Jalankan AI Review"}</button></div></section>{aiItems.length>0 && <section className="panel result-list"><header><div><h2>Hasil review terbaru</h2><p>Periksa kembali sebelum dibagikan kepada mahasiswa.</p></div></header>{aiItems.map((item,i)=><article key={i}><i className={`status ${item.severity==="MAJOR"?"red":item.severity==="LANGUAGE"?"yellow":"orange"}`}>{item.severity}</i><div><b>{item.category}</b><p>{item.finding}</p><small>Saran: {item.suggestion}</small></div></article>)}</section>}<section className="panel module-panel"><header><div><h2>Riwayat AI Review</h2><p>Hasil yang tersimpan</p></div></header><div className="record-list">{reviews.map(r=><div className="static-record" key={r.id}><Bot/><span><b>{r.documentName}</b><small>{r.studentName} · {r.mode} · {r.itemCount} temuan</small></span><i className={`status ${statusTone(r.status)}`}>{statusLabel(r.status)}</i></div>)}{reviews.length===0&&<Empty text="Belum ada AI Review."/>}</div></section></>}

        {active === "Jadwal" && <section className="panel module-panel"><header><div><h2>Jadwal bimbingan</h2><p>Agenda yang telah dibuat</p></div></header><div className="record-list">{appointments.map(a=><div className="static-record" key={a.id}><CalendarDays/><span><b>{a.topic}</b><small>{a.studentName} · {formatDate(a.startsAt)} · {a.method}</small></span><i className={`status ${statusTone(a.decision)}`}>{statusLabel(a.decision)}</i></div>)}{appointments.length===0&&<Empty text="Belum ada jadwal bimbingan."/>}</div></section>}
        {active === "Arsip Bimbingan" && <section className="panel"><Empty text="Belum ada proyek atau bimbingan yang diarsipkan."/></section>}
      </div>
    </main>
    {toast && <div className="toast" role="status"><UserRoundCheck/><span>{toast}</span><button onClick={()=>setToast("")}><X/></button></div>}
  </div>;
}

function Empty({text}:{text:string}) { return <div className="empty compact-empty"><span><Sparkles/></span><h2>{text}</h2><p>Informasi akan tampil otomatis setelah fitur digunakan.</p></div>; }

