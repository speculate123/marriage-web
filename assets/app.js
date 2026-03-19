(() => {
  const submitBtn = document.querySelector('a[href^="xiumish://form.opera/cubes/current/submit"]');
  const nameEl = document.querySelector('input[name="name"]');
  const phoneEl = document.querySelector('input[name="phone"]');
  const emailEl = document.querySelector('input[name="email"]');
  const attendeesEl = document.querySelector('select[name="attendees"]');
  const mealEls = document.querySelectorAll('input[name="meal_choice"]');
  const dietaryEls = document.querySelectorAll('input[name="dietary"]');
  const dietaryOtherEl = document.querySelector('input[name="dietary_other"]');
  const specialRequestEl = document.querySelector('textarea[name="special_request"]');
  const blessingEl = document.querySelector('textarea[name="blessing"]');

  if (
    !submitBtn ||
    !nameEl ||
    !phoneEl ||
    !emailEl ||
    !attendeesEl ||
    !mealEls.length ||
    !dietaryEls.length ||
    !specialRequestEl ||
    !blessingEl
  ) {
    return;
  }

  const config = window.RSVP_CONFIG || {};
  const supabaseUrl = (config.SUPABASE_URL || "").trim();
  const supabaseAnonKey = (config.SUPABASE_ANON_KEY || "").trim();
  const tableName = (config.TABLE_NAME || "rsvp_submissions").trim();
  const cooldownMs = Number(config.COOLDOWN_MS) || 15000;
  const cooldownKey = "rsvp_last_submit_at";

  let statusEl = document.getElementById("rsvp-status");
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "rsvp-status";
    statusEl.style.marginTop = "8px";
    statusEl.style.textAlign = "center";
    statusEl.style.fontSize = "14px";
    statusEl.style.color = "rgb(144, 52, 1)";
    submitBtn.parentElement.appendChild(statusEl);
  }

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.style.color = type === "ok" ? "rgb(42, 120, 58)" : "rgb(144, 52, 1)";
  }

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("YOUR-PROJECT-ID")) {
    setStatus("請先在 assets/config.js 填入 Supabase 連線資訊。", "error");
    submitBtn.style.pointerEvents = "none";
    submitBtn.style.opacity = "0.6";
    return;
  }

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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return "電子郵件格式錯誤。";
    }

    if (!Number.isInteger(payload.attendees) || payload.attendees < 1 || payload.attendees > 5) {
      return "出席人數需為 1 到 5。";
    }

    if (!payload.mealChoice) {
      return "請選擇餐點。";
    }

    if (!payload.dietary) {
      return "請選擇飲食需求。";
    }

    if (payload.dietary === "其他" && !payload.dietaryOther) {
      return "飲食需求選擇「其他」時，請填寫內容。";
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

  submitBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    if (submitBtn.dataset.submitting === "1") {
      return;
    }

    if (isCoolingDown()) {
      setStatus("送出太頻繁，請稍候 15 秒再試。", "error");
      return;
    }

    const selectedMeal = normalizeText(document.querySelector('input[name="meal_choice"]:checked')?.value || "");
    const selectedDietary = normalizeText(document.querySelector('input[name="dietary"]:checked')?.value || "");
    const dietaryOther = normalizeText(dietaryOtherEl?.value || "");

    const payload = {
      name: normalizeText(nameEl.value),
      phone: normalizeText(phoneEl.value).replace(/[^\d]/g, ""),
      email: normalizeText(emailEl.value).toLowerCase(),
      attendees: Number.parseInt(normalizeText(attendeesEl.value), 10),
      mealChoice: selectedMeal || null,
      dietary: selectedDietary === "其他" ? `其他：${dietaryOther}` : (selectedDietary || null),
      dietaryOther: dietaryOther || null,
      specialRequest: normalizeText(specialRequestEl.value) || null,
      blessing: normalizeText(blessingEl.value) || null,
    };

    const validationError = validate(payload);
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    submitBtn.dataset.submitting = "1";
    submitBtn.style.pointerEvents = "none";
    submitBtn.style.opacity = "0.6";
    setStatus("資料送出中，請稍候...");

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          attendees: payload.attendees,
          meal_choice: payload.mealChoice,
          dietary: payload.dietary,
          special_request: payload.specialRequest,
          blessing: payload.blessing,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `HTTP ${response.status}`);
      }

      localStorage.setItem(cooldownKey, String(Date.now()));
      nameEl.value = "";
      phoneEl.value = "";
      emailEl.value = "";
      attendeesEl.value = "";
      mealEls.forEach((el) => {
        el.checked = false;
      });
      dietaryEls.forEach((el) => {
        el.checked = false;
      });
      if (dietaryOtherEl) dietaryOtherEl.value = "";
      specialRequestEl.value = "";
      blessingEl.value = "";

      setStatus("送出成功，謝謝你的回覆。", "ok");
    } catch (error) {
      console.error("RSVP submit failed:", error);
      setStatus("送出失敗，請確認設定或稍後再試。", "error");
    } finally {
      submitBtn.dataset.submitting = "0";
      submitBtn.style.pointerEvents = "";
      submitBtn.style.opacity = "";
    }
  });
})();
