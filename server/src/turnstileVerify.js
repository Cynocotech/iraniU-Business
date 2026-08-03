/**
 * Cloudflare Turnstile captcha verification
 */

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Turnstile captcha token
 * @param {string} token - The token from the client
 * @param {string} remoteIp - Optional: client IP address
 * @returns {Promise<boolean>} - True if verification succeeds
 */
export async function verifyTurnstileToken(token, remoteIp = null) {
  if (!TURNSTILE_SECRET_KEY) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not configured - skipping verification");
    return true; // Skip verification if not configured
  }

  if (!token || typeof token !== "string") {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", TURNSTILE_SECRET_KEY);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.success) {
      return true;
    }

    console.warn("[turnstile] Verification failed:", data["error-codes"]);
    return false;
  } catch (error) {
    console.error("[turnstile] Verification error:", error.message);
    return false;
  }
}
