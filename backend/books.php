<?php
require 'config.php';

$result = $conn->query("SELECT id,slug,title,author,description,cover,category,readers FROM books ORDER BY id DESC");
$books = [];
while ($row = $result->fetch_assoc()) $books[] = $row;

jsonResponse(['success'=>true,'books'=>$books]);
?>