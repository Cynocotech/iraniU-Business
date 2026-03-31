import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { apiGet, apiPost, apiPatchJson } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";

function errMessage(code) {
  const map = {
    invalid_totp: "کد شش‌رقمی نادرست است.",
    invalid_password: "رمز عبور نادرست است.",
    setup_first: "ابتدا راه‌اندازی را انجام دهید.",
    unauthorized: "نشست نامعتبر است؛ دوباره وارد شوید.",
  };
  return map[code] || code;
}

export default function AdminSecurityPage({ embedded = false }) {
  const { me, loadMe } = useAuth();
  const totpOn = !!me?.totp_enabled;
  const mustEnroll2fa = me?.role === "superadmin" && !!me?.totp_setup_required && !me?.totp_enabled;

  const [telegramCfg, setTelegramCfg] = useState(null);
  const [tgForm, setTgForm] = useState({
    chat_id: "",
    directory_channel_id: "",
    public_site_url: "",
    new_bot_token: "",
    new_webhook_secret: "",
  });
  const [tgSaveBusy, setTgSaveBusy] = useState(false);
  const [tgSaveMsg, setTgSaveMsg] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secretB32, setSecretB32] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);

  const [enableCode, setEnableCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [telegramTestMsg, setTelegramTestMsg] = useState(null);
  const [telegramTestBusy, setTelegramTestBusy] = useState(false);

  const [twilioModule, setTwilioModule] = useState({ enabled: true });
  const [twilioModuleBusy, setTwilioModuleBusy] = useState(false);
  const [twilioModuleMsg, setTwilioModuleMsg] = useState(null);

  const loadTelegramConfig = useCallback(() => {
    apiGet("/api/admin/telegram-config")
      .then((d) => {
        setTelegramCfg(d);
        setTgForm((f) => ({
          ...f,
          chat_id: d.chat_id || "",
          directory_channel_id: d.directory_channel_id || "",
          public_site_url: d.public_site_url || "",
        }));
      })
      .catch(() => setTelegramCfg({}));
  }, []);

  const loadTwilioModule = useCallback(() => {
    apiGet("/api/admin/twilio-module")
      .then((d) => setTwilioModule(d && typeof d.enabled === "boolean" ? d : { enabled: true }))
      .catch(() => setTwilioModule({ enabled: true }));
  }, []);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadTelegramConfig();
  }, [mustEnroll2fa, loadTelegramConfig]);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadTwilioModule();
  }, [mustEnroll2fa, loadTwilioModule]);

  const setTwilioModuleEnabled = async (nextEnabled) => {
    setTwilioModuleMsg(null);
    setTwilioModuleBusy(true);
    try {
      const d = await apiPatchJson("/api/admin/twilio-module", { enabled: nextEnabled });
      setTwilioModule(d);
      setTwilioModuleMsg(nextEnabled ? "ماژول Twilio فعال شد." : "ماژول Twilio غیرفعال شد؛ منوی Twilio در پنل مدیر و فیلدهای شماره ابری مخفی می‌شوند.");
    } catch (err) {
      setTwilioModuleMsg(err.message || String(err));
    } finally {
      setTwilioModuleBusy(false);
    }
  };

  const saveTelegramConfig = async (e) => {
    e.preventDefault();
    setTgSaveMsg(null);
    setTgSaveBusy(true);
    try {
      const patch = {
        chat_id: tgForm.chat_id.trim(),
        directory_channel_id: tgForm.directory_channel_id.trim(),
        public_site_url: tgForm.public_site_url.trim(),
      };
      if (tgForm.new_bot_token.trim()) patch.bot_token = tgForm.new_bot_token.trim();
      if (tgForm.new_webhook_secret.trim()) patch.webhook_secret = tgForm.new_webhook_secret.trim();
      const next = await apiPatchJson("/api/admin/telegram-config", patch);
      setTelegramCfg(next);
      setTgForm((f) => ({ ...f, new_bot_token: "", new_webhook_secret: "" }));
      setTgSaveMsg("تنظیمات ذخیره شد.");
    } catch (err) {
      setTgSaveMsg(err.message || String(err));
    } finally {
      setTgSaveBusy(false);
    }
  };

  const clearTelegramOverride = async (field) => {
    setTgSaveMsg(null);
    setTgSaveBusy(true);
    try {
      const next = await apiPatchJson("/api/admin/telegram-config", { [field]: "" });
      setTelegramCfg(next);
      if (field === "bot_token") setTgForm((f) => ({ ...f, new_bot_token: "" }));
      if (field === "webhook_secret") setTgForm((f) => ({ ...f, new_webhook_secret: "" }));
      setTgSaveMsg("بازگشت به مقدار .env انجام شد (در صورت تعریف).");
    } catch (err) {
      setTgSaveMsg(err.message || String(err));
    } finally {
      setTgSaveBusy(false);
    }
  };

  const startSetup = async () => {
    setMsg(null);
    setBusy(true);
    setQrDataUrl("");
    setSecretB32("");
    try {
      const data = await apiPost("/api/auth/admin/2fa/setup", {});
      setSecretB32(data.secret || "");
      setSetupOpen(true);
      if (data.otpauth_url) {
        const url = await QRCode.toDataURL(data.otpauth_url, { width: 220, margin: 2 });
        setQrDataUrl(url);
      }
    } catch (e) {
      setMsg(errMessage(String(e.message)) || String(e));
    } finally {
      setBusy(false);
    }
  };

  const enable2fa = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await apiPost("/api/auth/admin/2fa/enable", { token: enableCode.trim() });
      setEnableCode("");
      setSetupOpen(false);
      setQrDataUrl("");
      setSecretB32("");
      await loadMe();
      setMsg("Google Authenticator فعال شد.");
    } catch (e) {
      setMsg(errMessage(String(e.message)) || String(e));
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await apiPost("/api/auth/admin/2fa/disable", { password: disablePw });
      setDisablePw("");
      await loadMe();
      setMsg("ورود دو مرحله‌ای غیرفعال شد.");
    } catch (e) {
      setMsg(errMessage(String(e.message)) || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!embedded ? (
        <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
          <Link to="/admin">← داشبورد</Link>
        </p>
      ) : null}

      {mustEnroll2fa ? (
        <div
          className="dashboard-panel"
          style={{
            marginBottom: "1rem",
            border: "1px solid rgba(183, 28, 28, 0.35)",
            background: "rgba(255, 235, 238, 0.95)",
          }}
          role="status"
        >
          <p style={{ margin: 0, fontWeight: 600 }}>ورود دو مرحله‌ای الزامی است</p>
          <p className="field-hint" style={{ margin: "0.5rem 0 0" }}>
            قبل از استفاده از بقیهٔ پنل سوپرادمین، بخش زیر را باز کنید، QR را در Google Authenticator اسکن کنید و ۲FA را
            فعال کنید.
          </p>
        </div>
      ) : null}

      <section className="dashboard-panel">
        <h2>ورود دو مرحله‌ای (Google Authenticator)</h2>
        <p className="field-hint">
          با اسکن QR در اپ Google Authenticator یا مشابه، کدهای شش‌رقمی برای ورود به پنل سوپرادمین دریافت می‌کنید.
        </p>

        {totpOn ? (
          <div className="field-hint" style={{ color: "var(--color-success, #2e7d32)", marginBottom: "1rem" }}>
            وضعیت: <strong>فعال</strong> — هنگام ورود از صفحهٔ <Link to="/admin/login">ورود سوپرادمین</Link> کد را وارد کنید.
          </div>
        ) : (
          <div className="field-hint" style={{ marginBottom: "1rem" }}>
            وضعیت: <strong>غیرفعال</strong>
          </div>
        )}

        {!totpOn && (
          <>
            {!setupOpen && (
              <button type="button" className="btn btn--primary" disabled={busy} onClick={startSetup}>
                {busy ? "در حال آماده‌سازی…" : "راه‌اندازی و نمایش QR"}
              </button>
            )}

            {setupOpen && (
              <div style={{ marginTop: "1.25rem" }}>
                {qrDataUrl ? (
                  <p style={{ marginBottom: "0.75rem" }}>
                    <img src={qrDataUrl} alt="QR برای Google Authenticator" width={220} height={220} />
                  </p>
                ) : null}
                {secretB32 ? (
                  <p className="field-hint" dir="ltr" style={{ wordBreak: "break-all" }}>
                    کلید دستی (در صورت نیاز): <code>{secretB32}</code>
                  </p>
                ) : null}
                <form onSubmit={enable2fa} className="form-grid" style={{ marginTop: "1rem", maxWidth: "22rem" }}>
                  <div className="field field--block">
                    <label htmlFor="adm-totp-enable">کد شش‌رقمی از اپ</label>
                    <input
                      id="adm-totp-enable"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={enableCode}
                      onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="۶ رقم"
                      dir="ltr"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={busy || enableCode.length < 6}>
                    تأیید و فعال‌سازی
                  </button>
                </form>
                <p className="field-hint" style={{ marginTop: "1rem" }}>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => startSetup()}>
                    تولید QR جدید
                  </button>
                </p>
              </div>
            )}
          </>
        )}

        {totpOn && (
          <form onSubmit={disable2fa} className="form-grid" style={{ marginTop: "1rem", maxWidth: "22rem" }}>
            <div className="field field--block">
              <label htmlFor="adm-totp-disable-pw">رمز عبور فعلی برای غیرفعال کردن ۲FA</label>
              <input
                id="adm-totp-disable-pw"
                type="password"
                autoComplete="current-password"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                dir="ltr"
                required
              />
            </div>
            <button type="submit" className="btn btn--ghost" disabled={busy}>
              غیرفعال کردن ورود دو مرحله‌ای
            </button>
          </form>
        )}

        {msg && (
          <p className="field-hint" style={{ marginTop: "1rem", color: msg.includes("فعال") || msg.includes("غیرفعال") ? undefined : "#b71c1c" }}>
            {msg}
          </p>
        )}
      </section>

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>پیکربندی تلگرام</h2>
        <p className="field-hint">
          مقادیر را اینجا ذخیره کنید یا در <code dir="ltr">server/.env</code> بگذارید — مقدار ذخیره‌شده در دیتابیس
          بر متغیر محیطی اولویت دارد. فقط با <strong>ورود سوپرادمین</strong> از{" "}
          <Link to="/admin/login">/admin/login</Link> اعلان ورود ارسال می‌شود.
        </p>

        <form onSubmit={saveTelegramConfig} className="form-grid" style={{ maxWidth: "36rem", marginTop: "1rem" }}>
          <div className="field field--block">
            <label htmlFor="tg-bot-token">
              توکن ربات <span className="field-hint">(BotFather)</span>
            </label>
            <input
              id="tg-bot-token"
              type="password"
              autoComplete="off"
              placeholder={telegramCfg?.bot_token_masked ? `فعلی: ${telegramCfg.bot_token_masked}` : "توکن جدید را وارد کنید"}
              value={tgForm.new_bot_token}
              onChange={(e) => setTgForm((f) => ({ ...f, new_bot_token: e.target.value }))}
              dir="ltr"
            />
            <p className="field-hint" style={{ marginTop: "0.35rem" }}>
              منبع فعلی: <strong>{telegramCfg?.bot_token_source === "database" ? "دیتابیس" : ".env"}</strong>
              {telegramCfg?.bot_token_source === "database" ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.85rem" }}
                    disabled={tgSaveBusy}
                    onClick={() => clearTelegramOverride("bot_token")}
                  >
                    حذف از دیتابیس
                  </button>
                </>
              ) : null}
            </p>
          </div>

          <div className="field field--block">
            <label htmlFor="tg-chat-id">شناسهٔ چت اعلان‌ها (عدد یا نام کاربری)</label>
            <input
              id="tg-chat-id"
              type="text"
              value={tgForm.chat_id}
              onChange={(e) => setTgForm((f) => ({ ...f, chat_id: e.target.value }))}
              placeholder="مثلاً 123456789"
              dir="ltr"
            />
          </div>

          <div className="field field--block">
            <label htmlFor="tg-webhook-secret">رمز وب‌هوک (Kick out)</label>
            <input
              id="tg-webhook-secret"
              type="password"
              autoComplete="off"
              placeholder={telegramCfg?.webhook_secret_masked ? `فعلی: ${telegramCfg.webhook_secret_masked}` : "مخفی جدید"}
              value={tgForm.new_webhook_secret}
              onChange={(e) => setTgForm((f) => ({ ...f, new_webhook_secret: e.target.value }))}
              dir="ltr"
            />
            <p className="field-hint" style={{ marginTop: "0.35rem" }}>
              منبع: <strong>{telegramCfg?.webhook_secret_source === "database" ? "دیتابیس" : ".env"}</strong>
              {telegramCfg?.webhook_secret_source === "database" ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.85rem" }}
                    disabled={tgSaveBusy}
                    onClick={() => clearTelegramOverride("webhook_secret")}
                  >
                    حذف از دیتابیس
                  </button>
                </>
              ) : null}
            </p>
          </div>

          <div className="field field--block">
            <label htmlFor="tg-dir-ch">شناسهٔ کانال دایرکتوری</label>
            <input
              id="tg-dir-ch"
              type="text"
              value={tgForm.directory_channel_id}
              onChange={(e) => setTgForm((f) => ({ ...f, directory_channel_id: e.target.value }))}
              placeholder="@YourChannel یا -100…"
              dir="ltr"
            />
          </div>

          <div className="field field--block">
            <label htmlFor="tg-public-url">آدرس عمومی سایت (لینک آگهی و تصویر)</label>
            <input
              id="tg-public-url"
              type="url"
              value={tgForm.public_site_url}
              onChange={(e) => setTgForm((f) => ({ ...f, public_site_url: e.target.value }))}
              placeholder="https://example.com"
              dir="ltr"
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button type="submit" className="btn btn--primary" disabled={tgSaveBusy}>
              {tgSaveBusy ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات تلگرام"}
            </button>
          </div>
          {tgSaveMsg && (
            <p
              className="field-hint"
              style={{ color: tgSaveMsg.includes("ذخیره") || tgSaveMsg.includes("بازگشت") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}
            >
              {tgSaveMsg}
            </p>
          )}
        </form>

        <p className="field-hint" style={{ marginTop: "1rem" }}>
          قبل از اولین اعلان، در تلگرام به ربات یک بار <code dir="ltr">/start</code> بزنید (چت خصوصی).
        </p>

        {telegramCfg?.telegram_configured === true && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)" }}>
            توکن و چت برای اعلان ورود تنظیم شده‌اند.
          </p>
        )}
        {telegramCfg?.telegram_configured === true && telegramCfg?.kick_button_ready === false && (
          <p className="field-hint" style={{ color: "#5d4037" }}>
            برای دکمهٔ <strong>Kick out</strong>، رمز وب‌هوک را بالا ذخیره کنید و با آدرس HTTPS عمومی{" "}
            <code dir="ltr">https://دامنه‌شما/api/telegram/webhook</code> برای ربات <code dir="ltr">setWebhook</code> بزنید
            (همان <code dir="ltr">secret_token</code> با مقدار رمز وب‌هوک). روی localhost بدون ngrok وب‌هوک کار
            نمی‌کند.
          </p>
        )}
        {telegramCfg?.kick_button_ready === true && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)" }}>
            دکمهٔ Kick out آماده است.
          </p>
        )}
        {telegramCfg?.directory_channel_ready === true && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)" }}>
            ارسال آگهی به کانال دایرکتوری از فهرست آگهی‌ها آماده است — ربات را در کانال ادمین کنید.
          </p>
        )}
        {telegramCfg?.telegram_configured === true && telegramCfg?.directory_channel_ready === false && (
          <p className="field-hint" style={{ color: "#5d4037" }}>
            برای <strong>ارسال به کانال</strong>، شناسهٔ کانال دایرکتوری و آدرس عمومی سایت را در فرم بالا پر کنید.
          </p>
        )}
        {telegramCfg?.telegram_configured === false && (
          <p className="field-hint">
            هنوز توکن و چت اعلان کامل نیست — فرم بالا را پر کنید یا در{" "}
            <code dir="ltr">server/.env</code> متغیرهای <code dir="ltr">TELEGRAM_BOT_TOKEN</code> و{" "}
            <code dir="ltr">TELEGRAM_CHAT_ID</code> را بگذارید. ربات:{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
              BotFather
            </a>
            .
          </p>
        )}

        <p className="field-hint" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={telegramTestBusy || telegramCfg?.telegram_configured === false}
            onClick={async () => {
              setTelegramTestMsg(null);
              setTelegramTestBusy(true);
              try {
                await apiPost("/api/admin/telegram-test", {});
                setTelegramTestMsg("پیام آزمایشی ارسال شد؛ تلگرام را بررسی کنید.");
                loadTelegramConfig();
              } catch (e) {
                setTelegramTestMsg(e.message || String(e));
              } finally {
                setTelegramTestBusy(false);
              }
            }}
          >
            {telegramTestBusy ? "در حال ارسال…" : "ارسال پیام آزمایشی به تلگرام"}
          </button>
        </p>
        {telegramTestMsg && (
          <p className="field-hint" style={{ color: telegramTestMsg.includes("ارسال") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}>
            {telegramTestMsg}
          </p>
        )}
      </section>
      ) : null}

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>ماژول Twilio</h2>
        <p className="field-hint">
          با غیرفعال کردن، وب‌هوک‌های صوتی Twilio پاسخ نمی‌دهند، منوی «تنظیمات Twilio» و «لاگ تماس‌ها» در پنل مدیر
          مخفی می‌شود و مدیران نمی‌توانند تنظیمات Twilio را ذخیره کنند. داده‌های ذخیره‌شده در دیتابیس پاک نمی‌شود.
        </p>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          وضعیت فعلی:{" "}
          <strong>{twilioModule.enabled ? "فعال" : "غیرفعال"}</strong>
        </p>
        <div className="dashboard-actions dashboard-actions--inline">
          {twilioModule.enabled ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={twilioModuleBusy}
              onClick={() => setTwilioModuleEnabled(false)}
            >
              {twilioModuleBusy ? "در حال ذخیره…" : "غیرفعال کردن ماژول Twilio"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={twilioModuleBusy}
              onClick={() => setTwilioModuleEnabled(true)}
            >
              {twilioModuleBusy ? "در حال ذخیره…" : "فعال کردن ماژول Twilio"}
            </button>
          )}
        </div>
        {twilioModuleMsg ? (
          <p
            className="field-hint"
            style={{ marginTop: "0.75rem", color: twilioModuleMsg.includes("غیرفعال") || twilioModuleMsg.includes("فعال") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}
          >
            {twilioModuleMsg}
          </p>
        ) : null}
      </section>
      ) : null}
    </>
  );
}
