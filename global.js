// ==========================================
// 0. ROUTE GUARD (PENJAGA KEAMANAN HALAMAN)
// ==========================================
(function checkSecurity() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path === '/';
    const isSettingPage = path.endsWith('setting.html');
    const sessionString = localStorage.getItem('user_session');

    if (!sessionString && !isLoginPage) {
        window.location.replace('index.html');
    } 
    else if (sessionString && isLoginPage) {
        window.location.replace('menu.html');
    }

    if (sessionString && isSettingPage) {
        try {
            const user = JSON.parse(sessionString);
            if (!user.role || user.role.toLowerCase() !== 'creator') {
                window.location.replace('menu.html'); 
            }
        } catch(e) {
            localStorage.removeItem('user_session');
            window.location.replace('index.html');
        }
    }
})();

// ==========================================
// KREDENSIAL SUPABASE
// ==========================================
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 10 MENU LENGKAP WMS
// ==========================================
const APP_MENUS = [
    { id: 'dashboard', title: 'Dashboard Utama', icon: 'layout-dashboard', url: 'menu.html' },
    { isDivider: true, title: 'INBOUND' },
    { id: 'stbj', title: 'Scan STBJ', icon: 'shield-check', url: 'stbj.html' },
    { id: 'hasil_stbj', title: 'Hasil STBJ', icon: 'clipboard-list', url: 'hasil_stbj.html' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html' },
    { isDivider: true, title: 'INVENTORY' },
    { id: 'kartu_stok', title: 'Kartu Stok', icon: 'layers', url: 'kartu_stok.html' },
    { id: 'opname', title: 'Stock Opname', icon: 'clipboard-check', url: 'opname.html' },
    { isDivider: true, title: 'MUTASI' },
    { id: 'scan_pic', title: 'Scan PIC Area', icon: 'user-check', url: 'scan_pic.html' },
    { id: 'riwayat_mutasi', title: 'Riwayat Konversi', icon: 'arrow-right-left', url: 'riwayat_konversi.html' },
    { isDivider: true, title: 'OUTBOUND' },
    { id: 'po', title: 'PO & Estimasi', icon: 'clipboard-check', url: 'po.html' },
    { id: 'picking_list', title: 'Picking List', icon: 'clipboard-pen', url: 'picking_list.html' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html' },
    { isDivider: true, title: 'CONFIG' },
    { id: 'master_data', title: 'Master Data', icon: 'database', url: 'master_data.html' }
];

// ==========================================
// GLOBAL CSS & TABLE DESIGN SYSTEM
// ==========================================
const style = document.createElement('style');
style.innerHTML = `
    :root {
        --tbl-hdr-bg: #0f172a;
        --tbl-hdr-text: #ffffff;
        --tbl-row-1: 255, 255, 255;
        --tbl-row-2: 248, 250, 252;
        --tbl-row-hover: 241, 245, 249;
        --tbl-opacity: 1;
        --tbl-border: #e2e8f0;
    }

    .hide-scrollbar::-webkit-scrollbar { display: none; } 
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    body > div.absolute.inset-0 { padding-top: 0 !important; position: relative !important; height: 100% !important; }
    #app-sidebar { transition: width 0.3s ease, transform 0.3s ease; }
    
    @media (min-width: 640px) {
        #app-sidebar:not(.expanded) { width: 4.5rem !important; }
        #app-sidebar:not(.expanded) .sidebar-text { display: none !important; }
        #app-sidebar:not(.expanded) .sidebar-logo-text { display: none !important; }
        #app-sidebar:not(.expanded) .sidebar-item { justify-content: center !important; padding: 0 !important; width: 3rem !important; margin: 0 auto !important; }
        #app-sidebar:not(.expanded) .sidebar-divider { width: 2rem !important; margin: 0.5rem auto !important; }
        
        #app-sidebar.expanded { width: 16rem !important; }
        #app-sidebar.expanded .sidebar-text { display: block !important; }
        #app-sidebar.expanded .sidebar-logo-text { display: block !important; }
        #app-sidebar.expanded .sidebar-item { justify-content: flex-start !important; padding: 0 1rem !important; width: 100% !important; }
        #app-sidebar.expanded .sidebar-divider { width: 100% !important; padding: 0 1rem !important; text-align: left !important; background: transparent !important; height: auto !important; margin-top: 1rem !important; }
        #app-sidebar.expanded #btn-expand-container { justify-content: flex-end !important; padding-right: 1rem !important; }
    }
    
    @media (max-width: 639px) {
        #app-sidebar { width: 16rem !important; }
        .sidebar-text { display: block !important; }
        .sidebar-logo-text { display: block !important; }
        .sidebar-item { justify-content: flex-start !important; padding: 0 1rem !important; width: 100% !important; }
        .sidebar-divider { width: 100% !important; padding: 0 1rem !important; text-align: left !important; background: transparent !important; height: auto !important; margin-top: 1rem !important; }
    }

    .sidebar-item { position: relative; }
    .sidebar-tooltip {
        visibility: hidden; opacity: 0; position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
        margin-left: 10px; background-color: #1e293b; color: white; padding: 6px 12px; border-radius: 6px;
        font-size: 12px; font-weight: bold; white-space: nowrap; z-index: 100; transition: all 0.2s ease;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); pointer-events: none;
    }
    #app-sidebar:not(.expanded) .sidebar-item:hover .sidebar-tooltip { visibility: visible; opacity: 1; margin-left: 15px; }

    /* GLOBAL TABLE DESIGN CLASSES */
    .hdr-std { 
        background-color: var(--tbl-hdr-bg) !important; 
        color: var(--tbl-hdr-text) !important; 
        padding: 0.875rem 1rem !important; 
        font-size: 0.75rem !important; 
        font-weight: 600 !important; 
        text-transform: uppercase !important; 
        letter-spacing: 0.05em !important; 
        white-space: nowrap !important; 
        position: sticky !important; 
        top: 0 !important; 
        z-index: 20 !important; 
        border-bottom: 2px solid rgba(0,0,0,0.2) !important; 
        border-right: 1px solid rgba(255,255,255,0.1) !important; 
    }
    .hdr-std:last-child { border-right: none !important; }
    
    table { border-collapse: separate; border-spacing: 0; }
    td { border-right: 1px solid var(--tbl-border) !important; border-bottom: 1px solid var(--tbl-border) !important; }
    td:last-child { border-right: none !important; } 

    .stripe-1 td { background-color: rgba(var(--tbl-row-1), var(--tbl-opacity)) !important; transition: background-color 0.2s ease; }
    .stripe-2 td { background-color: rgba(var(--tbl-row-2), var(--tbl-opacity)) !important; transition: background-color 0.2s ease; }
    
    .stripe-1:hover td, .stripe-2:hover td, tr.text-row:hover td { background-color: rgba(var(--tbl-row-hover), 1) !important; }
    tr.selected-row td { background-color: #ccfbf1 !important; color: #0f766e !important; }

    /* REVISI: FREEZE PANE (STICKY COLUMN) CSS - DIBUAT SOLID AGAR TIDAK TUMPANG TINDIH */
    .sticky-col { position: sticky !important; left: 0 !important; z-index: 30 !important; }
    th.sticky-col { z-index: 40 !important; background-color: var(--tbl-hdr-bg) !important; }
    
    /* Pastikan warna background sticky column selalu solid (opacity 1) agar tidak tembus pandang */
    .stripe-1 td.sticky-col { background-color: rgb(var(--tbl-row-1)) !important; }
    .stripe-2 td.sticky-col { background-color: rgb(var(--tbl-row-2)) !important; }
    tr.text-row:hover td.sticky-col { background-color: rgb(var(--tbl-row-hover)) !important; }
    tr.selected-row td.sticky-col { background-color: #ccfbf1 !important; }
    
    /* Custom Range Slider */
    input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #4f46e5; cursor: pointer; margin-top: -6px; }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #cbd5e1; border-radius: 2px; }
`;
document.head.appendChild(style);

// LOAD PREFERENCES
const THEMES = {
    row: {
        gray: { r1: '255, 255, 255', r2: '248, 250, 252' },
        blue: { r1: '255, 255, 255', r2: '239, 246, 255' },
        green: { r1: '255, 255, 255', r2: '240, 253, 244' },
        amber: { r1: '255, 255, 255', r2: '255, 251, 235' },
        pink: { r1: '255, 255, 255', r2: '253, 242, 248' }
    },
    hover: {
        gray: '241, 245, 249',
        blue: '219, 234, 254',
        green: '220, 252, 231',
        amber: '254, 243, 199',
        pink: '252, 231, 243'
    }
};

let tempDesign = JSON.parse(localStorage.getItem('wms_table_design')) || {
    hdrBg: '#0f172a', hdrText: '#ffffff', rowTheme: 'gray', hoverTheme: 'gray', opacity: 100, isZebra: true
};

function applyTableDesign() {
    document.documentElement.style.setProperty('--tbl-hdr-bg', tempDesign.hdrBg);
    document.documentElement.style.setProperty('--tbl-hdr-text', tempDesign.hdrText);
    
    const rTheme = THEMES.row[tempDesign.rowTheme] || THEMES.row.gray;
    document.documentElement.style.setProperty('--tbl-row-1', rTheme.r1);
    document.documentElement.style.setProperty('--tbl-row-2', tempDesign.isZebra ? rTheme.r2 : rTheme.r1);
    
    const hTheme = THEMES.hover[tempDesign.hoverTheme] || THEMES.hover.gray;
    document.documentElement.style.setProperty('--tbl-row-hover', hTheme);
    
    document.documentElement.style.setProperty('--tbl-opacity', tempDesign.opacity / 100);
}
applyTableDesign();

async function initModernLayout(pageMeta) {
    const sessionString = localStorage.getItem('user_session');
    if (!sessionString) return; 
    
    const user = JSON.parse(sessionString);
    const initial = user.username.charAt(0).toUpperCase();
    
    const isExpanded = localStorage.getItem('sidebar_expanded') === 'true';
    const expandedClass = isExpanded ? 'expanded' : '';
    const expandIcon = isExpanded ? 'chevron-left' : 'chevron-right';

    let allowedMenus = [];
    try {
        const { data } = await db.from('menu_access').select('*');
        if(data) allowedMenus = data;
    } catch(e) { console.error("Gagal load menu access", e); }

    const filteredMenus = APP_MENUS.filter(menu => {
        if(menu.isDivider) return true; 
        const rule = allowedMenus.find(r => r.menu_id === menu.id);
        if(!rule) return true; 
        const allowedUsers = rule.allowed_users ? rule.allowed_users.split(',') : [];
        return allowedUsers.includes(user.username);
    });

    const finalMenus = [];
    for(let i=0; i<filteredMenus.length; i++) {
        const curr = filteredMenus[i];
        if(curr.isDivider) {
            if(i === filteredMenus.length - 1) continue; 
            if(filteredMenus[i+1].isDivider) continue; 
        }
        finalMenus.push(curr);
    }

    const originalNodes = Array.from(document.body.childNodes);
    document.body.innerHTML = ''; 

    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'flex h-[100dvh] bg-slate-100 overflow-hidden font-sans w-full';

    let sidebarHTML = `
        <aside id="app-sidebar" class="fixed sm:relative inset-y-0 left-0 z-[70] sm:z-40 bg-[#0f172a] flex flex-col py-4 transform -translate-x-full sm:translate-x-0 shadow-2xl sm:shadow-none border-r border-slate-800 shrink-0 ${expandedClass}">
            <a href="menu.html" class="mb-6 flex items-center justify-center gap-3 px-4 h-10 transition cursor-pointer overflow-hidden shrink-0">
                <div class="bg-white p-1 rounded-lg shrink-0 flex items-center justify-center w-10 h-10 shadow-md">
                    <img src="sunpevece.png" alt="Logo" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                </div>
                <span class="sidebar-logo-text text-white font-black text-lg tracking-wider whitespace-nowrap">SUNPEVECE</span>
            </a>
            <div class="flex flex-col gap-2 w-full px-3 overflow-y-auto hide-scrollbar flex-1">
    `;
    
    finalMenus.forEach(menu => {
        if (menu.isDivider) { 
            sidebarHTML += `<div class="sidebar-divider h-px bg-slate-700 my-1 text-[10px] font-black text-slate-400 uppercase tracking-widest overflow-hidden whitespace-nowrap"><span class="sidebar-text">${menu.title}</span></div>`; 
        } else {
            const isActive = pageMeta && menu.id === pageMeta.id;
            const bgClass = isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            sidebarHTML += `
                <a href="${menu.url}" data-title="${menu.title}" class="sidebar-item flex items-center h-10 rounded-xl transition-all cursor-pointer ${bgClass}">
                    <i data-lucide="${menu.icon}" class="w-5 h-5 shrink-0 pointer-events-none"></i>
                    <span class="sidebar-text ml-3 text-sm font-bold whitespace-nowrap pointer-events-none">${menu.title}</span>
                </a>
            `;
        }
    });
    
    sidebarHTML += `
            </div>
            <div id="btn-expand-container" class="mt-auto pt-4 px-3 w-full border-t border-slate-800 hidden sm:flex justify-center transition-all">
                <button onclick="toggleSidebarExpand()" class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer bg-slate-900 border border-slate-700 shadow-sm">
                    <i data-lucide="${expandIcon}" id="icon-expand-sidebar" class="w-5 h-5"></i>
                </button>
            </div>
        </aside>
        <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-slate-900/60 z-[60] hidden backdrop-blur-sm transition-opacity sm:hidden"></div>
    `;

    let rightArea = document.createElement('div');
    rightArea.className = 'flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden bg-slate-100';
    
    let headerHTML = `
        <header class="bg-white text-slate-800 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-slate-200 z-30 shrink-0 shadow-sm">
            <div class="flex items-center gap-4">
                <button onclick="toggleSidebar()" class="sm:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer">
                    <i data-lucide="menu" class="w-6 h-6"></i>
                </button>
                <div class="flex items-center gap-3">
                    <h1 class="text-base sm:text-lg font-black tracking-wide uppercase text-slate-800">${pageMeta ? pageMeta.title : 'WMS PORTAL'}</h1>
                </div>
            </div>
            <div class="flex items-center gap-3 sm:gap-5">
                <button onclick="bukaModalInbox()" class="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer" title="Pesan & Notifikasi">
                    <i data-lucide="mail" class="w-5 h-5"></i>
                    <span id="inbox-badge" class="hidden absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <div class="relative">
                    <button onclick="toggleProfileMenu()" class="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-full transition pr-3 cursor-pointer border border-transparent hover:border-slate-200">
                        <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-inner text-sm">${initial}</div>
                        <span class="text-xs font-black uppercase text-slate-700 hidden sm:block">${user.username}</span>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 hidden sm:block"></i>
                    </button>
                    <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-slate-800">
                        <div class="px-4 py-2 border-b border-slate-100 mb-1">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">Login sebagai</p>
                            <p class="text-sm font-black text-slate-800 truncate">${user.username}</p>
                        </div>
                        <a href="#" onclick="bukaModal('modal-password')" class="flex items-center gap-3 px-4 py-2.5 text-sm font-bold hover:bg-slate-50 transition cursor-pointer"><i data-lucide="key-round" class="w-4 h-4 text-slate-500"></i> Ganti Password</a>
                        <hr class="my-1 border-slate-100">
                        <a href="#" onclick="logout()" class="flex items-center gap-3 px-4 py-2.5 text-sm font-black text-red-600 hover:bg-red-50 transition cursor-pointer"><i data-lucide="log-out" class="w-4 h-4"></i> Logout</a>
                    </div>
                </div>
            </div>
        </header>
    `;

    rightArea.innerHTML = headerHTML;
    
    let mainContent = document.createElement('main');
    mainContent.className = 'flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100 relative';
    
    originalNodes.forEach(node => {
        if(node.nodeType === 1 && node.classList.contains('pt-[104px]')) {
            node.classList.remove('pt-[104px]');
            node.classList.remove('absolute');
            node.classList.remove('inset-0');
            node.classList.add('flex-1');
        }
        mainContent.appendChild(node);
    });
    
    rightArea.appendChild(mainContent);
    layoutWrapper.innerHTML = sidebarHTML;
    layoutWrapper.appendChild(rightArea);

    // ==========================================
    // 3. MODALS (PASSWORD, INBOX, TABLE DESIGN)
    // ==========================================
    const modalsHTML = `
        <div id="modal-password" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[90] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 text-slate-800">
                <h3 class="text-lg font-black mb-4 flex items-center gap-2"><i data-lucide="key-round" class="text-blue-600"></i> Ganti Password</h3>
                <input type="password" placeholder="Password Baru" class="w-full p-3 border border-slate-300 rounded-lg mb-5 font-bold outline-none focus:border-blue-600 bg-slate-50">
                <div class="flex gap-2">
                    <button onclick="tutupModal('modal-password')" class="w-1/2 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition">Batal</button>
                    <button onclick="tutupModal('modal-password'); alert('Fungsi ini akan segera disambungkan ke DB');" class="w-1/2 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-sm">Simpan</button>
                </div>
            </div>
        </div>

        <!-- MODAL TABLE DESIGN CUSTOMIZER -->
        <div id="modal-table-design" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[100] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 text-slate-800">
                <h3 class="text-lg font-black mb-1 flex items-center gap-2"><i data-lucide="palette" class="text-indigo-600"></i> Desain Tabel Global</h3>
                <p class="text-xs font-medium text-slate-500 mb-5">Pengaturan ini akan diterapkan ke seluruh tabel di WMS.</p>
                
                <div class="space-y-5 mb-6">
                    <label class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                        <span class="text-sm font-bold text-slate-700">Aktifkan Zebra Striping</span>
                        <input type="checkbox" id="td-zebra" class="w-5 h-5 accent-indigo-600 cursor-pointer">
                    </label>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Warna Header</label>
                        <div class="flex gap-3">
                            <button onclick="setTdColor('hdr', '#0f172a', '#ffffff')" id="btn-hdr-#0f172a" class="w-8 h-8 rounded-full bg-[#0f172a] flex items-center justify-center text-white transition hover:scale-110"></button>
                            <button onclick="setTdColor('hdr', '#1e3a8a', '#ffffff')" id="btn-hdr-#1e3a8a" class="w-8 h-8 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white transition hover:scale-110"></button>
                            <button onclick="setTdColor('hdr', '#064e3b', '#ffffff')" id="btn-hdr-#064e3b" class="w-8 h-8 rounded-full bg-[#064e3b] flex items-center justify-center text-white transition hover:scale-110"></button>
                            <button onclick="setTdColor('hdr', '#475569', '#ffffff')" id="btn-hdr-#475569" class="w-8 h-8 rounded-full bg-[#475569] flex items-center justify-center text-white transition hover:scale-110"></button>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Tema Belang (Row)</label>
                            <div class="flex flex-wrap gap-2">
                                <button onclick="setTdColor('rowTheme', 'gray')" id="btn-row-gray" class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('rowTheme', 'blue')" id="btn-row-blue" class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('rowTheme', 'green')" id="btn-row-green" class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('rowTheme', 'amber')" id="btn-row-amber" class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('rowTheme', 'pink')" id="btn-row-pink" class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 transition hover:scale-110"></button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Tema Hover</label>
                            <div class="flex flex-wrap gap-2">
                                <button onclick="setTdColor('hoverTheme', 'gray')" id="btn-hov-gray" class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('hoverTheme', 'blue')" id="btn-hov-blue" class="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('hoverTheme', 'green')" id="btn-hov-green" class="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center text-green-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('hoverTheme', 'amber')" id="btn-hov-amber" class="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-amber-600 transition hover:scale-110"></button>
                                <button onclick="setTdColor('hoverTheme', 'pink')" id="btn-hov-pink" class="w-6 h-6 rounded-full bg-pink-200 flex items-center justify-center text-pink-600 transition hover:scale-110"></button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                            <span>Opacity Warna Belang</span>
                            <span id="lbl-opacity" class="text-indigo-600">100%</span>
                        </label>
                        <input type="range" id="td-opacity" min="10" max="100" value="100" class="w-full" oninput="document.getElementById('lbl-opacity').innerText = this.value + '%'">
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="tutupModal('modal-table-design')" class="w-1/2 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">Batal</button>
                    <button onclick="saveTableDesign()" class="w-1/2 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-sm">Simpan</button>
                </div>
            </div>
        </div>
        
        <!-- MODAL INBOX BARU -->
        <div id="modal-inbox" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[100] px-2 sm:px-4 backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 text-slate-800 h-[85vh] flex flex-col overflow-hidden">
                <div class="p-4 sm:p-5 flex justify-between items-center border-b border-slate-200 bg-slate-50 shrink-0">
                    <h3 class="text-base font-black flex items-center gap-2 text-slate-800"><i data-lucide="mail" class="text-blue-600"></i> KOTAK PESAN (INBOX)</h3>
                    <button onclick="tutupModal('modal-inbox')" class="text-slate-400 hover:text-red-500 transition bg-white p-1.5 rounded-md border border-slate-200"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div id="inbox-view-list" class="flex-1 flex flex-col overflow-hidden">
                    <div class="p-3 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                        <button onclick="hapusPesanMassal()" class="px-4 py-2 bg-white border border-slate-300 text-rose-600 hover:bg-rose-50 font-bold rounded-md text-xs transition flex items-center gap-2 shadow-sm"><i data-lucide="trash-2" class="w-4 h-4"></i> Hapus</button>
                        <button onclick="bukaBuatPesan()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs transition flex items-center gap-2 shadow-sm"><i data-lucide="pen-square" class="w-4 h-4"></i> Buat Pesan</button>
                    </div>
                    <div class="flex-1 overflow-x-auto overflow-y-auto hide-scrollbar bg-slate-50">
                        <table class="w-full text-left border-collapse text-sm whitespace-nowrap">
                            <thead class="sticky top-0 z-10 bg-[#0f172a] text-white shadow-sm">
                                <tr>
                                    <th class="p-3 w-10 text-center"><input type="checkbox" onchange="toggleAllInbox(this.checked)" class="rounded text-blue-500 focus:ring-0 cursor-pointer"></th>
                                    <th class="p-3 font-semibold tracking-wider border-l border-slate-700 text-center">Tgl Pesan</th>
                                    <th class="p-3 font-semibold tracking-wider border-l border-slate-700 text-center">Pengirim</th>
                                    <th class="p-3 font-semibold tracking-wider border-l border-slate-700 w-1/2 text-center">Perihal</th>
                                    <th class="p-3 font-semibold tracking-wider border-l border-slate-700 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-inbox" class="text-slate-700 bg-white">
                                <tr><td colspan="5" class="p-10 text-center text-slate-400 font-bold">Sedang memuat pesan...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- VIEW 2 & 3 DISINGKAT UNTUK MENGHEMAT SPACE (TETAP ADA DI KODE ASLI) -->
            </div>
        </div>
    `;
    layoutWrapper.insertAdjacentHTML('beforeend', modalsHTML);
    document.body.appendChild(layoutWrapper);

    // Global Tooltip Logic
    const globalTooltip = document.createElement('div');
    globalTooltip.id = 'global-sidebar-tooltip';
    globalTooltip.className = 'fixed hidden bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-md shadow-xl z-[9999] pointer-events-none whitespace-nowrap transition-opacity duration-200 opacity-0 border border-slate-700';
    document.body.appendChild(globalTooltip);

    document.body.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item) {
            const sidebar = document.getElementById('app-sidebar');
            if (window.innerWidth >= 640 && sidebar && !sidebar.classList.contains('expanded')) {
                const rect = item.getBoundingClientRect();
                globalTooltip.innerText = item.getAttribute('data-title');
                globalTooltip.style.top = (rect.top + (rect.height / 2) - 16) + 'px';
                globalTooltip.style.left = (rect.right + 15) + 'px';
                
                globalTooltip.classList.remove('hidden');
                void globalTooltip.offsetWidth; 
                globalTooltip.classList.remove('opacity-0');
            }
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item) {
            globalTooltip.classList.add('opacity-0');
            setTimeout(() => {
                if(globalTooltip.classList.contains('opacity-0')) {
                    globalTooltip.classList.add('hidden');
                }
            }, 200);
        }
    });

    lucide.createIcons();
    setTimeout(cekNotifikasiInbox, 1000); 
}

// ==========================================
// FUNGSI UI & INTERAKSI
// ==========================================
window.toggleSidebar = function() { 
    document.getElementById('app-sidebar').classList.toggle('-translate-x-full'); 
    document.getElementById('sidebar-overlay').classList.toggle('hidden'); 
};

window.toggleSidebarExpand = function() {
    const sidebar = document.getElementById('app-sidebar');
    const icon = document.getElementById('icon-expand-sidebar');
    sidebar.classList.toggle('expanded');
    
    if(sidebar.classList.contains('expanded')) {
        localStorage.setItem('sidebar_expanded', 'true');
        icon.setAttribute('data-lucide', 'chevron-left');
    } else {
        localStorage.setItem('sidebar_expanded', 'false');
        icon.setAttribute('data-lucide', 'chevron-right');
    }
    lucide.createIcons();
};

window.toggleProfileMenu = function() { 
    document.getElementById('profile-dropdown').classList.toggle('hidden'); 
};

window.bukaModal = function(id) { 
    document.getElementById(id).classList.remove('hidden'); 
    document.getElementById('profile-dropdown').classList.add('hidden'); 
};

window.tutupModal = function(id) { 
    document.getElementById(id).classList.add('hidden'); 
};

window.logout = function() { 
    if(confirm('Yakin ingin keluar dari sistem?')) { 
        localStorage.removeItem('user_session'); 
        window.location.href = 'index.html'; 
    } 
};

document.addEventListener('click', (e) => { 
    const dropdown = document.getElementById('profile-dropdown'); 
    if (dropdown && !e.target.closest('.relative')) dropdown.classList.add('hidden'); 
});

// ==========================================
// FUNGSI TABLE DESIGN CUSTOMIZER
// ==========================================
window.bukaModalTableDesign = function() {
    document.getElementById('td-zebra').checked = tempDesign.isZebra;
    document.getElementById('td-opacity').value = tempDesign.opacity;
    document.getElementById('lbl-opacity').innerText = tempDesign.opacity + '%';
    updateDesignUI();
    bukaModal('modal-table-design');
};

window.setTdColor = function(type, val, text = null) {
    if(type === 'hdr') { tempDesign.hdrBg = val; tempDesign.hdrText = text; }
    if(type === 'rowTheme') tempDesign.rowTheme = val;
    if(type === 'hoverTheme') tempDesign.hoverTheme = val;
    updateDesignUI();
};

function updateDesignUI() {
    document.querySelectorAll('[id^="btn-hdr-"], [id^="btn-row-"], [id^="btn-hov-"]').forEach(btn => btn.innerHTML = '');
    
    const btnHdr = document.getElementById(`btn-hdr-${tempDesign.hdrBg}`);
    if(btnHdr) btnHdr.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
    
    const btnRow = document.getElementById(`btn-row-${tempDesign.rowTheme}`);
    if(btnRow) btnRow.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
    
    const btnHov = document.getElementById(`btn-hov-${tempDesign.hoverTheme}`);
    if(btnHov) btnHov.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
    
    lucide.createIcons();
}

window.saveTableDesign = function() {
    tempDesign.isZebra = document.getElementById('td-zebra').checked;
    tempDesign.opacity = document.getElementById('td-opacity').value;
    localStorage.setItem('wms_table_design', JSON.stringify(tempDesign));
    applyTableDesign();
    tutupModal('modal-table-design');
    
    if(typeof applyPagination === 'function') applyPagination();
};

// ==========================================
// FUNGSI SISTEM PESAN (INBOX BARU)
// ==========================================
let inboxDataGlobal = [];

async function cekNotifikasiInbox() {
    const user = JSON.parse(localStorage.getItem('user_session'));
    if(!user) return;

    try {
        const { count: msgCount } = await db.from('app_messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient', user.username)
            .eq('status', 'UNREAD');

        let reqCount = 0;
        const canApprove = user.role === 'Admin' || user.role === 'CS' || user.username.toLowerCase().includes('admin');
        if (canApprove) {
            const { count } = await db.from('request_ganti_customer')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'PENDING');
            reqCount = count || 0;
        }

        const totalUnread = (msgCount || 0) + reqCount;
        const badge = document.getElementById('inbox-badge');
        
        if (badge && totalUnread > 0) badge.classList.remove('hidden');
        else if (badge) badge.classList.add('hidden');
    } catch(e) { console.error("Gagal cek notif:", e); }
}

window.bukaModalInbox = async function() {
    tutupModal('profile-dropdown');
    document.getElementById('modal-inbox').classList.remove('hidden');
    
    document.getElementById('inbox-view-list').classList.remove('hidden');
    document.getElementById('inbox-view-read').classList.add('hidden');
    document.getElementById('inbox-view-compose').classList.add('hidden');
    
    await loadInboxData();
};

window.kembaliKeListInbox = function() {
    document.getElementById('inbox-view-list').classList.remove('hidden');
    document.getElementById('inbox-view-read').classList.add('hidden');
    document.getElementById('inbox-view-compose').classList.add('hidden');
    
    loadInboxData(); 
};

async function loadInboxData() {
    const tbody = document.getElementById('tbody-inbox');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i> Memuat pesan...</td></tr>';
    lucide.createIcons();

    const user = JSON.parse(localStorage.getItem('user_session'));
    let tempInbox = [];

    try {
        const { data: msgs, error: errMsgs } = await db.from('app_messages')
            .select('*')
            .eq('recipient', user.username)
            .order('created_at', { ascending: false });
        
        if(errMsgs) throw errMsgs;
        
        if(msgs) {
            msgs.forEach(m => {
                tempInbox.push({
                    id: m.id,
                    type: 'MESSAGE',
                    created_at: m.created_at,
                    sender: m.sender,
                    subject: m.subject,
                    body: m.body,
                    status: m.status
                });
            });
        }

        const canApprove = user.role === 'Admin' || user.role === 'CS' || user.username.toLowerCase().includes('admin');
        if (canApprove) {
            const { data: reqs, error: errReqs } = await db.from('request_ganti_customer')
                .select('*')
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });
            
            if(reqs) {
                reqs.forEach(r => {
                    tempInbox.push({
                        id: r.id,
                        type: 'REQ_CUSTOMER',
                        created_at: r.created_at,
                        sender: r.pic_request || 'Sistem',
                        subject: `Request Ganti Customer: ${r.qrcode}`,
                        body: `Pengajuan ganti customer untuk kardus:\n\nQR Code: ${r.qrcode}\nCustomer Lama: ${r.customer_awal}\nCustomer Baru (Request): ${r.customer_request}\nKeterangan: ${r.keterangan || '-'}`,
                        status: 'UNREAD', 
                        meta: r 
                    });
                });
            }
        }

        tempInbox.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        inboxDataGlobal = tempInbox;
        renderInboxTable();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`;
    }
}

function renderInboxTable() {
    const tbody = document.getElementById('tbody-inbox');
    
    if(inboxDataGlobal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400 font-bold"><i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Kotak pesan kosong.</td></tr>';
        lucide.createIcons();
        return;
    }

    let html = '';
    inboxDataGlobal.forEach((d, index) => {
        const dt = new Date(d.created_at);
        const tgl = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        
        const isUnread = d.status === 'UNREAD';
        const textClass = isUnread ? 'font-black text-slate-900' : 'font-medium text-slate-500';
        const badge = isUnread 
            ? '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">Baru</span>'
            : '<span class="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">Dibaca</span>';

        const iconType = d.type === 'REQ_CUSTOMER' ? '<i data-lucide="file-warning" class="w-4 h-4 text-orange-500 inline mr-1"></i>' : '';

        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition cursor-pointer group">
                <td class="p-3 text-center" onclick="event.stopPropagation()">
                    <input type="checkbox" value="${d.id}" data-type="${d.type}" class="cb-inbox rounded text-blue-500 focus:ring-0 cursor-pointer w-4 h-4 border-slate-300">
                </td>
                <td class="p-3 text-xs text-center ${textClass}" onclick="bacaPesan(${index})">${tgl}</td>
                <td class="p-3 text-sm text-center ${textClass}" onclick="bacaPesan(${index})">${d.sender}</td>
                <td class="p-3 text-sm text-center ${textClass} truncate max-w-[200px]" onclick="bacaPesan(${index})">${iconType}${d.subject}</td>
                <td class="p-3 text-center" onclick="bacaPesan(${index})">${badge}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    lucide.createIcons();
}

window.toggleAllInbox = function(checked) {
    document.querySelectorAll('.cb-inbox').forEach(cb => cb.checked = checked);
};

window.bacaPesan = async function(index) {
    const msg = inboxDataGlobal[index];
    if(!msg) return;

    const dt = new Date(msg.created_at);
    document.getElementById('read-subject').innerText = msg.subject;
    document.getElementById('read-sender').innerText = msg.sender;
    document.getElementById('read-date').innerText = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    document.getElementById('read-body').innerText = msg.body;

    const actionContainer = document.getElementById('read-action-container');
    actionContainer.innerHTML = '';
    actionContainer.classList.add('hidden');

    if (msg.type === 'REQ_CUSTOMER') {
        actionContainer.classList.remove('hidden');
        actionContainer.innerHTML = `
            <button onclick="terimaRequestPO(${msg.meta.id}, '${msg.meta.qrcode}', '${msg.meta.customer_request}')" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg shadow-sm transition flex items-center gap-2 text-sm">
                <i data-lucide="check-circle" class="w-4 h-4"></i> TERIMA REQUEST INI
            </button>
        `;
        lucide.createIcons();
    } 
    else if (msg.type === 'MESSAGE' && msg.status === 'UNREAD') {
        try {
            await db.from('app_messages').update({ status: 'READ' }).eq('id', msg.id);
            msg.status = 'READ'; 
            cekNotifikasiInbox(); 
        } catch(e) { console.error("Gagal update status read:", e); }
    }

    document.getElementById('inbox-view-list').classList.add('hidden');
    document.getElementById('inbox-view-read').classList.remove('hidden');
}

window.bukaBuatPesan = async function() {
    document.getElementById('inbox-view-list').classList.add('hidden');
    document.getElementById('inbox-view-compose').classList.remove('hidden');
    
    document.getElementById('compose-subject').value = '';
    document.getElementById('compose-body').value = '';
    
    const sel = document.getElementById('compose-recipient');
    sel.innerHTML = '<option value="">Memuat...</option>';
    
    try {
        const { data, error } = await db.from('app_users').select('username, role').order('username');
        if(error) throw error;
        
        const currentUser = JSON.parse(localStorage.getItem('user_session'));
        let html = '<option value="">-- Pilih Penerima --</option>';
        
        data.forEach(u => {
            if(u.username !== currentUser.username) {
                html += `<option value="${u.username}">${u.username} - ${u.role || 'User'}</option>`;
            }
        });
        sel.innerHTML = html;
    } catch(e) {
        sel.innerHTML = '<option value="">Gagal memuat user</option>';
    }
}

window.kirimPesan = async function() {
    const currentUser = JSON.parse(localStorage.getItem('user_session'));
    const recipient = document.getElementById('compose-recipient').value;
    const subject = document.getElementById('compose-subject').value.trim();
    const body = document.getElementById('compose-body').value.trim();

    if(!recipient) return alert("Pilih penerima pesan!");
    if(!subject) return alert("Perihal tidak boleh kosong!");
    if(!body) return alert("Isi pesan tidak boleh kosong!");

    const btn = document.getElementById('btn-kirim-pesan');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Mengirim...';
    btn.disabled = true;

    try {
        const { error } = await db.from('app_messages').insert([{
            sender: currentUser.username,
            recipient: recipient,
            subject: subject,
            body: body,
            status: 'UNREAD'
        }]);

        if(error) throw error;
        
        alert("Pesan berhasil dikirim!");
        kembaliKeListInbox();
    } catch(e) {
        alert("Gagal mengirim pesan: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
}

window.hapusPesanMassal = async function() {
    const checked = document.querySelectorAll('.cb-inbox:checked');
    if(checked.length === 0) return alert("Pilih pesan yang ingin dihapus!");
    
    if(!confirm(`Yakin ingin menghapus ${checked.length} pesan ini?`)) return;

    let idsMsg = [];
    let idsReq = [];

    checked.forEach(cb => {
        if(cb.getAttribute('data-type') === 'MESSAGE') idsMsg.push(cb.value);
        else if(cb.getAttribute('data-type') === 'REQ_CUSTOMER') idsReq.push(cb.value);
    });

    try {
        if(idsMsg.length > 0) {
            await db.from('app_messages').delete().in('id', idsMsg);
        }
        if(idsReq.length > 0) {
            await db.from('request_ganti_customer').update({ status: 'DITOLAK' }).in('id', idsReq);
        }
        
        alert("Pesan berhasil dihapus.");
        loadInboxData();
        cekNotifikasiInbox();
    } catch(e) {
        alert("Gagal menghapus pesan: " + e.message);
    }
}

window.terimaRequestPO = async function(idReq, qrcode, customerBaru) {
    if(!confirm(`Yakin ingin mengganti Customer untuk kardus ${qrcode} menjadi ${customerBaru}?`)) return;

    try {
        const { data: stokData, error: errStok } = await db.from('stok_qr').select('id_sku').eq('qrcode', qrcode).single();
        if(errStok || !stokData) throw new Error("Gagal mengambil kartu stok dari gudang (mungkin barang sudah keluar/terhapus).");

        let id_sku = stokData.id_sku;
        let parts = id_sku.split('_');
        
        if(parts.length >= 7) {
            parts[6] = customerBaru; 
        } else {
            parts[parts.length - 1] = customerBaru;
        }
        
        let sku_baru = parts.join('_'); 

        const { error: errUpdate } = await db.from('stok_qr').update({ id_sku: sku_baru }).eq('qrcode', qrcode);
        if(errUpdate) throw errUpdate;

        const { error: errReq } = await db.from('request_ganti_customer').update({ status: 'SELESAI' }).eq('id', idReq);
        if(errReq) throw errReq;

        alert("Request berhasil disetujui! Customer telah diganti.");
        kembaliKeListInbox(); 
        cekNotifikasiInbox(); 

    } catch(err) {
        alert("Gagal memproses persetujuan: " + err.message);
    }
}

