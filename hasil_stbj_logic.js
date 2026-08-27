// Otomatis deteksi mode perangkat saat buka halaman (Layar < 640px = Mobile, >= 640px = Desktop Tabel)
const isMobileDevice = window.innerWidth < 640;
let modeSekarang = isMobileDevice ? 'mobile' : 'tabel'; 

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

// State Khusus Mode Mobile (Drill-Down 6 Tingkat)
let mobileLevel = 1; 
let mobileSelectedSource = ''; // 'ALL', 'SCAN', 'MANUAL', 'HOLD'
let mobileSelectedTgl = '';
let mobileSelectedMesinShift = ''; // `${mesin}_${shift}`
let mobileSelectedItemSpec = ''; // `${nama}_${pjg}_${grade}_${dus}`
let mobileSelectedShading = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

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

// REVISI KRUSIAL: Auto-Chunking Fetcher untuk menembus limit 1000 baris Supabase
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

function toggleSidebarKolom() {
    const sidebar = document.getElementById('sidebar-kolom');
    const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); renderDragList();
    } else {
        sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden');
    }
}

function tutupPopups() {
    tutupModalFilterPopup();
    const sidebarK = document.getElementById('sidebar-kolom');
    if(sidebarK) sidebarK.classList.add('translate-x-full');

    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-list-katalog').classList.add('hidden');
    document.getElementById('modal-katalog').classList.add('hidden');
    closeFilterMenu();
}

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
        // REVISI: Menggunakan fetchAllRows untuk menarik seluruh data tanpa batasan 1000 baris
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

function setMode(m) {
    modeSekarang = m;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    ['mobile', 'tabel'].forEach(tab => {
        const el = document.getElementById('tab-mode-' + tab);
        if(el) {
            if(tab === 'mobile') {
                el.className = (m === tab) ? 'sm:hidden ' + activeClass : 'sm:hidden ' + inactiveClass;
            } else {
                el.className = (m === tab) ? activeClass : inactiveClass;
            }
        }
    });
    
    const isMobile = (m === 'mobile');

    document.getElementById('view-mobile').classList.toggle('hidden', !isMobile);
    document.getElementById('view-table').classList.toggle('hidden', isMobile);
    
    document.getElementById('desktop-toolbar').classList.toggle('hidden', isMobile);
    document.getElementById('footer-pagination').classList.toggle('hidden', isMobile);
    
    const lvl6Footer = document.getElementById('mobile-lvl6-footer');
    if (lvl6Footer && !isMobile) {
        lvl6Footer.classList.add('hidden');
        lvl6Footer.style.display = 'none';
    }

    if (!isMobile) {
        const btnCollect = document.getElementById('btn-massal-collect');
        const btnCollectMob = document.getElementById('btn-massal-collect-mob');
        const btnHold = document.getElementById('btn-hold-mob');
        const btnHapus = document.getElementById('btn-hapus-mob');
        const isCreator = currentUser && currentUser.role && currentUser.role.toLowerCase() === 'creator';

        if(btnCollect) btnCollect.classList.remove('hidden'); 
        if(btnCollectMob) btnCollectMob.classList.remove('hidden'); 
        if(btnHold) btnHold.classList.remove('hidden');
        if(btnHapus) btnHapus.classList.toggle('hidden', !isCreator);

        renderHeaderDanTabel();
    } else {
        mobileLevel = 1;
        renderMobileView();
    }
}

// ========================================================
// LOGIKA MODE MOBILE (REFACTORED DRILL-DOWN 6 TINGKAT)
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

window.setMobileAllDate = function() {
    const inputDate = document.getElementById('filter-date-mobile');
    if(inputDate) inputDate.value = '';
    renderMobileView();
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

// Helper Pembentuk Kartu Drill-down Ringkas
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

// Helper Sticky Header Mobile
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

// Fungsi Cancel STBJ Mobile (Status -> HOLD LANGSIR)
window.cancelSTBJMobile = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-stbj-lvl6:checked');
    if (checkedBoxes.length === 0) return alert("Pilih minimal 1 kardus!");

    const qrsToCancel = Array.from(checkedBoxes).map(cb => cb.value).filter(qr => qr && qr !== '-');
    if (qrsToCancel.length === 0) return alert("Item manual tidak dapat di-cancel STBJ.");

    if (!confirm(`Cancel ${qrsToCancel.length} item STBJ ini? Status akan diubah menjadi 'HOLD LANGSIR'.`)) return;

    const btn = document.getElementById('btn-cancel-stbj-lvl6');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true; }

    try {
        const { error } = await db.from('hasil_stbj_langsir')
            .update({ status: 'HOLD LANGSIR', keterangan: 'Cancel STBJ Mobile' })
            .in('qrcode', qrsToCancel);

        if (error) throw error;

        rawDataRaw.forEach(r => {
            if (qrsToCancel.includes(r.qrcode)) {
                r.status = 'HOLD LANGSIR';
                r.keterangan = 'Cancel STBJ Mobile';
            }
        });

        alert(`✅ SUKSES!\n${qrsToCancel.length} kardus telah masuk ke 'HOLD LANGSIR'.`);
        renderMobileView();
    } catch (e) {
        alert("Gagal memproses: " + e.message);
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        lucide.createIcons();
    }
};

// Fungsi Cancel Hold Mobile (Status -> STBJ)
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
            .update({ status: 'STBJ', keterangan: 'Unhold dari Mobile' })
            .in('qrcode', qrsToUnhold);

        if (error) throw error;

        rawDataRaw.forEach(r => {
            if (qrsToUnhold.includes(r.qrcode)) {
                r.status = 'STBJ';
                r.keterangan = 'Unhold dari Mobile';
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

// Fungsi Hapus Item Hold Mobile
window.hapusItemHoldMobile = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-stbj-lvl6:checked');
    if (checkedBoxes.length === 0) return alert("Pilih minimal 1 kardus yang ingin dihapus!");

    const qrsToDelete = Array.from(checkedBoxes).map(cb => cb.value).filter(qr => qr && qr !== '-');
    if (qrsToDelete.length === 0) return alert("Tidak ada item valid.");

    if (!confirm(`⚠️ Hapus permanen ${qrsToDelete.length} item hold ini dari database?`)) return;

    const btn = document.getElementById('btn-hapus-hold-lvl6');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menghapus...'; btn.disabled = true; }

    try {
        const { error } = await db.from('hasil_stbj_langsir').delete().in('qrcode', qrsToDelete);
        if (error) throw error;

        rawDataRaw = rawDataRaw.filter(r => !qrsToDelete.includes(r.qrcode));
        alert(`✅ SUKSES!\n${qrsToDelete.length} kardus hold telah dihapus.`);
        renderMobileView();
    } catch (e) {
        alert("Gagal menghapus: " + e.message);
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        lucide.createIcons();
    }
};

function renderMobileView() {
    const container = document.getElementById('view-mobile');
    const targetDate = document.getElementById('filter-date-mobile')?.value || '';
    const lvl6Footer = document.getElementById('mobile-lvl6-footer');

    // Kontrol Tampilan Footer Freeze Level 6
    if (lvl6Footer) {
        if (modeSekarang === 'mobile' && mobileLevel === 6) {
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
        if (targetDate) {
            const rowDate = (r.created_at || '').split('T')[0];
            if (rowDate !== targetDate) return false;
        }
        return matchesActiveFilters(r);
    });

    let toolbarHtml = `
        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1 shadow-inner">
                <i data-lucide="calendar" class="w-4 h-4 text-slate-400 ml-1"></i>
                <input type="date" id="filter-date-mobile" value="${targetDate}" onchange="renderMobileView()" class="p-1 text-xs font-bold text-slate-700 outline-none cursor-pointer bg-transparent">
                <button onclick="setMobileAllDate()" class="px-2.5 py-1 ${targetDate === '' ? 'bg-blue-600 text-white font-black' : 'bg-slate-200 text-slate-700 font-bold'} hover:bg-blue-700 hover:text-white rounded-lg text-[10px] uppercase transition">Semua</button>
            </div>

            <button onclick="bukaModalFilterPopup()" class="px-4 py-2 bg-white rounded-xl border border-slate-300 shadow-sm active:scale-95 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-2">
                <i data-lucide="filter" class="w-4 h-4 text-blue-600"></i>
                <span>Filter</span>
            </button>
        </div>
    `;

    if (allItems.length === 0) {
        container.innerHTML = toolbarHtml + `
            <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center mt-1">
                <i data-lucide="package-x" class="w-12 h-12 text-slate-300 mb-2"></i>
                <h4 class="font-bold text-slate-700 text-sm">Tidak ada data STBJ</h4>
            </div>`;
        lucide.createIcons();
        return;
    }

    let html = '';

    // LEVEL 1: KOTAK KISI 2 MENYAMPING
    if (mobileLevel === 1) {
        let totalScan = 0, totalManual = 0, totalHold = 0;
        allItems.forEach(r => {
            if (r.status.includes('HOLD')) totalHold += r.qty;
            if (r.source === 'SCAN') totalScan += r.qty;
            else if (r.source === 'MANUAL') totalManual += r.qty;
        });

        html += toolbarHtml;
        html += `<div class="flex justify-between items-center mb-1 px-1">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-wider">Pilih Kategori STBJ</h3>
            <span class="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">${totalScan + totalManual} Total Dus</span>
        </div>`;

        html += `<div class="grid grid-cols-2 gap-3">
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
                            <span class="font-black text-sm text-orange-600 uppercase">Customer: ${d.customer}</span>
                        </label>
                        <span class="font-bold px-2.5 py-0.5 text-[10px] rounded-md border ${badgeClass} uppercase">${d.status}</span>
                    </div>
                    
                    ${d.qrcode !== '-' ? `<div class="font-mono font-black text-slate-900 text-sm break-all bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-center mb-3">${d.qrcode}</div>` : `<div class="font-black text-purple-700 text-xs uppercase bg-purple-50 p-2 rounded-xl border border-purple-200 text-center mb-3">INPUT MANUAL</div>`}
                    
                    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Waktu Input / STBJ</span><span class="font-bold text-slate-700">${waktuSTBJ}</span></div>
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Troli</span><span class="font-black text-slate-800">${d.troli}</span></div>
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">Qty Dus</span><span class="font-black text-emerald-700 text-sm">${d.qty} Dus</span></div>
                        <div class="flex flex-col"><span class="text-[10px] font-black text-slate-400 uppercase">PIC Input</span><span class="font-bold text-slate-700 uppercase">${d.pic}</span></div>
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

    if (modeSekarang === 'mobile') {
        renderMobileView();
    } else {
        applyFilters();
        updateFilterIcons();
    }
};

// ========================================================
// LOGIKA TABEL DESKTOP (TABEL HASIL STBJ)
// ========================================================
function switchStatusFilter(val) { 
    statusSekarang = val; 
    muatDataDariSupabase(); // Tarik data ulang sesuai filter status
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
        let key = `${r.jenis_item}_${n}_${pjgFormatted}_${r.grade}_${r.dus}_${r.shading}_${cust}_${r.tgl_produksi}_${r.mesin}_${r.shift}_${ket}_${sData}_${itemStatus}`;
        
        if(!groups[key]) {
            groups[key] = { 
                jenisItem: r.jenis_item || '-', namaItemAsli: n, displayNama: jName, jasperId: jId, 
                panjang: pjgFormatted, grade: r.grade || '-', dus: r.dus || '-', shading: r.shading || '-', customer: cust,
                tglProduksi: r.tgl_produksi || '-', mesin: r.mesin || '-', shift: r.shift || '-',
                qty: 0, qrcodes: [], trolis: new Set(), ket: ket, sData: sData, status: itemStatus 
            };
        }
        groups[key].qty++; 
        groups[key].qrcodes.push(r.qrcode);
        if(r.troli) groups[key].trolis.add(r.troli);
    });

    processedData = Object.values(groups).map(g => {
        const gabunganTroli = Array.from(g.trolis).join(', ') || '-';
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
                'col-qr': g.qrcodes.join(' ')
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
    
    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
            </th>
            <th class="hdr-std col-status hidden">Status Data</th>
            ${thSort('Collect', 'col-status-data text-center')}
            <th class="hdr-std col-waktu hidden">Waktu Scan</th>
            ${thSort('Troli', 'col-troli text-center')}
            <th class="hdr-std col-qr hidden">QRCode</th>
            ${thSort('Tgl Produksi', 'col-tgl text-center')}
            ${thSort('Mesin', 'col-mesin text-center')}
            ${thSort('Shift', 'col-shift text-center')}
            ${thSort('Jenis Item', 'col-jenis')}
            ${thSort('Nama Item', 'col-nama')}
            ${thSort('Nama Jasper', 'col-jasper text-purple-300')}
            <th class="hdr-std w-10 text-center col-btn-edit">Edit</th>
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

        h += `
            <tr class="${trClass}">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${row._id}')" value="${row._id}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 hidden col-status">${sv['col-status']}</td>
                <td class="px-4 py-3 text-center col-status-data ${hiddenCols.includes('col-status-data')?'col-hidden':''}">${statDataHtml}</td>
                <td class="px-4 py-3 hidden col-waktu">-</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-troli ${hiddenCols.includes('col-troli')?'col-hidden':''}">${sv['col-troli']}</td>
                <td class="px-4 py-3 hidden col-qr">-</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}">${sv['col-tgl']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}">${sv['col-mesin']}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-900 col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}">${sv['col-shift']}</td>
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
    document.querySelectorA
