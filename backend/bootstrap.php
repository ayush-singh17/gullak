<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

set_exception_handler(function (Throwable $e): void {
    error_log((string)$e);
    http_response_code(500);
    echo json_encode(['error' => 'Something went wrong on the server.']);
});

session_name('gullak_sid');
session_set_cookie_params([
    'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']),
]);
session_start();

/* ---------- response + request helpers ---------- */

function out($data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400): never
{
    out(['error' => $message], $code);
}

/** Decoded JSON body. Non-GET requests must send application/json (blocks cross-site form posts). */
function body(): array
{
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        fail('Content-Type must be application/json.', 415);
    }
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $json = json_decode($raw, true);
    if (!is_array($json)) fail('Invalid JSON.');
    return $json;
}

/* ---------- database ---------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME),
                DB_USER, DB_PASS,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            error_log($e->getMessage());
            fail('Database connection failed. Check backend/config.php.', 500);
        }
    }
    return $pdo;
}

/* ---------- auth ---------- */

function current_user(): ?array
{
    if (empty($_SESSION['uid'])) return null;
    $st = db()->prepare('SELECT id, name, email FROM users WHERE id = ?');
    $st->execute([$_SESSION['uid']]);
    $u = $st->fetch();
    return $u ? ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email']] : null;
}

function uid(): int
{
    if (empty($_SESSION['uid'])) fail('Please log in.', 401);
    return (int)$_SESSION['uid'];
}

/* ---------- categories ---------- */

const PALETTE = ['#ffb627', '#e63e62', '#2f9e5f', '#3d6fd9', '#d94f9b', '#0fa6a6', '#b8742c', '#4cb0e6', '#9bc53d', '#7a9296'];

function seed_categories(int $uid): void
{
    $defaults = [
        'expense' => [['Housing', 3], ['Groceries', 2], ['Dining', 0], ['Transport', 5], ['Utilities', 7],
                      ['Health', 4], ['Shopping', 1], ['Entertainment', 8], ['Education', 6], ['Other', 9]],
        'income'  => [['Salary', 2], ['Freelance', 3], ['Investments', 5], ['Gift', 4], ['Other', 9]],
    ];
    $st = db()->prepare('INSERT INTO categories (user_id, type, name, color) VALUES (?, ?, ?, ?)');
    foreach ($defaults as $type => $list) {
        foreach ($list as [$name, $c]) $st->execute([$uid, $type, $name, PALETTE[$c]]);
    }
}

/** Find a category by name, creating it (with the next palette colour) if it does not exist. */
function category_id(int $uid, string $type, string $name): int
{
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ?');
    $st->execute([$uid, $type, $name]);
    $id = $st->fetchColumn();
    if ($id) return (int)$id;
    $n = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE user_id = ?');
    $n->execute([$uid]);
    $color = PALETTE[((int)$n->fetchColumn()) % count(PALETTE)];
    $pdo->prepare('INSERT INTO categories (user_id, type, name, color) VALUES (?, ?, ?, ?)')
        ->execute([$uid, $type, $name, $color]);
    return (int)$pdo->lastInsertId();
}

function categories_for(int $uid): array
{
    $st = db()->prepare('SELECT type, name, color FROM categories WHERE user_id = ? ORDER BY id');
    $st->execute([$uid]);
    $out = ['expense' => [], 'income' => []];
    foreach ($st as $r) $out[$r['type']][] = ['name' => $r['name'], 'color' => $r['color']];
    return $out;
}

/* ---------- budgets + snapshot ---------- */

function budgets_for(int $uid): object
{
    $st = db()->prepare('SELECT b.period, c.name, b.amount FROM budgets b JOIN categories c ON c.id = b.category_id WHERE b.user_id = ?');
    $st->execute([$uid]);
    $out = [];
    foreach ($st as $r) $out[$r['period']][$r['name']] = (float)$r['amount'];
    return (object)$out;
}

function snapshot(int $uid): array
{
    $st = db()->prepare(
        'SELECT t.id, t.txn_date AS date, t.type, c.name AS category, t.amount, t.note
         FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? ORDER BY t.txn_date DESC, t.id DESC'
    );
    $st->execute([$uid]);
    $txns = [];
    foreach ($st as $r) {
        $txns[] = ['id' => (string)$r['id'], 'date' => $r['date'], 'type' => $r['type'],
                   'category' => $r['category'], 'amount' => (float)$r['amount'], 'note' => $r['note']];
    }
    return ['txns' => $txns, 'budgets' => budgets_for($uid), 'cats' => categories_for($uid)];
}

/* ---------- validation ---------- */

/** @return array{0:string,1:float,2:string,3:string,4:string} type, amount, date, category, note */
function clean_txn(array $in): array
{
    $type = $in['type'] ?? '';
    if (!in_array($type, ['income', 'expense'], true)) fail('Invalid transaction type.');
    $amount = filter_var($in['amount'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($amount === false || $amount <= 0 || $amount > 9999999999.99) fail('Enter an amount greater than zero.');
    $date = (string)($in['date'] ?? '');
    $d = DateTime::createFromFormat('Y-m-d', $date);
    if (!$d || $d->format('Y-m-d') !== $date) fail('Pick a valid date.');
    $cat = trim((string)($in['category'] ?? ''));
    if ($cat === '' || mb_strlen($cat) > 40) fail('Choose a category.');
    $note = mb_substr(trim((string)($in['note'] ?? '')), 0, 80);
    return [$type, round((float)$amount, 2), $date, $cat, $note];
}
