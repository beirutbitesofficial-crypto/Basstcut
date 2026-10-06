<?php
/**
 * Public booking API used by the landing page.
 *   GET  ?action=config                       → services + bookable days
 *   GET  ?action=slots&date=Y-m-d&service=ID  → free start times
 *   POST ?action=book   {service, date, time, name, phone, note}
 *   GET  ?action=status&code=BC-XXXXX&token=… → current status (client polls after booking)
 */

declare(strict_types=1);
require __DIR__ . '/_lib.php';

header('X-Robots-Tag: noindex');

if (!is_installed()) {
    fail('Online booking is not available yet.', 503);
}

try {
    $pdo = db();
    $s = settings($pdo);
    $action = $_GET['action'] ?? '';

    if ($action === 'config') {
        $services = $pdo->query('SELECT id, name, duration_min AS duration, price FROM bc_services WHERE active = 1 ORDER BY sort, id')->fetchAll();
        foreach ($services as &$sv) {
            $sv['id'] = (int) $sv['id'];
            $sv['duration'] = (int) $sv['duration'];
        }
        json_out(['ok' => true, 'services' => $services, 'days' => bookable_days($s), 'leadMinutes' => (int) $s['lead_minutes']]);
    }

    if ($action === 'slots') {
        $date = (string) ($_GET['date'] ?? '');
        $service = service_by_id($pdo, (int) ($_GET['service'] ?? 0));
        json_out(['ok' => true, 'date' => $date, 'slots' => available_slots($pdo, $s, $date, (int) $service['duration_min'])]);
    }

    if ($action === 'status') {
        $st = $pdo->prepare('SELECT * FROM bc_bookings WHERE code = ? AND token = ?');
        $st->execute([(string) ($_GET['code'] ?? ''), (string) ($_GET['token'] ?? '')]);
        $b = $st->fetch();
        if (!$b) {
            fail('Booking not found', 404);
        }
        json_out(['ok' => true, 'booking' => public_booking($b)]);
    }

    if ($action === 'book' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $in = body_json();
        if (!empty($in['website'])) { // honeypot
            fail('Invalid request');
        }
        $name = trim(preg_replace('/\s+/', ' ', (string) ($in['name'] ?? '')) ?? '');
        $phone = normalize_phone((string) ($in['phone'] ?? ''));
        $note = trim(mb_substr((string) ($in['note'] ?? ''), 0, 300));
        $date = (string) ($in['date'] ?? '');
        $time = (string) ($in['time'] ?? '');
        $service = service_by_id($pdo, (int) ($in['service'] ?? 0));

        if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
            fail('Please enter your name.');
        }
        if (!$phone) {
            fail('Please enter a valid WhatsApp number.');
        }
        if (!valid_date($date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            fail('Please choose a date and time.');
        }

        // Light abuse protection
        $st = $pdo->prepare("SELECT COUNT(*) FROM bc_bookings WHERE phone = ? AND status = 'pending' AND start_at >= ?");
        $st->execute([$phone, fmt(now())]);
        if ((int) $st->fetchColumn() >= max(1, (int) $s['max_pending_per_phone'])) {
            fail('You already have a request waiting for confirmation. Please wait for the barber to reply.');
        }
        $st = $pdo->prepare('SELECT COUNT(*) FROM bc_bookings WHERE ip = ? AND created_at >= ?');
        $st->execute([client_ip(), fmt(now()->modify('-1 hour'))]);
        if ((int) $st->fetchColumn() >= 6) {
            fail('Too many requests. Please try again later.', 429);
        }

        $duration = (int) $service['duration_min'];
        if (at($date, $time) < now()->modify('+' . (int) $s['lead_minutes'] . ' minutes')) {
            fail('Bookings must be at least ' . (int) $s['lead_minutes'] . ' minutes from now. Please pick a later time.', 409);
        }
        $booking = with_booking_lock($pdo, function () use ($pdo, $s, $date, $time, $duration, $service, $name, $phone, $note) {
            // Re-check inside the lock: lead time, opening hours and conflicts.
            if (!in_array($time, available_slots($pdo, $s, $date, $duration), true)) {
                throw new DomainException('Sorry, that time was just taken or is no longer available. Please pick another.');
            }
            $start = at($date, $time);
            $b = [
                'code' => random_code(),
                'token' => bin2hex(random_bytes(12)),
                'service_id' => (int) $service['id'],
                'service_name' => $service['name'],
                'duration_min' => $duration,
                'price' => $service['price'],
                'customer_name' => $name,
                'phone' => $phone,
                'note' => $note !== '' ? $note : null,
                'start_at' => fmt($start),
                'end_at' => fmt($start->modify("+$duration minutes")),
                'status' => 'pending',
                'kind' => 'booking',
                'ip' => client_ip(),
                'created_at' => fmt(now()),
            ];
            $cols = implode(', ', array_keys($b));
            $qs = implode(', ', array_fill(0, count($b), '?'));
            $pdo->prepare("INSERT INTO bc_bookings ($cols) VALUES ($qs)")->execute(array_values($b));
            return $b;
        });

        // Notify after commit — a notification failure must never lose the booking.
        $notified = notify_barber_new($s, $booking);
        if (($s['notify_driver'] ?? '') === 'cloud') {
            send_whatsapp($s, $phone, fill_message((string) $s['msg_received'], $booking));
        }

        json_out([
            'ok' => true,
            'booking' => public_booking($booking),
            'token' => $booking['token'],
            'barberNotified' => $notified['sent'],
        ]);
    }

    fail('Unknown action', 404);
} catch (DomainException $e) {
    fail($e->getMessage(), 409);
} catch (Throwable $e) {
    error_log('[basst-cut] ' . $e->getMessage());
    fail('Something went wrong. Please try again or message us on WhatsApp.', 500);
}

function service_by_id(PDO $pdo, int $id): array
{
    $st = $pdo->prepare('SELECT * FROM bc_services WHERE id = ? AND active = 1');
    $st->execute([$id]);
    $sv = $st->fetch();
    if (!$sv) {
        fail('Please choose a service.');
    }
    return $sv;
}
