"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth/client";

type Mode = "signin" | "signup";

export default function EmailAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setMessage(mode === "signup"
          ? "Pendaftaran gagal. Pastikan email valid dan kata sandi minimal 8 karakter."
          : "Email atau kata sandi tidak sesuai.");
        return;
      }
      router.push("/auth/callback?next=/dashboard");
      router.refresh();
    } catch {
      setMessage(mode === "signin"
        ? "Email atau kata sandi tidak sesuai."
        : "Pendaftaran gagal. Silakan periksa data lalu coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="email-auth" id="masuk" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist" aria-label="Pilihan akun">
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Masuk</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Daftar</button>
      </div>
      <h2 id="auth-title">{mode === "signin" ? "Masuk ke Bimbingan Andaz" : "Buat akun mahasiswa"}</h2>
      <p>{mode === "signin" ? "Gunakan email dan kata sandi yang telah didaftarkan." : "Setelah mendaftar, lengkapi profil akademik untuk diperiksa dosen."}</p>
      <form onSubmit={submit}>
        {mode === "signup" && <label><UserRound/><input aria-label="Nama lengkap" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap" autoComplete="name"/></label>}
        <label><Mail/><input aria-label="Email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email"/></label>
        <label><LockKeyhole/><input aria-label="Kata sandi" required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Kata sandi (minimal 8 karakter)" autoComplete={mode === "signup" ? "new-password" : "current-password"}/></label>
        {message && <div className="auth-message" role="alert">{message}</div>}
        <button className="button primary" disabled={loading}>{loading ? <><LoaderCircle className="spin"/> Memproses…</> : <>{mode === "signin" ? "Masuk" : "Daftar akun"}<ArrowRight/></>}</button>
      </form>
      <small>Login dilindungi Neon Auth. Kata sandi tidak disimpan di aplikasi Bimbingan Andaz.</small>
    </section>
  );
}
