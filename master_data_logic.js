let currentCategory = 'variabel';
let tableData = [];
let searchQuery = '';

// State Filter & Sort Excel
let activeFilters = {}; 
let currentFilterCol = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

const CONFIG = {
    'variabel': {
        table: 'master_2',
        title: 'VARIABEL & KODE',
        cols: [
            { key: 'mesin', label: 'Mesin Asli' },
            { key: 'kode_mesin', label: 'Kode Mesin' },
            { key: 'shift', label: 'Shift Asli' },
            { key: 'kode_shift', label: 'Kode Shift' },
            { key: 'nama_item', label: 'Nama Item Asli' },
            { key: 'kode_nama_item', label: 'Kode Item' },
            { key: 'grade', label: 'Grade Asli' },
            { key: 'kode_grade', label: 'Kode Grade' },
            { key: 'customer', label: 'PO Asli' },       // REVISI: po -> customer
            { key: 'kode_customer', label: 'Kode PO' },  // REVISI: kode_po -> kode_customer
            { key: 'dus', label: 'Dus Asli' },
            { key: 'kode_dus', label: 'Kode Dus' }
        ]
    },
    'jasper': {
        table: 'nama_jasper',
        title: 'NAMA JASPER',
        cols: [
            { key: 'nama_item', label: 'Nama Item (WMS)' },
            { key: 'panjang', label: 'Panjang' },
            { key: 'grade', label: 'Grade' },
            { key: 'nama_jasper', label: 'Nama Output Jasper' }
        ]
    },
    'area': {
        table: 'master_area',
        title: 'MASTER AREA',
        cols: [
            { key: 'nama_area', label: 'Nama Area Gudang' }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'master_data', title: 'MASTER DATA', url: 'master_data.html' });
    bukaTabel('variabel');
});

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-tambah-item').classList.add('hidden');
    closeFilterMenu();
};

async function bukaTabel(kategori) {
    currentCategory = kategori;
    
    // Atur Class Tab (Active/Inactive)
    ['variabel', 'jasper', 'area'].forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if(el) {
            el.className = (kategori === tab) 
                ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' 
                : 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        }
    });

    document.getElementById('input-search').value = '';
    searchQuery = '';
    activeFilters = {}; 
    updateFilterIcons();
    
    await fetchTableData();
}

async function fetchTableData() {
    const conf = CONFIG[currentCategory];
    const tbody = document.getElementById('tbody-master');
    const thead = document.getElementById('thead-master');
    
    // Render Header dengan Fitur Sort & Filter
    let thHtml = `<tr><th class="hdr-std w-12 relative">No</th>`;
    conf.cols.forEach((c, idx) => { 
        thHtml += thSort(idx + 1, c.label, `col-${c.key}`); 
    });
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;

    tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 1}" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500"></i> Memuat Data...</td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from(conf.table).select('*').order('id', { ascending: true });
        if (error) throw error;
        
        tableData = data || [];
        renderTableBody();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 1}" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`;
    }
}

function searchData(val) {
    searchQuery = val.toLowerCase();
    renderTableBody();
}

function renderTableBody() {
    const conf = CONFIG[currentCategory];
    const tbody = document.getElementById('tbody-master');
    
    tbody.innerHTML = '';

    if (tableData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 1}" class="p-10 text-center text-slate-400 font-bold">Tabel kosong. Silakan tambah data baru.</td></tr>`;
        return;
    }

    let html = '';
    tableData.forEach((row, index) => {
        html += `<tr class="border-b border-slate-200 transition r-row text-sm text-center" id="row-${index}">
            <td class="p-2 font-bold text-slate-400 bg-slate-50 border-r border-slate-200 col-no">${index + 1}</td>`;
        
        conf.cols.forEach(c => {
            let val = row[c.key] || '';
            html += `<td class="p-0 border-r border-slate-200 col-${c.key}" data-search="${val}">
                <input type="text" value="${val}" onchange="updateCell(${index}, '${c.key}', this.value)" class="excel-input uppercase" placeholder="-">
            </td>`;
        });
        html += `</tr>`;
    });

    tbody.innerHTML = html;
    lucide.createIcons();
    saringTabelExcel();
    initResizableColumns();
}

function updateCell(index, key, value) {
    tableData[index][key] = value.trim().toUpperCase();
}

function tambahBarisKosong() {
    let newRow = {};
    CONFIG[currentCategory].cols.forEach(c => newRow[c.key] = '');
    tableData.push(newRow);
    
    document.getElementById('input-search').value = '';
    searchQuery = '';
    
    renderTableBody();
    
    const container = document.querySelector('.table-container');
    if(container) container.scrollTop = container.scrollHeight;
}

// ==========================================
// LOGIKA TAMBAH ITEM (MODAL INPUT)
// ==========================================
window.bukaModalTambahItem = function() {
    const conf = CONFIG[currentCategory];
    const container = document.getElementById('form-tambah-container');
    container.innerHTML = '';

    conf.cols.forEach(c => {
        container.innerHTML += `
            <div>
                <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">${c.label}</label>
                <input type="text" id="add-${c.key}" class="w-full p-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-indigo-600 font-bold uppercase bg-slate-50" placeholder="Ketik ${c.label}...">
            </div>
        `;
    });

    document.getElementById('modal-tambah-item').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.simpanTambahItem = function() {
    const conf = CONFIG[currentCategory];
    let newRow = {};
    let isEmpty = true;

    conf.cols.forEach(c => {
        const val = document.getElementById(`add-${c.key}`).value.trim().toUpperCase();
        newRow[c.key] = val || '';
        if (val) isEmpty = false;
    });

    if (isEmpty) return alert("Isi minimal salah satu kolom!");

    tableData.push(newRow);
    document.getElementById('modal-tambah-item').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');

    renderTableBody();

    // Scroll ke paling bawah
    const container = document.querySelector('.table-container');
    if(container) container.scrollTop = container.scrollHeight;
};

// ==========================================
// LOGIKA AUTO-COLLAPSE (MERAPIKAN BARIS KOSONG)
// ==========================================
function collapseColumns() {
    const conf = CONFIG[currentCategory];
    let colValues = {};
    
    // Inisialisasi array penampung nilai non-kosong per kolom
    conf.cols.forEach(c => {
        colValues[c.key] = [];
    });

    // Kumpulkan semua nilai yang tidak kosong
    tableData.forEach(row => {
        conf.cols.forEach(c => {
            let val = (row[c.key] || '').trim();
            if (val !== '') {
                colValues[c.key].push(val);
            }
        });
    });

    // Cari jumlah baris maksimal setelah dirapikan
    let maxLen = 0;
    conf.cols.forEach(c => {
        if (colValues[c.key].length > maxLen) {
            maxLen = colValues[c.key].length;
        }
    });

    // Susun ulang tableData
    let newTableData = [];
    for (let i = 0; i < maxLen; i++) {
        let newRow = {};
        let existingId = tableData[i] ? tableData[i].id : null;
        if (existingId) {
            newRow.id = existingId;
        }
        conf.cols.forEach(c => {
            newRow[c.key] = colValues[c.key][i] || null;
        });
        newTableData.push(newRow);
    }

    // Jika ada baris lama yang tersisa, kosongkan isinya di database (set NULL)
    for (let i = maxLen; i < tableData.length; i++) {
        if (tableData[i] && tableData[i].id) {
            let emptyRow = { id: tableData[i].id };
            conf.cols.forEach(c => {
                emptyRow[c.key] = null;
            });
            newTableData.push(emptyRow);
        }
    }

    tableData = newTableData;
}

async function simpanKeSupabase() {
    const conf = CONFIG[currentCategory];
    const btn = document.getElementById('btn-save');
    const ori = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...';
    btn.disabled = true;

    // REVISI: Jalankan Auto-Collapse sebelum simpan ke database
    collapseColumns();

    try {
        let payloadUpdate = [];
        let payloadInsert = [];

        tableData.forEach(row => {
            let cleanRow = {};
            let isEmpty = true;
            
            conf.cols.forEach(c => {
                cleanRow[c.key] = row[c.key] || null;
                if (cleanRow[c.key]) isEmpty = false;
            });
            
            if (!isEmpty) {
                if (row.id) {
                    cleanRow.id = row.id;
                    payloadUpdate.push(cleanRow);
                } else {
                    payloadInsert.push(cleanRow);
                }
            }
        });

        if (payloadUpdate.length > 0) {
            const { error: errUpd } = await db.from(conf.table).upsert(payloadUpdate);
            if (errUpd) throw new Error("Gagal Update data: " + errUpd.message);
        }

        if (payloadInsert.length > 0) {
            const { error: errIns } = await db.from(conf.table).insert(payloadInsert);
            if (errIns) throw new Error("Gagal Insert data baru: " + errIns.message);
        }

        alert("✅ BERHASIL!\nSemua perubahan Master Data telah dirapikan (Auto-Collapse) dan disinkronkan ke Database.");
        await fetchTableData();

    } catch (e) {
        alert("❌ ERROR: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
}

// ==========================================
// SORT & FILTER ALA EXCEL
// ==========================================
function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-master');
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
    const noFilter = ['col-cb', 'col-no'].includes(colClass);
    
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

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-master tr.r-row').forEach(row => {
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
window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x); 
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        let matches = query.every(term => text.includes(term)); label.style.display = matches ? '' : 'none';
    });
};
window.closeFilterMenu = function() { document.getElementById('excel-filter-menu').classList.add('hidden'); };
window.clearFilterForCurrentCol = function() { delete activeFilters[currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); activeFilters[currentFilterCol] = selectedVals; }
    window.closeFilterMenu(); window.saringTabelExcel(); 
};
window.saringTabelExcel = function() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); }
    });
    applyPagination();
    updateFilterIcons();
};
window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-master tr.r-row'));
    let visibleCount = 0;
    allRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if(row.classList.contains('filtered-out') || (searchQuery && !row.innerText.toLowerCase().includes(searchQuery))) {
            row.style.display = 'none';
        } else {
            row.style.display = '';
            visibleCount++;
            if (visibleCount % 2 === 0) row.classList.add('stripe-2');
            else row.classList.add('stripe-1');
            
            const noCell = row.querySelector('.col-no');
            if (noCell) noCell.innerText = visibleCount;
        }
    });
    document.getElementById('lbl-total-baris').innerText = visibleCount;
}

function downloadExcelMaster() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
    
    const conf = CONFIG[currentCategory];
    let ws_data = [];
    
    let headers = ['No'];
    conf.cols.forEach(c => headers.push(c.label));
    ws_data.push(headers);

    const visibleRows = Array.from(document.querySelectorAll('#tbody-master tr.r-row')).filter(row => row.style.display !== 'none');

    if (visibleRows.length === 0) return alert("Tidak ada data untuk diekspor!");

    visibleRows.forEach((row, idx) => {
        let rowData = [idx + 1];
        conf.cols.forEach(c => {
            const cell = row.querySelector(`.col-${c.key}`);
            const inputVal = cell ? cell.querySelector('input').value : '';
            rowData.push(inputVal);
        });
        ws_data.push(rowData);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, conf.title);
    XLSX.writeFile(wb, `MasterData_${conf.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#thead-master th');
    cols.forEach(col => {
        const existing = col.querySelector('.resizer');
        if(existing) existing.remove();

        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        col.appendChild(resizer);
        
        let x = 0; let w = 0;
        resizer.addEventListener('mousedown', function(e) {
            x = e.clientX;
            w = parseInt(window.getComputedStyle(col).width, 10);
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
        });
        const mouseMoveHandler = function(e) {
            const dx = e.clientX - x;
            col.style.width = `${w + dx}px`;
            col.style.minWidth = `${w + dx}px`;
        };
        const mouseUpHandler = function() {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };
    });
}
