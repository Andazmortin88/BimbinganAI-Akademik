"use client";

import { useMemo, useState } from "react";
import { Archive, Bell, Bot, CalendarDays, ChevronDown, CircleHelp, Clock3, FileText, GraduationCap, LayoutDashboard, Menu, MessageSquareText, Search, Settings, Sparkles, UserRoundCheck, UsersRound, X } from "lucide-react";

const students = [
  {name:"Nabila Azzahra", nim:"202301020", program:"S1 Keperawatan", stage:"BAB III", progress:41, status:"Aktif", tone:"green", last:"2 hari lalu"},
  {name:"Rizky Firmansyah", nim:"202208114", program:"S1 Keperawatan", stage:"BAB V", progress:76, status:"Perlu dipantau", tone:"yellow", last:"11 hari lalu"},
  {name:"Siti Nurhaliza", nim:"24031017", program:"D3 Keperawatan", stage:"Proposal Lengkap", progress:35, status:"Aktif", tone:"green", last:"Hari ini"},
  {name:"Muhammad Aldi", nim:"NERS25044", program:"Profesi Ners", stage:"KIA Lengkap", progress:82, status:"Tidak aktif", tone:"orange", last:"19 hari lalu"},
  {name:"Dewi Anggraini", nim:"202209087", program:"S1 Keperawatan", stage:"Pengumpulan Data", progress:59, status:"Perlu follow-up", tone:"red", last:"34 hari lalu"},
];

const nav = [
  ["Ringkasan", LayoutDashboard], ["Mahasiswa", UsersRound], ["Bimbingan Masuk", MessageSquareText], ["Dokumen", FileText], ["AI Review Center", Bot], ["Jadwal", CalendarDays], ["Arsip Bimbingan", Archive],
] as const;

export default function Dashboard() {
  const [active, setActive] = useState("Ringkasan");
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const filtered = useMemo(()=>students.filter(s=>(s.name+s.nim+s.program).toLowerCase().includes(search.toLowerCase())),[search]);
  const choose = (label:string) => { setActive(label); setMobile(false); if(label!=="Ringkasan"&&label!=="Mahasiswa") setToast(`${label} siap dihubungkan ke database Neon.`); };

  return <div className="app-shell">
    <aside className={mobile?"sidebar open":"sidebar"}>
      <div className="side-brand"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>AKADEMIK</small></div><button aria-label="Tutup menu" onClick={()=>setMobile(false)}><X/></button></div>
      <nav>{nav.map(([label,Icon])=><button key={label} className={active===label?"active":""} onClick={()=>choose(label)}><Icon/>{label}{label==="Bimbingan Masuk"&&<em>12</em>}</button>)}</nav>
      <div className="side-bottom"><button><CircleHelp/> Pusat Bantuan</button><button><Settings/> Pengaturan</button><div className="profile-mini"><span>AM</span><p><b>Ns. Amzal Mortin</b><small>Admin · Dosen Utama</small></p><ChevronDown/></div></div>
    </aside>
    {mobile&&<button className="scrim" aria-label="Tutup menu" onClick={()=>setMobile(false)}/>} 
    <main className="dashboard-main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobile(true)} aria-label="Buka menu"><Menu/></button><div className="search"><Search/><input aria-label="Cari mahasiswa atau dokumen" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari mahasiswa, NIM, atau dokumen…"/></div><button className="term">Ganjil 2026/2027 <ChevronDown/></button><button className="bell" aria-label="Notifikasi"><Bell/><i/></button></header>
      <div className="content">
        <div className="welcome"><div><span>13 September 2026</span><h1>{active}</h1><p>Selamat datang, Dr. Amzal. Berikut perkembangan bimbingan akademik hari ini.</p></div><button className="button primary" onClick={()=>setToast("Ruang konsultasi baru siap dihubungkan ke modul transaksi Neon.")}><MessageSquareText/> Buka konsultasi</button></div>
        {active==="Ringkasan"&&<>
          <section className="metric-grid"><article><span className="metric-icon blue"><UsersRound/></span><div><small>Mahasiswa aktif</small><b>37</b><p><i>+4</i> semester ini</p></div></article><article><span className="metric-icon cyan"><MessageSquareText/></span><div><small>Bimbingan masuk</small><b>12</b><p>5 belum dibaca</p></div></article><article><span className="metric-icon violet"><FileText/></span><div><small>Dokumen menunggu</small><b>8</b><p>3 prioritas tinggi</p></div></article><article><span className="metric-icon amber"><Clock3/></span><div><small>Perlu follow-up</small><b>6</b><p>2 lebih dari 30 hari</p></div></article></section>
          <section className="dash-grid"><article className="panel stage-panel"><header><div><h2>Mahasiswa berdasarkan tahap</h2><p>Distribusi progres saat ini</p></div><button>Bulan ini <ChevronDown/></button></header><div className="stage-bars">{[["BAB I–III",14,70],["Proposal",8,40],["Pengumpulan Data",6,30],["BAB IV–V",5,25],["Sidang & Revisi",4,20]].map(([label,n,w])=><div key={String(label)}><span>{label}</span><div><i style={{width:`${w}%`}}/></div><b>{n}</b></div>)}</div></article><article className="panel activity-panel"><header><div><h2>Aktivitas terbaru</h2><p>Pembaruan dari mahasiswa</p></div><button>Lihat semua</button></header>{students.slice(0,4).map((s,i)=><div className="activity-row" key={s.nim}><span className={`student-avatar a${i}`}>{s.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><p><b>{s.name}</b><small>{["mengunggah BAB III V03","menandai revisi selesai","mengajukan jadwal konsultasi","mengirim KIA versi final"][i]}</small></p><time>{["8 mnt","24 mnt","1 jam","3 jam"][i]}</time></div>)}</article></section>
        </>}
        {(active==="Mahasiswa"||search)&&<section className="panel student-panel"><header><div><h2>Mahasiswa bimbingan</h2><p>{filtered.length} mahasiswa ditemukan</p></div><div className="mini-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari mahasiswa…"/></div></header><div className="student-table"><div className="table-head"><span>Mahasiswa</span><span>Program</span><span>Tahap & progres</span><span>Keaktifan</span><span>Terakhir</span></div>{filtered.map((s,i)=><button className="student-row" key={s.nim} onClick={()=>setToast(`Membuka ruang bimbingan ${s.name}`)}><span className="student-name"><i className={`student-avatar a${i}`}>{s.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</i><p><b>{s.name}</b><small>{s.nim}</small></p></span><span>{s.program}</span><span className="stage-cell"><b>{s.stage}</b><i><em style={{width:`${s.progress}%`}}/></i><small>{s.progress}%</small></span><span><i className={`status ${s.tone}`}>{s.status}</i></span><span>{s.last}</span></button>)}</div></section>}
        {active!=="Ringkasan"&&active!=="Mahasiswa"&&!search&&<section className="empty panel"><span><Sparkles/></span><h2>{active}</h2><p>Modul ini sudah tersedia dalam arsitektur database Neon dan akan diaktifkan bertahap melalui route server yang aman.</p><button className="button primary" onClick={()=>setActive("Ringkasan")}>Kembali ke ringkasan</button></section>}
      </div>
    </main>
    {toast&&<div className="toast" role="status"><UserRoundCheck/><span>{toast}</span><button aria-label="Tutup" onClick={()=>setToast("")}><X/></button></div>}
  </div>;
}
