<?php
require 'config.php';
requireLogin();

$userId=$_SESSION['user_id'];
if($_SERVER['REQUEST_METHOD']==='GET'){
    $stmt=$conn->prepare("SELECT b.slug,b.title,r.progress,r.last_read_at FROM reading_progress r JOIN books b ON b.id=r.book_id WHERE r.user_id=? ORDER BY r.last_read_at DESC");
    $stmt->bind_param('i',$userId); $stmt->execute();
    $res=$stmt->get_result(); $items=[];
    while($r=$res->fetch_assoc()) $items[]=$r;
    jsonResponse(['success'=>true,'progress'=>$items]);
}

$data=json_decode(file_get_contents('php://input'),true) ?? [];
$slug=trim($data['slug']??''); $progress=max(0,min(100,(int)($data['progress']??0)));
$stmt=$conn->prepare("SELECT id FROM books WHERE slug=? LIMIT 1"); $stmt->bind_param('s',$slug); $stmt->execute();
$book=$stmt->get_result()->fetch_assoc();
if(!$book) jsonResponse(['success'=>false,'message'=>'Buku tidak ditemukan.'],404);

$stmt=$conn->prepare("INSERT INTO reading_progress (user_id,book_id,progress,last_read_at) VALUES (?,?,?,NOW()) ON DUPLICATE KEY UPDATE progress=VALUES(progress),last_read_at=NOW()");
$stmt->bind_param('iii',$userId,$book['id'],$progress); $stmt->execute();
jsonResponse(['success'=>true,'progress'=>$progress]);
?>