let currentTab = 'pilih';
let dbEstimasiRaw = [];
let dbStokAktualRaw = [];
let alokasiMemoryState = {}; 
let activeEstimasiRow = null; 
let activeStokRow = null; 

// State Management untuk Sort & Paginasi
let sortState = {};
let sortStatePicking = {};
let currentPagePopup = 1; const rowsPerPagePopup = 5;
let currentPagePicking = 1; const rowsPerPagePicking = 10;
let dbPickingListAggregated = [];

// State Management Filter Excel Picking List
let activeFilters = {}; 
let currentFilterCol = ''; 

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'picking_list', title: 'PICKING LIST', url: 'picking_list.html' });
    
    // Listener untuk menutup pop-up Excel Filter jika klik di luar
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
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
    try {
        const { data, error } = await db.from('estimasi_pengiriman').select('*').order('tanggal_estimasi', { ascending: false });
        if(error) throw error; dbEstimasiRaw = data || [];
        
        const tglUnik = [...new Set(dbEstimasiRaw.map(x => x.tanggal_estimasi))].sort().reverse();
        const poUnik = [...new Set(dbEstimasiRaw.map(x => (x.po_estimasi || '').trim()))].sort();
        
        isiDropdownBiasa('filter-est-tanggal', tglUnik, '-- SEMUA TANGGAL --');
        isiDropdownBiasa('filter-est-po', poUnik, '-- SEMUA PO --');
        renderTabelUtamaEstimasi();
    } catch (e) { document.getElementById('tbody-utama-estimasi').innerHTML = `<tr><td colspan="10" class="p-10 text-red-500 font-bold">Gagal: ${e.message}</td></tr>`; }
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
    const filterTgl = document.getElementById('filter-est-tanggal').value; const filterPo = document.getElementById('filter-est-po').value;
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

function renderTabelUtamaEstimasi() {
    const tbody = document.getElementById('tbody-utama-estimasi');
    const filterTgl = document.getElementById('filter-est-tanggal').value; const filterPo = document.getElementById('filter-est-po').value;

    const filteredData = dbEstimasiRaw.filter(r => {
        const matchTgl = (filterTgl === 'ALL' || !filterTgl) ? true : r.tanggal_estimasi === filterTgl;
        const matchPo = (filterPo === 'ALL' || !filterPo) ? true : r.po_estimasi === filterPo;
        return matchTgl && matchPo;
    });

    if(filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="p-10 text-slate-400 font-bold"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Tidak ada kuota pengiriman estimasi.</td></tr>';
        lucide.createIcons(); return;
    }

    tbody.innerHTML = filteredData.map((r, i) => {
        let totalPicked = 0; for (let key in alokasiMemoryState) { if(key.startsWith(r.id + '_')) { totalPicked += alokasiMemoryState[key].qty; } }
        const stringRow = JSON.stringify(r).replace(/"/g, '&quot;');
        return `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-sm text-center">
                <td class="p-3 font-bold text-slate-400">${i+1}</td>
                <td class="p-2 border-r border-slate-200 flex justify-center">
                    <button onclick="bukaPopupStokGudang('${stringRow}')" class="p-1.5 bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg shadow-sm transition active:scale-95 mx-auto flex">
                        <i data-lucide="box" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-3 font-semibold text-slate-600">${formatTglIndo(r.tanggal_estimasi)}</td>
                <td class="p-3 font-black text-slate-800 border-r border-slate-200">${r.po_estimasi}</td>
                <td class="p-3 font-black text-blue-700">${r.nama_item}</td>
                <td class="p-3 font-bold text-slate-600">${r.panjang}</td>
                <td class="p-3 font-bold text-slate-800">${r.grade}</td>
                <td class="p-3 font-black text-slate-700 bg-slate-50 border-l border-slate-200">${r.jumlah_po}</td>
                <td class="p-3 font-black ${totalPicked > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'} border-l border-slate-200">${totalPicked}</td>
                <td class="p-3 font-medium text-slate-500 pl-4 border-l border-slate-200 whitespace-normal max-w-[150px] leading-tight">${r.note || '-'}</td>
            </tr>`;
    }).join('');
    lucide.createIcons();
}

// ================= POPUP STOK GUDANG =================
async function bukaPopupStokGudang(encodedRowStr) {
    activeEstimasiRow = JSON.parse(encodedRowStr);
    ['fp-dus', 'fp-shading', 'fp-poaktual', 'fp-area', 'fp-ket'].forEach(id => document.getElementById(id).value = '');
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

        if(error) throw error; dbStokAktualRaw = data || [];
        saringTabelPopupInternal();
    } catch (e) { tbody.innerHTML = `<tr><td colspan="9" class="p-5 text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`; }
}

function tutupModalStok() { document.getElementById('modal-gudang-stok').classList.add('hidden'); renderTabelUtamaEstimasi(); }

function saringTabelPopupInternal() { currentPagePopup = 1; renderTabelPopupStokInternal(); }
function resetFilterPopupInternal() { ['fp-dus', 'fp-shading', 'fp-poaktual', 'fp-area', 'fp-ket'].forEach(id => document.getElementById(id).value = ''); saringTabelPopupInternal(); }
function changePagePopup(dir) { currentPagePopup += dir; renderTabelPopupStokInternal(); }

function renderTabelPopupStokInternal() {
    const tbody = document.getElementById('tbody-popup-stok');
    
    const fDus = (document.getElementById('fp-dus').value || '').toLowerCase();
    const fShading = (document.getElementById('fp-shading').value || '').toLowerCase();
    const fPoAktual = (document.getElementById('fp-poaktual').value || '').toLowerCase();
    const fArea = (document.getElementById('fp-area').value || '').toLowerCase();
    const fKet = (document.getElementById('fp-ket').value || '').toLowerCase();

    let filteredStok = dbStokAktualRaw.filter(r => {
        return (!fDus || (r.dus || '').toLowerCase().includes(fDus)) &&
               (!fShading || (r.shading || '').toLowerCase().includes(fShading)) &&
               (!fPoAktual || (r.po_aktual || '').toLowerCase().includes(fPoAktual)) &&
               (!fArea || (r.area || '').toLowerCase().includes(fArea)) &&
               (!fKet || (r.keterangan || '').toLowerCase().includes(fKet));
    });

    if(sortState.kolom) {
        let isAsc = sortState.isAsc;
        filteredStok.sort((a, b) => {
            let valA = a[sortState.kolom] || ''; let valB = b[sortState.kolom] || '';
            let numA = parseFloat(valA); let numB = parseFloat(valB);
            if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
            return isAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        });
    }

    let grandTotalPicked = 0;
    filteredStok.forEach(r => { const keyMemory = `${activeEstimasiRow.id}_${r.id}`; grandTotalPicked += alokasiMemoryState[keyMemory]?.qty || 0; });
    document.getElementById('pop-lbl-qty-picked').innerText = grandTotalPicked;

    const totalPages = Math.ceil(filteredStok.length / rowsPerPagePopup) || 1;
    if(currentPagePopup > totalPages) currentPagePopup = totalPages;
    if(currentPagePopup < 1) currentPagePopup = 1;
    document.getElementById('popup-page-info').innerText = `Hal ${currentPagePopup} dari ${totalPages}`;
    
    const startIdx = (currentPagePopup - 1) * rowsPerPagePopup;
    const paginatedData = filteredStok.slice(startIdx, startIdx + rowsPerPagePopup);

    if(paginatedData.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-slate-400 font-bold">Stok fisik kosong.</td></tr>'; return; }

    tbody.innerHTML = paginatedData.map((r, i) => {
        const keyMemory = `${activeEstimasiRow.id}_${r.id}`; 
        const currentAllocatedQty = alokasiMemoryState[keyMemory]?.qty || 0;
        let textInfoAlokasi = currentAllocatedQty > 0 ? `<div class="p-1 px-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-black rounded text-[10px] mx-auto">QTY: ${currentAllocatedQty}</div>` : '-';
        const stringStokRow = JSON.stringify(r).replace(/"/g, '&quot;');
        
        return `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs text-row-popup">
                <td class="p-2"><button onclick="bukaModalMintaQty('${stringStokRow}')" class="px-3 py-1.5 ${currentAllocatedQty > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black rounded-lg text-[10px] uppercase shadow-sm transition active:scale-95">${currentAllocatedQty > 0 ? 'Ubah' : 'Pilih'}</button></td>
                <td class="p-3 font-bold text-slate-400">${startIdx + i + 1}</td>
                <td class="p-2 border-r border-slate-200">${textInfoAlokasi}</td>
                <td class="p-3 font-black text-slate-700 border-r border-slate-200">${r.dus || '-'}</td>
                <td class="p-3 font-bold text-slate-700 border-r border-slate-200">${r.shading || '-'}</td>
                <td class="p-3 font-black text-slate-800 border-r border-slate-200">${r.po_aktual || '-'}</td>
                <td class="p-3 font-black text-emerald-700 bg-emerald-50/50 border-r border-slate-200">${r.qty}</td>
                <td class="p-3 font-black text-amber-600 bg-amber-50/30 border-r border-slate-200">${r.area || '-'}</td>
                <td class="p-3 text-center font-medium text-slate-500 max-w-[150px] whitespace-normal leading-tight">${r.keterangan || '-'}</td>
            </tr>`;
    }).join('');
    lucide.createIcons();
}

function sortPopupTable(kolom, el) {
    let isAsc = (sortState.kolom === kolom) ? !sortState.isAsc : true;
    sortState = { kolom: kolom, isAsc: isAsc };
    document.querySelectorAll('#table-popup-stok .sort-icon').forEach(icon => icon.setAttribute('data-lucide', 'arrow-up-down'));
    if(el) el.querySelector('.sort-icon').setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a');
    renderTabelPopupStokInternal();
}

function bukaModalMintaQty(encodedStokRowStr) {
    activeStokRow = JSON.parse(encodedStokRowStr); document.getElementById('lbl-max-qty').innerText = activeStokRow.qty;
    const keyMemory = `${activeEstimasiRow.id}_${activeStokRow.id}`; document.getElementById('input-qty-ambil').value = alokasiMemoryState[keyMemory]?.qty || '';
    document.getElementById('modal-input-qty').classList.remove('hidden'); document.getElementById('input-qty-ambil').focus();
}

function simpanKuotaAmbilLokal() {
    const inputVal = parseInt(document.getElementById('input-qty-ambil').value); const maxQty = parseInt(activeStokRow.qty);
    const keyMemory = `${activeEstimasiRow.id}_${activeStokRow.id}`;
    if(isNaN(inputVal) || inputVal <= 0) { delete alokasiMemoryState[keyMemory]; } 
    else if(inputVal > maxQty) { return alert(`GAGAL! Stok fisik di rak Area ini hanya tersedia ${maxQty} Dus.`); } 
    else { alokasiMemoryState[keyMemory] = { qty: inputVal, estimasi: activeEstimasiRow, stok: activeStokRow }; }
    document.getElementById('modal-input-qty').classList.add('hidden'); renderTabelPopupStokInternal();
}

// ================= INPUT PRODUKSI MANUAL =================
function bukaModalInputProduksi() {
    ['inp-prod-dus', 'inp-prod-shading', 'inp-prod-qty'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modal-input-produksi').classList.remove('hidden');
}

function simpanInputProduksi() {
    const dus = document.getElementById('inp-prod-dus').value.trim() || '-';
    const shading = document.getElementById('inp-prod-shading').value.trim() || '-';
    const qty = parseInt(document.getElementById('inp-prod-qty').value);
    
    if(isNaN(qty) || qty <= 0) return alert("QTY tidak valid!");
    
    const mockId = 'PROD_' + new Date().getTime();
    const newStok = { id: mockId, dus: dus, shading: shading, po_aktual: 'PRODUKSI', qty: qty, area: 'PRODUKSI', keterangan: 'Dari Input Manual' };
    dbStokAktualRaw.unshift(newStok); 
    document.getElementById('modal-input-produksi').classList.add('hidden');
    renderTabelPopupStokInternal();
}

// ================= TAB PICKING LIST (DOM MANIPULATION & EXCEL FILTER) =================
function initRenderPickingList() {
    dbPickingListAggregated = [];
    for(let key in alokasiMemoryState) { dbPickingListAggregated.push({ keyMemory: key, ...alokasiMemoryState[key] }); }
    activeFilters = {}; updateFilterIcons(); // Reset filter saat tab dibuka
    renderTabelPickingList();
}

function renderTabelPickingList() {
    const tbody = document.getElementById('tbody-picking-list');
    if (dbPickingListAggregated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-slate-400 font-bold">Belum ada item yang di-picking.</td></tr>'; 
        return;
    }

    // Merender SATU KALI seluruh baris ke DOM agar filter Excel bisa membacanya via `data-search`
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
            <td class="p-2 border-l border-slate-200"><input type="text" class="p-1.5 border border-slate-300 rounded text-xs w-full text-center outline-none focus:border-blue-500" placeholder="Nama PIC"></td>
            <td class="p-3 border-l border-slate-200 max-w-[120px] whitespace-normal leading-tight">${d.stok.keterangan || '-'}</td>
            <td class="p-2 border-l border-slate-200 bg-rose-50">
                <button onclick="hapusDariPickingList('${d.keyMemory}')" class="p-1.5 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg shadow-sm transition active:scale-95"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>`;
    }).join('');
    
    lucide.createIcons();
    // Jalankan Excel Filter yang di dalamnya memanggil fungsi Pagination
    saringTabelExcelPicking();
}

function saringTabelExcelPicking() {
    document.querySelectorAll('.r-row-pick').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; 
            const cell = row.querySelector('.' + colClass);
            if (cell) { 
                let cellVal = cell.getAttribute('data-search') || cell.innerText.trim();
                if (!allowed.includes(cellVal)) { show = false; break; } 
            }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); }
    });
    currentPagePicking = 1; 
    applyPaginationPicking();
}

function applyPaginationPicking() {
    const allRows = Array.from(document.querySelectorAll('#tbody-picking-list tr.r-row-pick'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; 
    const totalPages = Math.ceil(totalFiltered / rowsPerPagePicking) || 1;
    
    if(currentPagePicking > totalPages) currentPagePicking = totalPages; 
    if(currentPagePicking < 1) currentPagePicking = 1;

    const startIndex = (currentPagePicking - 1) * rowsPerPagePicking; 
    const endIndex = startIndex + rowsPerPagePicking;

    visibleRows.forEach((row, index) => {
        if(index >= startIndex && index < endIndex) { 
            row.style.display = ''; 
            row.querySelector('.col-no').innerText = index + 1; // Update No secara Real-time
        } 
        else { row.style.display = 'none'; }
    });

    document.getElementById('picking-page-info').innerText = `Hal ${currentPagePicking} dari ${totalPages}`;
}

function changePagePicking(dir) { 
    const totalVisible = document.querySelectorAll('#tbody-picking-list tr.r-row-pick:not(.filtered-out)').length;
    const totalPages = Math.ceil(totalVisible / rowsPerPagePicking) || 1;
    
    if(dir === 1 && currentPagePicking < totalPages) { currentPagePicking++; applyPaginationPicking(); }
    if(dir === -1 && currentPagePicking > 1) { currentPagePicking--; applyPaginationPicking(); }
}

function sortTablePicking(kolomMapping, headerEl) {
    const tbody = document.getElementById('tbody-picking-list');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row-pick'));
    
    const colClassMap = { 'tgl_estimasi': 'col-tgl_est', 'po_estimasi': 'col-po_est', 'nama_item': 'col-nama_item', 'grade': 'col-grade', 'dus': 'col-dus', 'shading': 'col-shading', 'area': 'col-area' };
    const colClassTarget = colClassMap[kolomMapping];

    let isAsc = sortStatePicking.kolom === kolomMapping ? !sortStatePicking.isAsc : true;
    sortStatePicking = { kolom: kolomMapping, isAsc: isAsc };
    
    rows.sort((a, b) => {
        let cellA = a.querySelector('.' + colClassTarget); let cellB = b.querySelector('.' + colClassTarget);
        let valA = cellA ? (cellA.getAttribute('data-search') || cellA.innerText.trim()) : ''; 
        let valB = cellB ? (cellB.getAttribute('data-search') || cellB.innerText.trim()) : '';
        
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    
    rows.forEach(row => tbody.appendChild(row));
    
    document.querySelectorAll('.sort-icon-pick').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    if(headerEl) { 
        const icon = headerEl.querySelector('.sort-icon-pick'); 
        if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    }
    applyPaginationPicking(); 
}

function hapusDariPickingList(keyMemory) { 
    if(confirm("Hapus item ini dari Picking List?")) { 
        delete alokasiMemoryState[keyMemory]; initRenderPickingList(); renderTabelUtamaEstimasi(); 
    } 
}

// ================= EXCEL FILTER LOGIC UNTUK PICKING LIST =================
function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `FILTER: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-picking-list tr.r-row-pick').forEach(row => {
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
        let isChecked = !activeFilters[colClass] || activeFilters[colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate font-bold text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const rect = event.currentTarget.getBoundingClientRect(); const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        let top = rect.bottom + window.scrollY + 5; let left = rect.left + window.scrollX;
        if (left + 256 > window.innerWidth) { left = window.innerWidth - 266; }
        menu.style.top = top + 'px'; menu.style.left = left + 'px';
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
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcelPicking(); updateFilterIcons(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcelPicking(); updateFilterIcons();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('opacity-40', 'text-white'); });
    for (let colClass in activeFilters) {
        const btn = document.querySelector(`button[onclick*="'${colClass}'"]`);
        if (btn) { const icon = btn.querySelector('.filter-icon'); if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
}
