let rawData = [];
let activeFilters = {};
let currentFilterCol = '';
let sortState = {};
let tempScannedQR = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

function formatWIB(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'stok_nonaktif', title: 'STOK NONAKTIF', url: 'stok_nonaktif.html' });
    muatData();
});

window.muatData = async function() {
    const tbody = document.getElementById('tbody-nonaktif');
    tbody.innerHTML = `<tr><td colspan="13" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menarik Data...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('stok_nonaktif').select('*').order('created_at', { ascending: false });
        if(error) throw error;
        rawData = data || [];
        renderTabel();
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="13" class="p-10 text-center text-red-500 font-bold">Gagal: ${e.message}</td></tr>`; 
    }
};

window.thSort = function(idx, label, cls = "") {
    const noFilter = ['col-cb', 'col-no'].includes(cls);
    const filterBtn = noFilter ? '' : `<button onclick="openColumnFilter(event, '${cls}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition"><i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 text-white"></i></button>`;

    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(${idx}, this.closest('th'))">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition"><i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 text-white"></i></button>
                ${filterBtn}
            </div>
        </div>
    </th>`;
};

window.renderTabel = function() {
    const thead = document.getElementById('thead-nonaktif');
    const tbody = document.getElementById('tbody-nonaktif');
    sortState = {};

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <input type="checkbox" id="cb-all" onchange="toggleAll(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-0 cursor-pointer">
            </th>
            <th class="hdr-std w-12 text-center col-no">No</th>
            ${thSort(2, 'Waktu', 'col-waktu')}
            ${thSort(3, 'Area', 'col-area')}
            ${thSort(4, 'QRCode', 'col-qr')}
            ${thSort(5, 'Jenis Item', 'col-jenis')}
            ${thSort(6, 'Nama Item', 'col-nama')}
            ${thSort(7, 'Panjang', 'col-pjg')}
            ${thSort(8, 'Grade', 'col-grade')}
            ${thSort(9, 'Dus', 'col-dus')}
            ${thSort(10, 'Shading', 'col-shading')}
            ${thSort(11, 'Customer Aktual', 'col-cust')}
            ${thSort(12, 'Customer Estimasi', 'col-est')}
            ${thSort(13, 'Keterangan', 'col-ket')}
        </tr>`;
    
    if(rawData.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; document.getElementById('lbl-total').innerText = 0; return; }

    tbody.innerHTML = rawData.map((r, i) => {
        const rowDataStr = encodeURIComponent(JSON.stringify(r));
        return `
            <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                <td class="px-4 py-3 text-center sticky-col"><input type="checkbox" value="${r.id}" data-row="${rowDataStr}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 text-center font-bold text-slate-400 col-no">${i+1}</td>
                <td class="px-4 py-3 font-medium text-slate-600 col-waktu" data-search="${formatWIB(r.created_at)}">${formatWIB(r.created_at)}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-area" data-search="${r.posisi || '-'}">${r.posisi || '-'}</td>
                <td class="px-4 py-3 font-mono font-bold text-rose-600 col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 col-cust" data-search="${r.customer_aktual || '-'}">${r.customer_aktual || '-'}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 col-est" data-search="${r.customer_estimasi || '-'}">${r.customer_estimasi || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-500 col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
            </tr>`;
    }).join('');

    document.getElementById('lbl-total').innerText = rawData.length;
    lucide.createIcons(); saringTabelExcel();
};

window.highlightRow = function(cb) {
    const tr = cb.closest('tr');
    if (cb.checked) tr.classList.add('selected-row');
    else tr.classList.remove('selected-row');
};

window.toggleAll = function(checked) {
    document.querySelectorAll('.cb-main').forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    });
};

window.bukaModalScan = function() {
    document.getElementById('input-qr').value = '';
    document.getElementById('modal-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qr').focus(), 100);
};

window.prosesScan = async function() {
    const qr = document.getElementById('input-qr').value.trim();
    if(!qr) return alert("Masukkan QR Code!");

    const btn = document.getElementById('btn-proses-scan'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Mengecek...'; btn.disabled = true;

    try {
        const { data: globalData, error: errGlobal } = await db.from('stok_global').select('*').eq('qrcode', qr).single();
        if(errGlobal || !globalData) throw new Error("QR Code tidak ditemukan di gudang!");
        if(globalData.kondisi === 'NONAKTIF') throw new Error("Item ini sudah berstatus NONAKTIF!");

        tempScannedQR = qr;
        const idSkuBase = globalData.id_sku;

        const { data: aktualData, error: errAktual } = await db.from('stok_aktual').select('customer_estimasi, qty').eq('id_sku', idSkuBase).gt('qty', 0);
        if(errAktual) throw errAktual;

        if(aktualData && aktualData.length > 1) {
            const sel = document.getElementById('select-estimasi');
            sel.innerHTML = aktualData.map(a => `<option value="${a.customer_estimasi}">${a.customer_estimasi} (Tersedia: ${a.qty} Dus)</option>`).join('');
            document.getElementById('modal-scan').classList.add('hidden');
            document.getElementById('modal-estimasi').classList.remove('hidden');
        } else {
            let custEst = aktualData && aktualData.length === 1 ? aktualData[0].customer_estimasi : globalData.customer_aktual;
            await jalankanRPC(qr, custEst);
        }
    } catch(e) {
        alert(e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.eksekusiNonaktif = async function() {
    const custEst = document.getElementById('select-estimasi').value;
    if(!custEst) return alert("Pilih customer estimasi!");

    const btn = document.getElementById('btn-eksekusi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    await jalankanRPC(tempScannedQR, custEst);
    
    btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
};

async function jalankanRPC(qr, custEst) {
    try {
        const { data, error } = await db.rpc('proses_stok_nonaktif', {
            p_qrcode: qr,
            p_cust_estimasi: custEst,
            p_pic: currentUser.username
        });

        if(error) throw error;
        if(data && data.startsWith('ERROR')) throw new Error(data);

        alert("✅ BERHASIL! Item telah dinonaktifkan dan stok aktual telah disesuaikan.");
        document.getElementById('modal-scan').classList.add('hidden');
        document.getElementById('modal-estimasi').classList.add('hidden');
        muatData();
    } catch(e) {
        alert("GAGAL: " + e.message);
    }
}

// ========================================================
// FUNGSI CANCEL NONAKTIF & PROSES BS
// ========================================================
window.cancelNonaktifMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin di-cancel!");
    if(!confirm(`Yakin ingin membatalkan (Cancel) ${checked.length} item nonaktif ini?\nStok akan dikembalikan ke kondisi 'Aman' di Kartu Stok.`)) return;

    const btn = document.getElementById('btn-cancel'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    let payload = [];
    checked.forEach(cb => { payload.push(JSON.parse(decodeURIComponent(cb.getAttribute('data-row')))); });

    try {
        const { data, error } = await db.rpc('cancel_stok_nonaktif_massal', { payload: payload });
        if(error) throw error;
        alert("✅ BERHASIL! Item telah dikembalikan ke kondisi Aman.");
        muatData();
    } catch(e) {
        alert("GAGAL: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.prosesBSMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin di-BS-kan!");
    if(!confirm(`Yakin ingin memproses ${checked.length} item ini menjadi BS?\nItem akan dihapus dari stok_global dan stok_aktual, lalu posisinya diubah menjadi 'BS'.`)) return;

    const btn = document.getElementById('btn-bs'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    let payload = [];
    checked.forEach(cb => { payload.push(JSON.parse(decodeURIComponent(cb.getAttribute('data-row')))); });

    try {
        const { data, error } = await db.rpc('proses_bs_nonaktif_massal', { payload: payload });
        if(error) throw error;
        alert("✅ BERHASIL! Item telah diproses menjadi BS.");
        muatData();
    } catch(e) {
        alert("GAGAL: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// --- FUNGSI FILTER EXCEL STANDAR ---
window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-nonaktif');
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
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-nonaktif tr.r-row').forEach(row => {
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
};

window.toggleAllFilterValues = function(checked) { document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; }); updateSelectAllState(); };
window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};
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
    let visibleCount = 0;
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.style.display = ''; visibleCount++; } 
        else { row.style.display = 'none'; }
    });
    document.getElementById('lbl-total').innerText = visibleCount;
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};
