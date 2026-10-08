DESA BACA v4
============
Perubahan dari v3:
- Layout responsif & fleksibel (mobile / tablet / desktop):
    * Mobile (<768px): navigasi ikon ada di bawah layar (bottom bar), konten di atas.
    * Tablet (>=768px): rail ikon di kiri.
    * Desktop (>=1024px): sub-sidebar (Dashboard, Progres, Riwayat, Buku Tersimpan) muncul.
    * baca.html: <1280px teks di atas + Detail Buku di bawah; >=1280px dua kolom.
- Sidebar tidak ikut scroll: tinggi layout dikunci setinggi layar (h-[100dvh]) dan
  hanya <main> yang scroll (pola: root h-screen overflow-hidden + wrapper min-h-0 + main overflow-y-auto).
- Halaman Riwayat Baca, Buku Tersimpan, dan Leaderboard lokal (desa bacaMaju).
- Data masih MOCKUP di localStorage lewat js/store.js. Baca header file itu: berisi
  rencana migrasi ke database (endpoint, tabel, query SQL). Semua halaman harus
  mengakses data lewat window.DesaBacaStore saja.
