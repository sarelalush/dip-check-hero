const { createClient } = window.supabase;
const config = window.ADMIN_CONFIG;
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
  query: "",
  loading: true,
  error: "",
  selected: null,
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
        <div class="logo" style="margin:0 auto 14px">💧</div>
        <h1>AquaSense Admin</h1>
        <p class="subtitle" style="text-align:center">כניסה לדשבורד ניהול חיצוני</p>
        <form id="login-form" class="form-grid">
          <label class="field">
            אימייל
            <input class="input" name="email" type="email" autocomplete="email" required placeholder="admin@example.com" />
          </label>
          <label class="field">
            סיסמה
            <input class="input" name="password" type="password" autocomplete="current-password" required placeholder="סיסמת המשתמש" />
          </label>
          <button class="button" type="submit">התחבר</button>
          <button class="button secondary" type="button" id="google-login">כניסה עם Google</button>
        </form>
        <p class="hint">
          זה כלי נפרד מהאפליקציה. רק משתמש שמוגדר כאדמין בטבלת user_roles יכול לראות נתונים ולפתוח מנויים.
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
    state.error =
      error.message === "not_authorized"
        ? "אין הרשאת אדמין למשתמש הזה. צריך להוסיף אותו לטבלת user_roles."
        : `טעינת הדשבורד נכשלה: ${error.message}`;
  } else {
    state.rows = data ?? [];
  }

  state.loading = false;
  renderDashboard();
}

function renderDashboard() {
  const rows = filteredRows();
  const stats = buildStats(state.rows);

  app.innerHTML = `
    <main class="page">
      <header class="topbar">
        <div class="brand">
          <div class="logo">💧</div>
          <div>
            <h1>דשבורד ניהול</h1>
            <p class="subtitle">משתמשים, מנויים, בריכות וסריקות</p>
          </div>
        </div>
        <div class="actions">
          <button class="button secondary" id="refresh">רענן נתונים</button>
          <button class="button danger" id="logout">יציאה</button>
        </div>
      </header>

      <section class="stats">
        ${statCard("משתמשים", stats.users)}
        ${statCard("מנויים פעילים", stats.active)}
        ${statCard("בריכות פעילות", stats.pools)}
        ${statCard("סריקות שנוצלו", stats.used)}
        ${statCard("סריקות שנותרו", stats.remaining)}
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>חשבונות משתמשים</h2>
            <p class="subtitle">הדשבורד לא מפעיל סריקה ולא קורא ל-Gemini.</p>
          </div>
          <input class="input search" id="search" value="${escapeHtml(state.query)}" placeholder="חיפוש לפי שם, אימייל או סטטוס" />
        </div>
        ${renderRows(rows)}
      </section>
    </main>
    ${state.selected ? renderGrantModal(state.selected) : ""}
  `;

  document.querySelector("#refresh").addEventListener("click", loadDashboard);
  document.querySelector("#logout").addEventListener("click", () => supabase.auth.signOut());
  document.querySelector("#search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderDashboard();
  });

  for (const button of document.querySelectorAll("[data-grant-account]")) {
    button.addEventListener("click", () => {
      const accountId = button.getAttribute("data-grant-account");
      state.selected = state.rows.find((row) => row.account_id === accountId) ?? null;
      renderDashboard();
    });
  }

  const closeModal = document.querySelector("#close-modal");
  if (closeModal) {
    closeModal.addEventListener("click", () => {
      state.selected = null;
      renderDashboard();
    });
  }

  const grantForm = document.querySelector("#grant-form");
  if (grantForm) {
    grantForm.addEventListener("submit", submitGrant);
  }
}

function renderRows(rows) {
  if (state.loading) {
    return `<div class="loading"><span class="spinner"></span>אוסף נתוני משתמשים...</div>`;
  }

  if (state.error) {
    return `<div class="empty">${escapeHtml(state.error)}</div>`;
  }

  if (!rows.length) {
    return `<div class="empty">לא נמצאו משתמשים</div>`;
  }

  return `
    <div class="rows">
      ${rows.map(renderUserRow).join("")}
    </div>
  `;
}

function renderUserRow(row) {
  const active = isSubscriptionActive(row);
  const scanPercent = percent(row.scans_billable, row.total_scan_limit);
  const poolPercent = percent(row.pools_active_count, row.total_pool_limit);
  const title = row.full_name || row.email || row.account_name || "משתמש ללא שם";

  return `
    <article class="user-row">
      <div>
        <div class="user-title">
          <h3>${escapeHtml(title)}</h3>
          <span class="pill ${active ? "green" : "red"}">${active ? "מנוי פעיל" : "ללא מנוי פעיל"}</span>
        </div>
        <p class="small">${escapeHtml(row.email || "אין אימייל בפרופיל")}</p>
        <p class="small">חשבון: ${escapeHtml(row.account_name || "ללא שם")} · תוקף: ${formatDate(row.current_period_start)} - ${formatDate(row.current_period_end)}</p>
      </div>
      ${metric("סריקות", `${number(row.scans_remaining)} נותרו`, `${number(row.scans_billable)}/${number(row.total_scan_limit)} נוצלו`, scanPercent)}
      ${metric("בריכות", `${number(row.pools_active_count)}/${number(row.total_pool_limit)}`, `${number(row.tests_count)} בדיקות · אחרונה ${formatDate(row.last_scan_at)}`, poolPercent)}
      <button class="button" data-grant-account="${escapeHtml(row.account_id)}">פתח מנוי</button>
    </article>
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
            <h2>פתיחת / עדכון מנוי</h2>
            <p class="subtitle">${escapeHtml(row.full_name || row.email || row.account_name || "משתמש")}</p>
          </div>
          <button class="button secondary" id="close-modal" type="button">סגור</button>
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
          <p class="hint">המערכת תפתח מנוי admin ידני ותעדכן את מגבלות הבריכות והסריקות לחשבון הזה.</p>
          <button class="button" style="width:100%;margin-top:16px" type="submit">שמור מנוי</button>
          <p class="error hidden" id="grant-error"></p>
        </form>
      </section>
    </div>
  `;
}

async function submitGrant(event) {
  event.preventDefault();
  if (!state.selected) return;

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
    p_account_id: state.selected.account_id,
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

  state.selected = null;
  await loadDashboard();
}

function statCard(label, value) {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${number(value)}</div>
    </div>
  `;
}

function metric(title, value, description, progress) {
  return `
    <div class="metric">
      <div class="metric-top"><span>${title}</span><strong>${value}</strong></div>
      <div class="bar"><span style="width:${progress}%"></span></div>
      <p class="small">${description}</p>
    </div>
  `;
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

function renderLoading(label) {
  app.innerHTML = `<div class="loading" style="min-height:100vh;display:grid;place-items:center"><span><span class="spinner"></span>${label}</span></div>`;
}
