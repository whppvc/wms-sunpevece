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

function tutupModalArea() { document.getElementById('modal-ganti-area').classList.add('hidden'); }
function tutupModalSTBJ() { document.getElementById('modal-stbj-langsir').classList.add('hidden'); }
function tutupModalHold() { document.getElementById('modal-hold-langsir').classList.add('hidden'); }
function tutupSemuaPopup() { tutupModalArea(); tutupModalSTBJ(); tutupModalHold(); }

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    
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
        await ambilSemuaData();
        gantiModeRiwayat('qr');
    }, 200);
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

function sortTable(colIndex, headerEl) {
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
    applyPagination();
}

const thSort = (idx, label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center">
            <div class="flex items-center justify-center w-full">${label}</div>
        </th>`;
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
};

async function ambilSemuaData() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    try {
        // Ambil data dari tabel log terpusat hasil_stbj_langsir
        const { data, error } = await db.from('hasil_stbj_langsir')
            .select('*')
            .in('status', ['IN GUDANG', 'HOLD LANGSIR'])
            .order('waktu_langsir', { ascending: false });

        if (error) throw error;

        // Pisahkan data log langsir (IN GUDANG) dan hold langsir (HOLD LANGSIR)
        logLangsirRaw = (data || []).filter(r => r.status === 'IN GUDANG');
        holdLangsirRaw = (data || []).filter(r => r.status === 'HOLD LANGSIR');

        renderTabelRiwayat();
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center text-red-500 font-medium">Error: ${e.message}</td></tr>`; 
    }
}

function openColumnFilter(event, colClass, colName) {
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
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcel(); 
}
function saringTabelExcel() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    selectAllState = 0;
    updateSelectAllUI();
    currentPage = 1; applyPagination(); updateFilterIcons();
}
function updateFilterIcons() {
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
}

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
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
    } else if (selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.cb-row');
                if(cb) { cb.checked = true; highlightRow(cb, true); }
            }
        });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
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
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        rowsPerPage = 999999; 
        customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        customInput.classList.remove('hidden');
        customInput.focus();
        let customVal = parseInt(customInput.value);
        rowsPerPage = (customVal > 0) ? customVal : rowsPerPage;
    } else {
        rowsPerPage = parseInt(val);
        customInput.classList.add('hidden');
    }
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    applyPagination();
}

function setCustomRowsPerPage(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        rowsPerPage = parsed;
        localStorage.setItem('wms_rows_per_page', rowsPerPage);
        currentPage = 1;
        applyPagination();
    }
}

function applyPagination() {
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
        updateSelectAllUI();
    }
    
    applySelection();
    updateSelectedCount();
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-riwayat tr.r-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}
function updateSelectedCount() {
    const count = document.querySelectorAll('.cb-row:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
}

function renderTabelRiwayat() {
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
                        <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                    </th>
                    ${thSort(1, 'Waktu Langsir', 'col-waktu')}
                    ${thSort(2, 'Troli', 'col-troli')}
                    ${thSort(3, 'Area', 'col-area')}
                    ${thSort(4, 'QRCode', 'col-qr')}
                    ${thSort(5, 'Tgl Produksi', 'col-tgl')}
                    ${thSort(6, 'Mesin', 'col-mesin')}
                    ${thSort(7, 'Shift', 'col-shift')}
                    ${thSort(8, 'Jenis Item', 'col-jenis')}
                    ${thSort(9, 'Nama Item', 'col-nama')}
                    ${thSort(10, 'Panjang', 'col-pjg')}
                    ${thSort(11, 'Grade', 'col-grade')}
                    ${thSort(12, 'Dus', 'col-dus')}
                    ${thSort(13, 'Shading', 'col-shading')}
                    ${thSort(14, 'Customer Bawaan', 'col-customer')}
                    ${thSort(15, 'Keterangan', 'col-ket')}
                    ${thSort(16, 'PIC', 'col-pic')}
                </tr>`;
            
            if(!dataset || dataset.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="17" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; applyPagination(); return; }
            
            let h = '';
            dataset.forEach((r, i) => {
                // Gunakan waktu_langsir sebagai acuan utama, fallback ke created_at
                const tgl = formatWIB(r.waktu_langsir || r.created_at);
                
                h += `
                    <tr class="${rowClassBase}">
                        <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
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
                        <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        } 
        else if(modeRiwayat === 'agregasi') {
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb text-center sticky-col">
                        <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                    </th>
                    ${thSort(1, 'Area', 'col-area')}
                    ${thSort(2, 'Jenis Item', 'col-jenis')}
                    ${thSort(3, 'Nama Item', 'col-nama')}
                    ${thSort(4, 'Panjang', 'col-pjg')}
                    ${thSort(5, 'Grade', 'col-grade')}
                    ${thSort(6, 'Dus', 'col-dus')}
                    ${thSort(7, 'Shading', 'col-shading')}
                    ${thSort(8, 'Customer Bawaan', 'col-customer')}
                    ${thSort(9, 'PIC', 'col-pic')}
                    ${thSort(10, 'QTY TOTAL (DUS)', 'col-qty')}
                </tr>`;

            let groups = {};
            logLangsirRaw.forEach(r => {
                let key = `${r.posisi}_${r.jenis_item}_${r.nama_item}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.customer}_${r.pic_input}`;
                if(!groups[key]) groups[key] = { area: r.posisi, jenis: r.jenis_item, nama: r.nama_item, pjg: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, customer: r.customer, pic: r.pic_input, qty: 0 };
                groups[key].qty++;
            });

            let arr = Object.values(groups);
            if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="11" class="p-8 text-center font-medium text-slate-400">Kosong.</td></tr>`; applyPagination(); return; }

            let h = '';
            arr.forEach((r) => {
                h += `
                    <tr class="${rowClassBase}">
                        <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this)" value="agg" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
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
        lucide.createIcons(); 
        updateSelectAllUI();
        saringTabelExcel();
    } catch(err) { console.error("Gagal Render Tabel:", err); }
}

// ========================================================
// FUNGSI AKSI DATABASE (CANCEL, GANTI AREA, SALIN, EXCEL)
// ========================================================
async function cancelLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); if(checkedBoxes.length === 0) return alert("Pilih minimal 1 baris!");
    if(!confirm(`Batal Langsir untuk ${checkedBoxes.length} kardus ini?\nData akan dihapus dari gudang (stok_global & stok_aktual) dan statusnya di hasil_stbj_langsir dikembalikan ke 'HOLD LANGSIR'.`)) return;
    
    const btn = document.getElementById('btn-cancel-langsir'); 
    const ori = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = 'Proses...'; btn.disabled = true; }

    let arrFisik = []; 
    let mapDeduct = {};
    const wibNow = getWIBTimestamp();
    
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
        // 1. Hapus dari stok_qr dan stok_global
        const { error: errStok } = await db.from('stok_qr').delete().in('qrcode', arrFisik);
        if(errStok) throw errStok;

        const { error: errGlobal } = await db.from('stok_global').delete().in('qrcode', arrFisik);
        if(errGlobal) throw errGlobal;

        // 2. Update status di hasil_stbj_langsir menjadi HOLD LANGSIR
        const { error: errHasil } = await db.from('hasil_stbj_langsir')
            .update({ status: 'HOLD LANGSIR', keterangan: 'Cancel Langsir', waktu_langsir: wibNow })
            .in('qrcode', arrFisik);
        if(errHasil) throw errHasil;

        // 3. Kurangi saldo di stok_aktual secara inkremental
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
        
        await ambilSemuaData();
        alert(`SUKSES!\n\n${arrFisik.length} item berhasil di-cancel, dihapus dari kartu stok, dan statusnya dikembalikan ke 'HOLD LANGSIR'.`);
    } catch (e) { 
        alert("Gagal Cancel Langsir: " + e.message); 
    } finally { 
        if(btn) { btn.innerHTML = ori; btn.disabled = false; } 
        lucide.createIcons(); 
    }
}

async function hapusBarisHold() {
    const checked = document.querySelectorAll('.cb-row:checked'); if(checked.length === 0) return alert("Pilih baris!");
    if(!confirm("Hapus permanen data hold ini dari database?")) return;
    try {
        const { error } = await db.from('hasil_stbj_langsir').delete().in('qrcode', Array.from(checked).map(cb => cb.value));
        if (error) throw error;
        await ambilSemuaData();
        alert("Berhasil menghapus data hold.");
    } catch(e) { alert("Gagal: " + e.message); }
}

function bukaModalGantiArea() {
    if(modeRiwayat !== 'qr') return alert("Hanya bisa dilakukan di mode DETAIL QRCODE.");
    const cek = document.querySelectorAll('.cb-row:checked'); if(cek.length === 0) return alert("Pilih baris!");
    document.getElementById('teks-info-area').innerText = `Anda akan memindahkan ${cek.length} kardus ke lokasi baru.`;
    document.getElementById('select-new-area').value = ''; document.getElementById('modal-ganti-area').classList.remove('hidden');
}

async function eksekusiGantiArea() {
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
                
                // 1. Update stok_qr
                await db.from('stok_qr').update({ area: newArea, id_sku: id_sku_baru }).eq('qrcode', qr);
                
                // 2. Update stok_global
                await db.from('stok_global').update({ area: newArea, id_sku: id_sku_baru }).eq('qrcode', qr);
                
                // 3. Update hasil_stbj_langsir
                await db.from('hasil_stbj_langsir').update({ posisi: newArea }).eq('qrcode', qr);
                
                // Akumulasi untuk stok_aktual
                let keyOld = `${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${oldArea}_${dbRow.customer}`;
                if(!mapDeduct[keyOld]) mapDeduct[keyOld] = { nama_item: dbRow.nama_item, pjg: dbRow.panjang, grade: dbRow.grade, dus: dbRow.dus, shading: dbRow.shading, area: oldArea, customer_aktual: dbRow.customer, qty: 0 };
                mapDeduct[keyOld].qty++;

                let keyNew = `${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${newArea}_${dbRow.customer}`;
                if(!mapAdd[keyNew]) mapAdd[keyNew] = { id_sku: id_sku_baru, jenis_item: dbRow.jenis_item, nama_item: dbRow.nama_item, panjang: dbRow.panjang, grade: dbRow.grade, dus: dbRow.dus, shading: dbRow.shading, area: newArea, customer_bawaan: dbRow.customer, customer_aktual: dbRow.customer, keterangan: '-', qty: 0 };
                mapAdd[keyNew].qty++;
            }
        }

        // Eksekusi Pengurangan dari Area Lama
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

        // Eksekusi Penambahan ke Area Baru
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

        tutupModalArea();
        alert(`✅ BERHASIL!\n\n${qrsToUpdate.length} item berhasil dipindahkan ke area "${newArea}" dan saldo stok_aktual diperbarui.`);
        await ambilSemuaData();
    } catch (error) {
        alert("Gagal memindahkan area: " + error.message);
    } finally {
        if(btn) { btn.innerHTML = original; btn.disabled = false; }
        lucide.createIcons();
    }
}

function salinDataTabel() {
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
}

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

// ========================================================
// FUNGSI MODAL STBJ & HOLD (CARD FORMAT)
// ========================================================
async function bukaModalSTBJ() {
    const mStbj = document.getElementById('modal-stbj-langsir'); if(mStbj) mStbj.classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</div>';
    lucide.createIcons();

    try {
        // Ambil data STBJ yang belum dilangsir langsung dari hasil_stbj_langsir
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
                    <div class="text-[12px] font-bold text-slate-600">Customer: <span class="text-orange-600">${r.customer || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { 
        if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; 
    }
}

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

async function bukaModalHold(tabelTarget = 'hold_stbj') {
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
                        <span class="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] border border-amber-200">HOLD</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${r.tgl_produksi || '-'} - ${r.mesin || '-'} - ${r.shift || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | <span class="text-slate-800">${r.nama_item || '-'}</span> | <span class="text-slate-800">${r.panjang || '-'}</span> | <span class="text-slate-800">${r.grade || '-'}</span> | <span class="text-slate-800">${r.dus || '-'}</span> | <span class="text-blue-600">${r.shading || '-'}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">Customer: <span class="text-orange-600">${r.customer || '-'}</span></div>
                    <div class="text-[12px] font-bold text-rose-600">Keterangan: <span class="text-rose-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
}
