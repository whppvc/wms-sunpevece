let dataRiwayatRaw = [];
let modeTabAktif = 'PROSES'; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 8;
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_mutasi', title: 'RIWAYAT KONVERSI', url: 'riwayat_konversi.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
        
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !e.target.closest('button[onclick^="toggleActionMenu"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    muatDataRiwayat();
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

async function muatDataRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500 text-xs">Menarik histori dari laporan_konversi...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('laporan_konversi').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        dataRiwayatRaw = data || [];
        gantiModeTab(modeTabAktif); 
    } catch (error) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="10" class="p-10 text-center text-red-500 font-bold text-xs uppercase">Gagal memuat data: ${error.message}</td></tr>`;
    }
}

function parseDetail(detailString) {
    let res = { ket: detailString, po_target: '-', items: [], rangkuman: 'Format Lama (Tanpa Rincian)' };
    try {
        let parsed = JSON.parse(detailString);
        if (parsed && parsed.items) {
            res.ket = parsed.keterangan || '-';
            res.po_target = parsed.po_target || '-';
            res.items = parsed.items;
            
            let mapItem = {};
            parsed.items.forEach(d => {
                let namaLengkap = `${d.namaItem} ${d.panjang} ${d.grade} ${d.dus} ${d.shading}`;
                mapItem[namaLengkap] = (mapItem[namaLengkap] || 0) + 1;
            });
            let txt = [];
            for (let k in mapItem) txt.push(`${k} (${mapItem[k]} Dus)`);
            res.rangkuman = txt.join(', ');
        }
    } catch(e) {} 
    return res;
}

function gantiModeTab(mode) {
    modeTabAktif = mode;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    document.getElementById('tab-proses').className = (mode === 'PROSES') ? activeClass : inactiveClass;
    document.getElementById('tab-done').className = (mode === 'DONE') ? activeClass : inactiveClass;

    document.getElementById('btn-done-konv').classList.toggle('hidden', mode === 'DONE');
    document.getElementById('btn-batal-done').classList.toggle('hidden', mode === 'PROSES');

    activeFilters = {}; updateFilterIcons(); currentPage = 1;
    
    renderTabelUtama();
}

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
    const noFilter = ['col-cb', 'col-btn'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center">
            <div class="flex items-center justify-center w-full">${label}</div>
        </th>`;
    }

    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(${idx}, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
};

// REVISI: Logika Posisi Popup Filter (Fixed Position & Smart Alignment)
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
    
    const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        
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
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
}

function toggleAllFilterValues(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked;
