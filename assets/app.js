(() => {
  const submitBtn = document.querySelector('a[href^="xiumish://form.opera/cubes/current/submit"]');
  const nameEl = document.querySelector('input[name="name"]');
  const phoneEl = document.querySelector('input[name="phone"]');
  const emailEl = document.querySelector('input[name="email"]');
  const attendeesEl = document.querySelector('select[name="attendees"]');
  const beefCountEl = document.querySelector('select[name="beef_count"]');
  const porkCountEl = document.querySelector('select[name="pork_count"]');
  const vegetarianCountEl = document.querySelector('select[name="vegetarian_count"]');
  const childMealCountEl = document.querySelector('select[name="child_meal_count"]');
  const specialRequestEl = document.querySelector('textarea[name="special_request"]');
  const blessingEl = document.querySelector('textarea[name="blessing"]');

  if (
    !submitBtn ||
    !nameEl ||
    !phoneEl ||
    !emailEl ||
    !attendeesEl ||
    !beefCountEl ||
    !porkCountEl ||
    !vegetarianCountEl ||
    !childMealCountEl ||
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

  function parseNonNegativeInt(value) {
    const parsed = Number.parseInt(normalizeText(value), 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  function setSelectOptions(selectEl, maxValue, nextValue) {
    const safeMax = Math.max(0, maxValue);
    const safeValue = Math.max(0, Math.min(nextValue, safeMax));
    const optionsHtml = Array.from({ length: safeMax + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
    selectEl.innerHTML = optionsHtml;
    selectEl.value = String(safeValue);
  }

  function syncMealOptions() {
    const attendees = parseNonNegativeInt(attendeesEl.value);
    const mealSelects = [beefCountEl, porkCountEl, vegetarianCountEl, childMealCountEl];

    mealSelects.forEach((selectEl) => {
      const otherTotal = mealSelects
        .filter((el) => el !== selectEl)
        .reduce((sum, el) => sum + parseNonNegativeInt(el.value), 0);
      const maxForCurrent = Math.max(0, attendees - otherTotal);
      const currentValue = parseNonNegativeInt(selectEl.value);
      setSelectOptions(selectEl, maxForCurrent, currentValue);
    });
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

    if (
      !Number.isInteger(payload.beefCount) ||
      payload.beefCount < 0 ||
      payload.beefCount > 5 ||
      !Number.isInteger(payload.porkCount) ||
      payload.porkCount < 0 ||
      payload.porkCount > 5 ||
      !Number.isInteger(payload.vegetarianCount) ||
      payload.vegetarianCount < 0 ||
      payload.vegetarianCount > 5 ||
      !Number.isInteger(payload.childMealCount) ||
      payload.childMealCount < 0 ||
      payload.childMealCount > 5
    ) {
      return "餐點數量格式錯誤，請使用 0 到 5。";
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

  attendeesEl.addEventListener("change", syncMealOptions);
  beefCountEl.addEventListener("change", syncMealOptions);
  porkCountEl.addEventListener("change", syncMealOptions);
  vegetarianCountEl.addEventListener("change", syncMealOptions);
  childMealCountEl.addEventListener("change", syncMealOptions);
  syncMealOptions();

  submitBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    if (submitBtn.dataset.submitting === "1") {
      return;
    }

    if (isCoolingDown()) {
      setStatus("送出太頻繁，請稍候 15 秒再試。", "error");
      return;
    }

    const payload = {
      name: normalizeText(nameEl.value),
      phone: normalizeText(phoneEl.value).replace(/[^\d]/g, ""),
      email: normalizeText(emailEl.value).toLowerCase(),
      attendees: Number.parseInt(normalizeText(attendeesEl.value), 10),
      beefCount: Number.parseInt(normalizeText(beefCountEl.value), 10),
      porkCount: Number.parseInt(normalizeText(porkCountEl.value), 10),
      vegetarianCount: Number.parseInt(normalizeText(vegetarianCountEl.value), 10),
      childMealCount: Number.parseInt(normalizeText(childMealCountEl.value), 10),
      specialRequest: normalizeText(specialRequestEl.value) || null,
      blessing: normalizeText(blessingEl.value) || null,
    };

    const validationError = validate(payload);
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    const mealTotal = payload.beefCount + payload.porkCount + payload.vegetarianCount + payload.childMealCount;
    if (mealTotal !== payload.attendees) {
      const shouldContinue = window.confirm("提醒：餐點總數與出席人數不一致。按「確定」繼續送出，按「取消」返回修改。");
      if (!shouldContinue) {
        setStatus("已取消送出，請調整後再提交。", "error");
        return;
      }
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
          beef_count: payload.beefCount,
          pork_count: payload.porkCount,
          vegetarian_count: payload.vegetarianCount,
          child_meal_count: payload.childMealCount,
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
      beefCountEl.value = "0";
      porkCountEl.value = "0";
      vegetarianCountEl.value = "0";
      childMealCountEl.value = "0";
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
