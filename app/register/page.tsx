"use client";

import { FormEvent, useEffect, useState } from "react";
import { GraduationCap, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export default function RegisterPage() {
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{
    authClient.getSession().then(({data})=>{
      const user=data?.user;
      setName(user?.name||"");
      setEmail(user?.email||"");
    });
  },[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd=new FormData(e.currentTarget);
    const response=await fetch("/api/register",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        fullName:name,
        nim:String(fd.get("nim")),
        whatsapp:String(fd.get("whatsapp")),
        program:String(fd.get("program")),
        cohort:Number(fd.get("cohort")),
        className:String(fd.get("class_name")),
        title:String(fd.get("title")||""),
      }),
    });
    const result=await response.json().catch(()=>({error:"Respons server tidak valid."}));
    if(!response.ok){setError(result.error||"Data gagal disimpan.");setSaving(false);return}
    window.location.href=result.redirectTo||"/pending";
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-logo"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>REGISTRASI MAHASISWA</small></div></div><div className="auth-head"><h1>Lengkapi profil akademik</h1><p>Data akan diperiksa dosen sebelum akses bimbingan diaktifkan.</p></div><form onSubmit={submit} className="auth-form"><label>Nama lengkap<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Email Google<input disabled value={email}/></label><div className="form-grid"><label>NIM<input required name="nim"/></label><label>Nomor WhatsApp<input required name="whatsapp" placeholder="08…"/></label><label>Program studi<select name="program" required><option value="S1">S1 Keperawatan — Skripsi</option><option value="D3">D3 Keperawatan — KTI</option><option value="NERS">Profesi Ners — KIA</option></select></label><label>Angkatan<input required name="cohort" type="number" min="2000" max="2100" defaultValue="2026"/></label><label>Kelas<input required name="class_name"/></label><label>Judul sementara<input name="title"/></label></div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={saving}>{saving?<><LoaderCircle className="spin"/> Menyimpan…</>:"Kirim registrasi"}</button></form></section></main>
}
