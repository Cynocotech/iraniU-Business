import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatchJson, apiPost } from "../../api.js";

const defaultForm = {
  host: "smtp.zoho.eu",
  port: 587,
  secure: false,
  user: "",
  new_password: "",
  clear_stored_password: false,
  from_name: "Iraniu",
  from_email: "",
  reply_to: "",
  site_url: "",
  logo_url: "",
  primary_color: "#3a0b47",
  primary_mid: "#5c1f6e",
  accent_success: "#15803d",
  accent_danger: "#b91c1c",
  notify_on_new_listing: true,
  notify_emails: "",
  test_to: "",
};

export default function AdminEmailSettingsSection({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastClaimedOnly, setBroadcastClaimedOnly] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState(null);
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet("/api/admin/smtp-settings")
      .then((d) => {
        setCfg(d);
        setForm((f) => ({
          ...f,
          host: d.host || defaultForm.host,
          port: d.port || 587,
          secure: !!d.secure,
          user: d.user || "",
          new_password: "",
          clear_stored_password: false,
          from_name: d.from_name || defaultForm.from_name,
          from_email: d.from_email || "",
          reply_to: d.reply_to || "",
          site_url: d.site_url || "",
          logo_url: d.logo_url || "",
          primary_color: d.primary_color || defaultForm.primary_color,
          primary_mid: d.primary_mid || defaultForm.primary_mid,
          accent_success: d.accent_success || defaultForm.accent_success,
          accent_danger: d.accent_danger || defaultForm.accent_danger,
          notify_on_new_listing: d.notify_on_new_listing !== false,
          notify_emails: d.notify_emails || "",
        }));
      })
      .catch(() => setCfg({}))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSmtp = async (e) => {
    e.preventDefault();
    setSaveMsg(null);
    setSaveBusy(true);
    try {
      const patch = {
        host: form.host.trim(),
        port: form.port,
        secure: form.secure,
        user: form.user.trim(),
        from_name: form.from_name.trim(),
        from_email: form.from_email.trim(),
        reply_to: form.reply_to.trim(),
        site_url: form.site_url.trim(),
        logo_url: form.logo_url.trim(),
        primary_color: form.primary_color.trim(),
        primary_mid: form.primary_mid.trim(),
        accent_success: form.accent_success.trim(),
        accent_danger: form.accent_danger.trim(),
        notify_on_new_listing: form.notify_on_new_listing,
        notify_emails: form.notify_emails.trim(),
      };
      if (form.clear_stored_password) {
        patch.password = "__CLEAR__";
      } else if (form.new_password.trim()) {
        patch.password = form.new_password.trim();
      } else {
        patch.password = "";
      }
      const next = await apiPatchJson("/api/admin/smtp-settings", patch);
      setCfg(next);
      setForm((f) => ({ ...f, new_password: "", clear_stored_password: false }));
      setSaveMsg("تنظیمات ایمیل ذخیره شد.");
    } catch (err) {
      setSaveMsg(err.message || String(err));
    } finally {
      setSaveBusy(false);
    }
  };

  const sendTest = async (e) => {
    e.preventDefault();
    setTestMsg(null);
    const to = form.test_to.trim().toLowerCase();
    if (!to) {
      setTestMsg("ایمیل گیرندهٔ تست را وارد کنید.");
      return;
    }
    setTestBusy(true);
    try {
      await apiPost("/api/admin/smtp-test", { to });
      setTestMsg("ایمیل تست ارسال شد؛ صندوق ورودی و اسپم را بررسی کنید.");
    } catch (err) {
      setTestMsg(err.message || String(err));
    } finally {
      setTestBusy(false);
    }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    setBroadcastMsg(null);
    if (!window.confirm("ایمیل گروهی به همهٔ آگهی‌های دارای ایمیل تماس ارسال شود؟")) return;
    setBroadcastBusy(true);
    try {
      const out = await apiPost("/api/admin/email/broadcast", {
        subject: broadcastSubject.trim(),
        body_html: broadcastBody,
        claimed_only: broadcastClaimedOnly,
      });
      setBroadcastMsg(
        `ارسال انجام شد: ${out.sent_count} موفق از ${out.recipient_count} گیرنده${
          out.failed_count ? ` — ${out.failed_count} رد` : ""
        }`
      );
    } catch (err) {
      setBroadcastMsg(err.message || String(err));
    } finally {
      setBroadcastBusy(false);
    }
  };

  if (loading) {
    return <p className="field-hint">در حال بارگذاری…</p>;
  }

  return (
    <section className="dashboard-panel">
      <h2 style={{ marginTop: 0 }}>ایمیل (Zoho SMTP)</h2>
      <p className="field-hint" style={{ marginTop: 0 }}>
        میزبان پیش‌فرض <strong>smtp.zoho.eu</strong> است. قالب‌های سیستمی (تأیید/رد، اطلاع داخلی، تست) به‌صورت <strong>انگلیسی و LTR</strong> با رنگ و لوگوی سایت ارسال می‌شوند. رمز SMTP در پاسخ API نمایش داده نمی‌شود.
        اگر در بخش <strong>امنیت → تلگرام</strong> ربات و چت مدیر تنظیم شده باشد، با هر آگهیٔ جدید یک <strong>اعلان تلگرام</strong> هم به همان چت با دکمهٔ ورود به پنل ارسال می‌شود.
        {cfg?.password_source === "env" ? (
          <span> رمز فعلی از متغیر محیطی <code>SMTP_PASS</code> خوانده می‌شود.</span>
        ) : null}
      </p>

      <form onSubmit={saveSmtp}>
        <div className="form-grid" style={{ display: "grid", gap: "1rem" }}>
          <div className="field field--block">
            <label>میزبان SMTP</label>
            <input
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              dir="ltr"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label>پورت</label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || 587 }))}
              dir="ltr"
            />
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked }))}
              />
              SSL/TLS (معمولاً برای پورت ۴۶۵)
            </label>
          </div>
          <div className="field field--block">
            <label>نام کاربری Zoho (ایمیل کامل)</label>
            <input
              value={form.user}
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
              dir="ltr"
              autoComplete="username"
            />
          </div>
          <div className="field field--block">
            <label>رمز عبور SMTP {cfg?.password_masked ? <span className="field-hint">(ذخیره‌شده: {cfg.password_masked})</span> : null}</label>
            <input
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
              placeholder="خالی = بدون تغییر"
              dir="ltr"
              autoComplete="new-password"
            />
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.clear_stored_password}
                onChange={(e) => setForm((f) => ({ ...f, clear_stored_password: e.target.checked }))}
              />
              حذف رمز ذخیره‌شده در سرور (استفاده از .env در صورت تنظیم)
            </label>
          </div>
          <div className="field field--block">
            <label>نام نمایشی فرستنده</label>
            <input value={form.from_name} onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))} />
          </div>
          <div className="field field--block">
            <label>ایمیل فرستنده (باید با حساب Zoho هم‌خوان باشد)</label>
            <input value={form.from_email} onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))} dir="ltr" />
          </div>
          <div className="field field--block">
            <label>Reply-To (اختیاری)</label>
            <input value={form.reply_to} onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))} dir="ltr" />
          </div>
          <div className="field field--block">
            <label>آدرس سایت (پایه برای لینک‌ها)</label>
            <input
              value={form.site_url}
              onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value }))}
              placeholder="https://example.com"
              dir="ltr"
            />
          </div>
          <div className="field field--block">
            <label>آدرس لوگو (HTTPS، برای هدر ایمیل)</label>
            <input
              value={form.logo_url}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://…/logo.png"
              dir="ltr"
            />
          </div>
          <div className="field">
            <label>رنگ اصلی</label>
            <input value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} dir="ltr" />
          </div>
          <div className="field">
            <label>رنگ میانی گرادیان</label>
            <input value={form.primary_mid} onChange={(e) => setForm((f) => ({ ...f, primary_mid: e.target.value }))} dir="ltr" />
          </div>
          <div className="field">
            <label>رنگ تأیید (آگهی پذیرفته‌شده)</label>
            <input value={form.accent_success} onChange={(e) => setForm((f) => ({ ...f, accent_success: e.target.value }))} dir="ltr" />
          </div>
          <div className="field">
            <label>رنگ رد</label>
            <input value={form.accent_danger} onChange={(e) => setForm((f) => ({ ...f, accent_danger: e.target.value }))} dir="ltr" />
          </div>
          <div className="field field--block">
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.notify_on_new_listing}
                onChange={(e) => setForm((f) => ({ ...f, notify_on_new_listing: e.target.checked }))}
              />
              ارسال ایمیل داخلی هنگام ثبت آگهی جدید (در انتظار تأیید)
            </label>
          </div>
          <div className="field field--block">
            <label>ایمیل‌های مدیر (جدا با کاما یا خط) برای اطلاع از آگهی جدید</label>
            <textarea
              rows={2}
              value={form.notify_emails}
              onChange={(e) => setForm((f) => ({ ...f, notify_emails: e.target.value }))}
              dir="ltr"
              placeholder="admin@example.com"
            />
          </div>
        </div>
        {saveMsg ? (
          <p className="field-hint" role={saveMsg.includes("ذخیره") ? "status" : "alert"}>
            {saveMsg}
          </p>
        ) : null}
        <p style={{ marginTop: "1rem" }}>
          <button type="submit" className="btn btn--primary" disabled={saveBusy}>
            {saveBusy ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات ایمیل"}
          </button>
        </p>
      </form>

      <hr style={{ margin: "1.75rem 0", border: "none", borderTop: "1px solid var(--color-border)" }} />

      <h4 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>تست ارسال</h4>
      <form className="form-grid" onSubmit={sendTest} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="smtp-test-to">ایمیل گیرندهٔ تست</label>
          <input
            id="smtp-test-to"
            value={form.test_to}
            onChange={(e) => setForm((f) => ({ ...f, test_to: e.target.value }))}
            dir="ltr"
            placeholder="you@example.com"
          />
        </div>
        <button type="submit" className="btn btn--ghost" disabled={testBusy}>
          {testBusy ? "…" : "ارسال ایمیل تست"}
        </button>
      </form>
      {testMsg ? <p className="field-hint">{testMsg}</p> : null}

      <hr style={{ margin: "1.75rem 0", border: "none", borderTop: "1px solid var(--color-border)" }} />

      <h4 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>ایمیل گروهی به کسب‌وکارهای ثبت‌شده</h4>
      <p className="field-hint" style={{ marginTop: 0 }}>
        متن را می‌توانید HTML ساده بنویسید (تگ‌های <code>script</code> حذف می‌شوند). قالب برند (هدر/فوتر) به‌صورت خودکار دور محتوا قرار می‌گیرد.
      </p>
      <form onSubmit={sendBroadcast}>
        <div className="field field--block">
          <label htmlFor="bc-subj">موضوع</label>
          <input
            id="bc-subj"
            value={broadcastSubject}
            onChange={(e) => setBroadcastSubject(e.target.value)}
            required
          />
        </div>
        <div className="field field--block">
          <label htmlFor="bc-body">متن (HTML)</label>
          <textarea
            id="bc-body"
            rows={10}
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            dir="rtl"
            placeholder="<p>سلام،</p><p>…</p>"
          />
        </div>
        <div className="field field--block">
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={broadcastClaimedOnly}
              onChange={(e) => setBroadcastClaimedOnly(e.target.checked)}
            />
            فقط آگهی‌هایی که مالک ادعا کرده‌اند (claimed)
          </label>
        </div>
        {broadcastMsg ? <p className="field-hint">{broadcastMsg}</p> : null}
        <p style={{ marginTop: "0.75rem" }}>
          <button type="submit" className="btn btn--primary" disabled={broadcastBusy}>
            {broadcastBusy ? "در حال ارسال…" : "ارسال به همهٔ گیرندگان"}
          </button>
        </p>
      </form>
    </section>
  );
}
