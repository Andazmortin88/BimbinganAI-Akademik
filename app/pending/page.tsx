import { CheckCircle2, Clock3, GraduationCap } from "lucide-react";

export default function PendingPage() {
  return <main className="auth-page"><section className="auth-card pending-card">
    <div className="auth-logo"><span><GraduationCap/></span><div>Bimbing<b>AI</b><small>STATUS REGISTRASI</small></div></div>
    <span className="pending-icon"><Clock3/></span>
    <h1>Registrasi sedang diperiksa</h1>
    <p>Data Anda sudah tersimpan. Dosen akan memeriksa identitas dan menentukan pembimbing sebelum akun diaktifkan.</p>
    <div className="pending-info"><b>Sudah mendapat konfirmasi?</b><span>Tekan tombol di bawah untuk memeriksa status terbaru akun Anda.</span></div>
    <a className="button primary pending-check" href="/auth/callback?next=/dashboard"><CheckCircle2/> Periksa status</a>
    <form action="/auth/signout" method="post"><button className="button secondary">Keluar dengan aman</button></form>
  </section></main>;
}
