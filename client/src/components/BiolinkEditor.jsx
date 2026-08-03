import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiPatch } from "../api.js";
import {
  BIOLINK_PRESETS,
  BIOLINK_THEMES,
  SOCIAL_BAR_PRESET_IDS,
  createEmptyLink,
  createEmptySocialLink,
  newLinkId,
  parseBiolinkJson,
  stringifyBiolink,
  iconForPreset,
} from "../lib/biolink.js";

function normalizeLinks(rawLinks) {
  if (!Array.isArray(rawLinks)) return [];
  return rawLinks.map((row) => {
    if (!row || typeof row !== "object") return createEmptyLink("custom");
    const preset = BIOLINK_PRESETS.some((p) => p.id === row.preset) ? row.preset : "custom";
    return {
      id: String(row.id || newLinkId()),
      preset,
      label: String(row.label ?? ""),
      url: String(row.url ?? ""),
      iconClass: String(row.iconClass || iconForPreset(preset)),
      enabled: row.enabled !== false,
    };
  });
}

function normalizeSocialLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    if (!row || typeof row !== "object") return createEmptySocialLink("instagram");
    const preset = BIOLINK_PRESETS.some((p) => p.id === row.preset) ? row.preset : "instagram";
    return {
      id: String(row.id || newLinkId()),
      preset,
      url: String(row.url ?? ""),
      iconClass: String(row.iconClass || iconForPreset(preset)),
      enabled: row.enabled !== false,
    };
  });
}

function moveById(list, id, delta) {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return list;
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function BiolinkEditor({ slug, biz, setBiz }) {
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertText, setAlertText] = useState("");
  const [themeId, setThemeId] = useState(1);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [backgroundOverlay, setBackgroundOverlay] = useState("dark");
  const [links, setLinks] = useState([]);
  const [socialLinks, setSocialLinks] = useState([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = parseBiolinkJson(biz?.biolink_json);
    setHeadline(p.headline);
    setBio(p.bio);
    setAvatarUrl(p.avatarUrl);
    setThemeId(p.themeId ?? 1);
    setBackgroundImageUrl(p.backgroundImageUrl || "");
    setBackgroundOverlay(p.backgroundOverlay || "dark");
    setAlertEnabled(!!p.alert?.enabled);
    setAlertText(p.alert?.text || "");
    setLinks(normalizeLinks(p.links));
    setSocialLinks(normalizeSocialLinks(p.socialLinks));
  }, [biz?.biolink_json]);

  const addLink = useCallback((presetId) => {
    setLinks((prev) => [...prev, createEmptyLink(presetId)]);
  }, []);

  const addSocial = useCallback((presetId) => {
    setSocialLinks((prev) => [...prev, createEmptySocialLink(presetId)]);
  }, []);

  const updateLink = useCallback((id, patch) => {
    setLinks((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.preset) {
          const pr = BIOLINK_PRESETS.find((x) => x.id === patch.preset);
          if (pr) {
            next.iconClass = pr.icon;
            if (!row.label || BIOLINK_PRESETS.some((p) => p.label === row.label)) {
              next.label = pr.label;
            }
          }
        }
        return next;
      })
    );
  }, []);

  const updateSocial = useCallback((id, patch) => {
    setSocialLinks((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.preset) {
          const pr = BIOLINK_PRESETS.find((x) => x.id === patch.preset);
          if (pr) next.iconClass = pr.icon;
        }
        return next;
      })
    );
  }, []);

  const removeLink = useCallback((id) => {
    setLinks((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const removeSocial = useCallback((id) => {
    setSocialLinks((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleSave = async () => {
    setStatus("");
    setSaving(true);
    try {
      const payload = {
        headline: headline.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
        themeId,
        backgroundImageUrl: backgroundImageUrl.trim(),
        backgroundOverlay,
        alert: { enabled: alertEnabled, text: alertText.trim() },
        links: links.map((r) => ({
          id: r.id,
          preset: r.preset,
          label: r.label.trim(),
          url: r.url.trim(),
          iconClass: (r.iconClass || "").trim() || iconForPreset(r.preset),
          enabled: r.enabled !== false,
        })),
        socialLinks: socialLinks.map((r) => ({
          id: r.id,
          preset: r.preset,
          url: r.url.trim(),
          iconClass: (r.iconClass || "").trim() || iconForPreset(r.preset),
          enabled: r.enabled !== false,
        })),
      };
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(slug)}`, {
        biolink_json: stringifyBiolink(payload),
      });
      setBiz(updated);
      setStatus("ذخیره شد.");
    } catch (e) {
      setStatus(e?.message || "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

  const publicPath = `/l/${encodeURIComponent(slug)}`;

  return (
    <section className="dashboard-panel biolink-dash" aria-labelledby="biolink-heading" style={{ marginBottom: "var(--space-md)" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }} id="biolink-heading">لینک‌های من (Biolink)</h2>

      <div className="biolink-dash__public-bar">
        <p className="field-hint biolink-dash__public-hint">
          صفحهٔ عمومی همان چیزی است که بازدیدکننده می‌بیند.
        </p>
        <div className="biolink-dash__public-actions">
          <Link className="btn btn--primary" to={publicPath} target="_blank" rel="noreferrer">
            باز کردن صفحهٔ Biolink عمومی
          </Link>
          <span className="biolink-dash__url" dir="ltr" lang="en">{publicPath}</span>
        </div>
      </div>

      {/* Theme */}
      <div className="biolink-dash__section">
        <h3 className="biolink-dash__h3">تم رنگ و پس‌زمینه</h3>
        <div className="biolink-dash__themes" role="group" aria-label="انتخاب تم">
          {BIOLINK_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`biolink-dash__theme-btn ${themeId === t.id ? "is-selected" : ""}`}
              onClick={() => setThemeId(t.id)}
              title={t.label}
            >
              <span className="biolink-dash__theme-swatch" style={{ background: t.swatch }} />
              <span className="biolink-dash__theme-num">{t.id}</span>
            </button>
          ))}
        </div>
        <p className="field-hint" style={{ marginTop: "0.35rem" }}>
          تم انتخاب‌شده: <strong>{BIOLINK_THEMES.find((x) => x.id === themeId)?.label || themeId}</strong>
        </p>
      </div>

      {/* Links */}
      <div className="biolink-dash__section">
        <h3 className="biolink-dash__h3">دکمه‌های لینک</h3>
        <p className="field-hint">ترتیب با دکمه‌های بالا/پایین؛ هر ردیف یک دکمهٔ سفید روی صفحهٔ عمومی.</p>
        <div className="biolink-editor__add-presets">
          {BIOLINK_PRESETS.map((p) => (
            <button key={p.id} type="button" className="btn btn--ghost biolink-editor__preset-btn" onClick={() => addLink(p.id)}>
              <i className={p.icon} aria-hidden="true" /> {p.label}
            </button>
          ))}
        </div>
        <ul className="biolink-editor__list">
          {links.length === 0 ? (
            <li className="field-hint">هنوز لینکی نیست.</li>
          ) : (
            links.map((row, idx) => (
              <li key={row.id} className="biolink-editor__row">
                <div className="biolink-dash__row-toolbar">
                  <span className="field-hint">#{idx + 1}</span>
                  <button type="button" className="btn btn--ghost" disabled={idx === 0} onClick={() => setLinks((prev) => moveById(prev, row.id, -1))}>بالا</button>
                  <button type="button" className="btn btn--ghost" disabled={idx >= links.length - 1} onClick={() => setLinks((prev) => moveById(prev, row.id, 1))}>پایین</button>
                  <label className="biolink-dash__check biolink-dash__check--inline">
                    <input type="checkbox" checked={row.enabled !== false} onChange={(e) => updateLink(row.id, { enabled: e.target.checked })} />
                    <span>نمایش</span>
                  </label>
                  <button type="button" className="btn btn--ghost" onClick={() => removeLink(row.id)}>حذف</button>
                </div>
                <div className="biolink-editor__row-grid">
                  <div className="field">
                    <label htmlFor={`bl-preset-${row.id}`}>نوع</label>
                    <select id={`bl-preset-${row.id}`} value={row.preset} onChange={(e) => updateLink(row.id, { preset: e.target.value })}>
                      {BIOLINK_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`bl-label-${row.id}`}>عنوان دکمه</label>
                    <input id={`bl-label-${row.id}`} type="text" value={row.label} onChange={(e) => updateLink(row.id, { label: e.target.value })} />
                  </div>
                  <div className="field field--block">
                    <label htmlFor={`bl-url-${row.id}`}>آدرس / شماره</label>
                    <input id={`bl-url-${row.id}`} type="text" dir="ltr" className="biolink-editor__ltr" value={row.url} onChange={(e) => updateLink(row.id, { url: e.target.value })} placeholder={BIOLINK_PRESETS.find((x) => x.id === row.preset)?.placeholder || "https://…"} />
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Social icons */}
      <div className="biolink-dash__section">
        <h3 className="biolink-dash__h3">ردیف آیکن‌های شبکه‌های اجتماعی</h3>
        <div className="biolink-editor__add-presets">
          {SOCIAL_BAR_PRESET_IDS.map((pid) => {
            const p = BIOLINK_PRESETS.find((x) => x.id === pid);
            if (!p) return null;
            return (
              <button key={pid} type="button" className="btn btn--ghost biolink-editor__preset-btn" onClick={() => addSocial(pid)}>
                <i className={p.icon} aria-hidden="true" /> {p.label}
              </button>
            );
          })}
        </div>
        <ul className="biolink-dash__social-list">
          {socialLinks.map((row, sIdx) => (
            <li key={row.id} className="biolink-dash__social-block">
              <div className="biolink-dash__social-toolbar">
                <span className="field-hint">#{sIdx + 1}</span>
                <button type="button" className="btn btn--ghost" disabled={sIdx === 0} onClick={() => setSocialLinks((prev) => moveById(prev, row.id, -1))}>بالا</button>
                <button type="button" className="btn btn--ghost" disabled={sIdx >= socialLinks.length - 1} onClick={() => setSocialLinks((prev) => moveById(prev, row.id, 1))}>پایین</button>
                <button type="button" className="btn btn--ghost" onClick={() => removeSocial(row.id)}>حذف</button>
              </div>
              <div className="biolink-dash__social-row">
                <select value={row.preset} onChange={(e) => updateSocial(row.id, { preset: e.target.value })}>
                  {BIOLINK_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <input type="text" dir="ltr" className="biolink-editor__ltr" value={row.url} onChange={(e) => updateSocial(row.id, { url: e.target.value })} placeholder="URL یا شماره" />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="dashboard-actions dashboard-actions--inline">
        <button type="button" className="btn btn--accent" disabled={saving} onClick={handleSave}>
          {saving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات Biolink"}
        </button>
        {status && <span className="field-hint" role="status">{status}</span>}
      </div>
    </section>
  );
}
