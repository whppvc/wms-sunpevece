// ==========================================
// KREDENSIAL SUPABASE (CUKUP TULIS DI SINI SAJA)
// ==========================================
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// MANAJEMEN TAB MENU (GLOBAL)
// ==========================================
function initGlobalTabs(pageMeta) {
    let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    
    // Pastikan Dashboard selalu ada di ujung kiri
    if(!tabs.find(t => t.id === 'dashboard')) {
        tabs.unshift({id: 'dashboard', title: 'DASHBOARD', url: 'menu.html'});
    }
    
    // Tambahkan halaman saat ini ke Tab jika belum ada
    if(!tabs.find(t => t.id === pageMeta.id)) { 
        tabs.push(pageMeta); 
        localStorage.setItem('wms_tabs', JSON.stringify(tabs)); 
    }
    
    const tabBar = document.getElementById('tab-bar'); 
    if(!tabBar) return;
    
    tabBar.innerHTML = '';
    
    tabs.forEach(tab => {
        const isActive = tab.id === pageMeta.id;
        // Warna tab aktif disesuaikan dengan tema halaman (bisa di-override jika perlu)
        let bgClass = isActive ? 'bg-blue-600 text-white shadow-inner' : 'hover:bg-slate-800 border-r border-slate-700';
        
        // Tombol close (kecuali untuk Dashboard)
        const closeBtn = tab.id === 'dashboard' ? '' : `<button onclick="closeGlobalTab(event, '${tab.id}', '${pageMeta.id}')" class="ml-2 hover:text-red-400 transition cursor-pointer"><i data-lucide="x" class="w-3 h-3"></i></button>`;
        
        tabBar.innerHTML += `
            <div onclick="window.location.href='${tab.url}'" class="flex items-center px-5 py-2.5 cursor-pointer transition whitespace-nowrap border-b-2 ${isActive ? 'border-white' : 'border-transparent hover:border-slate-500'} ${bgClass}">
                <span>${tab.title}</span>${closeBtn}
            </div>`;
    });
    
    lucide.createIcons();
}

function closeGlobalTab(e, idToRemove, currentId) {
    e.stopPropagation(); 
    let tabs = JSON.parse(localStorage.getItem('wms_tabs')) || [];
    tabs = tabs.filter(t => t.id !== idToRemove); 
    localStorage.setItem('wms_tabs', JSON.stringify(tabs));
    
    // Jika yang ditutup adalah halaman yang sedang dibuka, lempar ke tab terakhir
    if(currentId === idToRemove) { 
        window.location.href = tabs[tabs.length-1].url; 
    } else { 
        // Jika yang ditutup tab lain, cukup refresh tampilan tab
        initGlobalTabs({ id: currentId }); // Hack kecil untuk memicu render ulang
        window.location.reload(); 
    }
}

// Eksekusi otomatis fungsi UI global
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons(); 
    document.body.setAttribute('data-bg', localStorage.getItem('app_bg') || 'light');
});
