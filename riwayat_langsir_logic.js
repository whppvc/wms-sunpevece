let modeRiwayat = 'qr'; 
let logLangsirRaw = []; let holdLangsirRaw = [];
let kamusData = []; let areaData = []; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 8; 
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    
    // FIX LAYOUT: Kunci body dan main agar absolute inset-0 bekerja sempurna
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

// HEADER FILTER EXCEL PRO (Clean Design - No Vertical Borders)
const thSort = (idx, label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-200 rounded ml-1 transition text-slate-400 hover:text-slate-700" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon transition-all"></i>
        </button>`;

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-slate-800 transition" onclick="sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

async function ambilSemuaData() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    try {
        const [resRiwayat, resHold] = await Promise.all([
            db.from('stok_qr').select('*').order('created_at', {ascending: false}).limit(1000),
            db.from('hold_langsir').select('*').order('created_at', {ascending: false})
        ]);
        
        logLangsirRaw = resRiwayat.data || [];
        holdLangsirRaw = resHold.data || [];

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
        if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center text-red-500 font-medium">Error: ${e.message}</td></tr>`; 
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
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; highlightRow(cb); } }
    });
    currentPage = 1; applyPagination();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-blue-600'); icon.classList.add('text-slate-400'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-slate-400'); icon.classList.add('text-blue-600'); } }
    }
}

function gantiModeRiwayat(m) {
    modeRiwayat = m;
    
    const activeClass = 'pb-3 tab-active transition whitespace-nowrap flex items-center gap-2 text-sm';
    const inactiveClass = 'pb-3 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-sm';
    
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
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    let sumQty = 0;

    visibleRows.forEach((row, index) => {
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
                    <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"></th>
                    ${thSort(1, 'Waktu Masuk', 'col-waktu')}
                    ${isHold ? thSort(2, 'Troli', 'col-troli') : '<th class="hdr-std hidden col-troli">-</th>'}
                    ${thSort(isHold?3:2, 'Area', 'col-area')}
                    ${thSort(isHold?4:3, 'QRCode', 'col-qr')}
                    ${thSort(isHold?5:4, 'Tgl Produksi', 'col-tgl')}
                    ${thSort(isHold?6:5, 'Mesin', 'col-mesin')}
                    ${thSort(isHold?7:6, 'Shift', 'col-shift')}
                    ${thSort(isHold?8:7, 'Jenis Item', 'col-jenis')}
                    ${thSort(isHold?9:8, 'Nama Item', 'col-nama')}
                    ${thSort(isHold?10:9, 'Panjang', 'col-pjg')}
                    ${thSort(isHold?11:10, 'Grade', 'col-grade')}
                    ${thSort(isHold?12:11, 'Dus', 'col-dus')}
                    ${thSort(isHold?13:12, 'Shading', 'col-shading')}
                    ${thSort(isHold?14:13, 'PO Aktual', 'col-po')}
                    ${isHold ? thSort(15, 'Keterangan', 'col-ket') : '<th class="hdr-std hidden col-ket">-</th>'}
                    ${thSort(isHold?16:14, 'PIC', 'col-pic')}
                </tr>`;
            
            if(!dataset || dataset.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="18" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; applyPagination(); return; }
            
            let h = '';
            dataset.forEach((r, i) => {
                const trans = translateBarcode(r.qrcode); const dt = new Date(r.created_at);
                const tgl = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

                h += `
                    <tr class="hover:bg-slate-100 even:bg-slate-50 transition r-row text-sm border-b border-slate-100">
                        <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                        <td class="px-4 py-3 text-slate-600 font-medium col-waktu" data-search="${tgl}">${tgl}</td>
                        ${isHold ? `<td class="px-4 py-3 font-medium text-slate-700 col-troli" data-search="${r.troli || '-'}">${r.troli || '-'}</td>` : `<td class="px-4 py-3 hidden col-troli">-</td>`}
                        <td class="px-4 py-3 col-area" data-search="${r.area || '-'}"><span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-semibold">${r.area || '-'}</span></td>
                        <td class="px-4 py-3 font-mono font-medium text-slate-800 tracking-wider col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 col-tgl" data-search="${trans.tglProduksi}">${trans.tglProduksi}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 col-mesin" data-search="${trans.mesin}">${trans.mesin}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 col-shift" data-search="${trans.shift}">${trans.shift}</td>
                        <td class="px-4 py-3 font-medium text-blue-600 col-jenis" data-search="${trans.jenis}">${trans.jenis}</td>
                        <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${trans.nama}">${trans.nama}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${trans.pjg}">${trans.pjg}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${trans.grade}">${trans.grade}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${trans.dus}">${trans.dus}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${trans.shading}">${trans.shading}</td>
                        <td class="px-4 py-3 font-medium text-orange-600 col-po" data-search="${trans.po}">${trans.po}</td>
                        ${isHold ? `<td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>` : `<td class="px-4 py-3 hidden col-ket">-</td>`}
                        <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        } 
        else if(modeRiwayat === 'agregasi') {
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"></th>
                    ${thSort(1, 'Area', 'col-area')}
                    ${thSort(2, 'Jenis Item', 'col-jenis')}
                    ${thSort(3, 'Nama Item', 'col-nama')}
                    ${thSort(4, 'Panjang', 'col-pjg')}
                    ${thSort(5, 'Grade', 'col-grade')}
                    ${thSort(6, 'Dus', 'col-dus')}
                    ${thSort(7, 'Shading', 'col-shading')}
                    ${thSort(8, 'PO Aktual', 'col-po')}
                    ${thSort(9, 'PIC', 'col-pic')}
                    ${thSort(10, 'QTY TOTAL (DUS)', 'col-qty')}
                </tr>`;

            let groups = {};
            logLangsirRaw.forEach(r => {
                const trans = translateBarcode(r.qrcode);
                let key = `${r.area}_${trans.jenis}_${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${trans.po}_${r.pic_input}`;
                if(!groups[key]) groups[key] = { area: r.area, jenis: trans.jenis, nama: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, po: trans.po, pic: r.pic_input, qty: 0 };
                groups[key].qty++;
            });

            let arr = Object.values(groups);
            if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="12" class="p-8 text-center font-medium text-slate-400">Kosong.</td></tr>`; applyPagination(); return; }

            let h = '';
            arr.forEach((r) => {
                h += `
                    <tr class="hover:bg-slate-100 even:bg-slate-50 transition r-row text-sm border-b border-slate-100">
                        <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="agg" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                        <td class="px-4 py-3 col-area" data-search="${r.area}"><span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-semibold">${r.area}</span></td>
                        <td class="px-4 py-3 font-medium text-blue-600 col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                        <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama}">${r.nama}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade}">${r.grade}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus}">${r.dus}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading}">${r.shading}</td>
                        <td class="px-4 py-3 font-medium text-orange-600 col-po" data-search="${r.po}">${r.po}</td>
                        <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 col-pic" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
                        <td class="px-4 py-3 font-black text-emerald-700 col-qty" data-search="${r.qty}">${r.qty}</td>
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
