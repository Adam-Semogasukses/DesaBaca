DESA BACA - BACKEND
===================
Stack: PHP Native + MySQL + Session. No framework / Java.

INSTALL
1. Copy folder desa-baca-n ke C:\xampp\htdocs\ (or your XAMPP htdocs).
2. Start Apache + MySQL.
3. Open phpMyAdmin.
4. Import database.sql.
5. Check backend/config.php: root password is empty by default.
6. Open http://localhost/desa-baca-n/

API
backend/auth.php?action=register
backend/auth.php?action=login
backend/auth.php?action=logout
backend/auth.php?action=me
backend/books.php
backend/bookmarks.php
backend/progress.php
backend/stats.php

The API uses PHP sessions and password_hash/password_verify.
