// ==========================================
// KREDENSIAL SUPABASE (HANYA DI SINI)
// ==========================================
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// MESIN PEMBANGUN TOP BAR & TAB MENU
// ==========================================
function initModernTopBar(pageMeta) {
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'Staff'};
    
    // 1. Inisialisasi Data Tab
    let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    if(!tabs.find(t => t.id === 'dashboard')) tabs.unshift({id: 'dashboard', title: 'DASHBOARD', url: 'menu.html'});
    if(pageMeta && !tabs.find(t => t.id === pageMeta.id)) { 
        tabs.push(pageMeta); localStorage.setItem('wms_tabs', JSON.stringify(tabs)); 
    }

    // 2. Bangun HTML Top Bar (Logo, Judul, Profil Dropdown)
    const headerHTML = `
        <div class="sticky top-0 z-50 w-full flex flex-col shadow-md font-sans">
            <nav class="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200">
                <div class="flex items-center gap-3 cursor-pointer" onclick="window.location.href='menu.html'">
                    <img src="sunpevece.png" alt="Logo" class="h-8 object-contain" onerror="this.src='https://via.placeholder.com/150x50?text=SUNPEVECE'">
                    <div class="flex flex-col ml-1 hidden sm:flex">
                        <span class="font-black text-lg tracking-wide leading-tight text-slate-800">PORTAL WMS</span>
                    </div>
                </div>

                <div class="relative">
                    <button onclick="toggleProfileMenu()" class="flex items-center gap-2 p-1 focus:outline-none hover:bg-slate-100 rounded-full transition pr-3">
                        <div class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shadow-inner">
                            ${user.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-col text-left hidden md:flex">
                            <span class="text-xs font-black text-slate-800 uppercase leading-none">${user.username}</span>
                            <span class="text-[10px] font-bold text-slate-500">${user.role || 'PPC / Admin'}</span>
                        </div>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-500"></i>
                    </button>

                    <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 transform origin-top-right transition-all">
                        <div class="px-4 py-2 border-b border-slate-100 mb-1">
                            <p class="text-xs font-bold text-slate-400 uppercase">Pengaturan Akun</p>
                        </div>
                        <a href="#" onclick="menuProfil('password')" class="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"><i data-lucide="key-round" class="w-4 h-4"></i> Ubah Password</a>
                        <a href="#" onclick="menuProfil('tema')" class="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"><i data-lucide="palette" class="w-4 h-4"></i> Pengaturan Tema</a>
                        <hr class="my-1 border-slate-100">
                        <a href="#" onclick="logout()" class="flex items-center gap-3 px-4 py-2.5 text-sm font-black text-red-600 hover:bg-red-50 transition"><i data-lucide="log-out" class="w-4 h-4"></i> Logout</a>
                    </div>
                </div>
            </nav>

            <div id="tab-bar-container" class="w-full bg-[#0f172a] text-slate-400 flex overflow-x-auto text-[11px] font-black hide-scrollbar tracking-wider">
                </div>
        </div>
    `;

    // 3. Suntikkan Header ke Halaman (Paling Atas)
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    // 4. Generate Isi Tab
    const tabBar = document.getElementById('tab-bar-container');
    tabs.forEach(tab => {
        const isActive = pageMeta && tab.id === pageMeta.id;
        const bg = isActive ? 'bg-blue-600 text-white shadow-inner' : 'hover:bg-slate-800 border-r border-slate-700';
        const closeBtn = tab.id === 'dashboard' ? '' : `<button onclick="closeGlobalTab(event, '${tab.id}', '${pageMeta ? pageMeta.id : ''}')" class="ml-2 hover:text-red-400 transition"><i data-lucide="x" class="w-3 h-3"></i></button>`;
        tabBar.innerHTML += `<div onclick="window.location.href='${tab.url}'" class="flex items-center px-5 py-3 cursor-pointer transition whitespace-nowrap border-b-2 ${isActive ? 'border-white' : 'border-transparent hover:border-slate-500'} ${bg}"><span>${tab.title}</span>${closeBtn}</div>`;
    });

    // 5. Tutup dropdown jika klik di luar area
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown && !e.target.closest('.relative')) dropdown.classList.add('hidden');
    });

    lucide.createIcons();
}

// Fungsi Interaksi UI
function toggleProfileMenu() { document.getElementById('profile-dropdown').classList.toggle('hidden'); }
function menuProfil(jenis) { alert(`Fungsi Setting ${jenis} sedang dalam tahap pengembangan (Coming Soon)!`); toggleProfileMenu(); }
function logout() { if(confirm('Yakin ingin keluar?')) { localStorage.removeItem('user_session'); window.location.href = 'index.html'; } }

function closeGlobalTab(e, idToRemove, currentId) {
    e.stopPropagation(); 
    let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    tabs = tabs.filter(t => t.id !== idToRemove); 
    localStorage.setItem('wms_tabs', JSON.stringify(tabs));
    
    if(currentId === idToRemove) window.location.href = tabs[tabs.length-1].url; 
    else window.location.reload(); 
}

// Global UI Setup
document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-bg', localStorage.getItem('app_bg') || 'light');
});
