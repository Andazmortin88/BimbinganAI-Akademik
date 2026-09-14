"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, CalendarDays, ChevronDown, CircleHelp, Download, FileText, GraduationCap,
  LayoutDashboard, LogOut, Menu, MessageCirclePlus, MessageSquareText, Send,
  Settings, UploadCloud, UserRound, UserRoundCheck, X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import type { DashboardAppointment, DashboardConsultation, DashboardDocument, DashboardStudent } from "@/components/dashboard-types";

type Props = {
  viewerName: string;
  period: string;
  student: DashboardStudent;
  consultations: DashboardConsultation[];
  documents: DashboardDocument[];
  appointments: DashboardAppointment[];
};

const nav = [
  ["Beranda Saya", LayoutDashboard], ["Konsultasi", MessageSquareText], ["Dokumen Skripsi", FileText],
  ["Jadwal Bimbingan", CalendarDays], ["Profil Saya", UserRound],
] as const;
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes/1024)} KB` : `${(bytes/1024/1024).toFixed(1)} MB`;
const statusLabel = (status: string) => ({ ACTIVE:"Aktif", SUBMITTED:"Menunggu balasan", IN_REVIEW:"Sedang ditinjau", REVISION:"Perlu revisi", APPROVED:"Disetujui", DONE:"Selesai", PENDING:"Menunggu" } as Record<string,string>)[status] || status;
const eligibilityLabel = (value: string) => value === "ELIGIBLE" ? "Layak" : value === "NOT_YET" ? "Belum layak" : "Belum dinilai";

export default function StudentDashboard({ viewerName, period, student, consultations, documents, appointments }: Props) {
  const router = useRouter();
  const [active, setActive] = useState("Beranda Saya");
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<Record<string,string>>({});
  const [category, setCategory] = useState("NASKAH LENGKAP");
  const initials = viewerName.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();

  async function logout(){ await authClient.signOut(); router.replace("/"); router.refresh(); }
  async function openConsultation(event: FormEvent){
    event.preventDefault(); setBusy("consultation");
    const response = await fetch("/api/consultations", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,message})});
    const result = await response.json().catch(()=>({})); setBusy("");
    if(!response.ok) return setToast(result.error || "Konsultasi gagal dikirim.");
    setSubject(""); setMessage(""); setToast("Konsultasi berhasil dikirim kepada pengelola."); router.refresh();
  }
  async function sendReply(event: FormEvent, id: string){
    event.preventDefault(); const text=reply[id]?.trim(); if(!text) return; setBusy(id);
    const response=await fetch(`/api/consultations/${id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
    const result=await response.json().catch(()=>({})); setBusy("");
    if(!response.ok) return setToast(result.error || "Balasan gagal dikirim.");
    setReply(v=>({...v,[id]:""})); setToast("Balasan berhasil dikirim."); router.refresh();
  }
  async function uploadDocument(event: FormEvent<HTMLFormElement>){
    event.preventDefault(); const form=event.currentTarget; const input=form.elements.namedItem("file") as HTMLInputElement;
    if(!input.files?.[0]) return setToast("Pilih berkas Word terlebih dahulu.");
    const data=new FormData(); data.set("file",input.files[0]); data.set("category",category); setBusy("upload");
    const response=await fetch("/api/documents",{method:"POST",body:data}); const result=await response.json().catch(()=>({})); setBusy("");
    if(!response.ok) return setToast(result.error || "Dokumen gagal diunggah.");
    form.reset(); setCategory("NASKAH LENGKAP"); setToast("Dokumen Word berhasil disimpan."); router.refresh();
  }
  function choose(label:string){setActive(label);setMobile(false)}

  return <div className="app-shell student-shell">
    <aside className={mobile?"sidebar open":"sidebar"}>
      <div className="side-brand"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>RUANG MAHASISWA</small></div><button onClick={()=>setMobile(false)}><X/></button></div>
      <nav>{nav.map(([label,Icon])=><button key={label} className={active===label?"active":""} onClick={()=>choose(label)}><Icon/>{label}{label==="Konsultasi"&&consultations.filter(c=>c.status==="IN_REVIEW").length>0&&<em>{consultations.filter(c=>c.status==="IN_REVIEW").length}</em>}</button>)}</nav>
      <div className="student-safety"><UserRoundCheck/><b>Akun mahasiswa aktif</b><small>Data Anda terpisah dan hanya terlihat oleh pengelola.</small></div>
      <div className="side-bottom"><button onClick={()=>choose("Pusat Bantuan")}><CircleHelp/> Pusat Bantuan</button><button onClick={()=>choose("Pengaturan")}><Settings/> Pengaturan</button><button onClick={logout}><LogOut/> Keluar</button><div className="profile-mini"><span>{initials}</span><p><b>{viewerName}</b><small>Mahasiswa · {student.nim}</small></p><ChevronDown/></div></div>
    </aside>
    {mobile&&<button className="scrim" onClick={()=>setMobile(false)}/>}
    <main className="dashboard-main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu/></button><div className="student-page-label"><GraduationCap/><span>Portal Mahasiswa</span></div><button className="term">{period}<ChevronDown/></button><button className="bell"><Bell/></button></header>
      <div className="content">
        <div className="student-welcome"><div><span>RUANG KERJA PRIBADI</span><h1>{active}</h1><p>Halo, {viewerName}. Pantau progres dan kirim pekerjaan Anda dari sini.</p></div><button className="button primary" onClick={()=>setActive("Konsultasi")}><MessageCirclePlus/> Buka konsultasi</button></div>

        {active==="Beranda Saya"&&<><section className="student-hero panel"><div><small>PROGRES SKRIPSI</small><h2>{student.stage}</h2><p>{student.progress}% perjalanan akademik telah tercatat.</p><div><i style={{width:`${student.progress}%`}}/></div></div><aside><b>{student.program}</b><span>Program studi</span><b>{documents.length}</b><span>Dokumen tersimpan</span><b>{consultations.length}</b><span>Konsultasi</span><b>{eligibilityLabel(student.proposalEligibility)}</b><span>Kelayakan proposal</span><b>{eligibilityLabel(student.resultEligibility)}</b><span>Kelayakan hasil</span></aside></section><section className="student-actions"><button onClick={()=>setActive("Dokumen Skripsi")}><UploadCloud/><span><b>Unggah dokumen</b><small>Kirim berkas Word terbaru</small></span></button><button onClick={()=>setActive("Konsultasi")}><MessageSquareText/><span><b>Tanya pembimbing</b><small>Buka atau balas konsultasi</small></span></button><button onClick={()=>setActive("Jadwal Bimbingan")}><CalendarDays/><span><b>Lihat jadwal</b><small>Periksa agenda bimbingan</small></span></button></section></>}

        {active==="Konsultasi"&&<section className="module-grid student-conversations"><article className="panel consultation-compose"><header><div><h2>Buka konsultasi baru</h2><p>Jelaskan topik dan pertanyaan Anda secara ringkas.</p></div></header><form onSubmit={openConsultation}><label>Subjek<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Contoh: Revisi latar belakang" minLength={3} maxLength={180} required/></label><label>Pesan<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tuliskan hal yang ingin dikonsultasikan…" minLength={3} maxLength={5000} required/></label><button className="button primary" disabled={busy==="consultation"}><Send/>{busy==="consultation"?"Mengirim…":"Kirim konsultasi"}</button></form></article>{consultations.map(c=><article className="panel conversation" key={c.id}><header><div><h2>{c.subject}</h2><p>{statusLabel(c.status)}</p></div></header><div className="messages">{c.messages.map(m=><div className={m.senderRole==="STUDENT"?"mine":""} key={m.id}><b>{m.senderRole==="STUDENT"?"Saya":m.senderName}</b><p>{m.body}</p><small>{formatDate(m.createdAt)}</small></div>)}</div><form className="reply-form" onSubmit={e=>sendReply(e,c.id)}><input value={reply[c.id]||""} onChange={e=>setReply(v=>({...v,[c.id]:e.target.value}))} placeholder="Tulis balasan…"/><button disabled={busy===c.id}><Send/></button></form></article>)}</section>}

        {active==="Dokumen Skripsi"&&<><section className="panel upload-panel"><header><div><h2>Unggah dokumen Word</h2><p>Format .doc atau .docx, maksimum 4 MB. Gunakan .docx agar dapat dibaca AI oleh admin.</p></div></header><form onSubmit={uploadDocument}><label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}><option>NASKAH LENGKAP</option><option>PROPOSAL</option><option>BAB I</option><option>BAB II</option><option>BAB III</option><option>BAB IV</option><option>BAB V</option></select></label><label className="file-drop"><UploadCloud/><span><b>Pilih berkas Word</b><small>.doc atau .docx · maksimal 4 MB</small></span><input name="file" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required/></label><button className="button primary" disabled={busy==="upload"}><UploadCloud/>{busy==="upload"?"Mengunggah…":"Unggah dokumen"}</button></form></section><section className="panel module-panel"><header><div><h2>Riwayat dokumen saya</h2><p>{documents.length} versi tersimpan</p></div></header><div className="document-list">{documents.map(d=><div key={d.id}><FileText/><span><b>{d.name}</b><small>{d.category} · Versi {d.version} · {formatSize(d.sizeBytes)} · {formatDate(d.createdAt)}</small></span><i className="status yellow">{statusLabel(d.status)}</i><a className="icon-action" href={`/api/documents/${d.id}/download`}><Download/></a></div>)}{documents.length===0&&<StudentEmpty text="Belum ada dokumen. Unggah naskah Word pertama Anda di atas."/>}</div></section></>}

        {active==="Jadwal Bimbingan"&&<section className="panel module-panel"><header><div><h2>Jadwal saya</h2><p>Agenda bimbingan yang telah dikonfirmasi</p></div></header><div className="record-list">{appointments.map(a=><div className="static-record" key={a.id}><CalendarDays/><span><b>{a.topic}</b><small>{formatDate(a.startsAt)} · {a.method}</small></span><i className="status yellow">{statusLabel(a.decision)}</i></div>)}{appointments.length===0&&<StudentEmpty text="Belum ada jadwal bimbingan."/>}</div></section>}
        {active==="Profil Saya"&&<section className="panel profile-card"><header><div><h2>Identitas akademik</h2><p>Informasi akun yang telah disetujui pengelola.</p></div></header><dl><div><dt>Nama</dt><dd>{viewerName}</dd></div><div><dt>NIM</dt><dd>{student.nim}</dd></div><div><dt>Program</dt><dd>{student.program}</dd></div><div><dt>Status akun</dt><dd><i className="status green">Aktif</i></dd></div><div><dt>Tahap saat ini</dt><dd>{student.stage}</dd></div><div><dt>Kelayakan ujian proposal</dt><dd>{eligibilityLabel(student.proposalEligibility)}</dd></div><div><dt>Kelayakan ujian hasil</dt><dd>{eligibilityLabel(student.resultEligibility)}</dd></div><div><dt>Total konsultasi</dt><dd>{student.consultationCount} kali</dd></div></dl></section>}
        {active==="Pusat Bantuan"&&<section className="panel help-panel"><header><div><h2>Panduan mahasiswa</h2><p>Langkah utama menggunakan BimbingAI.</p></div></header><div className="help-grid"><article><UploadCloud/><b>Unggah naskah</b><p>Buka Dokumen Skripsi, pilih kategori dan berkas Word maksimum 4 MB.</p></article><article><MessageSquareText/><b>Buka konsultasi</b><p>Isi subjek dan pesan. Balasan pengelola akan muncul pada percakapan yang sama.</p></article><article><CalendarDays/><b>Periksa jadwal</b><p>Agenda bimbingan yang telah dibuat akan tampil di Jadwal Bimbingan.</p></article></div></section>}
        {active==="Pengaturan"&&<section className="panel profile-card"><header><div><h2>Pengaturan akun</h2><p>Informasi keamanan akun mahasiswa.</p></div></header><dl><div><dt>Nama</dt><dd>{viewerName}</dd></div><div><dt>NIM</dt><dd>{student.nim}</dd></div><div><dt>Status</dt><dd><i className="status green">Aktif</i></dd></div><div><dt>Keamanan</dt><dd>Kata sandi dan sesi dikelola oleh Neon Auth.</dd></div></dl></section>}
      </div>
    </main>
    {toast&&<div className="toast" role="status"><UserRoundCheck/><span>{toast}</span><button onClick={()=>setToast("")}><X/></button></div>}
  </div>;
}

function StudentEmpty({text}:{text:string}){return <div className="empty compact-empty"><span><GraduationCap/></span><h2>{text}</h2><p>Data akan muncul otomatis setelah fitur digunakan.</p></div>}
