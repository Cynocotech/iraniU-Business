import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Seo from "../components/Seo.jsx";
import PasswordRequirementsList from "../components/PasswordRequirementsList.jsx";

export default function ChangePasswordFirstLoginPage() {
  const { me, loadMe } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const username = me?.user?.login_username || me?.user?.email || "";
  const managerName = me?.user?.name || "";

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (newPassword !== confirm) {
      setErr("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setPending(true);
    try {
      const t = localStorage.getItem("iraniu_jwt");
      const r = await fetch("/api/auth/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data.hint || data.error || "خطا در تغییر رمز");
        return;
      }
      setDone(true);
      await loadMe();
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (ex) {
      setErr(ex.message || "خطای شبکه");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Seo title="تغییر رمز عبور" noindex />
      <main className="container" style={{ maxWidth: "26rem", paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="dashboard-panel">
          <h1 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.3rem" }}>
            {managerName ? `خوش آمدید، ${managerName}` : "تغییر رمز عبور"}
          </h1>
          {username && (
            <p className="field-hint" style={{ marginTop: 0 }}>
              نام کاربری: <strong dir="ltr">{username}</strong>
            </p>
          )}
          <p className="field-hint" style={{ marginBottom: "1.25rem" }}>
            برای امنیت حساب، لطفاً رمز موقت ارسال‌شده را با یک رمز شخصی جایگزین کنید.
          </p>

          {done ? (
            <p style={{ color: "var(--color-success, #2e7d32)" }}>
              ✅ رمز با موفقیت تغییر کرد. در حال انتقال به پنل…
            </p>
          ) : (
            <form onSubmit={onSubmit} className="form-grid">
              <div className="field field--block">
                <label htmlFor="cp-new">رمز عبور جدید</label>
                <input
                  id="cp-new"
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <PasswordRequirementsList password={newPassword} />
              </div>
              <div className="field field--block">
                <label htmlFor="cp-confirm">تکرار رمز جدید</label>
                <input
                  id="cp-confirm"
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={12}
                />
              </div>
              {err && (
                <p className="field-hint" role="alert" style={{ color: "#b00020" }}>
                  {err}
                </p>
              )}
              <button type="submit" className="btn btn--primary" disabled={pending}>
                {pending ? "در حال ذخیره…" : "ذخیره و ورود به پنل"}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
