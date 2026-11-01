<?php
// PUT body {month:'YYYY-MM', category:'Groceries', amount:9000}   (amount 0 removes the limit)
// Returns the full budgets map so the client stays in sync.
require __DIR__ . '/../bootstrap.php';

$uid = uid();
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') fail('Method not allowed.', 405);

$in     = body();
$period = (string)($in['month'] ?? '');
$cat    = trim((string)($in['category'] ?? ''));
$amount = filter_var($in['amount'] ?? null, FILTER_VALIDATE_FLOAT);

if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period)) fail('Invalid month.');
if ($cat === '' || mb_strlen($cat) > 40) fail('Choose a category.');
if ($amount === false || $amount < 0 || $amount > 9999999999.99) fail('Enter a valid limit.');

$pdo = db();
$pdo->beginTransaction();

// First edit in a month: copy the limits it inherits, so they stay in place.
$has = $pdo->prepare('SELECT 1 FROM budgets WHERE user_id = ? AND period = ? LIMIT 1');
$has->execute([$uid, $period]);
if (!$has->fetchColumn()) {
    $prev = $pdo->prepare('SELECT MAX(period) FROM budgets WHERE user_id = ? AND period < ?');
    $prev->execute([$uid, $period]);
    if ($from = $prev->fetchColumn()) {
        $pdo->prepare('INSERT INTO budgets (user_id, period, category_id, amount)
                       SELECT user_id, ?, category_id, amount FROM budgets WHERE user_id = ? AND period = ?')
            ->execute([$period, $uid, $from]);
    }
}

$cid = category_id($uid, 'expense', $cat);
if ($amount > 0) {
    $pdo->prepare('INSERT INTO budgets (user_id, period, category_id, amount) VALUES (?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE amount = VALUES(amount)')
        ->execute([$uid, $period, $cid, round((float)$amount, 2)]);
} else {
    $pdo->prepare('DELETE FROM budgets WHERE user_id = ? AND period = ? AND category_id = ?')
        ->execute([$uid, $period, $cid]);
}

$pdo->commit();
out(['budgets' => budgets_for($uid)]);
