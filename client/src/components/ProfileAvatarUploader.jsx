import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProfileAvatarUploader() {
  const { token, loadMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const r = await fetch("/api/auth/profile-avatar", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.hint || data.error || String(r.status));
      await loadMe();
      setMsg("ذخیره شد");
    } catch (err) {
      setMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="btn btn--ghost" style={{ cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
      {busy ? "در حال آپلود…" : "عکس پروفایل"}
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPick} hidden disabled={busy} />
      {msg ? <small style={{ marginInlineStart: "0.5rem" }}>{msg}</small> : null}
    </label>
  );
}
