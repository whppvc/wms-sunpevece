let rawData = []; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
let selectAllState = 0; 
let userColOrder = []; 

// State untuk Proses Ganti Customer
let activeRequestRow = null;
let scannedValidItems = [];

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

function formatWIB(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
}

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_ganti_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } } 
    else { userColOrder = []; }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) {
            let found = false;
            Array.from(sel.options).forEach(opt => { if(opt.value == rowsPerPage) { opt.selected = true; found = true; } });
            if(!found) {
                sel.value = 'CUSTOM';
                const inp = document.getElementById('input-custom-rows');
                if(inp) { inp.classList.remove('hidden'); inp.value = rowsPerPage; }
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'ganti_customer', title: 'TABLE GANTI CUSTOMER', url: 'ganti_customer.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) { window.closeFilterMenu(); }
        }
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) { actionMenu.classList.add('hidden'); }
        }
    });

    window.loadUserPreferences(); 
    setTimeout(window.muatData, 200);
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
};

window.muatData = async function() {
    const tbody = document.getElementById('tbody-ganti');
    tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menarik Data...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('ganti_customer').select('*').order('created_at', { ascending: false });
        if(error) throw error;
        rawData = data || [];
        window.renderTabel();
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center text-red-500 font-medium">Gagal: ${e.message}</td></tr>`; 
    }
};

window.hapusRequest = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin dihapus terlebih dahulu!");
    if(!confirm(`Yakin ingin menghapus ${checked.length} data ini secara permanen?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        const { error } = await db.from('ganti_customer').delete().in('id', ids);
        if(error) throw error;
        alert("Berhasil menghapus data!");
        window.muatData();
    } catch(e) { 
        alert("Gagal menghapus: " + e.message); 
    }
};

window.cancelRequest = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris request yang ingin di-cancel terlebih dahulu!");
    if(!confirm(`Yakin ingin membatalkan (Cancel) ${checked.length} request ganti customer ini?\n(Status di Kartu Stok akan otomatis kembali menjadi tombol 'Proses')`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        const { error } = await db.from('ganti_customer').delete().in('id', ids);
        if(error) throw error;
        alert("Request berhasil dibatalkan!");
        window.muatData();
    } catch(e) { 
        alert("Gagal membatalkan request: " + e.message); 
    }
};

window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-ganti');
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
    window.applyPagination();
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-progres'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="window.sortTable(${idx}, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="window.sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="window.openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
};

window.renderTabel = function() {
    const thead = document.getElementById('thead-ganti');
    const tbody = document.getElementById('tbody-ganti');
    sortState = {}; selectAllState = 0;

    // REVISI: Kolom Proses dihapus, diganti Progres
    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
            </th>
            ${window.thSort(1, 'Waktu Request', 'col-tgl')}
            ${window.thSort(2, 'Area', 'col-area')}
            ${window.thSort(3, 'Jenis Item', 'col-jenis')}
            ${window.thSort(4, 'Nama Item', 'col-nama')}
            ${window.thSort(5, 'Panjang', 'col-pjg')}
            ${window.thSort(6, 'Grade', 'col-grade')}
            ${window.thSort(7, 'Dus', 'col-dus')}
            ${window.thSort(8, 'Shading', 'col-shading')}
            ${window.thSort(9, 'Customer Aktual', 'col-cust_awal')}
            ${window.thSort(10, 'Customer Request', 'col-cust_req text-purple-300')}
            ${window.thSort(11, 'Qty Request', 'col-qty_req')}
            ${window.thSort(12, 'Qty Proses', 'col-qty_proses')}
            <th class="hdr-std w-24 col-progres text-center">Progres</th>
        </tr>`;
    
    if(rawData.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; return; }

    tbody.innerHTML = rawData.map((r) => {
        const tgl = formatWIB(r.created_at);
        
        let badgeProgres = `<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold text-[10px] border border-slate-200">PENDING</span>`;
        if(r.progres === 'DONE') {
            badgeProgres = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-[10px] border border-emerald-200 flex items-center justify-center gap-1 w-max mx-auto"><i data-lucide="check-circle-2" class="w-3 h-3"></i> DONE</span>`;
        } else if(r.progres === 'PROSES') {
            badgeProgres = `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-[10px] border border-amber-200">PROSES</span>`;
        }
        
        return `
            <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-medium text-slate-600 text-center col-tgl" data-search="${tgl}">${tgl}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left col-area" data-search="${r.area || '-'}">${r.area || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-cust_awal" data-search="${r.customer_aktual_awal || '-'}">${r.customer_aktual_awal || '-'}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-cust_req" data-search="${r.customer_aktual_request || '-'}">${r.customer_aktual_request || '-'}</td>
                <td class="px-4 py-3 font-black text-slate-700 text-center col-qty_req" data-search="${r.qty_request || 0}">${r.qty_request || 0}</td>
                <td class="px-4 py-3 font-black text-emerald-600 text-center col-qty_proses" data-search="${r.qty_proses || 0}">${r.qty_proses || 0}</td>
                <td class="px-4 py-3 text-center col-progres" data-search="${r.progres || 'PENDING'}">
                    ${badgeProgres}
                </td>
            </tr>`;
    }).join('');

    window.applyColumnOrder(); 
    lucide.createIcons(); 
    window.updateSelectAllUI();
    window.saringTabelExcel(); 
    window.initResizableColumns(); 
};

// ==========================================
// LOGIKA PROSES GANTI CUSTOMER (SCAN FISIK)
// ==========================================
window.bukaModalProsesGanti = function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length !== 1) return alert("Pilih TEPAT 1 baris request yang ingin diproses!");
    
    const idReq = checked[0].value;
    activeRequestRow = rawData.find(r => r.id == idReq);
    
    if(activeRequestRow.progres === 'DONE') return alert("Request ini sudah selesai (DONE)!");

    document.getElementById('input-scan-ganti').value = '';
    document.getElementById('modal-scan-ganti').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-scan-ganti').focus(), 100);
};

window.prosesKodeScan = async function() {
    const rawInput = document.getElementById('input-scan-ganti').value.trim();
    if(!rawInput) return alert("Masukkan kode QR!");
    
    const btn = document.getElementById('btn-proses-kode'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    const qrs = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    try {
        // Ambil data dari stok_global berdasarkan QR yang di-scan
        const { data, error } = await db.from('stok_global').select('*').in('qrcode', qrs);
        if(error) throw error;
        
        if(!data || data.length === 0) {
            alert("QR Code tidak ditemukan di gudang (stok_global)!");
            btn.innerHTML = ori; btn.disabled = false; return;
        }

        let invalidQrs = [];
        scannedValidItems = [];

        data.forEach(item => {
            // Ekstrak customer aktual dari id_sku (Format: Area_Nama_Pjg_Grade_Dus_Shading_Customer_Ket)
            let parts = (item.id_sku || '').split('_');
            let custAktual = parts.length >= 7 ? parts[6] : item.customer_bawaan;

            // Validasi kecocokan spesifikasi dengan request
            if (
                item.nama_item === activeRequestRow.nama_item &&
                item.panjang === activeRequestRow.panjang &&
                item.grade === activeRequestRow.grade &&
                item.dus === activeRequestRow.dus &&
                item.shading === activeRequestRow.shading &&
                custAktual === activeRequestRow.customer_aktual_awal
            ) {
                scannedValidItems.push(item);
            } else {
                invalidQrs.push(item.qrcode);
            }
        });

        if(invalidQrs.length > 0) {
            alert(`Terdapat ${invalidQrs.length} QR Code yang spesifikasinya TIDAK SAMA dengan request!\n\nQR: ${invalidQrs.join(', ')}`);
            btn.innerHTML = ori; btn.disabled = false; return;
        }

        // Render tabel konfirmasi
        let html = '';
        scannedValidItems.forEach((item, idx) => {
            let detail = `${item.nama_item} | ${item.panjang} | ${item.grade} | ${item.dus} | ${item.shading} | ${item.keterangan || '-'}`;
            html += `<tr class="hover:bg-slate-50 transition">
                <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
                <td class="p-3 font-semibold text-emerald-700">${item.area}</td>
                <td class="p-3 font-mono font-bold text-slate-800">${item.qrcode}</td>
                <td class="p-3 font-medium text-slate-600">${detail}</td>
            </tr>`;
        });
        
        document.getElementById('lbl-jml-valid').innerText = scannedValidItems.length;
        document.getElementById('tbody-konfirmasi-ganti').innerHTML = html;
        
        document.getElementById('modal-scan-ganti').classList.add('hidden');
        document.getElementById('modal-konfirmasi-ganti').classList.remove('hidden');

    } catch(e) {
        alert("Gagal memproses kode: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
};

window.eksekusiGantiFinal = async function() {
    const btn = document.getElementById('btn-eksekusi-final'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    let qtyToProcess = scannedValidItems.length;
    let oldCust = activeRequestRow.customer_aktual_awal;
    let newCust = activeRequestRow.customer_aktual_request;

    try {
        // 1. Update stok_qr & stok_global (Ganti id_sku)
        for(let item of scannedValidItems) {
            let parts = item.id_sku.split('_');
            if(parts.length >= 7) parts[6] = newCust;
            let new_id_sku = parts.join('_');

            await db.from('stok_qr').update({ id_sku: new_id_sku }).eq('qrcode', item.qrcode);
            await db.from('stok_global').update({ id_sku: new_id_sku }).eq('qrcode', item.qrcode);
        }

        // 2. Siapkan Map untuk Incremental Update stok_aktual
        let deductMap = {};
        let addMap = {};

        scannedValidItems.forEach(item => {
            let ket = item.keterangan || '-';
            let keyOld = `${item.nama_item}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${item.area}_${oldCust}_${ket}`;
            let keyNew = `${item.nama_item}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${item.area}_${newCust}_${ket}`;

            if(!deductMap[keyOld]) deductMap[keyOld] = { ...item, customer_aktual: oldCust, qty: 0 };
            deductMap[keyOld].qty++;

            if(!addMap[keyNew]) {
                let parts = item.id_sku.split('_');
                if(parts.length >= 7) parts[6] = newCust;
                addMap[keyNew] = { ...item, id_sku: parts.join('_'), customer_aktual: newCust, qty: 0 };
            }
            addMap[keyNew].qty++;
        });

        // 3. Eksekusi Pengurangan (Deduct)
        for(let k in deductMap) {
            let u = deductMap[k];
            const { data: ext } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', u.nama_item).eq('panjang', u.panjang).eq('grade', u.grade)
                .eq('dus', u.dus).eq('shading', u.shading).eq('area', u.area)
                .eq('customer_aktual', u.customer_aktual).eq('keterangan', u.keterangan || '-')
                .limit(1);
            
            if(ext && ext.length > 0) {
                let newQty = ext[0].qty - u.qty;
                if(newQty <= 0) await db.from('stok_aktual').delete().eq('id', ext[0].id);
                else await db.from('stok_aktual').update({qty: newQty}).eq('id', ext[0].id);
            }
        }

        // 4. Eksekusi Penambahan (Add)
        for(let k in addMap) {
            let a = addMap[k];
            const { data: ext } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', a.nama_item).eq('panjang', a.panjang).eq('grade', a.grade)
                .eq('dus', a.dus).eq('shading', a.shading).eq('area', a.area)
                .eq('customer_aktual', a.customer_aktual).eq('keterangan', a.keterangan || '-')
                .limit(1);
            
            if(ext && ext.length > 0) {
                await db.from('stok_aktual').update({qty: ext[0].qty + a.qty}).eq('id', ext[0].id);
            } else {
                await db.from('stok_aktual').insert([{
                    id_sku: a.id_sku, jenis_item: a.jenis_item, nama_item: a.nama_item, panjang: a.panjang, 
                    grade: a.grade, dus: a.dus, shading: a.shading, area: a.area, 
                    customer_aktual: a.customer_aktual, keterangan: a.keterangan || '-', qty: a.qty
                }]);
            }
        }

        // 5. Update Progres di tabel ganti_customer
        let newQtyProses = (parseInt(activeRequestRow.qty_proses) || 0) + qtyToProcess;
        let newProgres = newQtyProses >= parseInt(activeRequestRow.qty_request) ? 'DONE' : 'PROSES';
        
        await db.from('ganti_customer').update({ qty_proses: newQtyProses, progres: newProgres }).eq('id', activeRequestRow.id);

        alert(`✅ SUKSES!\n${qtyToProcess} dus berhasil diganti customernya menjadi ${newCust}.`);
        
        document.getElementById('modal-konfirmasi-ganti').classList.add('hidden');
        window.muatData(); // Refresh tabel utama
        
    } catch(e) {
        alert("Gagal memproses ganti customer: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
};

// ==========================================
// FUNGSI STANDAR (PAGINASI, FILTER, EXCEL)
// ==========================================
window.highlightRow = function(checkbox, skipStateReset = false) {
    const tr = checkbox.closest('tr');
    if (checkbox.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
    
    if(!skipStateReset && !checkbox.checked && selectAllState !== 0) { selectAllState = 0; window.updateSelectAllUI(); }
    if(!skipStateReset) window.updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') { rowsPerPage = 999999; if(customInput) customInput.classList.add('hidden'); } 
    else if (val === 'CUSTOM') {
        if(customInput) { customInput.classList.remove('hidden'); customInput.focus(); rowsPerPage = parseInt(customInput.value) || rowsPerPage; }
    } else { rowsPerPage = parseInt(val); if(customInput) customInput.classList.add('hidden'); }
    localStorage.setItem('wms_rows_per_page', rowsPerPage); currentPage = 1; window.applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) { rowsPerPage = parsed; localStorage.setItem('wms_rows_per_page', rowsPerPage); currentPage = 1; window.applyPagination(); }
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-ganti tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });

    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1'); else row.classList.add('stripe-2');

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (selectAllState === 1) { selectAllState = 0; window.updateSelectAllUI(); }
    window.applySelection(); window.updateSelectedCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; window.applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-ganti tr.r-row:not(.filtered-out)').length; if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; window.applyPagination(); } };
window.updateSelectedCount = function() { const count = document.querySelectorAll('.cb-main:checked').length; if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count; };

window.cycleSelectAll = function() { selectAllState = (selectAllState + 1) % 3; window.updateSelectAllUI(); window.applySelection(); };
window.updateSelectAllUI = function() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto'; } 
    else if (selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto'; } 
    else if (selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto'; }
    lucide.createIcons();
};
window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-ganti tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) { allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }); } 
    else if (selectAllState === 1) {
        allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } });
        visibleRows.forEach((row, index) => { if(index >= startIndex && index < endIndex) { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; window.highlightRow(cb, true); } } });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; window.highlightRow(cb, true); } });
    }
    window.updateSelectedCount();
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-ganti tr.r-row').forEach(row => {
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
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    sortedValues.forEach(val => {
        let isChecked = true; if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}"><input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> <span class="truncate text-slate-600">${val}</span></label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; window.updateSelectAllState(); document.getElementById('filter-search-input').value = '';
    const menu = document.getElementById('excel-filter-menu'); menu.classList.remove('hidden');
    const btnRect = event.currentTarget.getBoundingClientRect(); const menuWidth = 256; 
    let topPos = btnRect.bottom + 4; let leftPos = btnRect.left; 
    if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
    if (leftPos < 10) { leftPos = 10; }
    menu.style.position = 'fixed'; menu.style.top = `${topPos}px`; menu.style.left = `${leftPos}px`;
    document.getElementById('filter-search-input').focus();
};

window.toggleAllFilterValues = function(checked) { document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; }); window.updateSelectAllState(); };
window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};
document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) window.updateSelectAllState(); });
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
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }
    });
    selectAllState = 0; window.updateSelectAllUI(); currentPage = 1; window.applyPagination(); window.updateFilterIcons();
};
window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};

window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin!");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-ganti th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
            if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(val.replace(/\n/g, ' ')); }
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => { alert("Berhasil menyalin!"); }).catch(err => { alert("Browser menolak akses Clipboard."); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat.");
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-ganti th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);
    document.querySelectorAll('.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
                if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(`"${val.replace(/\n/g, ' ')}"`); }
            });
            ws_data.push(rowData);
        }
    });
    if(ws_data.length <= 1) return alert("Pilih minimal 1 baris data untuk di-export!");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ganti_Customer"); XLSX.writeFile(wb, `Ganti_Customer.xlsx`);
};

window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); window.renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-ganti th')).filter(th => th && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; const label = th.innerText.trim() || 'Kolom';
        const div = document.createElement('div'); div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab'; div.draggable = true; div.setAttribute('data-col', colClass);
        div.innerHTML = `<span class="font-bold text-slate-700 text-xs">${label}</span><i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>`;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); }); div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = window.getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    userColOrder = newOrder; localStorage.setItem(`col_order_ganti_${currentUser.username}`, JSON.stringify(newOrder));
    alert("Urutan kolom berhasil disimpan!"); window.toggleSidebarKolom(); window.renderTabel(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    userColOrder = []; localStorage.removeItem(`col_order_ganti_${currentUser.username}`);
    alert("Urutan dikembalikan ke default."); window.toggleSidebarKolom(); window.renderTabel();
};

window.applyColumnOrder = function() {
    if (!userColOrder || userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb')); const btnCell = cells.find(c => c.classList.contains('col-btn'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; if (cbCell) row.appendChild(cbCell); if (btnCell) row.appendChild(btnCell); 
        userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && colClass !== 'col-btn' && !userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
};

window.initResizableColumns = function() {
    const cols = document.querySelectorAll('#main-table th');
    cols.forEach(col => {
        const existing = col.querySelector('.resizer'); if(existing) existing.remove();
        const resizer = document.createElement('div'); resizer.classList.add('resizer'); col.appendChild(resizer);
        let x = 0; let w = 0;
        resizer.addEventListener('mousedown', function(e) {
            x = e.clientX; w = parseInt(window.getComputedStyle(col).width, 10);
            document.addEventListener('mousemove', mouseMoveHandler); document.addEventListener('mouseup', mouseUpHandler); resizer.classList.add('resizing');
        });
        const mouseMoveHandler = function(e) { const dx = e.clientX - x; col.style.width = `${w + dx}px`; col.style.minWidth = `${w + dx}px`; };
        const mouseUpHandler = function() { document.removeEventListener('mousemove', mouseMoveHandler); document.removeEventListener('mouseup', mouseUpHandler); resizer.classList.remove('resizing'); };
    });
};
