let modeRiwayat = 'qr'; 
let logLangsirRaw = []; let holdLangsirRaw = [];
let kamusData = []; let areaData = []; 
let sortState = {}; 

// Variabel Paginasi Kencang & Filter Excel Pro
let currentPage = 1;
const rowsPerPage = 8;
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
    });

    setTimeout(async () => {
        const { data: mk } = await db.from('master_2').select('*'); if(mk) kamusData = mk;
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

async function ambilSemuaData() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500">Menarik Data...</p></td></tr>`;
    try {
        const [resRiwayat, resHold] = await Promise.all([
            db.from('stok_qr').select('*').order('created_at', {ascending: false}).limit(1000),
            db.from('hold_langsir').select('*').order('created_at', {ascending: false})
        ]);
        
        logLangsirRaw = resRiwayat.data || [];
        holdLangsirRaw = resHold.data || [];

        // Bikin Indexing Memori yang Aman dari Null/Kosong
        window.itemMap = {}; window.dusMap = {}; window.mesinMap = {}; window.poMap = {};
        if(Array.isArray(kamusData)) {
            for(let i = 0; i < kamusData.length; i++) {
                let m = kamusData[i];
                if(m.kode_nama_item) window.itemMap[m.kode_nama_item] = m.nama_item;
                if(m.kode_dus) window.dusMap[m.kode_dus] = m.dus;
                if(m.kode_mesin) window.mesinMap[m.kode_mesin] = m.mesin;
                if(m.kode_po) window.poMap[m.kode_po] = m.po;
            }
        }

        renderTabelRiwayat();
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-red-500 font-bold">Error: ${e.message}</td></tr>`; 
    }
}

function translateBarcode(barcode) {
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenis: '-', nama: '-', pjg: '-', grade: '-', dus: '-', shading: '-', po: '-' };
    if(!barcode) return data;
    const parts = barcode.split('/'); if (parts.length < 1) return data;
    const h = barcode.charAt(0).toUpperCase();
    if (h === 'P') data.jenis = 'Plafon'; else if (h === 'L') data.jenis = 'List'; else if (h === 'W') data.jenis = 'WPC'; else data.jenis = h;

    let rawItem = parts[0]; 
    data.nama = window.itemMap && window.itemMap[rawItem] ? window.itemMap[rawItem] : rawItem; 
    data.shading = parts[1] || '-';

    const p2 = parts[2];
    if(p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.pjg = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M";
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); 
        data.dus = window.dusMap && window.dusMap[rawDus] ? window.dusMap[rawDus] : rawDus;
    }

    const p3 = parts[3];
    if(p3 && p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if(match) {
            data.mesin = window.mesinMap && window.mesinMap[match[1]] ? window.mesinMap[match[1]] : match[1];
            data.shift = match[2]; 
            data.po = window.poMap && window.poMap[match[3]] ? window.poMap[match[3]] : match[3];
        }
    }
    return data;
}

async function sinkronisasiUlangStokAktual() {
    try {
        const { data: fisikQr, error: errQr } = await db.from('stok_qr').select('*');
        if(errQr) throw errQr;
        
        let mapAgg = {};
        (fisikQr || []).forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = translateBarcode(r.qrcode);
            
            let area = r.area || p[0] || '-';
            let nama = r.nama_item || p[2] || t.nama; 
            let pjg = r.panjang || p[3] || t.pjg;
            let grade = r.grade || p[4] || t.grade;
            let dus = r.dus || p[5] || t.dus;
            let shading = r.shading || p[6] || t.shading;
            let po = p.length >= 8 ? p[7] : (r.po_bawaan || t.po || '-');
            let ket = r.keterangan || '-';

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
            if(!mapAgg[key]) {
                mapAgg[key] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, area: area, po_aktual: po, keterangan: ket, qty: 0 };
            }
            mapAgg[key].qty++;
        });

        let dataAktualBaru = Object.values(mapAgg);
        const { error: errDel } = await db.from('stok_aktual').delete().neq('qty', -99999);
        if(errDel) throw errDel; 

        for(let i = 0; i < dataAktualBaru.length; i += 500) {
            const { error: errIns } = await db.from('stok_aktual').insert(dataAktualBaru.slice(i, i + 500));
            if(errIns) throw errIns;
        }
    } catch(e) {
        console.error("Gagal sinkronisasi stok_aktual.");
    }
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

function gantiModeRiwayat(m) {
    modeRiwayat = m;
    
    // REVISI DESAIN TAB 
    const activeClass = 'px-6 py-3.5 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2 text-blue-700 border-b-2 border-blue-700 bg-white';
    const inactiveClass = 'px-6 py-3.5 font-bold text-xs uppercase transition whitespace-nowrap flex items-center gap-2 text-slate-500 border-b-2 border-transparent hover:text-slate-800 bg-white';
    
    ['qr', 'agregasi', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-r-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    const btnGA = document.getElementById('btn-ganti-area'); if(btnGA) btnGA.classList.toggle('hidden', m !== 'qr');
    const btnCL = document.getElementById('btn-cancel-langsir'); if(btnCL) btnCL.classList.toggle('hidden', m !== 'qr');
    
    const userRole = (currentUser.role || '').toLowerCase();
    const btnHH = document.getElementById('btn-hapus-hold');
    if(btnHH) btnHH.classList.toggle('hidden', !(m === 'hold' && ['creator', 'admin', 'pic area'].includes(userRole)));

    activeFilters = {}; updateFilterIcons();
    renderTabelRiwayat();
}

function toggleSemuaCentang(checked) { 
    document.querySelectorAll('.cb-row').forEach(cb => {
        const row = cb.closest('tr'); if (row && row.style.display !== 'none' && !row.classList.contains('filtered-out')) { cb.checked = checked; highlightRow(cb); }
    });
}

// ARSITEKTUR AMAN HITUNGAN PAGINASI
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
        // PERBAIKAN BUG FATAL: Penguncian logika pembacaan variabel sumQty
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

        if(modeRiwayat === 'qr' || modeRiwayat === 'hold') {
            const isHold = modeRiwayat === 'hold'; const dataset = isHold ? holdLangsirRaw : logLangsirRaw;
            
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded"></th>
                    ${thSort(1, 'Waktu Masuk', 'col-waktu')}
                    ${isHold ? thSort(2, 'Troli', 'col-troli text-amber-300') : '<th class="hdr-std hidden col-troli">-</th>'}
                    ${thSort(isHold?3:2, 'Area', 'col-area')}
                    ${thSort(isHold?4:3, 'QRCode', 'col-qr border-r border-slate-500')}
                    ${thSort(isHold?5:4, 'Tgl Produksi', 'col-tgl')}
                    ${thSort(isHold?6:5, 'Mesin', 'col-mesin')}
                    ${thSort(isHold?7:6, 'Shift', 'col-shift border-r border-slate-500')}
                    ${thSort(isHold?8:7, 'Jenis Item', 'col-jenis text-blue-300')}
                    ${thSort(isHold?9:8, 'Nama Item', 'col-nama')}
                    ${thSort(isHold?10:9, 'Panjang', 'col-pjg')}
                    ${thSort(isHold?11:10, 'Grade', 'col-grade')}
                    ${thSort(isHold?12:11, 'Dus', 'col-dus')}
                    ${thSort(isHold?13:12, 'Shading', 'col-shading border-r border-slate-500')}
                    ${thSort(isHold?14:13, 'PO Aktual', 'col-po')}
                    ${isHold ? thSort(15, 'Keterangan', 'col-ket') : '<th class="hdr-std hidden col-ket">-</th>'}
                    ${thSort(isHold?16:14, 'User / PIC', 'col-pic border-l border-slate-500')}
                </tr>`;
            
            if(!dataset || dataset.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="18" class="p-6 font-bold text-slate-400">Tidak ada data.</td></tr>`; applyPagination(); return; }
            
            let h = '';
            dataset.forEach((r, i) => {
                const trans = translateBarcode(r.qrcode); const dt = new Date(r.created_at);
                const tgl = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

                h += `
                    <tr class="hover:bg-slate-100 transition r-row text-xs bg-white border-b border-slate-200">
                        <td class="p-3 col-cb border-r border-slate-200"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300"></td>
                        <td class="p-3 text-slate-600 font-semibold text-center col-waktu border-r border-slate-200" data-search="${tgl}">${tgl}</td>
                        ${isHold ? `<td class="p-3 font-bold text-slate-700 text-center col-troli border-r border-slate-200" data-search="${r.troli || '-'}">${r.troli || '-'}</td>` : `<td class="p-3 hidden col-troli">-</td>`}
                        <td class="p-3 font-bold text-emerald-700 bg-emerald-50/50 text-center col-area border-r border-slate-200" data-search="${r.area || '-'}">${r.area || '-'}</td>
                        <td class="p-3 font-mono font-bold text-slate-900 text-left bg-slate-50 tracking-wider border-r border-slate-200 col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                        <td class="p-3 font-semibold text-slate-500 text-center col-tgl border-r border-slate-200" data-search="${trans.tglProduksi}">${trans.tglProduksi}</td>
                        <td class="p-3 font-semibold text-slate-500 text-center col-mesin border-r border-slate-200" data-search="${trans.mesin}">${trans.mesin}</td>
                        <td class="p-3 font-semibold text-slate-500 text-center border-r border-slate-200 col-shift" data-search="${trans.shift}">${trans.shift}</td>
                        <td class="p-3 font-bold text-blue-600 text-center col-jenis border-r border-slate-200" data-search="${trans.jenis}">${trans.jenis}</td>
                        <td class="p-3 font-bold text-black text-left col-nama border-r border-slate-200" data-search="${trans.nama}">${trans.nama}</td>
                        <td class="p-3 font-bold text-black text-center col-pjg border-r border-slate-200" data-search="${trans.pjg}">${trans.pjg}</td>
                        <td class="p-3 font-bold text-black text-center col-grade border-r border-slate-200" data-search="${trans.grade}">${trans.grade}</td>
                        <td class="p-3 font-bold text-black text-center border-r border-slate-200 col-dus" data-search="${trans.dus}">${trans.dus}</td>
                        <td class="p-3 font-bold text-black text-center border-r border-slate-200 col-shading" data-search="${trans.shading}">${trans.shading}</td>
                        <td class="p-3 font-black text-cyan-600 bg-cyan-50/40 border-r border-slate-200 text-center col-po" data-search="${trans.po}">${trans.po}</td>
                        ${isHold ? `<td class="p-3 font-semibold text-slate-500 text-left col-ket border-r border-slate-200" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>` : `<td class="p-3 hidden col-ket">-</td>`}
                        <td class="p-3 font-bold uppercase text-[10px] text-slate-400 text-center col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        } 
        else if(modeRiwayat === 'agregasi') {
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded"></th>
                    ${thSort(1, 'Area', 'col-area')}
                    ${thSort(2, 'Jenis Item', 'col-jenis text-blue-300')}
                    ${thSort(3, 'Nama Item', 'col-nama')}
                    ${thSort(4, 'Panjang', 'col-pjg')}
                    ${thSort(5, 'Grade', 'col-grade')}
                    ${thSort(6, 'Dus', 'col-dus')}
                    ${thSort(7, 'Shading', 'col-shading border-r border-slate-500')}
                    ${thSort(8, 'PO Aktual', 'col-po')}
                    ${thSort(9, 'PIC Input', 'col-pic')}
                    ${thSort(10, 'QTY TOTAL (DUS)', 'col-qty border-l border-slate-500 border-r')}
                </tr>`;

            let groups = {};
            logLangsirRaw.forEach(r => {
                const trans = translateBarcode(r.qrcode);
                let key = `${r.area}_${trans.jenis}_${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${trans.po}_${r.pic_input}`;
                if(!groups[key]) groups[key] = { area: r.area, jenis: trans.jenis, nama: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, po: trans.po, pic: r.pic_input, qty: 0 };
                groups[key].qty++;
            });

            let arr = Object.values(groups);
            if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="12" class="p-6 font-bold text-slate-400">Kosong.</td></tr>`; applyPagination(); return; }

            let h = '';
            arr.forEach((r) => {
                h += `
                    <tr class="hover:bg-slate-100 transition r-row text-xs bg-white border-b border-slate-200">
                        <td class="p-3 col-cb border-r border-slate-200"><input type="checkbox" onchange="highlightRow(this)" value="agg" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300"></td>
                        <td class="p-3 font-black text-emerald-700 bg-emerald-50 border-r border-slate-200 col-area" data-search="${r.area}">${r.area}</td>
                        <td class="p-3 font-bold text-blue-600 border-r border-slate-200 col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                        <td class="p-3 font-bold text-black text-left col-nama border-r border-slate-200" data-search="${r.nama}">${r.nama}</td>
                        <td class="p-3 font-bold text-black text-center col-pjg border-r border-slate-200" data-search="${r.pjg}">${r.pjg}</td>
                        <td class="p-3 font-bold text-black text-center col-grade border-r border-slate-200" data-search="${r.grade}">${r.grade}</td>
                        <td class="p-3 font-bold text-black text-center col-dus border-r border-slate-200" data-search="${r.dus}">${r.dus}</td>
                        <td class="p-3 font-bold text-black text-center border-r border-slate-200 col-shading" data-search="${r.shading}">${r.shading}</td>
                        <td class="p-3 font-black text-cyan-600 bg-cyan-50/40 border-r border-slate-200 text-center col-po" data-search="${r.po}">${r.po}</td>
                        <td class="p-3 font-bold uppercase text-[10px] text-slate-400 text-center border-r border-slate-200 col-pic" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
                        <td class="p-3 font-black text-base text-blue-700 bg-blue-50 border-r border-slate-200 col-qty" data-search="${r.qty}">${r.qty}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        }
        lucide.createIcons(); saringTabelExcel();
    } catch(err) { console.error("Gagal Render Tabel:", err); }
}

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

async function cancelLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); if(checkedBoxes.length === 0) return alert("Pilih minimal 1 baris!");
    if(!confirm(`Batal Langsir untuk ${checkedBoxes.length} kardus ini?`)) return;
    const btn = document.getElementById('btn-cancel-langsir'); const ori = btn.innerHTML;
    if(btn) { btn.innerHTML = 'Proses...'; btn.disabled = true; }

    let arrFisik = []; let mapAktual = {}; let mapGlobal = {}; let payloadHold = [];
    checkedBoxes.forEach(cb => {
        const qr = cb.value; const r = logLangsirRaw.find(x => x.qrcode === qr);
        if(r) {
            const trans = translateBarcode(qr);
            let keyAkt = `${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${r.area}_${trans.po}_-`;
            if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { jenis_item: trans.jenis, nama_item: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, area: r.area, po_aktual: trans.po, ket: '-', qty: 0 };
            mapAktual[keyAkt].qty++;

            let keyGlb = `${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${trans.po}_-`;
            if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { jenis_item: trans.jenis, nama_item: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, po_bawaan: trans.po, ket: '-', qty: 0 };
            mapGlobal[keyGlb].qty++;

            arrFisik.push(qr);
            payloadHold.push({ qrcode: qr, troli: r.troli || '-', area: r.area || '-', keterangan: 'Cancel Langsir', pic_input: currentUser.username });
        }
    });

    try {
        const payloadData = { qrs: arrFisik, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
        const { error: rpcErr } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData }); if(rpcErr) throw rpcErr;
        await db.from('hold_langsir').insert(payloadHold);
        await sinkronisasiUlangStokAktual(); await ambilSemuaData();
    } catch (e) { alert("Gagal: " + e.message); } finally { if(btn) { btn.innerHTML = ori; btn.disabled = false; } lucide.createIcons(); }
}

async function hapusBarisHold() {
    const checked = document.querySelectorAll('.cb-row:checked'); if(checked.length === 0) return alert("Pilih baris!");
    if(!confirm("Hapus permanen dari Hold?")) return;
    try {
        await db.from('hold_langsir').delete().in('qrcode', Array.from(checked).map(cb => cb.value));
        await ambilSemuaData();
    } catch(e) { alert("Gagal: " + e.message); }
}

function toggleSidebarFilter() { document.getElementById('sidebar-filter').classList.toggle('translate-x-full'); document.getElementById('overlay-klik-luar').classList.toggle('hidden'); }
function tutupPopups() { document.getElementById('sidebar-filter').classList.add('translate-x-full'); document.getElementById('overlay-klik-luar').classList.add('hidden'); tutupModalSTBJ(); }
function resetFilter() { activeFilters = {}; updateFilterIcons(); saringTabelExcel(); toggleSidebarFilter(); }

function bukaModalGantiArea() {
    if(modeRiwayat !== 'qr') return alert("Hanya bisa dilakukan di mode DETAIL QRCODE.");
    const cek = document.querySelectorAll('.cb-row:checked'); if(cek.length === 0) return alert("Pilih baris!");
    document.getElementById('teks-info-area').innerText = `Anda akan memindahkan ${cek.length} kardus ke lokasi baru.`;
    document.getElementById('select-new-area').value = ''; document.getElementById('modal-ganti-area').classList.remove('hidden');
}
function tutupModalArea() { document.getElementById('modal-ganti-area').classList.add('hidden'); }

async function eksekusiGantiArea() {
    const newArea = document.getElementById('select-new-area').value; if(!newArea) return alert("Pilih Area Tujuan!");
    const btn = document.getElementById('btn-eks-area'); let original = btn ? btn.innerHTML : 'Simpan';
    if(btn) { btn.innerHTML = 'Menyimpan...'; btn.disabled = true; }

    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); const qrsToUpdate = Array.from(checkedBoxes).map(cb => cb.value);
    let updates = [];
    for(let qr of qrsToUpdate) {
        let dbRow = logLangsirRaw.find(r => r.qrcode === qr);
        if(dbRow) {
            let newObj = { ...dbRow }; let parts = newObj.id_sku.split('_'); parts[0] = newArea; 
            newObj.id_sku = parts.join('_'); newObj.area = newArea; updates.push(newObj);
        }
    }
    try {
        const { error } = await db.from('stok_qr').upsert(updates, { onConflict: 'qrcode' }); if(error) throw error;
        tutupModalArea(); await sinkronisasiUlangStokAktual(); await ambilSemuaData();
    } catch (error) { alert("Gagal: " + error.message); } finally { if(btn) { btn.innerHTML = original; btn.disabled = false; } lucide.createIcons(); }
}

function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked'); if(cek.length === 0) return alert("Pilih baris!");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-riwayat th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(!td.classList.contains('col-cb') && window.getComputedStyle(td).display !== 'none') rowData.push(td.innerText.trim().replace(/\n/g, ' '));
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => alert("Tersalin!"));
}

function highlightRow(cb) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    
    // Perbarui counter "Dipilih: X" di footer (karena ini menu riwayat)
    if (typeof updateSelectedCount === 'function') {
        updateSelectedCount();
    }
}

async function bukaModalSTBJ() {
    const mStbj = document.getElementById('modal-stbj-langsir'); if(mStbj) mStbj.classList.remove('hidden');
    const overlay = document.getElementById('overlay-klik-luar'); if(overlay) overlay.classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    if(tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-8 font-bold text-slate-500">Memuat...</td></tr>';
    try {
        const { data } = await db.from('hasil_stbj').select('*').order('created_at', {ascending: false});
        if(!data || data.length === 0) { if(tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-6 font-bold text-slate-400">Kosong.</td></tr>'; return; }
        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            const td = translateBarcode(r.qrcode);
            h += `<tr class="border-b border-slate-200 text-row text-center text-xs">
                <td class="p-3">${i+1}</td><td class="p-3">${tgl}</td><td class="p-3">${r.troli || '-'}</td><td class="p-3 font-mono font-bold">${r.qrcode}</td>
                <td class="p-3 text-left font-bold text-blue-600">${td.nama}</td><td class="p-3">${td.pjg}</td><td class="p-3 font-black text-cyan-600">${td.po}</td><td class="p-3">${r.posisi || 'STBJ'}</td>
            </tr>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = '<tr><td>Gagal</td></tr>'; }
}
function tutupModalSTBJ() { const m = document.getElementById('modal-stbj-langsir'); if(m) m.classList.add('hidden'); const ov = document.getElementById('overlay-klik-luar'); if(ov) ov.classList.add('hidden'); }
function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('#tbody-stbj-modal tr').forEach(row => { row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none'; });
}
