let currentTab = 'pilih';
let dbEstimasiRaw = [];
let dbStokAktualRaw = [];
let alokasiMemoryState = {}; 
let activeEstimasiRow = null; 
let activeStokRow = null; 
let dbPickingListAggregated = [];

// ==========================================
// UNIVERSAL STATE (FILTER, SORT, PAGINASI)
// ==========================================
let filterExcel = { utama: {}, popup: {}, picking: {} };
let activeCtx = ''; 
let currentFilterCol = '';

let currentPageUtama = 1; const rowsPerPageUtama = 10;
let currentPagePopup = 1; const rowsPerPagePopup = 5;
let currentPagePicking = 1; const rowsPerPagePicking = 10;

let sortStateUtama = {};
let sortStatePopup = {};
let sortStatePicking = {};

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'picking_list', title: 'PICKING LIST', url: 'picking_list.html' });
    
    // Listener untuk menutup pop-up Excel Filter jika klik di luar
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[onclick^="bukaFilterExcel"]')) {
                closeFilterMenu();
            }
        }
    });

    await muatAwalDataEstimasi();
});

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('view-pilih').classList.toggle('hidden', tab !== 'pilih');
    document.getElementById('view-picking').classList.toggle('hidden', tab !== 'picking');
    document.getElementById('tab-pilih').className = tab === 'pilih' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    document.getElementById('tab-picking').className = tab === 'picking' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    if(tab === 'picking') initRenderPickingList();
}

async function muatAwalDataEstimasi() {
    const tbody = document.getElementById('tbody-utama-estimasi');
    tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-slate-400 font-bold"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"></i> Memuat Data...</td></tr>`;
    lucide.createIcons();
    
    try {
        const { data, error } = await db.from('estimasi_pengiriman').select('*').order('tanggal_estimasi', { ascending: false });
        if(error) throw error; dbEstimasiRaw = data || [];
        
        const tglUnik = [...new Set(dbEstimasiRaw.map(x => x.tanggal_estimasi))].sort().reverse();
        const poUnik = [...new Set(dbEstimasiRaw.map(x => (x.po_estimasi || '').trim()))].sort();
        
        isiDropdownBiasa('filter-est-tanggal', tglUnik, '-- SEMUA TANGGAL --');
        isiDropdownBiasa('filter-est-po', poUnik, '-- SEMUA PO --');
        
        renderTabelUtamaEstimasi();
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`; 
    }
}

function isiDropdownBiasa(elId, dataArray, textPlaceholder) {
    const el = document.getElementById(elId); if(!el) return;
    let h = `<option value="ALL">${textPlaceholder}</option>`;
    dataArray.forEach(val => { h += `<option value="${val}">${elId.includes('tanggal') ? formatTglIndo(val) : val}</option>`; });
    el.innerHTML = h;
}

function formatTglIndo(tglStr) {
    if(!tglStr) return '-'; const p = tglStr.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : tglStr;
}

function saringTabelUtamaEstimasi() {
    const filterTgl = document.getElementById('filter-est-tanggal').value; 
    const filterPo = document.getElementById('filter-est-po').value;
    
    if (window.event && window.event.target.id === 'filter-est-tanggal') {
        let filteredRecords = filterTgl === 'ALL' ? dbEstimasiRaw : dbEstimasiRaw.filter(r => r.tanggal_estimasi === filterTgl);
        let poUnik = [...new Set(filteredRecords.map(x => (x.po_estimasi || '').trim()))].sort();
        isiDropdownKhususBypass('filter-est-po', poUnik, '-- SEMUA PO --');
    } else if (window.event && window.event.target.id === 'filter-est-po') {
        let filteredRecords = filterPo === 'ALL' ? dbEstimasiRaw : dbEstimasiRaw.filter(r => r.po_estimasi === filterPo);
        let tglUnik = [...new Set(filteredRecords.map(x => x.tanggal_estimasi))].sort().reverse();
        isiDropdownKhususBypass('filter-est-tanggal', tglUnik, '-- SEMUA TANGGAL --', true);
    }
    renderTabelUtamaEstimasi();
}

function isiDropdownKhususBypass(elId, dataArray, placeholderText, isDate = false) {
    const el = document.getElementById(elId); if (!el) return;
    const oldVal = el.value; let html = `<option value="ALL">${placeholderText}</option>`;
    dataArray.forEach(val => html += `<option value="${val}">${isDate ? formatTglIndo(val) : val}</option>`);
    el.innerHTML = html; if (dataArray.includes(oldVal)) el.value = oldVal; else el.value = 'ALL';
}

// ==========================================
// RENDER TABEL 1 (UTAMA ESTIMASI)
// ==========================================
function renderTabelUtamaEstimasi() {
    const tbody = document.getElementById('tbody-utama-estimasi');
    const filterTgl = document.getElementById('filter-est-tanggal').value; 
    const filterPo = document.getElementById('filter-est-po').value;

    let filteredData = dbEstimasiRaw.filter(r => {
        const matchTgl = (filterTgl === 'ALL' || !filterTgl) ? true : r.tanggal_estimasi === filterTgl;
        const matchPo = (filterPo === 'ALL' || !filterPo) ? true : r.po_estimasi === filterPo;
        return matchTgl && matchPo;
    });

    if(filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-slate-400 font-bold">Tidak ada kuota pengiriman estimasi.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredData.map((r, i) => {
        let totalPicked = 0; 
        for (let key in alokasiMemoryState) { if(key.startsWith(r.id + '_')) { totalPicked += alokasiMemoryState[key].qty; } }
        let tglStr = formatTglIndo(r.tanggal_estimasi); 
        const stringRow = JSON.stringify(r).replace(/"/g, '&quot;');
        
        // 1. TAMBAHAN BARU: Cek apakah qty yang diambil sudah memenuhi atau melebihi Jumlah PO
        let isLengkap = (totalPicked >= r.jumlah_po && r.jumlah_po > 0);
        
        // 2. REVISI TR: Jika isLengkap true, warnai hijau (bg-emerald-100), jika tidak biarkan default (hover:bg-slate-50)
        return `
            <tr class="border-b border-slate-200 transition text-sm text-center r-row-utama ${isLengkap ? 'bg-emerald-100 hover:bg-emerald-200' : 'hover:bg-slate-50'}">
                <td class="p-3 font-bold text-slate-400 col-no">${i+1}</td>
                <td class="p-2 border-r border-slate-200 flex justify-center col-btn">
                    <button onclick="bukaPopupStokGudang('${stringRow}')" class="p-1 bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg shadow-sm transition mx-auto">
                        <i data-lucide="box" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-3 font-semibold text-slate-600 col-tgl_est" data-search="${tglStr}">${tglStr}</td>
                <td class="p-3 font-black text-slate-800 border-r border-slate-200 col-po_est" data-search="${r.po_estimasi}">${r.po_estimasi}</td>
                <td class="p-3 font-black text-blue-700 col-nama_item" data-search="${r.nama_item}">${r.nama_item}</td>
                <td class="p-3 font-bold text-slate-600 col-pjg" data-search="${r.panjang}">${r.panjang}</td>
                <td class="p-3 font-bold text-slate-800 col-grade" data-search="${r.grade}">${r.grade}</td>
                <td class="p-3 font-black text-slate-700 bg-slate-50 border-l border-slate-200">${r.jumlah_po}</td>
                <td class="p-3 font-black ${totalPicked > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'} border-l border-slate-200">${totalPicked}</td>
                <td class="p-3 font-medium text-slate-500 pl-4 border-l border-slate-200 whitespace-normal">${r.note || '-'}</td>
            </tr>`;
    }).join('');
    
    lucide.createIcons(); 
    filterExcel.utama = {}; updateFilterIcons('utama'); 
    currentPageUtama = 1; eksekusiDOMTabel('utama');
}

// ==========================================
// RENDER TABEL 2 (MODAL POPUP STOK)
// ==========================================
async function bukaPopupStokGudang(encodedRowStr) {
    activeEstimasiRow = JSON.parse(encodedRowStr);
    
    document.getElementById('pop-title-spec').innerText = `${activeEstimasiRow.nama_item} | ${activeEstimasiRow.panjang} | ${activeEstimasiRow.grade}`;
    document.getElementById('pop-lbl-qty-po').innerText = activeEstimasiRow.jumlah_po;

    const tbody = document.getElementById('tbody-popup-stok');
    tbody.innerHTML = `<tr><td colspan="9" class="p-10"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-blue-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-gudang-stok').classList.remove('hidden');

    try {
        const { data, error } = await db.from('stok_aktual')
            .select('dus, shading, po_aktual, qty, area, keterangan, id')
            .eq('nama_item', activeEstimasiRow.nama_item)
            .eq('pjg', activeEstimasiRow.panjang)
            .eq('grade', activeEstimasiRow.grade)
            .gt('qty', 0);

        if(error) throw error; 
        dbStokAktualRaw = data || [];
        renderTabelPopupStokInternal();
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="9" class="p-5 text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`; 
    }
}

function tutupModalStok() { 
    document.getElementById('modal-gudang-stok').classList.add('hidden'); 
    renderTabelUtamaEstimasi(); 
}

function renderTabelPopupStokInternal() {
    const tbody = document.getElementById('tbody-popup-stok');
    if(dbStokAktualRaw.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-slate-400 font-bold">Stok fisik kosong.</td></tr>'; 
        return; 
    }
    
    tbody.innerHTML = dbStokAktualRaw.map((r, i) => {
        const keyMemory = `${activeEstimasiRow.id}_${r.id}`; 
        const alokasi = alokasiMemoryState[keyMemory]?.qty || 0;
        let textInfo = alokasi > 0 ? 
            `<div class="flex flex-col gap-0.5 text-[10px] text-left mx-auto max-w-max bg-indigo-50 p-1.5 rounded border border-indigo-200">
                <span class="font-bold text-slate-500">Tgl: <span class="text-indigo-800 font-black">${formatTglIndo(activeEstimasiRow.tanggal_estimasi)}</span></span>
                <span class="font-bold text-slate-500">PO: <span class="text-indigo-800 font-black">${activeEstimasiRow.po_estimasi}</span></span>
                <span class="font-bold text-slate-500">Picked Qty: <span class="text-indigo-800 font-black">${alokasi}</span></span>
            </div>` : '-';
        const stringRow = JSON.stringify(r).replace(/"/g, '&quot;');
        
        return `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs r-row-popup">
                <td class="p-2"><button onclick="bukaModalMintaQty('${stringRow}')" class="px-3 py-1.5 ${alokasi > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black rounded-lg text-[10px] shadow-sm uppercase">${alokasi > 0 ? 'Ubah' : 'Pilih'}</button></td>
                <td class="p-3 font-bold text-slate-400 col-no">${i + 1}</td>
                <td class="p-2 border-r border-slate-200">${textInfo}</td>
                <td class="p-3 font-black text-slate-700 border-r border-slate-200 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="p-3 font-bold text-slate-700 border-r border-slate-200 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="p-3 font-black text-slate-800 border-r border-slate-200 col-po_aktual" data-search="${r.po_aktual || '-'}">${r.po_aktual || '-'}</td>
                <td class="p-3 font-black text-emerald-700 bg-emerald-50/50 border-r border-slate-200 col-qty">${r.qty}</td>
                <td class="p-3 font-black text-amber-600 bg-amber-50/30 border-r border-slate-200 col-area" data-search="${r.area || '-'}">${r.area || '-'}</td>
                <td class="p-3 text-center font-medium text-slate-500 max-w-[150px] whitespace-normal leading-tight">${r.keterangan || '-'}</td>
            </tr>`;
    }).join('');
    
    lucide.createIcons(); 
    filterExcel.popup = {}; updateFilterIcons('popup'); 
    currentPagePopup = 1; eksekusiDOMTabel('popup');
}

// ==========================================
// RENDER TABEL 3 (PICKING LIST)
// ==========================================
function initRenderPickingList() {
    dbPickingListAggregated = [];
    for(let key in alokasiMemoryState) { 
        dbPickingListAggregated.push({ keyMemory: key, ...alokasiMemoryState[key] }); 
    }
    renderTabelPickingList();
}

function renderTabelPickingList() {
    const tbody = document.getElementById('tbody-picking-list');
    if (dbPickingListAggregated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-slate-400 font-bold">Belum ada item yang di-picking.</td></tr>'; 
        return;
    }

    tbody.innerHTML = dbPickingListAggregated.map((d, i) => {
        let tglEstStr = formatTglIndo(d.estimasi.tanggal_estimasi);
        return `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs r-row-pick">
            <td class="p-3 font-bold text-slate-400 col-no">${i + 1}</td>
            <td class="p-3 font-semibold text-slate-600 border-r border-slate-200 col-tgl_est" data-search="${tglEstStr}">${tglEstStr}</td>
            <td class="p-3 font-black text-slate-800 border-r border-slate-200 col-po_est" data-search="${d.estimasi.po_estimasi}">${d.estimasi.po_estimasi}</td>
            <td class="p-3 font-black text-slate-700 bg-slate-50 col-jml_po">${d.estimasi.jumlah_po}</td>
            <td class="p-3 font-black text-blue-700 col-nama_item" data-search="${d.estimasi.nama_item}">${d.estimasi.nama_item}</td>
            <td class="p-3 font-bold text-slate-600 col-pjg">${d.estimasi.panjang}</td>
            <td class="p-3 font-bold text-slate-800 border-r border-slate-200 col-grade" data-search="${d.estimasi.grade}">${d.estimasi.grade}</td>
            <td class="p-3 font-black text-slate-700 col-dus" data-search="${d.stok.dus || '-'}">${d.stok.dus || '-'}</td>
            <td class="p-3 font-bold text-slate-700 border-r border-slate-200 col-shading" data-search="${d.stok.shading || '-'}">${d.stok.shading || '-'}</td>
            <td class="p-3 font-black text-emerald-600 bg-emerald-50 border-x border-slate-200 col-qty">${d.qty}</td>
            <td class="p-3 font-black text-amber-600 col-area" data-search="${d.stok.area || '-'}">${d.stok.area || '-'}</td>
            
            <td class="p-3 font-bold text-slate-600 border-l border-slate-200">SISTEM WMS</td>
            
            <td class="p-3 border-l border-slate-200 max-w-[120px] whitespace-normal leading-tight">${d.stok.keterangan || '-'}</td>
            
            <td class="p-2 border-l border-slate-200">
                <button onclick="hapusDariPickingList('${d.keyMemory}')" class="p-1.5 bg-white border border-rose-400 hover:bg-rose-50 text-rose-500 rounded shadow-sm transition active:scale-95"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>`;
    }).join('');
    
    lucide.createIcons();
    filterExcel.picking = {}; updateFilterIcons('picking'); 
    currentPagePicking = 1; eksekusiDOMTabel('picking');
}

// ==========================================
// ENGINE UNIVERSAL: MANIPULASI DOM (FILTER & PAGINASI)
// ==========================================
function eksekusiDOMTabel(ctx) {
    let tbodyId = ctx === 'utama' ? 'tbody-utama-estimasi' : (ctx === 'popup' ? 'tbody-popup-stok' : 'tbody-picking-list');
    let rowClass = ctx === 'utama' ? '.r-row-utama' : (ctx === 'popup' ? '.r-row-popup' : '.r-row-pick');
    let limit = ctx === 'utama' ? rowsPerPageUtama : (ctx === 'popup' ? rowsPerPagePopup : rowsPerPagePicking);
    let currPage = ctx === 'utama' ? currentPageUtama : (ctx === 'popup' ? currentPagePopup : currentPagePicking);
    let lblPage = ctx === 'utama' ? 'utama-page-info' : (ctx === 'popup' ? 'popup-page-info' : 'picking-page-info');

    // 1. Eksekusi Filter Excel pada Baris
    document.querySelectorAll(`#${tbodyId} ${rowClass}`).forEach(row => {
        let show = true;
        for (let colClass in filterExcel[ctx]) {
            const allowed = filterExcel[ctx][colClass]; 
            const cell = row.querySelector('.' + colClass);
            if (cell && !allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { 
                show = false; 
                break; 
            }
        }
        if (show) row.classList.remove('filtered-out'); else row.classList.add('filtered-out');
    });

    // 2. Eksekusi Paginasi
    const allRows = Array.from(document.querySelectorAll(`#${tbodyId} ${rowClass}`));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalPages = Math.ceil(visibleRows.length / limit) || 1;
    
    if(currPage > totalPages) currPage = totalPages; 
    if(currPage < 1) currPage = 1;
    
    // Simpan current page ke variabel global
    if(ctx === 'utama') currentPageUtama = currPage; 
    else if(ctx === 'popup') currentPagePopup = currPage; 
    else currentPagePicking = currPage;

    const startIdx = (currPage - 1) * limit; 
    const endIdx = startIdx + limit;
    
    visibleRows.forEach((row, index) => {
        if(index >= startIdx && index < endIdx) { 
            row.style.display = ''; 
            row.querySelector('.col-no').innerText = index + 1; // Auto Update No
        } 
        else { row.style.display = 'none'; }
    });
    
    const pageLabel = document.getElementById(lblPage);
    if(pageLabel) pageLabel.innerText = `Hal ${currPage} dari ${totalPages}`;

    // Khusus Tabel Popup: Hitung ulang kalkulasi "Jumlah Diambil" di atas header modal
    if(ctx === 'popup') {
        let hitungAkurat = 0;
        dbStokAktualRaw.forEach(r => { 
            const km = `${activeEstimasiRow.id}_${r.id}`; 
            hitungAkurat += alokasiMemoryState[km]?.qty || 0; 
        });
        document.getElementById('pop-lbl-qty-picked').innerText = hitungAkurat;
    }
    // Update Info Paginasi Baru (Filter Count & Total Qty)
    let totalQty = 0;
    visibleRows.forEach(r => {
        if(ctx === 'utama') totalQty += parseInt(r.children[7].innerText) || 0; // Kolom ke-8 adalah Jumlah PO
        else if(ctx === 'popup') totalQty += parseInt(r.querySelector('.col-qty')?.innerText) || 0;
        else if(ctx === 'picking') totalQty += parseInt(r.querySelector('.col-qty')?.innerText) || 0;
    });

    const filterLbl = document.getElementById(`${ctx}-filter-info`);
    if(filterLbl) filterLbl.innerText = `Tampil Filter: ${visibleRows.length}`;
    
    const qtyLbl = document.getElementById(`${ctx}-qty-info`);
    if(qtyLbl) qtyLbl.innerText = ctx === 'utama' ? `Total Qty PO: ${totalQty}` : (ctx === 'popup' ? `Total Qty (Dus): ${totalQty}` : `Total Picked Qty: ${totalQty}`);
}

// ==========================================
// ENGINE UNIVERSAL: FILTER EXCEL POPUP MENU
// ==========================================
function bukaFilterExcel(event, ctx, colClass, colName) {
    event.stopPropagation(); activeCtx = ctx; currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `FILTER: ${colName}`;
    
    let tbodyId = ctx === 'utama' ? 'tbody-utama-estimasi' : (ctx === 'popup' ? 'tbody-popup-stok' : 'tbody-picking-list');
    let rowClass = ctx === 'utama' ? '.r-row-utama' : (ctx === 'popup' ? '.r-row-popup' : '.r-row-pick');
    let uniqueValues = new Set();

    document.querySelectorAll(`#${tbodyId} ${rowClass}`).forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in filterExcel[ctx]) {
            if (otherCol !== colClass && !filterExcel[ctx][otherCol].includes(row.querySelector('.' + otherCol)?.getAttribute('data-search'))) { 
                showBasedOnOthers = false; break; 
            }
        }
        if (showBasedOnOthers) { 
            let cell = row.querySelector('.' + colClass); 
            if(cell) uniqueValues.add(cell.getAttribute('data-search') || cell.innerText.trim()); 
        }
    });

    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0"> <span class="font-black text-slate-800">(PILIH SEMUA)</span></label>`;
    
    Array.from(uniqueValues).sort().forEach(val => {
        let isChecked = !filterExcel[ctx][colClass] || filterExcel[ctx][colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded filter-val-item" data-value="${encodeURIComponent(val)}"><input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> <span class="truncate font-bold text-slate-600">${val}</span></label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; 
    updateSelectAllState();
    
    const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden'); 
        let rect = event.currentTarget.getBoundingClientRect();
        menu.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        menu.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 266) + 'px';
    }
}

function toggleAllFilterValues(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { 
        if(cb.closest('label').style.display !== 'none') cb.checked = checked; 
    });
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

function searchFilterList(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
}

function closeFilterMenu() { 
    const menu = document.getElementById('excel-filter-menu'); 
    if(menu) menu.classList.add('hidden'); 
}

function applyFilterForCurrentCol() {
    const checked = document.querySelectorAll('.filter-val-cb:checked'); 
    const total = document.querySelectorAll('.filter-val-cb');
    
    if (checked.length === total.length) {
        delete filterExcel[activeCtx][currentFilterCol]; 
    } else {
        filterExcel[activeCtx][currentFilterCol] = Array.from(checked).map(cb => decodeURIComponent(cb.value));
    }
    closeFilterMenu(); 
    updateFilterIcons(activeCtx); 
    eksekusiDOMTabel(activeCtx);
}

function clearFilterForCurrentCol() { 
    delete filterExcel[activeCtx][currentFilterCol]; 
    closeFilterMenu(); 
    updateFilterIcons(activeCtx); 
    eksekusiDOMTabel(activeCtx); 
}

function resetFilterPopupInternal() {
    filterExcel.popup = {};
    updateFilterIcons('popup');
    eksekusiDOMTabel('popup');
}

function updateFilterIcons(ctx) {
    let suffix = ctx === 'utama' ? 'u' : (ctx === 'popup' ? 'p' : 'pick');
    document.querySelectorAll(`.filter-ic-${suffix}`).forEach(icon => { 
        icon.classList.remove('text-amber-400', 'opacity-100'); 
        icon.classList.add('opacity-40', 'text-white'); 
    });
    for (let col in filterExcel[ctx]) {
        const btn = document.querySelector(`button[onclick*="'${col}'"]`);
        if (btn) { 
            const icon = btn.querySelector('i'); 
            icon.classList.remove('opacity-40', 'text-white'); 
            icon.classList.add('text-amber-400', 'opacity-100'); 
        }
    }
}

// ==========================================
// ENGINE UNIVERSAL: GANTI HALAMAN & SORTING
// ==========================================
function gantiPageUtama(dir) { currentPageUtama += dir; eksekusiDOMTabel('utama'); }
function changePagePopup(dir) { currentPagePopup += dir; eksekusiDOMTabel('popup'); }
function changePagePicking(dir) { currentPagePicking += dir; eksekusiDOMTabel('picking'); }

function sortUtama(kolom, el) { genericSort('utama', 'tbody-utama-estimasi', '.r-row-utama', '.sort-ic-u', sortStateUtama, kolom, el); }
function sortPopup(kolom, el) { genericSort('popup', 'tbody-popup-stok', '.r-row-popup', '.sort-ic-p', sortStatePopup, kolom, el); }
function sortTablePicking(kolom, el) { genericSort('picking', 'tbody-picking-list', '.r-row-pick', '.sort-icon-pick', sortStatePicking, kolom, el); }

function genericSort(ctx, tbodyId, rowCls, icCls, stateObj, kolom, el) {
    const tbody = document.getElementById(tbodyId); 
    const rows = Array.from(tbody.querySelectorAll(rowCls));
    
    let colMap = { 
        'tgl_estimasi': 'col-tgl_est', 'po_estimasi': 'col-po_est', 'nama_item': 'col-nama_item', 
        'panjang': 'col-pjg', 'grade': 'col-grade', 'dus': 'col-dus', 'shading': 'col-shading', 
        'po_aktual': 'col-po_aktual', 'area': 'col-area', 'qty': 'col-qty' 
    };
    let targetCls = colMap[kolom] || ('col-' + kolom);

    let isAsc = stateObj.kolom === kolom ? !stateObj.isAsc : true;
    stateObj.kolom = kolom; 
    stateObj.isAsc = isAsc;

    rows.sort((a, b) => {
        let valA = a.querySelector('.' + targetCls)?.getAttribute('data-search') || a.querySelector('.' + targetCls)?.innerText || '';
        let valB = b.querySelector('.' + targetCls)?.getAttribute('data-search') || b.querySelector('.' + targetCls)?.innerText || '';
        
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    
    rows.forEach(r => tbody.appendChild(r));
    
    document.querySelectorAll(icCls).forEach(ic => { 
        ic.setAttribute('data-lucide', 'arrow-up-down'); 
        ic.classList.add('opacity-30'); 
    });
    if(el) { 
        const ic = el.querySelector('i'); 
        ic.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); 
        ic.classList.remove('opacity-30'); 
        lucide.createIcons(); 
    }
    eksekusiDOMTabel(ctx);
}

// ==========================================
// LOGIKA INPUT QTY & INPUT PRODUKSI (MODAL)
// ==========================================
function bukaModalMintaQty(encodedStokRowStr) {
    activeStokRow = JSON.parse(encodedStokRowStr); 
    document.getElementById('lbl-max-qty').innerText = activeStokRow.qty;
    
    const keyMemory = `${activeEstimasiRow.id}_${activeStokRow.id}`; 
    document.getElementById('input-qty-ambil').value = alokasiMemoryState[keyMemory]?.qty || '';
    
    document.getElementById('modal-input-qty').classList.remove('hidden'); 
    document.getElementById('input-qty-ambil').focus();
}

function simpanKuotaAmbilLokal() {
    const inputVal = parseInt(document.getElementById('input-qty-ambil').value); 
    const maxQty = parseInt(activeStokRow.qty);
    const keyMemory = `${activeEstimasiRow.id}_${activeStokRow.id}`;
    
    if(isNaN(inputVal) || inputVal <= 0) { 
        delete alokasiMemoryState[keyMemory]; 
    } else if(inputVal > maxQty) { 
        return alert(`GAGAL! Stok fisik di rak Area ini hanya tersedia ${maxQty} Dus.`); 
    } else { 
        alokasiMemoryState[keyMemory] = { qty: inputVal, estimasi: activeEstimasiRow, stok: activeStokRow }; 
    }
    
    document.getElementById('modal-input-qty').classList.add('hidden'); 
    renderTabelPopupStokInternal();
}

function hapusDariPickingList(keyMemory) { 
    if(confirm("Hapus item ini dari Picking List?")) { 
        delete alokasiMemoryState[keyMemory]; 
        initRenderPickingList(); 
        renderTabelUtamaEstimasi(); 
    } 
}

async function muatDropdownDus() {
    const elDus = document.getElementById('inp-prod-dus');
    try {
        const { data, error } = await db.from('master_2').select('dus');
        if (error) throw error;
        // Filter unik dan buang null/kosong
        let dusUnik = [...new Set(data.map(d => d.dus).filter(d => d && d.trim() !== ''))].sort();
        elDus.innerHTML = `<option value="-">-- PILIH DUS --</option>` + dusUnik.map(d => `<option value="${d}">${d}</option>`).join('');
    } catch (e) {
        elDus.innerHTML = `<option value="-">GAGAL LOAD DUS</option>`;
    }
}

function bukaModalInputProduksi() {
    ['inp-prod-dus', 'inp-prod-shading', 'inp-prod-qty', 'inp-prod-ket'].forEach(id => document.getElementById(id).value = '');
    if (document.getElementById('inp-prod-dus').options.length <= 1) muatDropdownDus();
    document.getElementById('modal-input-produksi').classList.remove('hidden');
}

function simpanInputProduksi() {
    const dus = document.getElementById('inp-prod-dus').value;
    const shading = document.getElementById('inp-prod-shading').value.trim() || '-';
    const qty = parseInt(document.getElementById('inp-prod-qty').value);
    const ket = document.getElementById('inp-prod-ket').value.trim() || '-';
    
    if(dus === '-') return alert("Pilih Dus terlebih dahulu!");
    if(isNaN(qty) || qty <= 0) return alert("QTY Diambil tidak valid!");
    
    const mockId = 'PROD_' + new Date().getTime();
    const newStok = { id: mockId, dus: dus, shading: shading, po_aktual: 'PRODUKSI', qty: qty, area: 'PRODUKSI', keterangan: ket };
    
    dbStokAktualRaw.unshift(newStok); 
    document.getElementById('modal-input-produksi').classList.add('hidden');
    renderTabelPopupStokInternal();
}
