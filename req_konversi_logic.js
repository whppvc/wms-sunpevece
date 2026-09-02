window.rawData = []; 
window.stokKonvRaw = [];
window.masterAreas = [];
window.sortState = { col: null, isAsc: true }; 

window.currentTab = 'MOBILE'; // Default ke Tab Mobile
window.currentPage = 1;
window.rowsPerPage = 10; 
window.activeFilters = {}; 
window.currentFilterCol = ''; 
window.selectAllState = 0; 
window.userColOrder = []; 
window.hiddenCols = [];

// State Khusus Mobile
window.mobileLevel = 1; 
window.mobileSelectedKodeKonversi = '';
window.mobileSelectedReqData = null;

// State untuk Proses Konversi
window.activeRequestRow = null;
window.jenisProsesKonv = ''; // 'OUT' atau 'IN'
window.scannedValidItems = [];

let filterTimeout;

window.safeJSONParse = function(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
};

window.currentUser = window.safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

window.tampilkanAlert = function(pesan, tipe = 'info') {
    const modal = document.getElementById('modal-custom-alert');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const iconContainer = document.getElementById('alert-icon-container');
    const icon = document.getElementById('alert-icon');

    if(!modal) { alert(pesan); return; }

    msg.innerText = pesan;
    modal.classList.remove('hidden');

    if (tipe === 'warning') {
        title.innerText = 'Perhatian';
        title.className = 'text-lg font-black mb-2 text-amber-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-600';
        icon.setAttribute('data-lucide', 'alert-triangle');
    } else if (tipe === 'success') {
        title.innerText = 'Berhasil';
        title.className = 'text-lg font-black mb-2 text-emerald-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-emerald-100 text-emerald-600';
        icon.setAttribute('data-lucide', 'check-circle');
    } else if (tipe === 'error') {
        title.innerText = 'Gagal';
        title.className = 'text-lg font-black mb-2 text-rose-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-rose-100 text-rose-600';
        icon.setAttribute('data-lucide', 'x-circle');
    } else {
        title.innerText = 'Informasi';
        title.className = 'text-lg font-black mb-2 text-blue-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-blue-100 text-blue-600';
        icon.setAttribute('data-lucide', 'info');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.formatWIB = function(isoString) {
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
};

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) {
        str += 'M';
    }
    return str;
}

async function fetchAllRows(tableName, selectCols = '*', orderCol = 'created_at') {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await db.from(tableName)
            .select(selectCols)
            .order(orderCol, { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.warn(`Query warning on ${tableName}:`, error);
            break;
        }
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_req_${window.currentUser.username}`);
    if (savedOrder) { try { window.userColOrder = JSON.parse(savedOrder); } catch(e) { window.userColOrder = []; } } 
    else { window.userColOrder = []; }
    
    const savedHidden = localStorage.getItem(`col_hidden_req_${window.currentUser.username}`);
    if (savedHidden) { try { window.hiddenCols = JSON.parse(savedHidden); } catch(e) { window.hiddenCols = []; } } 
    else { window.hiddenCols = []; }

    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        window.rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) {
            Array.from(sel.options).forEach(opt => { if(opt.value == window.rowsPerPage) opt.selected = true; });
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await initModernLayout({ id: 'req_konversi', title: 'REQUEST KONVERSI', url: 'req_konversi.html' });
    
    const tabsData = [
        { id: 'tab-mobile', label: 'MOBILE', icon: 'smartphone', onClick: "setModeReq('MOBILE')" },
        { id: 'tab-req', label: 'Request Konversi', icon: 'clock', onClick: "setModeReq('REQUEST')" },
        { id: 'tab-konv', label: 'Tabel Konversi', icon: 'arrow-right-left', onClick: "setModeReq('KONVERSI')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-mobile');
    }
    
    if (typeof window.renderTableFooter === 'function') {
        window.renderTableFooter('container-footer', 'Total Qty Req');
    }

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('th.cursor-pointer')) { window.closeFilterMenu(); }
        }
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) { actionMenu.classList.add('hidden'); }
        }
    });

    window.loadUserPreferences(); 
    await loadAreas();
    setTimeout(window.muatData, 100);
});

async function loadAreas() {
    try {
        const { data } = await db.from('master_area').select('*');
        if (data) {
            window.masterAreas = [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))].sort();
            const sel = document.getElementById('select-area-konv-in');
            if(sel) {
                sel.innerHTML = '<option value="">-- PILIH AREA TUJUAN IN --</option>';
                window.masterAreas.forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.toggleSidebarFilter = function() {
    const sidebar = document.getElementById('sidebar-filter');
    const overlay = document.getElementById('overlay-klik-luar');
    sidebar.classList.toggle('translate-x-full');
    overlay.classList.toggle('hidden');
    if (!sidebar.classList.contains('translate-x-full')) {
        updateFilterDropdowns();
    }
};

window.toggleMobileActionDrawer = function() {
    const drawer = document.getElementById('mobile-action-drawer');
    const overlay = document.getElementById('overlay-klik-luar');
    if(drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        overlay.classList.remove('hidden');
    } else {
        drawer.classList.add('hidden');
        overlay.classList.add('hidden');
    }
};

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-proses-pilih').classList.add('hidden');
    document.getElementById('modal-scan-konv').classList.add('hidden');
    document.getElementById('modal-error-konv').classList.add('hidden');
    document.getElementById('modal-konfirmasi-konv').classList.add('hidden');
    document.getElementById('modal-custom-alert').classList.add('hidden');
    document.getElementById('mobile-action-drawer').classList.add('hidden');
    const sidebarFilter = document.getElementById('sidebar-filter');
    if(sidebarFilter) sidebarFilter.classList.add('translate-x-full');
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
    window.closeFilterMenu();
};

window.setModeReq = function(mode) {
    window.currentTab = mode;
    
    const tabsData = [
        { id: 'tab-mobile', label: 'MOBILE', icon: 'smartphone', onClick: "setModeReq('MOBILE')" },
        { id: 'tab-req', label: 'Request Konversi', icon: 'clock', onClick: "setModeReq('REQUEST')" },
        { id: 'tab-konv', label: 'Tabel Konversi', icon: 'arrow-right-left', onClick: "setModeReq('KONVERSI')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-' + mode.toLowerCase());
    }
    
    const isMobile = mode === 'MOBILE';
    const isReq = mode === 'REQUEST';
    
    const viewMobile = document.getElementById('view-mobile');
    const viewTable = document.getElementById('view-table');
    const desktopToolbar = document.getElementById('desktop-toolbar');
    const footerPagination = document.getElementById('container-footer');
    const mobileBottomBar = document.getElementById('mobile-bottom-bar');

    if (viewMobile) viewMobile.classList.toggle('hidden', !isMobile);
    if (viewTable) viewTable.classList.toggle('hidden', isMobile);
    if (desktopToolbar) desktopToolbar.classList.toggle('hidden', isMobile);
    
    if (footerPagination) {
        if(isMobile) {
            footerPagination.classList.add('hidden');
            footerPagination.style.display = 'none';
        } else {
            footerPagination.classList.remove('hidden');
            footerPagination.style.display = 'flex';
        }
    }

    if (mobileBottomBar) mobileBottomBar.classList.toggle('hidden', !isMobile);

    if(!isMobile) {
        document.getElementById('btn-proses-konv')?.classList.toggle('hidden', !isReq);
        document.getElementById('btn-done-konv')?.classList.toggle('hidden', !isReq);
        document.getElementById('btn-undone-konv')?.classList.toggle('hidden', !isReq);
        document.getElementById('btn-cancel-konv')?.classList.toggle('hidden', !isReq);
        document.getElementById('btn-cancel-item-konv')?.classList.toggle('hidden', isReq);
        document.getElementById('btn-hapus-req-mob')?.classList.toggle('hidden', !isReq);
    }

    window.activeFilters = {};
    if(isMobile) {
        window.mobileLevel = 1;
        window.renderMobileView();
    } else {
        window.renderTabelHeaders();
        window.saringTabelExcel();
    }
};

window.muatData = async function() {
    const tbody = document.getElementById('tbody-req');
    if(tbody) tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const [resReq, resStok] = await Promise.all([
            fetchAllRows('request_konversi', '*'),
            fetchAllRows('stok_konversi', '*')
        ]);
        
        window.rawData = resReq || [];
        window.stokKonvRaw = resStok || [];
        
        updateFilterDropdowns();
        window.setModeReq(window.currentTab);
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center text-red-500 font-medium">Gagal: ${e.message}</td></tr>`; 
    }
};

// ========================================================
// LOGIKA FILTER SIDEBAR DROPDOWN
// ========================================================
function updateFilterDropdowns() {
    const fields = [
        { id: 'fs-status', key: 'progres_konversi' },
        { id: 'fs-area', key: 'area' },
        { id: 'fs-jenis', key: 'jenis_item' },
        { id: 'fs-nama', key: 'nama_item' },
        { id: 'fs-pjg', key: 'panjang' },
        { id: 'fs-grade', key: 'grade' },
        { id: 'fs-dus', key: 'dus' },
        { id: 'fs-shading', key: 'shading' },
        { id: 'fs-cust', key: 'customer aktual' },
        { id: 'fs-pic', key: 'pic_request' }
    ];

    fields.forEach(field => {
        const select = document.getElementById(field.id);
        if (!select) return;
        
        const currentVal = select.value;
        const uniqueVals = [...new Set(window.rawData.map(d => d[field.key] || '-'))].filter(x => x && x !== '-').sort();

        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => {
            html += `<option value="${val}">${val}</option>`;
        });
        select.innerHTML = html;

        if (uniqueVals.includes(currentVal)) {
            select.value = currentVal;
        }
    });
}

window.resetFilterKonversi = function() {
    ['fs-status', 'fs-kode', 'fs-area', 'fs-jenis', 'fs-nama', 'fs-pjg', 'fs-grade', 'fs-dus', 'fs-shading', 'fs-cust', 'fs-pic'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    saringTabelKonversi();
    toggleSidebarFilter();
};

window.saringTabelKonversi = function() {
    if (window.currentTab === 'MOBILE') {
        window.renderMobileView();
    } else {
        saringTabelDesktop();
    }
};

function saringTabelDesktop() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        kode: document.getElementById('fs-kode')?.value.toLowerCase() || '',
        area: document.getElementById('fs-area')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        cust: document.getElementById('fs-cust')?.value || '',
        pic: document.getElementById('fs-pic')?.value || ''
    };

    document.querySelectorAll('#tbody-req tr.r-row').forEach(row => {
        let show = true;

        const checkMatch = (colCls, filterVal) => {
            if(!filterVal) return true;
            const cell = row.querySelector('.' + colCls);
            if(!cell) return true;
            let val = cell.getAttribute('data-search') || cell.innerText.trim();
            return val === filterVal;
        };

        if(!checkMatch('col-progres', f.status)) show = false;
        if(!checkMatch('col-area', f.area)) show = false;
        if(!checkMatch('col-jenis', f.jenis)) show = false;
        if(!checkMatch('col-asal', f.nama)) show = false;
        if(!checkMatch('col-pjg', f.pjg)) show = false;
        if(!checkMatch('col-grade', f.grade)) show = false;
        if(!checkMatch('col-dus', f.dus)) show = false;
        if(!checkMatch('col-shading', f.shading)) show = false;
        if(!checkMatch('col-pic', f.pic)) show = false;

        if (show && f.kode) {
            const cell = row.querySelector('.col-kode');
            if (cell && !cell.innerText.toLowerCase().includes(f.kode)) show = false;
        }

        if (show) row.classList.remove('filtered-out');
        else row.classList.add('filtered-out');
    });

    window.selectAllState = 0;
    window.updateSelectAllUI();
    window.currentPage = 1; 
    window.applyPagination();
}

// ========================================================
// LOGIKA MODE MOBILE (DRILL-DOWN & WARNA KOTAK STATUS)
// ========================================================
window.goToMobileLevel2 = function(kodeKonversi) {
    window.mobileSelectedKodeKonversi = kodeKonversi;
    window.mobileSelectedReqData = window.rawData.find(r => r.kode_konversi === kodeKonversi) || null;
    window.mobileLevel = 2;
    window.renderMobileView();
};

window.goBackMobileReq = function() {
    window.mobileLevel = 1;
    window.renderMobileView();
};

window.setMobileAllDate = function() {
    const inputDate = document.getElementById('filter-date-mobile');
    if(inputDate) inputDate.value = '';
    window.renderMobileView();
};

function matchesMobileFilter(r) {
    const targetDate = document.getElementById('filter-date-mobile')?.value || '';
    if(targetDate) {
        const rowDate = (r.created_at || '').split('T')[0];
        if(rowDate !== targetDate) return false;
    }

    const f = {
        status: document.getElementById('fs-status')?.value || '',
        kode: document.getElementById('fs-kode')?.value.toLowerCase() || '',
        area: document.getElementById('fs-area')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        cust: document.getElementById('fs-cust')?.value || '',
        pic: document.getElementById('fs-pic')?.value || ''
    };

    if (f.status && r.progres_konversi !== f.status) return false;
    if (f.kode && !(r.kode_konversi || '').toLowerCase().includes(f.kode)) return false;
    if (f.area && r.area !== f.area) return false;
    if (f.jenis && r.jenis_item !== f.jenis) return false;
    if (f.nama && r.nama_item !== f.nama) return false;
    if (f.pjg && r.panjang !== f.pjg) return false;
    if (f.grade && r.grade !== f.grade) return false;
    if (f.dus && r.dus !== f.dus) return false;
    if (f.shading && r.shading !== f.shading) return false;
    if (f.cust && r['customer aktual'] !== f.cust) return false;
    if (f.pic && r.pic_request !== f.pic) return false;

    return true;
}

window.renderMobileView = function() {
    const container = document.getElementById('view-mobile');
    if(!container) return;

    // LEVEL 1: DAFTAR KARTU REQUEST
    if (window.mobileLevel === 1) {
        const targetDate = document.getElementById('filter-date-mobile')?.value || '';
        const filteredReqs = window.rawData.filter(matchesMobileFilter);

        let toolbarHtml = `
            <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1 shadow-inner">
                    <i data-lucide="calendar" class="w-4 h-4 text-slate-400 ml-1"></i>
                    <input type="date" id="filter-date-mobile" value="${targetDate}" onchange="renderMobileView()" class="p-1 text-xs font-bold text-slate-700 outline-none cursor-pointer bg-transparent">
                    <button onclick="setMobileAllDate()" class="px-2.5 py-1 ${targetDate === '' ? 'bg-blue-600 text-white font-black' : 'bg-slate-200 text-slate-700 font-bold'} hover:bg-blue-700 hover:text-white rounded-lg text-[10px] uppercase transition cursor-pointer" title="Tampilkan Semua Tanggal">Semua</button>
                </div>

                <button onclick="toggleSidebarFilter()" class="px-4 py-2 bg-white rounded-xl border border-slate-300 shadow-sm active:scale-95 text-slate-700 font-bold text-xs hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer">
                    <i data-lucide="filter" class="w-4 h-4 text-blue-600"></i>
                    <span>Filter</span>
                </button>
            </div>
        `;

        if(filteredReqs.length === 0) {
            container.innerHTML = toolbarHtml + `
                <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center mt-1">
                    <i data-lucide="clock" class="w-12 h-12 text-slate-300 mb-2"></i>
                    <h4 class="font-bold text-slate-700 text-sm">Tidak ada request konversi</h4>
                    <p class="text-xs text-slate-400 mt-1">Sesuaikan tanggal atau reset filter untuk melihat data lainnya.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        let html = toolbarHtml;
        html += `<div class="flex justify-between items-center mb-1 px-1">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-wider">Daftar Request Konversi</h3>
            <span class="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">${filteredReqs.length} Total</span>
        </div>`;

        filteredReqs.forEach((r) => {
            const tgl = window.formatWIB(r.created_at);
            const pjgAsal = formatPanjang(r.panjang);
            const pjgReq = formatPanjang(r.panjang_req);

            let rawProg = (r.progres_konversi || 'PENDING').toUpperCase();
            let qtyOutNum = parseInt(r.qty_out) || 0;
            let qtyInNum = parseInt(r.qty_in) || 0;

            // WARNA BACKGROUND KARTU BERDASARKAN ATURAN:
            // 1. REQUEST (Pending): Abu-abu agak gelap (bg-slate-200 / border-slate-300)
            // 2. PROSES: Kuning / Amber (bg-amber-50 / border-amber-300)
            // 3. DONE: Biru (bg-blue-50 / border-blue-300) dengan badge tetap hijau
            let cardBgClass = "bg-slate-200 border-slate-300";
            let badgeStatus = `<span class="bg-slate-700 text-white px-2.5 py-1 rounded-md font-black text-[10px] shadow-sm">REQUEST</span>`;

            if (rawProg === 'DONE') {
                cardBgClass = "bg-blue-50/90 border-blue-300 shadow-blue-50";
                badgeStatus = `<span class="bg-emerald-600 text-white px-2.5 py-1 rounded-md font-black text-[10px] border border-emerald-700 shadow-sm">DONE</span>`;
            } else if (rawProg === 'PROSES' || qtyOutNum > 0 || qtyInNum > 0) {
                cardBgClass = "bg-amber-50/90 border-amber-300 shadow-amber-50";
                badgeStatus = `<span class="bg-amber-500 text-white px-2.5 py-1 rounded-md font-black text-[10px] border border-amber-600 shadow-sm">PROSES</span>`;
            }

            html += `
                <div class="${cardBgClass} border rounded-2xl p-4 shadow-sm relative transition flex flex-col hover:border-indigo-400 mb-2">
                    
                    <!-- HEADER KARTU: Checkbox, Kode Konversi, Badge Status -->
                    <div class="flex justify-between items-center mb-3 pb-3 border-b border-black/10">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-5 h-5 accent-blue-600 rounded border-slate-400">
                            <div class="flex flex-col">
                                <span class="font-mono font-black text-slate-900 text-base leading-tight">${r.kode_konversi}</span>
                                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">${tgl}</span>
                            </div>
                        </div>
                        <div>${badgeStatus}</div>
                    </div>

                    <!-- AREA BODY YANG DAPAT DIKLIK UNTUK LIHAT DETAIL IN/OUT -->
                    <div onclick="goToMobileLevel2('${r.kode_konversi}')" class="cursor-pointer space-y-3">
                        
                        <!-- SPESIFIKASI ASAL -->
                        <div class="bg-white/90 p-2.5 rounded-xl border border-black/5 shadow-sm">
                            <span class="text-[10px] font-black uppercase text-slate-500 block mb-1">Item Asal (Gudang)</span>
                            <div class="text-xs font-black text-slate-800 leading-snug">
                                <span class="text-blue-600">${r.jenis_item || '-'}</span> | ${r.nama_item || '-'} | ${pjgAsal} | ${r.grade || '-'} | ${r.dus || '-'} | <span class="text-indigo-600">${r.shading || '-'}</span>
                            </div>
                            <div class="text-[11px] font-bold text-slate-500 mt-1">
                                Area: <span class="text-emerald-700 font-black">${r.area || '-'}</span> • Customer: <span class="text-orange-600">${r['customer aktual'] || '-'}</span>
                            </div>
                        </div>

                        <!-- SPESIFIKASI REQUEST TARGET -->
                        <div class="bg-white/90 p-2.5 rounded-xl border border-black/5 shadow-sm">
                            <span class="text-[10px] font-black uppercase text-indigo-600 block mb-1">Target Konversi</span>
                            <div class="text-xs font-black text-slate-800 leading-snug">
                                <span class="text-indigo-700">${r.nama_item_req || r.nama_item}</span> | ${pjgReq} | ${r.grade_req || r.grade} | ${r.dus_req || r.dus} | <span class="text-indigo-600">${r.shading_req || r.shading}</span>
                            </div>
                        </div>

                        <!-- KUANTITI GRID (REQ, HASIL, OUT, IN) -->
                        <div class="grid grid-cols-4 gap-2 text-center pt-1">
                            <div class="bg-white/90 p-2 rounded-lg border border-black/5 shadow-sm">
                                <span class="text-[9px] font-black text-slate-500 uppercase block">Req</span>
                                <span class="text-sm font-black text-slate-800">${r.qty_req || 0}</span>
                            </div>
                            <div class="bg-indigo-50/90 p-2 rounded-lg border border-indigo-200 shadow-sm">
                                <span class="text-[9px] font-black text-indigo-600 uppercase block">Hasil</span>
                                <span class="text-sm font-black text-indigo-700">${r.qty_hasil || 0}</span>
                            </div>
                            <div class="bg-rose-50/90 p-2 rounded-lg border border-rose-200 shadow-sm">
                                <span class="text-[9px] font-black text-rose-600 uppercase block">Out</span>
                                <span class="text-sm font-black text-rose-700">${r.qty_out || 0}</span>
                            </div>
                            <div class="bg-emerald-50/90 p-2 rounded-lg border border-emerald-200 shadow-sm">
                                <span class="text-[9px] font-black text-emerald-600 uppercase block">In</span>
                                <span class="text-sm font-black text-emerald-700">${r.qty_in || 0}</span>
                            </div>
                        </div>

                        <!-- FOOTER HINT -->
                        <div class="flex justify-between items-center pt-2 border-t border-black/10 text-[11px] font-bold text-slate-500">
                            <span>PIC: <strong class="text-slate-700 uppercase">${r.pic_request || '-'}</strong></span>
                            <span class="text-indigo-600 flex items-center gap-1 font-black">Detail Hasil IN/OUT <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></span>
                        </div>
                    </div>

                </div>
            `;
        });

        container.innerHTML = html;
    }

    // LEVEL 2: DRILL-DOWN RIWAYAT FISIK IN & OUT (SETIAP KOTAK AKTIFITAS ADA CHECKBOX)
    else if (window.mobileLevel === 2) {
        const kode = window.mobileSelectedKodeKonversi;
        const filteredKonv = window.stokKonvRaw.filter(k => k.kode_konversi === kode);

        let html = `
            <div class="flex items-center justify-between mb-2 px-1">
                <div class="flex items-center gap-3">
                    <button onclick="goBackMobileReq()" class="p-2 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1 text-xs font-bold text-slate-700 cursor-pointer">
                        <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                    </button>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase leading-none">Detail Hasil Konversi</span>
                        <span class="text-sm font-black text-indigo-700 uppercase leading-tight font-mono">${kode}</span>
                    </div>
                </div>
            </div>
        `;

        if (filteredKonv.length === 0) {
            html += `
                <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center mt-2">
                    <i data-lucide="package-search" class="w-12 h-12 text-slate-300 mb-2"></i>
                    <h4 class="font-bold text-slate-700 text-sm">Belum ada barang yang diproses</h4>
                    <p class="text-xs text-slate-400 mt-1">Gunakan 'MENU TOMBOL' ➔ 'Proses' untuk melakukan Konversi OUT atau IN.</p>
                </div>
            `;
        } else {
            let count = filteredKonv.length;
            filteredKonv.forEach(k => {
                const tgl = window.formatWIB(k.created_at);
                const pjgFormatted = formatPanjang(k.panjang);
                const isOut = (k.aktifitas || '').toLowerCase().includes('out');
                
                const badgeAktifitas = isOut 
                    ? `<span class="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase">KONVERSI OUT</span>`
                    : `<span class="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase">KONVERSI IN</span>`;

                const rawRowStr = encodeURIComponent(JSON.stringify(k));

                html += `
                    <div class="bg-white border border-slate-300 rounded-2xl p-4 mb-2 relative shadow-sm flex flex-col">
                        <div class="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                            <div class="flex items-center gap-3">
                                <input type="checkbox" value="${k.id}" data-item="${rawRowStr}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-5 h-5 accent-blue-600 rounded border-slate-400">
                                <div class="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-sm shadow-inner">${count--}</div>
                                <div class="flex flex-col">
                                    <span class="font-black text-sm text-slate-800 leading-none uppercase">${k.area || '-'}</span>
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">${tgl}</span>
                                </div>
                            </div>
                            <div>${badgeAktifitas}</div>
                        </div>

                        <div class="font-mono font-black text-slate-900 text-sm break-all bg-slate-100 p-2 rounded-lg border border-slate-200 text-center mb-3">
                            ${k.qrcode}
                        </div>

                        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                            <span class="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Spesifikasi Item</span>
                            <span class="text-xs font-black text-slate-900 leading-snug">
                                ${k.nama_item || '-'} - ${pjgFormatted} - ${k.grade || '-'} - ${k.dus || '-'}
                            </span>
                            <span class="text-xs font-bold text-indigo-700 block mt-0.5">Shading: ${k.shading || '-'}</span>
                        </div>

                        <div class="flex justify-between items-center text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                            <span>Customer: <strong class="text-orange-600">${k.customer_aktual || '-'}</strong></span>
                            <span>PIC: <strong class="text-slate-700 uppercase">${k.pic || '-'}</strong></span>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    }

    if(typeof lucide !== 'undefined') lucide.createIcons();
    window.updateSelectedCount();
};

// ========================================================
// LOGIKA TABEL DESKTOP (3D DESIGN & SMART EXCEL FILTER)
// ========================================================
function thSort(label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = window.hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb', 'col-progres'].includes(colClass);
    
    let isFiltered = window.activeFilters[colClass] && window.activeFilters[colClass].length > 0;
    let hdrBgClass = isFiltered ? 'hdr-filtered' : '';
    let filterIconColor = isFiltered ? 'text-amber-400 opacity-100' : 'text-slate-400 opacity-40';

    if (noFilter) {
        return `<th class="hdr-std ${cls} ${isHidden} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} ${isHidden} ${hdrBgClass} select-none group cursor-pointer hover:bg-slate-700 transition" onclick="openColumnFilter(event, '${colClass}', '${label}')">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="truncate flex-1 text-left" title="${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <i data-lucide="chevron-down" class="w-4 h-4 filter-icon ${filterIconColor} group-hover:opacity-100 transition-all"></i>
            </div>
        </div>
    </th>`;
}

window.renderTabelHeaders = function() {
    const thead = document.getElementById('thead-req');
    if(!thead) return;

    if(window.currentTab === 'REQUEST') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto cursor-pointer" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Kode Konversi', 'col-kode')}
                ${thSort('Tgl Request', 'col-tgl')}
                ${thSort('Detail Item Asal', 'col-asal')}
                ${thSort('Request Konversi', 'col-req')}
                ${thSort('Qty Req', 'col-qty_req text-center')}
                ${thSort('Qty Hasil', 'col-qty_hasil text-center')}
                ${thSort('Qty Out', 'col-qty_out text-center')}
                ${thSort('Qty In', 'col-qty_in text-center')}
                <th class="hdr-std w-24 col-progres text-center">Progres</th>
                ${thSort('PIC Request', 'col-pic')}
            </tr>`;
    } else if(window.currentTab === 'KONVERSI') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto cursor-pointer" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Waktu', 'col-waktu')}
                ${thSort('Kode Konversi', 'col-kode')}
                ${thSort('Aktifitas', 'col-aktifitas')}
                ${thSort('QRCode', 'col-qr')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg text-center')}
                ${thSort('Grade', 'col-grade text-center')}
                ${thSort('Dus', 'col-dus text-center')}
                ${thSort('Shading', 'col-shading text-center')}
                ${thSort('Customer', 'col-cust')}
                ${thSort('Area', 'col-area text-center')}
                ${thSort('PIC', 'col-pic')}
                <th class="hdr-std w-24 col-status text-center">Status</th>
            </tr>`;
    }
    window.updateSelectAllUI();
};

function renderTabelBody() {
    const tbody = document.getElementById('tbody-req');
    if(!tbody) return;

    const rowClassBase = "transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200";

    if(window.currentTab === 'REQUEST') {
        if(window.rawData.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="12" class="p-8 text-center font-medium text-slate-400">Tidak ada data request.</td></tr>`; 
            updatePaginationUI();
            return; 
        }

        tbody.innerHTML = window.rawData.map((r) => {
            const tgl = window.formatWIB(r.created_at);
            const pjgAsal = formatPanjang(r.panjang);
            const pjgReqStr = formatPanjang(r.panjang_req);
            
            const detailAsal = `
                <div class="text-[12px] font-bold text-slate-600 leading-snug">
                    Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | 
                    <span class="text-slate-800">${r.nama_item || '-'}</span> | 
                    <span class="text-slate-800">${pjgAsal}</span> | 
                    <span class="text-slate-800">${r.grade || '-'}</span> | 
                    <span class="text-slate-800">${r.dus || '-'}</span> | 
                    <span class="text-blue-600">${r.shading || '-'}</span>
                </div>
                <div class="text-[12px] font-bold text-slate-600 mt-1">Customer Aktual: <span class="text-orange-600">${r['customer aktual'] || '-'}</span></div>
                <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                <div class="text-[12px] font-bold text-slate-600">Area: <span class="text-emerald-600 font-black">${r.area || '-'}</span></div>
            `;
            const searchAsal = `${r.nama_item} ${pjgAsal} ${r.grade} ${r.dus} ${r.shading} ${r['customer aktual']} ${r.area}`;
            
            let reqArr = [];
            if(r.nama_item_req && r.nama_item_req !== r.nama_item) reqArr.push(`Nama: <span class="text-blue-600">${r.nama_item_req}</span>`);
            if(r.panjang_req && pjgReqStr !== pjgAsal) reqArr.push(`Panjang: <span class="text-slate-800">${pjgReqStr}</span>`);
            if(r.grade_req && r.grade_req !== r.grade) reqArr.push(`Grade: <span class="text-slate-800">${r.grade_req}</span>`);
            if(r.dus_req && r.dus_req !== r.dus) reqArr.push(`Dus: <span class="text-slate-800">${r.dus_req}</span>`);
            if(r.shading_req && r.shading_req !== r.shading) reqArr.push(`Shading: <span class="text-blue-600">${r.shading_req}</span>`);
            
            const detailReq = reqArr.length > 0 ? `<div class="text-[12px] font-bold text-slate-600">${reqArr.join(' | ')}</div>` : '<span class="text-slate-400 italic text-xs">Tidak ada perubahan spesifikasi</span>';
            const searchReq = `${r.nama_item_req} ${pjgReqStr} ${r.grade_req} ${r.dus_req} ${r.shading_req}`;

            let qtyOutNum = parseInt(r.qty_out) || 0;
            let qtyInNum = parseInt(r.qty_in) || 0;
            let rawProg = (r.progres_konversi || 'PENDING').toUpperCase();

            let displayProg = 'REQUEST';
            let badgeProgres = `<span class="bg-blue-100 text-blue-700 px-2.5 py-1 rounded font-black text-[10px] border border-blue-200">REQUEST</span>`;

            if (rawProg === 'DONE') {
                displayProg = 'DONE';
                badgeProgres = `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded font-black text-[10px] border border-emerald-200">DONE</span>`;
            } else if (qtyOutNum > 0 || qtyInNum > 0 || rawProg === 'PROSES') {
                displayProg = 'PROSES';
                badgeProgres = `<span class="bg-amber-100 text-amber-700 px-2.5 py-1 rounded font-black text-[10px] border border-amber-200">PROSES</span>`;
            }

            return `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-black text-slate-800 text-left tracking-wider col-kode ${window.hiddenCols.includes('col-kode')?'col-hidden':''}" data-search="${r.kode_konversi || '-'}">${r.kode_konversi || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl ${window.hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 text-left col-asal ${window.hiddenCols.includes('col-asal')?'col-hidden':''}" data-search="${searchAsal}">${detailAsal}</td>
                    <td class="px-4 py-3 text-left col-req ${window.hiddenCols.includes('col-req')?'col-hidden':''}" data-search="${searchReq}">${detailReq}</td>
                    <td class="px-4 py-3 font-black text-slate-700 text-center col-qty_req ${window.hiddenCols.includes('col-qty_req')?'col-hidden':''}" data-search="${r.qty_req || 0}">${r.qty_req || 0}</td>
                    <td class="px-4 py-3 font-black text-indigo-600 text-center col-qty_hasil ${window.hiddenCols.includes('col-qty_hasil')?'col-hidden':''}" data-search="${r.qty_hasil || 0}">${r.qty_hasil || 0}</td>
                    <td class="px-4 py-3 font-black text-rose-600 text-center col-qty_out ${window.hiddenCols.includes('col-qty_out')?'col-hidden':''}" data-search="${r.qty_out || 0}">${r.qty_out || 0}</td>
                    <td class="px-4 py-3 font-black text-emerald-600 text-center col-qty_in ${window.hiddenCols.includes('col-qty_in')?'col-hidden':''}" data-search="${r.qty_in || 0}">${r.qty_in || 0}</td>
                    <td class="px-4 py-3 text-center col-progres" data-search="${displayProg}">${badgeProgres}</td>
                    <td class="px-4 py-3 font-bold uppercase text-xs text-slate-400 text-left col-pic ${window.hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_request || '-'}">${r.pic_request || '-'}</td>
                </tr>`;
        }).join('');
    } 
    else if(window.currentTab === 'KONVERSI') {
        if(window.stokKonvRaw.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="14" class="p-8 text-center font-medium text-slate-400">Tidak ada data stok konversi.</td></tr>`; 
            updatePaginationUI();
            return; 
        }

        let doneKodes = new Set();
        window.rawData.forEach(rq => {
            if((rq.progres_konversi || '').toUpperCase() === 'DONE') {
                doneKodes.add(rq.kode_konversi);
            }
        });

        tbody.innerHTML = window.stokKonvRaw.map((r) => {
            const tgl = window.formatWIB(r.created_at);
            const pjgFormatted = formatPanjang(r.panjang);
            
            let aktText = r.aktifitas || '-';
            let aktClass = "text-slate-600 font-bold";
            if (aktText.toLowerCase().includes('in')) {
                aktClass = "text-emerald-600 font-bold";
            } else if (aktText.toLowerCase().includes('out')) {
                aktClass = "text-rose-600 font-bold";
            }

            let isDone = doneKodes.has(r.kode_konversi);
            let displayStatus = isDone ? 'DONE' : 'PROSES';
            let badgeStatus = isDone 
                ? `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded font-black text-[10px] border border-emerald-200">DONE</span>`
                : `<span class="bg-amber-100 text-amber-700 px-2.5 py-1 rounded font-black text-[10px] border border-amber-200">PROSES</span>`;

            const rawRowStr = encodeURIComponent(JSON.stringify(r));

            return `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" data-item="${rawRowStr}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-waktu ${window.hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 font-black text-slate-800 text-left tracking-wider col-kode ${window.hiddenCols.includes('col-kode')?'col-hidden':''}" data-search="${r.kode_konversi || '-'}">${r.kode_konversi || '-'}</td>
                    <td class="px-4 py-3 text-center uppercase col-aktifitas ${aktClass} ${window.hiddenCols.includes('col-aktifitas')?'col-hidden':''}" data-search="${aktText}">${aktText}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 text-left col-qr ${window.hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 text-left col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${pjgFormatted}">${pjgFormatted}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="px-4 py-3 font-semibold text-slate-900 text-left col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer_aktual || '-'}">${r.customer_aktual || '-'}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-area ${window.hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.area || '-'}">${r.area || '-'}</td>
                    <td class="px-4 py-3 font-bold uppercase text-xs text-slate-400 text-left col-pic ${window.hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
                    <td class="px-4 py-3 text-center col-status" data-search="${displayStatus}">${badgeStatus}</td>
                </tr>`;
        }).join('');
    }

    window.applyColumnOrder(); 
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
    window.initResizableColumns(); 
    window.applyPagination();
}

// ==========================================
// LOGIKA PROSES KONVERSI (OUT / IN)
// ==========================================
window.bukaModalProsesKonv = function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length !== 1) return tampilkanAlert("Pilih TEPAT 1 baris request yang ingin diproses!", "warning");
    
    const idReq = checked[0].value;
    window.activeRequestRow = window.rawData.find(r => r.id == idReq);
    
    if(!window.activeRequestRow) return tampilkanAlert("Data request tidak ditemukan!", "error");
    if(window.activeRequestRow.progres_konversi === 'DONE') return tampilkanAlert("Request ini sudah selesai (DONE)!", "warning");

    document.getElementById('modal-proses-pilih').classList.remove('hidden');
};

window.pilihJenisProses = function(jenis) {
    window.jenisProsesKonv = jenis;
    document.getElementById('modal-proses-pilih').classList.add('hidden');
    
    const title = document.getElementById('title-scan-konv');
    const containerAreaIn = document.getElementById('container-area-in');

    if(jenis === 'OUT') {
        title.innerHTML = '<i data-lucide="log-out" class="text-rose-600"></i> PROSES KONVERSI OUT';
        if(containerAreaIn) containerAreaIn.classList.add('hidden');
    } else {
        title.innerHTML = '<i data-lucide="log-in" class="text-emerald-600"></i> PROSES KONVERSI IN';
        if(containerAreaIn) {
            containerAreaIn.classList.remove('hidden');
            const selArea = document.getElementById('select-area-konv-in');
            if(selArea) selArea.value = window.activeRequestRow?.area || '';
        }
    }
    
    document.getElementById('input-scan-konv').value = '';
    document.getElementById('modal-scan-konv').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-scan-konv').focus(), 100);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.verifikasiKodeKonv = async function() {
    const rawInput = document.getElementById('input-scan-konv').value.trim();
    if(!rawInput) return tampilkanAlert("Masukkan kode QR!", "warning");

    if(window.jenisProsesKonv === 'IN') {
        const targetAreaIn = document.getElementById('select-area-konv-in').value;
        if(!targetAreaIn) return tampilkanAlert("Pilih Area Tujuan untuk Konversi IN terlebih dahulu!", "warning");
    }
    
    const btn = document.getElementById('btn-verifikasi-konv'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Mengecek...'; btn.disabled = true;

    const qrs = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    try {
        const [resGlobal, resKonv] = await Promise.all([
            db.from('stok_global').select('*').in('qrcode', qrs),
            db.from('stok_konversi').select('*').in('qrcode', qrs)
        ]);

        if(resGlobal.error) throw resGlobal.error;
        if(resKonv.error) throw resKonv.error;

        const globalData = resGlobal.data || [];
        const konvData = resKonv.data || [];

        let invalidQrs = [];
        window.scannedValidItems = [];

        qrs.forEach(qr => {
            const itemGlobal = globalData.find(g => g.qrcode === qr);
            const itemKonv = konvData.find(k => k.qrcode === qr);

            if(window.jenisProsesKonv === 'OUT') {
                if(itemGlobal && !itemKonv) {
                    if(itemGlobal.nama_item !== window.activeRequestRow.nama_item || 
                       formatPanjang(itemGlobal.panjang) !== formatPanjang(window.activeRequestRow.panjang) || 
                       itemGlobal.grade !== window.activeRequestRow.grade) {
                        invalidQrs.push({ qr: qr, reason: "Spesifikasi tidak cocok dengan request asal!" });
                    } else {
                        window.scannedValidItems.push(itemGlobal);
                    }
                } else if(!itemGlobal && itemKonv) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item sudah dikonversi OUT sebelumnya." });
                } else if(!itemGlobal && !itemKonv) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item tidak ditemukan di stok_global." });
                } else {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Duplikat data." });
                }
            } else {
                if(itemGlobal) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item sudah ada di stok_global (gudang)." });
                } else if(itemKonv) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item sudah tercatat di stok_konversi." });
                } else {
                    const td = window.translateBarcode(qr);
                    window.scannedValidItems.push({ qrcode: qr, ...td });
                }
            }
        });

        if(invalidQrs.length > 0) {
            document.getElementById('lbl-error-count').innerText = invalidQrs.length;
            document.getElementById('list-error-konv').innerHTML = invalidQrs.map(err => `
                <li class="border-b border-rose-200/50 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0">
                    <span class="block text-slate-800 font-black mb-1">${err.qr}</span>
                    <span class="block text-[10px] text-rose-600 font-medium leading-tight">Gagal: ${err.reason}</span>
                </li>
            `).join('');
            document.getElementById('modal-error-konv').classList.remove('hidden');
            btn.innerHTML = ori; btn.disabled = false; return;
        }

        let html = '';
        window.scannedValidItems.forEach((item, idx) => {
            let pjgStr = formatPanjang(item.panjang || item.panjang);
            let detail = `${item.nama_item || item.namaItem} | ${pjgStr} | ${item.grade || item.grade}`;
            html += `<tr class="hover:bg-slate-50 transition border-b border-slate-200">
                <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-slate-800">${item.qrcode}</td>
                <td class="p-3 font-medium text-slate-600">${detail}</td>
            </tr>`;
        });
        
        document.getElementById('lbl-jml-valid').innerText = window.scannedValidItems.length;
        document.getElementById('tbody-konfirmasi-konv').innerHTML = html;
        
        document.getElementById('modal-scan-konv').classList.add('hidden');
        document.getElementById('modal-konfirmasi-konv').classList.remove('hidden');

    } catch(e) {
        tampilkanAlert("Gagal verifikasi: " + e.message, "error");
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
};

window.eksekusiSaveKonv = async function() {
    const btn = document.getElementById('btn-eksekusi-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        if(window.jenisProsesKonv === 'OUT') {
            let insertsKonv = [];
            let qrs = window.scannedValidItems.map(item => item.qrcode);

            for(let item of window.scannedValidItems) {
                let pjgFormatted = formatPanjang(item.panjang);

                insertsKonv.push({
                    kode_konversi: window.activeRequestRow.kode_konversi,
                    aktifitas: 'Konversi Out',
                    qrcode: item.qrcode,
                    tgl_produksi: item.tgl_produksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenis_item,
                    nama_item: item.nama_item,
                    panjang: pjgFormatted,
                    grade: item.grade,
                    dus: item.dus,
                    shading: item.shading,
                    customer_aktual: item.customer_aktual,
                    keterangan: item.keterangan || '-',
                    pic: window.currentUser.username,
                    area: item.area,
                    status: 'PENDING',
                    id_sku: item.id_sku
                });

                // Pengurangan stok_aktual saat Konversi OUT
                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                    .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual)
                    .eq('konversi', window.activeRequestRow.kode_konversi) 
                    .limit(1);
                
                if(ext && ext.length > 0) {
                    let newQty = ext[0].qty - 1;
                    if(newQty <= 0) await db.from('stok_aktual').delete().eq('id', ext[0].id);
                    else await db.from('stok_aktual').update({qty: newQty}).eq('id', ext[0].id);
                }
            }

            await db.from('stok_global').delete().in('qrcode', qrs);
            await db.from('stok_qr').delete().in('qrcode', qrs);
            await db.from('stok_konversi').insert(insertsKonv);

            let newQtyOut = (parseInt(window.activeRequestRow.qty_out) || 0) + qrs.length;
            await db.from('request_konversi').update({ qty_out: newQtyOut.toString(), progres_konversi: 'PROSES' }).eq('id', window.activeRequestRow.id);

        } else {
            // PROSES IN: AREA DIPILIH SENDIRI OLEH USER
            let targetAreaIn = document.getElementById('select-area-konv-in')?.value || window.activeRequestRow.area;
            
            let insertsKonv = [];
            let insertsGlobal = [];
            let insertsStokQr = [];
            let qrs = window.scannedValidItems.map(item => item.qrcode);

            let nama = window.activeRequestRow.nama_item_req || window.activeRequestRow.nama_item;
            let rawPjg = window.activeRequestRow.panjang_req || window.activeRequestRow.panjang;
            let pjg = formatPanjang(rawPjg);
            
            let grade = window.activeRequestRow.grade_req || window.activeRequestRow.grade;
            let dus = window.activeRequestRow.dus_req || window.activeRequestRow.dus;
            let shading = window.activeRequestRow.shading_req || window.activeRequestRow.shading;
            let area = targetAreaIn;
            let customer = window.activeRequestRow['customer aktual'];
            let ket = window.activeRequestRow.keterangan || '-';
            let kondisi = 'Aman';

            let new_id_sku = `${area}_${nama}_${pjg}_${grade}_${dus}_${shading}_${ket}_${customer}_${kondisi}`;

            for(let item of window.scannedValidItems) {
                insertsKonv.push({
                    kode_konversi: window.activeRequestRow.kode_konversi,
                    aktifitas: 'Konversi In',
                    qrcode: item.qrcode,
                    tgl_produksi: item.tglProduksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenisItem,
                    nama_item: nama,
                    panjang: pjg,
                    grade: grade,
                    dus: dus,
                    shading: shading,
                    customer_aktual: customer,
                    keterangan: ket,
                    pic: window.currentUser.username,
                    area: area,
                    status: 'PENDING',
                    id_sku: new_id_sku
                });

                insertsGlobal.push({
                    qrcode: item.qrcode,
                    area: area,
                    id_sku: new_id_sku,
                    tgl_produksi: item.tglProduksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenisItem,
                    nama_item: nama,
                    panjang: pjg,
                    grade: grade,
                    dus: dus,
                    shading: shading,
                    customer_aktual: customer,
                    keterangan: ket,
                    kondisi: kondisi,
                    pic_input: window.currentUser.username,
                    jalur_masuk: 'konversi'
                });

                insertsStokQr.push({
                    qrcode: item.qrcode,
                    id_sku: new_id_sku,
                    area: area,
                    keterangan: ket
                });

                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', nama).eq('panjang', pjg).eq('grade', grade)
                    .eq('dus', dus).eq('shading', shading).eq('area', area)
                    .eq('customer_aktual', customer)
                    .eq('keterangan', ket)
                    .is('konversi', null) 
                    .limit(1);
                
                if(ext && ext.length > 0) {
                    await db.from('stok_aktual').update({qty: ext[0].qty + 1}).eq('id', ext[0].id);
                } else {
                    await db.from('stok_aktual').insert([{
                        id_sku: new_id_sku, jenis_item: item.jenisItem, nama_item: nama, panjang: pjg, 
                        grade: grade, dus: dus, shading: shading, area: area, 
                        customer_aktual: customer, customer_estimasi: customer, keterangan: ket, qty: 1
                    }]);
                }
            }

            await db.from('stok_global').insert(insertsGlobal);
            await db.from('stok_qr').insert(insertsStokQr);
            await db.from('stok_konversi').insert(insertsKonv);

            let newQtyIn = (parseInt(window.activeRequestRow.qty_in) || 0) + qrs.length;
            await db.from('request_konversi').update({ qty_in: newQtyIn.toString(), progres_konversi: 'PROSES' }).eq('id', window.activeRequestRow.id);
        }

        tampilkanAlert("✅ BERHASIL MEMPROSES KONVERSI!", "success");
        document.getElementById('modal-konfirmasi-konv').classList.add('hidden');
        window.muatData();

    } catch(e) {
        tampilkanAlert("Gagal menyimpan: " + e.message, "error");
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
};

// ========================================================
// LOGIKA CANCEL KONVERSI OUT / IN (ITEM AKTIFITAS FISIK)
// ========================================================
window.cancelItemKonvMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih / centang item hasil konversi OUT atau IN yang ingin di-cancel!", "warning");

    const itemsToCancel = Array.from(checked).map(cb => {
        const raw = cb.getAttribute('data-item');
        return raw ? JSON.parse(decodeURIComponent(raw)) : null;
    }).filter(Boolean);

    if(itemsToCancel.length === 0) return tampilkanAlert("Item tidak valid!", "error");

    if(!confirm(`Yakin ingin membatalkan (Cancel) ${itemsToCancel.length} item konversi ini?\n\n- Item Konversi OUT akan DIKEMBALIKAN ke gudang.\n- Item Konversi IN akan DIHAPUS dari gudang.`)) return;

    try {
        let reqUpdateMap = {}; // Untuk menyesuaikan qty_out / qty_in di request_konversi

        for (let item of itemsToCancel) {
            const isOut = (item.aktifitas || '').toLowerCase().includes('out');
            const pjgFormatted = formatPanjang(item.panjang);

            if (!reqUpdateMap[item.kode_konversi]) {
                reqUpdateMap[item.kode_konversi] = { deductOut: 0, deductIn: 0 };
            }

            if (isOut) {
                // CANCEL KONVERSI OUT: Masukkan kembali ke stok_global, stok_qr, dan kembalikan stok_aktual
                reqUpdateMap[item.kode_konversi].deductOut++;

                let insertGlobal = {
                    qrcode: item.qrcode,
                    area: item.area,
                    id_sku: item.id_sku,
                    tgl_produksi: item.tgl_produksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenis_item,
                    nama_item: item.nama_item,
                    panjang: pjgFormatted,
                    grade: item.grade,
                    dus: item.dus,
                    shading: item.shading,
                    customer_aktual: item.customer_aktual,
                    keterangan: item.keterangan || '-',
                    kondisi: 'Aman',
                    pic_input: window.currentUser.username,
                    jalur_masuk: 'konversi-cancel-out'
                };

                await db.from('stok_global').insert([insertGlobal]);
                await db.from('stok_qr').insert([{ qrcode: item.qrcode, id_sku: item.id_sku, area: item.area, keterangan: item.keterangan || '-' }]);

                // Kembalikan ke stok_aktual (mencari baris locked konversi atau normal)
                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', item.nama_item).eq('panjang', pjgFormatted).eq('grade', item.grade)
                    .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual)
                    .eq('konversi', item.kode_konversi)
                    .limit(1);

                if(ext && ext.length > 0) {
                    await db.from('stok_aktual').update({ qty: ext[0].qty + 1 }).eq('id', ext[0].id);
                } else {
                    await db.from('stok_aktual').insert([{
                        id_sku: item.id_sku, jenis_item: item.jenis_item, nama_item: item.nama_item, panjang: pjgFormatted,
                        grade: item.grade, dus: item.dus, shading: item.shading, area: item.area,
                        customer_aktual: item.customer_aktual, customer_estimasi: item.customer_aktual,
                        keterangan: item.keterangan || '-', qty: 1, konversi: item.kode_konversi
                    }]);
                }

            } else {
                // CANCEL KONVERSI IN: Hapus dari stok_global, stok_qr, dan kurangi dari stok_aktual
                reqUpdateMap[item.kode_konversi].deductIn++;

                await db.from('stok_global').delete().eq('qrcode', item.qrcode);
                await db.from('stok_qr').delete().eq('qrcode', item.qrcode);

                const { data: extIn } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', item.nama_item).eq('panjang', pjgFormatted).eq('grade', item.grade)
                    .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual)
                    .is('konversi', null)
                    .limit(1);

                if (extIn && extIn.length > 0) {
                    let nQty = extIn[0].qty - 1;
                    if (nQty <= 0) await db.from('stok_aktual').delete().eq('id', extIn[0].id);
                    else await db.from('stok_aktual').update({ qty: nQty }).eq('id', extIn[0].id);
                }
            }

            // Hapus rekaman aktifitas dari stok_konversi
            await db.from('stok_konversi').delete().eq('id', item.id);
        }

        // Update kuantiti out/in dan status progres pada tabel request_konversi
        for (let kode in reqUpdateMap) {
            const upd = reqUpdateMap[kode];
            const { data: reqRow } = await db.from('request_konversi').select('*').eq('kode_konversi', kode).single();
            if (reqRow) {
                let nOut = Math.max(0, (parseInt(reqRow.qty_out) || 0) - upd.deductOut);
                let nIn = Math.max(0, (parseInt(reqRow.qty_in) || 0) - upd.deductIn);
                let nProg = (nOut === 0 && nIn === 0) ? 'PENDING' : 'PROSES';

                await db.from('request_konversi').update({
                    qty_out: nOut.toString(),
                    qty_in: nIn.toString(),
                    progres_konversi: nProg
                }).eq('id', reqRow.id);
            }
        }

        tampilkanAlert(`✅ BERHASIL!\n${itemsToCancel.length} item hasil konversi telah di-cancel dan disesuaikan di gudang.`, "success");
        window.muatData();

    } catch(e) {
        tampilkanAlert("Gagal memproses cancel: " + e.message, "error");
    }
};

// ==========================================
// LOGIKA DONE / UNDONE / CANCEL / HAPUS KONVERSI
// ==========================================
window.doneKonversiMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih baris request yang ingin di-Done kan!", "warning");
    
    if(!confirm(`Yakin ingin menyelesaikan (Done) ${checked.length} request konversi ini?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        await db.from('request_konversi').update({ progres_konversi: 'DONE' }).in('id', ids);
        tampilkanAlert("Status berhasil diubah menjadi DONE!", "success");
        window.muatData();
    } catch(e) { tampilkanAlert("Gagal: " + e.message, "error"); }
};

window.undoneKonversiMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih baris request yang ingin di-Undone kan!", "warning");
    
    if(!confirm(`Yakin ingin mengembalikan status ${checked.length} request konversi ini menjadi PROSES?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        await db.from('request_konversi').update({ progres_konversi: 'PROSES' }).in('id', ids);
        tampilkanAlert("Status berhasil dikembalikan menjadi PROSES!", "success");
        window.muatData();
    } catch(e) { tampilkanAlert("Gagal: " + e.message, "error"); }
};

window.hapusRequest = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih baris request yang ingin dihapus!", "warning");
    
    if(!confirm(`Apakah Anda yakin ingin menghapus ${checked.length} data request konversi ini secara permanen?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        await db.from('request_konversi').delete().in('id', ids);
        tampilkanAlert("Data request berhasil dihapus!", "success");
        window.muatData();
    } catch(e) { tampilkanAlert("Gagal: " + e.message, "error"); }
};

window.cancelKonversiMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih baris request yang ingin di-Cancel!", "warning");
    
    const selectedRequests = window.rawData.filter(r => Array.from(checked).map(cb => cb.value).includes(r.id.toString()));
    
    const hasDone = selectedRequests.some(r => r.progres_konversi === 'DONE');
    if(hasDone) return tampilkanAlert("Gagal! Request yang sudah berstatus DONE tidak bisa di-cancel.", "warning");

    if(!confirm(`⚠️ PERHATIAN!\n\nCancel Konversi akan menghapus request dan otomatis MENGEMBALIKAN seluruh barang yang sudah dikonversi OUT kembali ke Gudang.\n\nApakah Anda yakin ingin membatalkan ${selectedRequests.length} request ini?`)) return;

    const btn = document.getElementById('btn-cancel-konv'); 
    const ori = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Membatalkan...'; btn.disabled = true; }

    const kodes = selectedRequests.map(r => r.kode_konversi);

    try {
        const { data: itemsKonv, error: errKonv } = await db.from('stok_konversi')
            .select('*')
            .in('kode_konversi', kodes)
            .eq('aktifitas', 'Konversi Out');
        
        if(errKonv) throw errKonv;

        if(itemsKonv && itemsKonv.length > 0) {
            let insertsGlobal = [];
            let insertsStokQr = [];

            for(let item of itemsKonv) {
                let pjgFormatted = formatPanjang(item.panjang);

                insertsGlobal.push({
                    qrcode: item.qrcode,
                    area: item.area,
                    id_sku: item.id_sku,
                    tgl_produksi: item.tgl_produksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenis_item,
                    nama_item: item.nama_item,
                    panjang: pjgFormatted,
                    grade: item.grade,
                    dus: item.dus,
                    shading: item.shading,
                    customer_aktual: item.customer_aktual,
                    keterangan: item.keterangan || '-',
                    kondisi: 'Aman',
                    pic_input: window.currentUser.username,
                    jalur_masuk: 'konversi-cancel'
                });

                insertsStokQr.push({
                    qrcode: item.qrcode,
                    id_sku: item.id_sku,
                    area: item.area,
                    keterangan: item.keterangan || '-'
                });

                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', item.nama_item).eq('panjang', pjgFormatted).eq('grade', item.grade)
                    .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual)
                    .eq('konversi', item.kode_konversi)
                    .limit(1);
                
                if(ext && ext.length > 0) {
                    await db.from('stok_aktual').update({qty: ext[0].qty + 1}).eq('id', ext[0].id);
                } else {
                    await db.from('stok_aktual').insert([{
                        id_sku: item.id_sku, jenis_item: item.jenis_item, nama_item: item.nama_item, panjang: pjgFormatted, 
                        grade: item.grade, dus: item.dus, shading: item.shading, area: item.area, 
                        customer_aktual: item.customer_aktual, customer_estimasi: item.customer_aktual, keterangan: item.keterangan || '-', qty: 1, konversi: item.kode_konversi
                    }]);
                }
            }

            await db.from('stok_global').insert(insertsGlobal);
            await db.from('stok_qr').insert(insertsStokQr);
        }

        // Mengembalikan baris merah (locked) menjadi baris normal (konversi = null)
        for(let req of selectedRequests) {
            const { data: rowKonv } = await db.from('stok_aktual').select('*')
                .eq('konversi', req.kode_konversi)
                .limit(1);
            
            if(rowKonv && rowKonv.length > 0) {
                let qtyRevert = rowKonv[0].qty;
                
                const { data: rowNormal } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', req.nama_item).eq('panjang', formatPanjang(req.panjang)).eq('grade', req.grade)
                    .eq('dus', req.dus).eq('shading', req.shading).eq('area', req.area)
                    .eq('customer_aktual', req['customer aktual'])
                    .is('konversi', null)
                    .limit(1);
                
                if(rowNormal && rowNormal.length > 0) {
                    await db.from('stok_aktual').update({ qty: rowNormal[0].qty + qtyRevert }).eq('id', rowNormal[0].id);
                    await db.from('stok_aktual').delete().eq('id', rowKonv[0].id);
                } else {
                    await db.from('stok_aktual').update({ konversi: null }).eq('id', rowKonv[0].id);
                }
            }
        }

        await db.from('stok_konversi').delete().in('kode_konversi', kodes);
        await db.from('request_konversi').delete().in('kode_konversi', kodes);

        tampilkanAlert(`✅ BERHASIL!\nRequest konversi dibatalkan dan barang telah dikembalikan ke Gudang secara utuh.`, "success");
        window.muatData();

    } catch(e) {
        tampilkanAlert("Gagal membatalkan request: " + e.message, "error");
    } finally {
        if(btn) { btn.innerHTML = ori; btn.disabled = false; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ==========================================
// PAGINASI, FILTER & EXCEL
// ==========================================
window.highlightRow = function(checkbox, skipStateReset = false) {
    const tr = checkbox.closest('tr');
    if (tr) {
        if (checkbox.checked) { tr.classList.add('selected-row'); } 
        else { tr.classList.remove('selected-row'); }
    }

    const card = checkbox.closest('.border.rounded-2xl');
    if (card) {
        if (checkbox.checked) { 
            card.classList.add('ring-2', 'ring-blue-500'); 
        } else { 
            card.classList.remove('ring-2', 'ring-blue-500'); 
        }
    }
    
    if(!skipStateReset && !checkbox.checked && window.selectAllState !== 0) { window.selectAllState = 0; window.updateSelectAllUI(); }
    if(!skipStateReset) window.updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    if (val === 'ALL') { window.rowsPerPage = 999999; } else { window.rowsPerPage = parseInt(val); }
    localStorage.setItem('wms_rows_per_page', window.rowsPerPage); 
    window.currentPage = 1; 
    window.applyPagination();
};

window.jumpToPage = function(val) {
    let p = parseInt(val);
    const visibleCount = document.querySelectorAll('#tbody-req tr.r-row:not(.filtered-out)').length;
    const totalPages = Math.ceil(visibleCount / window.rowsPerPage) || 1;
    if (isNaN(p) || p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    
    window.currentPage = p;
    const inp = document.getElementById('input-page-jump');
    if(inp) inp.value = window.currentPage;
    window.applyPagination();
};

function updatePaginationUI() {
    const allRows = Array.from(document.querySelectorAll('#tbody-req tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / window.rowsPerPage) || 1;

    let sumQty = 0;
    visibleRows.forEach(row => {
        const qtyCell = row.querySelector('.col-qty_req') || row.querySelector('.col-qty');
        if(qtyCell) { sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; } 
        else { sumQty += 1; }
    });

    const lblTampil = document.getElementById('lbl-tampil-baris');
    const lblQty = document.getElementById('lbl-total-qty');
    const inpPage = document.getElementById('input-page-jump');
    const lblTotHal = document.getElementById('lbl-total-halaman');

    if(lblTampil) lblTampil.innerText = totalFiltered;
    if(lblQty) lblQty.innerText = sumQty;
    if(lblTotHal) lblTotHal.innerText = totalPages;
    if(inpPage) {
        inpPage.value = window.currentPage;
        inpPage.max = totalPages;
    }
    window.updateSelectedCount();
}

window.applyPagination = function() {
    if(window.currentTab === 'MOBILE') return; 

    const allRows = Array.from(document.querySelectorAll('#tbody-req tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });

    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / window.rowsPerPage) || 1;
    
    if(window.currentPage > totalPages) window.currentPage = totalPages;
    if(window.currentPage < 1) window.currentPage = 1;

    const startIndex = (window.currentPage - 1) * window.rowsPerPage;
    const endIndex = startIndex + window.rowsPerPage;

    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1'); 
        else row.classList.add('stripe-2');

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    updatePaginationUI();
    
    if (window.selectAllState === 1) { window.selectAllState = 0; window.updateSelectAllUI(); }
    window.applySelection(); 
    window.updateSelectedCount();
};

window.prevPage = function() { if(window.currentPage > 1) { window.currentPage--; window.applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-req tr.r-row:not(.filtered-out)').length; if(window.currentPage < Math.ceil(totalVisible / window.rowsPerPage)) { window.currentPage++; window.applyPagination(); } };

window.updateSelectedCount = function() { 
    const count = document.querySelectorAll('.cb-main:checked').length; 
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count; 
    if(document.getElementById('lbl-mobile-selected-count')) document.getElementById('lbl-mobile-selected-count').innerText = count; 
};

window.cycleSelectAll = function() { window.selectAllState = (window.selectAllState + 1) % 3; window.updateSelectAllUI(); window.applySelection(); };
window.updateSelectAllUI = function() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (window.selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto cursor-pointer'; } 
    else if (window.selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto cursor-pointer'; } 
    else if (window.selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto cursor-pointer'; }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-req tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const startIndex = (window.currentPage - 1) * window.rowsPerPage; const endIndex = startIndex + window.rowsPerPage;

    if (window.selectAllState === 0) { allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }); } 
    else if (window.selectAllState === 1) {
        allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } });
        visibleRows.forEach((row, index) => { if(index >= startIndex && index < endIndex) { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; window.highlightRow(cb, true); } } });
    } else if (window.selectAllState === 2) {
        visibleRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; window.highlightRow(cb, true); } });
    }
    window.updateSelectedCount();
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); window.currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-req tr.r-row').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in window.activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = window.activeFilters[otherCol]; const c = row.querySelector('.' + otherCol);
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
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    sortedValues.forEach(val => {
        let isChecked = true; if (window.activeFilters[colClass] && !window.activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}"><input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> <span class="truncate text-slate-600">${val}</span></label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; window.updateSelectAllState(); document.getElementById('filter-search-input').value = '';
    const menu = document.getElementById('excel-filter-menu'); 
    if(menu) {
        menu.classList.remove('hidden');
        const btnRect = event.currentTarget.getBoundingClientRect(); const menuWidth = 256; 
        let topPos = btnRect.bottom + 4; let leftPos = btnRect.left; 
        if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
        if (leftPos < 10) { leftPos = 10; }
        menu.style.position = 'fixed'; menu.style.top = `${topPos}px`; menu.style.left = `${leftPos}px`;
    }
    document.getElementById('filter-search-input')?.focus();
};

window.toggleAllFilterValues = function(checked) { document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; }); window.updateSelectAllState(); };
window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};
document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) window.updateSelectAllState(); });
window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x); 
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        let matches = query.every(term => text.includes(term)); label.style.display = matches ? '' : 'none';
    });
};
window.closeFilterMenu = function() { document.getElementById('excel-filter-menu')?.classList.add('hidden'); };
window.clearFilterForCurrentCol = function() { delete window.activeFilters[window.currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete window.activeFilters[window.currentFilterCol]; } 
    else { let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); window.activeFilters[window.currentFilterCol] = selectedVals; }
    window.closeFilterMenu(); window.saringTabelExcel(); 
};
window.saringTabelExcel = function() {
    renderTabelBody();
    document.querySelectorAll('#tbody-req tr.r-row').forEach(row => {
        let show = true;
        for (let colClass in window.activeFilters) {
            const allowedValues = window.activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }
    });
    window.selectAllState = 0; 
    window.updateSelectAllUI(); 
    window.currentPage = 1; 
    window.applyPagination(); 
    window.updateFilterIcons();
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    document.querySelectorAll('th.hdr-filtered').forEach(th => th.classList.remove('hdr-filtered'));

    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { 
            th.classList.add('hdr-filtered');
            const icon = th.querySelector('.filter-icon'); 
            if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } 
        }
    }
};

window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return tampilkanAlert("Pilih data yang ingin disalin!", "warning");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr');
        if (tr) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
                if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(val.replace(/\n/g, ' ')); }
            });
            copyString += rowData.join('\t') + '\n';
        }
    });
    navigator.clipboard.writeText(copyString).then(() => { tampilkanAlert("Berhasil menyalin data! Buka Excel dan Paste (Ctrl+V).", "success"); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return tampilkanAlert("Library Excel belum termuat.", "error");
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);
    document.querySelectorAll('.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
                if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(`"${val.replace(/\n/g, ' ')}"`); }
            });
            ws_data.push(rowData);
        }
    });
    if(ws_data.length <= 1) return tampilkanAlert("Pilih minimal 1 baris data untuk di-export!", "warning");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Request_Konversi"); XLSX.writeFile(wb, `Request_Konversi.xlsx`);
};

window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); window.renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => th && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; const label = th.innerText.trim() || 'Kolom';
        const div = document.createElement('div'); div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab'; div.draggable = true; div.setAttribute('data-col', colClass);
        div.innerHTML = `<span class="font-bold text-slate-700 text-xs">${label}</span><i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>`;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); }); div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = window.getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    window.userColOrder = newOrder; localStorage.setItem(`col_order_req_${window.currentUser.username}`, JSON.stringify(newOrder));
    tampilkanAlert("Urutan kolom berhasil disimpan!", "success"); 
    window.toggleSidebarKolom(); 
    window.renderTabelHeaders();
    renderTabelBody(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    window.userColOrder = []; localStorage.removeItem(`col_order_req_${window.currentUser.username}`);
    tampilkanAlert("Urutan dikembalikan ke default.", "success"); 
    window.toggleSidebarKolom(); 
    window.renderTabelHeaders();
    renderTabelBody();
};

window.applyColumnOrder = function() {
    if (!window.userColOrder || window.userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb')); const btnCell = cells.find(c => c.classList.contains('col-btn'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; if (cbCell) row.appendChild(cbCell); if (btnCell) row.appendChild(btnCell); 
        window.userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && !window.userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
};

window.initResizableColumns = function() {
    const cols = document.querySelectorAll('#main-table th');
    cols.forEach(col => {
        const existing = col.querySelector('.resizer'); if(existing) existing.remove();
        const resizer = document.createElement('div'); resizer.classList.add('resizer'); col.appendChild(resizer);
        let x = 0; let w = 0;
        resizer.addEventListener('mousedown', function(e) {
            x = e.clientX; w = parseInt(window.getComputedStyle(col).width, 10);
            document.addEventListener('mousemove', mouseMoveHandler); document.addEventListener('mouseup', mouseUpHandler); resizer.classList.add('resizing');
        });
        const mouseMoveHandler = function(e) { const dx = e.clientX - x; col.style.width = `${w + dx}px`; col.style.minWidth = `${w + dx}px`; };
        const mouseUpHandler = function() { document.removeEventListener('mousemove', mouseMoveHandler); document.removeEventListener('mouseup', mouseUpHandler); resizer.classList.remove('resizing'); };
    });
};
