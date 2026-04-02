import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api.js";

export default function ManagerSignupPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState(null);
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    if (password !== password2) {
      setMsg({ ok: false, text: "دو بار رمز یکسان نیست." });
      setSending(false);
      return;
    }
    if (password.length < 8) {
      setMsg({ ok: false, text: "رمز باید حداقل ۸ کاراکتر باشد." });
      setSending(false);
      return;
    }
    try {
      await apiPost("/api/auth/register/manager", {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone.trim(),
        login_username: loginUsername.trim().toLowerCase(),
        password,
      });
      setMsg({
        ok: true,
        text: "حساب مدیر ساخته شد. اکنون می‌توانید از صفحهٔ ورود با ایمیل یا نام کاربری وارد پنل شوید. سوپرادمین می‌تواند آگهی شما را به این حساب وصل کند.",
      });
      setEmail("");
      setName("");
      setPhone("");
      setLoginUsername("");
      setPassword("");
      setPassword2("");
    } catch (err) {
      const t = String(err.message || "");
      let text = t;
      if (t.includes("email_taken")) text = "این ایمیل قبلاً ثبت شده.";
      else if (t.includes("username_taken")) text = "این نام کاربری گرفته شده؛ نام دیگری انتخاب کنید.";
      else if (t.includes("invalid_username")) text = "نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل a-z، ۰-۹ و _ باشد.";
      else if (t.includes("invalid_email")) text = "ایمیل نامعتبر است.";
      else if (t.includes("password_too_short")) text = "رمز باید حداقل ۸ کاراکتر باشد.";
      setMsg({ ok: false, text });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="container" style={{ padding: "2rem 0", maxWidth: "32rem" }}>
      <h1>ثبت‌نام مدیر</h1>
      <p className="field-hint">
        نام کاربری و رمز برای ورود به <strong>پنل کسب‌وکار</strong>؛ ایمیل برای تماس و بازیابی. پس از ثبت، سوپرادمین می‌تواند آگهی را به
        حساب شما وصل کند.
      </p>
      <form className="dashboard-panel" style={{ marginTop: "1rem" }} onSubmit={submit}>
        <div className="form-grid">
          <div className="field field--block">
            <label htmlFor="ms-user">نام کاربری (ورود)</label>
            <input
              id="ms-user"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
              required
              dir="ltr"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              placeholder="مثلاً ali_london"
            />
            <span className="field-hint">فقط حروف انگلیسی کوچک، اعداد و _ — ۳ تا ۳۲ کاراکتر.</span>
          </div>
          <div className="field field--block">
            <label htmlFor="ms-pass">رمز عبور (حداقل ۸ کاراکتر)</label>
            <input
              id="ms-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              dir="ltr"
              autoComplete="new-password"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-pass2">تکرار رمز</label>
            <input
              id="ms-pass2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={8}
              dir="ltr"
              autoComplete="new-password"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-email">ایمیل</label>
            <input
              id="ms-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              autoComplete="email"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-name">نام کامل</label>
            <input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field field--block">
            <label htmlFor="ms-phone">تلفن</label>
            <input id="ms-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" required />
          </div>
        </div>
        <button type="submit" className="btn btn--primary" disabled={sending}>
          {sending ? "…" : "ثبت حساب مدیر"}
        </button>
        {msg && (
          <p className="field-hint" style={{ color: msg.ok ? "inherit" : "#b71c1c" }}>
            {msg.text}
          </p>
        )}
      </form>
      <p style={{ marginTop: "1rem" }}>
        <Link to="/login">ورود به پنل</Link>
        {" · "}
        <Link to="/">خانه</Link>
      </p>
    </main>
  );
}
