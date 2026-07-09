let rawData = []; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
let selectAllState = 0; 
let userColOrder = []; 

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

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

function loadUserPreferences() {
    const savedOrder = localStorage.getItem(`col_order_req_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } } 
    else { userColOrder = []; }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) {
            let found = false;
            Array.from(sel.options).forEach(opt => { if(opt.value == rowsPerPage) { opt.selected = true; found = true; } });
            if(!found) {
                sel.value = 'CUSTOM';
                const inp = document.getElementById('input-custom-rows');
                if(inp) { inp.classList.remove('hidden'); inp.value = rowsPerPage; }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'req_konversi', title: 'REQUEST KONVERSI', url: 'req_konversi.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) { closeFilterMenu(); }
        }
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) { actionMenu.classList.add('hidden'); }
        }
    });

    loadUserPreferences(); 
    setTimeout(muatData, 200);
});

function toggleActionMenu(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
}

function tutupSemuaPopups() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
}

async function muatData() {
    const tbody = document.getElementById('tbody-req');
    tbody.innerHTML = `<tr><td colspan="11" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menarik Data...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('request_konversi').select('*').order('created_at', { ascending: false });
        if(error) throw error;
        rawData = data || [];
        renderTabel();
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="11" class="p-10 text-center text-red-500 font-medium">Gagal: ${e.message}</td></tr>`; 
    }
}

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-req');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].getAttribute('data-search') || a.cells[colIndex].innerText.trim(); 
        let valB = b.cells[colIndex].getAttribute('data-search') || b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) { return isAsc ? numA - numB : numB - numA; } 
        else { return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    applyPagination();
}

function thSort(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(${idx}, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
}

function renderTabel() {
    const thead = document.getElementById('thead-req');
    const tbody = document.getElementById('tbody-req');
    sortState = {}; selectAllState = 0;

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
            </th>
            ${thSort(1, 'Kode Konversi', 'col-kode')}
            ${thSort(2, 'Tgl Request', 'col-tgl')}
            ${thSort(3, 'Aktifitas', 'col-aktifitas')}
            ${thSort(4, 'Detail Item Asal', 'col-asal')}
            ${thSort(5, 'Request Konversi', 'col-req')}
            ${thSort(6, 'Qty Req', 'col-qty_req')}
            ${thSort(7, 'Qty Hasil', 'col-qty_hasil')}
            ${thSort(8, 'Qty Proses', 'col-qty_proses')}
            ${thSort(9, 'Progres', 'col-progres')}
        </tr>`;
    
    if(rawData.length === 0) { tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center font-medium text-slate-400">Tidak ada data request.</td></tr>`; return; }

    tbody.innerHTML = rawData.map((r) => {
        const tgl = formatWIB(r.created_at);
        
        // Detail Item Asal (STBJ Style)
        const detailAsal = `
            <div class="text-[12px] font-bold text-slate-600 leading-snug">
                Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | 
                <span class="text-slate-800">${r.nama_item || '-'}</span> | 
                <span class="text-slate-800">${r.panjang || '-'}</span> | 
                <span class="text-slate-800">${r.grade || '-'}</span> | 
                <span class="text-slate-800">${r.dus || '-'}</span> | 
                <span class="text-blue-600">${r.shading || '-'}</span>
            </div>
            <div class="text-[12px] font-bold text-slate-600 mt-1">Customer Aktual: <span class="text-orange-600">${r['customer aktual'] || '-'}</span></div>
            <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
            <div class="text-[12px] font-bold text-slate-600">Area: <span class="text-emerald-600">${r.area || '-'}</span></div>
        `;
        const searchAsal = `${r.nama_item} ${r.panjang} ${r.grade} ${r.dus} ${r.shading} ${r['customer aktual']} ${r.area}`;
        
        // Request Konversi (Hanya tampilkan yang berubah/target)
        let reqArr = [];
        if(r.nama_item_req && r.nama_item_req !== r.nama_item) reqArr.push(`Nama: <span class="text-blue-600">${r.nama_item_req}</span>`);
        if(r.panjang_req && r.panjang_req !== r.panjang) reqArr.push(`Panjang: <span class="text-slate-800">${r.panjang_req}</span>`);
        if(r.grade_req && r.grade_req !== r.grade) reqArr.push(`Grade: <span class="text-slate-800">${r.grade_req}</span>`);
        if(r.dus_req && r.dus_req !== r.dus) reqArr.push(`Dus: <span class="text-slate-800">${r.dus_req}</span>`);
        if(r.shading_req && r.shading_req !== r.shading) reqArr.push(`Shading: <span class="text-blue-600">${r.shading_req}</span>`);
        
        const detailReq = reqArr.length > 0 ? `<div class="text-[12px] font-bold text-slate-600">${reqArr.join(' | ')}</div>` : '<span class="text-slate-400 italic text-xs">Tidak ada perubahan spesifikasi</span>';
        const searchReq = `${r.nama_item_req} ${r.panjang_req} ${r.grade_req} ${r.dus_req} ${r.shading_req}`;

        // Badge Progres & Tombol Proses
        let prog = (r.progres_konversi || 'PENDING').toUpperCase();
        let btnProses = '';
        if(prog === 'PENDING' || prog === 'PROSES') {
            btnProses = `<button onclick="prosesRequest(${r.id})" class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-sm text-[10px] uppercase transition active:scale-95">Proses Request</button>`;
        } else {
            btnProses = `<span class="block w-full px-3 py-2 bg-emerald-100 text-emerald-700 font-bold rounded border border-emerald-200 text-[10px] uppercase text-center">Selesai</span>`;
        }

        return `
            <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-black text-slate-800 text-center tracking-wider col-kode" data-search="${r.kode_konversi || '-'}">${r.kode_konversi || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-600 text-center col-tgl" data-search="${tgl}">${tgl}</td>
                <td class="px-4 py-3 font-bold text-rose-600 text-center uppercase col-aktifitas" data-search="${r.aktifitas_konversi || '-'}">${r.aktifitas_konversi || '-'}</td>
                <td class="px-4 py-3 text-left col-asal" data-search="${searchAsal}">${detailAsal}</td>
                <td class="px-4 py-3 text-left col-req" data-search="${searchReq}">${detailReq}</td>
                <td class="px-4 py-3 font-black text-slate-700 text-center col-qty_req" data-search="${r.qty_req || 0}">${r.qty_req || 0}</td>
                <td class="px-4 py-3 font-black text-indigo-600 text-center col-qty_hasil" data-search="${r.qty_hasil || 0}">${r.qty_hasil || 0}</td>
                <td class="px-4 py-3 font-black text-emerald-600 text-center col-qty_proses" data-search="${r.qty_proses || 0}">${r.qty_proses || 0}</td>
                <td class="px-4 py-3 text-center col-progres" data-search="${prog}">
                    ${btnProses}
                </td>
            </tr>`;
    }).join('');

    applyColumnOrder(); 
    lucide.createIcons(); 
    updateSelectAllUI();
    saringTabelExcel(); 
    initResizableColumns(); 
}

function prosesRequest(id) {
    alert("Fungsi Proses Request untuk ID " + id + " akan diimplementasikan nanti.");
}

// ==========================================
// FUNGSI STANDAR (PAGINASI, FILTER, EXCEL)
// ==========================================
function highlightRow(checkbox, skipStateReset = false) {
    const tr = checkbox.closest('tr');
    if (checkbox.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
    
    if(!skipStateReset && !checkbox.checked && selectAllState !== 0) { selectAllState = 0; updateSelectAllUI(); }
    if(!skipStateReset) updateSelectedCount();
}

function changeRowsPerPage(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') { rowsPerPage = 999999; if(customInput) customInput.classList.add('hidden'); } 
    else if (val === 'CUSTOM') {
        if(customInput) { customInput.classList.remove('hidden'); customInput.focus(); rowsPerPage = parseInt(customInput.value) || rowsPerPage; }
    } else { rowsPerPage = parseInt(val); if(customInput) customInput.classList.add('hidden'); }
    localStorage.setItem('wms_rows_per_page', rowsPerPage); currentPage = 1; applyPagination();
}

function setCustomRowsPerPage(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) { rowsPerPage = parsed; localStorage.setItem('wms_rows_per_page', rowsPerPage); currentPage = 1; applyPagination(); }
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-req tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });

    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    let sumQty = 0;
    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1'); else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty_req');
        if(qtyCell) { sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; } 

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (selectAllState === 1) { selectAllState = 0; updateSelectAllUI(); }
    applySelection(); updateSelectedCount();
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { const totalVisible = document.querySelectorAll('#tbody-req tr.r-row:not(.filtered-out)').length; if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } }
function updateSelectedCount() { const count = document.querySelectorAll('.cb-main:checked').length; if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count; }

function cycleSelectAll() { selectAllState = (selectAllState + 1) % 3; updateSelectAllUI(); applySelection(); }
function updateSelectAllUI() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto'; } 
    else if (selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto'; } 
    else if (selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto'; }
    lucide.createIcons();
}
function applySelection() {
    const allRows = Array.from(document.querySelectorAll('#tbody-req tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) { allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } }); } 
    else if (selectAllState === 1) {
        allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } });
        visibleRows.forEach((row, index) => { if(index >= startIndex && index < endIndex) { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; highlightRow(cb, true); } } });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; highlightRow(cb, true); } });
    }
    updateSelectedCount();
}

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-req tr.r-row').forEach(row => {
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
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    sortedValues.forEach(val => {
        let isChecked = true; if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}"><input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> <span class="truncate text-slate-600">${val}</span></label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; updateSelectAllState(); document.getElementById('filter-search-input').value = '';
    const menu = document.getElementById('excel-filter-menu'); menu.classList.remove('hidden');
    const btnRect = event.currentTarget.getBoundingClientRect(); const menuWidth = 256; 
    let topPos = btnRect.bottom + 4; let leftPos = btnRect.left; 
    if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
    if (leftPos < 10) { leftPos = 10; }
    menu.style.position = 'fixed'; menu.style.top = `${topPos}px`; menu.style.left = `${leftPos}px`;
    document.getElementById('filter-search-input').focus();
}

function toggleAllFilterValues(checked) { document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; }); updateSelectAllState(); }
function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
}
document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) updateSelectAllState(); });
function searchFilterList(val) {
    const query = val.toLowerCase().split(' ').filter(x => x); 
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        let matches = query.every(term => text.includes(term)); label.style.display = matches ? '' : 'none';
    });
}
function closeFilterMenu() { document.getElementById('excel-filter-menu').classList.add('hidden'); }
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); activeFilters[currentFilterCol] = selectedVals; }
    closeFilterMenu(); saringTabelExcel(); 
}
function saringTabelExcel() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    selectAllState = 0; updateSelectAllUI(); currentPage = 1; applyPagination(); updateFilterIcons();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
}

function salinData() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin!");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
            if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(val.replace(/\n/g, ' ')); }
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => { alert("Berhasil menyalin!"); }).catch(err => { alert("Browser menolak akses Clipboard."); });
}

function downloadXLS() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat.");
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
    if(ws_data.length <= 1) return alert("Pilih minimal 1 baris data untuk di-export!");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Request_Konversi"); XLSX.writeFile(wb, `Request_Konversi.xlsx`);
}

function toggleSidebarKolom() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
}

function renderDragList() {
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
        e.preventDefault(); const afterElement = getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function simpanUrutanKolom() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    userColOrder = newOrder; localStorage.setItem(`col_order_req_${currentUser.username}`, JSON.stringify(newOrder));
    alert("Urutan kolom berhasil disimpan!"); toggleSidebarKolom(); renderTabel(); 
}

function resetUrutanKolom() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    userColOrder = []; localStorage.removeItem(`col_order_req_${currentUser.username}`);
    alert("Urutan dikembalikan ke default."); toggleSidebarKolom(); renderTabel();
}

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb')); const btnCell = cells.find(c => c.classList.contains('col-btn'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; if (cbCell) row.appendChild(cbCell); if (btnCell) row.appendChild(btnCell); 
        userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && colClass !== 'col-btn' && !userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
}

function initResizableColumns() {
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
}
