let currentMode = 'out';
let dataPic = [];
let picRowId = 0;
let riwayatKonversiList = [];
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};
let masterData = { kamus: [] };

// State Filter Excel
let activeFilters = {}; 
let currentFilterCol = '';
let sortState = {};

window.tutupSemuaModal = function() {
    document.getElementById('modal-po-target').classList.add('hidden');
    document.getElementById('modal-riwayat-konversi').classList.add('hidden');
    document.getElementById('modal-lihat-po').classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'scan_pic', title: 'SCAN PIC AREA', url: 'scan_pic.html' }); 
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
    });

    await loadInitialData();
    await loadAreas(); 
    renderTablePic(dataPic);
});

async function loadInitialData() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) masterData.kamus = mData2; 
    } catch(err) { console.error("Gagal load master_2:", err); }
}

async function loadAreas() {
    try {
        const { data } = await db.from('master_area').select('*');
        if (data) {
            const selIn = document.getElementById('in-area');
            const selPindah = document.getElementById('pindah-area-target');
            let ops = '<option value="">-- Pilih Area Gudang --</option>';
            [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))].sort().forEach(a => {
                ops += `<option value="${a}">${a}</option>`;
            });
            selIn.innerHTML = ops;
            selPindah.innerHTML = ops;
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

function extractCustomerFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 7 ? parts[6] : '-';
}

// REVISI: Menerjemahkan Customer Bawaan dari Barcode sesuai master_2 (kode_customer -> customer)
function translateBarcode(barcode) {
    const parts = barcode.split('/');
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', customerBawaan: '-' };
    if (parts.length < 4) return data;

    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon'; else if (hurufDepan === 'L') data.jenisItem = 'List'; else if (hurufDepan === 'W') data.jenisItem = 'WPC'; else data.jenisItem = hurufDepan;

    let rawItem = parts[0]; let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem);
    data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem;
    data.shading = parts[1];

    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1);
        if (rawGrade === '1') data.grade = 'BAGUS'; else if (rawGrade === '2') data.grade = 'A'; else data.grade = rawGrade;
        let rawDus = p2.substring(p2.length - 2); 
        let cariDus = masterData.kamus.find(m => m.kode_dus === rawDus);
        data.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }

    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let rawMesin = match[1]; let rawShift = match[2]; let rawCustomer = match[3];   
            let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin); data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;
            let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift); data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
            
            // FIX: Mencari berdasarkan kode_customer, dan mengembalikan customer
            let cariCustomer = masterData.kamus.find(m => m.kode_customer === rawCustomer); 
            data.customerBawaan = cariCustomer && cariCustomer.customer ? cariCustomer.customer : rawCustomer;
        }
    }
    return data;
}

// ==========================================
// TABS & MODES MANAGEMENT
// ==========================================
window.setModeKonversi = function(mode) {
    currentMode = mode;
    const tabOut = document.getElementById('tab-out');
    const tabIn = document.getElementById('tab-in');
    const tabPindah = document.getElementById('tab-pindah');
    
    const panelOut = document.getElementById('panel-out');
    const panelIn = document.getElementById('panel-in');
    const panelPindah = document.getElementById('panel-pindah');
    
    const btnVerifUmum = document.getElementById('btn-verifikasi-umum');
    const btnSave = document.getElementById('btn-save-awal');
    const textSave = document.getElementById('text-save-awal');
    const btnRiwayatPindah = document.getElementById('btn-riwayat-pindah');

    [tabOut, tabIn, tabPindah].forEach(t => t.className = 'px-6 py-3.5 border-b-4 border-transparent text-slate-500 font-bold text-xs uppercase hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2');

    if(mode === 'out') {
        tabOut.className = 'px-6 py-3.5 border-b-4 border-rose-600 text-rose-600 bg-rose-50 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2';
        panelOut.classList.remove('hidden'); panelIn.classList.add('hidden'); panelPindah.classList.add('hidden');
        btnRiwayatPindah.classList.add('hidden');
        
        btnVerifUmum.className = 'group flex items-stretch shrink-0 cursor-pointer shadow-sm active:scale-95 transition rounded-md overflow-hidden border border-slate-800';
        btnVerifUmum.innerHTML = '<div class="bg-slate-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="shield-check" class="w-4 h-4"></i></div><div class="bg-slate-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-700 transition">Verifikasi Gudang</div>';
        
        btnSave.className = 'w-full md:w-auto px-8 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase';
        textSave.innerText = "SIMPAN & EKSEKUSI";
    } else if(mode === 'in') {
        tabIn.className = 'px-6 py-3.5 border-b-4 border-emerald-600 text-emerald-600 bg-emerald-50 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2';
        panelIn.classList.remove('hidden'); panelOut.classList.add('hidden'); panelPindah.classList.add('hidden');
        btnRiwayatPindah.classList.add('hidden');
        
        btnVerifUmum.className = 'group flex items-stretch shrink-0 cursor-pointer shadow-sm active:scale-95 transition rounded-md overflow-hidden border border-emerald-800';
        btnVerifUmum.innerHTML = '<div class="bg-emerald-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="shield-check" class="w-4 h-4"></i></div><div class="bg-emerald-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-emerald-700 transition">Verifikasi Gudang</div>';
        
        btnSave.className = 'w-full md:w-auto px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase';
        textSave.innerText = "SIMPAN KE KARTU STOK";
    } else if(mode === 'pindah') {
        tabPindah.className = 'px-6 py-3.5 border-b-4 border-indigo-600 text-indigo-600 bg-indigo-50 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2';
        panelPindah.classList.remove('hidden'); panelOut.classList.add('hidden'); panelIn.classList.add('hidden');
        btnRiwayatPindah.classList.remove('hidden');
        
        btnVerifUmum.className = 'group flex items-stretch shrink-0 cursor-pointer shadow-sm active:scale-95 transition rounded-md overflow-hidden border border-slate-800';
        btnVerifUmum.innerHTML = '<div class="bg-slate-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="shield-check" class="w-4 h-4"></i></div><div class="bg-slate-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-700 transition">Verifikasi Gudang</div>';
        
        btnSave.className = 'w-full md:w-auto px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase';
        textSave.innerText = "SIMPAN PINDAH AREA";
    }

    lucide.createIcons();
    dataPic = []; renderTablePic(dataPic);
};

window.toggleAktifitas = function(target) {
    const body = document.getElementById(target === 'out' ? 'body-aktifitas-out' : 'body-aktifitas-in');
    const icon = document.getElementById(target === 'out' ? 'icon-toggle-out' : 'icon-toggle-in');
    if (body.classList.contains('hidden')) { body.classList.remove('hidden'); icon.classList.remove('rotate-180'); } 
    else { body.classList.add('hidden'); icon.classList.add('rotate-180'); }
};

// ==========================================
// SORTING & FILTER EXCEL PRO
// ==========================================
function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-pic');
    const rows = Array.from(tbody.querySelectorAll('tr.row-pic'));
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
    updateTableDisplay();
}

const thSort = (idx, label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-600 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    return `<th class="hdr-std ${cls} select-none relative border-r border-slate-600">
        <div class="flex items-center justify-center gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-blue-300 transition" onclick="sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-pic tr.row-pic').forEach(row => {
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
        let isChecked = !activeFilters[colClass] || activeFilters[colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
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
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); updateFilterIcons(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcel(); updateFilterIcons();
}
function saringTabelExcel() {
    document.querySelectorAll('.row-pic').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; highlightRow(cb); } }
    });
    updateTableDisplay();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('opacity-40', 'text-white'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
}

// ========================================================
// DISPLAY TABEL (TANPA PAGINASI)
// ========================================================
function updateTableDisplay() {
    const allRows = Array.from(document.querySelectorAll('#tbody-pic tr.row-pic'));
    let visibleCount = 0;
    
    allRows.forEach(row => { 
        if(row.classList.contains('filtered-out')) {
            row.style.display = 'none';
        } else {
            row.style.display = '';
            visibleCount++;
        }
    });
    
    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = visibleCount;
    updateSelectedCount();
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.cb-row:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
}

function highlightRow(cb) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    updateSelectedCount();
}

function toggleSemuaCentang(checked) { 
    document.querySelectorAll('.cb-row').forEach(cb => {
        const row = cb.closest('tr'); if (row && row.style.display !== 'none' && !row.classList.contains('filtered-out')) { cb.checked = checked; highlightRow(cb); }
    });
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#table-pic th');
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

// ==========================================
// SCANNING HANDLER
// ==========================================
document.getElementById('form-scan-out').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-out')); });
document.getElementById('form-scan-in').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-in')); });
document.getElementById('form-scan-pindah').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-pindah')); });

function handleScan(inputEl) {
    const rawInput = inputEl.value.trim();
    if(!rawInput) return;

    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        const isDuplicate = dataPic.some(d => d.qrcode === code);
        const trans = translateBarcode(code);
        
        dataPic.unshift({ 
            id: ++picRowId, qrcode: code, 
            status: isDuplicate ? 'DUPLIKAT LOKAL' : 'BELUM CEK',
            area: '?', ...trans, customerAktualUI: 'Cek Stok...', baseSpec: '', customerAsliDB: '-'
        });
    });

    renderTablePic(dataPic);
    inputEl.value = ''; inputEl.focus();
}

window.hapusBaris = function(qrCode) {
    dataPic = dataPic.filter(d => d.qrcode !== qrCode);
    renderTablePic(dataPic);
};

function renderTablePic(dataToRender) {
    const thead = document.getElementById('thead-pic');
    const tbody = document.getElementById('tbody-pic');
    sortState = {};

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center relative border-r border-slate-600"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"></th>
            <th class="hdr-std w-10 col-btn text-center relative border-r border-slate-600"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-slate-400"></i></th>
            ${thSort(2, 'No', 'col-no w-12')}
            ${thSort(3, 'Status', 'col-status')}
            ${thSort(4, 'Area', 'col-area')}
            ${thSort(5, 'Text QRCode', 'col-qr')}
            ${thSort(6, 'Tgl Produksi', 'col-tgl')}
            ${thSort(7, 'Mesin', 'col-mesin')}
            ${thSort(8, 'Shift', 'col-shift')}
            ${thSort(9, 'Jenis Item', 'col-jenis')}
            ${thSort(10, 'Nama Item', 'col-nama text-blue-300')}
            ${thSort(11, 'Pjg', 'col-pjg')}
            ${thSort(12, 'Grade', 'col-grade')}
            ${thSort(13, 'Dus', 'col-dus')}
            ${thSort(14, 'Shading', 'col-shading')}
            ${thSort(15, 'Customer Bawaan', 'col-customer-bawaan')}
            ${thSort(16, 'Customer Aktual (Stok)', 'col-customer-aktual text-orange-300')}
        </tr>`;

    if(dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="17" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</td></tr>';
        lucide.createIcons(); return;
    }
    
    let html = '';
    dataToRender.forEach((d, index) => {
        let badge = "bg-slate-100 text-slate-600 border-slate-200";
        if(d.status === 'VALID') badge = "bg-emerald-100 text-emerald-700 border-emerald-200";
        else if(d.status === 'KOSONG' || d.status === 'DUPLIKAT LOKAL') badge = "bg-red-100 text-red-700 border-red-200";

        let btnCustomer = d.customerAktualUI;
        if (d.status === 'VALID' && d.customerAktualUI !== '-' && d.customerAktualUI !== 'KOSONG' && d.customerAktualUI !== 'Cek Stok...') {
            btnCustomer = `<button onclick="window.bukaModalLihatCustomer('${encodeURIComponent(d.customerAktualUI)}')" class="bg-white text-slate-700 border border-slate-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1 mx-auto w-full max-w-[100px] shadow-sm"><i data-lucide="eye" class="w-3 h-3 text-slate-400"></i> Lihat Customer</button>`;
        }

        html += `
            <tr class="bg-white even:bg-slate-100 transition row-pic text-sm border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" onchange="highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 text-center col-btn border-r border-slate-200">
                    <button onclick="window.hapusBaris('${d.qrcode}')" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white border border-slate-200 p-1.5 rounded-md transition shadow-sm mx-auto flex">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="px-4 py-3 font-bold text-slate-500 text-center col-no border-r border-slate-200">${index + 1}</td>
                <td class="px-4 py-3 font-semibold text-[10px] border-r border-slate-200 col-status" data-search="${d.status}"><span class="px-2 py-1 rounded-md border ${badge}">${d.status}</span></td>
                <td class="px-4 py-3 font-semibold text-emerald-700 col-area border-r border-slate-200" data-search="${d.area}">${d.area}</td>
                <td class="px-4 py-3 font-mono font-medium text-slate-800 text-left tracking-wider border-r border-slate-200 col-qr" data-search="${d.qrcode}">${d.qrcode}</td>
                
                <td class="px-4 py-3 font-medium text-slate-700 col-tgl border-r border-slate-200" data-search="${d.tglProduksi || '-'}">${d.tglProduksi || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-mesin border-r border-slate-200" data-search="${d.mesin || '-'}">${d.mesin || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 border-r border-slate-200 col-shift" data-search="${d.shift || '-'}">${d.shift || '-'}</td>
                
                <td class="px-4 py-3 font-medium text-slate-700 col-jenis border-r border-slate-200" data-search="${d.jenisItem || '-'}">${d.jenisItem || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama border-r border-slate-200" data-search="${d.namaItem || '-'}">${d.namaItem || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg border-r border-slate-200" data-search="${d.panjang || '-'}">${d.panjang || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade border-r border-slate-200" data-search="${d.grade || '-'}">${d.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus border-r border-slate-200" data-search="${d.dus || '-'}">${d.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 border-r border-slate-200 col-shading" data-search="${d.shading || '-'}">${d.shading || '-'}</td>
                <td class="px-4 py-3 text-center font-medium text-slate-500 col-customer-bawaan border-r border-slate-200" data-search="${d.customerBawaan || '-'}">${d.customerBawaan || '-'}</td>
                <td class="px-4 py-2 text-center col-customer-aktual" data-search="${d.customerAktualUI}">${btnCustomer}</td>
            </tr>`;
    });
    tbody.innerHTML = html; 
    lucide.createIcons();
    saringTabelExcel();
    initResizableColumns();
    updateTableDisplay(); 
}

// ==========================================
// VERIFIKASI GUDANG (PINTAR OUT/IN/PINDAH)
// ==========================================
window.verifikasiGudang = async function() {
    if(dataPic.length === 0) return alert("Belum ada data untuk diverifikasi!");

    const btns = document.querySelectorAll('button[onclick="verifikasiGudang()"]');
    let originalTexts = [];
    btns.forEach((btn, idx) => { originalTexts[idx] = btn.innerHTML; btn.innerHTML = '<div class="bg-slate-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-slate-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-700 transition">Mengecek...</div>'; btn.disabled = true; });

    const allQRs = dataPic.map(d => d.qrcode);

    try {
        const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area, id_sku').in('qrcode', allQRs);
        if(error) throw error;

        let foundDb = dbQRs || [];
        let uniqueSpecs = new Set();

        if (currentMode === 'out' || currentMode === 'pindah') {
            dataPic.forEach(d => {
                let matched = foundDb.find(dbItem => dbItem.qrcode === d.qrcode);
                if (matched) {
                    d.status = 'VALID'; 
                    d.area = matched.area; 
                    d.customerAsliDB = extractCustomerFromSKU(matched.id_sku);
                    d.customerAktualUI = d.customerAsliDB; 
                    // REVISI: Tambahkan area ke baseSpec agar query stok_aktual lebih akurat
                    d.baseSpec = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}`;
                    uniqueSpecs.add(d.baseSpec);
                } else {
                    d.status = 'KOSONG'; 
                    d.customerAktualUI = '-';
                }
            });

            let customerDistMap = {};
            for (let spec of uniqueSpecs) {
                let parts = spec.split('_'); 
                // REVISI: Query stok_aktual dengan filter area juga
                const { data: actData } = await db.from('stok_aktual').select('customer_aktual, qty')
                    .eq('nama_item', parts[0]).eq('panjang', parts[1]).eq('grade', parts[2])
                    .eq('dus', parts[3]).eq('shading', parts[4]).eq('area', parts[5]);
                
                if(actData) {
                    customerDistMap[spec] = {};
                    actData.forEach(a => {
                        if(!customerDistMap[spec][a.customer_aktual]) customerDistMap[spec][a.customer_aktual] = 0;
                        customerDistMap[spec][a.customer_aktual] += a.qty;
                    });
                }
            }

            dataPic.forEach(d => { 
                if (d.status === 'VALID') {
                    let dist = customerDistMap[d.baseSpec];
                    let arr = [];
                    if(dist) {
                        for(let cust in dist) arr.push(`${cust} (${dist[cust]} Dus)`);
                    }
                    d.customerAktualUI = arr.length > 0 ? arr.join(' | ') : 'KOSONG';
                } 
            });
            
            alert(`Selesai memverifikasi fisik Gudang untuk Mode ${currentMode.toUpperCase()}!`);

        } else if (currentMode === 'in') {
            const existingQRs = foundDb.map(d => d.qrcode);
            dataPic.forEach(d => {
                if (existingQRs.includes(d.qrcode)) {
                    d.status = 'DUPLIKAT LOKAL'; 
                    d.customerAktualUI = '-';
                    d.area = 'TOLAK';
                } else {
                    d.status = 'VALID';
                    d.customerAktualUI = d.customerBawaan || '-'; 
                    d.area = 'OK'; 
                }
            });
            alert("Selesai memverifikasi fisik Gudang IN!\nBarcode yang VALID siap dimasukkan.");
        }
    } catch(err) { alert("Gagal koneksi ke Supabase: " + err.message); } 
    finally { 
        window.renderTablePic(dataPic); 
        btns.forEach((btn, idx) => { btn.innerHTML = originalTexts[idx]; btn.disabled = false; });
        lucide.createIcons();
    }
};

// ==========================================
// PROSES SIMPAN / EKSEKUSI
// ==========================================
window.bukaModalSimpan = function() {
    if (currentMode === 'out') bukaModalSimpanOut();
    else if (currentMode === 'in') eksekusiSimpanFinalIn();
    else if (currentMode === 'pindah') eksekusiPindahArea();
};

function bukaModalSimpanOut() {
    const aktifitas = document.getElementById('select-aktifitas').value;
    const keterangan = document.getElementById('input-keterangan-out').value.trim();

    if(!aktifitas) return alert("GAGAL! Anda wajib memilih Jenis Aktifitas OUT terlebih dahulu.");
    if(!keterangan) return alert("GAGAL! Anda wajib mengisi Keterangan / Alasan konversi OUT.");
    if(dataPic.length === 0) return alert("GAGAL! Belum ada item fisik yang di-scan.");

    let unverified = dataPic.filter(d => d.status !== 'VALID');
    if (unverified.length > 0) return alert("GAGAL! Terdapat barcode yang berstatus 'BELUM CEK' atau 'KOSONG'.\nHapus baris merah sebelum simpan.");

    let customerSet = new Set();
    dataPic.forEach(d => {
        if (d.customerAktualUI && d.customerAktualUI !== 'KOSONG / NON-CUSTOMER' && d.customerAktualUI !== '-' && d.customerAktualUI !== '?') {
            let parts = d.customerAktualUI.split('|');
            parts.forEach(p => {
                let custName = p.split('(')[0].trim();
                if(custName) customerSet.add(custName);
            });
        }
    });

    if (customerSet.size === 0) return alert("Barang yang Anda scan belum memiliki jatah Customer aktual di gudang untuk dikonversi OUT.");

    const sel = document.getElementById('out-customer-target');
    sel.innerHTML = '<option value="">-- PILIH CUSTOMER TARGET KONVERSI --</option>';
    Array.from(customerSet).sort().forEach(cust => { sel.innerHTML += `<option value="${cust}">${cust}</option>`; });

    document.getElementById('modal-po-target').classList.remove('hidden');
}

window.bukaModalLihatCustomer = function(encodedCusts) {
    const custStr = decodeURIComponent(encodedCusts);
    const custArr = custStr.split('|').map(p => p.trim()).filter(p => p);
    const ul = document.getElementById('list-customer-aktual');
    if (custArr.length === 0 || custArr[0] === 'KOSONG') {
        ul.innerHTML = '<li class="text-slate-400 italic font-medium p-3 bg-slate-50 rounded-md text-center border border-slate-200">Tidak ada Customer Aktual tersimpan.</li>';
    } else {
        ul.innerHTML = custArr.map(p => {
            let parts = p.split('(');
            let namaCust = parts[0].trim();
            let qtyCust = parts[1] ? parts[1].replace(')', '').trim() : '';
            return `<li class="p-3 bg-white border border-slate-200 shadow-sm text-slate-700 font-semibold rounded-md flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-slate-400"></i> <span>${namaCust}</span></div> 
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-black">${qtyCust}</span>
                    </li>`;
        }).join('');
    }
    lucide.createIcons();
    document.getElementById('modal-lihat-po').classList.remove('hidden');
};

window.eksekusiSimpanFinalOut = async function() {
    const customerTarget = document.getElementById('out-customer-target').value;
    if(!customerTarget) return alert("Wajib memilih Customer Tujuan Konversi!");

    const rawAktifitas = document.getElementById('select-aktifitas').value;
    const aktifitas = "OUT - " + rawAktifitas; 
    const keterangan = document.getElementById('input-keterangan-out').value.trim();

    const btn = document.getElementById('btn-eksekusi-final'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...'; btn.disabled = true;

    let prefix = "XX";
    if(rawAktifitas === "Ganti nama item") prefix = "NA";
    else if(rawAktifitas === "Potong panjang") prefix = "PJG";
    else if(rawAktifitas === "Ganti grade") prefix = "GR";
    else if(rawAktifitas === "Ganti dus") prefix = "DS";
    else if(rawAktifitas === "Ganti shading") prefix = "SH";
    else if(rawAktifitas === "Ganti label/qrcode") prefix = "QR";

    let stockCapacity = {}; let specsToProcess = new Set();
    dataPic.forEach(row => { if (row.status === 'VALID') specsToProcess.add(row.baseSpec); });

    try {
        for(let spec of specsToProcess) {
            let parts = spec.split('_');
            let [nm, pj, gr, ds, sh, ar] = [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]];
            const { data, error } = await db.from('stok_aktual').select('qty')
                .eq('nama_item', nm).eq('panjang', pj).eq('grade', gr).eq('dus', ds).eq('shading', sh)
                .eq('area', ar).eq('customer_aktual', customerTarget); 
            if (error) throw error;
            let count = 0; if(data) data.forEach(d => count += (d.qty || 0));
            stockCapacity[spec] = count;
        }
    } catch(e) { alert("Gagal membaca kapasitas stok_aktual: " + e.message); btn.innerHTML = ori; btn.disabled = false; return; }

    let qrList = []; let mapAktual = {}; let mapGlobal = {};
    let matchedRows = []; let unmatchedCount = 0;

    dataPic.forEach(d => {
        if (d.status === 'VALID') {
            let baseSpec = d.baseSpec;
            if(stockCapacity[baseSpec] && stockCapacity[baseSpec] > 0) {
                matchedRows.push(d); qrList.push(d.qrcode); stockCapacity[baseSpec] -= 1; 

                // REVISI: Menghapus pjg: d.panjang dari payload
                let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${customerTarget}_-`;
                if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { jenis_item: d.jenisItem, nama_item: d.namaItem, panjang: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, area: d.area, customer_aktual: customerTarget, ket: '-', qty: 0 };
                mapAktual[keyAkt].qty++;

                // REVISI: Menghapus pjg: d.panjang dari payload
                let keyGlb = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${customerTarget}_-`;
                if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { jenis_item: d.jenisItem, nama_item: d.namaItem, panjang: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, customer_bawaan: customerTarget, ket: '-', qty: 0 };
                mapGlobal[keyGlb].qty++;
            } else { unmatchedCount++; }
        } else { unmatchedCount++; }
    });

    if (qrList.length === 0) { alert(`❌ TIDAK ADA JATAH.\nSisa stok aktual untuk Customer "${customerTarget}" adalah 0.`); btn.innerHTML = ori; btn.disabled = false; return; }

    try {
        const payloadData = { qrs: qrList, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
        const { error: rpcError } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });
        if (rpcError) throw rpcError;

        const { error: errDelHL } = await db.from('hasil_langsir').delete().in('qrcode', qrList);
        if (errDelHL) throw errDelHL;

        const { count, error: errCount } = await db.from('laporan_konversi').select('*', { count: 'exact', head: true });
        if(errCount) throw errCount;
        let nextNum = (count || 0) + 1;
        let kodeKonversi = `${prefix}-${String(nextNum).padStart(5, '0')}`;
        let allQRs = qrList.join(', ');

        let arrStokKonversi = [];
        matchedRows.forEach(d => {
            arrStokKonversi.push({
                kode_konversi: kodeKonversi, aktifitas: aktifitas, qrcode: d.qrcode,
                tgl_produksi: d.tglProduksi || '-', mesin: d.mesin || '-', shift: d.shift || '-',
                jenis_item: d.jenisItem || '-', nama_item: d.namaItem || '-', panjang: d.panjang || '-',
                grade: d.grade || '-', dus: d.dus || '-', shading: d.shading || '-',
                customer_bawaan: d.customerAsliDB || '-', customer_aktual: customerTarget, keterangan: keterangan || '-',
                pic: currentUser.username, area: d.area || '-', status: 'PENDING'
            });
        });
        if(arrStokKonversi.length > 0) {
            const { error: errSk } = await db.from('stok_konversi').insert(arrStokKonversi);
            if(errSk) throw errSk;
        }

        const payloadLog = {
            kode_konversi: kodeKonversi, aktifitas: aktifitas, qrcode: allQRs,
            detail: JSON.stringify({ keterangan: keterangan || '-', customer_target: customerTarget, items: matchedRows }),
            qty_total: qrList.length, pic: currentUser.username
        };
        const { error: errInsert } = await db.from('laporan_konversi').insert([payloadLog]);
        if (errInsert) throw errInsert;

        let msg = `✅ EKSEKUSI KONVERSI OUT BERHASIL!\n\nID Audit: ${kodeKonversi}\nCustomer Target: ${customerTarget}\nBerhasil dipotong dari Kartu Stok: ${qrList.length} Dus dan dimasukkan ke Stok Konversi.`;
        if (unmatchedCount > 0) msg += `\n\n⚠️ ${unmatchedCount} dus tidak diproses karena jatah Customer kurang atau status fisik belum VALID.`;
        alert(msg);
        
        window.tutupSemuaModal(); dataPic = []; renderTablePic(dataPic);
        document.getElementById('input-keterangan-out').value = '';
        document.getElementById('select-aktifitas').value = '';

    } catch(e) { 
        alert("Kesalahan: " + e.message + "\n\nJika error ini masih muncul, mohon cek Function RPC 'eksekusi_keluar_aman' di Supabase dan pastikan tidak ada kata 'pjg' di dalamnya."); 
    } 
    finally { btn.innerHTML = ori; btn.disabled = false; }
};

window.eksekusiSimpanFinalIn = async function() {
    const kodeRef = document.getElementById('in-kode-konversi').value;
    const aktifitasRef = document.getElementById('in-aktifitas-ref').value;
    const areaTujuan = document.getElementById('in-area').value;
    const ket = document.getElementById('input-keterangan-in').value.trim() || '-';

    if(!kodeRef) return alert("Pilih Kode Konversi OUT (PILIH KODE) sebagai referensi!");
    if(!areaTujuan) return alert("Pilih Area Tujuan Gudang terlebih dahulu!");

    let validItems = dataPic.filter(d => d.status === 'VALID');
    let duplicateItems = dataPic.filter(d => d.status === 'DUPLIKAT LOKAL');
    
    if(duplicateItems.length > 0) return alert("Masih ada barcode DUPLIKAT di dalam tabel! Hapus baris merah terlebih dahulu.");
    if(validItems.length === 0) return alert("Tidak ada item VALID untuk disimpan!");

    if(!confirm(`Lanjutkan memasukkan ${validItems.length} Kardus ke stok Gudang (Area: ${areaTujuan})?\nDengan Kode Konversi: ${kodeRef}`)) return;

    const btn = document.getElementById('btn-save-awal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES IN...'; btn.disabled = true;

    let insertsStokQr = [];
    let arrStokKonversi = [];
    let mapAktual = {};

    validItems.forEach(d => {
        let customerBawaanAsli = d.customerBawaan && d.customerBawaan !== '-' ? d.customerBawaan : '-';
        let id_sku_baru = `${areaTujuan}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${customerBawaanAsli}_${ket}`;
        
        insertsStokQr.push({
            qrcode: d.qrcode,
            id_sku: id_sku_baru,
            area: areaTujuan,
            keterangan: ket
        });

        arrStokKonversi.push({
            kode_konversi: kodeRef,
            aktifitas: `IN - ${aktifitasRef}`,
            qrcode: d.qrcode,
            tgl_produksi: d.tglProduksi || '-',
            mesin: d.mesin || '-',
            shift: d.shift || '-',
            jenis_item: d.jenisItem || '-',
            nama_item: d.namaItem || '-',
            panjang: d.panjang || '-',
            grade: d.grade || '-',
            dus: d.dus || '-',
            shading: d.shading || '-',
            customer_bawaan: customerBawaanAsli,
            customer_aktual: customerBawaanAsli,
            keterangan: ket,
            pic: currentUser.username,
            area: areaTujuan,
            status: 'PENDING'
        });

        if(!mapAktual[id_sku_baru]) {
            mapAktual[id_sku_baru] = {
                id_sku: id_sku_baru,
                jenis_item: d.jenisItem,
                nama_item: d.namaItem,
                panjang: d.panjang,
                grade: d.grade,
                dus: d.dus,
                shading: d.shading,
                area: areaTujuan,
                customer_aktual: customerBawaanAsli,
                keterangan: ket,
                qty: 0
            };
        }
        mapAktual[id_sku_baru].qty++;
    });

    try {
        const { error: e1 } = await db.from('stok_qr').insert(insertsStokQr);
        if(e1) throw e1;

        const { error: e3 } = await db.from('stok_konversi').insert(arrStokKonversi);
        if(e3) throw e3;

        const payloadLog = {
            kode_konversi: kodeRef, 
            aktifitas: `IN - ${aktifitasRef}`,
            qrcode: validItems.map(d=>d.qrcode).join(', '),
            detail: JSON.stringify({ keterangan: ket, area_tujuan: areaTujuan, items: validItems }),
            qty_total: validItems.length,
            pic: currentUser.username
        };
        await db.from('laporan_konversi').insert([payloadLog]);

        for(let key in mapAktual) {
            let item = mapAktual[key];
            const { data: existing } = await db.from('stok_aktual')
                .select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).eq('keterangan', item.keterangan)
                .single();
            
            if(existing) {
                await db.from('stok_aktual').update({ qty: existing.qty + item.qty }).eq('id', existing.id);
            } else {
                await db.from('stok_aktual').insert([{...item}]);
            }
        }

        alert(`✅ BERHASIL KONVERSI IN!\n${validItems.length} dus masuk ke gudang pada area ${areaTujuan} & Saldo bertambah.`);
        dataPic = []; renderTablePic(dataPic);
        document.getElementById('in-kode-konversi').value = '';
        document.getElementById('input-keterangan-in').value = '';
        
    } catch(err) { alert("GAGAL MENYIMPAN: " + err.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
};

window.eksekusiPindahArea = async function() {
    const areaTarget = document.getElementById('pindah-area-target').value;
    if(!areaTarget) return alert("Pilih Area Simpan Tujuan terlebih dahulu!");

    let validItems = dataPic.filter(d => d.status === 'VALID');
    if(validItems.length === 0) return alert("Tidak ada item berstatus VALID (Verifikasi Gudang Dulu).");

    if(!confirm(`Pindahkan ${validItems.length} item secara permanen ke Area: ${areaTarget}?`)) return;

    const btn = document.getElementById('btn-save-awal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMINDAHKAN...'; btn.disabled = true;

    let payloadBarangPindah = [];
    let mapDeduct = {};
    let mapAdd = {};
    
    try {
        for (let item of validItems) {
            let customerBawaanAsli = item.customerAsliDB && item.customerAsliDB !== '-' ? item.customerAsliDB : '-';
            let id_sku_baru = `${areaTarget}_${item.namaItem}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${customerBawaanAsli}_Pindah Area`;
            
            let keyOld = `${item.namaItem}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${item.area}_${customerBawaanAsli}`;
            if(!mapDeduct[keyOld]) mapDeduct[keyOld] = { ...item, qty: 0 };
            mapDeduct[keyOld].qty++;

            let keyNew = `${item.namaItem}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${areaTarget}_${customerBawaanAsli}`;
            if(!mapAdd[keyNew]) mapAdd[keyNew] = { ...item, area: areaTarget, qty: 0 };
            mapAdd[keyNew].qty++;

            const { error: errUpdate } = await db.from('stok_qr').update({ area: areaTarget, id_sku: id_sku_baru }).eq('qrcode', item.qrcode);
            if (errUpdate) throw errUpdate;

            payloadBarangPindah.push({
                qrcode: item.qrcode,
                tgl_produksi: item.tglProduksi || '-',
                mesin: item.mesin || '-',
                shift: item.shift || '-',
                nama_item: item.namaItem || '-',
                panjang: item.panjang || '-',
                grade: item.grade || '-',
                dus: item.dus || '-',
                shading: item.shading || '-',
                customer: customerBawaanAsli,
                keterangan: 'Pindah Area',
                area_awal: item.area, 
                area_akhir: areaTarget,
                pic: currentUser.username
            });
        }

        if (payloadBarangPindah.length > 0) {
            const { error: errPindah } = await db.from('barang_pindah').insert(payloadBarangPindah);
            if (errPindah) throw errPindah;
        }

        for(let key in mapDeduct) {
            let item = mapDeduct[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.namaItem).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customerAsliDB).limit(1);
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty - item.qty }).eq('id', existing[0].id);
            }
        }

        for(let key in mapAdd) {
            let item = mapAdd[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.namaItem).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customerAsliDB).eq('keterangan', 'Pindah Area').limit(1);
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + item.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([{
                    id_sku: `${item.area}_${item.namaItem}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${item.customerAsliDB}_Pindah Area`,
                    jenis_item: item.jenisItem, nama_item: item.namaItem, panjang: item.panjang, grade: item.grade,
                    dus: item.dus, shading: item.shading, area: item.area, customer_aktual: item.customerAsliDB, keterangan: 'Pindah Area', qty: item.qty
                }]);
            }
        }

        alert(`✅ SUKSES PINDAH AREA!\n${validItems.length} Item berhasil dipindahkan ke area ${areaTarget}.`);
        dataPic = []; renderTablePic(dataPic);
        document.getElementById('pindah-area-target').value = '';

    } catch(e) {
        alert("GAGAL PINDAH AREA: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.bukaModalRiwayatPindah = async function() {
    const tbody = document.getElementById('tbody-riwayat-pindah');
    tbody.innerHTML = `<tr><td colspan="12" class="p-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-indigo-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-riwayat-pindah').classList.remove('hidden');

    try {
        const { data, error } = await db.from('barang_pindah').select('*').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="12" class="p-10 font-bold text-slate-400 text-center">Tidak ada riwayat pindah area.</td></tr>`; return; }

        let h = '';
        data.forEach((d, i) => {
            const dt = new Date(d.created_at);
            const waktu = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            
            h += `
                <tr class="border-b hover:bg-slate-50 text-xs transition text-center">
                    <td class="p-2 font-medium text-slate-500">${i+1}</td>
                    <td class="p-2 font-medium text-slate-600">${waktu}</td>
                    <td class="p-2 font-bold text-indigo-600 bg-indigo-50 border-r border-slate-200">${d.area_awal} ➔ ${d.area_akhir}</td>
                    <td class="p-2 font-mono font-medium tracking-wider text-slate-800 border-r border-slate-200">${d.qrcode}</td>
                    <td class="p-2 font-semibold text-blue-600 text-left">${d.nama_item}</td>
                    <td class="p-2 font-medium text-slate-700">${d.panjang}</td>
                    <td class="p-2 font-medium text-slate-700">${d.grade}</td>
                    <td class="p-2 font-medium text-slate-700">${d.dus}</td>
                    <td class="p-2 font-medium text-slate-700 border-r border-slate-200">${d.shading}</td>
                    <td class="p-2 font-semibold text-orange-600">${d.customer}</td>
                    <td class="p-2 font-medium text-slate-500 text-left border-r border-slate-200">${d.keterangan || '-'}</td>
                    <td class="p-2 uppercase opacity-70 font-bold text-slate-500">${d.pic}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch(e) { tbody.innerHTML = `<tr><td colspan="12" class="p-5 text-red-500 text-center">${e.message}</td></tr>`; }
    finally { lucide.createIcons(); }
};
