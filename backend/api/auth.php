<?php
// POST ?action=register | login | logout     GET ?action=me
require __DIR__ . '/../bootstrap.php';

$action = $_GET['action'] ?? '';

if ($action === 'me') {
    $u = current_user();
    if (!$u) fail('Not logged in.', 401);
    out(['user' => $u]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);
$in = body();

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

$email = strtolower(trim((string)($in['email'] ?? '')));
$pw    = (string)($in['password'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
if (strlen($pw) < 6) fail('Password must be at least 6 characters.');

$pdo = db();

if ($action === 'register') {
    $name = trim((string)($in['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 80) fail('Enter your name.');
    try {
        $pdo->beginTransaction();
        $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
            ->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT)]);
        $uid = (int)$pdo->lastInsertId();
        seed_categories($uid);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') fail('That email already has an account. Log in instead.', 409);
        throw $e;
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    out(['user' => ['id' => $uid, 'name' => $name, 'email' => $email]], 201);
}

if ($action === 'login') {
    $st = $pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u || !password_verify($pw, $u['password_hash'])) {
        usleep(400000); // slow down password guessing
        fail('Email or password is incorrect.', 401);
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    out(['user' => ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email']]]);
}

fail('Unknown action.', 404);
