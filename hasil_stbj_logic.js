// Otomatis deteksi mode perangkat saat buka halaman (Layar < 640px = Grid, >= 640px = Tabel)
const isMobileDevice = window.innerWidth < 640;
let modeSekarang = isMobileDevice ? 'grid' : 'tabel'; 
let modeTabelView = 'item'; // 'item' (Rekapitulasi Item) atau 'lengkap' (Detail Batch Produksi)

let statusSekarang = 'ALL'; 
let rawDataRaw = [];
let stbjManualRaw = []; 
let processedData = []; 
let filteredData = []; 

let kamusData = [];
let jasperData = [];
let lisData = []; 

let sortState = { col: null, isAsc: true }; 
let activeFilters = {}; 
let currentFilterCol = ''; 

let currentPage = 1;
let rowsPerPage = 10; 
let userColOrder = []; 
let hiddenCols = []; 
let selectAllState = 0; 
let selectedRows = new Set(); 

let filterTimeout; 

// State Khusus Mode Grid (Drill-Down 6 Tingkat & Filter Tanggal Persisten)
let mobileLevel = 1; 
let gridFilterDate = ''; // Menyimpan tanggal yang dipilih agar tidak hilang saat navigasi
let mobileSelectedSource = ''; // 'ALL', 'SCAN', 'MANUAL', 'HOLD'
let mobileSelectedTgl = '';
let mobileSelectedMesinShift = ''; // `${mesin}_${shift}`
let mobileSelectedItemSpec = ''; // `${nama}_${pjg}_${grade}_${dus}`
let mobileSelectedShading = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

// Definisi Default Seluruh Kolom Tabel
const defaultColDefs = [
    { id: 'col-status-data', label: 'Collect' },
    { id: 'col-troli', label: 'Troli' },
    { id: 'col-tgl', label: 'Tgl Produksi' },
    { id: 'col-mesin', label: 'Mesin' },
    { id: 'col-shift', label: 'Shift' },
    { id: 'col-jenis', label: 'Jenis Item' },
    { id: 'col-nama', label: 'Nama Item' },
    { id: 'col-jasper', label: 'Nama Jasper' },
    { id: 'col-btn-edit', label: 'Edit Jasper' },
    { id: 'col-pjg', label: 'Panjang' },
    { id: 'col-grade', label: 'Grade' },
    { id: 'col-dus', label: 'Dus' },
    { id: 'col-shading', label: 'Shading' },
    { id: 'col-customer', label: 'Customer Bawaan' },
    { id: 'col-qty', label: 'QTY (DUS)' },
    { id: 'col-qty-lembar', label: 'QTY (LEMBAR)' },
    { id: 'col-ket', label: 'Keterangan' }
];

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

function formatWIB(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
}

// Auto-Chunking Fetcher untuk menembus limit 1000 baris Supabase
async function fetchAllRows(tableName, filterStatus = 'ALL') {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    let filterValues = [];
    if (filterStatus === 'STBJ') filterValues = ['STBJ', 'stbj', 'SUDAH STBJ', 'sudah stbj'];
    else if (filterStatus === 'HOLD STBJ') filterValues = ['HOLD STBJ', 'hold stbj', 'HOLD', 'hold'];
    else if (filterStatus === 'IN GUDANG') filterValues = ['IN GUDANG', 'in gudang'];
    else if (filterStatus === 'HOLD LANGSIR') filterValues = ['HOLD LANGSIR', 'hold langsir'];

    while (true) {
        let query = db.from(tableName).select('*').order('created_at', { ascending: false });
        if (filterStatus !== 'ALL' && tableName === 'hasil_stbj_langsir') {
            query = query.in('status', filterValues);
        }
        
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'hasil_stbj', title: 'HASIL STBJ', url: 'hasil_stbj.html' });
    
    document.body.style.overflow = 'hidden';
    const wmsMain = document.querySelector('main');
    if(wmsMain) {
        wmsMain.style.overflow = 'hidden';
        wmsMain.style.padding = '0'; 
    }

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
        
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenuMobile"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    setTimeout(async () => {
        await loadKamusDanJasper();
        loadUserPreferences(); 
        await muatDataDariSupabase();
    }, 200);
});

window.toggleActionMenuMobile = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

// Kontrol Modal Pop-up Filter Tengah
window.bukaModalFilterPopup = function() {
    updateFilterDropdowns();
    document.getElementById('modal-filter-stbj').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalFilterPopup = function() {
    document.getElementById('modal-filter-stbj').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
};

// Kontrol Sidebar Atur Kolom
window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom');
    const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full'); 
        overlay.classList.remove('hidden'); 
        renderDragList();
    } else {
        sidebar.classList.add('translate-x-full'); 
        overlay.classList.add('hidden');
    }
};

window.tutupPopups = function() {
    tutupModalFilterPopup();
    const sidebarK = document.getElementById('sidebar-kolom');
    if(sidebarK) sidebarK.classList.add('translate-x-full');

    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-list-katalog').classList.add('hidden');
    document.getElementById('modal-katalog').classList.add('hidden');
    closeFilterMenu();
};

function loadUserPreferences() {
    const savedOrder = localStorage.getItem(`col_order_stbj_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } }
    
    const savedHidden = localStorage.getItem(`col_hidden_stbj_${currentUser.username}`);
    if (savedHidden) { try { hiddenCols = JSON.parse(savedHidden); } catch(e) { hiddenCols = []; } }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) sel.value = rowsPerPage;
    }
}

// Render Daftar Kolom di Sidebar Atur Kolom (Drag & Drop + Checkbox Visibilitas)
let draggedItem = null;

function renderDragList() {
    const container = document.getElementById('kolom-drag-container');
    if (!container) return;

    let currentCols = [];
    if (userColOrder && userColOrder.length > 0) {
        userColOrder.forEach(colId => {
            const def = defaultColDefs.find(d => d.id === colId);
            if (def) currentCols.push(def);
        });
        defaultColDefs.forEach(def => {
            if (!currentCols.some(c => c.id === def.id)) currentCols.push(def);
        });
    } else {
        currentCols = [...defaultColDefs];
    }

    let html = '';
    currentCols.forEach(col => {
        const isChecked = !hiddenCols.includes(col.id);
        html += `
            <div draggable="true" data-col-id="${col.id}" class="drag-col-item bg-white border border-slate-300 p-2.5 rounded-lg flex items-center justify-between shadow-sm cursor-move hover:border-blue-500 transition active:scale-[0.99]">
                <div class="flex items-center gap-2.5">
                    <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400 shrink-0"></i>
                    <span class="text-xs font-bold text-slate-700">${col.label}</span>
                </div>
                <input type="checkbox" class="col-visible-cb w-4 h-4 accent-blue-600 rounded cursor-pointer border-slate-300" ${isChecked ? 'checked' : ''} title="Tampilkan Kolom">
            </div>
        `;
    });

    container.innerHTML = html;
    lucide.createIcons();

    // Event Listener Drag and Drop
    const items = container.querySelectorAll('.drag-col-item');
    items.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedItem = this;
            e.dataTransfer.effectAllowed = 'move';
            this.classList.add('opacity-50', 'bg-blue-50');
        });

        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('dragenter', function(e) {
            this.classList.add('border-blue-500');
        });

        item.addEventListener('dragleave', function(e) {
            this.classList.remove('border-blue-500');
        });

        item.addEventListener('drop', function(e) {
            e.stopPropagation();
            if (draggedItem !== this) {
                const allCurrent = Array.from(container.querySelectorAll('.drag-col-item'));
                const draggedIdx = allCurrent.indexOf(draggedItem);
                const droppedIdx = allCurrent.indexOf(this);
                if (draggedIdx < droppedIdx) {
                    container.insertBefore(draggedItem, this.nextSibling);
                } else {
                    container.insertBefore(draggedItem, this);
                }
            }
            this.classList.remove('border-blue-500');
            return false;
        });

        item.addEventListener('dragend', function() {
            this.classList.remove('opacity-50', 'bg-blue-50');
            container.querySelectorAll('.drag-col-item').forEach(el => el.classList.remove('border-blue-500'));
        });
    });
}

window.simpanUrutanKolom = function() {
    const container = document.getElementById('kolom-drag-container');
    const items = container.querySelectorAll('.drag-col-item');
    
    let newOrder = [];
    let newHidden = [];

    items.forEach(item => {
        const colId = item.getAttribute('data-col-id');
        const cb = item.querySelector('.col-visible-cb');
        newOrder.push(colId);
        if (!cb.checked) {
            newHidden.push(colId);
        }
    });

    userColOrder = newOrder;
    hiddenCols = newHidden;

    localStorage.setItem(`col_order_stbj_${currentUser.username}`, JSON.stringify(userColOrder));
    localStorage.setItem(`col_hidden_stbj_${currentUser.username}`, JSON.stringify(hiddenCols));

    toggleSidebarKolom();
    renderHeaderDanTabel();
    alert("Urutan dan visibilitas kolom berhasil disimpan!");
};

window.resetUrutanKolom = function() {
    localStorage.removeItem(`col_order_stbj_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_stbj_${currentUser.username}`);
    userColOrder = [];
    hiddenCols = [];
    renderDragList();
    renderHeaderDanTabel();
    alert("Urutan kolom telah direset ke default!");
};

async function loadKamusDanJasper() {
    const { data: d2 } = await db.from('master_2').select('*'); if(d2) kamusData = d2;
    try {
        const { data: dj } = await db.from('nama_jasper').select('*').order('created_at', {ascending: false});
        if(dj) jasperData = dj;
    } catch(e) {}
    try {
        const { data: dl } = await db.from('master_lis').select('*');
        if(dl) lisData = dl;
    } catch(e) {}
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-stbj');
    tbody.innerHTML = `<tr><td colspan="23" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-sm">Menarik Semua Data STBJ...</p></td></tr>`;
    lucide.createIcons();
    
    try {
        const [resHasil, resManual] = await Promise.all([
            fetchAllRows('hasil_stbj_langsir', statusSekarang),
            fetchAllRows('stbj_manual')
        ]);

        rawDataRaw = resHasil || [];
        stbjManualRaw = resManual || [];

        updateFilterDropdowns();
        setMode(modeSekarang);
    } catch(err) { 
        tbody.innerHTML = `<tr><td colspan="23" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`; 
    }
}

window.setMode = function(m) {
    const isGrid = (m === 'grid' || m === 'mobile');
    modeSekarang = isGrid ? 'grid' : 'tabel';

    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    const tabGrid = document.getElementById('tab-mode-grid');
    const tabTabel = document.getElementById('tab-mode-tabel');

    if(tabGrid) tabGrid.className = isGrid ? activeClass : inactiveClass;
    if(tabTabel) tabTabel.className = !isGrid ? activeClass : inactiveClass;

    // Tampilkan / Sembunyikan Konten
    document.getElementById('view-grid').classList.toggle('hidden', !isGrid);
    document.getElementById('view-table').classList.toggle('hidden', isGrid);
    
    // Bilah Mode Tabel (Item vs Lengkap)
    const barModeTabel = document.getElementById('bar-mode-tabel');
    if (barModeTabel) barModeTabel.classList.toggle('hidden', isGrid);

    // Sembunyikan toolbar kanan atas di mode GRID, tampilkan di mode TABEL
    const desktopToolbar = document.getElementById('desktop-toolbar');
    if (desktopToolbar) desktopToolbar.classList.toggle('hidden', isGrid);

    // Footer paginasi tabel
    document.getElementById('footer-pagination').classList.toggle('hidden', isGrid);
    
    const lvl6Footer = document.getElementById('mobile-lvl6-footer');
    if (lvl6Footer && !isGrid) {
        lvl6Footer.classList.add('hidden');
        lvl6Footer.style.display = 'none';
    }

    if (!isGrid) {
        const btnCollect = document.getElementById('btn-massal-collect');
        const btnCollectMob = document.getElementById('btn-massal-collect-mob');
        const btnHold = document.getElementById('btn-hold-mob');
        const btnHapus = document.getElementById('btn-hapus-mob');
        
        const userRole = (currentUser.role || '').toLowerCase();
        const isSuperOrCreator = ['creator', 'super admin', 'superadmin'].includes(userRole);

        if(btnCollect) btnCollect.classList.remove('hidden'); 
        if(btnCollectMob) btnCollectMob.classList.remove('hidden'); 
        if(btnHold) btnHold.classList.remove('hidden');
        if(btnHapus) btnHapus.classList.toggle('hidden', !isSuperOrCreator);

        renderHeaderDanTabel();
    } else {
        renderMobileView();
    }
};

window.setTabelModeView = function(viewMode) {
    modeTabelView = viewMode;

    const btnItem = document.getElementById('btn-mode-item');
    const btnLengkap = document.getElementById('btn-mode-lengkap');
    const lblDesc = document.getElementById('lbl-mode-desc');

    if (viewMode === 'item') {
        if(btnItem) btnItem.className = 'px-3 py-1 text-xs font-black rounded-md transition shadow-sm bg-blue-600 text-white';
        if(btnLengkap) btnLengkap.className = 'px-3 py-1 text-xs font-bold text-slate-600 rounded-md hover:text-slate-900 transition';
        if(lblDesc) lblDesc.innerText = 'Mode Item: Rekapitulasi kuantiti per spesifikasi item';
    } else {
        if(btnLengkap) btnLengkap.className = 'px-3 py-1 text-xs font-black rounded-md transition shadow-sm bg-blue-600 text-white';
        if(btnItem) btnItem.className = 'px-3 py-1 text-xs font-bold text-slate-600 rounded-md hover:text-slate-900 transition';
        if(lblDesc) lblDesc.innerText = 'Mode Lengkap: Rincian kuantiti detail per batch Tanggal Produksi, Mesin, dan Shift';
    }

    renderHeaderDanTabel();
};

// ========================================================
// LOGIKA MODE GRID (DRILL-DOWN 6 TINGKAT)
// ========================================================
function getAllUnifiedItems() {
    let list = [];
    (rawDataRaw || []).forEach(r => {
        list.push({
            source: 'SCAN',
            tglProduksi: r.tgl_produksi || '-',
            mesin: r.mesin || '-',
            shift: r.shift || '-',
            jenisItem: r.jenis_item || '-',
            namaItem: r.nama_item || '-',
            panjang: formatPanjang(r.panjang),
            grade: r.grade || '-',
            dus: r.dus || '-',
            shading: r.shading || '-',
            customer: r.customer || '-',
            qty: 1,
            qrcode: r.qrcode,
            troli: r.troli || '-',
            status: r.status || '-',
            keterangan: r.keterangan || '-',
            pic: r.pic_input || '-',
            created_at: r.created_at
        });
    });

    (stbjManualRaw || []).forEach(r => {
        list.push({
            source: 'MANUAL',
            tglProduksi: r.tgl_produksi || '-',
            mesin: r.mesin || '-',
            shift: r.shift || '-',
            jenisItem: r.jenis_item || '-',
            namaItem: r.nama_item || '-',
            panjang: formatPanjang(r.panjang),
            grade: r.grade || '-',
            dus: r.dus || '-',
            shading: r.shading || '-',
            customer: r.customer || '-',
            qty: parseInt(r.qty) || 0,
            qrcode: '-',
            troli: '-',
            status: 'MANUAL',
            keterangan: r.keterangan || '-',
            pic: r.pic || '-',
            created_at: r.created_at
        });
    });

    return list;
}

function matchesActiveFilters(item) {
    const f = {
        tgl: document.getElementById('fs-tgl')?.value || '',
        status: document.getElementById('fs-status')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        troli: document.getElementById('fs-troli')?.value || '',
        mesin: document.getElementById('fs-mesin')?.value || '',
        shift: document.getElementById('fs-shift')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        customer: document.getElementById('fs-customer')?.value || '',
        pic: document.getElementById('fs-pic')?.value || ''
    };

    if (f.tgl && item.tglProduksi !== f.tgl) return false;
    if (f.status && item.status !== f.status) return false;
    if (f.qr && !item.qrcode.toLowerCase().includes(f.qr)) return false;
    if (f.troli && item.troli !== f.troli) return false;
    if (f.mesin && item.mesin !== f.mesin) return false;
    if (f.shift && item.shift !== f.shift) return false;
    if (f.jenis && item.jenisItem !== f.jenis) return false;
    if (f.nama && item.namaItem !== f.nama) return false;
    if (f.pjg && item.panjang !== f.pjg) return false;
    if (f.grade && item.grade !== f.grade) return false;
    if (f.dus && item.dus !== f.dus) return false;
    if (f.shading && item.shading !== f.shading) return false;
    if (f.customer && item.customer !== f.customer) return false;
    if (f.pic && item.pic !== f.pic) return false;

    return true;
}

window.handleGridDateChange = function(val) {
    gridFilterDate = val;
    renderMobileView();
};

window.setGridAllDate = function() {
    gridFilterDate = '';
    renderMobileView();
};

window.goToMobileLevel2 = function(source) { mobileSelectedSource = source; mobileLevel = 2; renderMobileView(); };
window.goToMobileLevel3 = function(tgl) { mobileSelectedTgl = tgl; mobileLevel = 3; renderMobileView(); };
window.goToMobileLevel4 = function(msKey) { mobileSelectedMesinShift = msKey; mobileLevel = 4; renderMobileView(); };
window.goToMobileLevel5 = function(isKey) { mobileSelectedItemSpec = isKey; mobileLevel = 5; renderMobileView(); };
window.goToMobileLevel6 = function(shading) { mobileSelectedShading = shading; mobileLevel = 6; renderMobileView(); };

window.goBackMobile = function() {
    if (mobileLevel > 1) {
        mobileLevel--;
        renderMobileView();
    }
};

window.toggleSelectAllLvl6 = function(checked) {
    document.querySelectorAll('.cb-stbj-lvl6').forEach(cb => {
        cb.checked = checked;
        const card = cb.closest('.card-stbj-lvl6');
        if (card) {
            if (checked) card.classList.add('border-blue-500', 'bg-blue-50/40');
            else card.classList.remove('border-blue-500', 'bg-blue-50/40');
        }
    });
};

window.highlightLvl6Card = function(cb) {
    const card = cb.closest('.card-stbj-lvl6');
    if (card) {
        if (cb.checked) card.classList.add('border-blue-500', 'bg-blue-50/40');
        else card.classList.remove('border-blue-500', 'bg-blue-50/40');
    }
};

function makeDrillCard(title, subtitle, qtyText, clickAction, iconName = 'chevron-right') {
    return `
        <div onclick="${clickAction}" class="bg-white border border-slate-200 p-4 rounded-2xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-slate-50">
            <div class="flex flex-col pr-2">
                <span class="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">${subtitle}</span>
                <h4 class="font-black text-slate-800 text-sm leading-snug">${title}</h4>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">${qtyText} Dus</span>
                <i data-lucide="${iconName}" class="text-slate-400 w-5 h-5"></i>
            </div>
        </div>
    `;
}

function makeStickyHeader(title, subtitle) {
    return `
        <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md -mx-4 px-4 py-2.5 border-b border-slate-300 shadow-sm flex items-center gap-3 mb-2">
            <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
            </button>
            <div class="flex flex-col overflow-hidden">
                <span class="text-base font-black text-rose-700 uppercase leading-snug truncate">${title}</span>
                <span class="text-xs font-black text-slate-800 uppercase leading-snug truncate">${subtitle}</span>
            </div>
        </div>
    `;
}

// Cancel STBJ Mobile (Status -> HOLD LANGSIR) + Mencatat PIC Cancel
window.cancelSTBJMobile = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-stbj-lvl6:checked');
    if (checkedBoxes.length === 0) return alert("Pilih minimal 1 kardus!");

    const qrsToCancel = Array.from(checkedBoxes).map(cb => cb.value).filter(qr => qr && qr !== '-');
    if (qrsToCancel.length === 0) return alert("Item manual tidak dapat di-cancel STBJ.");

    if (!confirm(`Cancel ${qrsToCancel.length} item STBJ ini? Status akan diubah menjadi 'HOLD LANGSIR' oleh ${currentUser.username}.`)) return;

    const btn = document.getElementById('btn-cancel-stbj-lvl6');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true; }

    const cancelKet = `Cancel STBJ oleh ${currentUser.username}`;

    try {
        const { error } = await db.from('hasil_stbj_langsir')
            .update({ 
                status: 'HOLD LANGSIR', 
                keterangan: cancelKet,
                pic_input: currentUser.username 
            })
            .in('qrcode', qrsToCancel);

        if (error) throw error;

        rawDataRaw.forEach(r => {
            if (qrsToCancel.includes(r.qrcode)) {
                r.status = 'HOLD LANGSIR';
                r.keterangan = cancelKet;
                r.pic_input = currentUser.username;
            }
        });

        alert(`✅ SUKSES!\n${qrsToCancel.length} kardus telah masuk ke 'HOLD LANGSIR' (PIC: ${currentUser.username}).`);
        renderMobileView();
    } catch (e) {
        alert("Gagal memproses: " + e.message);
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        lucide.createIcons();
    }
};

// Cancel Hold Mobile (Status -> STBJ)
window.cancelHoldMobile = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-stbj-lvl6:checked');
    if (checkedBoxes.length === 0) return alert("Pilih minimal 1 kardus hold!");

    const qrsToUnhold = Array.from(checkedBoxes).map(cb => cb.value).filter(qr => qr && qr !== '-');
    if (qrsToUnhold.length === 0) return alert("Tidak ada item scan valid.");

    if (!confirm(`Kembalikan ${qrsToUnhold.length} item hold ini ke status 'STBJ'?`)) return;

    const btn = document.getElementById('btn-cancel-hold-lvl6');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true; }

    try {
        const { error } = await db.from('hasil_stbj_langsir')
            .update({ 
                status: 'STBJ', 
                keterangan: `Unhold oleh ${currentUser.username}`,
                pic_input: currentUser.username
            })
            .in('qrcode', qrsToUnhold);

        if (error) throw error;

        rawDataRaw.forEach(r => {
            if (qrsToUnhold.includes(r.qrcode)) {
                r.status = 'STBJ';
                r.keterangan = `Unhold oleh ${currentUser.username}`;
                r.pic_input = currentUser.username;
            }
        });

        alert(`✅ SUKSES!\n${qrsToUnhold.length} kardus dikembalikan ke status 'STBJ'.`);
        renderMobileView();
    } catch (e) {
        alert("Gagal memproses: " + e.message);
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        lucide.createIcons();
    }
};

// Hapus Item Hold Mobile (Khusus Creator & Super Admin)
window.hapusItemHoldMobile = async function() {
    const userRole = (currentUser.role || '').toLowerCase();
    const isSuperOrCreator = ['creator', 'super admin', 'superadmin'].includes(userRole);
    if (!isSuperOrCreator) {
        return alert("Akses ditolak! Hanya Creator dan Super Admin yang berhak menghapus data Hold.");
    }

    const checkedBoxes = document.querySelectorAll('.cb-stbj-lvl6:checked');
    if (checkedBoxes.length === 0) return alert("Pilih minimal 1 kardus yang ingin dihapus!");

    const qrsToDelete = Array.from(checkedBoxes).map(cb => cb.value).filter(qr => qr && qr !== '-');
    if (qrsToDelete.length === 0) return alert("Tidak ada item valid.");

    if (!confirm(`⚠️ PERINGATAN: Hapus permanen ${qrsToDelete.length} item hold ini dari database?`)) return;

    const btn = document.getElementById('btn-hapus-hold-lvl6');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menghapus...'; btn.disabled = true; }

    try {
        const { error } = await db.from('hasil_stbj_langsir').delete().in('qrcode', qrsToDelete);
        if (error) throw error;

        rawDataRaw = rawDataRaw.filter(r => !qrsToDelete.includes(r.qrcode));
        alert(`✅ SUKSES!\n${qrsToDelete.length} kardus hold telah dihapus permanen.`);
        renderMobileView();
    } catch (e) {
        alert("Gagal menghapus: " + e.message);
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        lucide.createIcons();
    }
};

function renderMobileView() {
    const container = document.getElementById('view-grid');
    const lvl6Footer = document.getElementById('mobile-lvl6-footer');

    // Kontrol Tampilan Footer Freeze Level 6
    if (lvl6Footer) {
        if ((modeSekarang === 'grid' || modeSekarang === 'mobile') && mobileLevel === 6) {
            lvl6Footer.classList.remove('hidden');
            lvl6Footer.style.display = 'flex';
            
            const cbAllLvl6 = document.getElementById('cb-all-lvl6');
            if (cbAllLvl6) cbAllLvl6.checked = false;

            const btnCancelStbj = document.getElementById('btn-cancel-stbj-lvl6');
            const groupBtnHold = document.getElementById('group-btn-hold-lvl6');

            if (mobileSelectedSource === 'HOLD') {
                if(btnCancelStbj) btnCancelStbj.classList.add('hidden');
                if(groupBtnHold) { groupBtnHold.classList.remove('hidden'); groupBtnHold.style.display = 'flex'; }
            } else {
                if(btnCancelStbj) btnCancelStbj.classList.remove('hidden');
                if(groupBtnHold) { groupBtnHold.classList.add('hidden'); groupBtnHold.style.display = 'none'; }
            }
        } else {
            lvl6Footer.classList.add('hidden');
            lvl6Footer.style.display = 'none';
        }
    }

    let allItems = getAllUnifiedItems().filter(r => {
        if (gridFilterDate) {
            const rowCreatedDate = (r.created_at || '').split('T')[0];
            const rowProdDate = (r.tglProduksi || '');
            if (rowCreatedDate !== gridFilterDate && rowProdDate !== gridFilterDate) return false;
        }
        return matchesActiveFilters(r);
    });

    // BAR FILTER TANGGAL YANG SELALU MUNCUL DI SEMUA TINGKATAN GRID
    let topFilterBarHtml = `
        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 mb-2 shrink-0">
            <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1 shadow-inner">
                <i data-lucide="calendar" class="w-4 h-4 text-slate-400 ml-1"></i>
                <input type="date" id="filter-date-mobile" value="${gridFilterDate}" onchange="handleGridDateChange(this.value)" class="p-1 text-xs font-bold text-slate-700 outline-none cursor-pointer bg-transparent">
                <button onclick="setGridAllDate()" class="px-2.5 py-1 ${gridFilterDate === '' ? 'bg-blue-600 text-white font-black' : 'bg-slate-200 text-slate-700 font-bold'} hover:bg-blue-700 hover:text-white rounded-lg text-[10px] uppercase transition">Semua</button>
            </div>

            <button onclick="bukaModalFilterPopup()" class="px-4 py-2 bg-white rounded-xl border border-slate-300 shadow-sm active:scale-95 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-2">
                <i data-lucide="filter" class="w-4 h-4 text-blue-600"></i>
                <span>Filter</span>
            </button>
        </div>
    `;

    if (allItems.length === 0) {
        container.innerHTML = topFilterBarHtml + `
            <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center mt-1">
                <i data-lucide="package-x" class="w-12 h-12 text-slate-300 mb-2"></i>
                <h4 class="font-bold text-slate-700 text-sm">Tidak ada data STBJ untuk filter ini</h4>
            </div>`;
        lucide.createIcons();
        return;
    }

    let html = topFilterBarHtml;

    // LEVEL 1: KOTAK KISI
    if (mobileLevel === 1) {
        let totalScan = 0, totalManual = 0, totalHold = 0;
        allItems.forEach(r => {
            if (r.status.includes('HOLD')) totalHold += r.qty;
            if (r.source === 'SCAN') totalScan += r.qty;
            else if (r.source === 'MANUAL') totalManual += r.qty;
        });

        html += `<div class="flex justify-between items-center mb-1 px-1">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-wider">Pilih Kategori STBJ</h3>
            <span class="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">${totalScan + totalManual} Total Dus</span>
        </div>`;

        html += `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div onclick="goToMobileLevel2('ALL')" class="bg-white border border-blue-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm active:scale-95 transition cursor-pointer hover:bg-blue-50 h-36">
                <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md"><i data-lucide="layers" class="w-5 h-5"></i></div>
                <div><h4 class="font-black text-slate-800 text-sm leading-tight">Hasil Scan + Manual</h4><p class="text-[11px] font-black text-blue-600 mt-1">${totalScan + totalManual} Dus</p></div>
            </div>
            <div onclick="goToMobileLevel2('SCAN')" class="bg-white border border-indigo-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm active:scale-95 transition cursor-pointer hover:bg-indigo-50 h-36">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md"><i data-lucide="qr-code" class="w-5 h-5"></i></div>
                <div><h4 class="font-black text-slate-800 text-sm leading-tight">Hasil Scan Saja</h4><p class="text-[11px] font-black text-indigo-600 mt-1">${totalScan} Dus</p></div>
            </div>
            <div onclick="goToMobileLevel2('MANUAL')" class="bg-white border border-purple-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm active:scale-95 transition cursor-pointer hover:bg-purple-50 h-36">
                <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md"><i data-lucide="keyboard" class="w-5 h-5"></i></div>
                <div><h4 class="font-black text-slate-800 text-sm leading-tight">Manual Saja</h4><p class="text-[11px] font-black text-purple-600 mt-1">${totalManual} Dus</p></div>
            </div>
            <div onclick="goToMobileLevel2('HOLD')" class="bg-white border border-amber-300 p-4 rounded-2xl flex flex-col justify-between shadow-sm active:scale-95 transition cursor-pointer hover:bg-amber-50 h-36">
                <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md"><i data-lucide="pause-circle" class="w-5 h-5"></i></div>
                <div><h4 class="font-black text-slate-800 text-sm leading-tight">Tabel Hold</h4><p class="text-[11px] font-black text-amber-700 mt-1">${totalHold} Dus</p></div>
            </div>
        </div>`;
    }

    // LEVEL 2: TANGGAL PRODUKSI
    else if (mobileLevel === 2) {
        let sourceLabel = mobileSelectedSource === 'ALL' ? 'Hasil Scan + Manual' : (mobileSelectedSource === 'SCAN' ? 'Hasil Scan Saja' : (mobileSelectedSource === 'MANUAL' ? 'Input Manual Saja' : 'Tabel Hold'));
        let dataLvl2 = allItems.filter(r => {
            if (mobileSelectedSource === 'SCAN') return r.source === 'SCAN';
            if (mobileSelectedSource === 'MANUAL') return r.source === 'MANUAL';
            if (mobileSelectedSource === 'HOLD') return r.status.includes('HOLD');
            return true;
        });

        let tglMap = {};
        dataLvl2.forEach(r => { tglMap[r.tglProduksi] = (tglMap[r.tglProduksi] || 0) + r.qty; });

        html += makeStickyHeader(sourceLabel, "Pilih Tanggal Produksi");
        Object.keys(tglMap).sort().reverse().forEach(tgl => {
            html += makeDrillCard(tgl, "Tanggal Produksi", tglMap[tgl], `goToMobileLevel3('${tgl}')`, 'calendar');
        });
    }

    // LEVEL 3: MESIN & SHIFT
    else if (mobileLevel === 3) {
        let dataLvl3 = allItems.filter(r => {
            if (mobileSelectedSource === 'SCAN' && r.source !== 'SCAN') return false;
            if (mobileSelectedSource === 'MANUAL' && r.source !== 'MANUAL') return false;
            if (mobileSelectedSource === 'HOLD' && !r.status.includes('HOLD')) return false;
            return r.tglProduksi === mobileSelectedTgl;
        });

        let msMap = {};
        dataLvl3.forEach(r => {
            let key = `${r.mesin}_${r.shift}`;
            msMap[key] = (msMap[key] || 0) + r.qty;
        });

        html += makeStickyHeader(`Tgl: ${mobileSelectedTgl}`, "Pilih Mesin & Shift");
        Object.keys(msMap).sort().forEach(key => {
            let [m, s] = key.split('_');
            html += makeDrillCard(`Mesin ${m} • Shift ${s}`, "Produksi Harian", msMap[key], `goToMobileLevel4('${key}')`, 'settings');
        });
    }

    // LEVEL 4: ITEM SPEC
    else if (mobileLevel === 4) {
        let [mSel, sSel] = mobileSelectedMesinShift.split('_');
        let dataLvl4 = allItems.filter(r => {
            if (mobileSelectedSource === 'SCAN' && r.source !== 'SCAN') return false;
            if (mobileSelectedSource === 'MANUAL' && r.source !== 'MANUAL') return false;
            if (mobileSelectedSource === 'HOLD' && !r.status.includes('HOLD')) return false;
            return r.tglProduksi === mobileSelectedTgl && r.mesin === mSel && r.shift === sSel;
        });

        let itemMap = {};
        dataLvl4.forEach(r => {
            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            itemMap[key] = (itemMap[key] || 0) + r.qty;
        });

        html += makeStickyHeader(`M${mSel}/S${sSel} • ${mobileSelectedTgl}`, "Pilih Item");
        Object.keys(itemMap).sort().forEach(key => {
            let [nama, pjg, grade, dus] = key.split('_');
            html += makeDrillCard(`${nama} - ${pjg} - ${grade} - ${dus}`, "Spesifikasi", itemMap[key], `goToMobileLevel5('${key}')`, 'box');
        });
    }

    // LEVEL 5: SHADING
    else if (mobileLevel === 5) {
        let [mSel, sSel] = mobileSelectedMesinShift.split('_');
        let [namaSel, pjgSel, gradeSel, dusSel] = mobileSelectedItemSpec.split('_');

        let dataLvl5 = allItems.filter(r => {
            if (mobileSelectedSource === 'SCAN' && r.source !== 'SCAN') return false;
            if (mobileSelectedSource === 'MANUAL' && r.source !== 'MANUAL') return false;
            if (mobileSelectedSource === 'HOLD' && !r.status.includes('HOLD')) return false;
            return r.tglProduksi === mobileSelectedTgl && r.mesin === mSel && r.shift === sSel &&
                   r.namaItem === namaSel && r.panjang === pjgSel && r.grade === gradeSel && r.dus === dusSel;
        });

        let shadingMap = {};
        dataLvl5.forEach(r => { shadingMap[r.shading] = (shadingMap[r.shading] || 0) + r.qty; });

        html += makeStickyHeader(`${namaSel} - ${pjgSel}`, "Pilih Shading");
        Object.keys(shadingMap).sort().forEach(shading => {
            html += makeDrillCard(shading, "Shading", shadingMap[shading], `goToMobileLevel6('${shading}')`, 'palette');
        });
    }

    // LEVEL 6: DETAIL ITEM FISIK
    else if (mobileLevel === 6) {
        let [mSel, sSel] = mobileSelectedMesinShift.split('_');
        let [namaSel, pjgSel, gradeSel, dusSel] = mobileSelectedItemSpec.split('_');

        let detailItems = allItems.filter(r => {
            if (mobileSelectedSource === 'SCAN' && r.source !== 'SCAN') return false;
            if (mobileSelectedSource === 'MANUAL' && r.source !== 'MANUAL') return false;
            if (mobileSelectedSource === 'HOLD' && !r.status.includes('HOLD')) return false;
            return r.tglProduksi === mobileSelectedTgl && r.mesin === mSel && r.shift === sSel &&
                   r.namaItem === namaSel && r.panjang === pjgSel && r.grade === gradeSel && r.dus === dusSel &&
                   r.shading === mobileSelectedShading;
        });

        let displayItem = `${namaSel} - ${pjgSel} - ${gradeSel} - ${dusSel}`;
        html += makeStickyHeader(displayItem, `Shading: ${mobileSelectedShading} (${detailItems.length} Record)`);

        detailItems.forEach(d => {
            const waktuSTBJ = formatWIB(d.created_at);
            let badgeClass = d.status === 'IN GUDANG' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : (d.status.includes('HOLD') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200');

            html += `
                <div class="card-stbj-lvl6 bg-white border border-slate-300 rounded-2xl p-4 mb-2 shadow-sm flex flex-col">
                    <div class="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" value="${d.qrcode}" data-source="${d.source}" onchange="highlightLvl6Card(this)" class="cb-stbj-lvl6 cursor-pointer w-5 h-5 accent-blue-600 rounded border-slate-400">
                            <span class="font-black text-sm text-orange-600 uppercase">Customer Bawaan: ${d.customer}</span>
                        </label>
                        <span class="font-bold px-2.5 py-0.5 text-[10px] rounded-md border ${badgeClass} uppercase">${d.status}</span>
                    </div>
                    
                    ${d.qrcode !== '-' ? `<div class="font-mono font-black text-slate-900 text-sm break-all bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-center mb-3">${d.qrcode}</div>` : `<div class="font-black text-purple-700 text-xs uppercase bg-purple-50 p-2 rounded-xl border border-purple-200 text-center mb-3">INPUT MANUAL</div>`}
                    
                    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Waktu Input / STBJ</span><span class="font-bold text-slate-700">${waktuSTBJ}</span></div>
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Troli</span><span class="font-black text-slate-800">${d.troli}</span></div>
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Qty Dus</span><span class="font-black text-emerald-700 text-sm">${d.qty} Dus</span></div>
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">PIC Input / Cancel</span><span class="font-bold text-blue-700 uppercase">${d.pic}</span></div>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-500">Keterangan: <strong class="text-slate-700">${d.keterangan}</strong></div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ========================================================
// LOGIKA FILTER DROPDOWN & DESKTOP SYNC
// ========================================================
function updateFilterDropdowns() {
    const fields = [
        { id: 'fs-tgl', key: 'tglProduksi' },
        { id: 'fs-status', key: 'status' },
        { id: 'fs-troli', key: 'troli' },
        { id: 'fs-mesin', key: 'mesin' },
        { id: 'fs-shift', key: 'shift' },
        { id: 'fs-jenis', key: 'jenisItem' },
        { id: 'fs-nama', key: 'namaItem' },
        { id: 'fs-pjg', key: 'panjang' },
        { id: 'fs-grade', key: 'grade' },
        { id: 'fs-dus', key: 'dus' },
        { id: 'fs-shading', key: 'shading' },
        { id: 'fs-customer', key: 'customer' },
        { id: 'fs-pic', key: 'pic' }
    ];

    let allItems = getAllUnifiedItems();

    fields.forEach(field => {
        const select = document.getElementById(field.id);
        if (!select) return;
        
        const currentVal = select.value;
        const uniqueVals = [...new Set(allItems.map(d => d[field.key] || '-'))].filter(x => x && x !== '-').sort();

        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => { html += `<option value="${val}">${val}</option>`; });
        select.innerHTML = html;

        if (uniqueVals.includes(currentVal)) select.value = currentVal;
    });
}

window.resetFilterSTBJ = function() {
    ['fs-tgl', 'fs-status', 'fs-qr', 'fs-troli', 'fs-mesin', 'fs-shift', 'fs-jenis', 'fs-nama', 'fs-pjg', 'fs-grade', 'fs-dus', 'fs-shading', 'fs-customer', 'fs-pic'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    activeFilters = {};
    saringTabelSTBJ();
};

window.saringTabelSTBJ = function() {
    const getVal = id => document.getElementById(id)?.value || '';

    const mappings = [
        { id: 'fs-tgl', col: 'col-tgl' },
        { id: 'fs-status', col: 'col-status' },
        { id: 'fs-troli', col: 'col-troli' },
        { id: 'fs-mesin', col: 'col-mesin' },
        { id: 'fs-shift', col: 'col-shift' },
        { id: 'fs-jenis', col: 'col-jenis' },
        { id: 'fs-nama', col: 'col-nama' },
        { id: 'fs-pjg', col: 'col-pjg' },
        { id: 'fs-grade', col: 'col-grade' },
        { id: 'fs-dus', col: 'col-dus' },
        { id: 'fs-shading', col: 'col-shading' },
        { id: 'fs-customer', col: 'col-customer' },
        { id: 'fs-pic', col: 'col-pic' }
    ];

    mappings.forEach(m => {
        const val = getVal(m.id);
        if (val) activeFilters[m.col] = [val];
        else delete activeFilters[m.col];
    });

    const qrVal = getVal('fs-qr').toLowerCase().trim();
    if (qrVal) activeFilters['col-qr-text'] = qrVal;
    else delete activeFilters['col-qr-text'];

    if (modeSekarang === 'grid' || modeSekarang === 'mobile') {
        renderMobileView();
    } else {
        applyFilters();
        updateFilterIcons();
    }
};

// ========================================================
// LOGIKA TABEL DESKTOP (MODE ITEM VS MODE LENGKAP)
// ========================================================
function switchStatusFilter(val) { 
    statusSekarang = val; 
    muatDataDariSupabase(); 
}

function buildProcessedData() {
    processedData = [];
    selectedRows.clear(); 

    let groups = {};
    rawDataRaw.forEach(r => {
        let n = r.nama_item || '-';
        let jName = n;
        let jId = '';
        
        if(jasperData && jasperData.length > 0) {
            const cJasper = jasperData.find(j => j.nama_item === r.nama_item && j.panjang === r.panjang && j.grade === r.grade);
            if(cJasper) { jName = cJasper.nama_jasper; jId = cJasper.id; } 
            else { jName = `JAS-${r.nama_item}`; }
        } else { jName = `JAS-${r.nama_item}`; }
        
        let ket = r.keterangan || 'TANPA_KETERANGAN';
        let sData = r.status_data || 'BELUM';
        let cust = r.customer || '-';
        let itemStatus = r.status || '-';
        if (itemStatus === 'STBJ' || itemStatus === 'SUDAH STBJ') itemStatus = 'SUDAH STBJ';
        else if (itemStatus === 'HOLD' || itemStatus === 'HOLD STBJ') itemStatus = 'HOLD STBJ';
        
        let pjgFormatted = formatPanjang(r.panjang);
        
        // Pembeda Grouping Berdasarkan Mode Item vs Mode Lengkap
        let key = '';
        if (modeTabelView === 'item') {
            key = `${r.jenis_item}_${n}_${pjgFormatted}_${r.grade}_${r.dus}_${r.shading}_${cust}_${ket}_${sData}_${itemStatus}`;
        } else {
            key = `${r.jenis_item}_${n}_${pjgFormatted}_${r.grade}_${r.dus}_${r.shading}_${cust}_${r.tgl_produksi}_${r.mesin}_${r.shift}_${ket}_${sData}_${itemStatus}`;
        }
        
        if(!groups[key]) {
            groups[key] = { 
                jenisItem: r.jenis_item || '-', namaItemAsli: n, displayNama: jName, jasperId: jId, 
                panjang: pjgFormatted, grade: r.grade || '-', dus: r.dus || '-', shading: r.shading || '-', customer: cust,
                tglProduksi: modeTabelView === 'item' ? '-' : (r.tgl_produksi || '-'), 
                mesin: modeTabelView === 'item' ? '-' : (r.mesin || '-'), 
                shift: modeTabelView === 'item' ? '-' : (r.shift || '-'),
                qty: 0, qrcodes: [], trolis: new Set(), ket: ket, sData: sData, status: itemStatus, pic: r.pic_input || '-' 
            };
        }
        groups[key].qty++; 
        groups[key].qrcodes.push(r.qrcode);
        if(r.troli) groups[key].trolis.add(r.troli);
    });

    processedData = Object.values(groups).map(g => {
        const gabunganTroli = modeTabelView === 'item' ? '-' : (Array.from(g.trolis).join(', ') || '-');
        const displayKet = (g.ket === 'TANPA_KETERANGAN') ? '-' : g.ket; 
        let statData = g.sData && g.sData !== 'BELUM' ? g.sData : '-';
        let qtyLembar = hitungQtyLembar(g.jenisItem, g.namaItemAsli, g.qty);

        return {
            _id: g.qrcodes.join(','),
            raw: g,
            searchValues: {
                'col-status': g.status,
                'col-status-data': statData,
                'col-troli': gabunganTroli,
                'col-tgl': g.tglProduksi,
                'col-mesin': g.mesin,
                'col-shift': g.shift,
                'col-jenis': g.jenisItem,
                'col-nama': g.namaItemAsli,
                'col-jasper': g.displayNama,
                'col-pjg': g.panjang,
                'col-grade': g.grade,
                'col-dus': g.dus,
                'col-shading': g.shading,
                'col-customer': g.customer,
                'col-qty': g.qty.toString(),
                'col-qty-lembar': qtyLembar.toString(),
                'col-ket': displayKet,
                'col-qr': g.qrcodes.join(' '),
                'col-pic': g.pic
            }
        };
    });

    applyFilters();
}

function applyFilters() {
    filteredData = processedData.filter(row => {
        for (let colClass in activeFilters) {
            if (colClass === 'col-qr-text') {
                const qrVal = activeFilters['col-qr-text'];
                const qr = (row.searchValues['col-qr'] || '').toLowerCase();
                if (!qr.includes(qrVal)) return false;
                continue;
            }
            const allowed = activeFilters[colClass];
            const val = row.searchValues[colClass] || '';
            if (!allowed.includes(val)) return false;
        }
        return true;
    });
    applySort();
}

function applySort() {
    if (sortState.col) {
        filteredData.sort((a, b) => {
            let valA = a.searchValues[sortState.col] || '';
            let valB = b.searchValues[sortState.col] || '';
            let numA = parseFloat(valA); let numB = parseFloat(valB);
            let res = 0;
            if (!isNaN(numA) && !isNaN(numB)) res = numA - numB;
            else res = String(valA).localeCompare(String(valB));
            return sortState.isAsc ? res : -res;
        });
    }
    currentPage = 1;
    renderTable();
}

function sortTable(colClass, headerEl) {
    let isAsc = sortState.col === colClass ? !sortState.isAsc : true;
    sortState = { col: colClass, isAsc: isAsc };
    applySort();
    
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
}

const thSort = (label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb', 'col-btn', 'col-btn-edit'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    return `<th class="hdr-std ${cls} ${isHidden} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable('${colClass}', this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable('${colClass}', this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                ${filterBtn}
            </div>
        </div>
    </th>`;
};

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation();
    currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    processedData.forEach(row => {
        let show = true;
        for (let c in activeFilters) {
            if (c !== colClass && c !== 'col-qr-text' && !activeFilters[c].includes(row.searchValues[c])) {
                show = false; break;
            }
        }
        if (show) uniqueValues.add(row.searchValues[colClass] || '');
    });

    let sortedValues = Array.from(uniqueValues).sort();
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = true;
        if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml;
    updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    menu.classList.remove('hidden');
    
    const btnRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 256; 
    let topPos = btnRect.bottom + 4; 
    let leftPos = btnRect.left; 

    if (leftPos + menuWidth > window.innerWidth) leftPos = btnRect.right - menuWidth;
    if (leftPos < 10) leftPos = 10;

    menu.style.position = 'fixed'; 
    menu.style.top = `${topPos}px`;
    menu.style.left = `${leftPos}px`;
    
    document.getElementById('filter-search-input').focus();
}

function toggleAllFilterValues(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    updateSelectAllState();
}

function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.filter-val-cb');
    const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
}

document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) updateSelectAllState(); });

window.searchFilterList = function(val) {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        const query = val.toLowerCase().split(' ').filter(x => x); 
        requestAnimationFrame(() => {
            document.querySelectorAll('.filter-val-item').forEach(label => {
                const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
                let matches = query.every(term => text.includes(term));
                label.style.display = matches ? '' : 'none';
            });
        });
    }, 150);
};

function closeFilterMenu() { document.getElementById('excel-filter-menu').classList.add('hidden'); }

function clearFilterForCurrentCol() { 
    delete activeFilters[currentFilterCol]; 
    closeFilterMenu(); 
    applyFilters(); 
    updateFilterIcons(); 
}

function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked');
    const totalBoxes = document.querySelectorAll('.filter-val-cb');
    
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') {
        delete activeFilters[currentFilterCol];
    } else {
        let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value));
        activeFilters[currentFilterCol] = selectedVals;
    }
    
    closeFilterMenu(); 
    applyFilters(); 
    updateFilterIcons();
}

function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-amber-400', 'opacity-100');
        icon.classList.add('opacity-40', 'text-white');
    });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            const icon = th.querySelector('.filter-icon');
            if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); }
        }
    }
}

function hitungQtyLembar(jenis, nama, qtyDus) {
    if (!qtyDus) return 0;
    let j = (jenis || '').toUpperCase();
    let n = (nama || '').trim().toUpperCase();
    
    if (j === 'PLAFON') return qtyDus * 15;
    
    if (j === 'LIST' || j === 'LIS') {
        if (lisData && lisData.length > 0) {
            let sortedLis = [...lisData].sort((a, b) => {
                let lenA = (a.nama_item_lis || a.nama_item || '').length;
                let lenB = (b.nama_item_lis || b.nama_item || '').length;
                return lenB - lenA;
            });

            let found = sortedLis.find(l => {
                let lisName = (l.nama_item_lis || l.nama_item || '').trim().toUpperCase();
                return lisName !== '' && (n.includes(lisName) || lisName === n);
            });

            if (found && found.qty_isi) {
                return qtyDus * parseInt(found.qty_isi);
            }
        }
        if (n.includes('PROFILE IV') || n.includes('PROFILE V')) return qtyDus * 60;
        if (n.includes('PROFILE II')) return qtyDus * 48;
        if (n.includes('PROFILE I')) return qtyDus * 140;
        if (n.includes('CONNECTOR')) return qtyDus * 80;
        return qtyDus * 24; 
    }
    return 0;
}

window.cycleSelectAll = function() {
    selectAllState = (selectAllState + 1) % 3;
    if (selectAllState === 0) {
        selectedRows.clear();
    } else if (selectAllState === 1) {
        selectedRows.clear();
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        filteredData.slice(startIndex, endIndex).forEach(r => selectedRows.add(r._id));
    } else if (selectAllState === 2) {
        filteredData.forEach(r => selectedRows.add(r._id));
    }
    updateSelectAllUI();
    renderTable(); 
};

function updateSelectAllUI() {
    const btn = document.getElementById('btn-select-all');
    if(!btn) return;
    
    if (selectAllState === 0) {
        btn.innerHTML = '';
        btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto';
    } else if (selectAllState === 1) {
        btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto';
    } else if (selectAllState === 2) {
        btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto';
    }
    lucide.createIcons();
}

window.highlightRow = function(cb, id) {
    if (cb.checked) selectedRows.add(id);
    else selectedRows.delete(id);
    
    if(!cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    updateSelectedCount();
};

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-stbj');
    
    let productionHeaders = '';
    if (modeTabelView === 'lengkap') {
        productionHeaders = `
            ${thSort('Troli', 'col-troli text-center')}
            ${thSort('Tgl Produksi', 'col-tgl text-center')}
            ${thSort('Mesin', 'col-mesin text-center')}
            ${thSort('Shift', 'col-shift text-center')}
        `;
    }

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
            </th>
            <th class="hdr-std col-status hidden">Status Data</th>
            ${thSort('Collect', 'col-status-data text-center')}
            <th class="hdr-std col-waktu hidden">Waktu Scan</th>
            ${productionHeaders}
            <th class="hdr-std col-qr hidden">QRCode</th>
            ${thSort('Jenis Item', 'col-jenis')}
            ${thSort('Nama Item', 'col-nama')}
            ${thSort('Nama Jasper', 'col-jasper text-purple-300')}
            <th class="hdr-std w-10 text-center col-btn-edit ${hiddenCols.includes('col-btn-edit')?'col-hidden':''}">Edit</th>
            ${thSort('Panjang', 'col-pjg text-center')}
            ${thSort('Grade', 'col-grade text-center')}
            ${thSort('Dus', 'col-dus text-center')}
            ${thSort('Shading', 'col-shading text-center')}
            ${thSort('Customer Bawaan', 'col-customer')}
            ${thSort('QTY (DUS)', 'col-qty text-center')}
            ${thSort('QTY (LEMBAR)', 'col-qty-lembar text-center')}
            ${thSort('Keterangan', 'col-ket text-center')}
            <th class="hdr-std col-pic hidden">PIC Input</th>
        </tr>`;
    
    buildProcessedData();
}

function renderTable() {
    const tbody = document.getElementById('tbody-stbj');
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginated = filteredData.slice(startIndex, endIndex);

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="22" class="px-4 py-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
        updatePaginationUI();
        return;
    }

    let h = '';
    paginated.forEach((row, i) => {
        const isSelected = selectedRows.has(row._id);
        const stripeClass = i % 2 === 0 ? 'stripe-1' : 'stripe-2';
        const trClass = `transition text-row text-[13px] ${stripeClass} ${isSelected ? 'selected-row' : ''}`;
        
        const r = row.raw;
        const sv = row.searchValues;
        
        let statDataHtml = sv['col-status-data'] !== '-' ? `<span class="text-indigo-600 font-medium uppercase">${sv['col-status-data']}</span>` : '-';
        
        const jData = encodeURIComponent(JSON.stringify({
            id: r.jasperId, nama_item: r.namaItemAsli, panjang: r.panjang, grade: r.grade, nama_jasper: r.displayNama
        }));
        let btnEditJasper = `<td class="px-4 py-3 text-center col-btn-edit ${hiddenCols.includes('col-btn-edit')?'col-hidden':''}"><button onclick="bukaModalKatalogForm(true, '${jData}')" class="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition shadow-sm mx-auto flex"><i data-lucide="edit-3" class="w-4 h-4"></i></button></td>`;

        let productionColsHtml = '';
        if (modeTabelView === 'lengkap') {
            productionColsHtml = `
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-troli ${hiddenCols.includes('col-troli')?'col-hidden':''}">${sv['col-troli']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}">${sv['col-tgl']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}">${sv['col-mesin']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}">${sv['col-shift']}</td>
            `;
        }

        h += `
            <tr class="${trClass}">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${row._id}')" value="${row._id}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 hidden col-status">${sv['col-status']}</td>
                <td class="px-4 py-3 text-center col-status-data ${hiddenCols.includes('col-status-data')?'col-hidden':''}">${statDataHtml}</td>
                <td class="px-4 py-3 hidden col-waktu">-</td>
                ${productionColsHtml}
                <td class="px-4 py-3 hidden col-qr">-</td>
                <td class="px-4 py-3 text-left font-medium text-slate-900 col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}">${sv['col-jenis']}</td>
                <td class="px-4 py-3 text-left font-semibold text-slate-900 col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}">${sv['col-nama']}</td>
                <td class="px-4 py-3 text-left font-black text-purple-700 col-jasper ${hiddenCols.includes('col-jasper')?'col-hidden':''}">${sv['col-jasper']}</td>
                ${btnEditJasper}
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}">${sv['col-pjg']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}">${sv['col-grade']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}">${sv['col-dus']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}">${sv['col-shading']}</td>
                <td class="px-4 py-3 text-left font-medium text-slate-900 col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}">${sv['col-customer']}</td>
                <td class="px-4 py-3 text-center font-black text-emerald-600 col-qty ${hiddenCols.includes('col-qty')?'col-hidden':''}">${sv['col-qty']}</td>
                <td class="px-4 py-3 text-center font-black text-emerald-600 col-qty-lembar ${hiddenCols.includes('col-qty-lembar')?'col-hidden':''}">${sv['col-qty-lembar']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}">${sv['col-ket']}</td>
                <td class="px-4 py-3 hidden col-pic">-</td>
            </tr>`;
    });
    
    tbody.innerHTML = h;
    applyColumnOrder();
    lucide.createIcons();
    updatePaginationUI();
}

function updatePaginationUI() {
    const totalFiltered = filteredData.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    let sumQty = 0;
    filteredData.forEach(r => { sumQty += parseInt(r.searchValues['col-qty']) || 0; });

    document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    document.getElementById('lbl-total-qty').innerText = sumQty;
    document.getElementById('lbl-halaman').innerText = currentPage;
    document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    updateSelectedCount();
}

function changeRowsPerPage(val) {
    rowsPerPage = (val === 'ALL') ? 999999 : parseInt(val);
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    renderTable();
}

function prevPage() { if(currentPage > 1) { currentPage--; renderTable(); } }
function nextPage() { 
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    if(currentPage < totalPages) { currentPage++; renderTable(); } 
}

function updateSelectedCount() {
    const lbl = document.getElementById('lbl-pilih-baris');
    if(lbl) lbl.innerText = selectedRows.size;
}

// ========================================================
// FUNGSI AKSI MASSAL & KATALOG
// ========================================================
function bukaDaftarKatalog() {
    renderKatalogList();
    document.getElementById('modal-list-katalog').classList.remove('hidden');
}

function renderKatalogList() {
    const tbody = document.getElementById('tbody-katalog-list');
    if (!jasperData || jasperData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold border-b border-slate-200">Katalog Jasper Kosong di Database.</td></tr>'; 
        return;
    }

    let html = '';
    jasperData.forEach((d, i) => {
        const jData = encodeURIComponent(JSON.stringify(d));
        const searchStr = `${d.nama_item} ${d.panjang} ${d.grade} ${d.nama_jasper}`.toLowerCase();
        html += `
        <tr class="hover:bg-slate-50 transition text-center row-katalog border-b border-slate-200" data-search="${searchStr}">
            <td class="p-2 border-r border-slate-200">
                <button onclick="bukaModalKatalogForm(true, '${jData}')" class="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md shadow-sm transition active:scale-95 mx-auto flex" title="Edit Baris Ini">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
            </td>
            <td class="p-3 font-bold text-slate-400 border-r border-slate-200">${i+1}</td>
            <td class="p-3 font-black text-black text-left border-r border-slate-200">${d.nama_item}</td>
            <td class="p-3 font-black text-black border-r border-slate-200">${d.panjang || '-'}</td>
            <td class="p-3 font-black text-black border-r border-slate-200">${d.grade || '-'}</td>
            <td class="p-3 font-black text-purple-700 bg-purple-50/50">${d.nama_jasper}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    lucide.createIcons(); 
}

function saringKatalogList() {
    const query = document.getElementById('f-kat-search').value.toLowerCase();
    document.querySelectorAll('.row-katalog').forEach(row => {
        const text = row.getAttribute('data-search');
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function bukaModalKatalogForm(isEdit = false, encodedData = null) {
    document.getElementById('modal-list-katalog').classList.add('hidden');
    document.getElementById('modal-katalog').classList.remove('hidden');
    
    const title = document.getElementById('title-modal-jasper');
    title.innerHTML = isEdit 
        ? '<i data-lucide="edit" class="w-4 h-4 text-purple-600"></i> EDIT DATA JASPER' 
        : '<i data-lucide="plus-circle" class="w-4 h-4 text-purple-600"></i> TAMBAH JASPER BARU';
    
    if(isEdit && encodedData) {
        const d = JSON.parse(decodeURIComponent(encodedData));
        document.getElementById('j-id').value = d.id || ''; 
        document.getElementById('j-nama').value = d.nama_item || '';
        document.getElementById('j-pjg').value = d.panjang || '';
        document.getElementById('j-grade').value = d.grade || '';
        document.getElementById('j-output').value = d.nama_jasper || '';
    } else {
        document.getElementById('j-id').value = '';
        document.getElementById('j-nama').value = '';
        document.getElementById('j-pjg').value = '';
        document.getElementById('j-grade').value = '';
        document.getElementById('j-output').value = '';
    }
}

function tutupModalJasperForm() { document.getElementById('modal-katalog').classList.add('hidden'); }

async function simpanDataJasper() {
    const id = document.getElementById('j-id').value;
    const nama = document.getElementById('j-nama').value.trim();
    const pjg = document.getElementById('j-pjg').value.trim();
    const grade = document.getElementById('j-grade').value.trim();
    const output = document.getElementById('j-output').value.trim();

    if(!nama || !output) return alert("PERHATIAN: Nama Item Master dan Nama Output Jasper Wajib Diisi!");

    const btn = document.getElementById('btn-save-jasper');
    const oriTxt = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...';
    btn.disabled = true;

    const payload = { nama_item: nama, panjang: pjg, grade: grade, nama_jasper: output };

    try {
        let errorRes;
        if(id) {
            const { error } = await db.from('nama_jasper').update(payload).eq('id', id);
            errorRes = error;
        } else {
            const { error } = await db.from('nama_jasper').insert([payload]);
            errorRes = error;
        }

        if(errorRes) throw errorRes;
        
        tutupModalJasperForm();
        await loadKamusDanJasper(); 
        renderKatalogList(); 
        muatDataDariSupabase(); 
    } catch(e) {
        alert("GAGAL MENYIMPAN: " + e.message);
    } finally {
        btn.innerHTML = oriTxt; btn.disabled = false; lucide.createIcons();
    }
}

async function aksiMassal(tipe) {
    let checkedValues = [];
    selectedRows.forEach(id => {
        id.split(',').forEach(v => { if(v) checkedValues.push(v); });
    });
    
    if(checkedValues.length === 0) return alert("Centang baris tabel terlebih dahulu!");

    if(tipe === 'salin') {
        let textSalin = "";
        const headers = Array.from(document.querySelectorAll('#thead-stbj th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn') && !th.classList.contains('col-btn-edit'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        let exportData = filteredData.filter(r => selectedRows.has(r._id));
        exportData.forEach(row => {
            const sv = row.searchValues;
            const rowData = [];
            headers.forEach(h => {
                let colClass = '';
                if(h === 'Collect') colClass = 'col-status-data';
                else if(h === 'Troli') colClass = 'col-troli';
                else if(h === 'Tgl Produksi') colClass = 'col-tgl';
                else if(h === 'Mesin') colClass = 'col-mesin';
                else if(h === 'Shift') colClass = 'col-shift';
                else if(h === 'Jenis Item') colClass = 'col-jenis';
                else if(h === 'Nama Item') colClass = 'col-nama';
                else if(h === 'Nama Jasper') colClass = 'col-jasper';
                else if(h === 'Pjg' || h === 'Panjang') colClass = 'col-pjg';
                else if(h === 'Grade') colClass = 'col-grade';
                else if(h === 'Dus') colClass = 'col-dus';
                else if(h === 'Shading') colClass = 'col-shading';
                else if(h === 'Customer Bawaan') colClass = 'col-customer';
                else if(h === 'QTY (DUS)') colClass = 'col-qty';
                else if(h === 'QTY (LEMBAR)') colClass = 'col-qty-lembar';
                else if(h === 'Keterangan') colClass = 'col-ket';
                else if(h === 'PIC Input') colClass = 'col-pic';

                if(colClass) {
                    let val = sv[colClass] || '-';
                    let cleanVal = String(val).replace(/<[^>]*>?/gm, '').trim();
                    rowData.push(cleanVal);
                }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        
        navigator.clipboard.writeText(textSalin);
        alert(`Tersalin! Buka Excel dan Paste (Ctrl+V).`);
    } 
    else if(tipe === 'hold') {
        const act = prompt(`Pilih Aksi untuk ${checkedValues.length} item:\n1 = Ubah ke HOLD STBJ\n2 = UNHOLD (Kembali ke STBJ)\n3 = Ubah ke HOLD LANGSIR`);
        if (act === null) return;
        
        let newStatus = '';
        if (act === '1') newStatus = 'HOLD STBJ';
        else if (act === '2') newStatus = 'STBJ';
        else if (act === '3') newStatus = 'HOLD LANGSIR';
        else return alert("Pilihan tidak valid. Ketik 1, 2, atau 3.");

        const { error } = await db.from('hasil_stbj_langsir')
            .update({
                status: newStatus,
                keterangan: `Status diubah ke ${newStatus} oleh ${currentUser.username}`,
                pic_input: currentUser.username
            })
            .in('qrcode', checkedValues);

        if(!error) {
            alert(`Berhasil mengubah status menjadi ${newStatus} (PIC: ${currentUser.username})`);
            muatDataDariSupabase();
        } else {
            alert("Gagal update status: " + error.message);
        }
    }
    else if (tipe === 'collect') {
        if(!confirm(`Tandai ${checkedValues.length} QrCode sebagai COLLECTED oleh ${currentUser.username}?`)) return;
        const btn = document.getElementById('btn-massal-collect');
        const btnMob = document.getElementById('btn-massal-collect-mob');
        if(btn) { btn.innerHTML = '<div class="bg-indigo-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-indigo-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-indigo-700 transition">Collect</div>'; btn.disabled = true; }
        if(btnMob) { btnMob.innerHTML = '<i data-lucide="check-square" class="w-4 h-4 text-indigo-700"></i> Memproses...'; btnMob.disabled = true; }
        
        let updates = [];
        checkedValues.forEach(qr => {
            let row = rawDataRaw.find(r => r.qrcode === qr);
            if(row) {
                let currentCollect = row.status_data || '';
                let newCollect = currentCollect;
                
                if(currentCollect === 'BELUM' || currentCollect === 'Collected' || currentCollect === '') {
                    newCollect = currentUser.username;
                } else {
                    let users = currentCollect.split(',').map(u => u.trim());
                    if(!users.includes(currentUser.username)) {
                        newCollect = users.join(', ') + `, ${currentUser.username}`;
                    }
                }
                updates.push({ qrcode: qr, status_data: newCollect });
            }
        });

        try {
            const chunkSize = 50;
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize);
                await Promise.all(chunk.map(u => db.from('hasil_stbj_langsir').update({ status_data: u.status_data }).eq('qrcode', u.qrcode)));
            }
            await muatDataDariSupabase();
        } catch (error) {
            alert("Gagal Update: " + error.message);
        }
        
        if(btn) { btn.innerHTML = '<div class="bg-indigo-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="check-square" class="w-4 h-4"></i></div><div class="bg-indigo-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-indigo-700 transition">Collect</div>'; btn.disabled = false; }
        if(btnMob) { btnMob.innerHTML = '<i data-lucide="check-square" class="w-4 h-4 text-indigo-700"></i> Collect'; btnMob.disabled = false; }
        lucide.createIcons();
    }
    else if(tipe === 'hapus') {
        const userRole = (currentUser.role || '').toLowerCase();
        const isSuperOrCreator = ['creator', 'super admin', 'superadmin'].includes(userRole);
        if(!isSuperOrCreator) {
            return alert("Akses ditolak! Hanya Creator dan Super Admin yang dapat menghapus data.");
        }

        if(!confirm(`Yakin ingin menghapus permanen ${checkedValues.length} data ini dari database?`)) return;
        
        const btn = document.getElementById('btn-hapus-mob'); 
        const ori = btn ? btn.innerHTML : '';
        if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Proses...'; btn.disabled = true; }

        try {
            const { error } = await db.from('hasil_stbj_langsir').delete().in('qrcode', checkedValues);
            if(error) throw error;
            
            alert(`Berhasil menghapus ${checkedValues.length} data.`);
            await muatDataDariSupabase();
        } catch(e) { 
            alert("Gagal hapus: " + e.message); 
        } finally {
            if(btn) { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
        }
    }
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
        
        let ws_data = [];
        const activeHeaders = [];
        
        document.querySelectorAll('#thead-stbj th').forEach(th => {
            if(window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn') && !th.classList.contains('col-btn-edit')) {
                const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
                let headerText = th.innerText.trim().replace(/\n/g, ' ');
                activeHeaders.push({ text: headerText, colClass: colClass });
            }
        });

        ws_data.push(activeHeaders.map(h => h.text));

        let exportData = filteredData.filter(r => selectedRows.has(r._id));
        exportData.forEach(row => {
            const sv = row.searchValues;
            const rowData = [];
            activeHeaders.forEach(h => {
                let val = sv[h.colClass] || '-';
                let cleanVal = String(val).replace(/<[^>]*>?/gm, '').trim();
                rowData.push(cleanVal);
            });
            ws_data.push(rowData);
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "STBJ_Data");
        XLSX.writeFile(wb, `STBJ_${statusSekarang}_${modeTabelView.toUpperCase()}.xlsx`);
    }
}

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;
    const table = document.getElementById('table-stbj-main');
    if(!table) return;
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cells = Array.from(row.children);
        if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb'));
        const cellMap = {};
        cells.forEach(c => {
            const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-'));
            if (colClass) cellMap[colClass] = c;
        });

        row.innerHTML = ''; 
        if (cbCell) row.appendChild(cbCell); 

        userColOrder.forEach(colId => { if (cellMap[colId]) row.appendChild(cellMap[colId]); });
        cells.forEach(c => {
            const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-'));
            if (colClass !== 'col-cb' && !userColOrder.includes(colClass)) { row.appendChild(c); }
        });
    });
}

File 3: riwayat_langsir.html (FULL FILE UTUH)

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>WMS - Riwayat Langsir</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    
    <script src="global.js"></script>
    
    <style>
        html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden !important; touch-action: pan-y; background-color: #f8fafc; }
        .custom-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .table-container { position: relative; }
        .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .tab-active { border-bottom: 3px solid #1e40af; color: #1e40af; font-weight: 900; background-color: #eff6ff; }
        .tab-inactive { color: #64748b; font-weight: 700; border-bottom: 3px solid transparent; }

        .hdr-std { 
            text-align: center !important; 
            padding: 0.5rem 0.75rem !important; 
            font-size: 0.75rem !important; 
            font-weight: 600 !important; 
            text-transform: uppercase !important; 
            letter-spacing: 0.05em !important; 
            white-space: nowrap !important; 
            border-bottom: 1px solid #e2e8f0 !important; 
            background-clip: padding-box !important; 
        }

        tr.selected-row td { background-color: #ccfbf1 !important; color: #0f766e !important; }
    </style>
</head>
<body class="font-sans text-slate-800">

    <div class="flex flex-col h-full w-full absolute inset-0 pt-[104px] z-10">
        
        <!-- HEADER SECTION -->
        <div class="shrink-0 bg-white flex flex-col z-20 border-b border-slate-200">
            <div class="flex border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar">
                <button onclick="gantiModeRiwayat('qr')" id="tab-r-qr" class="px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase"><i data-lucide="list" class="w-4 h-4"></i> Detail QRCode</button>
                <button onclick="gantiModeRiwayat('agregasi')" id="tab-r-agregasi" class="px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase"><i data-lucide="bar-chart-2" class="w-4 h-4"></i> Rangkuman Item & Qty</button>
                <button onclick="gantiModeRiwayat('hold')" id="tab-r-hold" class="px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase"><i data-lucide="pause-circle" class="w-4 h-4"></i> Tabel Hold</button>
            </div>

            <div class="p-3 sm:p-4 flex items-center justify-between bg-slate-50/50 border-t border-slate-100 w-full">
                <div class="flex gap-2 items-center">
                    <button onclick="bukaModalGantiArea()" id="btn-ganti-area" class="group flex items-stretch shrink-0 cursor-pointer shadow-sm active:scale-95 transition rounded-md overflow-hidden border border-orange-600">
                        <div class="bg-orange-700 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="map-pin" class="w-4 h-4"></i></div>
                        <div class="bg-orange-600 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-orange-500 transition">Ganti Area</div>
                    </button>

                    <button onclick="bukaModalSTBJ()" class="group flex items-stretch shrink-0 cursor-pointer shadow-sm active:scale-95 transition rounded-md overflow-hidden border border-purple-700">
                        <div class="bg-purple-800 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="table" class="w-4 h-4"></i></div>
                        <div class="bg-purple-600 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-purple-500 transition">Data STBJ</div>
                    </button>
                </div>

                <div class="relative ml-auto">
                    <button onclick="toggleActionMenu(event)" class="p-2.5 bg-white rounded-md border border-slate-300 shadow-sm active:scale-95 text-slate-600 hover:bg-slate-50 transition" title="Menu Aksi">
                        <i data-lucide="menu" class="w-5 h-5"></i>
                    </button>
                    <div id="mobile-action-menu" class="hidden absolute right-0 top-full mt-2 w-48 bg-white shadow-xl rounded-md border border-slate-200 z-50 flex flex-col overflow-hidden">
                        <button onclick="cancelLangsir(); toggleActionMenu(event)" id="btn-cancel-langsir-mob" class="text-left px-4 py-3 border-b border-slate-100 text-xs font-bold text-rose-600 flex items-center gap-2 hover:bg-slate-50 transition"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> Cancel Langsir</button>
                        <button onclick="hapusBarisHold(); toggleActionMenu(event)" id="btn-hapus-hold-mob" class="hidden text-left px-4 py-3 border-b border-slate-100 text-xs font-bold text-red-600 flex items-center gap-2 hover:bg-slate-50 transition"><i data-lucide="trash-2" class="w-4 h-4"></i> Hapus Permanen</button>
                        <button onclick="salinDataTabel(); toggleActionMenu(event)" class="text-left px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition"><i data-lucide="copy" class="w-4 h-4 text-slate-500"></i> Salin Data</button>
                        <button onclick="downloadXLS(); toggleActionMenu(event)" class="text-left px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition"><i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i> Export Excel</button>
                        <button onclick="bukaModalTableDesign(); toggleActionMenu(event)" class="text-left px-4 py-3 text-xs font-bold text-purple-700 flex items-center gap-2 hover:bg-slate-50 transition"><i data-lucide="palette" class="w-4 h-4 text-purple-600"></i> Table Design</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MIDDLE SCROLL SECTION -->
        <div class="flex-1 min-h-0 bg-slate-100 p-4 overflow-hidden flex flex-col relative z-0">
            <div class="flex-1 min-h-0 overflow-y-auto custom-scroll table-container bg-white rounded-t-xl shadow-sm border border-slate-300">
                <table class="w-full text-left whitespace-nowrap" id="main-table">
                    <thead class="sticky top-0 z-50 shadow-sm" id="thead-riwayat"></thead>
                    <tbody id="tbody-riwayat" class="text-slate-800"></tbody>
                </table>
            </div>
        </div>

        <!-- FOOTER PAGINATION -->
        <div class="shrink-0 w-full bg-white p-2 sm:p-3 flex flex-col md:flex-row justify-between items-center gap-4 z-20 shadow-[0_-5px_15px_-3px_rgba(0,0,0,0.1)] border-t border-slate-300">
            <div class="flex items-center gap-2 flex-wrap justify-center">
                <span class="bg-blue-50 border border-blue-200 px-2.5 py-1 rounded text-blue-800 text-[11px] font-bold shadow-sm">Tampil Filter: <span id="lbl-tampil-baris" class="text-blue-900 font-medium ml-1">0</span></span>
                <span class="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-amber-800 text-[11px] font-bold shadow-sm">Total Qty (Dus): <span id="lbl-total-qty" class="text-amber-900 font-medium ml-1">0</span></span>
                <span class="bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded text-emerald-800 text-[11px] font-bold shadow-sm">Dipilih: <span id="lbl-pilih-baris" class="text-emerald-900 font-medium ml-1">0</span></span>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-1 bg-white border border-slate-300 p-1 rounded shadow-sm">
                    <span class="text-[10px] font-bold text-slate-500 uppercase px-1">Baris:</span>
                    <select id="select-rows-per-page" onchange="changeRowsPerPage(this.value)" class="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 rounded outline-none cursor-pointer px-1 py-0.5 transition">
                        <option value="10" selected>10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="ALL">Semua</option>
                        <option value="CUSTOM">Isi Sendiri...</option>
                    </select>
                    <input type="number" id="input-custom-rows" oninput="setCustomRowsPerPage(this.value)" class="hidden w-16 text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 rounded outline-none px-1 py-0.5 text-center transition" placeholder="Jml...">
                </div>
                <div class="flex items-center gap-2 bg-white border border-slate-300 p-1 rounded shadow-sm">
                    <button onclick="prevPage()" class="p-1 px-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 active:scale-95 transition"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                    <span class="px-2 font-black text-xs text-slate-600 tracking-wide uppercase">Hal <span id="lbl-halaman" class="text-blue-600">1</span> / <span id="lbl-total-halaman">1</span></span>
                    <button onclick="nextPage()" class="p-1 px-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 active:scale-95 transition"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>

    </div>

    <!-- MODAL FILTER EXCEL -->
    <div id="excel-filter-menu" class="hidden fixed bg-white shadow-2xl border border-slate-300 rounded-lg w-64 z-[100] flex flex-col font-sans text-sm overflow-hidden">
        <div class="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <span class="font-black text-slate-700 text-xs uppercase tracking-wider" id="filter-col-name">Filter</span>
            <button onclick="closeFilterMenu()" class="text-slate-400 hover:text-red-500 bg-white border border-slate-200 p-1 rounded transition shadow-sm"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        </div>
        <div class="p-2 border-b border-slate-200 bg-white">
            <div class="relative">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-2.5 top-2"></i>
                <input type="text" id="filter-search-input" oninput="searchFilterList(this.value)" class="w-full pl-8 p-1.5 text-xs font-bold border border-slate-300 rounded focus:border-blue-500 outline-none transition" placeholder="Cari Spesifik...">
            </div>
        </div>
        <div class="p-2 max-h-48 overflow-y-auto flex flex-col gap-1 text-xs bg-white custom-scroll" id="filter-values-list"></div>
        <div class="p-2 border-t border-slate-200 bg-slate-50 flex justify-between gap-2">
            <button onclick="clearFilterForCurrentCol()" class="w-1/2 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 transition shadow-sm">Reset</button>
            <button onclick="applyFilterForCurrentCol()" class="w-1/2 py-2 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition shadow-sm">Terapkan</button>
        </div>
    </div>

    <!-- MODAL GANTI AREA -->
    <div id="modal-ganti-area" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/40 z-[80] px-4 backdrop-blur-sm">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200">
            <h3 class="text-base font-semibold mb-1 flex items-center gap-2 text-slate-800"><i data-lucide="map-pin" class="text-orange-600 w-5 h-5"></i> Ganti Area Penyimpanan</h3>
            <p class="text-xs text-slate-500 mb-6 border-b border-slate-100 pb-3" id="teks-info-area">Memilih X kardus untuk dipindah.</p>
            <div class="mb-6">
                <label class="block text-xs font-semibold text-slate-600 mb-2">Pindah Ke Area Baru</label>
                <select id="select-new-area" class="w-full p-2.5 border border-slate-300 rounded-md outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-slate-800 uppercase cursor-pointer bg-white text-sm transition">
                    <option value="">-- PILIH AREA --</option>
                </select>
            </div>
            <div class="flex justify-end gap-2">
                <button type="button" onclick="tutupModalArea()" class="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-md transition text-sm">Batal</button>
                <button type="button" onclick="eksekusiGantiArea()" id="btn-eks-area" class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md shadow-sm transition flex items-center gap-2 text-sm"><i data-lucide="save" class="w-4 h-4"></i> Simpan</button>
            </div>
        </div>
    </div>

    <!-- MODAL STBJ GUDANG -->
    <div id="modal-stbj-langsir" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/40 z-[70] px-4 backdrop-blur-sm">
        <div class="bg-white shadow-2xl w-full max-w-6xl border border-slate-200 flex flex-col max-h-[85vh] rounded-xl overflow-hidden">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 class="font-semibold text-slate-800 flex items-center gap-2 text-base"><i data-lucide="table" class="w-5 h-5 text-purple-600"></i> Data Hasil STBJ Gudang</h3>
                <button onclick="tutupModalSTBJ()" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 transition rounded-md"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                <div class="relative">
                    <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
                    <input type="text" id="f-stbj-modal" oninput="saringTabelModalSTBJ()" class="w-full pl-9 p-2.5 text-sm border border-slate-200 rounded-md outline-none focus:border-purple-500 transition bg-white" placeholder="Cari QRCode, Troli, Item, Customer, dll...">
                </div>
            </div>
            <div class="overflow-y-auto flex-1 hide-scrollbar p-3 bg-slate-100">
                <div id="tbody-stbj-modal" class="flex flex-col gap-0"></div>
            </div>
        </div>
    </div>

    <!-- MODAL TABEL HOLD -->
    <div id="modal-hold-langsir" class="hidden fixed inset-0 flex items-center justify-center bg-slate-900/40 z-[70] px-4 backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[85vh]">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 class="font-semibold text-slate-800 flex items-center gap-2 text-base"><i data-lucide="archive" class="w-5 h-5 text-amber-600"></i> Tabel Hold</h3>
                <button onclick="tutupModalHold()" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 transition rounded-md"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="flex border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar px-2 pt-2">
                <button onclick="bukaModalHold('hold_stbj')" id="tab-hold-stbj" class="pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold">Hold STBJ</button>
                <button onclick="bukaModalHold('hold_langsir')" id="tab-hold-langsir" class="pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold">Hold Langsir</button>
            </div>
            <div class="overflow-y-auto flex-1 custom-scroll p-3 bg-slate-100">
                <div id="tbody-hold-modal" class="flex flex-col gap-0"></div>
            </div>
        </div>
    </div>

    <script src="wms_parser.js"></script>
    <script src="riwayat_langsir_logic.js"></script>
</body>
</html>

File 4: riwayat_langsir_logic.js (FULL FILE UTUH)

let modeRiwayat = 'qr'; 
let logLangsirRaw = []; 
let holdLangsirRaw = [];
let kamusData = []; 
let areaData = []; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
let selectAllState = 0; // 0: none, 1: page, 2: all filtered

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

// Helper untuk mendapatkan timestamp ISO 8601 dengan offset WIB (+07:00) yang akurat
function getWIBTimestamp() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = wib.getFullYear();
    const mm = pad(wib.getMonth() + 1);
    const dd = pad(wib.getDate());
    const hh = pad(wib.getHours());
    const min = pad(wib.getMinutes());
    const ss = pad(wib.getSeconds());
    
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+07:00`;
}

// Helper untuk memformat tampilan waktu ke format WIB Indonesia (DD/MM/YYYY HH:mm)
function formatWIB(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
}

// Ekspos fungsi modal ke window agar bisa dipanggil dari HTML
window.tutupModalArea = function() { document.getElementById('modal-ganti-area').classList.add('hidden'); };
window.tutupModalSTBJ = function() { document.getElementById('modal-stbj-langsir').classList.add('hidden'); };
window.tutupModalHold = function() { document.getElementById('modal-hold-langsir').classList.add('hidden'); };
window.tutupSemuaPopup = function() { window.tutupModalArea(); window.tutupModalSTBJ(); window.tutupModalHold(); };

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                window.closeFilterMenu();
            }
        }

        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    setTimeout(async () => {
        const { data: mk } = await db.from('master_2').select('*'); 
        if(mk) {
            kamusData = mk;
            window.masterData = { kamus: mk }; 
        }
        
        const { data: ma } = await db.from('master_area').select('nama_area'); 
        if(ma) {
            areaData = ma.map(m => m.nama_area);
            const selArea = document.getElementById('select-new-area');
            if(selArea) {
                selArea.innerHTML = '<option value="">-- PILIH AREA --</option>';
                areaData.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }
        await window.ambilSemuaData();
        window.gantiModeRiwayat('qr');
    }, 200);
});

window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-riwayat');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].getAttribute('data-search') || a.cells[colIndex].innerText.trim(); 
        let valB = b.cells[colIndex].getAttribute('data-search') || b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    window.applyPagination();
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center">
            <div class="flex items-center justify-center w-full">${label}</div>
        </th>`;
    }

    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="window.sortTable(${idx}, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="window.sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="window.openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
};

window.ambilSemuaData = async function() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    try {
        const { data, error } = await db.from('hasil_stbj_langsir')
            .select('*')
            .in('status', ['IN GUDANG', 'HOLD LANGSIR'])
            .order('waktu_langsir', { ascending: false });

        if (error) throw error;

        logLangsirRaw = (data || []).filter(r => r.status === 'IN GUDANG');
        holdLangsirRaw = (data || []).filter(r => r.status === 'HOLD LANGSIR');

        window.renderTabelRiwayat();
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center text-red-500 font-medium">Error: ${e.message}</td></tr>`; 
    }
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-riwayat tr.r-row').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol]; const c = row.querySelector('.' + otherCol);
                let t = c ? (c.getAttribute('data-search') || c.innerText.trim()) : '';
                if (!allowed.includes(t)) { showBasedOnOthers = false; break; }
            }
        }
        if (showBasedOnOthers) {
            let cell = row.querySelector('.' + colClass);
            if (cell) { let val = cell.getAttribute('data-search') || cell.innerText.trim(); if(val !== '') uniqueValues.add(val); }
        }
    });

    let sortedValues = Array.from(uniqueValues).sort();
    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0"> <span class="font-black text-slate-800">(PILIH SEMUA)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = !activeFilters[colClass] || activeFilters[colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate font-bold text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; window.updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        const btnRect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 256; 
        let topPos = btnRect.bottom + 4; 
        let leftPos = btnRect.left; 

        if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
        if (leftPos < 10) { leftPos = 10; }

        menu.style.position = 'fixed'; 
        menu.style.top = `${topPos}px`;
        menu.style.left = `${leftPos}px`;
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    window.updateSelectAllState();
};

window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};

window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
};

window.closeFilterMenu = function() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); };
window.clearFilterForCurrentCol = function() { delete activeFilters[currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    window.closeFilterMenu(); window.saringTabelExcel(); 
};

window.saringTabelExcel = function() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowedValues.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }
    });
    selectAllState = 0;
    window.updateSelectAllUI();
    currentPage = 1; window.applyPagination(); window.updateFilterIcons();
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { 
        icon.classList.remove('text-amber-400', 'opacity-100'); 
        icon.classList.add('text-white', 'opacity-40'); 
    });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { 
            const icon = th.querySelector('.filter-icon'); 
            if (icon) { 
                icon.classList.remove('text-white', 'opacity-40'); 
                icon.classList.add('text-amber-400', 'opacity-100'); 
            } 
        }
    }
};

window.gantiModeRiwayat = function(m) {
    modeRiwayat = m;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    ['qr', 'agregasi', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-r-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    const btnGA = document.getElementById('btn-ganti-area'); if(btnGA) btnGA.classList.toggle('hidden', m !== 'qr');
    const btnCL = document.getElementById('btn-cancel-langsir'); if(btnCL) btnCL.classList.toggle('hidden', m !== 'qr');
    const btnCLMob = document.getElementById('btn-cancel-langsir-mob'); if(btnCLMob) btnCLMob.classList.toggle('hidden', m !== 'qr');
    
    const userRole = (currentUser.role || '').toLowerCase();
    const isSuperOrCreator = ['creator', 'super admin', 'superadmin'].includes(userRole);
    const showHapus = (m === 'hold' && isSuperOrCreator);
    
    const btnHHMob = document.getElementById('btn-hapus-hold-mob'); if(btnHHMob) btnHHMob.classList.toggle('hidden', !showHapus);

    activeFilters = {}; window.updateFilterIcons();
    window.renderTabelRiwayat();
};

window.cycleSelectAll = function() {
    selectAllState = (selectAllState + 1) % 3;
    window.updateSelectAllUI();
    window.applySelection();
};

window.updateSelectAllUI = function() {
    const btn = document.getElementById('btn-select-all');
    if(!btn) return;
    
    if (selectAllState === 0) {
        btn.innerHTML = '';
        btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto';
    } else if (selectAllState === 1) {
        btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto';
    } else if (selectAllState === 2) {
        btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto';
    }
    lucide.createIcons();
};

window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = false; window.highlightRow(cb, true); }
        });
    } else if (selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = false; window.highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.cb-row');
                if(cb) { cb.checked = true; window.highlightRow(cb, true); }
            }
        });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = true; window.highlightRow(cb, true); }
        });
    }
    window.updateSelectedCount();
};

window.highlightRow = function(cb, skipStateReset = false) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    
    if(!skipStateReset && !cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        window.updateSelectAllUI();
    }
    
    if(!skipStateReset) window.updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        rowsPerPage = 999999; 
        if(customInput) customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        if(customInput) {
            customInput.classList.remove('hidden');
            customInput.focus();
            let customVal = parseInt(customInput.value);
            rowsPerPage = (customVal > 0) ? customVal : rowsPerPage;
        }
    } else {
        rowsPerPage = parseInt(val);
        if(customInput) customInput.classList.add('hidden');
    }
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    window.applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        rowsPerPage = parsed;
        localStorage.setItem('wms_rows_per_page', rowsPerPage);
        currentPage = 1;
        window.applyPagination();
    }
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    let sumQty = 0;

    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1');
        else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty');
        if (qtyCell && modeRiwayat === 'agregasi') { 
            sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 
        } else { 
            sumQty += 1; 
        }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    const emptyRow = document.getElementById('empty-row-langsir');
    if(emptyRow) emptyRow.style.display = totalFiltered === 0 ? '' : 'none';

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (selectAllState === 1) {
        selectAllState = 0;
        window.updateSelectAllUI();
    }
    
    window.applySelection();
    window.updateSelectedCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; window.applyPagination(); } };
window.nextPage = function() { 
    const totalVisible = document.querySelectorAll('#tbody-riwayat tr.r-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; window.applyPagination(); } 
};

window.updateSelectedCount = function() {
    const count = document.querySelectorAll('.cb-row:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
};

window.renderTabelRiwayat = function() {
    try {
        const thead = document.getElementById('thead-riwayat'); const tbody = document.getElementById('tbody-riwayat');
        if(!thead || !tbody) return;
        sortState = {}; 
        selectAllState = 0;

        const rowClassBase = "transition r-row text-[13px]";

        if(modeRiwayat === 'qr' || modeRiwayat === 'hold') {
            const isHold = modeRiwayat === 'hold'; const dataset = isHold ? holdLangsirRaw : logLangsirRaw;
            
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb text-center sticky-col">
                        <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                    </th>
                    ${window.thSort(1, 'Waktu Langsir', 'col-waktu')}
                    ${window.thSort(2, 'Troli', 'col-troli')}
                    ${window.thSort(3, 'Area', 'col-area')}
                    ${window.thSort(4, 'QRCode', 'col-qr')}
                    ${window.thSort(5, 'Tgl Produksi', 'col-tgl')}
                    ${window.thSort(6, 'Mesin', 'col-mesin')}
                    ${window.thSort(7, 'Shift', 'col-shift')}
                    ${window.thSort(8, 'Jenis Item', 'col-jenis')}
                    ${window.thSort(9, 'Nama Item', 'col-nama')}
                    ${window.thSort(10, 'Panjang', 'col-pjg')}
                    ${window.thSort(11, 'Grade', 'col-grade')}
                    ${window.thSort(12, 'Dus', 'col-dus')}
                    ${window.thSort(13, 'Shading', 'col-shading')}
                    ${window.thSort(14, 'Customer Bawaan', 'col-customer')}
                    ${window.thSort(15, 'Keterangan', 'col-ket')}
                    ${window.thSort(16, 'PIC Input / Cancel', 'col-pic')}
                </tr>`;
            
            if(!dataset || dataset.length === 0) { 
                tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="17" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; 
                window.applyPagination(); 
                return; 
            }
            
            let h = '';
            dataset.forEach((r) => {
                const tgl = formatWIB(r.waktu_langsir || r.created_at);
                h += `
                    <tr class="${rowClassBase}">
                        <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="window.highlightRow(this)" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                        <td class="px-4 py-3 text-slate-600 font-medium text-left col-waktu" data-search="${tgl}">${tgl}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-troli" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                        <td class="px-4 py-3 text-left col-area" data-search="${r.posisi || '-'}"><span class="text-emerald-600 font-bold">${r.posisi || '-'}</span></td>
                        <td class="px-4 py-3 font-mono font-medium text-slate-800 tracking-wider text-left col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer" data-search="${r.customer || '-'}">${r.customer || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                        <td class="px-4 py-3 font-bold uppercase text-xs text-blue-700 text-left col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        } 
        else if(modeRiwayat === 'agregasi') {
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb text-center sticky-col">
                        <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                    </th>
                    ${window.thSort(1, 'Area', 'col-area')}
                    ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                    ${window.thSort(3, 'Nama Item', 'col-nama')}
                    ${window.thSort(4, 'Panjang', 'col-pjg')}
                    ${window.thSort(5, 'Grade', 'col-grade')}
                    ${window.thSort(6, 'Dus', 'col-dus')}
                    ${window.thSort(7, 'Shading', 'col-shading')}
                    ${window.thSort(8, 'Customer Bawaan', 'col-customer')}
                    ${window.thSort(9, 'PIC', 'col-pic')}
                    ${window.thSort(10, 'QTY TOTAL (DUS)', 'col-qty')}
                </tr>`;

            let groups = {};
            logLangsirRaw.forEach(r => {
                let key = `${r.posisi}_${r.jenis_item}_${r.nama_item}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.customer}_${r.pic_input}`;
                if(!groups[key]) groups[key] = { area: r.posisi, jenis: r.jenis_item, nama: r.nama_item, pjg: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, customer: r.customer, pic: r.pic_input, qty: 0 };
                groups[key].qty++;
            });

            let arr = Object.values(groups);
            if(arr.length === 0) { 
                tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="11" class="p-8 text-center font-medium text-slate-400">Kosong.</td></tr>`; 
                window.applyPagination(); 
                return; 
            }

            let h = '';
            arr.forEach((r) => {
                h += `
                    <tr class="${rowClassBase}">
                        <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="window.highlightRow(this)" value="agg" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                        <td class="px-4 py-3 text-left col-area" data-search="${r.area}"><span class="text-emerald-600 font-bold">${r.area}</span></td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                        <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama}">${r.nama}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade}">${r.grade}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus}">${r.dus}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading}">${r.shading}</td>
                        <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer" data-search="${r.customer}">${r.customer}</td>
                        <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
                        <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty" data-search="${r.qty}">${r.qty}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        }
        
        tbody.innerHTML += `<tr id="empty-row-langsir" style="display:none;"><td colspan="22" class="p-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
        
        lucide.createIcons(); 
        window.updateSelectAllUI();
        window.saringTabelExcel();
    } catch(err) { console.error("Gagal Render Tabel:", err); }
};

// Cancel Langsir + Menyimpan PIC yang membatalkan
window.cancelLangsir = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); if(checkedBoxes.length === 0) return alert("Pilih minimal 1 baris!");
    if(!confirm(`Batal Langsir untuk ${checkedBoxes.length} kardus ini?\nData akan dihapus dari gudang (stok_global & stok_aktual) dan statusnya di hasil_stbj_langsir dikembalikan ke 'HOLD LANGSIR' oleh ${currentUser.username}.`)) return;
    
    const btn = document.getElementById('btn-cancel-langsir'); 
    const ori = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = 'Proses...'; btn.disabled = true; }

    let arrFisik = []; 
    let mapDeduct = {};
    const wibNow = getWIBTimestamp();
    const cancelKet = `Cancel Langsir oleh ${currentUser.username}`;
    
    checkedBoxes.forEach(cb => {
        const qr = cb.value; 
        const r = logLangsirRaw.find(x => x.qrcode === qr);
        if(r) {
            arrFisik.push(qr);

            let keyAkt = `${r.nama_item}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.posisi}_${r.customer}`;
            if(!mapDeduct[keyAkt]) mapDeduct[keyAkt] = { nama_item: r.nama_item, pjg: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, area: r.posisi, customer_aktual: r.customer, qty: 0 };
            mapDeduct[keyAkt].qty++;
        }
    });

    try {
        const { error: errStok } = await db.from('stok_qr').delete().in('qrcode', arrFisik);
        if(errStok) throw errStok;

        const { error: errGlobal } = await db.from('stok_global').delete().in('qrcode', arrFisik);
        if(errGlobal) throw errGlobal;

        const { error: errHasil } = await db.from('hasil_stbj_langsir')
            .update({ 
                status: 'HOLD LANGSIR', 
                keterangan: cancelKet, 
                waktu_langsir: wibNow,
                pic_input: currentUser.username 
            })
            .in('qrcode', arrFisik);
        if(errHasil) throw errHasil;

        for(let key in mapDeduct) {
            let item = mapDeduct[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.pjg).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).limit(1);
            
            if(existing && existing.length > 0) {
                let newQty = existing[0].qty - item.qty;
                if (newQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', existing[0].id);
                } else {
                    await db.from('stok_aktual').update({ qty: newQty }).eq('id', existing[0].id);
                }
            }
        }
        
        await window.ambilSemuaData();
        alert(`SUKSES!\n\n${arrFisik.length} item berhasil di-cancel oleh ${currentUser.username}, dihapus dari stok gudang, dan statusnya dikembalikan ke 'HOLD LANGSIR'.`);
    } catch (e) { 
        alert("Gagal Cancel Langsir: " + e.message); 
    } finally { 
        if(btn) { btn.innerHTML = ori; btn.disabled = false; } 
        lucide.createIcons(); 
    }
};

// Hapus Baris Hold (Khusus Creator & Super Admin)
window.hapusBarisHold = async function() {
    const userRole = (currentUser.role || '').toLowerCase();
    const isSuperOrCreator = ['creator', 'super admin', 'superadmin'].includes(userRole);
    if (!isSuperOrCreator) {
        return alert("Akses ditolak! Hanya Creator dan Super Admin yang berhak menghapus data Hold / Cancel Langsir.");
    }

    const checked = document.querySelectorAll('.cb-row:checked'); if(checked.length === 0) return alert("Pilih baris!");
    if(!confirm(`⚠️ PERINGATAN: Hapus permanen ${checked.length} data hold ini dari database?`)) return;
    
    try {
        const { error } = await db.from('hasil_stbj_langsir').delete().in('qrcode', Array.from(checked).map(cb => cb.value));
        if (error) throw error;
        await window.ambilSemuaData();
        alert("Berhasil menghapus data hold.");
    } catch(e) { alert("Gagal: " + e.message); }
};

window.bukaModalGantiArea = function() {
    if(modeRiwayat !== 'qr') return alert("Hanya bisa dilakukan di mode DETAIL QRCODE.");
    const cek = document.querySelectorAll('.cb-row:checked'); if(cek.length === 0) return alert("Pilih baris!");
    document.getElementById('teks-info-area').innerText = `Anda akan memindahkan ${cek.length} kardus ke lokasi baru.`;
    document.getElementById('select-new-area').value = ''; document.getElementById('modal-ganti-area').classList.remove('hidden');
};

window.eksekusiGantiArea = async function() {
    const newArea = document.getElementById('select-new-area').value; if(!newArea) return alert("Pilih Area Tujuan!");
    const btn = document.getElementById('btn-eks-area'); let original = btn ? btn.innerHTML : 'Simpan';
    if(btn) { btn.innerHTML = 'Menyimpan...'; btn.disabled = true; }

    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); 
    const qrsToUpdate = Array.from(checkedBoxes).map(cb => cb.value);
    
    try {
        let mapDeduct = {};
        let mapAdd = {};
        
        for(let qr of qrsToUpdate) {
            let dbRow = logLangsirRaw.find(r => r.qrcode === qr);
            if(dbRow) {
                const oldArea = dbRow.posisi || '-';
                
                let id_sku_old = `${oldArea}_${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${dbRow.customer}_-`;
                let id_sku_baru = `${newArea}_${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${dbRow.customer}_-`;
                
                await db.from('stok_qr').update({ area: newArea, id_sku: id_sku_baru }).eq('qrcode', qr);
                await db.from('stok_global').update({ area: newArea, id_sku: id_sku_baru }).eq('qrcode', qr);
                await db.from('hasil_stbj_langsir').update({ posisi: newArea }).eq('qrcode', qr);
                
                let keyOld = `${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${oldArea}_${dbRow.customer}`;
                if(!mapDeduct[keyOld]) mapDeduct[keyOld] = { nama_item: dbRow.nama_item, pjg: dbRow.panjang, grade: dbRow.grade, dus: dbRow.dus, shading: dbRow.shading, area: oldArea, customer_aktual: dbRow.customer, qty: 0 };
                mapDeduct[keyOld].qty++;

                let keyNew = `${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${newArea}_${dbRow.customer}`;
                if(!mapAdd[keyNew]) mapAdd[keyNew] = { id_sku: id_sku_baru, jenis_item: dbRow.jenis_item, nama_item: dbRow.nama_item, panjang: dbRow.panjang, grade: dbRow.grade, dus: dbRow.dus, shading: dbRow.shading, area: newArea, customer_bawaan: dbRow.customer, customer_aktual: dbRow.customer, keterangan: '-', qty: 0 };
                mapAdd[keyNew].qty++;
            }
        }

        for(let key in mapDeduct) {
            let item = mapDeduct[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.pjg).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).limit(1);
            
            if(existing && existing.length > 0) {
                let newQty = existing[0].qty - item.qty;
                if (newQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', existing[0].id);
                } else {
                    await db.from('stok_aktual').update({ qty: newQty }).eq('id', existing[0].id);
                }
            }
        }

        for(let key in mapAdd) {
            let item = mapAdd[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).limit(1);
            
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + item.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([item]);
            }
        }

        window.tutupModalArea();
        alert(`✅ BERHASIL!\n\n${qrsToUpdate.length} item berhasil dipindahkan ke area "${newArea}" dan saldo stok_aktual diperbarui.`);
        await window.ambilSemuaData();
    } catch (error) {
        alert("Gagal memindahkan area: " + error.message);
    } finally {
        if(btn) { btn.innerHTML = original; btn.disabled = false; }
        lucide.createIcons();
    }
};

window.salinDataTabel = function() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin dengan mencentang kotak di kiri data!");

    let copyString = "";
    if (modeRiwayat === 'agregasi') {
        copyString = "Area\tJenis Item\tNama Item\tPjg\tGrade\tDus\tShading\tCustomer Bawaan\tPIC\tQTY\n";
        cek.forEach(cb => {
            const tr = cb.closest('tr');
            copyString += `${tr.querySelector('.col-area').innerText}\t${tr.querySelector('.col-jenis').innerText}\t${tr.querySelector('.col-nama').innerText}\t${tr.querySelector('.col-pjg').innerText}\t${tr.querySelector('.col-grade').innerText}\t${tr.querySelector('.col-dus').innerText}\t${tr.querySelector('.col-shading').innerText}\t${tr.querySelector('.col-customer').innerText}\t${tr.querySelector('.col-pic').innerText}\t${tr.querySelector('.col-qty').innerText}\n`;
        });
    } else {
        copyString = "Waktu Langsir\tTroli\tArea\tQRCode\tTgl Produksi\tMesin\tShift\tNama Item\tPjg\tGrade\tDus\tShading\tCustomer\tKeterangan\tPIC\n";
        cek.forEach(cb => {
            const tr = cb.closest('tr');
            copyString += `${tr.querySelector('.col-waktu')?.innerText || '-'}\t${tr.querySelector('.col-troli')?.innerText || '-'}\t${tr.querySelector('.col-area')?.innerText || '-'}\t${tr.querySelector('.col-qr')?.innerText || '-'}\t${tr.querySelector('.col-tgl')?.innerText || '-'}\t${tr.querySelector('.col-mesin')?.innerText || '-'}\t${tr.querySelector('.col-shift')?.innerText || '-'}\t${tr.querySelector('.col-nama')?.innerText || '-'}\t${tr.querySelector('.col-pjg')?.innerText || '-'}\t${tr.querySelector('.col-grade')?.innerText || '-'}\t${tr.querySelector('.col-dus')?.innerText || '-'}\t${tr.querySelector('.col-shading')?.innerText || '-'}\t${tr.querySelector('.col-customer')?.innerText || '-'}\t${tr.querySelector('.col-ket')?.innerText || '-'}\t${tr.querySelector('.col-pic')?.innerText || '-'}\n`;
        });
    }

    navigator.clipboard.writeText(copyString).then(() => {
        alert("Berhasil menyalin!");
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
    
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-riwayat th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);

    document.querySelectorAll('.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-row:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') {
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                    rowData.push(`"${val.replace(/\n/g, ' ')}"`);
                }
            });
            ws_data.push(rowData);
        }
    });

    if(ws_data.length <= 1) return alert("Pilih minimal 1 baris data untuk di-export!");

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat_Langsir");
    XLSX.writeFile(wb, `Riwayat_Langsir_${modeRiwayat.toUpperCase()}.xlsx`);
};

window.bukaModalSTBJ = async function() {
    const mStbj = document.getElementById('modal-stbj-langsir'); if(mStbj) mStbj.classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj_langsir')
            .select('*')
            .eq('status', 'STBJ')
            .order('created_at', { ascending: false })
            .limit(200);
        
        if(error) throw error;
        
        if(!data || data.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Data STBJ Kosong (Semua sudah dilangsir).</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = formatWIB(r.created_at);
            h += `
                <div class="row-modal-stbj bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-[10px] border border-blue-200">STBJ</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${r.tgl_produksi || '-'} - ${r.mesin || '-'} - ${r.shift || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | <span class="text-slate-800">${r.nama_item || '-'}</span> | <span class="text-slate-800">${r.panjang || '-'}</span> | <span class="text-slate-800">${r.grade || '-'}</span> | <span class="text-slate-800">${r.dus || '-'}</span> | <span class="text-blue-600">${r.shading || '-'}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">Customer Bawaan: <span class="text-orange-600">${r.customer || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">PIC: <span class="text-slate-800">${r.pic_input || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { 
        if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; 
    }
};

window.saringTabelModalSTBJ = function() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.bukaModalHold = async function(tabelTarget = 'hold_stbj') {
    const mHold = document.getElementById('modal-hold-langsir'); if(mHold) mHold.classList.remove('hidden');
    
    const tabStbj = document.getElementById('tab-hold-stbj');
    const tabLangsir = document.getElementById('tab-hold-langsir');
    
    let statusFilter = 'HOLD STBJ';
    if(tabelTarget === 'hold_stbj') {
        tabStbj.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabLangsir.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
        statusFilter = 'HOLD STBJ';
    } else {
        tabLangsir.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabStbj.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
        statusFilter = 'HOLD LANGSIR';
    }

    const tbody = document.getElementById('tbody-hold-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data Hold...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj_langsir')
            .select('*')
            .eq('status', statusFilter)
            .order('created_at', {ascending: false})
            .limit(100);
            
        if(error) throw error;
        if(!data || data.length === 0) {
            if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-slate-400">Tabel ${statusFilter} Kosong.</div>`;
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = formatWIB(r.created_at);

            h += `
                <div class="row-modal-hold bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] border border-amber-200">${statusFilter}</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${r.tgl_produksi || '-'} - ${r.mesin || '-'} - ${r.shift || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | <span class="text-slate-800">${r.nama_item || '-'}</span> | <span class="text-slate-800">${r.panjang || '-'}</span> | <span class="text-slate-800">${r.grade || '-'}</span> | <span class="text-slate-800">${r.dus || '-'}</span> | <span class="text-blue-600">${r.shading || '-'}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">Customer Bawaan: <span class="text-orange-600">${r.customer || '-'}</span></div>
                    <div class="text-[12px] font-bold text-blue-700">PIC Cancel / Input: <span class="text-blue-900">${r.pic_input || '-'}</span></div>
                    <div class="text-[12px] font-bold text-rose-600">Keterangan: <span class="text-rose-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
};
