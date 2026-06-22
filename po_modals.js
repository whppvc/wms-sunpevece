// ========================================================
// SORTING & FILTER EXCEL PRO
// ========================================================
window.sortTable = function(colIndex, headerEl) {
    let tbodyId = currentMode === 'atur' ? 'tbody-atur' : (currentMode === 'picking' ? 'tbody-picking' : 'tbody-po');
    let rowClass = currentMode === 'picking' ? 'tr.r-row-pick' : 'tr.r-row';
    
    const tbody = document.getElementById(tbodyId);
    const rows = Array.from(tbody.querySelectorAll(rowClass));
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
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no', 'col-atur', 'col-pick'].includes(colClass);
    
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

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick' : '#tbody-po tr.r-row');

    document.querySelectorAll(tbodyId).forEach(row => {
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
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    updateSelectAllState();
};
window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};

window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
};
window.closeFilterMenu = function() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); };
window.clearFilterForCurrentCol = function() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); updateFilterIcons(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcel(); updateFilterIcons();
};
window.saringTabelExcel = function() {
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick' : '#tbody-po tr.r-row');
    document.querySelectorAll(tbodyId).forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row') || row.querySelector('.pick-row-cb'); if(cb) { cb.checked = false; highlightRow(cb); } }
    });
    currentPage = 1; applyPagination();
};
window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('opacity-40', 'text-white'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};

// ========================================================
// PAGINASI & RENDER TABEL
// ========================================================
window.changeRowsPerPage = function(val) {
    if (val === 'ALL') { rowsPerPage = 999999; } 
    else { rowsPerPage = parseInt(val); }
    currentPage = 1; applyPagination();
};

window.applyPagination = function() {
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick' : '#tbody-po tr.r-row');
    const allRows = Array.from(document.querySelectorAll(tbodyId));
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
    
    if(currentMode === 'picking') updateSelectedPickCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; applyPagination(); } };
window.nextPage = function() { 
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row:not(.filtered-out)' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick:not(.filtered-out)' : '#tbody-po tr.r-row:not(.filtered-out)');
    const totalVisible = document.querySelectorAll(tbodyId).length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
};

window.highlightRow = function(cb) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
};

window.initResizableColumns = function() {
    const cols = document.querySelectorAll('#main-table th, #table-atur th, #table-picking th');
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
};

// ==========================================
// FUNGSI PICKING LIST & MODAL
// ==========================================
window.batalPickItem = async function(id_picking, qty_pick) {
    if(!confirm("Batalkan pick item ini? Qty terpenuhi pada PO akan dikurangi otomatis.")) return;
    
    try {
        const { error: errDel } = await db.from('po_atur').delete().eq('id', id_picking);
        if(errDel) throw errDel;
        
        const newQty = Math.max(0, (activePO.qty_terpenuhi || 0) - qty_pick);
        const { error: errPo } = await db.from('po_estimasi').update({ qty_terpenuhi: newQty }).eq('id', activePO.id);
        if(errPo) throw errPo;
        
        await muatDataEstimasiDB(); 
        aturItemPO(activePO.id); 
    } catch(e) {
        alert("Gagal membatalkan pick: " + e.message);
    }
};

window.bukaModalPick = function(index) {
    activePickItem = dataAturItem[index];
    document.getElementById('lbl-max-pick').innerText = activePickItem.qty;
    document.getElementById('input-qty-pick').value = '';
    document.getElementById('modal-pick-qty').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qty-pick').focus(), 100);
};

window.cekCustomerPick = function() {
    tempQtyPick = parseInt(document.getElementById('input-qty-pick').value);
    if(isNaN(tempQtyPick) || tempQtyPick <= 0) return alert("Jumlah dus tidak valid!");
    if(tempQtyPick > activePickItem.qty) return alert(`Maksimal dus yang bisa diambil adalah ${activePickItem.qty}!`);

    document.getElementById('modal-pick-qty').classList.add('hidden');

    if(activePickItem.customer_aktual !== activePO.customer_po) {
        document.getElementById('lbl-cust-lama').innerText = activePickItem.customer_aktual;
        document.getElementById('lbl-cust-baru').innerText = activePO.customer_po;
        document.getElementById('modal-confirm-customer').classList.remove('hidden');
    } else {
        eksekusiPickFinal(false);
    }
};

window.eksekusiPickFinal = async function(isGantiCustomer) {
    let finalIdSku = activePickItem.id_sku;

    if(isGantiCustomer) {
        const btn = document.getElementById('btn-ganti-cust'); const ori = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Proses...'; btn.disabled = true;
        
        try {
            const { error } = await db.rpc('ganti_customer_aktual_ks_v2', { 
                p_id_sku: activePickItem.id_sku,
                p_customer_lama: activePickItem.customer_aktual,
                p_customer_baru: activePO.customer_po,
                p_qty: tempQtyPick
            });
            if(error) throw error;

            let parts = activePickItem.id_sku.split('_');
            if(parts.length >= 8) {
                parts[6] = activePO.customer_po; 
                finalIdSku = parts.join('_');
            }

        } catch(e) {
            alert("Gagal mengganti Customer Aktual: " + e.message);
            btn.innerHTML = ori; btn.disabled = false; return;
        }
        btn.innerHTML = ori; btn.disabled = false;
        document.getElementById('modal-confirm-customer').classList.add('hidden');
    }

    try {
        const payloadPick = {
            kode_po: activePO.kode_po,
            tgl_estimasi: activePO.tgl_estimasi_kirim,
            customer_po: activePO.customer_po,
            area: activePickItem.area,
            jenis_item: activePickItem.jenis_item,
            nama_item: activePickItem.nama_item,
            panjang: activePickItem.panjang,
            grade: activePickItem.grade,
            dus: activePickItem.dus,
            shading: activePickItem.shading,
            keterangan: activePickItem.keterangan,
            qty_pick: tempQtyPick,
            customer_aktual: isGantiCustomer ? activePO.customer_po : activePickItem.customer_aktual,
            id_po: activePO.id_po,
            id_sku: finalIdSku
        };
        const { error: errPick } = await db.from('po_atur').insert([payloadPick]);
        if(errPick) throw errPick;

        const newQtyTerpenuhi = (activePO.qty_terpenuhi || 0) + tempQtyPick;
        const { error: errPo } = await db.from('po_estimasi').update({ qty_terpenuhi: newQtyTerpenuhi }).eq('id', activePO.id);
        if(errPo) throw errPo;

        await muatDataEstimasiDB(); 
        aturItemPO(activePO.id); 

    } catch(e) {
        alert("Gagal memproses Pick Item: " + e.message);
    }
};

window.updateSelectedPickCount = function() {
    const checkedBoxes = document.querySelectorAll('.pick-row-cb:checked');
    let totalQty = 0;
    checkedBoxes.forEach(cb => {
        totalQty += parseInt(cb.getAttribute('data-qty')) || 0;
        const tr = cb.closest('tr');
        if(cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    });
    document.getElementById('lbl-pilih-baris').innerText = totalQty;
};

window.toggleAllPickingRows = function(checked) {
    document.querySelectorAll('#tbody-picking .r-row-pick').forEach(row => {
        if (!row.classList.contains('filtered-out') && row.style.display !== 'none') {
            const cb = row.querySelector('.pick-row-cb');
            if (cb) {
                cb.checked = checked;
                if(checked) row.classList.add('selected-row');
                else row.classList.remove('selected-row');
            }
        }
    });
    updateSelectedPickCount();
};

window.bukaModalEditTgl = function() {
    const checkedBoxes = document.querySelectorAll('.pick-row-cb:checked');
    if(checkedBoxes.length === 0) return alert("Centang minimal 1 baris di Picking List yang ingin diubah tanggalnya!");
    
    document.getElementById('input-tgl-baru').value = '';
    document.getElementById('modal-edit-tgl').classList.remove('hidden');
};

window.simpanEditTgl = async function() {
    const tglBaru = document.getElementById('input-tgl-baru').value;
    if(!tglBaru) return alert("Pilih tanggal baru terlebih dahulu!");

    const checkedBoxes = document.querySelectorAll('.pick-row-cb:checked');
    const btn = document.getElementById('btn-simpan-tgl');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> PROSES...';
    btn.disabled = true;

    try {
        let poSet = new Set();
        let pickIds = [];

        checkedBoxes.forEach(cb => {
            poSet.add(cb.getAttribute('data-kodepo'));
            pickIds.push(cb.value);
        });

        const arrPo = Array.from(poSet);

        if(arrPo.length > 0) {
            const { error: errPo } = await db.from('po_estimasi').update({ tgl_estimasi_kirim: tglBaru }).in('kode_po', arrPo);
            if(errPo) throw errPo;
        }

        if(pickIds.length > 0) {
            const { error: errPick } = await db.from('po_atur').update({ tgl_estimasi: tglBaru }).in('id', pickIds);
            if(errPick) throw errPick;
        }

        alert("Berhasil mengubah Tanggal Estimasi!");
        document.getElementById('modal-edit-tgl').classList.add('hidden');
        
        await muatDataPickingDB();
        await muatDataEstimasiDB();

    } catch(e) {
        alert("Gagal mengubah tanggal: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.tutupSemuaModal = function() {
    document.getElementById('modal-pick-qty').classList.add('hidden');
    document.getElementById('modal-confirm-customer').classList.add('hidden');
    document.getElementById('modal-pilih-master').classList.add('hidden');
    document.getElementById('modal-edit-tgl').classList.add('hidden');
};
