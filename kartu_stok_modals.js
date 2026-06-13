// ========================================================
// FILTER EXCEL PRO (SMART FILTERING)
// ========================================================
window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation();
    window.currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-ks tr.row-ks').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in window.activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = window.activeFilters[otherCol];
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
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = true;
        if (window.activeFilters[colClass] && !window.activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml;
    window.updateSelectAllState();
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
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    window.updateSelectAllState();
};

window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb');
    const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all');
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
        let matches = query.every(term => text.includes(term));
        label.style.display = matches ? '' : 'none';
    });
};

window.closeFilterMenu = function() { document.getElementById('excel-filter-menu').classList.add('hidden'); };

window.clearFilterForCurrentCol = function() {
    delete window.activeFilters[window.currentFilterCol];
    window.closeFilterMenu(); window.saringTabelExcel(); window.updateFilterIcons();
};

window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked');
    const totalBoxes = document.querySelectorAll('.filter-val-cb');
    
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') {
        delete window.activeFilters[window.currentFilterCol];
    } else {
        let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value));
        window.activeFilters[window.currentFilterCol] = selectedVals;
    }
    
    window.closeFilterMenu(); window.saringTabelExcel(); window.updateFilterIcons();
};

window.saringTabelExcel = function() {
    document.querySelectorAll('.row-ks').forEach(row => {
        let show = true;
        for (let colClass in window.activeFilters) {
            const allowedValues = window.activeFilters[colClass];
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
            let cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = false; window.highlightRow(cb); } 
        }
    });
    window.currentPage = 1; 
    window.applyPagination(); 
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-blue-600');
        icon.classList.add('text-slate-400');
    });
    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            const icon = th.querySelector('.filter-icon');
            if (icon) { icon.classList.remove('text-slate-400'); icon.classList.add('text-blue-600'); }
        }
    }
};

// ========================================================
// ACTION HANDLERS & MODALS
// ========================================================
window.tutupSemuaPopups = function() {
    document.getElementById('modal-lihat-po').classList.add('hidden');
    document.getElementById('modal-breakdown').classList.add('hidden');
    document.getElementById('modal-ket').classList.add('hidden');
    document.getElementById('modal-po').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
};

window.bukaBreakdown = function(gKey) {
    const item = window.dataKSGlobal.find(g => g.gKey === gKey); if(!item) return;

    document.getElementById('bd-title-item').innerText = `${item.nama} | ${item.pjg} | ${item.grade} | DUS: ${item.dus} | SHADING: ${item.shading} | KET: ${item.ket}`;
    window.currentBreakdownData = item.areas;

    const tbody = document.getElementById('tbody-breakdown');
    tbody.innerHTML = item.areas.map((a, i) => {
        const safeQRs = JSON.stringify(a.qrcodes).replace(/"/g, "&quot;");
        return `
            <tr class="hover:bg-slate-50 transition bd-row text-sm border-b border-slate-100">
                <td class="p-3 text-center"><input type="checkbox" onchange="window.highlightBdRow(this)" data-idsku="${a.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po}" data-ket="${a.ket}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"></td>
                <td class="p-3 font-semibold text-emerald-700 bg-emerald-50/50">${a.area}</td>
                <td class="p-3 font-semibold text-orange-600 col-po">${a.po}</td>
                <td class="p-3 font-medium text-slate-600 text-left whitespace-normal min-w-[200px]">${a.ket}</td>
                <td class="p-3 font-black text-emerald-700">${a.qty}</td>
            </tr>`;
    }).join('');

    document.getElementById('modal-breakdown').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalBreakdown = function() { document.getElementById('modal-breakdown').classList.add('hidden'); document.getElementById('overlay-klik-luar').classList.add('hidden'); };

window.highlightBdRow = function(cb) {
    const tr = cb.closest('tr');
    if(cb.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
};

window.toggleCentangBreakdown = function(checked) { 
    document.querySelectorAll('.cb-bd').forEach(cb => { cb.checked = checked; window.highlightBdRow(cb); }); 
};

// REVISI: Modal Lihat PO
window.bukaModalLihatPO = function(encodedPOs) {
    const poStr = decodeURIComponent(encodedPOs);
    const poArr = poStr.split('|').map(p => p.trim()).filter(p => p);
    const ul = document.getElementById('list-po-aktual');
    if (poArr.length === 0 || poArr[0] === 'KOSONG') {
        ul.innerHTML = '<li class="text-slate-400 italic font-medium p-3 bg-slate-50 rounded-md text-center border border-slate-200">Tidak ada PO Aktual tersimpan.</li>';
    } else {
        ul.innerHTML = poArr.map(p => {
            let parts = p.split('(');
            let namaPo = parts[0].trim();
            let qtyPo = parts[1] ? parts[1].replace(')', '').trim() : '';
            return `<li class="p-3 bg-white border border-slate-200 shadow-sm text-slate-700 font-semibold rounded-md flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-orange-500"></i> <span>${namaPo}</span></div> 
                        <span class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-black">${qtyPo}</span>
                    </li>`;
        }).join('');
    }
    lucide.createIcons();
    document.getElementById('modal-lihat-po').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.siapkanEditKet = function(context) {
    let checkboxes = context === 'main' ? document.querySelectorAll('.cb-main:checked') : document.querySelectorAll('.cb-bd:checked');
    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diedit keterangannya terlebih dahulu.');

    window.selectedForAction = [];
    checkboxes.forEach(cb => {
        if (window.modeKS === 'lembaran') {
            window.selectedForAction.push({ id: cb.value });
        } else {
            const qrs = safeJSONParse(cb.dataset.qrs, []);
            window.selectedForAction.push({ qrcodes: qrs });
        }
    });

    window.sourcePOContext = context;
    document.getElementById('input-new-ket').value = '';
    document.getElementById('modal-ket').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalKet = function() { 
    document.getElementById('modal-ket').classList.add('hidden'); 
    if(document.getElementById('modal-breakdown').classList.contains('hidden')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
};

window.eksekusiEditKet = async function() {
    const newKet = document.getElementById('input-new-ket').value.trim();
    if(!newKet) return alert("Keterangan tidak boleh kosong!");

    const btn = document.getElementById('btn-simpan-ket'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        if (window.modeKS === 'lembaran') {
            let ids = window.selectedForAction.map(x => x.id);
            const {error} = await db.from('stok_lembaran').update({keterangan: newKet}).in('id', ids);
            if(error) throw error;
        } else {
            let payloadItems = [];
            window.selectedForAction.forEach(row => { 
                row.qrcodes.forEach(qr => {
                    payloadItems.push({ qrcode: qr, ket_baru: newKet });
                });
            });
            
            const { error } = await db.rpc('edit_keterangan_ks', { payload: payloadItems });
            if(error) throw error;
            
            await window.sinkronisasiUlangStokAktual();
        }
        
        window.tutupModalKet(); 
        if(window.sourcePOContext === 'breakdown') window.tutupModalBreakdown();
        await window.muatDataStok();
    } catch (e) {
        alert("GAGAL MENGEDIT KETERANGAN: " + e.message + "\n\nPastikan Anda sudah membuat Function 'edit_keterangan_ks' di SQL Editor Supabase.");
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.siapkanGantiPO = function(context) {
    let checkboxes = [];
    if(context === 'main') {
        if(window.modeKS === 'global' || window.modeKS === 'lembaran') return;
        checkboxes = document.querySelectorAll('.cb-main:checked');
    } else { checkboxes = document.querySelectorAll('.cb-bd:checked'); }

    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diganti PO-nya.');

    window.selectedForAction = []; let totalDus = 0;
    checkboxes.forEach(cb => {
        const qrs = safeJSONParse(cb.dataset.qrs, []);
        window.selectedForAction.push({ 
            id_sku_base: cb.dataset.idsku, qrcodes: qrs, jenis: cb.dataset.jenis, nama: cb.dataset.nama,
            pjg: cb.dataset.pjg, grade: cb.dataset.grade, dus: cb.dataset.dus, shading: cb.dataset.shading,
            area: cb.dataset.area, po: cb.dataset.po, ket: cb.dataset.ket
        });
        totalDus += qrs.length;
    });

    window.sourcePOContext = context;
    document.getElementById('input-new-po').value = '';
    const inputQty = document.getElementById('input-qty-ganti');
    inputQty.value = totalDus; inputQty.max = totalDus; 

    document.getElementById('modal-po').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalPO = function() { 
    document.getElementById('modal-po').classList.add('hidden'); 
    if(document.getElementById('modal-breakdown').classList.contains('hidden')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
};

window.eksekusiGantiPO = async function() {
    const newPO = document.getElementById('input-new-po').value.trim().toUpperCase();
    if(!newPO) return alert("Silakan Pilih PO Baru dari daftar dropdown!");

    const qtyDiminta = parseInt(document.getElementById('input-qty-ganti').value);
    if(isNaN(qtyDiminta) || qtyDiminta <= 0) return alert("Jumlah dus tidak valid!");

    let maxDus = window.selectedForAction.reduce((sum, row) => sum + row.qrcodes.length, 0);
    if(qtyDiminta > maxDus) return alert(`Maksimal jatah adalah ${maxDus} dus!`);

    const btn = document.getElementById('btn-simpan-po'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        let qtySisaUntukDiupdate = qtyDiminta; 
        let payloadItems = [];
        
        for(let row of window.selectedForAction) {
            if (qtySisaUntukDiupdate <= 0) break; 
            let qrsUntukDiupdate = row.qrcodes.slice(0, qtySisaUntukDiupdate);
            let jumlahBerubah = qrsUntukDiupdate.length; 
            qtySisaUntukDiupdate -= jumlahBerubah;

            let newIdSku = `${row.area}_${row.nama}_${row.pjg}_${row.grade}_${row.dus}_${row.shading}_${newPO}_${row.ket}`;
            
            qrsUntukDiupdate.forEach(qr => {
                payloadItems.push({ qrcode: qr, id_sku_baru: newIdSku });
            });
        }
        
        const { error } = await db.rpc('ganti_po_aktual_ks', { payload: payloadItems });
        if(error) throw error;
        
        window.tutupModalPO(); 
        if(window.sourcePOContext === 'breakdown') window.tutupModalBreakdown();
        
        await window.sinkronisasiUlangStokAktual();
        await window.muatDataStok();
    } catch (error) { 
        alert("GAGAL UPDATE: " + error.message + "\n\nPastikan Anda sudah membuat Function 'ganti_po_aktual_ks' di SQL Editor Supabase."); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); 
    }
};

window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked'); if(cek.length === 0) return alert("Pilih baris yang ingin disalin (centang).");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-ks th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-open')) return;
            if(window.getComputedStyle(td).display !== 'none') { rowData.push(td.innerText.trim().replace(/\n/g, ' ')); }
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => alert(`Tersalin ${cek.length} baris!\nBuka Excel lalu Paste.`));
};

window.salinDataBreakdown = function() {
    const cek = document.querySelectorAll('.cb-bd:checked'); if(cek.length === 0) return alert("Centang baris detail Area yang ingin disalin.");
    let copyString = "Area\tPO Aktual\tKeterangan\tQTY\n";
    cek.forEach(cb => { const tr = cb.closest('tr'); copyString += `${tr.children[1].innerText}\t${tr.children[2].innerText}\t${tr.children[3].innerText}\t${tr.children[4].innerText}\n`; });
    navigator.clipboard.writeText(copyString).then(() => alert(`Tersalin!\nBuka Excel lalu Paste.`));
};

window.downloadXLS = function() {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = Array.from(document.querySelectorAll('#thead-ks th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')).map(th => th.innerText.trim());
    csvContent += headers.join(",") + "\n";
    
    document.querySelectorAll('.row-ks:not(.filtered-out)').forEach(tr => {
        const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-open')) return;
            if(window.getComputedStyle(td).display !== 'none') { 
                let rawText = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                rowData.push(`"${rawText}"`); 
            }
        });
        csvContent += rowData.join(",") + "\n";
    });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `KartuStok_${window.modeKS.toUpperCase()}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
};
