/* =============================================================================
 * DESA BACA — DATA LAYER (MOCKUP / localStorage)            file: js/store.js
 * =============================================================================
 *
 * >>> NOTE FOR OTHER DEVELOPERS / AI AGENTS — READ THIS FIRST <<<
 *
 * STATUS: MOCKUP. Right now ALL user data (bookmarks, reading history, reading
 * progress, local leaderboard) is stored in the browser's localStorage.
 * It is NOT shared between devices/users and it is NOT secure.
 *
 * PLAN: later this data moves to the existing PHP + MySQL backend (see
 * /backend and /database.sql). Therefore:
 *
 *   1. Every page (dashboard.html, baca.html, js/app.js) must read/write data
 *      ONLY through `window.DesaBacaStore` (this file). Never call
 *      localStorage directly for bookmarks/history/progress anywhere else.
 *      (Theme + username keys `desabaca_theme` / `desabaca_user` are the only
 *      exceptions, they already exist in the old code.)
 *
 *   2. To migrate to the database you should ONLY have to rewrite the function
 *      bodies in this file. Each public function below has a `TODO(DB)` comment
 *      with the endpoint to call and the SQL table it maps to.
 *      Keep the same function names + return shapes so the UI keeps working.
 *      Because DB calls are async, the planned change is: make the functions
 *      `async` and add `await` in the callers (callers are few: dashboard.html,
 *      baca.html, js/app.js — search for `DesaBacaStore.`).
 *
 *   3. Flip `DATA_MODE` to 'api' once the backend functions are implemented.
 *
 * ---------------------------------------------------------------------------
 * localStorage keys used (all versioned with _v1)
 * ---------------------------------------------------------------------------
 *   desabaca_bookmarks_v1  -> [{ slug, saved_at }]
 *        DB: table `bookmarks` (already exists: user_id, book_id, created_at)
 *            API: backend/bookmarks.php (GET list, POST toggle) — already exists,
 *                 but GET currently returns only slugs; extend it to also return
 *                 created_at as `saved_at`.
 *
 *   desabaca_progress_v1   -> { [slug]: { chapter, done:[n], progress, status,
 *                                          minutes, first_read_at, last_read_at } }
 *        DB: table `reading_progress` (exists: user_id, book_id, progress,
 *            last_read_at). NEEDS NEW COLUMNS: current_chapter TINYINT,
 *            minutes_read INT, status ENUM('reading','completed'),
 *            first_read_at TIMESTAMP, done_chapters VARCHAR (or a child table).
 *            API: backend/progress.php (exists, extend it).
 *
 *   desabaca_history_v1    -> [{ id, slug, type, chapter, at }]  (newest last)
 *        type = 'open' | 'chapter_done' | 'finish'
 *        DB: NEW table `reading_history` (see schema block at bottom of this
 *            file and in database.sql). API: NEW backend/history.php.
 *
 *   Leaderboard            -> NOT stored. In the mockup, other villagers are
 *        fake names generated from a seeded pseudo-random number per ISO week
 *        (stable during the week, changes next week). Only the current user's
 *        numbers are real (computed from history).
 *        DB: NEW tables `villages` + `users.village_id`, and a weekly
 *            aggregate query (see bottom of this file).
 *            API: NEW backend/leaderboard.php?village=bacaMaju
 *
 * ---------------------------------------------------------------------------
 * Product definitions (keep the same when moving to the DB!)
 * ---------------------------------------------------------------------------
 *   "Buku terbaca"            = distinct books the user OPENED at least once.
 *                               (matches the dashboard card "Semua buku yang
 *                               Anda pernah buka")
 *   "Buku terbaca minggu ini" = distinct books opened between Monday 00:00
 *                               (local time) and now. Used by the leaderboard.
 *   "Buku selesai"            = books with all chapters marked done (progress 100).
 *   "Sedang dibaca"           = opened but not finished.
 *   "Waktu membaca (menit)"   = MINUTES_PER_CHAPTER x chapters marked done.
 *                               (estimate, there is no real timer yet)
 *   "Rentetan hari"           = consecutive days (ending today or yesterday)
 *                               that have at least one history event.
 * ========================================================================== */
(function (global) {
  'use strict';

  // 'local' = localStorage mockup (current).  'api' = PHP/MySQL (future, not implemented).
  const DATA_MODE = 'local';

  const KEYS = {
    bookmarks: 'desabaca_bookmarks_v1',
    progress: 'desabaca_progress_v1',
    history: 'desabaca_history_v1',
  };

  const VILLAGE_NAME = 'bacaMaju';      // TODO(DB): users.village_id -> villages.name
  const MINUTES_PER_CHAPTER = 15;       // see "Waktu membaca" definition above
  const HISTORY_LIMIT = 500;            // mockup only, keeps localStorage small
  const DEDUPE_OPEN_MS = 30 * 60 * 1000; // ignore repeated "open" of same chapter within 30 min

  /* ---------------------------------------------------------------------------
   * BOOK CATALOG
   * TODO(DB): replace with GET backend/books.php  (table `books`, already exists).
   * Same slugs as the INSERT in database.sql. `chapters` is NOT in the `books`
   * table yet -> add column `books.chapters TINYINT DEFAULT 6`.
   * ------------------------------------------------------------------------- */
  const BOOKS = [
    { slug: 'atomic_habits', title: 'Atomic Habits', author: 'James Clear', category: 'Pengembangan Diri', cover: 'images/atomic_habits.jpg', chapters: 6 },
    { slug: 'hujan', title: 'Hujan', author: 'Tere Liye', category: 'Fiksi', cover: 'images/v259_152.png', chapters: 6 },
    { slug: 'filosofi_teras', title: 'Filosofi Teras', author: 'Henry Manampiring', category: 'Pengembangan Diri', cover: 'images/filosofi_teras.jpg', chapters: 6 },
  ];
  const getBooks = () => BOOKS.slice();
  const getBook = (slug) => BOOKS.find((b) => b.slug === slug) || null;

  /* ---------------------------------------------------------------------------
   * Low-level storage helpers (the ONLY place that touches localStorage here).
   * localStorage can throw (private mode / blocked) -> always try/catch.
   * ------------------------------------------------------------------------- */
  const memoryFallback = {};
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return key in memoryFallback ? memoryFallback[key] : fallback;
    }
  }
  function write(key, value) {
    memoryFallback[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------------------
   * Date helpers
   * ------------------------------------------------------------------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function weekStart(date) {                       // Monday 00:00 local time
    const d = new Date(date || Date.now());
    d.setHours(0, 0, 0, 0);
    const diff = (d.getDay() + 6) % 7;             // Mon=0 ... Sun=6
    d.setDate(d.getDate() - diff);
    return d;
  }
  // SQL equivalent: WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)

  /* ===========================================================================
   * BOOKMARKS
   * ========================================================================= */

  /** @returns {{slug:string, saved_at:string}[]} newest first */
  function getBookmarks() {
    // TODO(DB): GET backend/bookmarks.php  -> SELECT b.slug, bm.created_at AS saved_at
    //           FROM bookmarks bm JOIN books b ON b.id = bm.book_id WHERE bm.user_id = ?
    //           ORDER BY bm.created_at DESC
    return read(KEYS.bookmarks, []).slice().sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  }
  const isBookmarked = (slug) => read(KEYS.bookmarks, []).some((x) => x.slug === slug);

  /** Toggle. @returns {boolean} true if now bookmarked */
  function toggleBookmark(slug) {
    // TODO(DB): POST backend/bookmarks.php {slug}  (already exists, returns {bookmarked})
    if (!getBook(slug)) return false;
    const list = read(KEYS.bookmarks, []);
    const exists = list.some((x) => x.slug === slug);
    write(KEYS.bookmarks, exists ? list.filter((x) => x.slug !== slug)
                                 : [...list, { slug, saved_at: new Date().toISOString() }]);
    return !exists;
  }

  /* ===========================================================================
   * PROGRESS + HISTORY
   * ========================================================================= */

  function emptyProgress(book) {
    return { chapter: 1, done: [], progress: 0, status: 'reading', minutes: 0,
             first_read_at: null, last_read_at: null, chapters: book.chapters };
  }

  /** @returns progress object for one book (never null; zeros if never opened) */
  function getProgress(slug) {
    // TODO(DB): GET backend/progress.php -> reading_progress row for (user, book)
    const book = getBook(slug);
    if (!book) return null;
    return { ...emptyProgress(book), ...(read(KEYS.progress, {})[slug] || {}), chapters: book.chapters };
  }

  /** @returns {object[]} progress of every book the user has opened, last read first,
   *  each item = { slug, book, ...progress } */
  function getAllProgress() {
    // TODO(DB): GET backend/progress.php -> JOIN books, ORDER BY last_read_at DESC
    const all = read(KEYS.progress, {});
    return Object.keys(all)
      .filter(getBook)
      .map((slug) => ({ slug, book: getBook(slug), ...getProgress(slug) }))
      .sort((a, b) => (b.last_read_at || '').localeCompare(a.last_read_at || ''));
  }

  function saveProgress(slug, p) {
    const all = read(KEYS.progress, {});
    all[slug] = p;
    write(KEYS.progress, all);
  }

  function pushHistory(slug, type, chapter, atIso) {
    // TODO(DB): POST backend/history.php {slug,type,chapter}
    //           INSERT INTO reading_history (user_id, book_id, event_type, chapter, created_at)
    const list = read(KEYS.history, []);
    list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                slug, type, chapter, at: atIso || new Date().toISOString() });
    write(KEYS.history, list.slice(-HISTORY_LIMIT));
  }

  /** Call when the reader screen shows a chapter. Also remembers "resume here". */
  function recordOpen(slug, chapter) {
    // TODO(DB): POST backend/progress.php {slug, chapter, action:'open'}
    const book = getBook(slug);
    if (!book) return;
    const now = new Date();
    const p = getProgress(slug);
    p.chapter = Math.max(1, Math.min(book.chapters, chapter || p.chapter));
    p.first_read_at = p.first_read_at || now.toISOString();
    p.last_read_at = now.toISOString();
    saveProgress(slug, p);

    const last = read(KEYS.history, []).filter((h) => h.slug === slug && h.type === 'open').pop();
    const dupe = last && last.chapter === p.chapter && now - new Date(last.at) < DEDUPE_OPEN_MS;
    if (!dupe) pushHistory(slug, 'open', p.chapter);
  }

  /** Call for the "Tandai selesai" button. @returns {{finished:boolean, progress:number}} */
  function completeChapter(slug, chapter) {
    // TODO(DB): POST backend/progress.php {slug, chapter, action:'chapter_done'}
    const book = getBook(slug);
    if (!book) return { finished: false, progress: 0 };
    const p = getProgress(slug);
    const now = new Date().toISOString();
    if (!p.done.includes(chapter)) p.done = [...p.done, chapter].sort((a, b) => a - b);
    p.progress = Math.round((p.done.length / book.chapters) * 100);
    p.minutes = p.done.length * MINUTES_PER_CHAPTER;
    p.first_read_at = p.first_read_at || now;
    p.last_read_at = now;
    const finished = p.done.length >= book.chapters;
    p.status = finished ? 'completed' : 'reading';
    p.chapter = finished ? chapter : Math.min(book.chapters, chapter + 1);
    saveProgress(slug, p);

    pushHistory(slug, 'chapter_done', chapter);
    if (finished) pushHistory(slug, 'finish', chapter);
    return { finished, progress: p.progress };
  }

  /** @returns {{id,slug,type,chapter,at,book}[]} newest first */
  function getHistory(limit) {
    // TODO(DB): GET backend/history.php?limit=  (JOIN books for title/cover)
    const items = read(KEYS.history, [])
      .filter((h) => getBook(h.slug))
      .map((h) => ({ ...h, book: getBook(h.slug) }))
      .reverse();
    return limit ? items.slice(0, limit) : items;
  }

  function clearHistory() {
    // TODO(DB): DELETE backend/history.php  (only the user's own rows)
    write(KEYS.history, []);
    write(KEYS.progress, {});
  }

  /* ===========================================================================
   * STATS (dashboard cards)
   * ========================================================================= */
  function getStats() {
    // TODO(DB): GET backend/stats.php (exists, only returns bookmarks/in_progress/
    //           completed). Extend it with the extra fields below.
    const all = getAllProgress();
    const completed = all.filter((p) => p.status === 'completed').length;
    const minutes = all.reduce((s, p) => s + (p.minutes || 0), 0);
    return {
      opened: all.length,
      completed,
      in_progress: all.length - completed,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
      streak: computeStreak(),
      bookmarks: read(KEYS.bookmarks, []).length,
      completion_pct: all.length ? Math.round((completed / all.length) * 100) : 0,
      week_books: weekBooks('me'),
    };
  }

  function computeStreak() {
    const days = new Set(read(KEYS.history, []).map((h) => dayKey(new Date(h.at))));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // streak may still be alive from yesterday
    let n = 0;
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /** distinct books opened since Monday 00:00 (current user) */
  function weekBooks() {
    const start = weekStart();
    return new Set(read(KEYS.history, [])
      .filter((h) => new Date(h.at) >= start && getBook(h.slug))
      .map((h) => h.slug)).size;
  }

  /* ===========================================================================
   * LOCAL LEADERBOARD  (desa: bacaMaju)
   * ========================================================================= */

  // MOCK ONLY — fake villagers. TODO(DB): delete this list, query real users instead.
  const MOCK_VILLAGERS = [
    'budiono', 'supri', 'ahmad', 'udin', 'yanto', 'suryati', 'wati',
    'sri', 'joko', 'slamet', 'tini', 'darmo', 'painem', 'mulyadi',
    'rina', 'hasan', 'siti', 'bambang', 'sutinah', 'wahyu',
  ];

  // Small deterministic PRNG so fake numbers stay the same all week for everyone.
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /**
   * @returns {{village:string, week_start:string, entries:{rank,name,books,isMe}[]}}
   * entries sorted by books desc, then name. The current user is included.
   */
  function getLeaderboard() {
    // TODO(DB): GET backend/leaderboard.php?village=bacaMaju  -> see SQL at bottom of file.
    const start = weekStart();
    const wk = dayKey(start);
    const me = (function () { try { return localStorage.getItem('desabaca_user'); } catch (e) { return null; } })() || 'Kamu';
    const myName = me.trim() || 'Kamu';

    const entries = MOCK_VILLAGERS
      .filter((n) => n !== myName.toLowerCase())
      .map((n) => {
        const r = mulberry32(hashString(wk + n))();
        // skewed so a few people read a lot (max 5) and most read 0-3 books
        return { name: titleCase(n), books: Math.floor(Math.pow(r, 1.6) * 6), isMe: false };
      });
    entries.push({ name: myName, books: weekBooks(), isMe: true });

    entries.sort((a, b) => b.books - a.books || a.name.localeCompare(b.name));
    // competition ranking: same score = same rank (1,2,2,4)
    entries.forEach((e, i) => { e.rank = i > 0 && e.books === entries[i - 1].books ? entries[i - 1].rank : i + 1; });
    return { village: VILLAGE_NAME, week_start: start.toISOString(), entries };
  }

  /* ===========================================================================
   * DEMO DATA (mockup helper, delete when DB is live)
   * ========================================================================= */
  function seedDemo() {
    const now = Date.now();
    const H = 3600 * 1000;
    const plan = [ // [hours ago, slug, type, chapter]
      [70, 'atomic_habits', 'open', 1], [69, 'atomic_habits', 'chapter_done', 1],
      [46, 'atomic_habits', 'open', 2], [45, 'atomic_habits', 'chapter_done', 2],
      [26, 'hujan', 'open', 1], [25, 'hujan', 'chapter_done', 1],
      [3, 'filosofi_teras', 'open', 1],
    ];
    write(KEYS.history, plan.map(([h, slug, type, chapter], i) =>
      ({ id: 'demo' + i, slug, type, chapter, at: new Date(now - h * H).toISOString() })));
    const iso = (h) => new Date(now - h * H).toISOString();
    write(KEYS.progress, {
      atomic_habits: { chapter: 3, done: [1, 2], progress: 33, status: 'reading', minutes: 30, first_read_at: iso(70), last_read_at: iso(45) },
      hujan: { chapter: 2, done: [1], progress: 17, status: 'reading', minutes: 15, first_read_at: iso(26), last_read_at: iso(25) },
      filosofi_teras: { chapter: 1, done: [], progress: 0, status: 'reading', minutes: 0, first_read_at: iso(3), last_read_at: iso(3) },
    });
    write(KEYS.bookmarks, [
      { slug: 'filosofi_teras', saved_at: iso(5) },
      { slug: 'hujan', saved_at: iso(30) },
    ]);
  }

  /* ---------------------------------------------------------------------------
   * Public API. Keep these names stable (see header).
   * ------------------------------------------------------------------------- */
  global.DesaBacaStore = {
    DATA_MODE, VILLAGE_NAME, MINUTES_PER_CHAPTER,
    getBooks, getBook,
    getBookmarks, isBookmarked, toggleBookmark,
    getProgress, getAllProgress, recordOpen, completeChapter,
    getHistory, clearHistory,
    getStats, getLeaderboard,
    seedDemo,
  };
})(window);

/* =============================================================================
 * PLANNED DATABASE SCHEMA (not executed anywhere yet — copy to database.sql
 * when moving off localStorage). Same block is in database.sql as a comment.
 * =============================================================================
 *
 * CREATE TABLE villages (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   name VARCHAR(80) NOT NULL UNIQUE            -- e.g. 'bacaMaju'
 * );
 * ALTER TABLE users ADD COLUMN village_id INT NULL,
 *   ADD FOREIGN KEY (village_id) REFERENCES villages(id);
 *
 * ALTER TABLE books ADD COLUMN chapters TINYINT UNSIGNED DEFAULT 6;
 *
 * ALTER TABLE reading_progress
 *   ADD COLUMN current_chapter TINYINT UNSIGNED DEFAULT 1,
 *   ADD COLUMN done_chapters VARCHAR(64) DEFAULT '',          -- '1,2,3'
 *   ADD COLUMN minutes_read INT UNSIGNED DEFAULT 0,
 *   ADD COLUMN status ENUM('reading','completed') DEFAULT 'reading',
 *   ADD COLUMN first_read_at TIMESTAMP NULL;
 *
 * CREATE TABLE reading_history (
 *   id BIGINT AUTO_INCREMENT PRIMARY KEY,
 *   user_id INT NOT NULL,
 *   book_id INT NOT NULL,
 *   event_type ENUM('open','chapter_done','finish') NOT NULL,
 *   chapter TINYINT UNSIGNED NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   INDEX idx_user_time (user_id, created_at),
 *   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
 * );
 *
 * -- Local leaderboard: books read this week per villager (same village only)
 * SELECT u.username, COUNT(DISTINCT h.book_id) AS books_this_week
 * FROM users u
 * JOIN villages v ON v.id = u.village_id AND v.name = 'bacaMaju'
 * LEFT JOIN reading_history h
 *        ON h.user_id = u.id
 *       AND h.event_type = 'open'
 *       AND h.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
 * GROUP BY u.id
 * ORDER BY books_this_week DESC, u.username ASC
 * LIMIT 20;
 * ========================================================================== */
