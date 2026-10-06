<?php
/**
 * BASST CUT booking backend — shared library.
 * Runs on plain PHP 8 + MySQL (Hostinger shared hosting). SQLite is supported for local testing.
 *
 * Config is written by the setup wizard (/admin/) to a file OUTSIDE public_html when possible,
 * so re-uploading the website never overwrites it.
 */

declare(strict_types=1);

const BASST_VERSION = '1.0.0';

// ---------------------------------------------------------------- config

function config_candidates(): array
{
    $list = [];
    if ($env = getenv('BASST_CONFIG')) {
        $list[] = $env;
    }
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    if ($docRoot !== '') {
        $list[] = dirname(rtrim($docRoot, '/')) . '/basst-cut-config.php';
    }
    $list[] = __DIR__ . '/_config.php';
    return $list;
}

function config_path(): ?string
{
    foreach (config_candidates() as $p) {
        if (is_file($p)) {
            return $p;
        }
    }
    return null;
}

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $p = config_path();
        $cfg = $p ? (array) require $p : [];
    }
    return $cfg;
}

function is_installed(): bool
{
    return config_path() !== null;
}

date_default_timezone_set('Asia/Beirut');

// ---------------------------------------------------------------- database

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $c = config();
    if (!$c) {
        throw new RuntimeException('Booking system is not set up yet.');
    }
    $pdo = make_pdo($c);
    migrate($pdo);
    return $pdo;
}

function make_pdo(array $c): PDO
{
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if (($c['db_driver'] ?? 'mysql') === 'sqlite') {
        $pdo = new PDO('sqlite:' . $c['db_path'], null, null, $opts);
        $pdo->exec('PRAGMA busy_timeout = 5000');
        return $pdo;
    }
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $c['db_host'] ?? 'localhost', $c['db_name']);
    $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], $opts);
    $pdo->exec("SET time_zone = '+00:00'"); // we only store local wall-clock strings; keep MySQL out of it
    return $pdo;
}

function is_sqlite(PDO $pdo): bool
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
}

function migrate(PDO $pdo): void
{
    $sqlite = is_sqlite($pdo);
    $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY';
    $tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';

    $pdo->exec("CREATE TABLE IF NOT EXISTS bc_settings (
        k VARCHAR(64) NOT NULL PRIMARY KEY,
        v TEXT NOT NULL
    )$tail");

    $pdo->exec("CREATE TABLE IF NOT EXISTS bc_services (
        id $id,
        name VARCHAR(80) NOT NULL,
        duration_min INT NOT NULL,
        price VARCHAR(32) NULL,
        active TINYINT NOT NULL DEFAULT 1,
        sort INT NOT NULL DEFAULT 0
    )$tail");

    $pdo->exec("CREATE TABLE IF NOT EXISTS bc_bookings (
        id $id,
        code VARCHAR(16) NOT NULL,
        token VARCHAR(40) NOT NULL,
        service_id INT NULL,
        service_name VARCHAR(80) NOT NULL,
        duration_min INT NOT NULL,
        price VARCHAR(32) NULL,
        customer_name VARCHAR(80) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        note VARCHAR(300) NULL,
        start_at VARCHAR(19) NOT NULL,
        end_at VARCHAR(19) NOT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        kind VARCHAR(12) NOT NULL DEFAULT 'booking',
        reason VARCHAR(200) NULL,
        ip VARCHAR(45) NULL,
        created_at VARCHAR(19) NOT NULL,
        decided_at VARCHAR(19) NULL
    )$tail");

    // Indexes (ignore "already exists")
    foreach ([
        'CREATE INDEX bc_bookings_start ON bc_bookings (start_at)',
        'CREATE INDEX bc_bookings_status ON bc_bookings (status)',
        'CREATE UNIQUE INDEX bc_bookings_code ON bc_bookings (code)',
    ] as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
        }
    }

    $count = (int) $pdo->query('SELECT COUNT(*) FROM bc_services')->fetchColumn();
    if ($count === 0 && !get_setting_raw($pdo, 'seeded')) {
        $seed = [
            ['Haircut', 30], ['Fade', 45], ['Beard Trim', 30],
            ['Haircut + Beard', 60], ['Kids Cut', 30], ['Styling', 30],
        ];
        $st = $pdo->prepare('INSERT INTO bc_services (name, duration_min, price, active, sort) VALUES (?, ?, NULL, 1, ?)');
        foreach ($seed as $i => [$n, $d]) {
            $st->execute([$n, $d, $i]);
        }
        set_setting($pdo, 'seeded', '1');
    }
}

// ---------------------------------------------------------------- settings

function default_settings(): array
{
    $day = [['10:00', '21:00']];
    return [
        // Opening hours per weekday (1 = Monday … 7 = Sunday). Empty list = closed.
        'hours' => ['1' => $day, '2' => $day, '3' => $day, '4' => $day, '5' => $day, '6' => $day, '7' => $day],
        'closed_dates' => [],          // ["2026-12-25", ...]
        'slot_step' => 30,             // minutes between possible start times
        'lead_minutes' => 30,          // earliest booking = now + this
        'days_ahead' => 14,            // how far ahead clients can book
        'max_pending_per_phone' => 2,
        'barber_whatsapp' => '',       // digits with country code, e.g. 96170123456
        'notify_driver' => 'manual',   // manual | callmebot | cloud
        'callmebot_apikey' => '',
        'cloud_token' => '',
        'cloud_phone_id' => '',
        'cloud_lang' => 'en',
        'cloud_tpl_barber' => '',      // optional approved template names (else plain text)
        'cloud_tpl_approved' => '',
        'cloud_tpl_rejected' => '',
        'msg_barber' => "✂️ New booking request — BASST CUT\n{name} · +{phone}\n{service} · {date} at {time}\n\nApprove: {admin_url}",
        'msg_approved' => "Hi {name}! ✅ Your appointment at BASST CUT is confirmed.\n{service} · {date} at {time}\nAbra, Sidon — see you soon!",
        'msg_rejected' => "Hi {name}, sorry — we can't take your booking on {date} at {time}. Please pick another time: {site_url}",
        'msg_received' => "Hi {name}! We received your BASST CUT request for {date} at {time}. ⏳ Waiting for the barber's confirmation.",
    ];
}

function get_setting_raw(PDO $pdo, string $k): ?string
{
    $st = $pdo->prepare('SELECT v FROM bc_settings WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? null : (string) $v;
}

function set_setting(PDO $pdo, string $k, string $v): void
{
    $pdo->prepare('DELETE FROM bc_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO bc_settings (k, v) VALUES (?, ?)')->execute([$k, $v]);
}

function settings(?PDO $pdo = null): array
{
    $pdo ??= db();
    $out = default_settings();
    foreach ($pdo->query('SELECT k, v FROM bc_settings') as $row) {
        if (array_key_exists($row['k'], $out)) {
            $decoded = json_decode($row['v'], true);
            $out[$row['k']] = $decoded === null && $row['v'] !== 'null' ? $row['v'] : $decoded;
        }
    }
    return $out;
}

function save_settings(PDO $pdo, array $values): void
{
    $defaults = default_settings();
    foreach ($values as $k => $v) {
        if (array_key_exists($k, $defaults)) {
            set_setting($pdo, $k, json_encode($v, JSON_UNESCAPED_UNICODE));
        }
    }
}

// ---------------------------------------------------------------- time helpers

function now(): DateTimeImmutable
{
    return new DateTimeImmutable('now');
}

function fmt(DateTimeImmutable $d): string
{
    return $d->format('Y-m-d H:i:s');
}

function at(string $date, string $hhmm): DateTimeImmutable
{
    if ($hhmm === '24:00') {
        return (new DateTimeImmutable($date . ' 00:00:00'))->modify('+1 day');
    }
    return new DateTimeImmutable($date . ' ' . $hhmm . ':00');
}

function valid_date(string $d): bool
{
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $d);
    return $dt !== false && $dt->format('Y-m-d') === $d;
}

function nice_date(string $dt): string
{
    return (new DateTimeImmutable($dt))->format('D j M');
}

function nice_time(string $dt): string
{
    return (new DateTimeImmutable($dt))->format('g:i A');
}

/** Bookings that block time (pending or approved) overlapping [from, to). */
function busy_ranges(PDO $pdo, string $from, string $to, ?int $exceptId = null): array
{
    $sql = "SELECT id, start_at, end_at FROM bc_bookings
            WHERE status IN ('pending','approved') AND start_at < ? AND end_at > ?";
    $args = [$to, $from];
    if ($exceptId) {
        $sql .= ' AND id <> ?';
        $args[] = $exceptId;
    }
    $st = $pdo->prepare($sql);
    $st->execute($args);
    return $st->fetchAll();
}

/** Opening state for a date: list of [open, close] DateTimeImmutable pairs. */
function opening_for(array $s, string $date): array
{
    if (in_array($date, (array) $s['closed_dates'], true)) {
        return [];
    }
    $dow = (string) (new DateTimeImmutable($date))->format('N');
    $out = [];
    foreach ((array) ($s['hours'][$dow] ?? []) as $range) {
        if (!is_array($range) || count($range) !== 2) {
            continue;
        }
        [$o, $c] = $range;
        if (!preg_match('/^\d{2}:\d{2}$/', (string) $o) || !preg_match('/^\d{2}:\d{2}$/', (string) $c)) {
            continue;
        }
        $open = at($date, $o);
        $close = at($date, $c);
        if ($close > $open) {
            $out[] = [$open, $close];
        }
    }
    return $out;
}

/** Bookable days for the client date picker. */
function bookable_days(array $s): array
{
    $days = [];
    $today = now()->setTime(0, 0);
    $max = max(1, min(60, (int) $s['days_ahead']));
    for ($i = 0; $i < $max; $i++) {
        $d = $today->modify("+$i day")->format('Y-m-d');
        $days[] = ['date' => $d, 'open' => count(opening_for($s, $d)) > 0];
    }
    return $days;
}

/**
 * Free start times on $date for a service of $duration minutes.
 * Rules: inside opening hours, on the slot grid, at least `lead_minutes` from now,
 * not overlapping any pending/approved booking.
 */
function available_slots(PDO $pdo, array $s, string $date, int $duration): array
{
    if (!valid_date($date)) {
        return [];
    }
    $days = array_column(bookable_days($s), 'date');
    if (!in_array($date, $days, true)) {
        return [];
    }
    $ranges = opening_for($s, $date);
    if (!$ranges) {
        return [];
    }
    $step = max(5, (int) $s['slot_step']);
    $earliest = now()->modify('+' . max(0, (int) $s['lead_minutes']) . ' minutes');

    $dayStart = fmt(at($date, '00:00'));
    $dayEnd = fmt(at($date, '24:00')->modify('+1 day'));
    $busy = busy_ranges($pdo, $dayStart, $dayEnd);

    $slots = [];
    foreach ($ranges as [$open, $close]) {
        for ($t = $open; $t->modify("+$duration minutes") <= $close; $t = $t->modify("+$step minutes")) {
            if ($t < $earliest) {
                continue;
            }
            $end = $t->modify("+$duration minutes");
            $a = fmt($t);
            $b = fmt($end);
            $clash = false;
            foreach ($busy as $bk) {
                if ($bk['start_at'] < $b && $bk['end_at'] > $a) {
                    $clash = true;
                    break;
                }
            }
            if (!$clash) {
                $slots[] = $t->format('H:i');
            }
        }
    }
    return array_values(array_unique($slots));
}

// ---------------------------------------------------------------- locking

/** Serialize all booking writes so two people can never grab the same time. */
function with_booking_lock(PDO $pdo, callable $fn)
{
    if (is_sqlite($pdo)) {
        $pdo->exec('BEGIN IMMEDIATE');
        try {
            $r = $fn();
            $pdo->exec('COMMIT');
            return $r;
        } catch (Throwable $e) {
            $pdo->exec('ROLLBACK');
            throw $e;
        }
    }
    $got = (int) $pdo->query("SELECT GET_LOCK('basst_cut_booking', 10)")->fetchColumn();
    if ($got !== 1) {
        throw new RuntimeException('Busy, please try again.');
    }
    try {
        $pdo->beginTransaction();
        $r = $fn();
        $pdo->commit();
        return $r;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('basst_cut_booking')");
    }
}

// ---------------------------------------------------------------- phones & messages

/** Normalize to international digits (Lebanon default). Returns null if invalid. */
function normalize_phone(string $raw): ?string
{
    $d = preg_replace('/\D+/', '', $raw) ?? '';
    if (str_starts_with($d, '00')) {
        $d = substr($d, 2);
    }
    if (str_starts_with($d, '961')) {
        $local = ltrim(substr($d, 3), '0');
        $d = '961' . $local;
    } elseif (strlen($d) <= 8) {
        $d = '961' . ltrim($d, '0');
    }
    $len = strlen($d);
    if ($len < 10 || $len > 15) {
        return null;
    }
    if (str_starts_with($d, '961') && ($len < 10 || $len > 11)) {
        return null;
    }
    return $d;
}

function site_url(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($https ? 'https' : 'http') . '://' . $host;
}

function fill_message(string $tpl, array $b): string
{
    $map = [
        '{name}' => $b['customer_name'] ?? '',
        '{phone}' => $b['phone'] ?? '',
        '{service}' => $b['service_name'] ?? '',
        '{date}' => isset($b['start_at']) ? nice_date($b['start_at']) : '',
        '{time}' => isset($b['start_at']) ? nice_time($b['start_at']) : '',
        '{code}' => $b['code'] ?? '',
        '{price}' => $b['price'] ?? '',
        '{note}' => $b['note'] ?? '',
        '{admin_url}' => site_url() . '/admin/',
        '{site_url}' => site_url() . '/booking/',
    ];
    return strtr($tpl, $map);
}

function wa_link(string $phone, string $text): string
{
    return 'https://wa.me/' . preg_replace('/\D+/', '', $phone) . '?text=' . rawurlencode($text);
}

// ---------------------------------------------------------------- WhatsApp drivers

function http_request(string $method, string $url, ?array $json = null, array $headers = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CUSTOMREQUEST => $method,
    ]);
    if ($json !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($json, JSON_UNESCAPED_UNICODE));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$code, is_string($body) ? $body : '', $err];
}

/**
 * Send a WhatsApp message through the configured driver.
 * $template: optional Cloud API template name; $params: its body variables in order.
 * Returns ['sent' => bool, 'error' => ?string].
 */
function send_whatsapp(array $s, string $to, string $text, string $template = '', array $params = [], bool $toBarber = false): array
{
    $to = preg_replace('/\D+/', '', $to) ?? '';
    if ($to === '') {
        return ['sent' => false, 'error' => 'No phone number'];
    }
    $driver = $s['notify_driver'] ?? 'manual';

    if ($driver === 'callmebot') {
        // CallMeBot can only message the number that registered the API key (the barber).
        if (!$toBarber || empty($s['callmebot_apikey'])) {
            return ['sent' => false, 'error' => 'CallMeBot only notifies the barber'];
        }
        $url = 'https://api.callmebot.com/whatsapp.php?phone=' . rawurlencode($to)
            . '&text=' . rawurlencode($text) . '&apikey=' . rawurlencode((string) $s['callmebot_apikey']);
        [$code, $body, $err] = http_request('GET', $url);
        $ok = $code >= 200 && $code < 300 && stripos($body, 'error') === false;
        return ['sent' => $ok, 'error' => $ok ? null : ($err ?: "CallMeBot HTTP $code")];
    }

    if ($driver === 'cloud') {
        if (empty($s['cloud_token']) || empty($s['cloud_phone_id'])) {
            return ['sent' => false, 'error' => 'Cloud API not configured'];
        }
        $payload = ['messaging_product' => 'whatsapp', 'to' => $to];
        if ($template !== '') {
            $payload['type'] = 'template';
            $payload['template'] = [
                'name' => $template,
                'language' => ['code' => (string) ($s['cloud_lang'] ?: 'en')],
                'components' => [[
                    'type' => 'body',
                    'parameters' => array_map(fn($p) => ['type' => 'text', 'text' => (string) $p], $params),
                ]],
            ];
        } else {
            $payload['type'] = 'text';
            $payload['text'] = ['body' => $text, 'preview_url' => false];
        }
        $url = 'https://graph.facebook.com/v21.0/' . rawurlencode((string) $s['cloud_phone_id']) . '/messages';
        [$code, $body, $err] = http_request('POST', $url, $payload, ['Authorization: Bearer ' . $s['cloud_token']]);
        $ok = $code >= 200 && $code < 300;
        $msg = $ok ? null : ($err ?: (json_decode($body, true)['error']['message'] ?? "Cloud API HTTP $code"));
        return ['sent' => $ok, 'error' => $msg];
    }

    return ['sent' => false, 'error' => 'Manual mode'];
}

function notify_barber_new(array $s, array $b): array
{
    $text = fill_message((string) $s['msg_barber'], $b);
    return send_whatsapp($s, (string) $s['barber_whatsapp'], $text, (string) $s['cloud_tpl_barber'], [
        $b['customer_name'], '+' . $b['phone'], $b['service_name'], nice_date($b['start_at']), nice_time($b['start_at']),
    ], true);
}

function notify_client(array $s, array $b, string $which): array
{
    $tplKey = $which === 'approved' ? 'cloud_tpl_approved' : ($which === 'rejected' ? 'cloud_tpl_rejected' : '');
    $text = fill_message((string) $s['msg_' . $which], $b);
    $res = send_whatsapp($s, $b['phone'], $text, $tplKey ? (string) $s[$tplKey] : '', [
        $b['customer_name'], $b['service_name'], nice_date($b['start_at']), nice_time($b['start_at']),
    ]);
    $res['wa_link'] = wa_link($b['phone'], $text);
    return $res;
}

// ---------------------------------------------------------------- HTTP helpers

function json_out($data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $msg, int $status = 400): never
{
    json_out(['ok' => false, 'error' => $msg], $status);
}

function body_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $d = json_decode($raw, true);
    return is_array($d) ? $d : $_POST;
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function random_code(): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $c = '';
    for ($i = 0; $i < 5; $i++) {
        $c .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return 'BC-' . $c;
}

function public_booking(array $b): array
{
    return [
        'code' => $b['code'],
        'status' => $b['status'],
        'service' => $b['service_name'],
        'date' => substr($b['start_at'], 0, 10),
        'time' => substr($b['start_at'], 11, 5),
        'dateLabel' => nice_date($b['start_at']),
        'timeLabel' => nice_time($b['start_at']),
    ];
}

// ---------------------------------------------------------------- admin auth

function start_admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name('basst_admin');
    session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $secure]);
    session_start();
}

function admin_logged_in(): bool
{
    start_admin_session();
    return !empty($_SESSION['basst_admin']);
}

function csrf_token(): string
{
    start_admin_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}
