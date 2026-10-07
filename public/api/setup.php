<?php
/**
 * One-time setup used by the React admin (/admin/) on a fresh install.
 * Refuses to run once a config file exists.
 */

declare(strict_types=1);
require __DIR__ . '/_lib.php';

header('X-Robots-Tag: noindex');

if (is_installed()) {
    fail('Already set up', 409);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('POST only', 405);
}

$in = body_json();
$cfg = [
    'db_driver' => 'mysql',
    'db_host' => trim((string) ($in['db_host'] ?? 'localhost')) ?: 'localhost',
    'db_name' => trim((string) ($in['db_name'] ?? '')),
    'db_user' => trim((string) ($in['db_user'] ?? '')),
    'db_pass' => (string) ($in['db_pass'] ?? ''),
];
$pw = (string) ($in['admin_password'] ?? '');
$barber = normalize_phone((string) ($in['barber_whatsapp'] ?? ''));

if ($cfg['db_name'] === '' || $cfg['db_user'] === '') {
    fail('Enter the database name and user.');
}
if (strlen($pw) < 8) {
    fail('Admin password must be at least 8 characters.');
}
if (!$barber) {
    fail('Enter the barber WhatsApp number (e.g. 70 123 456).');
}

try {
    $pdo = make_pdo($cfg);
    migrate($pdo);
    save_settings($pdo, ['barber_whatsapp' => $barber]);
} catch (PDOException $e) {
    fail('Database connection failed: ' . $e->getMessage());
}

$cfg['admin_password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
$php = "<?php\n// BASST CUT booking config — keep private.\nreturn " . var_export($cfg, true) . ";\n";
foreach (config_candidates() as $p) {
    if (getenv('BASST_CONFIG') && $p !== getenv('BASST_CONFIG')) {
        continue;
    }
    if (is_writable(dirname($p)) && @file_put_contents($p, $php, LOCK_EX) !== false) {
        @chmod($p, 0600);
        json_out(['ok' => true]);
    }
}
fail('Could not write the config file. Check folder permissions.', 500);
