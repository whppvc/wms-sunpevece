let currentMode = 'input';
let stagingData = [];
let dbRecordsRaw = [];
let masterKamus = [];
let stagingRowId = 0;
let sortState = {};

// Paginasi & Filter State
let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || { username: 'Admin' };

document.addEventListener('DOMContentLoaded', async () => {
    // REVISI: Ubah id dan url sesuai dengan nama file baru
    initModernLayout({ id: 'po', title: 'PO & ESTIMASI', url: 'po.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
    });

    await ambilReferensiMaster2();
    renderHeaderDanTabel();
});

function toggleInputPO() {
    const body = document.getElementById('body-input-po');
    const icon = document.getElementById('icon-toggle-input');
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.classList.remove('rotate-180');
    } else {
        body.classList.add('hidden');
        icon.classList.add('rotate-180');
    }
}

async function ambilReferensiMaster2() {
    try {
        const { data, error } = await db.from('master_2').select('*');
        if (error) throw error; 
        masterKamus = data || [];
        
        const namaSet = [...new Set(masterKamus.map(x => (x.nama_item || '').trim()).filter(Boolean))].sort();
        const gradeSet = [...new Set(masterKamus.map(x => (x.grade || '').trim()).filter(Boolean))].sort();
        const customerSet = [...new Set(masterKamus.map(x => (x.customer || '').trim()).filter(Boolean))].sort();
        const dusSet = [...new Set(masterKamus.map(x => (x.dus || '').trim()).filter(Boolean))].sort();

        isiDropdown('in-nama-item', namaSet, '-- Pilih Item --');
        isiDropdown('in-grade', gradeSet, '-- Pilih Grade --');
        isiDropdown('in-customer-po', customerSet, '-- Pilih Customer --');
        isiDropdown('in-dus', dusSet, '-- Pilih Dus --');
    } catch (e) { console.error("Gagal memuat dropdown acuan:", e.message); }
}

function isiDropdown(elId, dataArray, placeholderText) {
    const el = document.getElementById(elId); if (!el) return;
    let html = `<option value="">${placeholderText}</option>`;
    dataArray.forEach(val => html += `<option value="${val}">${val}</option>`); el.innerHTML = html;
}

function switchTab(mode) {
    currentMode = mode;
    document.getElementById('view-input').classList.toggle('hidden', mode !== 'input');
    document.getElementById('footer-input').classList.toggle('hidden', mode !== 'input');
    
    document.getElementById('footer-tabel').classList.toggle('hidden', mode !== 'tabel');
    
    document.getElementById('tab-input').className = mode === 'input' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    document.getElementById('tab-tabel').className = mode === 'tabel' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    activeFilters = {};
    if (mode === 'tabel') {
        muatDataEstimasiDB();
    } else {
        renderHeaderDanTabel();
    }
}

function addEstimasiLokal() {
    const kodePo = document.getElementById('in-kode-po').value.trim().toUpperCase();
    const customerPo = document.getElementById('in-customer-po').value;
    const nama = document.getElementById('in-nama-item').value; 
    let pjg = document.getElementById('in-panjang').value.trim();
    const grade = document.getElementById('in-grade').value; 
    const dus = document.getElementById('in-dus').value; 
    const qtyPo = document.getElementById('in-qty-po').value.trim();
    const note = document.getElementById('in-note').value.trim();

    if (!kodePo || !customerPo || !nama || !pjg || !grade || !dus || !qtyPo) return alert("PERHATIAN: Semua kolom wajib diisi kecuali Note!");
    if (pjg && !pjg.toUpperCase().endsWith('M')) pjg = pjg + "M"; else pjg = pjg.toUpperCase();

    const now = new Date();
    const timeString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    stagingData.unshift({ 
        id: ++stagingRowId, 
        created_at: timeString,
        kode_po: kodePo, 
        customer_po: customerPo, 
        nama_item: nama, 
        panjang: pjg, 
        grade: grade, 
        dus: dus,
        qty_po: qtyPo, 
        note: note || '-' 
    });
    
    renderHeaderDanTabel();
    
    // Reset form
    document.getElementById('in-nama-item').value = ''; 
    document.getElementById('in-panjang').value = ''; 
    document.getElementById('in-grade').value = ''; 
    document.getElementById('in-dus').value = ''; 
    document.getElementById('in-qty-po').value = ''; 
    document.getElementById('in-note').value = '';
}

function hapusBarisStaging(id) { 
    stagingData = stagingData.filter(d => d.id !== id); 
    renderHeaderDanTabel(); 
}

async function hapusMassalPO() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if (checkedBoxes.length === 0) return alert("Centang minimal 1 baris PO yang ingin dihapus!");
    
    if (!confirm(`Apakah Anda yakin ingin menghapus ${checkedBoxes.length} data PO ini secara permanen?`)) return;

    const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
    
    const btn = document.getElementById('btn-hapus-po');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menghapus...';
    btn.disabled = true;

    try {
        const { error } = await db.from('po_estimasi').delete().in('id', idsToDelete);
        if (error) throw error;
        
        alert("Data PO berhasil dihapus!");
        muatDataEstimasiDB();
    } catch (e) {
        alert("Gagal menghapus data: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
}

function toggleAllStaging(checked) { 
    document.querySelectorAll('.cb-row').forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') cb.checked = checked;
    }); 
}

async function simpanMassalKeDatabase() {
    if (stagingData.length === 0) return alert("Tabel penampungan masih kosong!");
    const btn = document.getElementById('btn-submit-db'); const oriText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENYIMPAN...'; btn.disabled = true;

    // Default date to bypass not-null constraint
    const defaultDate = new Date().toISOString().split('T')[0];

    const payload = stagingData.map(d => ({ 
        tgl_estimasi_kirim: defaultDate,
        kode_po: d.kode_po, 
        customer_po: d.customer_po, 
        nama_item: d.nama_item, 
        panjang: d.panjang, 
        grade: d.grade, 
        dus: d.dus,
        qty_po: d.qty_po, 
        qty_terpenuhi: 0,
        note: d.note, 
        pic: currentUser.username 
    }));
    
    try {
        const { error } = await db.from('po_estimasi').insert(payload);
        if (error) throw error; 
        alert(`🚀 BERHASIL! ${payload.length} data PO sukses masuk database server.`);
        stagingData = []; 
        renderHeaderDanTabel();
    } catch (e) { 
        alert("GAGAL INSERT: " + e.message); 
    } finally { 
        btn.innerHTML = oriText; btn.disabled = false; lucide.createIcons(); 
    }
}

async function muatDataEstimasiDB() {
    const tbody = document.getElementById('tbody-po');
    tbody.innerHTML = `<tr><td colspan="12" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data PO...</p></td></tr>`;
    lucide.createIcons();
    
    try {
        const { data, error } = await db.from('po_estimasi').select('*').order('created_at', { ascending: false });
        if (error) throw error; 
        dbRecordsRaw = data || [];
        renderHeaderDanTabel();
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="12" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`; 
    }
}

// ========================================================
// SORTING & FILTER EXCEL PRO
// ========================================================
function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-po');
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
    
    document.querySelectorAll('#tbody-po tr.r-row').forEach(row => {
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
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; } }
    });
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
// PAGINASI & RENDER TABEL
// ========================================================
function changeRowsPerPage(val) {
    if (val === 'ALL') { rowsPerPage = 999999; } 
    else { rowsPerPage = parseInt(val); }
    currentPage = 1; applyPagination();
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-po tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    
    let sumQty = 0;
    let uniquePOs = new Set();

    visibleRows.forEach((row, index) => {
        const qtyCell = row.querySelector('.col-qty');
        const poCell = row.querySelector('.col-kode_po');
        
        if (qtyCell) sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 
        if (poCell) uniquePOs.add(poCell.getAttribute('data-search') || poCell.innerText);

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-total-kodepo')) document.getElementById('lbl-total-kodepo').innerText = uniquePOs.size;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-po tr.r-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#main-table th');
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

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-po');
    const tbody = document.getElementById('tbody-po');
    sortState = {}; 

    let dataset = currentMode === 'input' ? stagingData : dbRecordsRaw;

    let thHtml = `<tr>
        <th class="hdr-std w-10 col-cb text-center relative border-r border-slate-600">PILIH<br><input type="checkbox" onchange="toggleAllStaging(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"></th>`;
    
    if (currentMode === 'input') {
        thHtml += `<th class="hdr-std w-10 col-btn text-center relative border-r border-slate-600"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-rose-400"></i></th>
        ${thSort(2, 'No', 'col-no w-12')}
        ${thSort(3, 'Kode PO', 'col-kode_po')}
        ${thSort(4, 'Customer PO', 'col-customer_po')}
        ${thSort(5, 'Nama Item', 'col-nama text-blue-300')}
        ${thSort(6, 'Panjang', 'col-pjg')}
        ${thSort(7, 'Grade', 'col-grade')}
        ${thSort(8, 'Dus', 'col-dus')}
        ${thSort(9, 'QTY PO', 'col-qty text-orange-300')}
        ${thSort(10, 'Note', 'col-note')}`;
    } else {
        thHtml += `${thSort(1, 'No', 'col-no w-12')}
        ${thSort(2, 'Kode PO', 'col-kode_po')}
        ${thSort(3, 'Customer PO', 'col-customer_po')}
        ${thSort(4, 'Nama Item', 'col-nama text-blue-300')}
        ${thSort(5, 'Panjang', 'col-pjg')}
        ${thSort(6, 'Grade', 'col-grade')}
        ${thSort(7, 'Dus', 'col-dus')}
        ${thSort(8, 'QTY PO', 'col-qty text-orange-300')}
        ${thSort(9, 'QTY TERPENUHI', 'col-qty_terpenuhi text-emerald-300')}
        ${thSort(10, 'Note', 'col-note')}
        ${thSort(11, 'PIC', 'col-pic')}`;
    }
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;
    
    if(dataset.length === 0) { 
        let msg = currentMode === 'input' ? 'Belum ada data ditambahkan ke tabel sementara.' : 'Tidak ada data PO di database.';
        tbody.innerHTML = `<tr><td colspan="12" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> ${msg}</td></tr>`; 
        applyPagination(); return; 
    }
    
    let h = '';
    dataset.forEach((r, i) => {
        // Format tanggal untuk input (karena belum masuk DB, formatnya masih string lokal)
        let tglStr = currentMode === 'input' ? r.created_at : formatTglIntl(r.created_at);
        
        let noUrut = currentMode === 'input' ? (dataset.length - i) : (i + 1);
        
        let btnHapus = currentMode === 'input' 
            ? `<button onclick="hapusBarisStaging(${r.id})" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
            : '';

        h += `
            <tr class="hover:bg-slate-50 transition r-row text-sm">
                <td class="px-4 py-3 text-center col-cb border-b border-r border-slate-200"><input type="checkbox" value="${r.id}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                ${currentMode === 'input' ? `<td class="px-4 py-3 text-center col-btn border-b border-r border-slate-200">${btnHapus}</td>` : ''}
                <td class="px-4 py-3 font-bold text-slate-500 text-center col-no border-b border-r border-slate-200">${noUrut}</td>
                <td class="px-4 py-3 font-black text-slate-800 tracking-wider col-kode_po border-b border-r border-slate-200" data-search="${r.kode_po}">${r.kode_po}</td>
                <td class="px-4 py-3 font-bold text-slate-700 col-customer_po border-b border-r border-slate-200" data-search="${r.customer_po}">${r.customer_po}</td>
                <td class="px-4 py-3 font-bold text-blue-700 text-left col-nama border-b border-r border-slate-200" data-search="${r.nama_item}">${r.nama_item}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg border-b border-r border-slate-200" data-search="${r.panjang}">${r.panjang}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade border-b border-r border-slate-200" data-search="${r.grade}">${r.grade}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus border-b border-r border-slate-200" data-search="${r.dus}">${r.dus}</td>
                <td class="px-4 py-3 font-black text-orange-600 bg-orange-50/50 col-qty border-b border-r border-slate-200" data-search="${r.qty_po}">${r.qty_po}</td>
                ${currentMode === 'tabel' ? `<td class="px-4 py-3 font-black text-emerald-600 bg-emerald-50/50 col-qty_terpenuhi border-b border-r border-slate-200" data-search="${r.qty_terpenuhi || 0}">${r.qty_terpenuhi || 0}</td>` : ''}
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket border-b border-r border-slate-200" data-search="${r.note || '-'}">${r.note || '-'}</td>
                ${currentMode === 'tabel' ? `<td class="px-4 py-3 font-bold uppercase text-xs text-slate-400 col-pic border-b border-slate-200" data-search="${r.pic || '-'}">${r.pic || '-'}</td>` : ''}
            </tr>`;
    });
    tbody.innerHTML = h;
    lucide.createIcons(); 
    saringTabelExcel();
    initResizableColumns();
}
