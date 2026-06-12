let modeSekarang = 'qrcode'; 
let tabelSekarang = 'stok_global'; 
let rawDataRaw = [];
let kamusData = [];
let jasperData = [];
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 8; 
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'hasil_stbj', title: 'HASIL STBJ', url: 'hasil_stbj.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
    });

    setTimeout(async () => {
        await loadKamusDanJasper();
        await muatDataDariSupabase();
    }, 200);
});

async function loadKamusDanJasper() {
    const { data: d2 } = await db.from('master_2').select('*'); if(d2) kamusData = d2;
    try {
        const { data: dj } = await db.from('nama_jasper').select('*').order('created_at', {ascending: false});
        if(dj) jasperData = dj;
    } catch(e) { console.log("Tabel nama_jasper belum siap."); }
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-stbj');
    tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
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
    const btnHold = document.getElementById('btn-hold');
    if (m === 'item' || m === 'jasper') {
        btnCollect.classList.remove('hidden'); btnHold.classList.add('hidden');
    } else {
        btnCollect.classList.add('hidden'); btnHold.classList.remove('hidden');
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

// HEADER FILTER EXCEL PRO (Clean Design - No Vertical Borders)
const thSort = (idx, label, cls = "") => {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-600 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center justify-center gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-slate-200 transition" onclick="sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
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

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-stbj');
    const tbody = document.getElementById('tbody-stbj');
    sortState = {};

    if(modeSekarang === 'qrcode') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std w-10 col-btn text-center"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-slate-400"></i></th>
                ${thSort(2, 'Status Item', 'col-status-gudang')}
                ${tabelSekarang === 'hold_stbj' ? thSort(3, 'Status Hold', 'col-status') : '<th class="hdr-std hidden col-status">Status Hold</th>'}
                ${thSort(tabelSekarang==='hold_stbj'?4:3, 'Status Data', 'col-status-data')}
                ${thSort(tabelSekarang==='hold_stbj'?5:4, 'Waktu Scan', 'col-waktu')}
                ${thSort(tabelSekarang==='hold_stbj'?6:5, 'Troli', 'col-troli')}
                ${thSort(tabelSekarang==='hold_stbj'?7:6, 'QRCode', 'col-qr')}
                ${thSort(tabelSekarang==='hold_stbj'?8:7, 'Tgl Produksi', 'col-tgl')}
                ${thSort(tabelSekarang==='hold_stbj'?9:8, 'Mesin', 'col-mesin')}
                ${thSort(tabelSekarang==='hold_stbj'?10:9, 'Shift', 'col-shift')}
                ${thSort(tabelSekarang==='hold_stbj'?11:10, 'Jenis Item', 'col-jenis')}
                ${thSort(tabelSekarang==='hold_stbj'?12:11, 'Nama Item', 'col-nama')}
                ${thSort(tabelSekarang==='hold_stbj'?13:12, 'Pjg', 'col-pjg')}
                ${thSort(tabelSekarang==='hold_stbj'?14:13, 'Grade', 'col-grade')}
                ${thSort(tabelSekarang==='hold_stbj'?15:14, 'Dus', 'col-dus')}
                ${thSort(tabelSekarang==='hold_stbj'?16:15, 'Shading', 'col-shading')}
                ${thSort(tabelSekarang==='hold_stbj'?17:16, 'PO Awal', 'col-po')}
                ${thSort(tabelSekarang==='hold_stbj'?18:17, 'Keterangan', 'col-ket')}
                ${thSort(tabelSekarang==='hold_stbj'?19:18, 'PIC Input', 'col-pic')}
            </tr>`;
        
        if(rawDataRaw.length === 0) { tbody.innerHTML = `<tr id="empty-row-stbj"><td colspan="22" class="p-8 text-center font-bold text-slate-400">Tabel Kosong.</td></tr>`; return; }
        
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
            const statData = r.status_data === 'Collected' ? '<span class="text-indigo-600 font-black">COLLECTED</span>' : '-';

            // REVISI: Menggunakan even:bg-slate-50 untuk row stripping dan menghapus border-r
            h += `
                <tr class="hover:bg-slate-100 even:bg-slate-50 text-row transition text-sm border-b border-slate-200">
                    <td class="p-3 text-center col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="p-2 text-center col-btn">
                        <button onclick="aksiHapusPerBaris('${r.qrcode}')" class="text-slate-400 hover:text-rose-600 transition p-1 rounded-md hover:bg-rose-50 mx-auto flex">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                    <td class="p-3 col-status-gudang" data-search="${r.is_in_gudang ? 'IN GUDANG' : 'STBJ'}">${htmlStatusGudang}</td>
                    ${tabelSekarang === 'hold_stbj' ? `<td class="p-3 font-black text-amber-600 col-status" data-search="${r.status || 'HOLD'}">${r.status || 'HOLD'}</td>` : '<td class="p-3 hidden col-status">-</td>'}
                    <td class="p-3 col-status-data" data-search="${r.status_data || '-'}">${statData}</td>
                    <td class="p-3 text-slate-600 font-medium col-waktu" data-search="${tgl}">${tgl}</td>
                    <td class="p-3 font-bold text-slate-700 col-troli" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                    <td class="p-3 font-mono font-bold text-slate-800 col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="p-3 text-slate-600 font-medium col-tgl" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                    <td class="p-3 text-slate-600 font-medium col-mesin" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                    <td class="p-3 text-slate-600 font-medium col-shift" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                    <td class="p-3 font-bold text-blue-600 col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="p-3 font-medium text-slate-700 col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                    <td class="p-3 font-medium text-slate-700 col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="p-3 font-medium text-slate-700 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="p-3 font-medium text-slate-700 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="p-3 font-bold text-orange-600 col-po" data-search="${r.po_bawaan || '-'}">${r.po_bawaan || '-'}</td>
                    <td class="p-3 text-slate-500 font-medium text-left col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="p-3 text-xs font-bold text-slate-400 col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
        tbody.innerHTML += `<tr id="empty-row-stbj" style="display:none;"><td colspan="22" class="p-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
    } 
    else if(modeSekarang === 'item' || modeSekarang === 'jasper') {
        const isJasper = modeSekarang === 'jasper';
        
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std col-status-gudang hidden">Status Item</th>
                <th class="hdr-std col-status hidden">Status Hold</th>
                ${thSort(3, 'Status Data', 'col-status-data')}
                <th class="hdr-std col-waktu hidden">Waktu Scan</th>
                ${thSort(5, 'Troli Gabungan', 'col-troli')}
                <th class="hdr-std col-qr hidden">QRCode</th>
                ${thSort(7, 'Tgl Produksi', 'col-tgl')}
                ${thSort(8, 'Mesin', 'col-mesin')}
                ${thSort(9, 'Shift', 'col-shift')}
                ${thSort(10, 'Jenis Item', 'col-jenis')}
                ${thSort(11, isJasper ? 'Nama Barang Jasper' : 'Nama Item', 'col-nama')}
                ${thSort(12, 'Panjang', 'col-pjg')}
                ${thSort(13, 'Grade', 'col-grade')}
                ${thSort(14, 'Dus', 'col-dus')}
                ${thSort(15, 'Shading', 'col-shading')}
                ${thSort(16, 'PO Bawaan', 'col-po')}
                ${thSort(17, 'QTY (DUS)', 'col-qty')}
                ${thSort(18, 'Keterangan', 'col-ket')}
                <th class="hdr-std col-pic hidden">PIC Input</th>
            </tr>`;
        
        let groups = {};
        rawDataRaw.forEach(r => {
            let n = r.nama_item || '-';
            if(isJasper) {
                if(jasperData && jasperData.length > 0) {
                    const cJasper = jasperData.find(j => j.nama_item === r.nama_item && j.panjang === r.panjang && j.grade === r.grade);
                    n = cJasper ? cJasper.nama_jasper : `JAS-${r.nama_item}`;
                } else { n = `JAS-${r.nama_item}`; }
            }
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let sData = r.status_data || 'BELUM';
            let key = `${r.jenis_item}_${n}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.po_bawaan}_${r.tgl_produksi}_${r.mesin}_${r.shift}_${ket}_${sData}`;
            
            if(!groups[key]) {
                groups[key] = { 
                    jenisItem: r.jenis_item, displayNama: n, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, po: r.po_bawaan,
                    tglProduksi: r.tgl_produksi, mesin: r.mesin, shift: r.shift,
                    qty: 0, qrcodes: [], trolis: new Set(), ket: ket, sData: sData 
                };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
            if(r.troli) groups[key].trolis.add(r.troli);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-stbj"><td colspan="20" class="p-8 text-center font-bold text-slate-400">Kosong.</td></tr>`; return; }

        let h = '';
        arr.forEach((r) => {
            const gabunganTroli = Array.from(r.trolis).join(', ') || '-';
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            const statData = r.sData === 'Collected' ? '<span class="text-indigo-600 font-black">COLLECTED</span>' : '-';

            h += `
                <tr class="hover:bg-slate-100 even:bg-slate-50 text-row text-center transition text-sm border-b border-slate-200">
                    <td class="p-3 col-cb"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcodes.join(',')}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="p-3 hidden col-status-gudang">-</td>
                    <td class="p-3 hidden col-status">-</td>
                    <td class="p-3 col-status-data" data-search="${r.sData || '-'}">${statData}</td>
                    <td class="p-3 hidden col-waktu">-</td>
                    <td class="p-3 font-bold text-slate-700 col-troli" data-search="${gabunganTroli}">${gabunganTroli}</td>
                    <td class="p-3 hidden col-qr">-</td>
                    <td class="p-3 font-medium text-slate-600 col-tgl" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="p-3 font-medium text-slate-600 col-mesin" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="p-3 font-medium text-slate-600 col-shift" data-search="${r.shift}">${r.shift}</td>
                    <td class="p-3 font-bold text-blue-600 col-jenis" data-search="${r.jenisItem}">${r.jenisItem}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama" data-search="${r.displayNama}">${r.displayNama}</td>
                    <td class="p-3 font-medium text-slate-700 col-pjg" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="p-3 font-medium text-slate-700 col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="p-3 font-medium text-slate-700 col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="p-3 font-medium text-slate-700 col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="p-3 font-bold text-orange-600 col-po" data-search="${r.po}">${r.po}</td>
                    <td class="p-3 font-black text-emerald-700 col-qty" data-search="${r.qty}">${r.qty}</td>
                    <td class="p-3 font-medium text-slate-500 text-left col-ket" data-search="${displayKet}">${displayKet}</td>
                    <td class="p-3 hidden col-pic">-</td>
                </tr>`;
        });
        tbody.innerHTML = h;
        tbody.innerHTML += `<tr id="empty-row-stbj" style="display:none;"><td colspan="20" class="p-8 text-center font-bold text-slate-400">Tidak ada data cocok dengan filter.</td></tr>`;
    }
    lucide.createIcons(); saringTabelExcel();
}

// HIGHLIGHT BARIS TERPILIH
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

// PAGINASI KENCANG
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


// KATALOG JASPER
function bukaDaftarKatalog() {
    renderKatalogList();
    document.getElementById('modal-list-katalog').classList.remove('hidden');
}

function renderKatalogList() {
    const tbody = document.getElementById('tbody-katalog-list');
    if (!jasperData || jasperData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold">Katalog Jasper Kosong di Database.</td></tr>'; 
        return;
    }

    let html = '';
    jasperData.forEach((d, i) => {
        const jData = encodeURIComponent(JSON.stringify(d));
        html += `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-center">
            <td class="p-2 border-r border-slate-200">
                <button onclick="bukaModalKatalogForm(true, '${jData}')" class="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded shadow-sm transition active:scale-95" title="Edit Baris Ini">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
            </td>
            <td class="p-3 font-bold text-slate-400 border-r border-slate-200">${i+1}</td>
            <td class="p-3 font-black text-black text-left border-r border-slate-200">${d.nama_item}</td>
            <td class="p-3 font-black text-black border-r border-slate-200">${d.panjang || '-'}</td>
            <td class="p-3 font-black text-black border-r border-slate-200">${d.grade || '-'}</td>
            <td class="p-3 font-black text-purple-700 bg-purple-50/50 border-r border-slate-200">${d.nama_jasper}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    lucide.createIcons(); 
}

function saringKatalogList() {
    const query = document.getElementById('f-kat-search').value.toLowerCase();
    document.querySelectorAll('#tbody-katalog-list tr').forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function bukaModalKatalogForm(isEdit = false, encodedData = null) {
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
        
        tutupModalJasperForm();
        
        document.getElementById('tbody-katalog-list').innerHTML = '<tr><td colspan="6" class="p-6 text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat ulang tabel...</td></tr>';
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
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr');
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
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
        if(tabelSekarang === 'stok_global') {
            if(!confirm(`Pindahkan ${checkedValues.length} data HASIL -> tabel HOLD (Duplikat)?`)) return;
            const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({ 
                troli: r.troli, qrcode: r.qrcode, tgl_produksi: r.tgl_produksi, shift: r.shift, mesin: r.mesin, 
                nama_item: r.nama_item, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, 
                po_bawaan: r.po_bawaan, keterangan: r.keterangan, status: 'HOLD', status_data: r.status_data, 
                posisi: r.posisi, pic_input: r.pic_input 
            }));
            const { error: errAdd } = await db.from('hold_stbj').upsert(dataPindah);
            if(!errAdd) { await db.from('stok_global').delete().in('qrcode', checkedValues); muatDataDariSupabase(); }
        } else {
            if(!confirm(`Unhold ${checkedValues.length} data HOLD -> tabel HASIL (Unique)?`)) return;
            const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({ 
                troli: r.troli, qrcode: r.qrcode, tgl_produksi: r.tgl_produksi, shift: r.shift, mesin: r.mesin, 
                nama_item: r.nama_item, panjang: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, 
                po_bawaan: r.po_bawaan, keterangan: r.keterangan, status: 'SUDAH STBJ', status_data: r.status_data, 
                posisi: r.posisi, pic_input: r.pic_input 
            }));
            const { error: errAdd } = await db.from('stok_global').upsert(dataPindah);
            if(!errAdd) { await db.from('hold_stbj').delete().in('qrcode', checkedValues); muatDataDariSupabase(); }
        }
    }
    else if (tipe === 'collect') {
        if(!confirm(`Tandai ${checkedValues.length} QrCode sebagai COLLECTED?`)) return;
        const btn = document.getElementById('btn-massal-collect');
        btn.innerHTML = '<div class="bg-indigo-700 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></div><div class="bg-indigo-600 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-indigo-500 transition">Collect</div>'; btn.disabled = true;
        
        const { error } = await db.from(tabelSekarang).update({ status_data: 'Collected' }).in('qrcode', checkedValues);
        if(error) alert("Gagal Update: " + error.message); 
        else { muatDataDariSupabase(); }
        
        btn.innerHTML = '<div class="bg-indigo-700 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="check-square" class="w-4 h-4"></i></div><div class="bg-indigo-600 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-indigo-500 transition">Collect</div>'; btn.disabled = false; lucide.createIcons();
    }
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
        
        let ws_data = [];
        const headers = Array.from(document.querySelectorAll('#thead-stbj th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        ws_data.push(headers);

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr');
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
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
