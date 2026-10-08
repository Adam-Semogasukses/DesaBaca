const { createApp, ref, reactive } = Vue;

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  return res.json();
}

async function bootstrap() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  try {
    const [navbar, hero, ebooks, kategori, techFooter, authModal] = await Promise.all([
      fetch('components/navbar.html').then(r => r.text()),
      fetch('components/hero.html').then(r => r.text()),
      fetch('components/ebooks.html').then(r => r.text()),
      fetch('components/kategori.html').then(r => r.text()),
      fetch('components/techstack-footer.html').then(r => r.text()),
      fetch('components/auth-modal.html').then(r => r.text()),
    ]);
    appContainer.innerHTML = navbar + hero + ebooks + kategori + techFooter + authModal;
  } catch (e) {
    console.error('[Desa Baca] Component error:', e);
    return;
  }

  createApp({
    setup() {
      const isDark = ref(localStorage.getItem('desabaca_theme') !== 'light');
      const mobileMenuOpen = ref(false);
      const searchQuery = ref('');
      const activeSearch = ref('');
      const bookmarks = ref([]);
      const currentUser = ref('');
      const books = ref([]);

      const authModal = reactive({
        open:false, tab:'login', showPass:false,
        loginName:'', loginPass:'', regName:'', regPass:''
      });
      const toast = reactive({show:false,message:'',type:'success'});
      let toastTimer;

      const showToast = (message,type='success') => {
        toast.message=message; toast.type=type; toast.show=true;
        clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.show=false,3500);
      };
      window.showToast=showToast;

      const toggleTheme=()=>{
        isDark.value=!isDark.value;
        document.documentElement.classList.toggle('dark',isDark.value);
        localStorage.setItem('desabaca_theme',isDark.value?'dark':'light');
        showToast(isDark.value?'Beralih ke Mode Gelap':'Beralih ke Mode Putih Warm');
      };

      const doSearch=(query)=>{
        const q=(typeof query==='string'?query:searchQuery.value).trim();
        if(!q)return;
        searchQuery.value=q; activeSearch.value=q;
        document.getElementById('ebooks')?.scrollIntoView({behavior:'smooth'});
      };
      const clearSearch=()=>{searchQuery.value='';activeSearch.value='';};
      const focusSearch=()=>{
        const el=document.getElementById('heroBookSearch');
        el?.focus();el?.scrollIntoView({behavior:'smooth',block:'center'});
      };

      const openAuth=tab=>{authModal.tab=tab||'login';authModal.open=true;};
      const closeAuth=()=>authModal.open=false;
      const isBookmarked=id=>bookmarks.value.includes(id);

      /* MOCKUP: bookmark disimpan lewat DesaBacaStore (localStorage), tanpa login.
       * TODO(DB): saat database aktif, ubah js/store.js (bukan di sini). Guard login lama:
       *   if(!currentUser.value){openAuth('login');showToast('Login untuk menyimpan buku.','error');return;}
       * Endpoint lama (backend/bookmarks.php) tetap ada dan akan dipakai oleh store.js. */
      const loadBookmarks=()=>{ bookmarks.value=DesaBacaStore.getBookmarks().map(b=>b.slug); };
      const toggleBookmark=id=>{
        const now=DesaBacaStore.toggleBookmark(id);
        loadBookmarks();
        showToast(now?'Buku berhasil ditambahkan ke Bookmark!':'Buku dihapus dari Bookmark');
      };
      const openBook=slug=>{ window.location.href='baca.html?book='+encodeURIComponent(slug); };

      const handleLogin=async()=>{
        const r=await api('backend/auth.php?action=login',{method:'POST',
          body:JSON.stringify({name:authModal.loginName.trim(),password:authModal.loginPass})});
        if(!r.success){showToast(r.message||'Login gagal.','error');return;}
        currentUser.value=r.user.username;
        localStorage.setItem('desabaca_user',r.user.username);
        closeAuth(); await loadBookmarks();
        showToast(`Selamat datang kembali, ${r.user.username}!`);
      };

      const handleRegister=async()=>{
        const r=await api('backend/auth.php?action=register',{method:'POST',
          body:JSON.stringify({name:authModal.regName.trim(),password:authModal.regPass})});
        if(!r.success){showToast(r.message||'Pendaftaran gagal.','error');return;}
        currentUser.value=r.user.username;
        localStorage.setItem('desabaca_user',r.user.username);
        bookmarks.value=[]; closeAuth();
        showToast(`Akun berhasil dibuat! Selamat datang, ${r.user.username}`);
      };

      const handleSocial=()=>showToast('Login sosial belum diaktifkan pada versi kompetisi.','error');

      const loadSession=async()=>{
        try{
          const r=await api('backend/auth.php?action=me');
          if(r.logged_in){
            currentUser.value=r.user.username;
            localStorage.setItem('desabaca_user',r.user.username);
            await loadBookmarks();
          }else localStorage.removeItem('desabaca_user');
        }catch(e){console.warn('Session check failed',e);}
      };
      const loadBooks=async()=>{
        try{
          const r=await api('backend/books.php');
          if(r.success)books.value=r.books;
        }catch(e){console.warn('Books API not available (mockup mode)',e);}
      };

      loadBookmarks(); loadSession(); loadBooks();

      return {isDark,toggleTheme,mobileMenuOpen,searchQuery,activeSearch,doSearch,
        clearSearch,focusSearch,bookmarks,isBookmarked,toggleBookmark,currentUser,
        authModal,openAuth,closeAuth,handleLogin,handleRegister,handleSocial,toast,
        showToast,books,openBook};
    }
  }).mount('#app');
}
document.addEventListener('DOMContentLoaded',bootstrap);
