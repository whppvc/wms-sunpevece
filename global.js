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

// INJEKSI CSS STANDAR TABEL GELAP (Agar semua halaman otomatis rapi)
const style = document.createElement('style');
style.innerHTML = `
    .hide-scrollbar::-webkit-scrollbar { display: none; } 
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .hdr-std { background-color: #1e293b !important; color: #ffffff !important; text-align: center !important; border: 1px solid #334155; padding: 0.75rem; text-transform: uppercase; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; white-space: nowrap; }
`;
document.head.appendChild(style);

function initModernLayout(pageMeta) {
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'Staff'};
    let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    if(!tabs.find(t => t.id === 'dashboard')) tabs.unshift({id: 'dashboard', title: 'DASHBOARD', url: 'menu.html'});
    if(pageMeta && !tabs.find(t => t.id === pageMeta.id)) { tabs.push(pageMeta); localStorage.setItem('wms_tabs', JSON.stringify(tabs)); }

    const originalNodes = Array.from(document.body.childNodes);
    document.body.innerHTML = ''; 

    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'flex h-screen bg-slate-50 overflow-hidden font-sans';

    // SIDEBAR (Bisa dilipat di PC & HP)
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
                    <div class="hidden md:flex items-center bg-slate-800 rounded-full px-3 py-1.5 border border-slate-700">
                        <i data-lucide="search" class="w-4 h-4 text-slate-400"></i>
                        <input type="text" placeholder="Pencarian Global..." class="bg-transparent border-none outline-none text-xs ml-2 w-40 text-white font-bold placeholder-slate-400">
                    </div>
                    
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
                <h3 class="text-xl font-black mb-4 flex items-center gap-2"><i data-lucide="palette" class="text-slate-600"></i> Tema Tampilan</h3>
                <button onclick="localStorage.setItem('app_bg', 'light'); window.location.reload();" class="w-full py-3 bg-slate-100 font-bold rounded border border-slate-300 mb-2">Tema Terang (Standar)</button>
                <button onclick="localStorage.setItem('app_bg', 'dark'); window.location.reload();" class="w-full py-3 bg-slate-800 text-white font-bold rounded border border-slate-900 mb-4">Tema Gelap (Malam)</button>
                <button onclick="tutupModal('modal-tema')" class="w-full py-2.5 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300">Tutup</button>
            </div>
        </div>
    `;
    layoutWrapper.insertAdjacentHTML('beforeend', modalsHTML);
    document.body.appendChild(layoutWrapper);
    
    if(localStorage.getItem('app_bg') === 'dark') document.body.classList.add('bg-slate-900', 'text-white');
    lucide.createIcons();
}

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
document.addEventListener('click', (e) => { const dropdown = document.getElementById('profile-dropdown'); if (dropdown && !e.target.closest('.relative')) dropdown.classList.add('hidden'); });
