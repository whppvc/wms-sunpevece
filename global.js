// ==========================================
// 0. ROUTE GUARD (PENJAGA KEAMANAN HALAMAN)
// ==========================================
(function checkSecurity() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path === '/' || path.endsWith('setting.html');
    const session = localStorage.getItem('user_session');

    if (!session && !isLoginPage) {
        window.location.replace('index.html');
    } else if (session && isLoginPage) {
        window.location.replace('menu.html');
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
    { isDivider: true, title: 'IN' },
    { id: 'stbj', title: 'Scan STBJ', icon: 'shield-check', url: 'stbj.html' },
    { id: 'hasil_stbj', title: 'Hasil STBJ', icon: 'clipboard-list', url: 'hasil_stbj.html' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html' },
    { isDivider: true, title: 'INV' },
    { id: 'kartu_stok', title: 'Kartu Stok', icon: 'layers', url: 'kartu_stok.html' },
    { id: 'opname', title: 'Stock Opname', icon: 'clipboard-check', url: 'opname.html' },
    { isDivider: true, title: 'PIC' },
    { id: 'scan_pic', title: 'Scan PIC Area', icon: 'user-check', url: 'scan_pic.html' },
    { id: 'riwayat_mutasi', title: 'Riwayat Konversi', icon: 'arrow-right-left', url: 'riwayat_konversi.html' },
    { isDivider: true, title: 'OUT' },
    { id: 'po', title: 'PO & Estimasi', icon: 'clipboard-check', url: 'po.html' },
    { id: 'picking_list', title: 'Picking List', icon: 'clipboard-pen', url: 'picking_list.html' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html' },
    { isDivider: true, title: 'CFG' },
    { id: 'master_data', title: 'Master Data', icon: 'database', url: 'master_data.html' }
];

// INJEKSI CSS STANDAR & LOGIKA SIDEBAR
const style = document.createElement('style');
style.innerHTML = `
    .hide-scrollbar::-webkit-scrollbar { display: none; } 
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    /* Override padding bawaan HTML lama agar full screen */
    body > div.absolute.inset-0 { padding-top: 0 !important; position: relative !important; height: 100% !important; }
    
    /* Transisi Sidebar */
    #app-sidebar { transition: width 0.3s ease, transform 0.3s ease; }
    
    /* Tooltip untuk Slim Sidebar */
    .sidebar-tooltip {
        visibility: hidden; opacity: 0; position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
        margin-left: 10px; background-color: #1e293b; color: white; padding: 6px 12px; border-radius: 6px;
        font-size: 12px; font-weight: bold; white-space: nowrap; z-index: 100; transition: all 0.2s;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); pointer-events: none;
    }
    .sidebar-item:hover .sidebar-tooltip { visibility: visible; opacity: 1; margin-left: 15px; }
    
    /* DESKTOP STATE (Lebar Dinamis) */
    @media (min-width: 640px) {
        /* Mode Ramping (Default) */
        #app-sidebar:not(.expanded) { width: 4.5rem; }
        #app-sidebar:not(.expanded) .sidebar-text { display: none; }
        #app-sidebar:not(.expanded) .sidebar-logo-text { display: none; }
        #app-sidebar:not(.expanded) .sidebar-item { justify-content: center; padding: 0; width: 3rem; margin: 0 auto; }
        #app-sidebar:not(.expanded) .sidebar-divider { width: 2rem; margin: 0.5rem auto; }
        
        /* Mode Lebar (Expanded) */
        #app-sidebar.expanded { width: 16rem; }
        #app-sidebar.expanded .sidebar-text { display: block; }
        #app-sidebar.expanded .sidebar-logo-text { display: block; }
        #app-sidebar.expanded .sidebar-item { justify-content: flex-start; padding: 0 1rem; width: 100%; }
        #app-sidebar.expanded .sidebar-tooltip { display: none !important; }
        #app-sidebar.expanded .sidebar-divider { width: 100%; padding: 0 1rem; text-align: left; background: transparent; height: auto; margin-top: 1rem; }
        #app-sidebar.expanded #btn-expand-container { justify-content: flex-end; padding-right: 1rem; }
    }
    
    /* MOBILE STATE (Selalu Lebar saat dibuka) */
    @media (max-width: 639px) {
        #app-sidebar { width: 16rem; }
        .sidebar-text { display: block; }
        .sidebar-logo-text { display: block; }
        .sidebar-item { justify-content: flex-start; padding: 0 1rem; width: 100%; }
        .sidebar-tooltip { display: none !important; }
        .sidebar-divider { width: 100%; padding: 0 1rem; text-align: left; background: transparent; height: auto; margin-top: 1rem; }
    }
`;
document.head.appendChild(style);

function initModernLayout(pageMeta) {
    const sessionString = localStorage.getItem('user_session');
    if (!sessionString) return; 
    
    const user = JSON.parse(sessionString);
    const initial = user.username.charAt(0).toUpperCase();
    
    // Cek state sidebar dari localStorage
    const isExpanded = localStorage.getItem('sidebar_expanded') === 'true';
    const expandedClass = isExpanded ? 'expanded' : '';
    const expandIcon = isExpanded ? 'chevron-left' : 'chevron-right';

    const originalNodes = Array.from(document.body.childNodes);
    document.body.innerHTML = ''; 

    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'flex h-screen bg-slate-50 overflow-hidden font-sans w-full';

    // ==========================================
    // 1. SIDEBAR (KIRI - GELAP)
    // ==========================================
    let sidebarHTML = `
        <aside id="app-sidebar" class="fixed sm:relative inset-y-0 left-0 z-50 bg-[#0f172a] flex flex-col py-4 transform -translate-x-full sm:translate-x-0 shadow-2xl sm:shadow-none border-r border-slate-800 shrink-0 ${expandedClass}">
            
            <!-- Logo / Home -->
            <a href="menu.html" class="mb-6 flex items-center justify-center gap-3 px-4 h-10 transition cursor-pointer overflow-hidden shrink-0">
                <div class="bg-white p-1 rounded-lg shrink-0 flex items-center justify-center w-10 h-10">
                    <img src="sunpevece.png" alt="Logo" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                </div>
                <span class="sidebar-logo-text text-white font-black text-lg tracking-wider whitespace-nowrap">SUNPEVECE</span>
            </a>
            
            <!-- Menu Icons -->
            <div class="flex flex-col gap-2 w-full px-3 overflow-y-auto hide-scrollbar flex-1">
    `;
    
    APP_MENUS.forEach(menu => {
        if (menu.isDivider) { 
            sidebarHTML += `<div class="sidebar-divider h-px bg-slate-700 my-1 text-[10px] font-black text-slate-400 uppercase tracking-widest overflow-hidden whitespace-nowrap"><span class="sidebar-text">${menu.title}</span></div>`; 
        } else {
            const isActive = pageMeta && menu.id === pageMeta.id;
            const bgClass = isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white';
            sidebarHTML += `
                <a href="${menu.url}" class="sidebar-item relative flex items-center h-10 rounded-xl transition-all cursor-pointer ${bgClass}">
                    <i data-lucide="${menu.icon}" class="w-5 h-5 shrink-0"></i>
                    <span class="sidebar-text ml-3 text-sm font-bold whitespace-nowrap">${menu.title}</span>
                    <div class="sidebar-tooltip">${menu.title}</div>
                </a>
            `;
        }
    });
    
    sidebarHTML += `
            </div>

            <!-- Expand/Collapse Button (Bottom) -->
            <div id="btn-expand-container" class="mt-auto pt-4 px-3 w-full border-t border-slate-800 hidden sm:flex justify-center transition-all">
                <button onclick="toggleSidebarExpand()" class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer bg-slate-900 border border-slate-700 shadow-sm">
                    <i data-lucide="${expandIcon}" id="icon-expand-sidebar" class="w-5 h-5"></i>
                </button>
            </div>
        </aside>
        <div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-slate-900/60 z-40 hidden backdrop-blur-sm transition-opacity sm:hidden"></div>
    `;

    // ==========================================
    // 2. AREA KANAN (HEADER PUTIH + KONTEN)
    // ==========================================
    let rightArea = document.createElement('div');
    rightArea.className = 'flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-slate-50';
    
    let headerHTML = `
        <header class="bg-white text-slate-800 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-slate-200 z-30 shrink-0 shadow-sm">
            
            <!-- Kiri: Hamburger (Mobile) & Judul Halaman -->
            <div class="flex items-center gap-4">
                <button onclick="toggleSidebar()" class="sm:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer">
                    <i data-lucide="menu" class="w-6 h-6"></i>
                </button>
                <div class="flex items-center gap-3">
                    <!-- REVISI: Garis 3 (Hamburger) dihilangkan pada versi Desktop -->
                    <h1 class="text-base sm:text-lg font-black tracking-wide uppercase text-slate-800">${pageMeta ? pageMeta.title : 'WMS PORTAL'}</h1>
                </div>
            </div>
            
            <!-- Kanan: Notifikasi & Profil -->
            <div class="flex items-center gap-3 sm:gap-5">
                
                <!-- Inbox Request -->
                <button onclick="bukaModalInbox()" class="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer" title="Request Ganti Customer">
                    <i data-lucide="mail" class="w-5 h-5"></i>
                    <span id="inbox-badge" class="hidden absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <!-- User Profile -->
                <div class="relative">
                    <button onclick="toggleProfileMenu()" class="flex items-center gap-2 p-1 hover:bg-slate-50 rounded-full transition pr-3 cursor-pointer border border-transparent hover:border-slate-200">
                        <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-inner text-sm">${initial}</div>
                        <span class="text-xs font-black uppercase text-slate-700 hidden sm:block">${user.username}</span>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 hidden sm:block"></i>
                    </button>
                    
                    <!-- Dropdown Profil -->
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
    
    // Bungkus konten asli HTML ke dalam tag <main>
    let mainContent = document.createElement('main');
    mainContent.className = 'flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 relative flex flex-col';
    
    // Pindahkan semua elemen body lama ke dalam mainContent
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
    // 3. MODALS (PASSWORD & INBOX)
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
        
        <div id="modal-inbox" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/70 z-[100] px-2 sm:px-4 backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 text-slate-800 h-[80vh] flex flex-col overflow-hidden">
                <div class="p-4 sm:p-5 flex justify-between items-center border-b border-slate-200 bg-slate-50">
                    <h3 class="text-base font-black flex items-center gap-2 text-slate-800"><i data-lucide="mail-open" class="text-blue-600"></i> INBOX REQUEST GANTI CUSTOMER</h3>
                    <button onclick="tutupModal('modal-inbox')" class="text-slate-400 hover:text-red-500 transition bg-white p-1.5 rounded-md border border-slate-200"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="flex-1 overflow-x-auto overflow-y-auto hide-scrollbar bg-white">
                    <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
                        <thead class="sticky top-0 z-10 bg-slate-800 text-white shadow-sm">
                            <tr>
                                <th class="p-3 font-bold uppercase tracking-wider">PIC</th>
                                <th class="p-3 font-bold uppercase tracking-wider border-l border-slate-700">QR Code</th>
                                <th class="p-3 font-bold uppercase tracking-wider border-l border-slate-700">Customer Aktual (Lama)</th>
                                <th class="p-3 font-black text-orange-300 border-x border-slate-700 bg-slate-900">Customer Request (Baru)</th>
                                <th class="p-3 font-bold uppercase tracking-wider">Keterangan</th>
                                <th class="p-3 font-bold uppercase tracking-wider text-center border-l border-slate-700">Aksi / Status</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-inbox" class="text-slate-700">
                            <tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold">Sedang memuat data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    layoutWrapper.insertAdjacentHTML('beforeend', modalsHTML);
    document.body.appendChild(layoutWrapper);
    
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

// Tutup dropdown profil jika klik di luar
document.addEventListener('click', (e) => { 
    const dropdown = document.getElementById('profile-dropdown'); 
    if (dropdown && !e.target.closest('.relative')) dropdown.classList.add('hidden'); 
});

// ==========================================
// FUNGSI INBOX REQUEST CUSTOMER
// ==========================================
async function cekNotifikasiInbox() {
    try {
        const { count, error } = await db.from('request_ganti_customer').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
        const badge = document.getElementById('inbox-badge');
        if (badge && count > 0) badge.classList.remove('hidden');
        else if (badge) badge.classList.add('hidden');
    } catch(e) { console.error("Gagal cek notif:", e); }
}

window.bukaModalInbox = async function() {
    tutupModal('profile-dropdown');
    document.getElementById('modal-inbox').classList.remove('hidden');
    
    const tbody = document.getElementById('tbody-inbox');
    tbody.innerHTML = '<tr><td colspan="6" class="p-10 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i> Mengambil pesan...</td></tr>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('request_ganti_customer').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
        if(error) throw error;
        
        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold"><i data-lucide="mail-check" class="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-500"></i> Tidak ada antrean request.</td></tr>';
            lucide.createIcons();
            return;
        }

        const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown', role: 'Staff'};
        const canApprove = user.role === 'Admin' || user.role === 'CS' || user.username.toLowerCase().includes('admin');
        
        let html = '';
        data.forEach(d => {
            let btnAksi = canApprove 
                ? `<button onclick="terimaRequestPO(${d.id}, '${d.qrcode}', '${d.customer_request}')" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-md shadow-sm text-[10px] uppercase transition flex items-center gap-1 mx-auto"><i data-lucide="check-circle" class="w-3 h-3"></i> TERIMA</button>`
                : `<span class="px-3 py-1 bg-amber-100 text-amber-700 font-bold rounded-md text-[10px] border border-amber-300">MENUNGGU CS</span>`;

            html += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition bg-white even:bg-slate-50">
                    <td class="p-3 font-black text-slate-800 uppercase border-r border-slate-200">${d.pic_request || '-'}</td>
                    <td class="p-3 font-mono font-bold tracking-wider border-r border-slate-200">${d.qrcode}</td>
                    <td class="p-3 font-bold text-slate-500 border-r border-slate-200">${d.customer_awal || '-'}</td>
                    <td class="p-3 font-black text-orange-600 border-r border-slate-200 bg-orange-50/30">${d.customer_request}</td>
                    <td class="p-3 font-medium text-slate-600 truncate max-w-[200px] border-r border-slate-200" title="${d.keterangan || '-'}">${d.keterangan || '-'}</td>
                    <td class="p-3 text-center">${btnAksi}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        lucide.createIcons();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`;
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

        bukaModalInbox(); 
        cekNotifikasiInbox(); 

    } catch(err) {
        alert("Gagal memproses persetujuan: " + err.message);
    }
}
