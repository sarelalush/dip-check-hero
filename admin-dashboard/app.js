const { createClient } = window.supabase;
const config = window.ADMIN_CONFIG;
const SCAN_IMAGES_BUCKET = "scan-images";
const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const app = document.querySelector("#app");

let state = {
  session: null,
  user: null,
  rows: [],
  scans: [],
  query: "",
  scanQuery: "",
  selectedAccountId: "",
  selectedGrant: null,
  loading: true,
  scansLoading: false,
  error: "",
  scanError: "",
  imageUrlCache: {},
  imageViewer: null,
};

boot();

async function boot() {
  renderLoading("בודק התחברות...");
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user ?? null;

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    state.user = session?.user ?? null;
    if (session) {
      loadDashboard();
    } else {
      renderLogin();
    }
  });

  if (state.session) {
    await loadDashboard();
  } else {
    renderLogin();
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <div class="water-logo" aria-hidden="true">💧</div>
        <p class="eyebrow">AquaSense Admin</p>
        <h1>דשבורד ניהול חיצוני</h1>
        <p class="subtitle center">כניסה למחשב בלבד לניהול משתמשים, מנויים וסריקות.</p>
        <form id="login-form" class="form-grid">
          <label class="field">
            אימייל
            <input class="input" name="email" type="email" autocomplete="email" required placeholder="admin@example.com" />
          </label>
          <label class="field">
            סיסמה
            <input class="input" name="password" type="password" autocomplete="current-password" required placeholder="סיסמת המשתמש" />
          </label>
          <button class="button primary" type="submit">התחבר</button>
          <button class="button secondary" type="button" id="google-login">כניסה עם Google</button>
        </form>
        <p class="hint">
          הדשבורד אינו חלק מאפליקציית המובייל ולא יופיע למשתמשים. רק משתמש שמוגדר כאדמין ב-Supabase יכול להיכנס.
        </p>
        <p class="error hidden" id="login-error"></p>
      </section>
    </main>
  `;

  document.querySelector("#login-form").addEventListener("submit", handlePasswordLogin);
  document.querySelector("#google-login").addEventListener("click", handleGoogleLogin);
}

async function handlePasswordLogin(event) {
  event.preventDefault();
  const errorEl = document.querySelector("#login-error");
  errorEl.classList.add("hidden");
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = `התחברות נכשלה: ${error.message}`;
    errorEl.classList.remove("hidden");
  }
}

async function handleGoogleLogin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) {
    const errorEl = document.querySelector("#login-error");
    errorEl.textContent = `כניסה עם Google נכשלה: ${error.message}`;
    errorEl.classList.remove("hidden");
  }
}

async function loadDashboard() {
  state.loading = true;
  state.error = "";
  renderDashboard();

  const { data, error } = await supabase.rpc("admin_dashboard_users");
  if (error) {
    state.rows = [];
    state.scans = [];
    state.error =
      error.message === "not_authorized"
        ? "אין הרשאת אדמין למשתמש הזה. צריך להוסיף אותו לטבלת user_roles."
        : `טעינת הדשבורד נכשלה: ${error.message}`;
    state.loading = false;
    renderDashboard();
    return;
  }

  state.rows = data ?? [];
  if (!state.rows.some((row) => row.account_id === state.selectedAccountId)) {
    state.selectedAccountId = state.rows[0]?.account_id ?? "";
  }

  state.loading = false;
  renderDashboard();

  if (state.selectedAccountId) {
    await loadScans(state.selectedAccountId);
  }
}

async function loadScans(accountId) {
  state.scansLoading = true;
  state.scanError = "";
  state.scans = [];
  renderDashboard();

  const { data, error } = await supabase.rpc("admin_dashboard_scans", {
    p_account_id: accountId,
    p_limit: 250,
  });

  if (error) {
    state.scanError =
      error.message === "not_authorized"
        ? "אין הרשאת אדמין לצפייה בסריקות."
        : `טעינת הסריקות נכשלה: ${error.message}`;
    state.scans = [];
  } else {
    state.scans = await hydrateScanImages(data ?? []);
  }

  state.scansLoading = false;
  renderDashboard();
}

function renderDashboard() {
  const rows = filteredRows();
  const selected = selectedRow();
  const stats = buildStats(state.rows);

  app.innerHTML = `
    <main class="admin-page">
      <section class="hero">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">AquaSense</p>
            <h1>מרכז הבקרה</h1>
            <p class="subtitle">משתמשים, מנויים וסריקות במקום אחד</p>
          </div>
        </div>
        <div class="hero-actions">
          <span class="external-badge"><i></i> המערכת מחוברת</span>
          <button class="button secondary" id="refresh" type="button">רענון נתונים</button>
          <button class="button ghost" id="logout" type="button">יציאה</button>
        </div>
      </section>

      <div class="overview-heading">
        <div>
          <p class="eyebrow">תמונת מצב</p>
          <h2>מה קורה ב-AquaSense</h2>
        </div>
        <p>הנתונים מתעדכנים ישירות ממסד הנתונים</p>
      </div>

      <section class="stats-grid">
        ${statCard("משתמשים", stats.users, "חשבונות במערכת")}
        ${statCard("מנויים פעילים", stats.active, "כולל מנויי admin")}
        ${statCard("בריכות", stats.pools, "בריכות פעילות")}
        ${statCard("סריקות", stats.used, "חיוביות שנוצלו")}
        ${statCard("נותרו", stats.remaining, "סריקות זמינות")}
      </section>

      <section class="workspace">
        <aside class="users-panel">
          <div class="panel-title">
            <div>
              <h2>משתמשים</h2>
              <p class="subtitle">${number(rows.length)} מתוך ${number(state.rows.length)}</p>
            </div>
          </div>
          <input class="input search" id="search" value="${escapeHtml(state.query)}" placeholder="חיפוש לפי שם, אימייל או סטטוס" />
          ${renderUserList(rows)}
        </aside>

        <section class="detail-panel">
          ${state.loading ? renderBigLoading("אוסף נתונים מהמסד...") : state.error ? renderNotice(state.error) : renderSelectedUser(selected)}
        </section>
      </section>
    </main>
    ${state.selectedGrant ? renderGrantModal(state.selectedGrant) : ""}
    ${state.imageViewer ? renderImageViewer(state.imageViewer) : ""}
  `;

  bindDashboardEvents();
}

function bindDashboardEvents() {
  document.querySelector("#refresh")?.addEventListener("click", loadDashboard);
  document.querySelector("#logout")?.addEventListener("click", () => supabase.auth.signOut());
  document.querySelector("#search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderDashboard();
  });
  document.querySelector("#scan-search")?.addEventListener("input", (event) => {
    state.scanQuery = event.target.value;
    renderDashboard();
  });

  for (const button of document.querySelectorAll("[data-select-account]")) {
    button.addEventListener("click", async () => {
      const accountId = button.getAttribute("data-select-account");
      if (!accountId || accountId === state.selectedAccountId) return;
      state.selectedAccountId = accountId;
      state.scanQuery = "";
      await loadScans(accountId);
    });
  }

  for (const button of document.querySelectorAll("[data-grant-account]")) {
    button.addEventListener("click", () => {
      const accountId = button.getAttribute("data-grant-account");
      state.selectedGrant = state.rows.find((row) => row.account_id === accountId) ?? null;
      renderDashboard();
    });
  }

  for (const button of document.querySelectorAll("[data-open-image]")) {
    button.addEventListener("click", () => {
      const url = button.getAttribute("data-open-image");
      if (!url) return;
      state.imageViewer = {
        url,
        title: button.getAttribute("data-image-title") || "תמונת סריקה",
      };
      renderDashboard();
    });
  }

  document.querySelector("#close-modal")?.addEventListener("click", () => {
    state.selectedGrant = null;
    renderDashboard();
  });

  document.querySelector("#close-image-viewer")?.addEventListener("click", () => {
    state.imageViewer = null;
    renderDashboard();
  });

  document.querySelector("#preset-month")?.addEventListener("click", () => applyPreset(1, null));
  document.querySelector("#preset-year")?.addEventListener("click", () => applyPreset(12, null));
  document.querySelector("#preset-decade")?.addEventListener("click", () => applyPreset(120, { pools: 1000, scans: 120000 }));
  document.querySelector("#grant-form")?.addEventListener("submit", submitGrant);
}

function renderUserList(rows) {
  if (state.loading) {
    return renderBigLoading("טוען משתמשים...");
  }
  if (state.error) {
    return renderNotice(state.error);
  }
  if (!rows.length) {
    return `<div class="empty-state">לא נמצאו משתמשים</div>`;
  }

  return `
    <div class="user-list">
      ${rows.map(renderUserButton).join("")}
    </div>
  `;
}

function renderUserButton(row) {
  const active = isSubscriptionActive(row);
  const selected = row.account_id === state.selectedAccountId;
  const title = row.full_name || row.email || row.account_name || "משתמש ללא שם";
  const initials = makeInitials(title);

  return `
    <button class="user-card ${selected ? "selected" : ""}" data-select-account="${escapeHtml(row.account_id)}" type="button">
      <span class="avatar">${escapeHtml(initials)}</span>
      <span class="user-card-body">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(row.email || "אין אימייל בפרופיל")}</small>
        <span class="mini-line">
          <span>${number(row.scans_remaining)} סריקות</span>
          <span>${number(row.pools_active_count)}/${number(row.total_pool_limit)} בריכות</span>
        </span>
      </span>
      <span class="status-dot ${active ? "ok" : "bad"}" title="${active ? "מנוי פעיל" : "ללא מנוי פעיל"}"></span>
    </button>
  `;
}

function renderSelectedUser(row) {
  if (!row) {
    return `<div class="empty-state tall">בחר משתמש כדי לראות פרטים וסריקות</div>`;
  }

  const active = isSubscriptionActive(row);
  const scanPercent = percent(row.scans_billable, row.total_scan_limit);
  const poolPercent = percent(row.pools_active_count, row.total_pool_limit);

  return `
    <div class="detail-header">
      <div class="detail-identity">
        <span class="detail-avatar">${escapeHtml(makeInitials(row.full_name || row.email || row.account_name || "משתמש"))}</span>
        <div>
          <p class="eyebrow">${active ? "מנוי פעיל" : "ללא מנוי פעיל"}</p>
          <h2>${escapeHtml(row.full_name || row.email || row.account_name || "משתמש")}</h2>
          <p class="subtitle">${escapeHtml(row.email || "אין אימייל")} · ${escapeHtml(row.account_name || "חשבון ללא שם")}</p>
        </div>
      </div>
      <button class="button primary" data-grant-account="${escapeHtml(row.account_id)}" type="button">פתח / עדכן מנוי</button>
    </div>

    <div class="quota-grid">
      ${quotaCard("סריקות", row.scans_billable, row.total_scan_limit, `${number(row.scans_remaining)} נותרו`, scanPercent)}
      ${quotaCard("בריכות", row.pools_active_count, row.total_pool_limit, "בריכות פעילות", poolPercent)}
      ${infoCard("תוקף מנוי", `${formatDate(row.current_period_start)} - ${formatDate(row.current_period_end)}`, row.subscription_provider || "אין ספק")}
      ${infoCard("בדיקה אחרונה", formatDateTime(row.last_scan_at), `${number(row.tests_count)} סריקות במערכת`)}
    </div>

    <section class="scans-panel">
      <div class="section-head">
        <div>
          <h3>סריקות של המשתמש</h3>
          <p class="subtitle">היסטוריית בדיקות, תוצאות, תמונות והמלצות. אין כאן קריאה ל-Gemini.</p>
        </div>
        <input class="input scan-search" id="scan-search" value="${escapeHtml(state.scanQuery)}" placeholder="חיפוש בסריקות" />
      </div>
      ${renderScans()}
    </section>
  `;
}

function renderScans() {
  if (state.scansLoading) {
    return renderBigLoading("טוען סריקות...");
  }
  if (state.scanError) {
    return renderNotice(state.scanError);
  }

  const scans = filteredScans();
  if (!scans.length) {
    return `<div class="empty-state">אין סריקות להצגה עבור המשתמש הזה</div>`;
  }

  return `
    <div class="scan-list">
      ${scans.map(renderScanCard).join("")}
    </div>
  `;
}

function renderScanCard(scan) {
  const readings = asArray(scan.readings);
  const recommendations = asArray(scan.recommendations);
  const statusClass = scan.analysis_status === "completed" ? "ok" : scan.analysis_status === "failed" ? "bad" : "warn";

  return `
    <article class="scan-card">
      <div class="scan-main">
        <div class="scan-top">
          <span class="scan-status ${statusClass}">${statusLabel(scan.analysis_status)}</span>
          <strong>${formatDateTime(scan.analyzed_at || scan.created_at)}</strong>
        </div>
        <div class="scan-meta">
          <span>${escapeHtml(scan.pool_name || "ללא בריכה")}</span>
          <span>${escapeHtml(scan.strip_brand_id || "ללא סטיק")}</span>
          <span>${escapeHtml([scan.provider, scan.model].filter(Boolean).join(" · ") || "ללא מודל")}</span>
        </div>
        ${scan.error_message ? `<p class="scan-error">${escapeHtml(scan.error_message)}</p>` : ""}
        ${scan.recommendation ? `<p class="scan-note">${escapeHtml(scan.recommendation)}</p>` : ""}
        ${readings.length ? renderReadings(readings) : `<p class="muted-line">אין ערכי קריאה שמורים לסריקה הזו</p>`}
        ${recommendations.length ? renderRecommendations(recommendations) : ""}
      </div>
      <div class="scan-side">
        <span class="confidence">${confidenceLabel(scan.confidence)}</span>
        <span class="billable ${scan.is_billable ? "yes" : "no"}">${scan.is_billable ? "נספר במכסה" : "לא נספר"}</span>
        ${renderScanImage(scan)}
      </div>
    </article>
  `;
}

function renderScanImage(scan) {
  const source = scan.image_source || scan.image_url || scan.image_path || "";
  if (!source) {
    return `<div class="scan-image-empty">לא נשמרה תמונה</div>`;
  }

  if (!scan.image_preview_url) {
    return `<div class="scan-image-empty">לא ניתן לטעון תמונה</div>`;
  }

  const title = `${formatDateTime(scan.analyzed_at || scan.created_at)} · ${scan.pool_name || "ללא בריכה"}`;

  return `
    <button class="scan-image-thumb" type="button" data-open-image="${escapeAttr(scan.image_preview_url)}" data-image-title="${escapeAttr(title)}">
      <img src="${escapeAttr(scan.image_preview_url)}" alt="תמונת סריקה" loading="lazy" />
      <span>פתח תמונה</span>
    </button>
  `;
}

function renderImageViewer(viewer) {
  return `
    <div class="modal image-viewer">
      <section class="modal-card image-viewer-card">
        <div class="modal-head">
          <div>
            <p class="eyebrow">תמונת סריקה</p>
            <h2>${escapeHtml(viewer.title || "תמונת סריקה")}</h2>
          </div>
          <button class="button ghost" id="close-image-viewer" type="button">סגור</button>
        </div>
        <div class="image-viewer-frame">
          <img src="${escapeAttr(viewer.url)}" alt="תמונת סריקה מלאה" />
        </div>
        <a class="image-link" href="${escapeAttr(viewer.url)}" target="_blank" rel="noreferrer">פתח בלשונית חדשה</a>
      </section>
    </div>
  `;
}

function renderReadings(readings) {
  return `
    <div class="reading-grid">
      ${readings
        .map((reading) => {
          const status = normalizeStatus(reading.status);
          return `
            <div class="reading-chip ${status}">
              <span>${escapeHtml(reading.label || reading.key || "מדד")}</span>
              <strong>${formatReadingValue(reading)}</strong>
              <small>${statusText(status)}</small>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderRecommendations(recommendations) {
  return `
    <div class="recommendations">
      ${recommendations
        .slice(0, 3)
        .map(
          (item) => `
            <div class="recommendation">
              <strong>${escapeHtml(item.title || "המלצה")}</strong>
              <p>${escapeHtml(item.description || "")}</p>
              ${item.amount ? `<small>${escapeHtml(item.amount)} ${escapeHtml(item.unit || "")} · ${escapeHtml(item.product_type || "")}</small>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderGrantModal(row) {
  const now = new Date();
  const start = toInputDateTime(row.current_period_start) || toInputDateTime(now.toISOString());
  const end = toInputDateTime(row.current_period_end) || toInputDateTime(addMonths(now, 1).toISOString());

  return `
    <div class="modal">
      <section class="modal-card">
        <div class="modal-head">
          <div>
            <p class="eyebrow">מנוי ידני</p>
            <h2>פתיחת / עדכון מנוי</h2>
            <p class="subtitle">${escapeHtml(row.full_name || row.email || row.account_name || "משתמש")}</p>
          </div>
          <button class="button ghost" id="close-modal" type="button">סגור</button>
        </div>

        <div class="preset-row">
          <button class="button secondary" id="preset-month" type="button">חודש</button>
          <button class="button secondary" id="preset-year" type="button">שנה</button>
          <button class="button secondary" id="preset-decade" type="button">10 שנים + 1000 בריכות</button>
        </div>

        <form id="grant-form">
          <div class="modal-grid">
            <label class="field">
              מתאריך
              <input class="input" name="start" type="datetime-local" value="${start}" required />
            </label>
            <label class="field">
              עד תאריך
              <input class="input" name="end" type="datetime-local" value="${end}" required />
            </label>
            <label class="field">
              מקסימום בריכות
              <input class="input" name="poolLimit" type="number" min="1" value="${Math.max(row.total_pool_limit || 1, 1)}" required />
            </label>
            <label class="field">
              מקסימום סריקות
              <input class="input" name="scanLimit" type="number" min="0" step="50" value="${Math.max(row.total_scan_limit || 200, 200)}" required />
            </label>
          </div>
          <p class="hint">שמירה כאן יוצרת מנוי מסוג admin ומעדכנת את המכסות בחשבון הנבחר בלבד.</p>
          <button class="button primary full" type="submit">שמור מנוי</button>
          <p class="error hidden" id="grant-error"></p>
        </form>
      </section>
    </div>
  `;
}

async function submitGrant(event) {
  event.preventDefault();
  if (!state.selectedGrant) return;

  const errorEl = document.querySelector("#grant-error");
  errorEl.classList.add("hidden");
  const form = new FormData(event.currentTarget);
  const start = new Date(String(form.get("start")));
  const end = new Date(String(form.get("end")));
  const poolLimit = Number(form.get("poolLimit"));
  const scanLimit = Number(form.get("scanLimit"));

  if (!Number.isFinite(poolLimit) || poolLimit < 1 || !Number.isFinite(scanLimit) || scanLimit < 0 || end <= start) {
    errorEl.textContent = "אחד הערכים לא תקין. בדוק תאריכים ומכסות.";
    errorEl.classList.remove("hidden");
    return;
  }

  const button = event.currentTarget.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "שומר...";

  const { error } = await supabase.rpc("admin_grant_subscription", {
    p_account_id: state.selectedGrant.account_id,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_pool_limit: poolLimit,
    p_scan_limit: scanLimit,
    p_plan_id: "basic_monthly",
  });

  if (error) {
    errorEl.textContent = `שמירת המנוי נכשלה: ${error.message}`;
    errorEl.classList.remove("hidden");
    button.disabled = false;
    button.textContent = "שמור מנוי";
    return;
  }

  state.selectedGrant = null;
  await loadDashboard();
}

function applyPreset(months, overrides) {
  const form = document.querySelector("#grant-form");
  if (!form) return;
  const now = new Date();
  const end = addMonths(now, months);
  form.elements.start.value = toInputDateTime(now.toISOString());
  form.elements.end.value = toInputDateTime(end.toISOString());
  if (overrides?.pools) form.elements.poolLimit.value = overrides.pools;
  if (overrides?.scans) form.elements.scanLimit.value = overrides.scans;
}

function statCard(label, value, description) {
  return `
    <article class="stat-card">
      <div class="stat-card-top">
        <span>${label}</span>
        <i aria-hidden="true"></i>
      </div>
      <strong>${number(value)}</strong>
      <small>${description}</small>
    </article>
  `;
}

function quotaCard(label, used, total, caption, progress) {
  return `
    <article class="quota-card">
      <div>
        <span>${label}</span>
        <strong>${number(used)} / ${number(total)}</strong>
        <small>${caption}</small>
      </div>
      <div class="ring" style="--value:${progress}">
        <b>${progress}%</b>
      </div>
    </article>
  `;
}

function infoCard(label, value, caption) {
  return `
    <article class="quota-card simple">
      <div>
        <span>${label}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(caption || "")}</small>
      </div>
    </article>
  `;
}

function renderBigLoading(label) {
  return `<div class="empty-state tall"><span class="spinner"></span>${label}</div>`;
}

function renderNotice(message) {
  return `<div class="notice">${escapeHtml(message)}</div>`;
}

async function hydrateScanImages(scans) {
  return Promise.all(
    scans.map(async (scan) => {
      const source = scan.image_path || scan.image_url || "";
      return {
        ...scan,
        image_source: source,
        image_preview_url: await resolveScanImageUrl(source),
      };
    }),
  );
}

async function resolveScanImageUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (state.imageUrlCache[source]) return state.imageUrlCache[source];

  if (/^(data:|blob:)/i.test(source)) {
    state.imageUrlCache[source] = source;
    return source;
  }

  if (/^file:/i.test(source)) {
    return "";
  }

  const path = normalizeStoragePath(source);
  if (!path) {
    if (/^https?:/i.test(source)) {
      state.imageUrlCache[source] = source;
      return source;
    }
    return "";
  }

  const { data, error } = await supabase.storage.from(SCAN_IMAGES_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.warn("Could not create signed scan image URL", { source, path, error });
    return "";
  }

  state.imageUrlCache[source] = data.signedUrl;
  return data.signedUrl;
}

function normalizeStoragePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const publicMarker = `/object/public/${SCAN_IMAGES_BUCKET}/`;
    const signedMarker = `/object/sign/${SCAN_IMAGES_BUCKET}/`;

    if (url.pathname.includes(publicMarker)) {
      return decodeURIComponent(url.pathname.split(publicMarker)[1] || "").split("?")[0];
    }

    if (url.pathname.includes(signedMarker)) {
      return decodeURIComponent(url.pathname.split(signedMarker)[1] || "").split("?")[0];
    }

    return "";
  } catch {
    // Plain storage paths are handled below.
  }

  let path = raw.replace(/^\/+/, "");
  if (path.startsWith(`${SCAN_IMAGES_BUCKET}/`)) {
    path = path.slice(SCAN_IMAGES_BUCKET.length + 1);
  }
  return path;
}

function buildStats(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.users += 1;
      acc.active += isSubscriptionActive(row) ? 1 : 0;
      acc.pools += row.pools_active_count || 0;
      acc.used += row.scans_billable || 0;
      acc.remaining += row.scans_remaining || 0;
      return acc;
    },
    { users: 0, active: 0, pools: 0, used: 0, remaining: 0 },
  );
}

function filteredRows() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.rows;

  return state.rows.filter((row) =>
    [row.email, row.full_name, row.account_name, row.subscription_status, row.subscription_provider]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function filteredScans() {
  const query = state.scanQuery.trim().toLowerCase();
  if (!query) return state.scans;

  return state.scans.filter((scan) => {
    const readings = asArray(scan.readings)
      .map((reading) => `${reading.key} ${reading.label} ${reading.value} ${reading.status}`)
      .join(" ");
    const recommendations = asArray(scan.recommendations)
      .map((item) => `${item.title} ${item.description} ${item.product_type}`)
      .join(" ");
    return [scan.pool_name, scan.strip_brand_id, scan.analysis_status, scan.overall_status, scan.provider, scan.model, readings, recommendations]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function selectedRow() {
  return state.rows.find((row) => row.account_id === state.selectedAccountId) ?? null;
}

function isSubscriptionActive(row) {
  if (!row.subscription_status) return false;
  if (["active", "trialing", "past_due"].includes(row.subscription_status)) {
    return !row.current_period_end || new Date(row.current_period_end) > new Date();
  }
  return row.subscription_status === "canceled" && row.current_period_end && new Date(row.current_period_end) > new Date();
}

function percent(used, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((used || 0) / total) * 100)));
}

function normalizeStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["ok", "balanced", "normal", "good", "ideal"].includes(status)) return "ok";
  if (["high", "low", "warning", "warn"].includes(status)) return "warn";
  if (["critical", "bad", "danger", "very_high", "very_low"].includes(status)) return "bad";
  return "neutral";
}

function statusText(status) {
  return {
    ok: "תקין",
    warn: "דורש תשומת לב",
    bad: "גבוה / נמוך",
    neutral: "לא ידוע",
  }[status];
}

function statusLabel(status) {
  return {
    completed: "הושלם",
    failed: "נכשל",
    pending: "ממתין",
    processing: "בתהליך",
  }[status] || status || "לא ידוע";
}

function confidenceLabel(value) {
  if (value === null || value === undefined || value === "") return "אין ביטחון";
  return `${Math.round(Number(value) * 100)}% ביטחון`;
}

function formatReadingValue(reading) {
  const value = reading.value ?? "-";
  return `${value}${reading.unit ? ` ${reading.unit}` : ""}`;
}

function makeInitials(value) {
  return String(value || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toInputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDate(value) {
  if (!value) return "אין נתון";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "אין נתון";
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "אין נתון";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "אין נתון";
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function number(value) {
  return Number(value || 0).toLocaleString("he-IL");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function renderLoading(label) {
  app.innerHTML = `<div class="loading-screen"><span class="spinner"></span>${label}</div>`;
}
