// ========================================================
// FILTER EXCEL PRO (SMART FILTERING & POSITIONING)
// ========================================================
window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation();
    window.currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    // Ambil data unik dari processedData (bukan dari DOM) agar lebih cepat
    processedData.forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in window.activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = window.activeFilters[otherCol];
                const val = row.searchValues[otherCol] || '';
                if (!allowed.includes(val)) { showBasedOnOthers = false; break; }
            }
        }
        if (showBasedOnOthers) {
            let val = row.searchValues[colClass] || '';
            if(val !== '') uniqueValues.add(val);
        }
    });

    let sortedValues = Array.from(uniqueValues).sort();
    
    // Simpan data asli ke dalam variabel global sementara untuk keperluan pencarian
    window.currentFilterValues = sortedValues;
    
    // Render awal (Maksimal 100 item untuk mencegah freeze)
    renderFilterList('');

    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    menu.classList.remove('hidden');
    
    // Kalkulasi Posisi Pintar (Smart Positioning)
    const btnRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 256; 
    
    let topPos = btnRect.bottom + 4; 
    let leftPos = btnRect.left; 

    if (leftPos + menuWidth > window.innerWidth) {
        leftPos = btnRect.right - menuWidth;
    }
    
    if (leftPos < 10) {
        leftPos = 10;
    }

    menu.style.position = 'fixed'; 
    menu.style.top = `${topPos}px`;
    menu.style.left = `${leftPos}px`;
    
    document.getElementById('filter-search-input').focus();
};

// Fungsi Render List Filter dengan Limit 100 Item
window.renderFilterList = function(searchQuery) {
    const colClass = window.currentFilterCol;
    let filteredVals = window.currentFilterValues;
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase().split(' ').filter(x => x);
        filteredVals = window.currentFilterValues.filter(val => {
            const text = String(val).toLowerCase();
            return query.every(term => text.includes(term));
        });
    }

    // Batasi render maksimal 100 item
    const limit = 100;
    const displayVals = filteredVals.slice(0, limit);

    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    
    displayVals.forEach(val => {
        let isChecked = true;
        if (window.activeFilters[colClass] && !window.activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    if (filteredVals.length > limit) {
        listHtml += `<div class="p-2 text-center text-xs font-bold text-slate-400 italic">Menampilkan 100 dari ${filteredVals.length} hasil. Ketik untuk mencari.</div>`;
    }

    document.getElementById('filter-values-list').innerHTML = listHtml;
    window.updateSelectAllState();
};

window.searchFilterList = function(val) {
    clearTimeout(window.filterTimeout);
    window.filterTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
            window.renderFilterList(val);
        });
    }, 150);
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
    if(allCbs.length === checkedCbs.length && allCbs.length > 0) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};

document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) window.updateSelectAllState(); });

window.closeFilterMenu = function() { document.getElementById('excel-filter-menu').classList.add('hidden'); };

window.clearFilterForCurrentCol = function() {
    delete window.activeFilters[window.currentFilterCol];
    window.closeFilterMenu(); window.saringTabelExcel(); 
};

window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked');
    const totalBoxes = document.querySelectorAll('.filter-val-cb');
    
    // Jika semua checkbox yang TAMPIL dicentang, dan kotak pencarian kosong, berarti "Pilih Semua"
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') {
        delete window.activeFilters[window.currentFilterCol];
    } else {
        // Jika ada pencarian atau tidak semua dicentang, simpan nilai yang dicentang
        let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value));
        
        // Gabungkan dengan nilai yang sudah ada di filter (jika ada yang tersembunyi karena limit/pencarian)
        if (window.activeFilters[window.currentFilterCol]) {
            const oldVals = new Set(window.activeFilters[window.currentFilterCol]);
            selectedVals.forEach(v => oldVals.add(v));
            selectedVals = Array.from(oldVals);
        }
        
        window.activeFilters[window.currentFilterCol] = selectedVals;
    }
    
    window.closeFilterMenu(); window.saringTabelExcel(); 
};

window.saringTabelExcel = function() {
    window.applyFilters();
    window.updateFilterIcons();
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-amber-400', 'opacity-100');
        icon.classList.add('opacity-40', 'text-white');
    });
    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            const icon = th.querySelector('.filter-icon');
            if (icon) { 
                icon.classList.remove('opacity-40', 'text-white'); 
                icon.classList.add('text-amber-400', 'opacity-100'); 
            }
        }
    }
};
