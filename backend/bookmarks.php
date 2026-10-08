<?php
require 'config.php';
requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = $_SESSION['user_id'];

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT b.slug FROM bookmarks bm JOIN books b ON b.id=bm.book_id WHERE bm.user_id=?");
    $stmt->bind_param('i',$userId);
    $stmt->execute();
    $result=$stmt->get_result();
    $items=[];
    while($r=$result->fetch_assoc()) $items[]=$r['slug'];
    jsonResponse(['success'=>true,'bookmarks'=>$items]);
}

$slug = trim($data['slug'] ?? '');
$stmt=$conn->prepare("SELECT id FROM books WHERE slug=? LIMIT 1");
$stmt->bind_param('s',$slug);
$stmt->execute();
$book=$stmt->get_result()->fetch_assoc();
if(!$book) jsonResponse(['success'=>false,'message'=>'Buku tidak ditemukan.'],404);

$check=$conn->prepare("SELECT id FROM bookmarks WHERE user_id=? AND book_id=?");
$check->bind_param('ii',$userId,$book['id']);
$check->execute();

if($check->get_result()->num_rows){
    $del=$conn->prepare("DELETE FROM bookmarks WHERE user_id=? AND book_id=?");
    $del->bind_param('ii',$userId,$book['id']); $del->execute();
    jsonResponse(['success'=>true,'bookmarked'=>false]);
}else{
    $ins=$conn->prepare("INSERT INTO bookmarks (user_id,book_id) VALUES (?,?)");
    $ins->bind_param('ii',$userId,$book['id']); $ins->execute();
    jsonResponse(['success'=>true,'bookmarked'=>true]);
}
?>