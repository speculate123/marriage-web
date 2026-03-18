(() => {
  const form = document.getElementById("rsvp-form");
  const statusEl = document.getElementById("status");
  const submitBtn = document.getElementById("submit-btn");

  if (!form || !statusEl || !submitBtn) {
    return;
  }

  const config = window.RSVP_CONFIG || {};
  const supabaseUrl = (config.SUPABASE_URL || "").trim();
  const supabaseAnonKey = (config.SUPABASE_ANON_KEY || "").trim();
  const tableName = (config.TABLE_NAME || "rsvp_submissions").trim();
  const cooldownMs = Number(config.COOLDOWN_MS) || 15000;
  const cooldownKey = "rsvp_last_submit_at";

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.classList.remove("error", "ok");
    if (type) {
      statusEl.classList.add(type);
    }
  }

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("YOUR-PROJECT-ID")) {
    setStatus("請先在 assets/config.js 填入 Supabase 連線資訊。", "error");
    submitBtn.disabled = true;
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    setStatus("Supabase SDK 載入失敗，請稍後再試。", "error");
    submitBtn.disabled = true;
    return;
  }

  const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function validate(payload) {
    if (!payload.name || payload.name.length > 50) {
      return "姓名為必填，且不得超過 50 字。";
    }

    if (!/^09\d{8}$/.test(payload.phone)) {
      return "手機格式錯誤，請輸入 09 開頭的 10 碼號碼。";
    }

    if (!Number.isInteger(payload.attendees) || payload.attendees < 1 || payload.attendees > 10) {
      return "出席人數需為 1 到 10 的整數。";
    }

    if (payload.dietary && payload.dietary.length > 80) {
      return "飲食需求不得超過 80 字。";
    }

    if (payload.note && payload.note.length > 300) {
      return "備註不得超過 300 字。";
    }

    return null;
  }

  function isCoolingDown() {
    const last = Number(localStorage.getItem(cooldownKey) || "0");
    if (!last) {
      return false;
    }

    return Date.now() - last < cooldownMs;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitBtn.disabled) {
      return;
    }

    const formData = new FormData(form);

    if (normalizeText(formData.get("website"))) {
      setStatus("已收到回覆，謝謝你。", "ok");
      return;
    }

    if (isCoolingDown()) {
      setStatus("送出太頻繁，請稍候 15 秒再試。", "error");
      return;
    }

    const payload = {
      name: normalizeText(formData.get("name")),
      phone: normalizeText(formData.get("phone")).replace(/[^\d]/g, ""),
      attendees: Number(formData.get("attendees")),
      dietary: normalizeText(formData.get("dietary")) || null,
      note: normalizeText(formData.get("note")) || null,
    };

    const validationError = validate(payload);
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("資料送出中，請稍候...");

    try {
      const { error } = await client.from(tableName).insert(payload);
      if (error) {
        throw error;
      }

      localStorage.setItem(cooldownKey, String(Date.now()));
      form.reset();
      const attendeesInput = document.getElementById("attendees");
      if (attendeesInput) {
        attendeesInput.value = "1";
      }

      setStatus("送出成功，謝謝你的回覆。", "ok");
    } catch (error) {
      console.error("RSVP submit failed:", error);
      setStatus("送出失敗，請確認設定或稍後再試。", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
