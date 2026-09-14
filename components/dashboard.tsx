"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, Bell, Bot, CalendarDays, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Clock3, Download,
  FileText, GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquareText,
  Search, Send, Settings, SlidersHorizontal, Sparkles, Trash2, UserRoundCheck, UsersRound, X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import type { DashboardAiSettings, DashboardAppointment, DashboardConsultation, DashboardDocument, DashboardReview, DashboardStudent } from "@/components/dashboard-types";

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
  aiSettings: DashboardAiSettings;
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

export default function Dashboard({ viewerName, viewerRole, period, students, consultations, documents, appointments, reviews, aiSettings, currentTime }: Props) {
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
  const [aiConfig, setAiConfig] = useState(aiSettings);
  const filtered = useMemo(() => studentRecords.filter(s => `${s.name} ${s.nim} ${s.program}`.toLowerCase().includes(search.toLowerCase())), [search, studentRecords]);
  const activeStudents = studentRecords.filter(s => s.status === "ACTIVE").length;
  const incomingCount = consultations.filter(c => c.status === "SUBMITTED" || c.status === "WAITING_REVIEW").length;
  const referenceTime = new Date(currentTime).getTime();
  const followup = studentRecords.filter(s => referenceTime - new Date(s.updatedAt).getTime() > 14 * 86_400_000).length;
  const initials = viewerName.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
  const archivedStudents = studentRecords.filter(student => student.status === "COMPLETED" || Boolean(student.archivedAt));

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

  async function setEligibility(student: DashboardStudent, examType: "PROPOSAL" | "RESULT", decision: "NOT_YET" | "ELIGIBLE") {
    if (!student.projectId) return setToast("Proyek mahasiswa belum tersedia.");
    setBusy(`${student.id}-${examType}`);
    const response = await fetch(`/api/projects/${student.projectId}/workflow`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_ELIGIBILITY", examType, decision }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "Keputusan ujian gagal disimpan.");
    setStudentRecords(list => list.map(item => item.id === student.id ? {
      ...item, [examType === "PROPOSAL" ? "proposalEligibility" : "resultEligibility"]: decision,
    } : item));
    setToast(`${examType === "PROPOSAL" ? "Ujian proposal" : "Ujian hasil"}: ${decision === "ELIGIBLE" ? "layak" : "belum layak"}.`);
    router.refresh();
  }

  async function completeAndArchive(student: DashboardStudent) {
    if (!student.projectId) return setToast("Proyek mahasiswa belum tersedia.");
    if (!window.confirm(`Tandai ${student.name} selesai dan pindahkan ke arsip?`)) return;
    setBusy(`${student.id}-complete`);
    const response = await fetch(`/api/projects/${student.projectId}/workflow`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "COMPLETE_AND_ARCHIVE" }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "Mahasiswa belum dapat diarsipkan.");
    setStudentRecords(list => list.map(item => item.id === student.id ? {
      ...item, status: "COMPLETED", stage: "Selesai", progress: 100, archivedAt: new Date().toISOString(),
    } : item));
    setToast(`${student.name} telah selesai dan masuk arsip.`);
    router.refresh();
  }

  async function purgeStudent(student: DashboardStudent) {
    const confirmation = window.prompt(`Penghapusan ini permanen untuk dokumen, konsultasi, jadwal, dan proyek.\nKetik tepat: HAPUS ${student.nim}`);
    if (confirmation === null) return;
    setBusy(`${student.id}-purge`);
    const response = await fetch(`/api/admin/students/${student.id}/purge`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "Data mahasiswa gagal dihapus.");
    setStudentRecords(list => list.filter(item => item.id !== student.id));
    setToast(`Data akademik ${student.name} berhasil dihapus.`);
    router.refresh();
  }

  async function saveAiSettings(event: FormEvent) {
    event.preventDefault(); setBusy("ai-settings");
    const response = await fetch("/api/admin/ai-settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiConfig),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setToast(result.error || "Konfigurasi AI gagal disimpan.");
    setAiConfig(value => ({ ...value, apiConfigured: Boolean(result.apiConfigured) }));
    setToast("Konfigurasi AI Review berhasil disimpan.");
    router.refresh();
  }

  const choose = (label: string) => { setActive(label); setMobile(false); setSearch(""); };
  return <div className="app-shell admin-shell">
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <div className="side-brand"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>{viewerRole === "ADMIN" ? "PANEL ADMIN" : "PANEL DOSEN"}</small></div><button aria-label="Tutup menu" onClick={() => setMobile(false)}><X/></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => choose(label)}><Icon/>{label}{label === "Bimbingan Masuk" && incomingCount > 0 && <em>{incomingCount}</em>}</button>)}</nav>
      <div className="side-bottom"><button onClick={() => choose("Pusat Bantuan")}><CircleHelp/> Pusat Bantuan</button><button onClick={() => choose("Pengaturan")}><Settings/> Pengaturan</button><button onClick={logout}><LogOut/> Keluar</button><div className="profile-mini"><span>{initials}</span><p><b>{viewerName}</b><small>{viewerRole === "ADMIN" ? "Administrator" : "Dosen"}</small></p><ChevronDown/></div></div>
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

        {(active === "Mahasiswa" || active === "Mahasiswa Bimbingan" || search) && <>
          <section className="panel student-panel">
            <header><div><h2>{viewerRole === "ADMIN" ? "Semua mahasiswa" : "Mahasiswa bimbingan"}</h2><p>{filtered.length} mahasiswa ditemukan</p></div></header>
            {filtered.length === 0 ? <Empty text="Belum ada mahasiswa pada daftar ini."/> : <div className="student-table">
              <div className="table-head"><span>Mahasiswa</span><span>Program</span><span>Tahap</span><span>Konsultasi</span><span>Status</span><span>Terakhir</span></div>
              {filtered.map((student, i) => <div className="student-row" key={student.id}>
                <span className="student-name"><i className={`student-avatar a${i % 5}`}>{student.name.split(" ").map(x => x[0]).join("").slice(0,2)}</i><p><b>{student.name}</b><small>{student.nim}</small></p></span>
                <span>{student.program}</span>
                <span className="stage-cell"><b>{student.stage}</b><i><em style={{width:`${student.progress}%`}}/></i><small>{student.progress}%</small></span>
                <span className="consultation-summary"><b>{student.consultationCount} kali</b><small title={student.consultationTopics.join(" · ")}>{student.consultationTopics.slice(0,2).join(" · ") || "Belum ada topik"}</small></span>
                <span className="approval-cell"><i className={`status ${statusTone(student.status)}`}>{statusLabel(student.status)}</i>{viewerRole === "ADMIN" && student.status === "PENDING" && <span className="approval-actions"><button disabled={busy===student.id} onClick={() => updateStudentStatus(student,"ACTIVE")}>Setujui</button><button className="reject" disabled={busy===student.id} onClick={() => updateStudentStatus(student,"REJECTED")}>Tolak</button></span>}</span>
                <span>{formatDate(student.updatedAt)}</span>
              </div>)}
            </div>}
          </section>
          <section className="panel decision-panel">
            <header><div><h2>Keputusan kelayakan ujian</h2><p>Dosen dapat menandai kelayakan proposal dan hasil berdasarkan proses bimbingan.</p></div></header>
            <div className="decision-grid">{filtered.filter(student => student.status === "ACTIVE" && student.projectId).map(student => <article key={student.id}>
              <div className="decision-student"><ClipboardList/><span><b>{student.name}</b><small>{student.nim} · {student.consultationCount} konsultasi</small></span></div>
              <ExamDecision label="Ujian proposal" value={student.proposalEligibility} busy={busy===`${student.id}-PROPOSAL`} onChange={decision=>setEligibility(student,"PROPOSAL",decision)}/>
              <ExamDecision label="Ujian hasil" value={student.resultEligibility} busy={busy===`${student.id}-RESULT`} onChange={decision=>setEligibility(student,"RESULT",decision)}/>
              {viewerRole === "ADMIN" && <button className="complete-button" disabled={busy===`${student.id}-complete` || student.resultEligibility!=="ELIGIBLE"} onClick={()=>completeAndArchive(student)}><CheckCircle2/> Selesai & arsipkan</button>}
            </article>)}</div>
          </section>
        </>}

        {active === "Bimbingan Masuk" && <section className="module-grid">{consultations.map(c => <article className="panel conversation" key={c.id}><header><div><h2>{c.subject}</h2><p>{c.studentName} · {statusLabel(c.status)}</p></div></header><div className="messages">{c.messages.map(m => <div className={m.senderRole === viewerRole ? "mine" : ""} key={m.id}><b>{m.senderName}</b><p>{m.body}</p><small>{formatDate(m.createdAt)}</small></div>)}</div><form className="reply-form" onSubmit={e => sendReply(e,c.id)}><input value={reply[c.id] || ""} onChange={e => setReply(v => ({...v,[c.id]:e.target.value}))} placeholder="Tulis balasan…"/><button disabled={busy===c.id}><Send/></button></form></article>)}{consultations.length===0 && <section className="panel"><Empty text="Belum ada konsultasi dari mahasiswa."/></section>}</section>}

        {active === "Dokumen" && <section className="panel module-panel"><header><div><h2>Dokumen mahasiswa</h2><p>{documents.length} versi dokumen tersedia</p></div></header><div className="document-list">{documents.map(d => <div key={d.id}><FileText/><span><b>{d.name}</b><small>{d.studentName} · {d.category} · Versi {d.version} · {formatSize(d.sizeBytes)}</small></span><i className={`status ${statusTone(d.status)}`}>{statusLabel(d.status)}</i><a className="icon-action" href={`/api/documents/${d.id}/download`} title="Unduh"><Download/></a></div>)}{documents.length===0 && <Empty text="Belum ada dokumen yang diunggah."/>}</div></section>}

        {active === "AI Review Center" && viewerRole === "ADMIN" && <>
          <section className="panel ai-console"><header><div><h2>AI Review privat</h2><p>Hanya administrator yang dapat menjalankan dan melihat hasil awal.</p>{aiConfig.providerIssue&&<small className="provider-warning">{aiConfig.providerIssue}</small>}</div><i className={`status ${aiConfig.enabled&&aiConfig.apiConfigured&&!aiConfig.providerIssue?"green":"red"}`}>{aiConfig.enabled&&aiConfig.apiConfigured&&!aiConfig.providerIssue?"Siap digunakan":aiConfig.providerIssue?"Butuh aktivasi provider":"Perlu konfigurasi"}</i></header><div className="ai-controls"><label>Dokumen<select value={aiDocument} onChange={e => setAiDocument(e.target.value)}><option value="">Pilih dokumen .docx</option>{documents.filter(d=>d.canAiReview).map(d=><option value={d.id} key={d.id}>{d.studentName} — {d.name}</option>)}</select></label><label>Mode<select value={aiMode} onChange={e=>setAiMode(e.target.value)}><option value="QUICK">Pemeriksaan cepat</option><option value="LANGUAGE">Bahasa akademik</option><option value="FULL">Review lengkap</option><option value="EXAMINER">Pertanyaan penguji</option></select></label><button className="button primary" disabled={busy==="ai" || !aiDocument || !aiConfig.enabled || !aiConfig.apiConfigured} onClick={runAiReview}><Sparkles/> {busy==="ai" ? "Sedang meninjau…" : "Jalankan AI Review"}</button></div></section>
          <section className="panel ai-settings-panel"><header><div><h2>Konfigurasi AI Review</h2><p>Akses AI dikelola aman oleh server melalui identitas Vercel atau kunci privat.</p></div><SlidersHorizontal/></header><form onSubmit={saveAiSettings}><label className="toggle-setting"><input type="checkbox" checked={aiConfig.enabled} onChange={e=>setAiConfig(v=>({...v,enabled:e.target.checked}))}/><span><b>Aktifkan AI Review</b><small>{aiConfig.apiConfigured?"Layanan AI siap digunakan.":"Layanan AI belum dikonfigurasi di server."}</small></span></label><div className="ai-setting-row"><label>Model<input value={aiConfig.modelName} onChange={e=>setAiConfig(v=>({...v,modelName:e.target.value}))} required/></label><label>Maksimal temuan<input type="number" min="1" max="30" value={aiConfig.maxFindings} onChange={e=>setAiConfig(v=>({...v,maxFindings:Number(e.target.value)}))} required/></label></div><label>Instruksi review<textarea minLength={20} maxLength={5000} value={aiConfig.customInstructions} onChange={e=>setAiConfig(v=>({...v,customInstructions:e.target.value}))} required/></label><button className="button primary" disabled={busy==="ai-settings"}><Settings/>{busy==="ai-settings"?"Menyimpan…":"Simpan konfigurasi"}</button></form></section>
          {aiItems.length>0 && <section className="panel result-list"><header><div><h2>Hasil review terbaru</h2><p>Periksa kembali sebelum dibagikan kepada mahasiswa.</p></div></header>{aiItems.map((item,i)=><article key={i}><i className={`status ${item.severity==="MAJOR"?"red":item.severity==="LANGUAGE"?"yellow":"orange"}`}>{item.severity}</i><div><b>{item.category}</b><p>{item.finding}</p><small>Saran: {item.suggestion}</small></div></article>)}</section>}
          <section className="panel module-panel"><header><div><h2>Riwayat AI Review</h2><p>Hasil yang tersimpan</p></div></header><div className="record-list">{reviews.map(r=><div className="static-record" key={r.id}><Bot/><span><b>{r.documentName}</b><small>{r.studentName} · {r.mode} · {r.itemCount} temuan</small></span><i className={`status ${statusTone(r.status)}`}>{statusLabel(r.status)}</i></div>)}{reviews.length===0&&<Empty text="Belum ada AI Review."/>}</div></section>
        </>}

        {active === "Jadwal" && <section className="panel module-panel"><header><div><h2>Jadwal bimbingan</h2><p>Agenda yang telah dibuat</p></div></header><div className="record-list">{appointments.map(a=><div className="static-record" key={a.id}><CalendarDays/><span><b>{a.topic}</b><small>{a.studentName} · {formatDate(a.startsAt)} · {a.method}</small></span><i className={`status ${statusTone(a.decision)}`}>{statusLabel(a.decision)}</i></div>)}{appointments.length===0&&<Empty text="Belum ada jadwal bimbingan."/>}</div></section>}
        {active === "Arsip Bimbingan" && <section className="panel archive-panel"><header><div><h2>Mahasiswa selesai</h2><p>{archivedStudents.length} mahasiswa tersimpan dalam arsip.</p></div></header>{archivedStudents.length===0?<Empty text="Belum ada proyek atau bimbingan yang diarsipkan."/>:<div className="archive-grid">{archivedStudents.map(student=><article key={student.id}><Archive/><div><b>{student.name}</b><small>{student.nim} · {student.program} · {student.consultationCount} konsultasi</small><p>{student.consultationTopics.join(" · ") || "Tidak ada topik konsultasi"}</p></div>{viewerRole==="ADMIN"&&<button className="danger-button" disabled={busy===`${student.id}-purge`} onClick={()=>purgeStudent(student)}><Trash2/>{busy===`${student.id}-purge`?"Menghapus…":"Hapus data"}</button>}</article>)}</div>}</section>}
        {active === "Pusat Bantuan" && <section className="panel help-panel"><header><div><h2>Panduan singkat</h2><p>Cara menggunakan panel {viewerRole === "ADMIN" ? "administrator" : "dosen"}.</p></div></header><div className="help-grid"><article><UsersRound/><b>Kelola mahasiswa</b><p>Buka Mahasiswa untuk melihat status akun dan menyetujui pendaftar baru.</p></article><article><MessageSquareText/><b>Balas konsultasi</b><p>Buka Bimbingan Masuk, pilih percakapan, lalu tulis balasan.</p></article><article><FileText/><b>Periksa dokumen</b><p>Dokumen mahasiswa dapat dilihat dan diunduh dari menu Dokumen.</p></article>{viewerRole === "ADMIN" && <article><Bot/><b>Gunakan AI Review</b><p>Pilih berkas .docx, tentukan mode, lalu periksa kembali hasil AI sebelum digunakan.</p></article>}</div></section>}
        {active === "Pengaturan" && <section className="panel profile-card"><header><div><h2>Pengaturan akun</h2><p>Identitas dan keamanan akun yang sedang digunakan.</p></div></header><dl><div><dt>Nama pengguna</dt><dd>{viewerName}</dd></div><div><dt>Peran</dt><dd>{viewerRole === "ADMIN" ? "Administrator" : "Dosen"}</dd></div><div><dt>Status</dt><dd><i className="status green">Aktif</i></dd></div><div><dt>Keamanan</dt><dd>Login dan sesi dikelola oleh Neon Auth.</dd></div></dl></section>}
      </div>
    </main>
    {toast && <div className="toast" role="status"><UserRoundCheck/><span>{toast}</span><button onClick={()=>setToast("")}><X/></button></div>}
  </div>;
}

function Empty({text}:{text:string}) { return <div className="empty compact-empty"><span><Sparkles/></span><h2>{text}</h2><p>Informasi akan tampil otomatis setelah fitur digunakan.</p></div>; }

function ExamDecision({ label, value, busy, onChange }: {
  label: string; value: string; busy: boolean; onChange: (decision: "NOT_YET" | "ELIGIBLE") => void;
}) {
  return <div className="exam-decision"><span><b>{label}</b><small>{value === "ELIGIBLE" ? "Layak mengikuti ujian" : value === "NOT_YET" ? "Belum layak" : "Belum dinilai"}</small></span><div><button disabled={busy} className={value === "NOT_YET" ? "selected no" : ""} onClick={()=>onChange("NOT_YET")}>Belum layak</button><button disabled={busy} className={value === "ELIGIBLE" ? "selected yes" : ""} onClick={()=>onChange("ELIGIBLE")}>Layak</button></div></div>;
}
