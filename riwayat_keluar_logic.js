let modeSekarang = 'mobile'; // Default ke Mobile
let rawDataRaw = [];
let holdDataRaw = [];
let kamusData = [];
let jasperData = [];
let sortState = {}; 
let globalCheckedCancel = []; 

let activeFilters = {}; 
let currentFilterCol = '';
let currentPage = 1;
let rowsPerPage = 10; 
let selectAllState = 0; 

// State Khusus Mode Mobile
let mobileLevel = 1; // 1: Customer, 2: Item, 3: Shading
let mobileSelectedCust = '';
let mobileSelectedItem = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_keluar', title: 'RIWAYAT KELUAR', url: 'riwayat_keluar.html' });
    
    // Set default date mobile
    document.getElementById('filter-date-mobile').value = getTodayDate();

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
        
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !e.target.closest('button[onclick^="toggleActionMenu"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    setTimeout(async () => {
        await loadKamusDanJasper();
        await loadAreasForCancel(); 
        await muatDataDariSupabase();
    }, 200);
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

async function loadAreasForCancel() {
    try {
        const { data } = await db.from('master_area').select('*');
        if (data) {
            const areas = [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))];
            const sel = document.getElementById('cancel-area');
            sel.innerHTML = '<option value="">-- PILIH AREA GUDANG --</option>';
            areas.sort().forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

async function loadKamusDanJasper() {
    const { data: d2 } = await db.from('master_2').select('*'); 
    if(d2) {
        kamusData = d2;
        window.masterData = { kamus: d2 };
    }
    try {
        const { data: dj } = await db.from('nama_jasper').select('*').order('created_at', {ascending: false});
        if(dj) jasperData = dj;
    } catch(e) {}
}

function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-keluar');
    tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data Keluar...</p></td></tr>`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    let queryKeluar = db.from('stok_keluar').select('*').order('created_at', {ascending: false}); 
    let queryHold = db.from('hold_keluar').select('*').order('created_at', {ascending: false}); 

    try {
        const [resK, resH] = await Promise.all([queryKeluar, queryHold]);
        if(resK.error) throw resK.error;
        if(resH.error) throw resH.error;
        
        rawDataRaw = resK.data || [];
        holdDataRaw = resH.data || [];
        
        setMode(modeSekarang);
    } catch(err) { 
        tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`; 
    }
}

function setMode(m) {
    modeSekarang = m;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    ['mobile', 'qrcode', 'item', 'jasper', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-mode-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });

    const btnHold = document.getElementById('btn-hold');
    const btnCancel = document.getElementById('btn-cancel');
    const dateFilter = document.getElementById('mobile-date-filter');
    
    const viewTable = document.getElementById('view-table');
    const viewMobile = document.getElementById('view-mobile');
    const footerPagination = document.getElementById('footer-pagination');

    if(m === 'qrcode') { 
        btnHold.classList.remove('hidden'); btnCancel.classList.add('hidden'); 
        dateFilter.classList.add('hidden');
        viewTable.classList.remove('hidden'); viewMobile.classList.add('hidden');
        footerPagination.classList.remove('hidden');
    }
    else if(m === 'hold') { 
        btnHold.classList.add('hidden'); btnCancel.classList.remove('hidden'); 
        dateFilter.classList.add('hidden');
        viewTable.classList.remove('hidden'); viewMobile.classList.add('hidden');
        footerPagination.classList.remove('hidden');
    }
    else if(m === 'mobile') {
        btnHold.classList.add('hidden'); btnCancel.classList.add('hidden'); 
        dateFilter.classList.remove('hidden');
        viewTable.classList.add('hidden'); viewMobile.classList.remove('hidden');
        footerPagination.classList.add('hidden');
        mobileLevel = 1; // Reset ke level 1 tiap kali buka tab
    }
    else { 
        btnHold.classList.add('hidden'); btnCancel.classList.add('hidden'); 
        dateFilter.classList.add('hidden');
        viewTable.classList.remove('hidden'); viewMobile.classList.add('hidden');
        footerPagination.classList.remove('hidden');
    }

    activeFilters = {}; 
    
    if (m === 'mobile') {
        renderMobileView();
    } else {
        renderHeaderDanTabel();
    }
}

// ========================================================
// LOGIKA MODE MOBILE (FOLDER VIEW)
// ========================================================
window.applyMobileDateFilter = function() {
    mobileLevel = 1;
    renderMobileView();
};

window.goToMobileLevel2 = function(cust) {
    mobileSelectedCust = cust;
    mobileLevel = 2;
    renderMobileView();
};

window.goToMobileLevel3 = function(itemKey) {
    mobileSelectedItem = itemKey;
    mobileLevel = 3;
    renderMobileView();
};

window.goBackMobile = function() {
    if (mobileLevel > 1) mobileLevel--;
    renderMobileView();
};

function renderMobileView() {
    const container = document.getElementById('view-mobile');
    const targetDate = document.getElementById('filter-date-mobile').value;

    // 1. Filter Data (Tanggal + Filter Sidebar)
    let mobileData = rawDataRaw.filter(r => {
        const rowDate = r.created_at.split('T')[0];
        if (rowDate !== targetDate) return false;

        // Terapkan filter sidebar jika ada
        const t = window.translateBarcode(r.qrcode);
        const custAktual = r.customer_aktual || t.customer || '-';
        const custEstimasi = r.customer_estimasi || '-';
        const customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku);

        const sv = {
            'col-status': 'VERIFIED', 
            'col-tujuan': customerKeluar,
            'col-customer': custAktual,
            'col-estimasi': custEstimasi,
            'col-qr': r.qrcode,
            'col-jenis': t.jenisItem,
            'col-nama': t.namaItem,
            'col-pjg': t.panjang,
            'col-grade': t.grade,
            'col-dus': t.dus,
            'col-shading': t.shading
        };

        for (let col in activeFilters) {
            const allowed = activeFilters[col];
            if (!allowed.includes(sv[col])) return false;
        }
        return true;
    });

    if (mobileData.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-48 bg-white rounded-xl border border-slate-200 shadow-sm mt-4">
                <i data-lucide="folder-search" class="w-12 h-12 text-slate-300 mb-2"></i>
                <p class="text-sm font-bold text-slate-500">Tidak ada pengiriman pada tanggal ini.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    let html = '';

    // LEVEL 1: CUSTOMER
    if (mobileLevel === 1) {
        let custMap = {};
        mobileData.forEach(r => {
            let cust = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
            if(!custMap[cust]) custMap[cust] = 0;
            custMap[cust]++;
        });

        html += `<h3 class="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 px-1">Daftar Pengiriman (Customer)</h3>`;
        
        Object.keys(custMap).sort().forEach(cust => {
            html += `
                <div onclick="goToMobileLevel2('${cust}')" class="bg-white border border-blue-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-blue-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <i data-lucide="truck" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-base uppercase">${cust}</h4>
                            <p class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max mt-1 border border-blue-100">Total: ${custMap[cust]} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    } 
    // LEVEL 2: ITEM SPEC
    else if (mobileLevel === 2) {
        let itemMap = {};
        mobileData.forEach(r => {
            let cust = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
            if (cust !== mobileSelectedCust) return;

            const t = window.translateBarcode(r.qrcode);
            let key = `${t.namaItem}_${t.panjang}_${t.grade}_${t.dus}`;
            
            if(!itemMap[key]) {
                itemMap[key] = { nama: t.namaItem, pjg: t.panjang, grade: t.grade, dus: t.dus, qty: 0 };
            }
            itemMap[key].qty++;
        });

        html += `
            <div class="flex items-center gap-3 mb-2 px-1">
                <button onclick="goBackMobile()" class="p-1.5 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 active:scale-95 transition"><i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i></button>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-400 uppercase leading-none">Customer</span>
                    <span class="text-sm font-black text-blue-700 uppercase leading-tight">${mobileSelectedCust}</span>
                </div>
            </div>
        `;

        Object.keys(itemMap).sort().forEach(key => {
            let item = itemMap[key];
            html += `
                <div onclick="goToMobileLevel3('${key}')" class="bg-white border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-emerald-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <i data-lucide="box" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-sm leading-snug">${item.nama} - ${item.pjg} - ${item.grade} - ${item.dus}</h4>
                            <p class="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-max mt-1 border border-emerald-100">Qty: ${item.qty} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    }
    // LEVEL 3: SHADING
    else if (mobileLevel === 3) {
        let shadingMap = {};
        mobileData.forEach(r => {
            let cust = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
            if (cust !== mobileSelectedCust) return;

            const t = window.translateBarcode(r.qrcode);
            let key = `${t.namaItem}_${t.panjang}_${t.grade}_${t.dus}`;
            if (key !== mobileSelectedItem) return;

            let shading = t.shading || '-';
            if(!shadingMap[shading]) shadingMap[shading] = 0;
            shadingMap[shading]++;
        });

        let itemParts = mobileSelectedItem.split('_');
        let displayItem = `${itemParts[0]} - ${itemParts[1]} - ${itemParts[2]} - ${itemParts[3]}`;

        html += `
            <div class="flex items-center gap-3 mb-2 px-1">
                <button onclick="goBackMobile()" class="p-1.5 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 active:scale-95 transition"><i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i></button>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-400 uppercase leading-none">Rincian Item</span>
                    <span class="text-xs font-black text-emerald-700 uppercase leading-tight">${displayItem}</span>
                </div>
            </div>
        `;

        Object.keys(shadingMap).sort().forEach(shading => {
            html += `
                <div class="bg-white border border-amber-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <i data-lucide="palette" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Shading</span>
                            <h4 class="font-black text-slate-800 text-base">${shading}</h4>
                        </div>
                    </div>
                    <div class="bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                        <span class="text-sm font-black text-amber-700">${shadingMap[shading]} Dus</span>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ========================================================
// LOGIKA TABEL STANDAR (QR, ITEM, JASPER, HOLD)
// ========================================================

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-keluar');
    const rows = Array.from(tbody.querySelectorAll('tr.text-row'));
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
    applyPagination();
}

const thSort = (label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center">
            <div class="flex items-center justify-center w-full">${label}</div>
        </th>`;
    }

    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(this.closest('th').cellIndex, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable(this.closest('th').cellIndex, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
};

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-keluar tr.text-row').forEach(row => {
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
    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0"> <span class="font-black text-slate-800">(PILIH SEMUA)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = true;
        if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate font-bold text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        
        const btnRect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 256; 
        
        let topPos = btnRect.bottom + 4; 
        let leftPos = btnRect.left; 

        if (leftPos + menuWidth > window.innerWidth) {
            leftPos = btnRect.right - menuWidth;
        }
        
        if (leftPos < 10) {
            leftPos = 10;
        }

        menu.style.position = 'fixed'; 
        menu.style.top = `${topPos}px`;
        menu.style.left = `${leftPos}px`;
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
}

function toggleAllFilterValues(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    updateSelectAllState();
}
function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
}

function searchFilterList(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
}
function closeFilterMenu() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); }
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); updateFilterIcons(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcel(); updateFilterIcons();
}
function saringTabelExcel() {
    if (modeSekarang === 'mobile') {
        renderMobileView();
        updateFilterIcons();
        return;
    }

    document.querySelectorAll('.text-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.row-cb'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    selectAllState = 0;
    updateSelectAllUI();
    currentPage = 1; applyPagination();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('opacity-40', 'text-white'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
}

// ========================================================
// TRI-STATE CHECKBOX LOGIC
// ========================================================
window.cycleSelectAll = function() {
    selectAllState = (selectAllState + 1) % 3;
    updateSelectAllUI();
    applySelection();
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

function applySelection() {
    const allRows = Array.from(document.querySelectorAll('#tbody-keluar tr.text-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
    } else if (selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.row-cb');
                if(cb) { cb.checked = true; highlightRow(cb, true); }
            }
        });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = true; highlightRow(cb, true); }
        });
    }
    updateSelectedCount();
}

function highlightRow(cb, skipStateReset = false) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    
    if(!skipStateReset && !cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    
    if(!skipStateReset) updateSelectedCount();
}

function changeRowsPerPage(val) {
    if (val === 'ALL') { rowsPerPage = 999999; } 
    else { rowsPerPage = parseInt(val); }
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; applyPagination();
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-keluar tr.text-row'));
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
        if (qtyCell && (modeSekarang === 'item' || modeSekarang === 'jasper')) { 
            sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 
        } else { 
            sumQty += 1; 
        }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (selectAllState === 1) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    
    applySelection();
    updateSelectedCount();
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-keluar tr.text-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.row-cb:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
}

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-keluar');
    const tbody = document.getElementById('tbody-keluar');
    sortState = {};
    selectAllState = 0;

    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;
    const rowClassBase = "transition text-row text-[13px]";

    if(modeSekarang === 'qrcode' || modeSekarang === 'hold') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Waktu Keluar', 'col-waktu')}
                ${thSort('QRCode', 'col-qr')}
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Aktual', 'col-customer')}
                ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
                ${thSort('Customer Keluar', 'col-tujuan text-amber-300')}
                ${thSort('Keterangan', 'col-ket')}
                ${thSort('PIC Keluar', 'col-pic')}
            </tr>`;
        
        if(targetData.length === 0) { tbody.innerHTML = '<tr><td colspan="17" class="p-10 text-center font-medium text-slate-400">Tidak ada data.</td></tr>'; applyPagination(); return; }
        
        let h = '';
        targetData.forEach((r, i) => {
            const dt = new Date(r.created_at);
            const tglKeluar = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            const td = window.translateBarcode(r.qrcode);
            
            const custAktual = r.customer_aktual || td.customer || '-';
            const custEstimasi = r.customer_estimasi || '-';
            const customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku); 

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.qrcode}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-slate-600 font-medium text-left col-waktu" data-search="${tglKeluar}">${tglKeluar}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 text-left tracking-wider col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl" data-search="${td.tglProduksi}">${td.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin" data-search="${td.mesin}">${td.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift" data-search="${td.shift}">${td.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${td.jenisItem}">${td.jenisItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${td.namaItem}">${td.namaItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${td.panjang}">${td.panjang}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${td.grade}">${td.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${td.dus}">${td.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${td.shading}">${td.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer" data-search="${custAktual}">${custAktual}</td>
                    <td class="px-4 py-3 font-medium text-purple-600 text-left col-estimasi" data-search="${custEstimasi}">${custEstimasi}</td>
                    <td class="px-4 py-3 font-black text-amber-600 text-left col-tujuan" data-search="${customerKeluar}">${customerKeluar}</td>
                    <td class="px-4 py-3 text-slate-500 font-medium text-left col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic" data-search="${r.pic_keluar || r.pic_input || '-'}">${r.pic_keluar || r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if(modeSekarang === 'item' || modeSekarang === 'jasper') {
        const isJasper = modeSekarang === 'jasper';
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort(isJasper ? 'Nama Barang Jasper' : 'Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Aktual', 'col-customer')}
                ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
                ${thSort('Customer Keluar', 'col-tujuan text-amber-300')}
                ${thSort('QTY KELUAR (DUS)', 'col-qty text-emerald-300')}
                ${thSort('Keterangan', 'col-ket')}
            </tr>`;
        
        let groups = {};
        targetData.forEach(r => {
            let t = window.translateBarcode(r.qrcode); 
            let n = isJasper ? t.jasper : t.namaItem;
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let custAktual = r.customer_aktual || t.customer || '-';
            let custEstimasi = r.customer_estimasi || '-';
            let customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku);
            
            let key = `${t.jenisItem}_${n}_${t.panjang}_${t.grade}_${t.dus}_${t.shading}_${custAktual}_${custEstimasi}_${customerKeluar}_${t.tglProduksi}_${t.mesin}_${t.shift}_${ket}`;
            
            if(!groups[key]) {
                groups[key] = { ...t, displayNama: n, qty: 0, qrcodes: [], tj: customerKeluar, ket: ket, custAktual: custAktual, custEstimasi: custEstimasi };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = '<tr><td colspan="15" class="p-10 text-center font-medium text-slate-400">Kosong.</td></tr>'; applyPagination(); return; }

        let h = '';
        arr.forEach((r, i) => {
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.qrcodes.join(',')}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenisItem}">${r.jenisItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.displayNama}">${r.displayNama}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer" data-search="${r.custAktual}">${r.custAktual}</td>
                    <td class="px-4 py-3 font-medium text-purple-600 text-left col-estimasi" data-search="${r.custEstimasi}">${r.custEstimasi}</td>
                    <td class="px-4 py-3 font-black text-amber-600 text-left col-tujuan" data-search="${r.tj}">${r.tj}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty" data-search="${r.qty}">${r.qty}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${displayKet}">${displayKet}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    lucide.createIcons(); 
    updateSelectAllUI();
    saringTabelExcel();
}

async function aksiMassal(tipe) {
    let checkedValues = [];
    document.querySelectorAll('.row-cb:checked').forEach(cb => { cb.value.split(',').forEach(v => { if(v) checkedValues.push(v); }); });
    if(checkedValues.length === 0) return alert("Centang baris tabel terlebih dahulu!");

    if(tipe === 'salin') {
        let textSalin = "";
        if (modeSekarang === 'item' || modeSekarang === 'jasper') {
            textSalin = "Tgl Produksi\tMesin\tShift\tJenis Item\tNama Item\tPjg\tGrade\tDus\tShading\tCustomer Aktual\tCustomer Estimasi\tCustomer Keluar\tQTY KELUAR\tKeterangan\n";
        } else {
            textSalin = "Waktu Keluar\tQRCode\tTgl Produksi\tMesin\tShift\tJenis Item\tNama Item\tPjg\tGrade\tDus\tShading\tCustomer Aktual\tCustomer Estimasi\tCustomer Keluar\tKeterangan\tPIC Keluar\n";
        }

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr'); const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { rowData.push(td.innerText.trim().replace(/\n/g, ' ')); }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        navigator.clipboard.writeText(textSalin);
        alert(`Tersalin! Buka Excel dan Paste (Ctrl+V).`);
    } 
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
        let ws_data = [];
        const headers = Array.from(document.querySelectorAll('#thead-keluar th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim());
        ws_data.push(headers);
        
        document.querySelectorAll('.text-row').forEach(tr => {
            if(tr.style.display !== 'none' && tr.querySelector('.row-cb:checked')) {
                const rowData = [];
                Array.from(tr.children).forEach(td => {
                    if(td.classList.contains('col-cb')) return;
                    if(window.getComputedStyle(td).display !== 'none') { rowData.push(`"${td.innerText.trim()}"`); }
                });
                ws_data.push(rowData);
            }
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Keluar_Data");
        XLSX.writeFile(wb, `Riwayat_Keluar.xlsx`);
    }
    else if(tipe === 'hold') {
        if(modeSekarang !== 'qrcode') return alert("HOLD hanya bisa dilakukan dari Mode QRCODE.");
        if(!confirm(`Yakin ingin menahan (HOLD) ${checkedValues.length} item ini?\n\n(Hanya memindahkan riwayat, TIDAK MENGEMBALIKAN barang ke Gudang).`)) return;
        
        const btn = document.getElementById('btn-hold'); const ori = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> PROSES...'; btn.disabled = true;

        const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({
            qrcode: r.qrcode, id_sku: r.id_sku, customer_keluar: r.customer_keluar, 
            customer_aktual: r.customer_aktual, customer_estimasi: r.customer_estimasi,
            keterangan: 'DI-HOLD dari Riwayat', pic_input: r.pic_keluar || r.pic_input
        }));

        try {
            const { error: errAdd } = await db.from('hold_keluar').insert(dataPindah);
            if(errAdd) throw errAdd;
            const { error: errDel } = await db.from('stok_keluar').delete().in('qrcode', checkedValues);
            if(errDel) throw errDel;
            
            alert(`Berhasil Memindahkan ${checkedValues.length} Item ke TABEL HOLD.`);
            muatDataDariSupabase();
        } catch(e) { alert("GAGAL HOLD: " + e.message); }
        finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
    }
    else if(tipe === 'cancel') {
        if(modeSekarang !== 'hold') return alert("CANCEL hanya bisa dilakukan dari Tabel Hold.");
        
        globalCheckedCancel = checkedValues;
        
        document.getElementById('cancel-ket').value = '';
        document.getElementById('cancel-area').value = '';
        
        document.getElementById('modal-cancel-hold').classList.remove('hidden');
    }
}

async function eksekusiCancelHold() {
    const areaCancel = document.getElementById('cancel-area').value;
    const ketCancel = document.getElementById('cancel-ket').value.trim();

    if(!areaCancel) return alert("Pilih Area Pengembalian terlebih dahulu!");
    if(!ketCancel) return alert("Keterangan wajib diisi!");

    const btn = document.getElementById('btn-submit-cancel'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> RETUR STOK...'; btn.disabled = true;

    const dataReturn = holdDataRaw.filter(r => globalCheckedCancel.includes(r.qrcode));
    let insertsStokQr = [];
    let aktualUpdates = {};

    dataReturn.forEach(item => {
        let parts = item.id_sku.split('_');
        let customerAktual = item.customer_aktual || '-';
        let customerEstimasi = item.customer_estimasi || '-';
        
        if(parts.length >= 8) {
            parts[0] = areaCancel; 
            item.id_sku = parts.join('_');
            
            let [a, jenis, nama, pjg, grade, dus, shading] = parts;
            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${customerAktual}_${customerEstimasi}`;
            if(!aktualUpdates[key]) aktualUpdates[key] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, customer_aktual: customerAktual, customer_estimasi: customerEstimasi, qty: 0 };
            aktualUpdates[key].qty++;
        }

        insertsStokQr.push({
            qrcode: item.qrcode,
            id_sku: item.id_sku,
            area: areaCancel, 
            keterangan: ketCancel 
        });
    });

    try {
        const { error: e1 } = await db.from('stok_qr').insert(insertsStokQr);
        if(e1) throw e1;

        for(let key in aktualUpdates) {
            let u = aktualUpdates[key];
            const {data: curData} = await db.from('stok_aktual').select('id, qty').eq('nama_item', u.nama_item).eq('pjg', u.pjg).eq('grade', u.grade).eq('dus', u.dus).eq('shading', u.shading).eq('customer_aktual', u.customer_aktual).eq('customer_estimasi', u.customer_estimasi).single();
            if(curData) {
                await db.from('stok_aktual').update({qty: curData.qty + u.qty}).eq('id', curData.id);
            } else {
                await db.from('stok_aktual').insert([{...u}]); 
            }
        }

        const { error: e3 } = await db.from('hold_keluar').delete().in('qrcode', globalCheckedCancel);
        if(e3) throw e3;

        alert(`✅ SUKSES CANCEL KELUAR!\n${globalCheckedCancel.length} item telah dikembalikan ke Kartu Stok pada Area "${areaCancel}".`);
        muatDataDariSupabase();
        document.getElementById('modal-cancel-hold').classList.add('hidden');
    } catch(e) { alert("GAGAL RETUR: " + e.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}
