let modeSekarang = 'qrcode'; 
let tabelSekarang = 'hasil_stbj'; 
let rawDataRaw = [];
let kamusData = [];
let jasperData = [];
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 

let userColOrder = []; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

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
            if (!actionMenu.contains(e.target) && !e.target.closest('button[onclick^="toggleActionMenuMobile"]')) {
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

function loadUserPreferences() {
    const savedOrder = localStorage.getItem(`col_order_stbj_${currentUser.username}`);
    if (savedOrder) {
        try {
            userColOrder = JSON.parse(savedOrder);
        } catch(e) {
            userColOrder = [];
        }
    }
}

function toggleSidebarKolom() {
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
}

function tutupPopups() {
    document.getElementById('sidebar-kolom').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
}

function renderDragList() {
    const container = document.getElementById('kolom-drag-container');
    container.innerHTML = '';
    
    const headers = Array.from(document.querySelectorAll('#thead-stbj th')).filter(th => !th.classList.contains('col-cb'));
    
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
        const label = th.innerText.trim() || 'Kolom';
        
        const div = document.createElement('div');
        div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition';
        div.draggable = true;
        div.setAttribute('data-col', colClass);
        div.innerHTML = `
            <span class="font-bold text-slate-700 text-xs">${label}</span>
            <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>
        `;
        
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); });
        div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        
        container.appendChild(div);
    });
    
    lucide.createIcons();

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            container.appendChild(draggable);
        } else {
            container.insertBefore(draggable, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function simpanUrutanKolom() {
    const items = document.querySelectorAll('.drag-item');
    let newOrder = [];
    items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    
    userColOrder = newOrder;
    localStorage.setItem(`col_order_stbj_${currentUser.username}`, JSON.stringify(newOrder));
    
    alert("Urutan kolom berhasil disimpan di perangkat ini!");
    toggleSidebarKolom();
    renderHeaderDanTabel(); 
}

function resetUrutanKolom() {
    if(!confirm("Kembalikan urutan kolom ke default (bawaan sistem)?")) return;
    userColOrder = [];
    localStorage.removeItem(`col_order_stbj_${currentUser.username}`);
    
    alert("Urutan dikembalikan ke default.");
    toggleSidebarKolom();
    renderHeaderDanTabel();
}

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;

    const table = document.getElementById('table-stbj-main');
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

        userColOrder.forEach(colId => {
            if (cellMap[colId]) {
                row.appendChild(cellMap[colId]);
            }
        });

        cells.forEach(c => {
            const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-'));
            if (colClass !== 'col-cb' && !userColOrder.includes(colClass)) {
                row.appendChild(c);
            }
        });
    });
}

async function loadKamusDanJasper() {
    const { data: d2 } = await db.from('master_2').select('*'); if(d2) kamusData = d2;
    try {
        const { data: dj } = await db.from('nama_jasper').select('*').order('created_at', {ascending: false});
        if(dj) jasperData = dj;
    } catch(e) { console.log("Tabel nama_jasper belum siap."); }
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-stbj');
    tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    lucide.createIcons();
    try {
        const { data, error } = await db.from(tabelSekarang).select('*').order('created_at', {ascending: false});
        if(error) throw error;
        
        if(data && data.length > 0) {
            const qrs = data.map(d => d.qrcode);
            const { data: stokData } = await db.from('stok_qr').select('qrcode').in('qrcode', qrs);
            const stokSet = new Set((stokData || []).map(d => d.qrcode));
            data.forEach(d => { d.is_in_gudang = stokSet.has(d.qrcode); });
        }

        rawDataRaw = data || [];
        renderHeaderDanTabel();
    } catch(err) { tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`; }
}

function setMode(m) {
    modeSekarang = m;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    ['qrcode', 'item', 'jasper'].forEach(tab => {
        const el = document.getElementById('tab-mode-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    const btnCollect = document.getElementById('btn-massal-collect');
    const btnCollectMob = document.getElementById('btn-massal-collect-mob');
    const btnHold = document.getElementById('btn-hold');
    const btnHoldMob = document.getElementById('btn-hold-mob');
    const btnHapus = document.getElementById('btn-hapus');
    const btnHapusMob = document.getElementById('btn-hapus-mob');
    
    if (m === 'item' || m === 'jasper') {
        if(btnCollect) btnCollect.classList.remove('hidden'); 
        if(btnCollectMob) btnCollectMob.classList.remove('hidden'); 
        if(btnHold) btnHold.classList.add('hidden');
        if(btnHoldMob) btnHoldMob.classList.add('hidden');
        if(btnHapus) btnHapus.classList.add('hidden');
        if(btnHapusMob) btnHapusMob.classList.add('hidden');
    } else {
        if(btnCollect) btnCollect.classList.add('hidden'); 
        if(btnCollectMob) btnCollectMob.classList.add('hidden'); 
        if(btnHold) btnHold.classList.remove('hidden');
        if(btnHoldMob) btnHoldMob.classList.remove('hidden');
        if(btnHapus) btnHapus.classList.remove('hidden');
        if(btnHapusMob) btnHapusMob.classList.remove('hidden');
    }

    activeFilters = {}; 
    renderHeaderDanTabel();
}

function switchTable(val) { tabelSekarang = val; muatDataDariSupabase(); }

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-stbj');
    const rows = Array.from(tbody.querySelectorAll('tr.text-row'));
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

// REVISI: Desain Header lebih rapi dengan gap dan icon yang proporsional
const thSort = (label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-btn-edit'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    const justifyClass = noFilter ? 'justify-center' : 'justify-start';

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center ${justifyClass} gap-2">
            <span class="cursor-pointer flex items-center gap-1.5 hover:text-blue-300 transition" onclick="sortTable(this.closest('th').cellIndex, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation();
    currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-stbj tr.text-row').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol];
                const c = row.querySelector('.' + otherCol);
                let t = c ? (c.getAttribute('data-search') || c.innerText.trim()) : '';
                if (!allowed.includes(t)) { showBasedOnOthers = false; break; }
            }
        }
        if (showBasedOnOthers) {
            let cell = row.querySelector('.' + colClass);
            if (cell) {
                let val = cell.getAttribute('data-search') || cell.innerText.trim();
                if(val !== '') uniqueValues.add(val);
            }
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

    document.getElementById('filter-values-list').innerHTML = listHtml;
    updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const rect = event.currentTarget.getBoundingClientRect();
    const menu = document.getElementById('excel-filter-menu');
    menu.classList.remove('hidden');
    
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;
    
    if (left + 256 > window.innerWidth) { left = window.innerWidth - 266; }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    
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

function searchFilterList(val) {
    const query = val.toLowerCase().split(' ').filter(x => x); 
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        let matches = query.every(term => text.includes(term));
        label.style.display = matches ? '' : 'none';
    });
}

function closeFilterMenu() { document.getElementById('excel-filter-menu').classList.add('hidden'); }

function clearFilterForCurrentCol() {
    delete activeFilters[currentFilterCol];
    closeFilterMenu(); saringTabelExcel(); updateFilterIcons();
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
    
    closeFilterMenu(); saringTabelExcel(); updateFilterIcons();
}

function saringTabelExcel() {
    document.querySelectorAll('.text-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass];
            const cell = row.querySelector('.' + colClass);
            if (cell) {
                let text = cell.getAttribute('data-search') || cell.innerText.trim();
                if (!allowedValues.includes(text)) { show = false; break; }
            }
        }
        
        if (show) { 
            row.classList.remove('filtered-out'); 
        } else { 
            row.classList.add('filtered-out'); 
            let cb = row.querySelector('.row-cb');
            if(cb) { cb.checked = false; highlightRow(cb); } 
        }
    });
    currentPage = 1; 
    applyPagination(); 
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

// REVISI: Fungsi Hitung QTY Lembar
function hitungQtyLembar(jenis, nama, qtyDus) {
    if (!qtyDus) return 0;
    let j = (jenis || '').toUpperCase();
    let n = (nama || '').toUpperCase();
    
    if (j === 'PLAFON') return qtyDus * 15;
    if (j === 'LIST' || j === 'LIS') {
        if (n.includes('PROFILE IV')) return qtyDus * 60;
        if (n.includes('PROFILE V')) return qtyDus * 60;
        if (n.includes('PROFILE II')) return qtyDus * 48;
        if (n.includes('PROFILE I')) return qtyDus * 140;
        if (n.includes('CONNECTOR')) return qtyDus * 80;
        return qtyDus * 24; // Default (termasuk Profile VI)
    }
    return 0;
}

// REVISI: Padding diubah ke py-3, text-[13px], dan "Troli Gabungan" -> "Troli"
function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-stbj');
    const tbody = document.getElementById('tbody-stbj');
    sortState = {};

    const rowClassBase = "transition text-row text-[13px]";

    if(modeSekarang === 'qrcode') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std w-10 col-btn text-center"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-slate-400"></i></th>
                ${thSort('Status Item', 'col-status-gudang')}
                ${tabelSekarang === 'hold_stbj' ? thSort('Status Hold', 'col-status') : '<th class="hdr-std hidden col-status">Status Hold</th>'}
                ${thSort('Collect', 'col-status-data')}
                ${thSort('Waktu Scan', 'col-waktu')}
                ${thSort('Troli', 'col-troli')}
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
                ${thSort('Customer Bawaan', 'col-customer')}
                ${thSort('Keterangan', 'col-ket')}
                ${thSort('PIC Input', 'col-pic')}
            </tr>`;
        
        if(rawDataRaw.length === 0) { tbody.innerHTML = `<tr id="empty-row-stbj"><td colspan="22" class="px-4 py-8 text-center font-bold text-slate-400">Tabel Kosong.</td></tr>`; return; }
        
        let h = '';
        rawDataRaw.forEach((r, i) => {
            let tgl = '-';
            if (r.created_at) {
                const dt = new Date(r.created_at);
                if (!isNaN(dt.getTime())) {
                    const dd = String(dt.getDate()).padStart(2, '0');
                    const mm = String(dt.getMonth() + 1).padStart(2, '0');
                    const yyyy = dt.getFullYear();
                    tgl = `${dd}/${mm}/${yyyy}`;
                }
            }

            const htmlStatusGudang = r.is_in_gudang ? '<span class="text-emerald-600 font-black">IN GUDANG</span>' : '<span class="text-slate-500 font-bold">STBJ</span>';
            
            let statData = '-';
            if (r.status_data && r.status_data !== 'BELUM') {
                statData = `<span class="text-indigo-600 font-medium uppercase">${r.status_data}</span>`;
            }

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-center col-btn">
                        <button onclick="aksiHapusPerBaris('${r.qrcode}')" class="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-md hover:bg-rose-50 mx-auto flex shadow-sm border border-transparent hover:border-rose-200">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                    <td class="px-4 py-3 text-left col-status-gudang" data-search="${r.is_in_gudang ? 'IN GUDANG' : 'STBJ'}">${htmlStatusGudang}</td>
                    ${tabelSekarang === 'hold_stbj' ? `<td class="px-4 py-3 text-left font-black text-amber-600 col-status" data-search="${r.status || 'HOLD'}">${r.status || 'HOLD'}</td>` : '<td class="px-4 py-3 hidden col-status">-</td>'}
                    <td class="px-4 py-3 text-left col-status-data" data-search="${r.status_data || '-'}">${statData}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-waktu" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-troli" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                    <td class="px-4 py-3 text-left font-mono font-bold text-slate-900 col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-tgl" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-mesin" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shift" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                    <td class="px-4 py-3 text-left font-semibold text-slate-900 col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-customer" data-search="${r.customer || '-'}">${r.customer || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-600 col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-500 col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
        tbody.innerHTML += `<tr id="empty-row-stbj" style="display:none;"><td colspan="22" class="px-4 py-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
    } 
    else if(modeSekarang === 'item' || modeSekarang === 'jasper') {
        const isJasper = modeSekarang === 'jasper';
        
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std col-status-gudang hidden">Status Item</th>
                <th class="hdr-std col-status hidden">Status Hold</th>
                ${thSort('Collect', 'col-status-data')}
                <th class="hdr-std col-waktu hidden">Waktu Scan</th>
                ${thSort('Troli', 'col-troli')}
                <th class="hdr-std col-qr hidden">QRCode</th>
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${isJasper ? thSort('Nama Jasper', 'col-jasper text-purple-300') : ''}
                ${isJasper ? '<th class="hdr-std w-10 text-center col-btn-edit">Edit</th>' : ''}
                ${thSort('Panjang', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Bawaan', 'col-customer')}
                ${thSort('QTY (DUS)', 'col-qty')}
                ${thSort('QTY (LEMBAR)', 'col-qty-lembar text-emerald-400')}
                ${thSort('Keterangan', 'col-ket')}
                <th class="hdr-std col-pic hidden">PIC Input</th>
            </tr>`;
        
        let groups = {};
        rawDataRaw.forEach(r => {
            let n = r.nama_item || '-';
            let jName = n;
            let jId = '';
            
            if(isJasper) {
                if(jasperData && jasperData.length > 0) {
                    const cJasper = jasperData.find(j => j.nama_item === r.nama_item && j.panjang === r.panjang && j.grade === r.grade);
                    if(cJasper) {
                        jName = cJasper.nama_jasper;
                        jId = cJasper.id;
                    } else {
                        jName = `JAS-${r.nama_item}`;
                    }
                } else { jName = `JAS-${r.nama_item}`; }
            }
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let sData = r.status_data || 'BELUM';
            let cust = r.customer || '-';
            let key = `${r.jenis_item}_${n}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${cust}_${r.tgl_produksi}_${r.mesin}_${r.shift}_${ket}_${sData}`;
            
            if(!groups[key]) {
                groups[key] = { 
                    jenisItem: r.jenis_item, namaItemAsli: n, displayNama: jName, jasperId: jId, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, customer: cust,
                    tglProduksi: r.tgl_produksi, mesin: r.mesin, shift: r.shift,
                    qty: 0, qrcodes: [], trolis: new Set(), ket: ket, sData: sData 
                };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
            if(r.troli) groups[key].trolis.add(r.troli);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-stbj"><td colspan="20" class="px-4 py-8 text-center font-bold text-slate-400">Kosong.</td></tr>`; return; }

        let h = '';
        arr.forEach((r) => {
            const gabunganTroli = Array.from(r.trolis).join(', ') || '-';
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            
            let statData = '-';
            if (r.sData && r.sData !== 'BELUM') {
                statData = `<span class="text-indigo-600 font-medium uppercase">${r.sData}</span>`;
            }

            let btnEditJasper = '';
            if(isJasper) {
                const jData = encodeURIComponent(JSON.stringify({
                    id: r.jasperId,
                    nama_item: r.namaItemAsli,
                    panjang: r.panjang,
                    grade: r.grade,
                    nama_jasper: r.displayNama
                }));
                btnEditJasper = `<td class="px-4 py-3 text-center col-btn-edit"><button onclick="bukaModalKatalogForm(true, '${jData}')" class="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition shadow-sm mx-auto flex"><i data-lucide="edit-3" class="w-4 h-4"></i></button></td>`;
            }

            let qtyLembar = hitungQtyLembar(r.jenisItem, r.namaItemAsli, r.qty);

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcodes.join(',')}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 hidden col-status-gudang">-</td>
                    <td class="px-4 py-3 hidden col-status">-</td>
                    <td class="px-4 py-3 text-left col-status-data" data-search="${r.sData || '-'}">${statData}</td>
                    <td class="px-4 py-3 hidden col-waktu">-</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-troli" data-search="${gabunganTroli}">${gabunganTroli}</td>
                    <td class="px-4 py-3 hidden col-qr">-</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-tgl" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-mesin" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shift" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-jenis" data-search="${r.jenisItem}">${r.jenisItem}</td>
                    <td class="px-4 py-3 text-left font-semibold text-slate-900 col-nama" data-search="${r.namaItemAsli}">${r.namaItemAsli}</td>
                    ${isJasper ? `<td class="px-4 py-3 text-left font-black text-purple-700 col-jasper" data-search="${r.displayNama}">${r.displayNama}</td>` : ''}
                    ${btnEditJasper}
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-pjg" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-800 col-customer" data-search="${r.customer}">${r.customer}</td>
                    <td class="px-4 py-3 text-center font-black text-emerald-700 col-qty" data-search="${r.qty}">${r.qty}</td>
                    <td class="px-4 py-3 text-center font-black text-emerald-600 col-qty-lembar" data-search="${qtyLembar}">${qtyLembar}</td>
                    <td class="px-4 py-3 text-left font-medium text-slate-600 col-ket" data-search="${displayKet}">${displayKet}</td>
                    <td class="px-4 py-3 hidden col-pic">-</td>
                </tr>`;
        });
        tbody.innerHTML = h;
        tbody.innerHTML += `<tr id="empty-row-stbj" style="display:none;"><td colspan="20" class="px-4 py-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
    }
    
    applyColumnOrder();
    lucide.createIcons(); 
    saringTabelExcel();
}

function highlightRow(checkbox) {
    const tr = checkbox.closest('tr');
    if (checkbox.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
    updateSelectedCount();
}

function toggleSemuaCentang(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('tr');
        if (row.style.display !== 'none' && !row.classList.contains('filtered-out')) {
            cb.checked = checked; highlightRow(cb);
        }
    });
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
    currentPage = 1; 
    applyPagination();
}

function setCustomRowsPerPage(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        rowsPerPage = parsed;
        currentPage = 1;
        applyPagination();
    }
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-stbj tr.text-row'));
    
    allRows.forEach(row => {
        if(row.classList.contains('filtered-out')) { row.style.display = 'none'; }
    });

    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    let sumQty = 0;
    visibleRows.forEach((row, index) => {
        if(modeSekarang === 'qrcode') {
            sumQty += 1;
        } else {
            const qtyCell = row.querySelector('.col-qty');
            if(qtyCell) { sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; }
        }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    const emptyRow = document.getElementById('empty-row-stbj');
    if(emptyRow) emptyRow.style.display = totalFiltered === 0 ? '' : 'none';

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    updateSelectedCount();
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-stbj tr.text-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.row-cb:checked').length;
    const lbl = document.getElementById('lbl-pilih-baris');
    if(lbl) lbl.innerText = count;
}

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
        
        // Update langsung ke hasil_stbj
        const { error: errUpdateHasil } = await db.from('hasil_stbj')
            .update({ nama_jasper: output })
            .eq('nama_item', nama)
            .eq('panjang', pjg)
            .eq('grade', grade);
            
        if(errUpdateHasil) console.error("Gagal update hasil_stbj:", errUpdateHasil);
        
        tutupModalJasperForm();
        
        document.getElementById('tbody-katalog-list').innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat ulang tabel...</td></tr>';
        lucide.createIcons();
        
        await loadKamusDanJasper(); 
        renderKatalogList(); 
        muatDataDariSupabase(); 
        
    } catch(e) {
        alert("GAGAL MENYIMPAN: " + e.message);
    } finally {
        btn.innerHTML = oriTxt; btn.disabled = false; lucide.createIcons();
    }
}

async function aksiHapusPerBaris(qrcode) {
    if(!confirm(`Hapus permanen QRCode ini dari tabel ${tabelSekarang}?`)) return;
    try {
        const { error } = await db.from(tabelSekarang).delete().eq('qrcode', qrcode);
        if(error) throw error;
        await muatDataDariSupabase();
    } catch(e) { alert("Gagal hapus: " + e.message); }
}

async function aksiMassal(tipe) {
    let checkedValues = [];
    document.querySelectorAll('.row-cb:checked').forEach(cb => { cb.value.split(',').forEach(v => { if(v) checkedValues.push(v); }); });
    if(checkedValues.length === 0) return alert("Centang baris tabel terlebih dahulu!");

    if(tipe === 'salin') {
        let textSalin = "";
        const headers = Array.from(document.querySelectorAll('#thead-stbj th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn') && !th.classList.contains('col-btn-edit'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr');
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn') || td.classList.contains('col-btn-edit')) return;
                if(window.getComputedStyle(td).display !== 'none') {
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                    rowData.push(val.replace(/\n/g, ' '));
                }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        navigator.clipboard.writeText(textSalin);
        alert(`Tersalin baris! Buka Excel dan Paste (Ctrl+V).`);
    } 
    else if(tipe === 'hold') {
        if(tabelSekarang === 'hasil_stbj') {
            if(!confirm(`Pindahkan ${checkedValues.length} data HASIL -> tabel HOLD (Duplikat)?`)) return;
            const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({ 
                troli: r.troli, qrcode: r.qrcode, tgl_produksi: r.tgl_produksi, shift: r.shift, mesin: r.mesin, 
                nama_item: r.nama_item, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, 
                customer_bawaan: r.customer, keterangan: r.keterangan, status: 'HOLD', status_data: r.status_data, 
                posisi: r.posisi, pic_input: r.pic_input 
            }));
            const { error: errAdd } = await db.from('hold_stbj').upsert(dataPindah);
            if(!errAdd) { await db.from('hasil_stbj').delete().in('qrcode', checkedValues); muatDataDariSupabase(); }
        } else {
            if(!confirm(`Unhold ${checkedValues.length} data HOLD -> tabel HASIL (Unique)?`)) return;
            const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({ 
                troli: r.troli, qrcode: r.qrcode, tgl_produksi: r.tgl_produksi, shift: r.shift, mesin: r.mesin, 
                nama_item: r.nama_item, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, 
                customer: r.customer_bawaan, keterangan: r.keterangan, status: 'SUDAH STBJ', status_data: r.status_data, 
                posisi: r.posisi, pic_input: r.pic_input, nama_jasper: '-'
            }));
            const { error: errAdd } = await db.from('hasil_stbj').upsert(dataPindah);
            if(!errAdd) { await db.from('hold_stbj').delete().in('qrcode', checkedValues); muatDataDariSupabase(); }
        }
    }
    else if (tipe === 'collect') {
        if(!confirm(`Tandai ${checkedValues.length} QrCode sebagai COLLECTED oleh ${currentUser.username}?`)) return;
        const btn = document.getElementById('btn-massal-collect');
        const btnMob = document.getElementById('btn-massal-collect-mob');
        if(btn) { btn.innerHTML = '<div class="bg-indigo-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-indigo-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-indigo-700 transition">Collect</div>'; btn.disabled = true; }
        if(btnMob) { btnMob.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-indigo-700"></i> Memproses...'; btnMob.disabled = true; }
        
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
                        users.push(currentUser.username);
                        newCollect = users.join(', ');
                    }
                }
                updates.push({ qrcode: qr, status_data: newCollect });
            }
        });

        try {
            const chunkSize = 50;
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize);
                await Promise.all(chunk.map(u => db.from(tabelSekarang).update({ status_data: u.status_data }).eq('qrcode', u.qrcode)));
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
        if(!confirm(`Yakin ingin menghapus permanen ${checkedValues.length} data ini dari tabel ${tabelSekarang}?`)) return;
        
        const btn = document.getElementById('btn-hapus'); 
        const ori = btn ? btn.innerHTML : '';
        if(btn) { btn.innerHTML = '<div class="bg-rose-800 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></div><div class="bg-rose-700 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-rose-600 transition">Proses...</div>'; btn.disabled = true; }

        try {
            const { error } = await db.from(tabelSekarang).delete().in('qrcode', checkedValues);
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
        const headers = Array.from(document.querySelectorAll('#thead-stbj th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn') && !th.classList.contains('col-btn-edit'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        ws_data.push(headers);

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr');
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn') || td.classList.contains('col-btn-edit')) return;
                if(window.getComputedStyle(td).display !== 'none') {
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                    rowData.push(val.replace(/\n/g, ' '));
                }
            });
            ws_data.push(rowData);
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "STBJ_Data");
        XLSX.writeFile(wb, `STBJ_${tabelSekarang}_${modeSekarang.toUpperCase()}.xlsx`);
    }
}
