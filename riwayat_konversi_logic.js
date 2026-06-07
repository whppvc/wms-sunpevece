let dataRiwayatRaw = [];
let modeTabAktif = 'PROSES'; 
let sortState = {}; 

// Variabel Paginasi Kencang & Filter Excel
let currentPage = 1;
const rowsPerPage = 8;
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_konversi', title: 'RIWAYAT KONVERSI', url: 'riwayat_konversi.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
    });

    muatDataRiwayat();
});

// ========================================================
// 1. FETCH DATA DARI SUPABASE & PARSING
// ========================================================
async function muatDataRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-xs">Menarik histori dari laporan_konversi...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('laporan_konversi').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        dataRiwayatRaw = data || [];
        gantiModeTab(modeTabAktif); // Render based on current tab
    } catch (error) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-red-500 font-bold text-xs uppercase">Gagal memuat data: ${error.message}</td></tr>`;
    }
}

function parseDetail(detailString) {
    let res = { ket: detailString, po_target: '-', items: [], rangkuman: 'Format Lama (Tanpa Rincian)' };
    try {
        let parsed = JSON.parse(detailString);
        if (parsed && parsed.items) {
            res.ket = parsed.keterangan || '-';
            res.po_target = parsed.po_target || '-';
            res.items = parsed.items;
            
            let mapItem = {};
            parsed.items.forEach(d => {
                let namaLengkap = `${d.namaItem} ${d.panjang} ${d.grade} ${d.dus} ${d.shading}`;
                mapItem[namaLengkap] = (mapItem[namaLengkap] || 0) + 1;
            });
            let txt = [];
            for (let k in mapItem) txt.push(`${k} (${mapItem[k]} Dus)`);
            res.rangkuman = txt.join(', ');
        }
    } catch(e) {} 
    return res;
}

// ========================================================
// 2. NAVIGASI TAB & PENGATURAN UI
// ========================================================
function gantiModeTab(mode) {
    modeTabAktif = mode;
    
    // UI Tab Styling
    const activeClass = 'px-6 py-3.5 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2 text-blue-700 bg-blue-50 border-b-4 border-blue-700';
    const inactiveClass = 'px-6 py-3.5 font-bold text-xs uppercase transition whitespace-nowrap flex items-center gap-2 text-slate-500 border-b-4 border-transparent hover:text-slate-800 hover:bg-slate-50 bg-white';
    
    document.getElementById('tab-proses').className = (mode === 'PROSES') ? activeClass : inactiveClass;
    document.getElementById('tab-done').className = (mode === 'DONE') ? activeClass : inactiveClass;

    // Toggle Buttons based on Tab
    document.getElementById('btn-done-konv').classList.toggle('hidden', mode === 'DONE');
    document.getElementById('btn-batal-done').classList.toggle('hidden', mode === 'PROSES');

    // Reset Filters & Pagination state
    activeFilters = {}; updateFilterIcons(); currentPage = 1;
    
    renderTabelUtama();
}

// ========================================================
// 3. SORTING HEADER ALA EXCEL
// ========================================================
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
    const noFilter = ['col-cb', 'col-btn'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-600 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    return `<th class="hdr-std ${cls} hover:bg-slate-700 transition select-none">
        <div class="flex items-center justify-center">
            <span class="cursor-pointer flex items-center gap-1.5" onclick="sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

// ========================================================
// 4. RENDER TABEL & PAGINASI KENCANG
// ========================================================
function renderTabelUtama() {
    const thead = document.getElementById('thead-riwayat');
    const tbody = document.getElementById('tbody-riwayat');
    if(!thead || !tbody) return;

    // Filter Data by Tab Status
    const dataset = dataRiwayatRaw.filter(r => {
        let statusDB = r.status || 'PROSES';
        return (modeTabAktif === 'PROSES') ? statusDB !== 'DONE' : statusDB === 'DONE';
    });

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb border-r border-slate-500"><input type="checkbox" onchange="toggleCentangSemua(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded"></th>
            ${thSort(1, 'Waktu', 'col-waktu border-r border-slate-500')}
            ${thSort(2, 'Kode Konversi', 'col-kode text-blue-300 border-r border-slate-500')}
            ${thSort(3, 'Aktifitas', 'col-aktifitas text-rose-300 border-r border-slate-500')}
            ${thSort(4, 'Keterangan', 'col-ket text-left pl-3 border-r border-slate-500')}
            ${thSort(5, 'Detail Item', 'col-detail text-left pl-3 border-r border-slate-500')}
            ${thSort(6, 'Total Dus', 'col-qty text-emerald-300 border-r border-slate-500')}
            ${thSort(7, 'PIC', 'col-pic border-r border-slate-500')}
            <th class="hdr-std col-btn">Action</th>
        </tr>`;

    if(dataset.length === 0) {
        tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="9" class="p-10 font-bold text-slate-400 text-xs uppercase">Tidak ada data di tab ${modeTabAktif}.</td></tr>`;
        applyPagination(); return;
    }

    let h = '';
    dataset.forEach((r) => {
        const pd = parseDetail(r.detail);
        const d = new Date(r.created_at);
        const tglStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        h += `
            <tr class="hover:bg-slate-100 transition r-row text-[11px] bg-white border-b border-slate-200">
                <td class="p-3 col-cb border-r border-slate-200">
                    <input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300" onchange="highlightRow(this)" data-id="${r.id}" data-kode="${r.kode_konversi}">
                </td>
                <td class="p-3 font-semibold text-slate-600 text-center col-waktu border-r border-slate-200" data-search="${tglStr}">${tglStr}</td>
                <td class="p-3 font-black text-blue-700 bg-blue-50/50 text-center col-kode border-r border-slate-200" data-search="${r.kode_konversi}">${r.kode_konversi || '-'}</td>
                <td class="p-3 font-black text-rose-600 uppercase text-center col-aktifitas border-r border-slate-200" data-search="${r.aktifitas}">${r.aktifitas || '-'}</td>
                <td class="p-3 font-semibold text-slate-600 text-left whitespace-normal min-w-[150px] leading-relaxed col-ket border-r border-slate-200" data-search="${pd.ket}">${pd.ket}</td>
                <td class="p-3 font-semibold text-slate-600 text-left whitespace-normal min-w-[200px] leading-relaxed col-detail border-r border-slate-200" data-search="${pd.rangkuman}">${pd.rangkuman}</td>
                <td class="p-3 font-black text-emerald-800 bg-emerald-50 text-center col-qty border-r border-slate-200 text-sm" data-search="${r.qty_total}">${r.qty_total || 0}</td>
                <td class="p-3 font-black text-slate-800 uppercase text-center col-pic border-r border-slate-200" data-search="${r.pic}">${r.pic || '-'}</td>
                <td class="p-3 col-btn text-center">
                    <button onclick="bukaModalDetail('${r.id}')" class="p-1.5 px-3 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-[10px] uppercase rounded shadow-sm transition flex mx-auto items-center justify-center gap-1">
                        <i data-lucide="list-collapse" class="w-3 h-3"></i> Detail
                    </button>
                </td>
            </tr>`;
    });
    
    tbody.innerHTML = h;
    lucide.createIcons();
    saringTabelExcel(); // Will automatically trigger pagination
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; 
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    let sumQty = 0;

    visibleRows.forEach((row, index) => {
        const qtyCell = row.querySelector('.col-qty');
        if (qtyCell) sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    const emptyRow = document.getElementById('empty-row-langsir');
    if(emptyRow) emptyRow.style.display = totalFiltered === 0 ? '' : 'none';

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
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
function toggleCentangSemua(checked) { 
    document.querySelectorAll('.cb-row').forEach(cb => {
        const row = cb.closest('tr'); if (row && row.style.display !== 'none' && !row.classList.contains('filtered-out')) { cb.checked = checked; highlightRow(cb); }
    });
}
function highlightRow(cb) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    updateSelectedCount();
}

// ========================================================
// 5. FILTER EXCEL LOGIC
// ========================================================
function openColumnFilter(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `FILTER: ${colName}`;
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
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; highlightRow(cb); } }
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
// 6. ACTION: DONE & KEMBALI KE PROSES
// ========================================================
async function eksekusiDoneKonversi() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    if(cbs.length === 0) return alert("Pilih minimal 1 baris konversi di tabel PROSES.");
    if(!confirm(`Menandai konversi sebagai DONE?\nSemua log dengan kode konversi yang sama akan ikut dipindah.`)) return;

    // Kumpulkan kode unik agar sistem memindah semua dengan kode yang sama
    let setKode = new Set();
    cbs.forEach(cb => setKode.add(cb.getAttribute('data-kode')));
    const arrKode = Array.from(setKode);

    try {
        const { error } = await db.from('laporan_konversi').update({ status: 'DONE' }).in('kode_konversi', arrKode);
        if(error) throw error;
        
        alert("Konversi telah dipindah ke tab DONE.");
        muatDataRiwayat(); 
    } catch(e) { alert("Error update status: " + e.message); }
}

async function eksekusiKembaliKeProses() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    if(cbs.length === 0) return alert("Pilih minimal 1 baris di tabel DONE.");
    if(!confirm(`Cancel status Done?\nKode konversi yang dipilih akan dikembalikan ke tab PROSES.`)) return;

    let setKode = new Set();
    cbs.forEach(cb => setKode.add(cb.getAttribute('data-kode')));
    const arrKode = Array.from(setKode);

    try {
        const { error } = await db.from('laporan_konversi').update({ status: 'PROSES' }).in('kode_konversi', arrKode);
        if(error) throw error;
        
        alert("Konversi telah dikembalikan ke PROSES.");
        muatDataRiwayat(); 
    } catch(e) { alert("Error update status: " + e.message); }
}

// ========================================================
// 7. ACTION: CANCEL KE STOK & COPY EXCEL
// ========================================================
function bukaModalCancel() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    if (cbs.length === 0) return alert("Centang baris konversi yang ingin dibatalkan & dikembalikan fisik kardusnya ke Stok.");
    document.getElementById('modal-cancel').classList.remove('hidden');
}

async function eksekusiCancelKonversi() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    let idsToDelete = Array.from(cbs).map(cb => cb.getAttribute('data-id'));

    const btn = document.getElementById('btn-eksekusi-cancel');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Proses...';
    btn.disabled = true;

    try {
        const { data: logs, error: errLogs } = await db.from('laporan_konversi').select('kode_konversi, aktifitas').in('id', idsToDelete);
        if (errLogs) throw errLogs;
        const kodeList = logs.map(l => l.kode_konversi);

        const { data: dataKonversi, error: errTarik } = await db.from('stok_konversi').select('*').in('kode_konversi', kodeList);
        if (errTarik) throw errTarik;

        let arrRestoreFisik = [];
        let mapRestoreAktual = {};
        let mapRestoreGlobal = {};

        dataKonversi.forEach(d => {
            const logInduk = logs.find(l => l.kode_konversi === d.kode_konversi);
            
            if (logInduk && logInduk.aktifitas.startsWith('OUT')) {
                const sku = `${d.area}_${d.jenis_item}_${d.nama_item}_${d.pjg}_${d.grade}_${d.dus}_${d.shading}_${d.po_bawaan}`;
                
                arrRestoreFisik.push({ qrcode: d.qrcode, area: d.area, id_sku: sku, pic_input: currentUser.username });

                let keyAkt = `${d.nama_item}_${d.pjg}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.po_aktual}_-`;
                if(!mapRestoreAktual[keyAkt]) mapRestoreAktual[keyAkt] = { jenis_item: d.jenis_item, nama_item: d.nama_item, pjg: d.pjg, grade: d.grade, dus: d.dus, shading: d.shading, area: d.area, po_aktual: d.po_aktual, ket: '-', qty: 0 };
                mapRestoreAktual[keyAkt].qty++;

                let keyGlb = `${d.nama_item}_${d.pjg}_${d.grade}_${d.dus}_${d.shading}_${d.po_bawaan}_-`;
                if(!mapRestoreGlobal[keyGlb]) mapRestoreGlobal[keyGlb] = { jenis_item: d.jenis_item, nama_item: d.nama_item, pjg: d.pjg, grade: d.grade, dus: d.dus, shading: d.shading, po_bawaan: d.po_bawaan, ket: '-', qty: 0 };
                mapRestoreGlobal[keyGlb].qty++;
            }
        });

        if (arrRestoreFisik.length > 0) {
            const payloadData = { qrs: arrRestoreFisik, aktuals: Object.values(mapRestoreAktual), globals: Object.values(mapRestoreGlobal) };
            const { error: rpcErr } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });
            if (rpcErr) throw rpcErr;
        }

        if (kodeList.length > 0) {
            await db.from('stok_konversi').delete().in('kode_konversi', kodeList);
        }
        const { error: delErr } = await db.from('laporan_konversi').delete().in('id', idsToDelete);
        if (delErr) throw delErr;

        alert(`SUKSES DIBATALKAN!\nFisik Stok telah dikembalikan ke Area.`);
        document.getElementById('modal-cancel').classList.add('hidden');
        muatDataRiwayat(); 
        
    } catch (e) { alert("Gagal membatalkan konversi. Error: " + e.message);
    } finally { btn.innerHTML = ori; btn.disabled = false; }
}

function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked'); if(cek.length === 0) return alert("Pilih baris tabel yang ingin disalin!");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-riwayat th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(!td.classList.contains('col-cb') && !td.classList.contains('col-btn') && window.getComputedStyle(td).display !== 'none') rowData.push(td.innerText.trim().replace(/\n/g, ' '));
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => alert("Berhasil disalin! Silahkan Paste (CTRL+V) di Excel/Notepad."));
}

// ========================================================
// 8. POPUP DETAIL ITEM FISIK
// ========================================================
function bukaModalDetail(id) {
    const row = dataRiwayatRaw.find(r => r.id == id);
    if (!row) return;

    const pd = parseDetail(row.detail);
    if (pd.items.length === 0) return alert("Data ini menggunakan format lama (Plain Text). Detail item spesifik tidak terekam di JSON.");

    document.getElementById('title-kode-detail').innerText = `[${row.kode_konversi}]`;
    const tbody = document.getElementById('tbody-modal-detail');
    let html = '';

    pd.items.forEach((d, i) => {
        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-[11px]">
                <td class="p-2 font-bold text-slate-400">${i + 1}</td>
                <td class="p-2 font-mono font-bold text-[10px] border-r border-slate-200">${d.qrcode}</td>
                <td class="p-2 font-bold">${d.tglProduksi || '-'}</td>
                <td class="p-2 font-bold">${d.mesin || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shift || '-'}</td>
                <td class="p-2 font-bold text-left text-slate-800">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold">${d.panjang || '-'}</td>
                <td class="p-2 font-bold">${d.grade || '-'}</td>
                <td class="p-2 font-bold">${d.dus || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shading || '-'}</td>
                <td class="p-2 text-center font-bold text-slate-400">${d.poAsliDB || '-'}</td>
                <td class="p-2 text-center font-black text-orange-600 bg-orange-50 border-l border-slate-200">${pd.po_target}</td>
            </tr>`;
    });

    tbody.innerHTML = html;
    document.getElementById('modal-detail').classList.remove('hidden');
}
