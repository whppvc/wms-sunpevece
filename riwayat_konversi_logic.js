let dataRiwayatRaw = [];
let modeTabAktif = 'PROSES'; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 8;
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_mutasi', title: 'RIWAYAT KONVERSI', url: 'riwayat_konversi.html' });
    
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

    muatDataRiwayat();
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

async function muatDataRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-xs">Menarik histori dari laporan_konversi...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('laporan_konversi').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        dataRiwayatRaw = data || [];
        gantiModeTab(modeTabAktif); 
    } catch (error) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-center text-red-500 font-bold text-xs uppercase">Gagal memuat data: ${error.message}</td></tr>`;
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

function gantiModeTab(mode) {
    modeTabAktif = mode;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    document.getElementById('tab-proses').className = (mode === 'PROSES') ? activeClass : inactiveClass;
    document.getElementById('tab-done').className = (mode === 'DONE') ? activeClass : inactiveClass;

    document.getElementById('btn-done-konv').classList.toggle('hidden', mode === 'DONE');
    document.getElementById('btn-batal-done').classList.toggle('hidden', mode === 'PROSES');

    activeFilters = {}; updateFilterIcons(); currentPage = 1;
    
    renderTabelUtama();
}

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
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    const justifyClass = noFilter ? 'justify-center' : 'justify-start';

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center ${justifyClass} gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-blue-300 transition" onclick="sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

function renderTabelUtama() {
    const thead = document.getElementById('thead-riwayat');
    const tbody = document.getElementById('tbody-riwayat');
    if(!thead || !tbody) return;

    const dataset = dataRiwayatRaw.filter(r => {
        let statusDB = r.status || 'PROSES';
        return (modeTabAktif === 'PROSES') ? statusDB !== 'DONE' : statusDB === 'DONE';
    });

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleCentangSemua(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded"></th>
            ${thSort(1, 'Waktu', 'col-waktu')}
            ${thSort(2, 'Kode Konversi', 'col-kode')}
            ${thSort(3, 'Aktifitas', 'col-aktifitas')}
            ${thSort(4, 'Keterangan', 'col-ket')}
            ${thSort(5, 'Detail Item', 'col-detail')}
            ${thSort(6, 'Total Dus', 'col-qty')}
            ${thSort(7, 'PIC', 'col-pic')}
            <th class="hdr-std col-btn text-center">Action</th>
        </tr>`;

    if(dataset.length === 0) {
        tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="9" class="p-10 text-center font-bold text-slate-400 text-xs uppercase">Tidak ada data di tab ${modeTabAktif}.</td></tr>`;
        applyPagination(); return;
    }

    let h = '';
    dataset.forEach((r) => {
        const pd = parseDetail(r.detail);
        const d = new Date(r.created_at);
        const tglStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        h += `
            <tr class="transition r-row text-sm">
                <td class="px-4 py-4 text-center col-cb">
                    <input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300" onchange="highlightRow(this)" data-id="${r.id}" data-kode="${r.kode_konversi}">
                </td>
                <td class="px-4 py-4 font-medium text-slate-700 text-left col-waktu" data-search="${tglStr}">${tglStr}</td>
                <td class="px-4 py-4 font-black text-blue-700 text-left col-kode" data-search="${r.kode_konversi}">${r.kode_konversi || '-'}</td>
                <td class="px-4 py-4 font-black text-rose-600 uppercase text-left col-aktifitas" data-search="${r.aktifitas}">${r.aktifitas || '-'}</td>
                <td class="px-4 py-4 font-medium text-slate-600 text-left whitespace-normal min-w-[150px] leading-relaxed col-ket" data-search="${pd.ket}">${pd.ket}</td>
                <td class="px-4 py-4 font-medium text-slate-600 text-left whitespace-normal min-w-[200px] leading-relaxed col-detail" data-search="${pd.rangkuman}">${pd.rangkuman}</td>
                <td class="px-4 py-4 font-black text-emerald-700 text-center col-qty" data-search="${r.qty_total}">${r.qty_total || 0}</td>
                <td class="px-4 py-4 font-medium text-slate-500 uppercase text-left col-pic" data-search="${r.pic}">${r.pic || '-'}</td>
                <td class="px-4 py-4 col-btn text-center">
                    <button onclick="bukaModalDetail('${r.id}')" class="p-1.5 px-3 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-[10px] uppercase rounded-md shadow-sm transition flex mx-auto items-center justify-center gap-1">
                        <i data-lucide="list-collapse" class="w-3 h-3"></i> Detail
                    </button>
                </td>
            </tr>`;
    });
    
    tbody.innerHTML = h;
    lucide.createIcons();
    saringTabelExcel(); 
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

function changeRowsPerPage(val) {
    if (val === 'ALL') { rowsPerPage = 999999; } 
    else { rowsPerPage = parseInt(val); }
    currentPage = 1; applyPagination();
}

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

async function eksekusiDoneKonversi() {
    const cbs = document.querySelectorAll('.cb-row:checked');
    if(cbs.length === 0) return alert("Pilih minimal 1 baris konversi di tabel PROSES.");
    if(!confirm(`Menandai konversi sebagai DONE?\nSemua log dengan kode konversi yang sama akan ikut dipindah.`)) return;

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
                <td class="p-2 font-bold text-slate-400 text-center">${i + 1}</td>
                <td class="p-2 font-mono font-bold text-[10px] text-left">${d.qrcode}</td>
                <td class="p-2 font-bold text-left">${d.tglProduksi || '-'}</td>
                <td class="p-2 font-bold text-left">${d.mesin || '-'}</td>
                <td class="p-2 font-bold text-left">${d.shift || '-'}</td>
                <td class="p-2 font-bold text-left text-slate-800">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold text-left">${d.panjang || '-'}</td>
                <td class="p-2 font-bold text-left">${d.grade || '-'}</td>
                <td class="p-2 font-bold text-left">${d.dus || '-'}</td>
                <td class="p-2 font-bold text-left">${d.shading || '-'}</td>
                <td class="p-2 text-left font-bold text-slate-400">${d.poAsliDB || '-'}</td>
                <td class="p-2 text-left font-black text-orange-600 bg-orange-50">${pd.po_target}</td>
            </tr>`;
    });

    tbody.innerHTML = html;
    document.getElementById('modal-detail').classList.remove('hidden');
}
