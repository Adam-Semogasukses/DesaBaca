CREATE DATABASE IF NOT EXISTS desabaca CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE desabaca;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  author VARCHAR(120) NOT NULL,
  description TEXT,
  cover VARCHAR(255),
  category VARCHAR(80),
  readers INT DEFAULT 0
);

CREATE TABLE bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_bookmark (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE reading_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  progress TINYINT UNSIGNED DEFAULT 0,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_progress (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

INSERT INTO books (slug,title,author,description,cover,category,readers) VALUES
('atomic_habits','Atomic Habits','James Clear','Perubahan kecil yang dilakukan secara konsisten setiap hari dapat berakumulasi menghasilkan transformasi besar dalam hidup.','images/atomic_habits.jpg','Pengembangan Diri',44),
('hujan','Hujan','Tere Liye','Perjalanan hidup Lail dalam menghadapi kehilangan, cinta, dan kenangan setelah bencana alam dahsyat.','images/v259_152.png','Fiksi',95),
('filosofi_teras','Filosofi Teras','Henry Manampiring','Ajaran Stoik untuk membedakan hal yang dapat dan tidak dapat dikendalikan demi ketenangan batin.','images/filosofi_teras.jpg','Pengembangan Diri',99);


-- =============================================================================
-- PLANNED (belum dijalankan): tabel untuk riwayat baca & leaderboard lokal.
-- Saat ini fitur itu masih MOCKUP di localStorage (js/store.js). Skema lengkap +
-- query leaderboard + definisi "buku terbaca" ada di header & bagian bawah js/store.js.
-- Salin blok di bawah ini ke atas saat migrasi ke database.
-- =============================================================================
-- CREATE TABLE villages (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE);  -- 'bacaMaju'
-- ALTER TABLE users ADD COLUMN village_id INT NULL, ADD FOREIGN KEY (village_id) REFERENCES villages(id);
-- ALTER TABLE books ADD COLUMN chapters TINYINT UNSIGNED DEFAULT 6;
-- ALTER TABLE reading_progress
--   ADD COLUMN current_chapter TINYINT UNSIGNED DEFAULT 1,
--   ADD COLUMN done_chapters VARCHAR(64) DEFAULT '',
--   ADD COLUMN minutes_read INT UNSIGNED DEFAULT 0,
--   ADD COLUMN status ENUM('reading','completed') DEFAULT 'reading',
--   ADD COLUMN first_read_at TIMESTAMP NULL;
-- CREATE TABLE reading_history (
--   id BIGINT AUTO_INCREMENT PRIMARY KEY,
--   user_id INT NOT NULL, book_id INT NOT NULL,
--   event_type ENUM('open','chapter_done','finish') NOT NULL,
--   chapter TINYINT UNSIGNED NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   INDEX idx_user_time (user_id, created_at),
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--   FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
-- );
