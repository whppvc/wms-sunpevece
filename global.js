// ==========================================
// KREDENSIAL SUPABASE (JANGAN UBAH INI)
// ==========================================
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 10 MENU LENGKAP WMS
// ==========================================
const APP_MENUS = [
    { id: 'dashboard', title: 'Dashboard Utama', icon: 'layout-dashboard', url: 'menu.html' },
    { isDivider: true, title: 'INBOUND (MASUK)' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html' },
    { id: 'stbj', title: 'Scan STBJ', icon: 'shield-check', url: 'stbj.html' },
    { id: 'hasil_stbj', title: 'Hasil STBJ', icon: 'clipboard-list', url: 'hasil_stbj.html' },
    { isDivider: true, title: 'INVENTORY & AUDIT' },
    { id: 'kartu_stok', title: 'Kartu Stok & Mutasi', icon: 'layers', url: 'kartu_stok.html' },
    { id: 'riwayat_mutasi', title: 'Riwayat Mutasi', icon: 'arrow-right-left', url: 'riwayat_mutasi.html' },
    { id: 'opname', title: 'Stock Opname', icon: 'clipboard-check', url: 'opname.html' },
    { isDivider: true, title: 'OUTBOUND (KELUAR)' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html' }
];

// ==========================================
// SISTEM CSS TEMA MODULAR (SHARP, DARK, NUANCE)
// ==========================================
const style = document.createElement('style');
style.innerHTML = `
    /* CSS Standar Utilitas */
    .hide-scrollbar::-webkit-scrollbar { display: none; } 
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .hdr-std { background-color: #1e293b !important; color: #ffffff !important; text-align: center !important; border: 1px solid #334155; padding: 0.75rem; text-transform: uppercase; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; white-space: nowrap; }
    
    /* ----------------------------------------------------
       1. ATURAN BENTUK KOMPONEN UI (Shape)
       ---------------------------------------------------- */
    body.shape-sharp * { border-radius: 0px !important; }
    
    /* ----------------------------------------------------
       2. TRUE DARK MODE OVERRIDES (Mode Malam Gemini)
       ---------------------------------------------------- */
    body.base-dark, 
    body.base-dark div.bg-slate-50, 
    body.base-dark main { background-color: #0b1120 !important; color: #f1f5f9 !important; } /* Deep Dark Bg */
    
    body.base-dark .text-slate-800, body.base-dark .text-slate-700 { color: #f1f5f9 !important; } /* Teks Utama Putih */
    body.base-dark .text-slate-600, body.base-dark .text-slate-500, body.base-dark .text-slate-400 { color: #cbd5e1 !important; } /* Teks Sekunder Abu Terang */
    
    /* Ubah Kartu Putih & Sidebar menjadi Abu Gelap */
    body.base-dark .bg-white, body.base-dark aside { background-color: #111827 !important; border-color: #1f2937 !important; color: #f1f5f9 !important; }
    
    /* Input & Select di Mode Gelap */
    body.base-dark input, body.base-dark select { background-color: #1f2937 !important; border-color: #374151 !important; color: #ffffff !important; }
    body.base-dark .shadow-sm, body.base-dark .shadow-md, body.base-dark .shadow-xl, body.base-dark .shadow-2xl { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3) !important; }
    
    /* ----------------------------------------------------
       3. ATURAN NUANSA WARNA HEADER (Modular)
       ---------------------------------------------------- */
    
    /* --- Nuansa Biru Corporate --- */
    body.nuance-biru header.bg-\\[\\#0f172a\\], body.nuance-biru aside div.bg-\\[\\#0f172a\\] { background-color: #1e40af !important; border-color: #1e3a8a !important; }
    body.nuance-biru div.bg-\\[\\#1e293b\\] { background-color: #1e3a8a !important; border-bottom-color: #1e3a8a !important; }
    body.nuance-biru .bg-slate-800 { background-color: #2563eb !important; border-color: #1d4ed8 !important; text-white !important; }
    
    /* --- REVISI: Nuansa COOL (Watercolor Artistic Gradient) --- */
    /* Gradient Complex Cair: Teal -> Indigo -> Pink Magenta (Sense Buatan Tangan) */
    body.nuance-cool header.bg-\\[\\#0f172a\\], body.nuance-cool aside div.bg-\\[\\#0f172a\\] { background: linear-gradient(135deg, #14b8a6 0%, #4f46e5 50%, #ec4899 100%) !important; border: none !important; }
    body.nuance-cool div.bg-\\[\\#1e293b\\] { background-color: #4338ca !important; border-bottom: none !important; } /* Tab Bar Indigo Pekat */
    body.nuance-cool .bg-slate-800 { background-color: #d946ef !important; border-color: #c026d3 !important; text-white !important; } /* Menu Aktif Pink Terang */
    
    /* --- Nuansa Light (Putih Bersih) --- */
    body.nuance-light header.bg-\\[\\#0f172a\\], body.nuance-light aside div.bg-\\[\\#0f172a\\] { background-color: #ffffff !important; border-color: #e2e8f0 !important; }
    body.nuance-light header.bg-\\[\\#0f172a\\] * { color: #0f172a !important; } /* Teks Header jadi gelap */
    body.nuance-light div.bg-\\[\\#1e293b\\] { background-color: #f1f5f9 !important; border-bottom: 1px solid #cbd5e1 !important; }
    body.nuance-light div.bg-\\[\\#1e293b\\] div { color: #475569 !important; border-right: 1px solid #cbd5e1 !important; }
    body.nuance-light div.bg-\\[\\#1e293b\\] div.bg-slate-600 { background-color: #e2e8f0 !important; color: #0f172a !important; border-bottom: 2px solid #3b82f6 !important; }
    body.nuance-light .bg-slate-800 { background-color: #e2e8f0 !important; color: #0f172a !important; border-color: #cbd5e1 !important; }
    
    /* --- Nuansa Color (Gradient Energik Modern) ---Siaap, saya mengerti sepenuhnya kekecewaan Anda! Permintaan Anda sangat logis.

1.  **Dark Mode Masalah:** Kode sebelumnya hanya mengubah warna dasar *body*, tapi tidak menyentuh warna teks aplikasi dan *background* kartu-kartu konten, sehingga hasilnya berantakan (teks hitam di atas *background* gelap).
2.  **Mode "Cool" (Watercolor Artistic):** Anda ingin nuansa *gradient* yang artistik, cair, kaya warna, namun tetap elegan dan profesional, memberikan kesan artistik seperti lukisan cat air digital.

Saya telah merombak total sistem CSS TemaModular Anda untuk menangani hal ini. Saya menggunakan teknik *strong CSS Override* berbasis selektor kelas Tailwind (misalnya, `.bg-slate-50`, `.bg-white`, `.text-slate-800`) untuk memastikan pengaturan tema di `global.js` memaksa perubahan gaya tanpa merusak kerangka HTML Anda.

1.  **TRUE DARK MODE (Night):** Saya membuatkan sistem *CSS Override* yang kuat (`body.base-dark`). Jika Mode Gelap aktif, sistem akan memaksa seluruh *background* konten aplikasi menjadi Gelap Pekat (ala Gemini/Slack Dark), mengubah kartu putih menjadi abu gelap, dan membalik warna teks menjadi putih pekat/abu terang agar **mudah dibaca**.
2.  **NUANSA "COOL" (Watercolor Artistic Gradient):** Saya meracik *Complex Gradient* (perpaduan Teal, Indigo, dan Pink Magenta) yang terasa artistik, cair, dan kaya warna, diaplikasikan pada *header* dan bagian atas *sidebar*.

Silakan **Timpa Total (Replace All)** isi file `global.js` Anda dengan kode mutakhir di bawah ini. Kode ini tetap menjaga keamanan *Supabase credentials* Anda dan struktur menu yang sudah Anda buat.

```javascript
// ==========================================
// KREDENSIAL SUPABASE (JANGAN UBAH INI)
// ==========================================
const SUPABASE_URL = '[https://mjpqzftwbyrbvbvmarol.supabase.co](https://mjpqzftwbyrbvbvmarol.supabase.co)';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 10 MENU LENGKAP WMS
// ==========================================
const APP_MENUS = [
    { id: 'dashboard', title: 'Dashboard Utama', icon: 'layout-dashboard', url: 'menu.html' },
    { isDivider: true, title: 'INBOUND (MASUK)' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html' },
    { id: 'stbj', title: 'Scan STBJ', icon: 'shield-check', url: 'stbj.html' },
    { id: 'hasil_stbj', title: 'Hasil STBJ', icon: 'clipboard-list', url: 'hasil_stbj.html' },
    { isDivider: true, title: 'INVENTORY & AUDIT' },
    { id: 'kartu_stok', title: 'Kartu Stok & Mutasi', icon: 'layers', url: 'kartu_stok.html' },
    { id: 'riwayat_mutasi', title: 'Riwayat Mutasi', icon: 'arrow-right-left', url: 'riwayat_mutasi.html' },
    { id: 'opname', title: 'Stock Opname', icon: 'clipboard-check', url: 'opname.html' },
    { isDivider: true, title: 'OUTBOUND (KELUAR)' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html' }
];

// ==========================================
// SISTEM CSS TEMA MODULAR (SHARP, DARK, NUANCE)
// ==========================================
const style = document.createElement('style');
style.innerHTML = `
    /* CSS Standar Utilitas */
    .hide-scrollbar::-webkit-scrollbar { display: none; } 
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .hdr-std { background-color: #1e293b !important; color: #ffffff !important; text-align: center !important; border: 1px solid #334155; padding: 0.75rem; text-transform: uppercase; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; white-space: nowrap; }
    
    /* ----------------------------------------------------
       1. ATURAN BENTUK KOMPONEN UI (Shape)
       ---------------------------------------------------- */
    body.shape-sharp * { border-radius: 0px !important; }
    
    /* ----------------------------------------------------
       2. TRUE DARK MODE OVERRIDES (Mode Malam Gemini)
       ---------------------------------------------------- */
    /* Memaksa Background Body Utama & Container Slate-50 menjadi Gelap Pekat */
    body.base-dark, 
    body.base-dark div.bg-slate-50, 
    body.base-dark main[class*="bg-slate-50"] { background-color: #0b1120 !important; color: #f1f5f9 !important; }
    
    /* Membalikkan Warna Teks Slate Pekat menjadi Putih/Abu Terang */
    body.base-dark .text-slate-800, body.base-dark .text-slate-700 { color: #f1f5f9 !important; }
    body.base-dark .text-slate-600, body.base-dark .text-slate-400 { color: #cbd5e1 !important; }
    
    /* Ubah Kartu Putih (bg-white) menjadi Abu Gelap pekat agar konten menonjol */
    body.base-dark .bg-white, body.base-dark aside { background-color: #111827 !important; border-color: #1f2937 !important; color: #f1f5f9 !important; }
    
    /* Sidebar Overrides */
    body.base-dark aside { border-right-color: #1f2937 !important; }
    
    /* Shadow yang lebih gelap agar elegan di mode night */
    body.base-dark .shadow-sm, body.base-dark .shadow-md, body.base-dark .shadow-xl, body.base-dark .shadow-2xl { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3) !important; }
    
    /* Menjaga Nuansa Warna Header tetap aktif di Mode Gelap (Kecuali Light) */
    body.base-dark:not(.nuance-light) header { border-bottom-color: #1f293b !important; }
    
    /* Special Handling: Jika Mode Night + Nuansa Light aktif, Header harus tetap Gelap agar teks terbaca */
    body.base-dark.nuance-light header.bg-\\[\\#0f172a\\] { background-color: #1f2937 !important; border-bottom-color: #374151 !important; }
    body.base-dark.nuance-light header * { color: #f1f5f9 !important; }
    body.base-dark.nuance-light div.bg-\\[\\#1e293b\\] { background-color: #111827 !important; border-bottom-color: #374151 !important; }
    body.base-dark.nuance-light div.bg-\\[\\#1e293b\\] div { color: #f1f5f9 !important; border-right-color: #374151 !important; }
    body.base-dark.nuance-light div.bg-\\[\\#1e293b\\] div.bg-slate-600 { background-color: #1f2937 !important; }

    /* ----------------------------------------------------
       3. ATURAN NUANSA WARNA HEADER (Modular)
       ---------------------------------------------------- */
    
    /* --- Nuansa Biru Corporate (Tetap) --- */
    body.nuance-biru header.bg-\\[\\#0f172a\\], body.nuance-biru aside div.bg-\\[\\#0f172a\\] { background-color: #1e40af !important; border-color: #1e3a8a !important; }
    body.nuance-biru div.bg-\\[\\#1e293b\\] { background-color: #1e3a8a !important; border-bottom: none !important; }
    body.nuance-biru .bg-slate-800 { background-color: #2563eb !important; border-color: #1d4ed8 !important; color: #ffffff !important; }
    
    /* --- REVISI BARU: Nuansa COOL (Watercolor Artistic Gradient) --- */
    /* Gradient Complex Cair: Teal -> Indigo -> Pink Magenta (Sense Buatan Tangan/Hand-painted) */
    body.nuance-cool header.bg-\\[\\#0f172a\\], body.nuance-cool aside div.bg-\\[\\#0f172a\\] { background: linear-gradient(135deg, #14b8a6 0%, #4f46e5 50%, #ec4899 100%) !important; border: none !important; }
    body.nuance-cool div.bg-\\[\\#1e293b\\] { background-color: #4338ca !important; border-bottom: none !important; } /* Tab Bar Indigo Pekat */
    body.nuance-cool .bg-slate-800 { background-color: #d946ef !important; border-color: #c026d3 !important; color: #ffffff !important; } /* Menu Aktif Pink Terang */
    
    /* --- Nuansa Light (Putih Bersih) --- */
    body.nuance-light header.bg-\\[\\#0f172a\\], body.nuance-light aside div.bg-\\[\\#0f172a\\] { background-color: #ffffff !important; border-color: #e2e8f0 !important; }
    body.nuance-light header.bg-\\[\\#0f172a\\] * { color: #0f172a !important; } /* Teks logo/ikon jadi gelap */
    body.nuance-light div.bg-\\[\\#1e293b\\] { background-color: #f1f5f9 !important; border-bottom: 1px solid #cbd5e1 !important; }
    body.nuance-light div.bg-\\[\\#1e293b\\] div { color: #475569 !important; border-right: 1px solid #cbd5e1 !important; }
    body.nuance-light div.bg-\\[\\#1e293b\\] div.bg-slate-600 { background-color: #e2e8f0 !important; color: #0f172a !important; border-bottom: 2px solid #3b82f6 !important; }
    body.nuance-light .bg-slate-800 { background-color: #e2e8f0 !important; color: #0f172a !important; border-color: #cbd5e1 !important; }
    
    /* --- Nuansa Color (Gradient Energik Modern) --- */
    body.nuance-color header.bg-\\[\\#0f172a\\], body.nuance-color aside div.bg-\\[\\#0f172a\\] { background: linear-gradient(90deg, #6366f1, #a855f7) !important; border: none !important; }
    body.nuance-color div.bg-\\[\\#1e293b\\] { background-color: #4f46e5 !important; border-bottom: none !important; }
    body.nuance-color .bg-slate-800 { background-color: #ec4899 !important; color: #ffffff !important; border-color: #db2777 !important; }
`;
document.head.appendChild(style);

function initModernLayout(pageMeta) {
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'Staff'};
    
    // BACA Preferensi 3 Komponen Tema dari Local Storage
    const currentShape = localStorage.getItem('app_shape') || 'rounded'; // rounded, sharp
    const currentBg = localStorage.getItem('app_bg') || 'light';         // light, dark
    const currentNuance = localStorage.getItem('app_nuance') || 'gelap'; // gelap, biru, cool, light, color

    let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    if(!tabs.find(t => t.id === 'dashboard')) tabs.unshift({id: 'dashboard', title: 'DASHBOARD', url: 'menu.html'});
    if(pageMeta && !tabs.find(t => t.id === pageMeta.id)) { tabs.push(pageMeta); localStorage.setItem('wms_tabs', JSON.stringify(tabs)); }

    const originalNodes = Array.from(document.body.childNodes);
    document.body.innerHTML = ''; 

    const layoutWrapper = document.createElement('div');
    // Default Base (Nanti akan di-override jika Mode Night aktif)
    layoutWrapper.className = 'flex h-screen bg-slate-50 overflow-hidden font-sans';

    // SIDEBAR 
    let sidebarHTML = `
        <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform -translate-x-full transition-transform duration-300 flex flex-col shadow-2xl">
            <div class="flex items-center justify-between h-16 bg-[#0f172a] border-b border-slate-800 shadow-md px-4">
                <div class="flex items-center">
                    <img src="sunpevece.png" alt="Logo" class="h-8 object-contain mr-2" onerror="this.style.display='none'">
                    <span class="text-white font-black text-lg tracking-wider">SUNPEVECE</span>
                </div>
                <button onclick="toggleSidebar()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="overflow-y-auto flex-grow py-4 px-3 space-y-1">
    `;
    APP_MENUS.forEach(menu => {
        if (menu.isDivider) { sidebarHTML += `<div class="mt-4 mb-1 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">${menu.title}</div>`; } 
        else {
            const isActive = pageMeta && menu.id === pageMeta.id;
            const bgClass = isActive ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
            sidebarHTML += `<a href="${menu.url}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-bold text-sm ${bgClass}"><i data-lucide="${menu.icon}" class="w-5 h-5"></i><span>${menu.title}</span></a>`;
        }
    });
    sidebarHTML += `</div></aside><div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black/60 z-40 hidden backdrop-blur-sm transition-opacity"></div>`;

    // AREA KANAN (Top Bar + Konten)
    let rightArea = document.createElement('div');
    rightArea.className = 'flex-1 flex flex-col min-w-0 overflow-hidden';
    
    let tabsHTML = '';
    tabs.forEach(tab => {
        const isActive = pageMeta && tab.id === pageMeta.id;
        const bg = isActive ? 'bg-slate-600 text-white' : 'hover:bg-slate-800 text-slate-300 border-r border-slate-700';
        const closeBtn = tab.id === 'dashboard' ? '' : `<button onclick="closeGlobalTab(event, '${tab.id}', '${pageMeta ? pageMeta.id : ''}')" class="ml-2 hover:text-red-400 transition cursor-pointer"><i data-lucide="x" class="w-3 h-3"></i></button>`;
        tabsHTML += `<div onclick="window.location.href='${tab.url}'" class="flex items-center px-4 py-2.5 cursor-pointer transition whitespace-nowrap border-b-2 ${isActive ? 'border-white' : 'border-transparent'} ${bg} text-[11px] font-black tracking-wider uppercase"><span>${tab.title}</span>${closeBtn}</div>`;
    });

    let headerHTML = `
        <header class="bg-[#0f172a] text-white flex flex-col z-30 shadow-md">
            <div class="h-16 px-4 flex items-center justify-between border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <button onclick="toggleSidebar()" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition cursor-pointer"><i data-lucide="menu" class="w-6 h-6"></i></button>
                    <h1 class="text-lg font-black tracking-widest hidden sm:block">${pageMeta ? pageMeta.title : 'WMS PORTAL'}</h1>
                </div>
                
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <button onclick="toggleProfileMenu()" class="flex items-center gap-2 p-1 hover:bg-slate-800 rounded-full transition pr-3 cursor-pointer">
                            <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-inner border border-blue-500">${user.username.charAt(0).toUpperCase()}</div>
                            <div class="flex-col text-left hidden lg:flex"><span class="text-xs font-black uppercase leading-none">${user.username}</span></div>
                            <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400"></i>
                        </button>
                        <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-slate-800">
                            <a href="#" onclick="bukaModal('modal-password')" class="flex items-center gap-3 px-4 py-2.5 text-sm font-bold hover:bg-slate-100 transition cursor-pointer"><i data-lucide="key-round" class="w-4 h-4 text-slate-500"></i> Ganti Password</a>
                            <a href="#" onclick="bukaModal('modal-tema')" class="flex items-center gap-3 px-4 py-2.5 text-sm font-bold hover:bg-slate-100 transition cursor-pointer"><i data-lucide="palette" class="w-4 h-4 text-slate-500"></i> Pengaturan Tema</a>
                            <hr class="my-1 border-slate-200">
                            <a href="#" onclick="logout()" class="flex items-center gap-3 px-4 py-2.5 text-sm font-black text-red-600 hover:bg-red-50 transition cursor-pointer"><i data-lucide="log-out" class="w-4 h-4"></i> Logout</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="w-full bg-[#1e293b] flex overflow-x-auto hide-scrollbar border-b border-slate-800">${tabsHTML}</div>
        </header>
    `;

    rightArea.innerHTML = headerHTML;
    let mainContent = document.createElement('main');
    // Default Base Class
    mainContent.className = 'flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 md:p-6 pb-20';
    originalNodes.forEach(node => mainContent.appendChild(node));
    rightArea.appendChild(mainContent);

    layoutWrapper.innerHTML = sidebarHTML;
    layoutWrapper.appendChild(rightArea);

    const modalsHTML = `
        <div id="modal-password" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[90] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 text-slate-800">
                <h3 class="text-xl font-black mb-4 flex items-center gap-2"><i data-lucide="key-round" class="text-slate-600"></i> Ganti Password</h3>
                <input type="password" placeholder="Password Baru" class="w-full p-3 border border-slate-300 rounded mb-4 font-bold outline-none focus:border-slate-800">
                <div class="flex gap-2">
                    <button onclick="tutupModal('modal-password')" class="w-1/2 py-2.5 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300">Batal</button>
                    <button onclick="tutupModal('modal-password'); alert('Fungsi ini akan segera disambungkan ke DB');" class="w-1/2 py-2.5 bg-slate-800 text-white font-bold rounded hover:bg-slate-900">Simpan</button>
                </div>
            </div>
        </div>
        
        <div id="modal-tema" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[90] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 text-slate-800">
                <h3 class="text-xl font-black mb-4 flex items-center gap-2 border-b border-slate-200 pb-2"><i data-lucide="palette" class="text-blue-600"></i> Kustomisasi Tema WMS</h3>
                
                <div class="mb-4">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">1. Bentuk Shape UI</p>
                    <div class="flex gap-2">
                        <button onclick="setThemeProperty('app_shape', 'rounded')" class="flex-1 py-2 text-xs font-bold rounded-lg border-2 ${currentShape === 'rounded' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Melengkung</button>
                        <button onclick="setThemeProperty('app_shape', 'sharp')" class="flex-1 py-2 text-xs font-bold rounded-lg border-2 ${currentShape === 'sharp' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Sharp (Kotak)</button>
                    </div>
                </div>

                <div class="mb-4">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">2. Mode Dasar (Background)</p>
                    <div class="flex gap-2">
                        <button onclick="setThemeProperty('app_bg', 'light')" class="flex-1 py-2 text-xs font-bold rounded-lg border-2 ${currentBg === 'light' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Terang</button>
                        <button onclick="setThemeProperty('app_bg', 'dark')" class="flex-1 py-2 text-xs font-bold rounded-lg border-2 ${currentBg === 'dark' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Gelap (Night)</button>
                    </div>
                </div>

                <div class="mb-6">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">3. Nuansa Warna Header</p>
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="setThemeProperty('app_nuance', 'gelap')" class="py-2 text-xs font-bold rounded-lg border-2 ${currentNuance === 'gelap' ? 'bg-slate-800 text-white border-slate-900' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Gelap (Slate)</button>
                        <button onclick="setThemeProperty('app_nuance', 'biru')" class="py-2 text-xs font-bold rounded-lg border-2 ${currentNuance === 'biru' ? 'bg-blue-700 text-white border-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Biru Corp</button>
                        <button onclick="setThemeProperty('app_nuance', 'cool')" class="py-2 text-xs font-bold rounded-lg border-2 ${currentNuance === 'cool' ? 'bg-gradient-to-r from-teal-400 via-indigo-500 to-pink-500 text-white border-none' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">COOL (Watercolor)</button>
                        <button onclick="setThemeProperty('app_nuance', 'light')" class="py-2 text-xs font-bold rounded-lg border-2 ${currentNuance === 'light' ? 'bg-white text-slate-800 border-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Putih (Light)</button>
                        <button onclick="setThemeProperty('app_nuance', 'color')" class="col-span-2 py-2 text-xs font-bold rounded-lg border-2 ${currentNuance === 'color' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none' : 'bg-slate-50 border-slate-200 text-slate-600'} transition">Color (Energik)</button>
                    </div>
                </div>
                
                <button onclick="tutupModal('modal-tema')" class="w-full py-3 bg-slate-200 text-slate-700 font-black rounded-lg hover:bg-slate-300 transition">TUTUP PENGATURAN</button>
            </div>
        </div>
    `;
    layoutWrapper.insertAdjacentHTML('beforeend', modalsHTML);
    document.body.appendChild(layoutWrapper);
    
    // MENERAPKAN CLASS TEMA KE BODY SESUAI PILIHAN (INI KUNCI PERBAIKAN)
    
    // 1. Terapkan Mode Dasar (Terang/Gelap total)
    if(currentBg === 'dark') {
        document.body.classList.add('base-dark');
        // Override langsung warna text dan background default Tailwind agar tidak perlu reload
        layoutWrapper.className = 'flex h-screen bg-slate-950 overflow-hidden font-sans';
        mainContent.className = 'flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 p-4 md:p-6 pb-20';
    } else {
        document.body.classList.remove('base-dark');
    }
    
    // 2. Terapkan Bentuk (Shape)
    if(currentShape === 'sharp') document.body.classList.add('shape-sharp');
    else document.body.classList.remove('shape-sharp');
    
    // 3. Terapkan Nuansa Warna (Satu Nuansa saja yang aktif)
    // Hapus dulu nuance class yang mungkin menempel
    document.body.classList.forEach(className => { if(className.startsWith('nuance-')) document.body.classList.remove(className); });
    document.body.classList.add(`nuance-${currentNuance}`);
    
    lucide.createIcons();
}

// FUNGSI MODULAR UNTUK MENYIMPAN PREFERENSI TEMA
function setThemeProperty(key, value) {
    localStorage.setItem(key, value);
    // Reload halaman diperlukan karena Tailwind Utility Classes menempel keras di HTML String
    window.location.reload();
}

// Fungsi Standar Layout Toggles (Tetap)
function toggleSidebar() { document.getElementById('app-sidebar').classList.toggle('-translate-x-full'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); }
function toggleProfileMenu() { document.getElementById('profile-dropdown').classList.toggle('hidden'); }
function bukaModal(id) { document.getElementById(id).classList.remove('hidden'); toggleProfileMenu(); }
function tutupModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { if(confirm('Yakin ingin keluar?')) { localStorage.removeItem('user_session'); window.location.href = 'index.html'; } }
function closeGlobalTab(e, idToRemove, currentId) {
    e.stopPropagation(); let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    tabs = tabs.filter(t => t.id !== idToRemove); localStorage.setItem('wms_tabs', JSON.stringify(tabs));
    if(currentId === idToRemove) window.location.href = tabs[tabs.length-1].url; else window.location.reload(); 
}
// Tutup dropdown jika klik di luar
document.addEventListener('click', (e) => { const dropdown = document.getElementById('profile-dropdown'); if (dropdown && !e.target.closest('.relative')) dropdown.classList.add('hidden'); });
