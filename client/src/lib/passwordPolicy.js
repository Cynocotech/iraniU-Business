/** هم‌خوان با server/src/authUtil.js — validatePasswordComplexity */

export function validatePasswordComplexity(plain) {
  const p = String(plain || "");
  if (p.length < 12) {
    return { ok: false, code: "password_too_short", hint: "رمز باید حداقل ۱۲ کاراکتر باشد." };
  }
  if (p.length > 200) {
    return { ok: false, code: "password_too_long", hint: "رمز خیلی طولانی است." };
  }
  if (!/[a-z]/.test(p)) {
    return { ok: false, code: "password_no_lower", hint: "حداقل یک حرف کوچک انگلیسی (a-z) لازم است." };
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, code: "password_no_upper", hint: "حداقل یک حرف بزرگ انگلیسی (A-Z) لازم است." };
  }
  if (!/[0-9]/.test(p)) {
    return { ok: false, code: "password_no_digit", hint: "حداقل یک رقم لازم است." };
  }
  if (!/[^a-zA-Z0-9_]/.test(p)) {
    return {
      ok: false,
      code: "password_no_special",
      hint: "حداقل یک نماد یا علامت (غیر از حرف، رقم و _) لازم است؛ مثلاً ! @ # $ %",
    };
  }
  return { ok: true };
}

/** ۰–۴ برای نوار پیشرفت رمز */
export function passwordStrengthScore(plain) {
  const p = String(plain || "");
  let s = 0;
  if (p.length >= 12) s += 1;
  if (p.length >= 14) s += 0.5;
  if (/[a-z]/.test(p)) s += 0.5;
  if (/[A-Z]/.test(p)) s += 0.5;
  if (/[0-9]/.test(p)) s += 0.5;
  if (/[^a-zA-Z0-9_]/.test(p)) s += 0.5;
  if (/[^a-zA-Z0-9_]/.test(p) && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)) s += 0.5;
  return Math.min(4, Math.floor(s));
}
