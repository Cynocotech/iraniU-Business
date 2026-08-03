#!/bin/bash
# Polls Gemini until quota resets, then launches refix_fa_descriptions.py with nohup.

GEMINI_KEY="AIzaSyAWyDQN6qodyI4fLqEzI1nNb_nYrEoEi34"
GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
LOG="/var/log/refix-descriptions.log"
POLL_INTERVAL=300  # 5 minutes

check_quota() {
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$GEMINI_URL" \
    -H "x-goog-api-key: $GEMINI_KEY" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"role":"user","parts":[{"text":"hi"}]}],"generationConfig":{"maxOutputTokens":5}}')
  echo "$STATUS"
}

echo "[wait_and_refix] Started at $(date). Checking Gemini quota every ${POLL_INTERVAL}s..." | tee -a "$LOG"

while true; do
  STATUS=$(check_quota)
  echo "[wait_and_refix] $(date '+%H:%M:%S') — Gemini status: HTTP $STATUS" | tee -a "$LOG"

  if [ "$STATUS" = "200" ]; then
    echo "[wait_and_refix] Quota available! Launching refix script..." | tee -a "$LOG"
    cd /root/directory-iraniu-uk
    python3 scripts/refix_fa_descriptions.py >> "$LOG" 2>&1
    echo "[wait_and_refix] Refix script finished at $(date)." | tee -a "$LOG"
    exit 0
  fi

  echo "[wait_and_refix] Still throttled. Next check in ${POLL_INTERVAL}s..." | tee -a "$LOG"
  sleep "$POLL_INTERVAL"
done
