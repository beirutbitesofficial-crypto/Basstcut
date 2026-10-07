<?php
/**
 * Barber admin API (session-authenticated, CSRF-protected). Used by /admin/.
 */

declare(strict_types=1);
require __DIR__ . '/_lib.php';

header('X-Robots-Tag: noindex');

$action = $_GET['action'] ?? '';

// Lets the React admin decide which screen to show: setup, login or the app.
if ($action === 'session') {
    $installed = is_installed();
    $logged = $installed && admin_logged_in();
    json_out(['ok' => true, 'installed' => $installed, 'loggedIn' => $logged, 'csrf' => $logged ? csrf_token() : null]);
}

if (!is_installed()) {
    fail('Not set up', 503);
}

$in = body_json();

try {
    $pdo = db();

    if ($action === 'login') {
        start_admin_session();
        $hash = (string) (config()['admin_password_hash'] ?? '');
        if ($hash === '' || !password_verify((string) ($in['password'] ?? ''), $hash)) {
            sleep(1);
            fail('Wrong password', 401);
        }
        session_regenerate_id(true);
        $_SESSION['basst_admin'] = true;
        json_out(['ok' => true, 'csrf' => csrf_token()]);
    }

    if (!admin_logged_in()) {
        fail('Please log in', 401);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && !hash_equals(csrf_token(), (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) {
        fail('Session expired, reload the page', 403);
    }

    $s = settings($pdo);

    switch ($action) {
        case 'logout':
            $_SESSION = [];
            session_destroy();
            json_out(['ok' => true]);

        case 'poll': // cheap check for new requests
            $pending = (int) $pdo->query("SELECT COUNT(*) FROM bc_bookings WHERE status = 'pending' AND kind = 'booking'")->fetchColumn();
            $latest = (int) $pdo->query("SELECT COALESCE(MAX(id), 0) FROM bc_bookings WHERE kind = 'booking'")->fetchColumn();
            json_out(['ok' => true, 'pending' => $pending, 'latestId' => $latest]);

        case 'bookings':
            $from = (string) ($_GET['from'] ?? now()->format('Y-m-d'));
            $days = max(1, min(62, (int) ($_GET['days'] ?? 14)));
            if (!valid_date($from)) {
                fail('Bad date');
            }
            $to = fmt(at($from, '00:00')->modify("+$days day"));
            $st = $pdo->prepare("SELECT * FROM bc_bookings WHERE
                    (status = 'pending' AND end_at >= ?)
                 OR (start_at >= ? AND start_at < ?)
                 ORDER BY start_at");
            $st->execute([fmt(now()), fmt(at($from, '00:00')), $to]);
            json_out(['ok' => true, 'bookings' => array_map('admin_booking', $st->fetchAll())]);

        case 'approve':
        case 'reject':
        case 'cancel':
            $id = (int) ($in['id'] ?? 0);
            $reason = trim(mb_substr((string) ($in['reason'] ?? ''), 0, 200));
            $b = with_booking_lock($pdo, function () use ($pdo, $id, $action, $reason) {
                $st = $pdo->prepare('SELECT * FROM bc_bookings WHERE id = ?');
                $st->execute([$id]);
                $b = $st->fetch();
                if (!$b) {
                    throw new DomainException('Booking not found');
                }
                if ($action === 'approve') {
                    if ($b['status'] !== 'pending') {
                        throw new DomainException('This request was already handled.');
                    }
                    if (busy_ranges($pdo, $b['start_at'], $b['end_at'], (int) $b['id'])) {
                        throw new DomainException('Time conflict: another booking overlaps this time.');
                    }
                }
                $new = ['approve' => 'approved', 'reject' => 'rejected', 'cancel' => 'cancelled'][$action];
                $pdo->prepare('UPDATE bc_bookings SET status = ?, reason = ?, decided_at = ? WHERE id = ?')
                    ->execute([$new, $reason !== '' ? $reason : null, fmt(now()), $id]);
                $b['status'] = $new;
                return $b;
            });
            $notice = null;
            if ($b['kind'] === 'booking') {
                $notice = notify_client($s, $b, $action === 'approve' ? 'approved' : 'rejected');
            }
            json_out(['ok' => true, 'booking' => admin_booking($b), 'notice' => $notice]);

        case 'block': // barber blocks time (break, walk-in, day off …)
            $date = (string) ($in['date'] ?? '');
            $time = (string) ($in['time'] ?? '');
            $minutes = max(5, min(24 * 60, (int) ($in['minutes'] ?? 30)));
            $label = trim(mb_substr((string) ($in['label'] ?? 'Blocked'), 0, 80)) ?: 'Blocked';
            if (!valid_date($date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
                fail('Choose a date and time');
            }
            $start = at($date, $time);
            $end = $start->modify("+$minutes minutes");
            $b = with_booking_lock($pdo, function () use ($pdo, $start, $end, $minutes, $label) {
                if (busy_ranges($pdo, fmt($start), fmt($end))) {
                    throw new DomainException('Time conflict: there is already a booking in that time.');
                }
                $b = [
                    'code' => random_code(), 'token' => bin2hex(random_bytes(12)), 'service_id' => null,
                    'service_name' => $label, 'duration_min' => $minutes, 'price' => null,
                    'customer_name' => $label, 'phone' => '', 'note' => null,
                    'start_at' => fmt($start), 'end_at' => fmt($end), 'status' => 'approved', 'kind' => 'block',
                    'ip' => client_ip(), 'created_at' => fmt(now()), 'decided_at' => fmt(now()),
                ];
                $cols = implode(', ', array_keys($b));
                $pdo->prepare("INSERT INTO bc_bookings ($cols) VALUES (" . implode(', ', array_fill(0, count($b), '?')) . ')')
                    ->execute(array_values($b));
                return $b;
            });
            json_out(['ok' => true]);

        case 'services':
            $rows = $pdo->query('SELECT * FROM bc_services ORDER BY sort, id')->fetchAll();
            json_out(['ok' => true, 'services' => array_map(fn($r) => [
                'id' => (int) $r['id'], 'name' => $r['name'], 'duration' => (int) $r['duration_min'],
                'price' => $r['price'], 'active' => (bool) $r['active'], 'sort' => (int) $r['sort'],
            ], $rows)]);

        case 'service_save':
            $name = trim(mb_substr((string) ($in['name'] ?? ''), 0, 80));
            $duration = (int) ($in['duration'] ?? 0);
            $price = trim(mb_substr((string) ($in['price'] ?? ''), 0, 32));
            if ($name === '' || $duration < 5 || $duration > 600) {
                fail('Name and a duration between 5 and 600 minutes are required');
            }
            $args = [$name, $duration, $price !== '' ? $price : null, !empty($in['active']) ? 1 : 0, (int) ($in['sort'] ?? 0)];
            if (!empty($in['id'])) {
                $args[] = (int) $in['id'];
                $pdo->prepare('UPDATE bc_services SET name = ?, duration_min = ?, price = ?, active = ?, sort = ? WHERE id = ?')->execute($args);
            } else {
                $pdo->prepare('INSERT INTO bc_services (name, duration_min, price, active, sort) VALUES (?, ?, ?, ?, ?)')->execute($args);
            }
            json_out(['ok' => true]);

        case 'service_delete':
            $pdo->prepare('DELETE FROM bc_services WHERE id = ?')->execute([(int) ($in['id'] ?? 0)]);
            json_out(['ok' => true]);

        case 'settings':
            $out = $s;
            foreach (['cloud_token', 'callmebot_apikey'] as $secret) {
                $out[$secret] = $out[$secret] ? '••••••••' : '';
            }
            json_out(['ok' => true, 'settings' => $out]);

        case 'settings_save':
            $vals = (array) ($in['settings'] ?? []);
            foreach (['cloud_token', 'callmebot_apikey'] as $secret) {
                if (($vals[$secret] ?? '') === '••••••••') {
                    unset($vals[$secret]); // unchanged
                }
            }
            if (isset($vals['barber_whatsapp']) && $vals['barber_whatsapp'] !== '') {
                $n = normalize_phone((string) $vals['barber_whatsapp']);
                if (!$n) {
                    fail('Barber WhatsApp number looks invalid');
                }
                $vals['barber_whatsapp'] = $n;
            }
            foreach (['slot_step' => [5, 120], 'lead_minutes' => [0, 1440], 'days_ahead' => [1, 60], 'max_pending_per_phone' => [1, 10]] as $k => [$min, $max]) {
                if (isset($vals[$k])) {
                    $vals[$k] = max($min, min($max, (int) $vals[$k]));
                }
            }
            if (isset($vals['notify_driver']) && !in_array($vals['notify_driver'], ['manual', 'callmebot', 'cloud'], true)) {
                fail('Unknown notification method');
            }
            save_settings($pdo, $vals);
            json_out(['ok' => true]);

        case 'test_notify':
            $fake = [
                'customer_name' => 'Test Client', 'phone' => $s['barber_whatsapp'], 'service_name' => 'Haircut',
                'start_at' => fmt(now()->modify('+1 hour')), 'code' => 'BC-TEST',
            ];
            json_out(['ok' => true, 'result' => notify_barber_new($s, $fake)]);

        case 'password':
            $new = (string) ($in['password'] ?? '');
            if (strlen($new) < 8) {
                fail('Use at least 8 characters');
            }
            $path = config_path();
            $cfg = config();
            $cfg['admin_password_hash'] = password_hash($new, PASSWORD_DEFAULT);
            if (!$path || !is_writable($path) || file_put_contents($path, "<?php\nreturn " . var_export($cfg, true) . ";\n") === false) {
                fail('Could not save the new password (config file not writable)');
            }
            json_out(['ok' => true]);
    }

    fail('Unknown action', 404);
} catch (DomainException $e) {
    fail($e->getMessage(), 409);
} catch (Throwable $e) {
    error_log('[basst-cut admin] ' . $e->getMessage());
    fail('Server error: ' . $e->getMessage(), 500);
}

function admin_booking(array $b): array
{
    $client = $b['kind'] === 'booking' && $b['phone'] !== '';
    return [
        'id' => (int) $b['id'],
        'code' => $b['code'],
        'kind' => $b['kind'],
        'status' => $b['status'],
        'name' => $b['customer_name'],
        'phone' => $b['phone'],
        'service' => $b['service_name'],
        'duration' => (int) $b['duration_min'],
        'price' => $b['price'],
        'note' => $b['note'],
        'start' => $b['start_at'],
        'end' => $b['end_at'],
        'dateLabel' => nice_date($b['start_at']),
        'timeLabel' => nice_time($b['start_at']) . ' – ' . nice_time($b['end_at']),
        'created' => $b['created_at'],
        'chat' => $client ? 'https://wa.me/' . $b['phone'] : null,
    ];
}
