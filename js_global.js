  // --- KONFIGURASI SUPABASE ---
  const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co/rest/v1/';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
  const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let isPlafonInit = false;
  let isLisInit = false;
  let currentMenu = 'p'; // Variabel global untuk indikator menu

  function mulaiAplikasi() {
    document.getElementById('start-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    
    // Buka menu plafon pertama kali
    pindahMenu('plafon');
  }

  function pindahMenu(menu) {
    // 1. Atur tombol navigasi yang aktif
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-' + menu).classList.add('active');

    // 2. Sembunyikan semua template
    document.getElementById('template-plafon').style.display = 'none';
    document.getElementById('template-lis').style.display = 'none';
    document.getElementById('template-wpc').style.display = 'none';

    // 3. Tampilkan template yang dipilih
    document.getElementById('template-' + menu).style.display = 'block';
    
    // 4. Set global indicator untuk menu saat ini (Penting untuk d-pad keyboard)
    currentMenu = menu === 'plafon' ? 'p' : (menu === 'lis' ? 'l' : 'w');

    // 5. Load Data dari Supabase HANYA jika belum pernah di-load (agar tidak berat)
    if(menu === 'plafon' && !isPlafonInit) {
      initPlafon();
      isPlafonInit = true;
    }
    if(menu === 'lis' && !isLisInit) {
      initLis();
      isLisInit = true;
    }
  }

