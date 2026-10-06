<?php
declare(strict_types=1);
require __DIR__ . '/../api/_lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

// ------------------------------------------------------------ first-run setup wizard
$setupError = null;
if (!is_installed()) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $cfg = [
            'db_driver' => 'mysql',
            'db_host' => trim($_POST['db_host'] ?? 'localhost') ?: 'localhost',
            'db_name' => trim($_POST['db_name'] ?? ''),
            'db_user' => trim($_POST['db_user'] ?? ''),
            'db_pass' => (string) ($_POST['db_pass'] ?? ''),
        ];
        $pw = (string) ($_POST['admin_password'] ?? '');
        $barber = normalize_phone((string) ($_POST['barber_whatsapp'] ?? ''));
        try {
            if (strlen($pw) < 8) {
                throw new RuntimeException('Admin password must be at least 8 characters.');
            }
            if (!$barber) {
                throw new RuntimeException('Enter the barber WhatsApp number (e.g. 70 123 456).');
            }
            $pdo = make_pdo($cfg);
            migrate($pdo);
            save_settings($pdo, ['barber_whatsapp' => $barber]);
            $cfg['admin_password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
            $php = "<?php\n// BASST CUT booking config — keep private.\nreturn " . var_export($cfg, true) . ";\n";
            $written = false;
            foreach (config_candidates() as $p) {
                if (getenv('BASST_CONFIG') && $p !== getenv('BASST_CONFIG')) {
                    continue;
                }
                if (is_writable(dirname($p)) && @file_put_contents($p, $php, LOCK_EX) !== false) {
                    @chmod($p, 0600);
                    $written = true;
                    break;
                }
            }
            if (!$written) {
                throw new RuntimeException('Could not write the config file. Check folder permissions.');
            }
            header('Location: ./?setup=done');
            exit;
        } catch (Throwable $e) {
            $setupError = $e instanceof PDOException ? 'Database connection failed: ' . $e->getMessage() : $e->getMessage();
        }
    }
}
$installed = is_installed();
$logged = $installed && admin_logged_in();
$csrf = $logged ? csrf_token() : '';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#141110">
<meta name="robots" content="noindex, nofollow">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="/icon.svg">
<link rel="apple-touch-icon" href="/brand/basst-cut-logo-640.webp">
<title>BASST CUT · Bookings</title>
<style>
:root{--o:#EF6240;--rust:#8F311C;--cream:#EBDFD0;--ink:#141110;--ink2:#1d1916;--ink3:#2a2420;--w:#F6F1EA;--mut:#a89c90;--ok:#4fb477;--r:14px}
*{box-sizing:border-box}html,body{margin:0;background:var(--ink);color:var(--w);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--o)}button,input,select,textarea{font:inherit;color:inherit}
.wrap{max-width:880px;margin:0 auto;padding:16px 16px 96px}
header{position:sticky;top:0;z-index:5;background:rgba(20,17,16,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--ink3)}
.bar{max-width:880px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:12px}
.brand{font-weight:800;letter-spacing:.08em}.brand b{color:var(--o)}
.badge{min-width:22px;height:22px;border-radius:11px;background:var(--o);color:#fff;font-size:12px;font-weight:700;display:inline-grid;place-items:center;padding:0 6px}
.sp{flex:1}
.tabs{display:flex;gap:6px;max-width:880px;margin:0 auto;padding:0 16px 10px;overflow-x:auto}
.tab{border:1px solid var(--ink3);background:none;border-radius:999px;padding:8px 14px;white-space:nowrap;cursor:pointer;color:var(--mut)}
.tab.on{background:var(--w);color:var(--ink);border-color:var(--w)}
.btn{border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer;background:var(--ink3);min-height:44px}
.btn.p{background:var(--o);color:#fff}.btn.ok{background:var(--ok);color:#0b1a10}.btn.ghost{background:none;border:1px solid var(--ink3)}
.btn.sm{padding:7px 12px;min-height:36px;font-size:13px}.btn:disabled{opacity:.5}
.card{background:var(--ink2);border:1px solid var(--ink3);border-radius:var(--r);padding:16px;margin:12px 0}
.card.pending{border-color:rgba(239,98,64,.6);box-shadow:0 0 0 1px rgba(239,98,64,.15)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.when{font-size:20px;font-weight:800}.mut{color:var(--mut)}.small{font-size:13px}
.pill{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:3px 9px;background:var(--ink3)}
.pill.pending{background:rgba(239,98,64,.18);color:var(--o)}.pill.approved{background:rgba(79,180,119,.18);color:var(--ok)}.pill.block{background:#333;color:#ccc}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--mut);margin:24px 0 8px}
label{display:block;font-size:12px;color:var(--mut);margin:12px 0 4px;letter-spacing:.04em}
input,select,textarea{width:100%;background:var(--ink);border:1px solid var(--ink3);border-radius:10px;padding:11px 12px;min-height:44px}
textarea{min-height:90px}input:focus,select:focus,textarea:focus{outline:2px solid var(--o);border-color:transparent}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.grid3{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:10px}
.hours{display:grid;grid-template-columns:40px minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center;margin:6px 0}.hours input[type=time]{padding:10px 6px;min-width:0;font-size:14px}
.hours input[type=checkbox]{width:22px;min-height:22px;height:22px}
.empty{text-align:center;padding:40px 10px;color:var(--mut)}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--w);color:var(--ink);padding:12px 16px;border-radius:12px;font-weight:600;z-index:20;max-width:92vw;box-shadow:0 10px 40px rgba(0,0,0,.5);display:flex;gap:10px;align-items:center}
.login{max-width:380px;margin:12vh auto;padding:24px}
.login img{width:140px;display:block;margin:0 auto 18px;clip-path:circle(47.3%)}
.err{background:rgba(239,98,64,.12);border:1px solid rgba(239,98,64,.5);padding:10px 12px;border-radius:10px;margin:12px 0}
.daytitle{font-weight:800;margin:22px 0 4px;color:var(--cream)}
.slotline{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--ink3)}
.slotline .t{width:118px;font-weight:700;font-size:14px}
hr{border:0;border-top:1px solid var(--ink3);margin:20px 0}
</style>
</head>
<body>
<?php if (!$installed): ?>
  <div class="login">
    <img src="/brand/basst-cut-logo-640.webp" alt="BASST CUT">
    <h1 style="text-align:center;margin:0 0 4px">Set up bookings</h1>
    <p class="mut small" style="text-align:center">One-time setup. Create a MySQL database in hPanel → Databases, then fill this in.</p>
    <?php if ($setupError): ?><div class="err"><?= htmlspecialchars($setupError) ?></div><?php endif; ?>
    <form method="post" autocomplete="off">
      <label>Database host</label><input name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>">
      <label>Database name</label><input name="db_name" required value="<?= htmlspecialchars($_POST['db_name'] ?? '') ?>" placeholder="u123456789_basst">
      <label>Database user</label><input name="db_user" required value="<?= htmlspecialchars($_POST['db_user'] ?? '') ?>" placeholder="u123456789_basst">
      <label>Database password</label><input name="db_pass" type="password">
      <hr>
      <label>Barber WhatsApp number</label><input name="barber_whatsapp" inputmode="tel" required value="<?= htmlspecialchars($_POST['barber_whatsapp'] ?? '') ?>" placeholder="70 123 456">
      <label>Admin password (min 8 characters)</label><input name="admin_password" type="password" required minlength="8">
      <button class="btn p" style="width:100%;margin-top:18px">Create booking system</button>
    </form>
  </div>
<?php elseif (!$logged): ?>
  <div class="login">
    <img src="/brand/basst-cut-logo-640.webp" alt="BASST CUT">
    <?php if (isset($_GET['setup'])): ?><div class="err" style="border-color:var(--ok);background:rgba(79,180,119,.12)">Setup complete — log in with your new password.</div><?php endif; ?>
    <form id="loginForm">
      <label>Admin password</label><input id="pw" type="password" autocomplete="current-password" required autofocus>
      <div id="loginErr" class="err" hidden></div>
      <button class="btn p" style="width:100%;margin-top:14px">Log in</button>
    </form>
  </div>
  <script>
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const r = await fetch('../api/admin.php?action=login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: document.getElementById('pw').value})});
    const d = await r.json().catch(() => ({}));
    if (d.ok) location.reload(); else { const el = document.getElementById('loginErr'); el.hidden = false; el.textContent = d.error || 'Login failed'; }
  };
  </script>
<?php else: ?>
  <header>
    <div class="bar">
      <span class="brand">BASST <b>CUT</b></span>
      <span class="badge" id="pendingBadge" hidden>0</span>
      <span class="sp"></span>
      <button class="btn sm ghost" id="notifBtn" hidden>🔔 Alerts</button>
      <button class="btn sm ghost" id="logoutBtn">Log out</button>
    </div>
    <nav class="tabs">
      <button class="tab on" data-tab="requests">Requests</button>
      <button class="tab" data-tab="schedule">Schedule</button>
      <button class="tab" data-tab="services">Services &amp; prices</button>
      <button class="tab" data-tab="settings">Settings</button>
    </nav>
  </header>
  <main class="wrap" id="view"></main>
  <script>
  const CSRF = <?= json_encode($csrf) ?>;
  const API = '../api/admin.php';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let tab = 'requests', lastLatest = null, bookings = [];

  async function api(action, body, qs = '') {
    const opt = body ? {method:'POST', headers:{'Content-Type':'application/json','X-CSRF':CSRF}, body: JSON.stringify(body)} : {};
    const r = await fetch(`${API}?action=${action}${qs}`, opt);
    const d = await r.json().catch(() => ({ok:false, error:'Network error'}));
    if (r.status === 401) location.reload();
    if (!d.ok) throw new Error(d.error || 'Error');
    return d;
  }

  function toast(html, ms = 4000) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; document.body.appendChild(t);
    if (ms) setTimeout(() => t.remove(), ms);
    return t;
  }

  // ---------- tabs
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    tab = b.dataset.tab; render();
  });
  $('#logoutBtn').onclick = async () => { await api('logout', {}); location.reload(); };

  async function render() {
    const v = $('#view'); v.innerHTML = '<div class="empty">Loading…</div>';
    try {
      if (tab === 'requests' || tab === 'schedule') { bookings = (await api('bookings', null, '&days=21')).bookings; }
      ({requests: renderRequests, schedule: renderSchedule, services: renderServices, settings: renderSettings})[tab](v);
    } catch (e) { v.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  }

  // ---------- requests
  function bookingCard(b, actions) {
    return `<div class="card ${b.status}">
      <div class="row"><span class="pill ${b.kind === 'block' ? 'block' : b.status}">${b.kind === 'block' ? 'blocked' : b.status}</span><span class="mut small">${esc(b.code)}</span></div>
      <div class="when" style="margin-top:8px">${esc(b.dateLabel)} · ${esc(b.timeLabel)}</div>
      <div style="margin-top:4px"><b>${esc(b.name)}</b> — ${esc(b.service)} <span class="mut">(${b.duration} min${b.price ? ' · ' + esc(b.price) : ''})</span></div>
      ${b.phone ? `<div class="small" style="margin-top:4px"><a href="${b.chat}" target="_blank" rel="noopener">+${esc(b.phone)} · WhatsApp</a> · <a href="tel:+${esc(b.phone)}">Call</a></div>` : ''}
      ${b.note ? `<div class="small mut" style="margin-top:6px">“${esc(b.note)}”</div>` : ''}
      <div class="row" style="margin-top:12px">${actions}</div>
    </div>`;
  }

  function renderRequests(v) {
    const pending = bookings.filter(b => b.status === 'pending');
    v.innerHTML = `<h2>Waiting for you (${pending.length})</h2>` + (pending.length ? pending.map(b => bookingCard(b,
      `<button class="btn ok" data-act="approve" data-id="${b.id}">✓ Approve</button>
       <button class="btn ghost" data-act="reject" data-id="${b.id}">Decline</button>`)).join('')
      : '<div class="empty">No pending requests. New ones appear here automatically.</div>');
    bindActions(v);
  }

  function renderSchedule(v) {
    const list = bookings.filter(b => b.status === 'approved' || b.status === 'pending');
    const byDay = {};
    list.forEach(b => (byDay[b.start.slice(0, 10)] ||= []).push(b));
    const today = new Date(); const pad = n => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    v.innerHTML = `
      <div class="card"><b>Block time</b> <span class="mut small">— breaks, walk-ins, days off. Clients can't book it.</span>
        <div class="grid3" style="margin-top:6px">
          <div><label>Date</label><input type="date" id="blDate" value="${todayStr}"></div>
          <div><label>From</label><input type="time" id="blTime" value="13:00" step="300"></div>
          <div><label>Minutes</label><input type="number" id="blMin" value="60" min="5" step="5"></div>
        </div>
        <label>Label</label><input id="blLabel" value="Break">
        <button class="btn p" id="blBtn" style="margin-top:12px">Block</button>
      </div>` +
      (Object.keys(byDay).length ? Object.entries(byDay).map(([d, items]) => `<div class="daytitle">${esc(items[0].dateLabel)}</div>` +
        items.map(b => `<div class="slotline"><span class="t">${esc(b.timeLabel)}</span>
          <span style="flex:1"><span class="pill ${b.kind === 'block' ? 'block' : b.status}">${b.kind === 'block' ? 'block' : b.status}</span> <b>${esc(b.name)}</b> <span class="mut small">${b.kind === 'block' ? '' : esc(b.service)}</span>
          ${b.phone ? `<br><a class="small" href="${b.chat}" target="_blank" rel="noopener">+${esc(b.phone)}</a>` : ''}</span>
          ${b.status === 'pending' ? `<button class="btn sm ok" data-act="approve" data-id="${b.id}">Approve</button>` : ''}
          <button class="btn sm ghost" data-act="cancel" data-id="${b.id}">${b.kind === 'block' ? 'Remove' : 'Cancel'}</button></div>`).join('')).join('')
      : '<div class="empty">Nothing booked in the next 3 weeks.</div>');
    $('#blBtn').onclick = async () => {
      try {
        await api('block', {date: $('#blDate').value, time: $('#blTime').value, minutes: +$('#blMin').value, label: $('#blLabel').value});
        toast('Time blocked'); render();
      } catch (e) { toast(esc(e.message)); }
    };
    bindActions(v);
  }

  function bindActions(v) {
    v.querySelectorAll('[data-act]').forEach(btn => btn.onclick = async () => {
      const act = btn.dataset.act, id = +btn.dataset.id;
      let reason = '';
      if (act === 'reject' && !confirm('Decline this request?')) return;
      if (act === 'cancel' && !confirm('Cancel this booking? The time becomes free again.')) return;
      btn.disabled = true;
      try {
        const d = await api(act, {id, reason});
        const n = d.notice;
        if (n && n.sent) toast(act === 'approve' ? '✅ Approved — client notified on WhatsApp' : 'Done — client notified on WhatsApp');
        else if (n && n.wa_link) {
          // Opening WhatsApp needs a tap (browsers block automatic pop-ups)
          const t = toast(`${act === 'approve' ? '✅ Approved.' : 'Done.'} <a class="btn p sm" href="${n.wa_link}" target="_blank" rel="noopener">Send WhatsApp to client</a>`, 0);
          t.querySelector('a').addEventListener('click', () => setTimeout(() => t.remove(), 300));
        } else toast('Done');
        render(); poll();
      } catch (e) { toast(esc(e.message)); btn.disabled = false; render(); }
    });
  }

  // ---------- services
  async function renderServices(v) {
    const {services} = await api('services');
    const row = (s) => `<div class="card" data-id="${s.id || ''}">
      <div class="grid3"><div><label>Service</label><input data-f="name" value="${esc(s.name)}"></div>
      <div><label>Minutes</label><input data-f="duration" type="number" min="5" step="5" value="${s.duration || 30}"></div>
      <div><label>Price</label><input data-f="price" value="${esc(s.price || '')}" placeholder="$10"></div></div>
      <div class="row" style="margin-top:10px"><label style="margin:0;display:flex;gap:8px;align-items:center"><input data-f="active" type="checkbox" style="width:20px;min-height:20px" ${s.active !== false ? 'checked' : ''}> Visible to clients</label>
      <span class="sp"></span><input data-f="sort" type="number" value="${s.sort || 0}" style="width:70px" title="Order">
      <button class="btn sm p" data-save>Save</button>${s.id ? '<button class="btn sm ghost" data-del>Delete</button>' : ''}</div></div>`;
    v.innerHTML = `<h2>Services &amp; prices</h2><p class="mut small">Duration decides how long the chair is blocked. Prices show in the booking form.</p>` +
      services.map(row).join('') + `<h2>Add a service</h2>` + row({name: '', duration: 30, price: '', active: true, sort: services.length});
    v.querySelectorAll('.card').forEach(c => {
      const val = (f) => { const el = c.querySelector(`[data-f="${f}"]`); return el.type === 'checkbox' ? el.checked : el.value; };
      c.querySelector('[data-save]').onclick = async () => {
        try { await api('service_save', {id: +c.dataset.id || null, name: val('name'), duration: +val('duration'), price: val('price'), active: val('active'), sort: +val('sort')}); toast('Saved'); renderServices(v); }
        catch (e) { toast(esc(e.message)); }
      };
      const del = c.querySelector('[data-del]');
      if (del) del.onclick = async () => { if (confirm('Delete this service?')) { await api('service_delete', {id: +c.dataset.id}); renderServices(v); } };
    });
  }

  // ---------- settings
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  async function renderSettings(v) {
    const {settings: s} = await api('settings');
    const hrs = DAYS.map((d, i) => { const r = (s.hours[i + 1] || [])[0];
      return `<div class="hours"><b>${d}</b><input type="time" data-h="${i + 1}" data-k="o" value="${r ? r[0] : '10:00'}" step="300"><input type="time" data-h="${i + 1}" data-k="c" value="${r ? (r[1] === '24:00' ? '23:59' : r[1]) : '21:00'}" step="300">
        <label style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" data-h="${i + 1}" data-k="x" ${r ? '' : 'checked'}> Off</label></div>`; }).join('');
    v.innerHTML = `
      <h2>Opening hours</h2><div class="card">${hrs}
        <label>Closed dates (holidays) — comma separated, YYYY-MM-DD</label><input id="closed" value="${esc((s.closed_dates || []).join(', '))}" placeholder="2026-12-25, 2027-01-01"></div>
      <h2>Booking rules</h2><div class="card"><div class="grid3">
        <div><label>Earliest booking (minutes from now)</label><input id="lead" type="number" value="${s.lead_minutes}"></div>
        <div><label>Time grid (min)</label><select id="step">${[10, 15, 20, 30, 45, 60].map(n => `<option ${+s.slot_step === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label>Days ahead</label><input id="ahead" type="number" value="${s.days_ahead}"></div></div>
        <p class="mut small">Example: with 30 min, a client opening the page at 2:00 PM can book 2:30 PM at the earliest. Pending and approved bookings both block their time — no double bookings.</p></div>
      <h2>WhatsApp notifications</h2><div class="card">
        <label>Barber WhatsApp number (gets new requests)</label><input id="barber" inputmode="tel" value="${esc(s.barber_whatsapp)}">
        <label>Sending method</label><select id="driver">
          <option value="manual" ${s.notify_driver === 'manual' ? 'selected' : ''}>Manual — alerts in this panel, one tap to send WhatsApp to client (free)</option>
          <option value="callmebot" ${s.notify_driver === 'callmebot' ? 'selected' : ''}>CallMeBot — automatic WhatsApp to barber (free); client message one tap</option>
          <option value="cloud" ${s.notify_driver === 'cloud' ? 'selected' : ''}>WhatsApp Cloud API (Meta) — fully automatic for barber and client</option></select>
        <div id="cmb" hidden><label>CallMeBot API key</label><input id="cmbKey" value="${esc(s.callmebot_apikey)}"><p class="mut small">From the barber's phone, send <b>I allow callmebot to send me messages</b> to the CallMeBot WhatsApp number listed on callmebot.com — you'll receive the key.</p></div>
        <div id="cloud" hidden><div class="grid2"><div><label>Access token</label><input id="cTok" value="${esc(s.cloud_token)}"></div><div><label>Phone number ID</label><input id="cPid" value="${esc(s.cloud_phone_id)}"></div></div>
          <div class="grid2"><div><label>Template: new request → barber</label><input id="tB" value="${esc(s.cloud_tpl_barber)}" placeholder="optional"></div><div><label>Template: approved → client</label><input id="tA" value="${esc(s.cloud_tpl_approved)}" placeholder="booking_confirmed"></div></div>
          <div class="grid2"><div><label>Template: declined → client</label><input id="tR" value="${esc(s.cloud_tpl_rejected)}" placeholder="optional"></div><div><label>Template language</label><input id="cLang" value="${esc(s.cloud_lang)}"></div></div>
          <p class="mut small">Messages to clients outside a 24h chat window must use approved templates. Body variables in order: name, service, date, time (barber template: name, phone, service, date, time).</p></div>
        <button class="btn ghost sm" id="testBtn" style="margin-top:12px">Send test to barber</button></div>
      <h2>Message texts</h2><div class="card"><p class="mut small">Placeholders: {name} {phone} {service} {date} {time} {code} {admin_url} {site_url}</p>
        <label>New request → barber</label><textarea id="mB">${esc(s.msg_barber)}</textarea>
        <label>Approved → client</label><textarea id="mA">${esc(s.msg_approved)}</textarea>
        <label>Declined / cancelled → client</label><textarea id="mR">${esc(s.msg_rejected)}</textarea>
        <label>Request received → client (Cloud API only)</label><textarea id="mRc">${esc(s.msg_received)}</textarea></div>
      <button class="btn p" id="saveSet" style="width:100%">Save settings</button>
      <h2>Admin password</h2><div class="card"><input id="newPw" type="password" placeholder="New password (min 8)"><button class="btn ghost sm" id="pwBtn" style="margin-top:10px">Change password</button></div>`;
    const syncDriver = () => { $('#cmb').hidden = $('#driver').value !== 'callmebot'; $('#cloud').hidden = $('#driver').value !== 'cloud'; };
    $('#driver').onchange = syncDriver; syncDriver();
    $('#saveSet').onclick = async () => {
      const hours = {};
      for (let i = 1; i <= 7; i++) {
        const off = v.querySelector(`[data-h="${i}"][data-k="x"]`).checked;
        const o = v.querySelector(`[data-h="${i}"][data-k="o"]`).value, c = v.querySelector(`[data-h="${i}"][data-k="c"]`).value;
        hours[i] = off || !o || !c ? [] : [[o, c === '23:59' ? '24:00' : c]];
      }
      const settings = {hours, closed_dates: $('#closed').value.split(',').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)),
        lead_minutes: +$('#lead').value, slot_step: +$('#step').value, days_ahead: +$('#ahead').value,
        barber_whatsapp: $('#barber').value, notify_driver: $('#driver').value, callmebot_apikey: $('#cmbKey').value,
        cloud_token: $('#cTok').value, cloud_phone_id: $('#cPid').value, cloud_tpl_barber: $('#tB').value, cloud_tpl_approved: $('#tA').value,
        cloud_tpl_rejected: $('#tR').value, cloud_lang: $('#cLang').value,
        msg_barber: $('#mB').value, msg_approved: $('#mA').value, msg_rejected: $('#mR').value, msg_received: $('#mRc').value};
      try { await api('settings_save', {settings}); toast('Settings saved'); } catch (e) { toast(esc(e.message)); }
    };
    $('#testBtn').onclick = async () => { try { const {result} = await api('test_notify', {}); toast(result.sent ? 'Test sent ✅' : 'Not sent: ' + esc(result.error)); } catch (e) { toast(esc(e.message)); } };
    $('#pwBtn').onclick = async () => { try { await api('password', {password: $('#newPw').value}); toast('Password changed'); $('#newPw').value = ''; } catch (e) { toast(esc(e.message)); } };
  }

  // ---------- live alerts for new requests
  function beep() {
    try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .18].forEach(t => { const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.2, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .15);
      o.start(a.currentTime + t); o.stop(a.currentTime + t + .16); }); } catch (e) {}
  }
  async function poll() {
    try {
      const d = await api('poll');
      const badge = $('#pendingBadge'); badge.hidden = !d.pending; badge.textContent = d.pending;
      document.title = (d.pending ? `(${d.pending}) ` : '') + 'BASST CUT · Bookings';
      if (lastLatest !== null && d.latestId > lastLatest) {
        beep(); navigator.vibrate?.([200, 100, 200]);
        if ('Notification' in window && Notification.permission === 'granted') new Notification('New booking request ✂️', {body: 'Open BASST CUT admin to approve', icon: '/brand/basst-cut-logo-640.webp'});
        toast('🔔 New booking request!'); if (tab === 'requests' || tab === 'schedule') render();
      }
      lastLatest = d.latestId;
    } catch (e) {}
  }
  if ('Notification' in window && Notification.permission === 'default') {
    const nb = $('#notifBtn'); nb.hidden = false; nb.onclick = async () => { await Notification.requestPermission(); nb.hidden = true; };
  }
  render(); poll(); setInterval(poll, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { poll(); if (tab === 'requests' || tab === 'schedule') render(); } });
  </script>
<?php endif; ?>
</body>
</html>
