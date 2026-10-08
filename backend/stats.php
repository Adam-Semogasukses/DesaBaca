<?php
require 'config.php';
requireLogin();

$userId=$_SESSION['user_id'];

$q=$conn->prepare("SELECT COUNT(*) total FROM bookmarks WHERE user_id=?"); $q->bind_param('i',$userId); $q->execute();
$bookmarks=$q->get_result()->fetch_assoc()['total'];

$q=$conn->prepare("SELECT COUNT(*) total FROM reading_progress WHERE user_id=?"); $q->bind_param('i',$userId); $q->execute();
$inProgress=$q->get_result()->fetch_assoc()['total'];

$q=$conn->prepare("SELECT COUNT(*) total FROM reading_progress WHERE user_id=? AND progress>=100"); $q->bind_param('i',$userId); $q->execute();
$completed=$q->get_result()->fetch_assoc()['total'];

$q=$conn->prepare("SELECT b.title,r.progress,r.last_read_at FROM reading_progress r JOIN books b ON b.id=r.book_id WHERE r.user_id=? ORDER BY r.last_read_at DESC LIMIT 5");
$q->bind_param('i',$userId); $q->execute(); $res=$q->get_result(); $recent=[];
while($r=$res->fetch_assoc()) $recent[]=$r;

jsonResponse(['success'=>true,'stats'=>[
    'bookmarks'=>(int)$bookmarks,
    'in_progress'=>(int)$inProgress,
    'completed'=>(int)$completed
],'recent'=>$recent]);
?>