<?php
require 'config.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true) ?? [];

if ($action === 'register') {
    $name = trim($data['name'] ?? '');
    $password = $data['password'] ?? '';

    if ($name === '' || strlen($password) < 6) {
        jsonResponse(['success'=>false,'message'=>'Nama dan password minimal 6 karakter diperlukan.'], 422);
    }

    $check = $conn->prepare("SELECT id FROM users WHERE username=? LIMIT 1");
    $check->bind_param('s', $name);
    $check->execute();
    if ($check->get_result()->num_rows) {
        jsonResponse(['success'=>false,'message'=>'Nama pengguna sudah digunakan.'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username,password) VALUES (?,?)");
    $stmt->bind_param('ss', $name, $hash);
    $stmt->execute();

    $_SESSION['user_id'] = $stmt->insert_id;
    $_SESSION['username'] = $name;
    jsonResponse(['success'=>true,'user'=>['id'=>$_SESSION['user_id'],'username'=>$name]]);
}

if ($action === 'login') {
    $name = trim($data['name'] ?? '');
    $password = $data['password'] ?? '';

    $stmt = $conn->prepare("SELECT id,username,password FROM users WHERE username=? LIMIT 1");
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonResponse(['success'=>false,'message'=>'Nama pengguna atau password salah.'], 401);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    jsonResponse(['success'=>true,'user'=>['id'=>$user['id'],'username'=>$user['username']]]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    jsonResponse(['success'=>true]);
}

if ($action === 'me') {
    if (empty($_SESSION['user_id'])) jsonResponse(['success'=>true,'logged_in'=>false]);
    jsonResponse(['success'=>true,'logged_in'=>true,'user'=>[
        'id'=>$_SESSION['user_id'],
        'username'=>$_SESSION['username']
    ]]);
}

jsonResponse(['success'=>false,'message'=>'Action tidak ditemukan.'], 404);
?>