// ========================================================
// FILTER EXCEL PRO (SMART FILTERING & POSITIONING)
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
    
    const menu = document.getElementById('excel-filter-menu');
    menu.classList.remove('hidden');
    
    // Kalkulasi Posisi Pintar (Smart Positioning)
    const btnRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 256; // w-64 di Tailwind = 16rem = 256px
    
    let topPos = btnRect.bottom + 4; // Sedikit di bawah tombol
    let leftPos = btnRect.left; // Default rata kiri tombol

    // Jika melebihi batas kanan layar, geser ke kiri (rata kanan dengan tombol)
    if (leftPos + menuWidth > window.innerWidth) {
        leftPos = btnRect.right - menuWidth;
    }
    
    // Jika masih melebihi batas kiri (sangat jarang), paksa rata kiri layar
    if (leftPos < 10) {
        leftPos = 10;
    }

    menu.style.position = 'fixed'; // Gunakan fixed agar tidak terpotong overflow container
    menu.style.top = `${topPos}px`;
    menu.style.left = `${leftPos}px`;
    
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
    window.closeFilterMenu(); window.saringTabelExcel(); 
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
    
    window.closeFilterMenu(); window.saringTabelExcel(); 
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
    window.updateFilterIcons();
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-amber-400', 'opacity-100');
        icon.classList.add('text-white', 'opacity-40');
    });
    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            const icon = th.querySelector('.filter-icon');
            if (icon) { 
                icon.classList.remove('text-white', 'opacity-40'); 
                icon.classList.add('text-amber-400', 'opacity-100'); 
            }
        }
    }
};

// ========================================================
// ACTION HANDLERS & MODALS
// ========================================================
window.tutupSemuaPopups = function() {
    document.getElementById('modal-lihat-po').classList.add('hidden');
    document.getElementById('modal-breakdown').classList.add('hidden');
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
            <tr class="transition bd-row text-sm">
                <td class="px-4 py-4 text-center"><input type="checkbox" onchange="window.highlightBdRow(this)" data-idsku="${a.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po_aktual}" data-qty="${a.qty}" data-ket="${a.keterangan}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-4 font-semibold text-slate-800 text-left">${a.area}</td>
                <td class="px-4 py-4 font-semibold text-slate-900 text-left col-po">${a.po_aktual}</td>
                <td class="px-4 py-4 font-medium text-slate-600 text-left whitespace-normal min-w-[200px]">${a.keterangan}</td>
                <td class="px-4 py-4 font-black text-emerald-700 text-center">${a.qty}</td>
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

window.bukaModalLihatPO = function(encodedPOs) {
    const poStr = decodeURIComponent(encodedPOs);
    const poArr = poStr.split('|').map(p => p.trim()).filter(p => p);
    const ul = document.getElementById('list-po-aktual');
    if (poArr.length === 0 || poArr[0] === 'KOSONG') {
        ul.innerHTML = '<li class="text-slate-400 italic font-medium p-3 bg-slate-50 rounded-md text-center border border-slate-200">Tidak ada Customer Aktual tersimpan.</li>';
    } else {
        ul.innerHTML = poArr.map(p => {
            let parts = p.split('(');
            let namaPo = parts[0].trim();
            let qtyPo = parts[1] ? parts[1].replace(')', '').trim() : '';
            return `<li class="p-3 bg-white border border-slate-200 shadow-sm text-slate-700 font-semibold rounded-md flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-slate-400"></i> <span>${namaPo}</span></div> 
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-black">${qtyPo}</span>
                    </li>`;
        }).join('');
    }
    lucide.createIcons();
    document.getElementById('modal-lihat-po').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.siapkanGantiPO = function(context) {
    let checkboxes = [];
    if(context === 'main') {
        if(window.modeKS === 'global' || window.modeKS === 'lembaran') return;
        checkboxes = document.querySelectorAll('.cb-main:checked');
    } else { checkboxes = document.querySelectorAll('.cb-bd:checked'); }

    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diganti Customer-nya.');

    window.selectedForAction = []; let totalDus = 0;
    checkboxes.forEach(cb => {
        window.selectedForAction.push({ 
            id_sku: cb.dataset.idsku, 
            po_aktual: cb.dataset.po,
            qty: parseInt(cb.dataset.qty)
        });
        totalDus += parseInt(cb.dataset.qty);
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
