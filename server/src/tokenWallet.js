import { dbGet, dbAll, dbRun, dbTransaction } from "./db.js";

export const BOOST_PLANS = [
  { id: "silver",   label: "نقره‌ای",   days: 7,  tokens: 100, cooldown_days: 14, color: "#374151", bg: "#f3f4f6", description: "۷ روز در صدر نتایج جستجو" },
  { id: "gold",     label: "طلایی",     days: 14, tokens: 200, cooldown_days: 28, color: "#b45309", bg: "#fffbeb", description: "۱۴ روز در صدر نتایج — نشان ویژه" },
  { id: "platinum", label: "پلاتینیوم", days: 30, tokens: 450, cooldown_days: 42, color: "#5b21b6", bg: "#ede9fe", description: "۳۰ روز برجسته + جایگاه ویژه" },
  { id: "diamond",  label: "الماسی",    days: 60, tokens: 800, cooldown_days: 56, color: "#0891b2", bg: "#ecfeff", description: "۶۰ روز — تضمین صدرنشینی پیوسته" },
];

export const MILESTONES = [
  { type: "earn_profile_complete", amount: 50, cooldown_days: 30, label: "تکمیل پروفایل کسب‌وکار",          hint: "نام، توضیحات، شهر، تلفن، آدرس و دسته‌بندی" },
  { type: "earn_cover_image",      amount: 30, cooldown_days: 30, label: "افزودن تصویر کاور",                hint: "آپلود عکس کاور در پنل رسانه" },
  { type: "earn_gallery_image_1",  amount: 10, cooldown_days: 14, label: "افزودن اولین عکس گالری",           hint: "آپلود اولین عکس در گالری" },
  { type: "earn_gallery_image_2",  amount: 10, cooldown_days: 14, label: "افزودن دومین عکس گالری",           hint: "آپلود دومین عکس در گالری" },
  { type: "earn_gallery_image_3",  amount: 10, cooldown_days: 14, label: "افزودن سومین عکس گالری",           hint: "آپلود سومین عکس در گالری" },
  { type: "earn_gallery_image_4",  amount: 10, cooldown_days: 14, label: "افزودن چهارمین عکس گالری",         hint: "آپلود چهارمین عکس در گالری" },
  { type: "earn_hours_filled",     amount: 15, cooldown_days: 14, label: "تکمیل ساعات کاری",                 hint: "وارد کردن ساعت کاری روزهای هفته" },
  { type: "earn_google_maps",      amount: 10, cooldown_days: 14, label: "افزودن لینک Google Maps",          hint: "لینک صفحه گوگل کسب‌وکار" },
  { type: "earn_claimed",          amount: 50, cooldown_days: 30, label: "تأیید و ادعای مالکیت آگهی",       hint: "تأیید مالکیت — هر ۳۰ روز یک‌بار" },
  { type: "earn_profile_update",   amount: 15, cooldown_days: null, weeklyLimit: 2,
    label: "بروزرسانی پروفایل — پاداش هفتگی", hint: "ویرایش اطلاعات — حداکثر ۲ بار در ۷ روز" },
];

const MILESTONE_MAP = Object.fromEntries(MILESTONES.map((m) => [m.type, m]));

export async function getOrCreateWallet(slug) {
  let wallet = await dbGet(`SELECT * FROM token_wallets WHERE business_slug = $1`, [slug]);
  if (!wallet) {
    await dbRun(
      `INSERT INTO token_wallets (business_slug, balance, total_earned, total_spent)
       VALUES ($1, 0, 0, 0) ON CONFLICT (business_slug) DO NOTHING`,
      [slug]
    );
    wallet = await dbGet(`SELECT * FROM token_wallets WHERE business_slug = $1`, [slug]);
  }
  return wallet;
}

export async function getWalletWithTransactions(slug) {
  const wallet = await getOrCreateWallet(slug);
  const transactions = await dbAll(
    `SELECT * FROM token_transactions WHERE business_slug = $1 ORDER BY created_at DESC LIMIT 60`,
    [slug]
  );

  const now = new Date();
  const nowIso = now.toISOString();

  // Last claim per milestone type — single query
  const lastClaimRows = await dbAll(
    `SELECT type, MAX(created_at) AS last_claimed_at
     FROM token_transactions
     WHERE business_slug = $1 AND type LIKE 'earn_%'
     GROUP BY type`,
    [slug]
  );
  const lastClaimMap = Object.fromEntries(lastClaimRows.map((r) => [r.type, r.last_claimed_at]));

  // profile_update rolling 7-day window
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const recentUpdateRows = await dbAll(
    `SELECT created_at FROM token_transactions
     WHERE business_slug = $1 AND type = 'earn_profile_update' AND created_at > $2
     ORDER BY created_at ASC`,
    [slug, sevenDaysAgo]
  );
  const weeklyBonusUsed = recentUpdateRows.length;
  let weeklyBonusNext = null;
  if (weeklyBonusUsed >= 2) {
    const oldest = recentUpdateRows[0]?.created_at;
    if (oldest) weeklyBonusNext = new Date(new Date(oldest).getTime() + 7 * 86_400_000).toISOString();
  }

  const milestones = MILESTONES.map((m) => {
    const last = lastClaimMap[m.type] || null;
    const earned = !!last;
    let on_cooldown = false;
    let next_available_at = null;

    if (m.type === "earn_profile_update") {
      on_cooldown = weeklyBonusUsed >= 2;
      next_available_at = on_cooldown ? weeklyBonusNext : null;
    } else if (last && m.cooldown_days) {
      const cooldownEnd = new Date(new Date(last).getTime() + m.cooldown_days * 86_400_000).toISOString();
      on_cooldown = nowIso < cooldownEnd;
      next_available_at = on_cooldown ? cooldownEnd : null;
    }

    return { ...m, earned, on_cooldown, next_available_at };
  });

  // Currently active boost
  const activeBoost = await dbGet(
    `SELECT * FROM ad_boosts WHERE business_slug = $1 AND ends_at > $2 ORDER BY ends_at DESC LIMIT 1`,
    [slug, nowIso]
  );

  // Last activation per plan — single query
  const lastBoostRows = await dbAll(
    `SELECT plan_id, MAX(starts_at) AS last_starts_at FROM ad_boosts WHERE business_slug = $1 GROUP BY plan_id`,
    [slug]
  );
  const lastBoostMap = Object.fromEntries(lastBoostRows.map((r) => [r.plan_id, r.last_starts_at]));

  const plans = BOOST_PLANS.map((plan) => {
    const is_active = activeBoost?.plan_id === plan.id;
    const active_until = is_active ? activeBoost.ends_at : null;
    const blocked_by_other = !!activeBoost && !is_active;
    let on_cooldown = false;
    let cooldown_until = null;
    let can_renew = false;

    if (is_active) {
      const renewAvailableAt = new Date(
        new Date(activeBoost.starts_at).getTime() + plan.cooldown_days * 86_400_000
      ).toISOString();
      can_renew = nowIso >= renewAvailableAt;
      if (!can_renew) cooldown_until = renewAvailableAt;
    } else {
      const lastStarts = lastBoostMap[plan.id];
      if (lastStarts) {
        const cooldownEnd = new Date(
          new Date(lastStarts).getTime() + plan.cooldown_days * 86_400_000
        ).toISOString();
        on_cooldown = nowIso < cooldownEnd;
        cooldown_until = on_cooldown ? cooldownEnd : null;
      }
    }

    return { ...plan, is_active, active_until, blocked_by_other, on_cooldown, cooldown_until, can_renew };
  });

  return { wallet, transactions, activeBoost, milestones, plans, weeklyBonusUsed, weeklyBonusNext };
}

// Credit tokens inside an existing transaction client — wallet row must be locked FOR UPDATE before calling
async function creditTokensLocked(client, slug, amount, type, description) {
  await client.query(
    `INSERT INTO token_transactions (business_slug, amount, type, description) VALUES ($1, $2, $3, $4)`,
    [slug, amount, type, description]
  );
  await client.query(
    `UPDATE token_wallets SET balance = balance + $1, total_earned = total_earned + $1, updated_at = NOW()::TEXT WHERE business_slug = $2`,
    [amount, slug]
  );
}

// Award a milestone at most once per rolling cooldown_days window, race-safe via FOR UPDATE
async function creditMilestoneRolling(slug, amount, type, description, cooldown_days) {
  await getOrCreateWallet(slug);
  try {
    await dbTransaction(async (client) => {
      await client.query(`SELECT id FROM token_wallets WHERE business_slug = $1 FOR UPDATE`, [slug]);
      const cutoff = new Date(Date.now() - cooldown_days * 86_400_000).toISOString();
      const { rows } = await client.query(
        `SELECT id FROM token_transactions WHERE business_slug = $1 AND type = $2 AND created_at >= $3 LIMIT 1`,
        [slug, type, cutoff]
      );
      if (rows.length > 0) return;
      await creditTokensLocked(client, slug, amount, type, description);
    });
  } catch (e) {
    console.error(`[tokenWallet] creditMilestoneRolling(${type}) error:`, e.message);
  }
}

export async function grantTokens(slug, amount, description) {
  await getOrCreateWallet(slug);
  await dbRun(
    `INSERT INTO token_transactions (business_slug, amount, type, description) VALUES ($1, $2, 'admin_grant', $3)`,
    [slug, amount, description || "اعطای توکن توسط ادمین"]
  );
  await dbRun(
    `UPDATE token_wallets SET balance = balance + $1, total_earned = total_earned + $1, updated_at = NOW()::TEXT WHERE business_slug = $2`,
    [amount, slug]
  );
}

export async function spendTokensForBoost(slug, planId) {
  const plan = BOOST_PLANS.find((p) => p.id === planId);
  if (!plan) {
    const err = new Error("invalid_plan"); err.code = "invalid_plan"; throw err;
  }

  const nowIso = new Date().toISOString();

  // Rule 1: one active boost at a time
  const activeBoost = await dbGet(
    `SELECT * FROM ad_boosts WHERE business_slug = $1 AND ends_at > $2 ORDER BY ends_at DESC LIMIT 1`,
    [slug, nowIso]
  );

  let isRenewal = false;
  if (activeBoost) {
    if (activeBoost.plan_id === planId) {
      // Same plan active — renewal allowed only if cooldown has passed
      const renewAvailableAt = new Date(
        new Date(activeBoost.starts_at).getTime() + plan.cooldown_days * 86_400_000
      ).toISOString();
      if (nowIso < renewAvailableAt) {
        const err = new Error("plan_on_cooldown");
        err.code = "plan_on_cooldown";
        err.next_available_at = renewAvailableAt;
        throw err;
      }
      isRenewal = true;
    } else {
      const err = new Error("active_boost_exists");
      err.code = "active_boost_exists";
      err.active_plan = activeBoost.plan_id;
      err.active_until = activeBoost.ends_at;
      throw err;
    }
  }

  // Rule 2: per-plan cooldown from last activation (not a renewal)
  if (!isRenewal) {
    const lastBoost = await dbGet(
      `SELECT starts_at FROM ad_boosts WHERE business_slug = $1 AND plan_id = $2 ORDER BY starts_at DESC LIMIT 1`,
      [slug, planId]
    );
    if (lastBoost) {
      const cooldownEnd = new Date(
        new Date(lastBoost.starts_at).getTime() + plan.cooldown_days * 86_400_000
      ).toISOString();
      if (nowIso < cooldownEnd) {
        const err = new Error("plan_on_cooldown");
        err.code = "plan_on_cooldown";
        err.next_available_at = cooldownEnd;
        throw err;
      }
    }
  }

  // Rule 3: balance
  const wallet = await getOrCreateWallet(slug);
  if ((wallet.balance || 0) < plan.tokens) {
    const err = new Error("insufficient_tokens"); err.code = "insufficient_tokens"; throw err;
  }

  const startsAt = new Date().toISOString();
  let endsAt;

  if (isRenewal) {
    // Extension: new expiry = current expiry + duration (not now + duration)
    endsAt = new Date(new Date(activeBoost.ends_at).getTime() + plan.days * 86_400_000).toISOString();
    await dbRun(`UPDATE ad_boosts SET is_active = 0 WHERE id = $1`, [activeBoost.id]);
  } else {
    await dbRun(`UPDATE ad_boosts SET is_active = 0 WHERE business_slug = $1 AND is_active = 1`, [slug]);
    endsAt = new Date(new Date(startsAt).getTime() + plan.days * 86_400_000).toISOString();
  }

  await dbRun(
    `INSERT INTO ad_boosts (business_slug, plan_id, tokens_spent, boost_days, starts_at, ends_at, is_active) VALUES ($1, $2, $3, $4, $5, $6, 1)`,
    [slug, planId, plan.tokens, plan.days, startsAt, endsAt]
  );
  await dbRun(
    `INSERT INTO token_transactions (business_slug, amount, type, description) VALUES ($1, $2, 'spend_boost', $3)`,
    [slug, -plan.tokens, `تبلیغ ${plan.label} — ${plan.days} روز${isRenewal ? " (تمدید)" : ""}`]
  );
  await dbRun(
    `UPDATE token_wallets SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW()::TEXT WHERE business_slug = $2`,
    [plan.tokens, slug]
  );

  return { plan, endsAt, isRenewal };
}

export async function checkWeeklyEditBonus(slug) {
  try {
    await getOrCreateWallet(slug);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    let earned = false;
    let usedThisWeek = 0;
    let next_available_at = null;

    await dbTransaction(async (client) => {
      await client.query(`SELECT id FROM token_wallets WHERE business_slug = $1 FOR UPDATE`, [slug]);
      const { rows } = await client.query(
        `SELECT created_at FROM token_transactions
         WHERE business_slug = $1 AND type = 'earn_profile_update' AND created_at > $2
         ORDER BY created_at ASC`,
        [slug, sevenDaysAgo]
      );
      usedThisWeek = rows.length;
      if (usedThisWeek >= 2) {
        const oldest = rows[0]?.created_at;
        if (oldest) next_available_at = new Date(new Date(oldest).getTime() + 7 * 86_400_000).toISOString();
        return;
      }
      await creditTokensLocked(client, slug, MILESTONE_MAP.earn_profile_update.amount, "earn_profile_update", "بروزرسانی پروفایل — پاداش هفتگی");
      usedThisWeek += 1;
      earned = true;
    });

    return { earned, usedThisWeek, remaining: Math.max(0, 2 - usedThisWeek), next_available_at };
  } catch (e) {
    console.error("[tokenWallet] checkWeeklyEditBonus error:", e.message);
    return { earned: false, usedThisWeek: 0, remaining: 0, next_available_at: null };
  }
}

export async function checkAndAwardMilestones(slug) {
  try {
    const biz = await dbGet(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
    if (!biz) return;
    await getOrCreateWallet(slug);

    if (biz.name_fa && biz.description && biz.city && biz.phone && biz.address && biz.category) {
      const m = MILESTONE_MAP.earn_profile_complete;
      await creditMilestoneRolling(slug, m.amount, m.type, m.label, m.cooldown_days);
    }

    if (biz.cover_image_url && String(biz.cover_image_url).trim()) {
      const m = MILESTONE_MAP.earn_cover_image;
      await creditMilestoneRolling(slug, m.amount, m.type, m.label, m.cooldown_days);
    }

    try {
      const gallery = JSON.parse(biz.gallery_json || "[]");
      const filled = gallery.filter(Boolean).length;
      for (let i = 1; i <= Math.min(filled, 4); i++) {
        const m = MILESTONE_MAP[`earn_gallery_image_${i}`];
        await creditMilestoneRolling(slug, m.amount, m.type, m.label, m.cooldown_days);
      }
    } catch {}

    try {
      const hours = JSON.parse(biz.hours_json || "[]");
      const hasHours = hours.some((r) => r.hours && r.hours.trim() && r.hours !== "Closed");
      if (hasHours) {
        const m = MILESTONE_MAP.earn_hours_filled;
        await creditMilestoneRolling(slug, m.amount, m.type, m.label, m.cooldown_days);
      }
    } catch {}

    const gurl = String(biz.google_review_url || "");
    if (gurl && gurl !== "https://www.google.com/maps" && gurl.includes("google.com/maps/")) {
      const m = MILESTONE_MAP.earn_google_maps;
      await creditMilestoneRolling(slug, m.amount, m.type, m.label, m.cooldown_days);
    }

    if (Number(biz.claimed) === 1) {
      const m = MILESTONE_MAP.earn_claimed;
      await creditMilestoneRolling(slug, m.amount, m.type, m.label, m.cooldown_days);
    }
  } catch (e) {
    console.error("[tokenWallet] checkAndAwardMilestones error:", e.message);
  }
}
