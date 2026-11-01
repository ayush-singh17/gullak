<?php
// GET  -> { txns, budgets, cats } for the logged-in user
// POST -> bulk import { txns:[...], budgets:{ 'YYYY-MM': { Category: amount } } } (used by "Load sample data")
require __DIR__ . '/../bootstrap.php';

$uid = uid();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') out(snapshot($uid));
if ($method !== 'POST') fail('Method not allowed.', 405);

$in   = body();
$list = $in['txns'] ?? [];
if (!is_array($list) || count($list) > 2000) fail('Too many transactions in one import.');

$pdo = db();
$pdo->beginTransaction();

$ins = $pdo->prepare('INSERT INTO transactions (user_id, category_id, type, amount, txn_date, note) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($list as $t) {
    if (!is_array($t)) continue;
    [$type, $amount, $date, $cat, $note] = clean_txn($t);
    $ins->execute([$uid, category_id($uid, $type, $cat), $type, $amount, $date, $note]);
}

$bud = $pdo->prepare('INSERT IGNORE INTO budgets (user_id, period, category_id, amount) VALUES (?, ?, ?, ?)');
foreach ((array)($in['budgets'] ?? []) as $period => $set) {
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string)$period) || !is_array($set)) continue;
    foreach ($set as $cat => $amt) {
        $a = filter_var($amt, FILTER_VALIDATE_FLOAT);
        if ($a === false || $a <= 0) continue;
        $bud->execute([$uid, $period, category_id($uid, 'expense', (string)$cat), round($a, 2)]);
    }
}

$pdo->commit();
out(['ok' => true, 'imported' => count($list)], 201);
