window.modeRiwayat = 'qr'; 
window.logLangsirRaw = []; 
window.holdLangsirRaw = [];
window.kamusData = []; 
window.areaData = []; 
window.sortState = {}; 

window.currentPage = 1;
window.rowsPerPage = 10; 
window.activeFilters = {}; 
window.currentFilterCol = ''; 

window.currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    
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
                window.closeFilterMenu();
            }
        }
    });

    setTimeout(async () => {
        const { data: mk } = await db.from('master_2').select('*'); if(mk) window.kamusData = mk;
        const { data: ma } = await db.from('master_area').select('nama_area'); 
        if(ma) {
            window.areaData = ma.map(m => m.nama_area);
            const selArea = document.getElementById('select-new-area');
            if(selArea) {
                selArea.innerHTML = '<option value="">-- PILIH AREA --</option>';
                window.areaData.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }
        await window.ambilSemuaData();
        window.gantiModeRiwayat('qr');
    }, 200);
});

window.ambilSemuaData = async function() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    try {
        const [resRiwayat, resHold] = await Promise.all([
            db.from('hasil_langsir').select('*').order('created_at', {ascending: false}).limit(1000),
            db.from('hold_langsir').select('*').order('created_at', {ascending: false})
        ]);
        
        window.logLangsirRaw = resRiwayat.data || [];
        window.holdLangsirRaw = resHold.data || [];

        window.itemMap = {}; window.dusMap = {}; window.mesinMap = {}; window.poMap = {};
        if(Array.isArray(window.kamusData)) {
            for(let i = 0; i < window.kamusData.length; i++) {
                let m = window.kamusData[i];
                if(m.kode_nama_item) window.itemMap[m.kode_nama_item] = m.nama_item;
                if(m.kode_dus) window.dusMap[m.kode_dus] = m.dus;
                if(m.kode_mesin) window.mesinMap[m.kode_mesin] = m.mesin;
                if(m.kode_po) window.poMap[m.kode_po] = m.po;
            }
        }

        window.renderTabelRiwayat();
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center text-red-500 font-medium">Error: ${e.message}</td></tr>`; 
    }
};

window.translateBarcode = function(barcode) {
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
};

window.gantiModeRiwayat = function(m) {
    window.modeRiwayat = m;
    
    const activeClass = 'pb-3 tab-active transition whitespace-nowrap flex items-center gap-2 text-sm';
    const inactiveClass = 'pb-3 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-sm';
    
    ['qr', 'agregasi', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-r-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    const btnGA = document.getElementById('btn-ganti-area'); if(btnGA) btnGA.classList.toggle('hidden', m !== 'qr');
    const btnCL = document.getElementById('btn-cancel-langsir'); if(btnCL) btnCL.classList.toggle('hidden', m !== 'qr');
    
    const userRole = (window.currentUser.role || '').toLowerCase();
    const btnHH = document.getElementById('btn-hapus-hold');
    if(btnHH) btnHH.classList.toggle('hidden', !(m === 'hold' && ['creator', 'admin', 'pic area'].includes(userRole)));

    window.activeFilters = {}; window.updateFilterIcons();
    window.renderTabelRiwayat();
};

window.renderTabelRiwayat = function() {
    try {
        const thead = document.getElementById('thead-riwayat'); const tbody = document.getElementById('tbody-riwayat');
        if(!thead || !tbody) return;
        window.sortState = {}; 

        if(window.modeRiwayat === 'qr' || window.modeRiwayat === 'hold') {
            const isHold = window.modeRiwayat === 'hold'; const dataset = isHold ? window.holdLangsirRaw : window.logLangsirRaw;
            
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="window.toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"></th>
                    ${window.thSort(1, 'Waktu Masuk', 'col-waktu')}
                    ${isHold ? window.thSort(2, 'Troli', 'col-troli') : '<th class="hdr-std hidden col-troli">-</th>'}
                    ${window.thSort(isHold?3:2, 'Area', 'col-area')}
                    ${window.thSort(isHold?4:3, 'QRCode', 'col-qr')}
                    ${window.thSort(isHold?5:4, 'Tgl Produksi', 'col-tgl')}
                    ${window.thSort(isHold?6:5, 'Mesin', 'col-mesin')}
                    ${window.thSort(isHold?7:6, 'Shift', 'col-shift')}
                    ${window.thSort(isHold?8:7, 'Jenis Item', 'col-jenis')}
                    ${window.thSort(isHold?9:8, 'Nama Item', 'col-nama')}
                    ${window.thSort(isHold?10:9, 'Panjang', 'col-pjg')}
                    ${window.thSort(isHold?11:10, 'Grade', 'col-grade')}
                    ${window.thSort(isHold?12:11, 'Dus', 'col-dus')}
                    ${window.thSort(isHold?13:12, 'Shading', 'col-shading')}
                    ${window.thSort(isHold?14:13, 'PO Bawaan', 'col-po')}
                    ${isHold ? window.thSort(15, 'Keterangan', 'col-ket') : '<th class="hdr-std hidden col-ket">-</th>'}
                    ${window.thSort(isHold?16:14, 'PIC', 'col-pic')}
                </tr>`;
            
            if(!dataset || dataset.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="18" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; window.applyPagination(); return; }
            
            let h = '';
            dataset.forEach((r, i) => {
                const dt = new Date(r.created_at);
                const tgl = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

                h += `
                    <tr class="hover:bg-slate-100 even:bg-slate-50 transition r-row text-sm border-b border-slate-100">
                        <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="window.highlightRow(this)" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                        <td class="px-4 py-3 text-slate-600 font-medium col-waktu" data-search="${tgl}">${tgl}</td>
                        ${isHold ? `<td class="px-4 py-3 font-medium text-slate-700 col-troli" data-search="${r.troli || '-'}">${r.troli || '-'}</td>` : `<td class="px-4 py-3 hidden col-troli">-</td>`}
                        <td class="px-4 py-3 col-area" data-search="${r.area || '-'}"><span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-semibold">${r.area || '-'}</span></td>
                        <td class="px-4 py-3 font-mono font-medium text-slate-800 tracking-wider col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 col-tgl" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 col-mesin" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-600 col-shift" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                        <td class="px-4 py-3 font-medium text-blue-600 col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                        <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                        <td class="px-4 py-3 font-medium text-orange-600 col-po" data-search="${r.po_bawaan || '-'}">${r.po_bawaan || '-'}</td>
                        ${isHold ? `<td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>` : `<td class="px-4 py-3 hidden col-ket">-</td>`}
                        <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 col-pic" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        } 
        else if(window.modeRiwayat === 'agregasi') {
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="window.toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"></th>
                    ${window.thSort(1, 'Area', 'col-area')}
                    ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                    ${window.thSort(3, 'Nama Item', 'col-nama')}
                    ${window.thSort(4, 'Panjang', 'col-pjg')}
                    ${window.thSort(5, 'Grade', 'col-grade')}
                    ${window.thSort(6, 'Dus', 'col-dus')}
                    ${window.thSort(7, 'Shading', 'col-shading')}
                    ${window.thSort(8, 'PO Bawaan', 'col-po')}
                    ${window.thSort(9, 'PIC', 'col-pic')}
                    ${window.thSort(10, 'QTY TOTAL (DUS)', 'col-qty')}
                </tr>`;

            let groups = {};
            window.logLangsirRaw.forEach(r => {
                let key = `${r.area}_${r.jenis_item}_${r.nama_item}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.po_bawaan}_${r.pic_input}`;
                if(!groups[key]) groups[key] = { area: r.area, jenis: r.jenis_item, nama: r.nama_item, pjg: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, po: r.po_bawaan, pic: r.pic_input, qty: 0 };
                groups[key].qty++;
            });

            let arr = Object.values(groups);
            if(arr.length === 0) { tbody.innerHTML = `<tr id="empty-row-langsir"><td colspan="12" class="p-8 text-center font-medium text-slate-400">Kosong.</td></tr>`; window.applyPagination(); return; }

            let h = '';
            arr.forEach((r) => {
                h += `
                    <tr class="hover:bg-slate-100 even:bg-slate-50 transition r-row text-sm border-b border-slate-100">
                        <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="window.highlightRow(this)" value="agg" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
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
        lucide.createIcons(); window.saringTabelExcel();
    } catch(err) { console.error("Gagal Render Tabel:", err); }
};

window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-riwayat');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row'));
    let isAsc = window.sortState[colIndex] !== 'asc'; window.sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
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
    window.applyPagination();
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="window.openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-200 rounded ml-1 transition text-slate-400 hover:text-slate-700" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon transition-all"></i>
        </button>`;

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center justify-center gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-slate-800 transition" onclick="window.sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

window.changeRowsPerPage = function(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        window.rowsPerPage = 999999; 
        customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        customInput.classList.remove('hidden');
        customInput.focus();
        let customVal = parseInt(customInput.value);
        window.rowsPerPage = (customVal > 0) ? customVal : window.rowsPerPage;
    } else {
        window.rowsPerPage = parseInt(val);
        customInput.classList.add('hidden');
    }
    window.currentPage = 1; 
    window.applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        window.rowsPerPage = parsed;
        window.currentPage = 1;
        window.applyPagination();
    }
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / window.rowsPerPage) || 1;
    
    if(window.currentPage > totalPages) window.currentPage = totalPages; 
    if(window.currentPage < 1) window.currentPage = 1;

    const startIndex = (window.currentPage - 1) * window.rowsPerPage; const endIndex = startIndex + window.rowsPerPage;
    let sumQty = 0;

    visibleRows.forEach((row, index) => {
        const qtyCell = row.querySelector('.col-qty');
        if (qtyCell && window.modeRiwayat === 'agregasi') { 
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
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = window.currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    window.updateSelectedCount();
};

window.prevPage = function() { if(window.currentPage > 1) { window.currentPage--; window.applyPagination(); } };
window.nextPage = function() { 
    const totalVisible = document.querySelectorAll('#tbody-riwayat tr.r-row:not(.filtered-out)').length;
    if(window.currentPage < Math.ceil(totalVisible / window.rowsPerPage)) { window.currentPage++; window.applyPagination(); } 
};

window.updateSelectedCount = function() {
    const count = document.querySelectorAll('.cb-row:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
};

window.toggleSemuaCentang = function(checked) { 
    document.querySelectorAll('.cb-row').forEach(cb => {
        const row = cb.closest('tr'); if (row && row.style.display !== 'none' && !row.classList.contains('filtered-out')) { cb.checked = checked; window.highlightRow(cb); }
    });
};

window.highlightRow = function(cb) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    window.updateSelectedCount();
};

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}
