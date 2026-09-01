// ============================================================================
// WMS SUNPEVECE - GLOBAL SCRIPT, ROUTE GUARD & PERMISSION ACCESS CONTROL
// ============================================================================

// ==========================================
// 0. ROUTE GUARD AWAL (PENJAGA KEAMANAN SESI)
// ==========================================
(function checkSecurity() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
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
                alert("Akses Ditolak! Menu Pengaturan hanya dapat diakses oleh Creator.");
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
// DAFTAR MENU LENGKAP WMS
// ==========================================
const APP_MENUS = [
    { id: 'dashboard', title: 'Dashboard Utama', icon: 'layout-dashboard', url: 'menu.html', color: 'text-blue-500' },
    { isDivider: true, title: 'INBOUND' },
    { id: 'stbj', title: 'Scan STBJ', icon: 'shield-check', url: 'stbj.html', color: 'text-amber-500' },
    { id: 'hasil_stbj', title: 'Hasil STBJ', icon: 'clipboard-list', url: 'hasil_stbj.html', color: 'text-emerald-500' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html', color: 'text-purple-500' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html', color: 'text-slate-400' },
    { isDivider: true, title: 'INVENTORY' },
    { id: 'kartu_stok', title: 'Kartu Stok', icon: 'layers', url: 'kartu_stok.html', color: 'text-indigo-500' },
    { id: 'pencarian', title: 'Pencarian Item', icon: 'search', url: 'pencarian.html', color: 'text-pink-500' },
    { id: 'penyesuaian', title: 'Penyesuaian Stok', icon: 'sliders-horizontal', url: 'penyesuaian.html', color: 'text-orange-500' },
    { id: 'ganti_customer', title: 'Table Ganti Customer', icon: 'user-cog', url: 'ganti_customer.html', color: 'text-teal-500' },
    { id: 'req_konversi', title: 'Tabel Request Konversi', icon: 'replace', url: 'req_konversi.html', color: 'text-rose-500' },
    { id: 'input_opname', title: 'Input Stok Opname', icon: 'clipboard-check', url: 'input_opname.html', color: 'text-cyan-500' },
    { isDivider: true, title: 'PERPINDAHAN & PENYESUAIAN' }, 
    { id: 'stok_nonaktif', title: 'Stok Nonaktif', icon: 'package-x', url: 'stok_nonaktif.html', color: 'text-red-500' },
    { id: 'scan_pic', title: 'Scan PIC Area', icon: 'user-check', url: 'scan_pic.html', color: 'text-fuchsia-500' },
    { id: 'riwayat_mutasi', title: 'Riwayat Konversi', icon: 'arrow-right-left', url: 'riwayat_konversi.html', color: 'text-slate-400' },
    { isDivider: true, title: 'OUTBOUND' },
    { id: 'po', title: 'PO & Estimasi', icon: 'clipboard-check', url: 'po.html', color: 'text-blue-400' },
    { id: 'picking_list', title: 'Picking List', icon: 'clipboard-pen', url: 'picking_list.html', color: 'text-emerald-400' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html', color: 'text-amber-400' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html', color: 'text-slate-400' },
    { isDivider: true, title: 'REPORTS' },
    { id: 'reports', title: 'Laporan & Rekap', icon: 'bar-chart-3', url: 'reports.html', color: 'text-indigo-400' },
    { isDivider: true, title: 'PRINT LABEL' },
    { id: 'cetak_label', title: 'Cetak Label Barcode', icon: 'printer', url: 'cetak_label.html', color: 'text-purple-400' },
    { id: 'print_khusus', title: 'Cetak Label Khusus', icon: 'qr-code', url: 'print_khusus.html', color: 'text-pink-400' },
    { id: 'riwayat_cetak', title: 'Riwayat Cetak Label', icon: 'scroll-text', url: 'riwayat_cetak.html', color: 'text-slate-400' },
    { isDivider: true, title: 'CONFIG' },
    { id: 'master_data', title: 'Master Data', icon: 'database', url: 'master_data.html', color: 'text-teal-400' }
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
    
    body:not(.disable-hover) .stripe-1:hover td, 
    body:not(.disable-hover) .stripe-2:hover td, 
    body:not(.disable-hover) tr.text-row:hover td,
    body:not(.disable-hover) tr.r-row:hover td { background-color: rgba(var(--tbl-row-hover), 1) !important; }
    
    tr.selected-row td { background-color: #ccfbf1 !important; color: #0f766e !important; }

    .sticky-col { position: sticky !important; left: 0 !important; z-index: 30 !important; }
    th.sticky-col { z-index: 40 !important; background-color: var(--tbl-hdr-bg) !important; }
    
    .stripe-1 td.sticky-col { background-color: rgb(var(--tbl-row-1)) !important; }
    .stripe-2 td.sticky-col { background-color: rgb(var(--tbl-row-2)) !important; }
    body:not(.disable-hover) tr.text-row:hover td.sticky-col,
    body:not(.disable-hover) tr.r-row:hover td.sticky-col { background-color: rgb(var(--tbl-row-hover)) !important; }
    tr.selected-row td.sticky-col { background-color: #ccfbf1 !important; }
    
    input[type=range]:not(.custom-vertical-slider) { -webkit-appearance: none; width: 100%; background: transparent; }
    input[type=range]:not(.custom-vertical-slider)::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #4f46e5; cursor: pointer; margin-top: -6px; }
    input[type=range]:not(.custom-vertical-slider)::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #cbd5e1; border-radius: 2px; }

    @keyframes slideDownFade {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .menu-grid-item { animation: slideDownFade 0.3s ease-out forwards; }
`;
document.head.appendChild(style);

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
    hdrBg: '#0f172a', hdrText: '#ffffff', rowTheme: 'gray', hoverTheme: 'gray', opacity: 100, isZebra: true, isHover: true
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

    const runToggle = () => {
        if(tempDesign.isHover === false) {
            document.body.classList.add('disable-hover');
        } else {
            document.body.classList.remove('disable-hover');
        }
    };

    if(document.body) {
        runToggle();
    } else {
        document.addEventListener('DOMContentLoaded', runToggle);
    }
}
applyTableDesign();

// ==========================================
// INISIALISASI MODERN LAYOUT
// ==========================================
async function initModernLayout(pageMeta) {
    const sessionString = localStorage.getItem('user_session');
    if (!sessionString) return; 
    
    const user = JSON.parse(sessionString);
    const initial = user.username.charAt(0).toUpperCase();
    const isCreator = user.role && user.role.toLowerCase() === 'creator';

    let allowedMenus = [];
    try {
        const { data, error } = await db.from('menu_access').select('*');
        if(!error && data) allowedMenus = data;
    } catch(e) { console.error("Gagal load menu access", e); }

    if (pageMeta && pageMeta.id && pageMeta.id !== 'dashboard') {
        const pageRule = allowedMenus.find(r => r.menu_id === pageMeta.id);
        if (pageRule && !isCreator) {
            const allowedUsers = pageRule.allowed_users ? pageRule.allowed_users.split(',').map(u => u.trim()) : [];
            if (!allowedUsers.includes(user.username)) {
                alert(`⛔ AKSES DITOLAK!\n\nAkun Anda (${user.username}) tidak memiliki izin untuk membuka menu "${pageMeta.title}".`);
                window.location.replace('menu.html');
                return;
            }
        }
    }

    const filteredMenus = APP_MENUS.filter(menu => {
        if(menu.isDivider) return true; 
        if(isCreator) return true;

        const rule = allowedMenus.find(r => r.menu_id === menu.id);
        if(!rule) return true; 
        
        const allowedUsers = rule.allowed_users ? rule.allowed_users.split(',').map(u => u.trim()) : [];
        return allowedUsers.includes(user.username);
    });

    let groupedMenus = {};
    let currentGroup = 'MAIN';
    filteredMenus.forEach(m => {
        if(m.isDivider) {
            currentGroup = m.title;
        } else {
            if(!groupedMenus[currentGroup]) groupedMenus[currentGroup] = [];
            groupedMenus[currentGroup].push(m);
        }
    });

    const originalNodes = Array.from(document.body.childNodes);
    document.body.innerHTML = ''; 

    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'flex flex-col h-[100dvh] bg-slate-100 overflow-hidden font-sans w-full';

    let headerHTML = `
        <header class="bg-[#0f172a] text-white flex items-center justify-between h-16 px-4 sm:px-6 border-b border-slate-800 z-30 shrink-0 shadow-md">
            
            <div class="flex items-center gap-4 w-1/3">
                <button onclick="toggleGridMenu()" class="flex items-center gap-3 hover:bg-slate-800 p-1.5 pr-4 rounded-xl transition cursor-pointer group">
                    <div class="bg-white p-1 rounded-lg shrink-0 flex items-center justify-center w-9 h-9 shadow-sm group-hover:scale-105 transition-transform">
                        <img src="sunpevece.png" alt="Logo" class="w-7 h-7 object-contain" onerror="this.style.display='none'">
                    </div>
                    <div class="flex flex-col items-start">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">WMS Menu</span>
                        <h1 class="text-sm sm:text-base font-black tracking-wide uppercase text-white leading-none group-hover:text-blue-400 transition-colors">${pageMeta ? pageMeta.title : 'PORTAL'} <i data-lucide="chevron-down" class="inline w-4 h-4 opacity-50"></i></h1>
                    </div>
                </button>
            </div>

            <div id="favorite-menus-container" class="hidden sm:flex items-center justify-center gap-2 w-1/3"></div>

            <div class="flex items-center justify-end gap-3 sm:gap-5 w-1/3">
                <button onclick="bukaModalInbox()" class="relative p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer" title="Pesan & Notifikasi">
                    <i data-lucide="mail" class="w-5 h-5"></i>
                    <span id="inbox-badge" class="hidden absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f172a]"></span>
                </button>
                <div class="relative">
                    <button onclick="toggleProfileMenu()" class="flex items-center gap-2 p-1 hover:bg-slate-800 rounded-full transition pr-3 cursor-pointer border border-transparent hover:border-slate-700">
                        <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-inner text-sm border border-blue-400">${initial}</div>
                        <span class="text-xs font-black uppercase text-slate-200 hidden sm:block">${user.username}</span>
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

    layoutWrapper.innerHTML = headerHTML;
    
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
    
    layoutWrapper.appendChild(mainContent);

    let gridMenuHTML = `
        <div id="modal-grid-menu" class="hidden fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md overflow-y-auto custom-scroll transition-opacity">
            <div class="min-h-screen p-4 sm:p-6 flex flex-col max-w-6xl mx-auto w-full">
                
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-slate-700 gap-4">
                    <h2 class="text-xl font-black text-white flex items-center gap-3"><i data-lucide="layout-grid" class="text-blue-500 w-6 h-6"></i> MENU NAVIGASI</h2>
                    
                    <div class="flex items-center gap-3 w-full sm:w-auto">
                        <div class="relative flex-1 sm:w-64">
                            <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-slate-400"></i>
                            <input type="text" oninput="filterMegaMenu(this.value)" class="w-full pl-9 p-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white outline-none focus:border-blue-500 transition" placeholder="Cari menu...">
                        </div>
                        <button onclick="closeGridMenu()" class="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition cursor-pointer shrink-0"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                </div>
                
                <div class="flex flex-col gap-6 pb-10">
    `;

    let delayDelay = 0;
    for (let group in groupedMenus) {
        if (groupedMenus[group].length === 0) continue;
        
        gridMenuHTML += `
            <div class="mega-menu-group">
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1 border-l-2 border-blue-500">${group}</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        `;

        groupedMenus[group].forEach(menu => {
            const isActive = pageMeta && menu.id === pageMeta.id;
            const bgClass = isActive ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500';
            const textClass = isActive ? 'text-white' : 'text-slate-200 group-hover:text-white';
            const iconColor = menu.color || 'text-slate-400';
            const iconClass = isActive ? 'text-white' : `${iconColor} group-hover:text-white`;

            gridMenuHTML += `
                <a href="${menu.url}" data-title="${menu.title}" class="menu-grid-item group flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all duration-300 cursor-pointer ${bgClass}" style="animation-delay: ${delayDelay}ms">
                    <i data-lucide="${menu.icon}" class="w-6 h-6 sm:w-8 sm:h-8 mb-2 transition-colors ${iconClass}"></i>
                    <span class="text-[10px] sm:text-xs font-bold text-center leading-tight transition-colors ${textClass}">${menu.title}</span>
                </a>
            `;
            delayDelay += 15;
        });

        gridMenuHTML += `</div></div>`;
    }

    gridMenuHTML += `</div></div></div>`;

    const favModalHTML = `
        <div id="modal-fav-menus" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[110] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 text-slate-800 flex flex-col max-h-[85vh]">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 shrink-0">
                    <h3 class="text-base font-black flex items-center gap-2 text-blue-700"><i data-lucide="star" class="w-5 h-5"></i> Atur Menu Favorit</h3>
                    <button onclick="tutupModal('modal-fav-menus')" class="text-slate-400 hover:text-red-500 bg-slate-100 p-1.5 rounded-lg transition"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <p class="text-xs font-bold text-slate-500 mb-4 shrink-0">Pilih maksimal 7 menu untuk ditampilkan sebagai tombol cepat di header atas.</p>
                
                <div class="flex-1 overflow-y-auto custom-scroll pr-2 space-y-4 mb-4">
                    ${Object.keys(groupedMenus).map(group => `
                        <div>
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">${group}</h4>
                            <div class="flex flex-col gap-1.5">
                                ${groupedMenus[group].map(m => `
                                    <label class="flex items-center gap-3 p-2 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition">
                                        <input type="checkbox" value="${m.id}" onchange="limitFavSelection(this)" class="cb-fav w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500">
                                        <span class="text-xs font-bold text-slate-700 flex items-center gap-2"><i data-lucide="${m.icon}" class="w-4 h-4 ${m.color || 'text-slate-400'}"></i> ${m.title}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="flex gap-2 shrink-0 pt-3 border-t border-slate-100">
                    <button onclick="tutupModal('modal-fav-menus')" class="w-1/3 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition text-xs uppercase">Batal</button>
                    <button onclick="saveFavMenus()" class="w-2/3 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-sm text-xs uppercase flex justify-center items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Simpan Pilihan</button>
                </div>
            </div>
        </div>
    `;

    const modalsHTML = gridMenuHTML + favModalHTML + `
        <div id="modal-password" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[110] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 text-slate-800">
                <h3 class="text-lg font-black mb-4 flex items-center gap-2"><i data-lucide="key-round" class="text-blue-600"></i> Ganti Password</h3>
                <input type="password" placeholder="Password Baru" class="w-full p-3 border border-slate-300 rounded-lg mb-5 font-bold outline-none focus:border-blue-600 bg-slate-50">
                <div class="flex gap-2">
                    <button onclick="tutupModal('modal-password')" class="w-1/2 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition">Batal</button>
                    <button onclick="tutupModal('modal-password'); alert('Fungsi ini akan segera disambungkan ke DB');" class="w-1/2 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-sm">Simpan</button>
                </div>
            </div>
        </div>

        <div id="modal-table-design" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[110] px-4 backdrop-blur-sm">
            <div class="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 text-slate-800">
                <h3 class="text-lg font-black mb-1 flex items-center gap-2"><i data-lucide="palette" class="text-indigo-600"></i> Desain Tabel WMS</h3>
                <p class="text-xs font-medium text-slate-500 mb-5">Pengaturan ini akan diterapkan ke seluruh tabel di WMS.</p>
                
                <div class="space-y-5 mb-6">
                    <label class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                        <span class="text-sm font-bold text-slate-700">Aktifkan Zebra Striping</span>
                        <input type="checkbox" id="td-zebra" class="w-5 h-5 accent-indigo-600 cursor-pointer">
                    </label>

                    <label class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                        <span class="text-sm font-bold text-slate-700">Aktifkan Efek Hover Baris</span>
                        <input type="checkbox" id="td-hover" class="w-5 h-5 accent-indigo-600 cursor-pointer">
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
        
        <div id="modal-inbox" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[110] px-2 sm:px-4 backdrop-blur-sm">
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
                
                <div id="inbox-view-read" class="hidden flex-1 flex flex-col overflow-hidden bg-slate-50">
                    <div class="p-3 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
                        <button onclick="kembaliKeListInbox()" class="p-2 hover:bg-slate-100 text-slate-600 rounded-md transition"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                        <h4 class="font-black text-slate-800 text-sm truncate" id="read-subject">Subjek Pesan</h4>
                    </div>
                    <div class="p-4 sm:p-6 overflow-y-auto custom-scroll flex-1">
                        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <div class="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg"><i data-lucide="user" class="w-5 h-5"></i></div>
                                    <div>
                                        <p class="font-bold text-slate-800 text-sm" id="read-sender">Pengirim</p>
                                        <p class="text-xs font-medium text-slate-500" id="read-date">Tanggal</p>
                                    </div>
                                </div>
                            </div>
                            <div class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium" id="read-body">Isi pesan...</div>
                            <div id="read-action-container" class="mt-6 pt-4 border-t border-slate-100 hidden"></div>
                        </div>
                    </div>
                </div>

                <div id="inbox-view-compose" class="hidden flex-1 flex flex-col overflow-hidden bg-slate-50">
                    <div class="p-3 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
                        <button onclick="kembaliKeListInbox()" class="p-2 hover:bg-slate-100 text-slate-600 rounded-md transition"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                        <h4 class="font-black text-slate-800 text-sm">Tulis Pesan Baru</h4>
                    </div>
                    <div class="p-4 sm:p-6 overflow-y-auto custom-scroll flex-1">
                        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Kepada</label>
                                <select id="compose-recipient" class="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-semibold text-sm bg-slate-50 cursor-pointer"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Perihal</label>
                                <input type="text" id="compose-subject" class="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold text-sm bg-slate-50" placeholder="Judul pesan...">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Isi Pesan</label>
                                <textarea id="compose-body" rows="8" class="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-medium text-sm bg-slate-50 custom-scroll" placeholder="Tulis pesan Anda di sini..."></textarea>
                            </div>
                            <div class="flex justify-end pt-2">
                                <button onclick="kirimPesan()" id="btn-kirim-pesan" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-sm transition flex items-center gap-2 text-sm"><i data-lucide="send" class="w-4 h-4"></i> Kirim Pesan</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    layoutWrapper.insertAdjacentHTML('beforeend', modalsHTML);
    document.body.appendChild(layoutWrapper);

    lucide.createIcons();
    renderFavMenus(); 
    setTimeout(cekNotifikasiInbox, 1000); 

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeGridMenu();
            tutupModal('modal-password');
            tutupModal('modal-table-design');
            tutupModal('modal-inbox');
            tutupModal('modal-fav-menus');
        }
    });
}

// ==========================================
// ENGINE KOMPONEN DINAMIS (TABS & FOOTER)
// ==========================================
window.renderSubmenuTabs = function(containerId, tabsArray, activeTabId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    let html = '<div class="flex border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar">';
    tabsArray.forEach(t => {
        const cls = (t.id === activeTabId) ? activeClass : inactiveClass;
        const hiddenCls = t.mobileOnly ? 'sm:hidden ' : '';
        html += `<button onclick="${t.onClick}" id="${t.id}" class="${hiddenCls}${cls}"><i data-lucide="${t.icon}" class="w-4 h-4"></i> ${t.label}</button>`;
    });
    html += '</div>';
    
    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.renderTableFooter = function(containerId, labelQty = "Total Qty (Dus)") {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center gap-4 w-full md:w-1/3">
            <div class="flex-1 flex flex-col items-center bg-blue-50 border border-blue-200 py-1.5 rounded-lg">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Tampil Baris</span>
                <span id="lbl-tampil-baris" class="text-xl font-bold text-blue-600 leading-none mt-0.5">0</span>
            </div>
            <div class="flex-1 flex flex-col items-center bg-amber-50 border border-amber-200 py-1.5 rounded-lg">
                <span class="text-[10px] font-bold text-slate-500 uppercase">${labelQty}</span>
                <span id="lbl-total-qty" class="text-xl font-bold text-amber-600 leading-none mt-0.5">0</span>
            </div>
            <div class="flex-1 flex flex-col items-center bg-emerald-50 border border-emerald-200 py-1.5 rounded-lg">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Baris Dipilih</span>
                <span id="lbl-pilih-baris" class="text-xl font-bold text-emerald-600 leading-none mt-0.5">0</span>
            </div>
        </div>
        
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 bg-white border border-slate-300 p-1.5 rounded-lg shadow-sm">
                <span class="text-xs font-bold text-slate-500 uppercase px-2">Baris per hal:</span>
                <select id="select-rows-per-page" onchange="changeRowsPerPage(this.value)" class="text-sm font-black text-blue-700 bg-blue-50 border border-blue-200 rounded outline-none cursor-pointer px-2 py-1 transition">
                    <option value="10" selected>10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="ALL">Semua</option>
                </select>
            </div>
            
            <div class="flex items-center gap-1 bg-white border border-slate-300 p-1.5 rounded-lg shadow-sm">
                <button onclick="prevPage()" class="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs uppercase rounded hover:bg-slate-200 active:scale-95 transition">Prev</button>
                
                <div class="flex items-center px-2 gap-2">
                    <span class="text-xs font-bold text-slate-500 uppercase">Hal</span>
                    <input type="number" id="input-page-jump" onchange="jumpToPage(this.value)" class="w-14 text-center p-1 border border-slate-300 rounded font-black text-blue-700 outline-none focus:border-blue-500 bg-slate-50" value="1" min="1">
                    <span class="text-xs font-bold text-slate-500 uppercase">dari <span id="lbl-total-halaman" class="text-slate-800 font-black">1</span></span>
                </div>

                <button onclick="nextPage()" class="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs uppercase rounded hover:bg-slate-200 active:scale-95 transition">Next</button>
            </div>
        </div>
    `;
};

// ==========================================
// LOGIKA MENU FAVORIT
// ==========================================
window.openFavMenuModal = function() {
    const user = JSON.parse(localStorage.getItem('user_session'));
    const saved = localStorage.getItem('fav_menus_' + user.username);
    const favArray = saved ? JSON.parse(saved) : [];

    document.querySelectorAll('.cb-fav').forEach(cb => {
        cb.checked = favArray.includes(cb.value);
    });

    document.getElementById('modal-fav-menus').classList.remove('hidden');
};

window.limitFavSelection = function(cb) {
    const checked = document.querySelectorAll('.cb-fav:checked');
    if (checked.length > 7) {
        cb.checked = false;
        alert('Maksimal hanya 7 menu favorit yang diizinkan!');
    }
};

window.saveFavMenus = function() {
    const user = JSON.parse(localStorage.getItem('user_session'));
    const checked = Array.from(document.querySelectorAll('.cb-fav:checked')).map(cb => cb.value);
    
    localStorage.setItem('fav_menus_' + user.username, JSON.stringify(checked));
    tutupModal('modal-fav-menus');
    renderFavMenus();
};

window.renderFavMenus = function() {
    const container = document.getElementById('favorite-menus-container');
    if (!container) return;

    const user = JSON.parse(localStorage.getItem('user_session'));
    if (!user) return;

    const saved = localStorage.getItem('fav_menus_' + user.username);
    const favArray = saved ? JSON.parse(saved) : [];

    if (favArray.length === 0) {
        container.innerHTML = `
            <button onclick="openFavMenuModal()" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-[10px] font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 shadow-inner">
                <i data-lucide="plus" class="w-3 h-3"></i> Tambah Menu Favorit
            </button>
        `;
    } else {
        let html = '';
        favArray.forEach(id => {
            const menu = APP_MENUS.find(m => m.id === id);
            if (menu) {
                html += `
                    <a href="${menu.url}" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-[10px] font-bold text-slate-200 hover:text-white transition flex items-center gap-1.5 shadow-sm">
                        <i data-lucide="${menu.icon}" class="w-3.5 h-3.5 ${menu.color || 'text-slate-400'}"></i>
                        <span class="hidden lg:block">${menu.title}</span>
                    </a>
                `;
            }
        });
        html += `
            <button onclick="openFavMenuModal()" class="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition shadow-sm ml-1" title="Edit Menu Favorit">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
        `;
        container.innerHTML = html;
    }
    lucide.createIcons();
};

// ==========================================
// LOGIKA MEGA MENU GRID & SEARCH
// ==========================================
window.toggleGridMenu = function() {
    const menu = document.getElementById('modal-grid-menu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        document.getElementById('profile-dropdown').classList.add('hidden');
    } else {
        menu.classList.add('hidden');
    }
};

window.closeGridMenu = function() {
    document.getElementById('modal-grid-menu').classList.add('hidden');
};

window.filterMegaMenu = function(val) {
    const query = val.toLowerCase().trim();
    
    document.querySelectorAll('.menu-grid-item').forEach(item => {
        const title = item.getAttribute('data-title').toLowerCase();
        if (title.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });

    document.querySelectorAll('.mega-menu-group').forEach(group => {
        const visibleItems = group.querySelectorAll('.menu-grid-item[style="display: flex;"], .menu-grid-item:not([style*="display: none"])');
        group.style.display = visibleItems.length > 0 ? 'block' : 'none';
    });
};
