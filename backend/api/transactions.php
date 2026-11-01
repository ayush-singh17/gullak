<?php
// POST   body {type, amount, date, category, note}        -> {id, cats}
// PUT    body {id, type, amount, date, category, note}    -> {ok, cats}
// DELETE ?id=123                                          -> {ok}
require __DIR__ . '/../bootstrap.php';

$uid    = uid();
$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();

if ($method === 'DELETE') {
    $st = $pdo->prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');
    $st->execute([(int)($_GET['id'] ?? 0), $uid]);
    if (!$st->rowCount()) fail('Transaction not found.', 404);
    out(['ok' => true]);
}

if (!in_array($method, ['POST', 'PUT'], true)) fail('Method not allowed.', 405);

$in = body();
[$type, $amount, $date, $cat, $note] = clean_txn($in);
$cid = category_id($uid, $type, $cat);

if ($method === 'POST') {
    $pdo->prepare('INSERT INTO transactions (user_id, category_id, type, amount, txn_date, note) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$uid, $cid, $type, $amount, $date, $note]);
    out(['id' => (string)$pdo->lastInsertId(), 'cats' => categories_for($uid)], 201);
}

$id = (int)($in['id'] ?? 0);
$chk = $pdo->prepare('SELECT 1 FROM transactions WHERE id = ? AND user_id = ?');
$chk->execute([$id, $uid]);
if (!$chk->fetchColumn()) fail('Transaction not found.', 404);

$pdo->prepare('UPDATE transactions SET category_id = ?, type = ?, amount = ?, txn_date = ?, note = ? WHERE id = ? AND user_id = ?')
    ->execute([$cid, $type, $amount, $date, $note, $id, $uid]);
out(['ok' => true, 'cats' => categories_for($uid)]);
