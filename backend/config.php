<?php
// Desa Baca - Database configuration
session_start();

$host = 'localhost';
$db   = 'desabaca';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode(['success'=>false,'message'=>'Database connection failed']));
}
$conn->set_charset($charset);

header('Content-Type: application/json; charset=utf-8');

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function requireLogin() {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success'=>false,'message'=>'Silakan login terlebih dahulu.'], 401);
    }
}
?>