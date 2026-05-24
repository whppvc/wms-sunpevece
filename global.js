// ==========================================
// KREDENSIAL SUPABASE (HANYA DI SINI)
// ==========================================
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// DAFTAR MENU APLIKASI WMS
// ==========================================
const APP_MENUS = [
    { id: 'dashboard', title: 'Dashboard Utama', icon: 'layout-dashboard', url: 'menu.html' },
    { isDivider: true, title: 'INBOUND (MASUK)' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html', color: 'text-emerald-600' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html' },
    { isDivider: true, title: 'INVENTORY & AUDIT' },
    { id: 'kartu_stok', title: 'Kartu Stok & Mutasi', icon: 'layers', url: 'kartu_stok.html', color: 'text-blue-600' },
    { id: 'riwayat_mutasi', title: 'Riwayat Mutasi PO', icon: 'arrow-right-left', url: 'riwayat_mutasi.html' },
    { id: 'opname', title: 'Stock Opname', icon: 'clipboard-check', url: 'opname.html', color: 'text-purple-600' },
    { isDivider: true, title: 'OUTBOUND (KELUAR)' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html', color: 'text-rose-600' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html' }
];

// ==========================================
// MESIN PEMBANGUN LAYOUT MODERN
// ==========================================
function initModernLayout(pageId, pageTitle) {
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'Staff'};
    
    // 1. Buat Container Utama Pembungkus Sidebar & Konten
    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'flex h-screen bg-slate-50 overflow-hidden text-slate-800 font-sans';
    
    // 2. Buat Tampilan Sidebar
    let sidebarHTML = `
        <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-64 bg-[#0f172a] text-slate-300 transform -translate-x-full lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col shadow-xl">
            <div class="flex items-center justify-center h-16 bg-[#1e293b] border-b border-slate-700/50 shadow-md">
                <span class="text-white font-black text-xl tracking-wider flex items-center gap-2">
                    <i data-lucide="box" class="text-blue-500"></i> SUNPEVECE
                </span>
            </div>
            
            <div class="overflow-y-auto overflow-x-hidden flex-grow scrollbar-hide py-4 px-3 space-y-1">
    `;

    APP_MENUS.forEach(menu => {
        if (menu.isDivider) {
            sidebarHTML += `<div class="mt-6 mb-2 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">${menu.title}</div>`;
        } else {
            const isActive = menu.id === pageId;
            const bgClass = isActive ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 hover:text-white';
            const iconColor = isActive ? 'text-blue-500' : (menu.color || 'text-slate-400');
            const borderClass = isActive ? 'border-r-4 border-blue-500' : 'border-r-4 border-transparent';
            
            sidebarHTML += `
                <a href="${menu.url}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${bgClass} ${borderClass}">
                    <i data-lucide="${menu.icon}" class="w-5 h-5 ${iconColor}"></i>
                    <span class="font-semibold text-sm">${menu.title}</span>
                </a>
            `;
        }
    });

    sidebarHTML += `
            </div>
            <div class="p-4 bg-[#0b1120] border-t border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-white uppercase">${user.username}</span>
                        <span class="text-[10px] text-slate-500 font-medium">${user.role}</span>
                    </div>
                </div>
                <button onclick="logout()" class="mt-3 w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded text-xs font-bold transition flex items-center justify-center gap-2">
                    <i data-lucide="log-out" class="w-4 h-4"></i> LOGOUT
                </button>
            </div>
        </aside>
        <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black/60 z-40 hidden lg:hidden backdrop-blur-sm transition-opacity"></div>
    `;

    // 3. Buat Konten Area & Top Header
    let contentHTML = `
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shadow-sm z-30 flex-shrink-0">
                <div class="flex items-center gap-4">
                    <button onclick="toggleSidebar()" class="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <h1 class="text-lg lg:text-xl font-black text-slate-800 tracking-tight">${pageTitle}</h1>
                </div>
            </header>
            
            <main id="main-content-area" class="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 lg:p-6 pb-20">
                </main>
        </div>
    `;

    layoutWrapper.innerHTML = sidebarHTML + contentHTML;
    
    // 4. Pindahkan Konten Halaman Asli ke Dalam Layout Baru
    const bodyContent = document.body.innerHTML;
    document.body.innerHTML = ''; // Bersihkan body
    document.body.appendChild(layoutWrapper);
    document.getElementById('main-content-area').innerHTML = bodyContent;

    // Aktifkan Icon
    lucide.createIcons();
}

// Fungsi Buka/Tutup Sidebar (Untuk HP)
window.toggleSidebar = function() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

function logout() {
    localStorage.removeItem('user_session');
    window.location.href = 'index.html'; // Ganti dengan halaman login Anda
}
