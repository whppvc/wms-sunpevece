let currentTab = "pic"; // 'pic' atau 'all'
let rawData = [];
let masterData = { area: [], mesin: [], shift: [], item: [], grade: [], dus: [], customer: [] };

// State Modal Search
let currentSearchType = ''; 
let selectedSearchData = '';

let currentPage = 1;
let rowsPerPage = 10; 
let selectAllState = 0; 
let sortState = {};

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'input_opname', title: 'INPUT STOK OPNAME', url: 'input_opname.html' });
    document.getElementById('o-tgl').valueAsDate = new Date();
    document.getElementById('lbl-pic-aktif').innerText = "PIC: " + currentUser.username;
    
    await loadMasterData();
    loadDataOpname();
});

window.switchTab = function(tab) {
    currentTab = tab;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    document.getElementById('tab-pic').className = tab === 'pic' ? activeClass : inactiveClass;
    document.getElementById('tab-all').className = tab === 'all' ? activeClass : inactiveClass;
    
    renderTable();
};

async function loadMasterData() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        const { data: mArea } = await db.from('master_area').select('*');

        if(mData2) {
            let getUnique = (key) => [...new Set(mData2.map(r => r[key]).filter(x => x))].sort();
            masterData.mesin = getUnique('mesin');
            masterData.shift = getUnique('shift');
            masterData.item = getUnique('nama_item');
            masterData.grade = getUnique('grade');
            masterData.dus = getUnique('dus');
            masterData.customer = getUnique('customer');

            // Isi Select Biasa (Shift, Grade, Dus)
            const fillSelect = (id, arr) => {
                let sel = document.getElementById(id);
                if(sel) {
                    sel.innerHTML = '<option value="">-- Pilih --</option>';
                    arr.forEach(val => sel.innerHTML += `<option value="${val}">${val}</option>`);
                }
            };
            fillSelect('o-shift', masterData.shift);
            fillSelect('o-grade', masterData.grade);
            fillSelect('o-dus', masterData.dus);
        }

        if(mArea) {
            masterData.area = [...new Set(mArea.map(r => r.nama_area || r.area).filter(x => x))].sort();
        }
    } catch(e) { console.error("Gagal load master:", e); }
}

window.bukaModalForm = function() {
    document.getElementById('modal-form-opname').classList.remove('hidden');
};

// ==========================================
// MODAL SEARCH (AREA, MESIN, ITEM, CUST)
// ==========================================
window.bukaModalSearch = function(type) {
    currentSearchType = type;
    const titleMap = { 'item': 'Nama Item', 'mesin': 'Mesin', 'customer': 'Customer (PO)', 'area': 'Area Gudang' };
    document.getElementById('title-modal-search').innerText = `Cari ${titleMap[type]}`;
    
    document.getElementById('input-search-list').value = '';
    renderSearchList();

    document.getElementById('modal-search').classList.remove('hidden');
};

function renderSearchList() {
    const ul = document.getElementById('list-search-result');
    const dataArr = masterData[currentSearchType] || [];
    
    if(dataArr.length === 0) {
        ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold">Data kosong.</li>';
        return;
    }

    ul.innerHTML = dataArr.map(d => `
        <li onclick="selectSearchItem('${d}')" class="search-item p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition flex justify-between items-center group">
            <span class="font-bold text-slate-700 group-hover:text-amber-700">${d}</span>
        </li>
    `).join('');
}

window.filterSearchList = function() {
    const q = document.getElementById('input-search-list').value.toLowerCase();
    document.querySelectorAll('.search-item').forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.selectSearchItem = function(nama) {
    document.querySelectorAll('.search-item').forEach(li => li.classList.remove('bg-amber-100', 'border-amber-400'));
    event.currentTarget.classList.add('bg-amber-100', 'border-amber-400');
    selectedSearchData = nama;
};

window.pilihDataSearch = function() {
    if(!selectedSearchData) return alert("Pilih data dari daftar terlebih dahulu!");
    
    let inputId = `o-${currentSearchType === 'customer' ? 'po' : currentSearchType}`;
    let el = document.getElementById(inputId);
    
    if(el) el.value = selectedSearchData;
    
    document.getElementById('modal-search').classList.add('hidden');
    selectedSearchData = '';
};

// ==========================================
// SIMPAN & LOAD DATA
// ==========================================
window.simpanOpname = async function() {
    let tgl = document.getElementById('o-tgl').value;
    let area = document.getElementById('o-area').value.trim().toUpperCase();
    let mesin = document.getElementById('o-mesin').value.trim().toUpperCase();
    let shift = document.getElementById('o-shift').value;
    let jenis = document.getElementById('o-jenis').value;
    let item = document.getElementById('o-item').value.trim().toUpperCase();
    let panjangRaw = document.getElementById('o-panjang').value.trim().toUpperCase();
    let grade = document.getElementById('o-grade').value;
    let dus = document.getElementById('o-dus').value;
    let shading = document.getElementById('o-shading').value.trim().toUpperCase();
    let po = document.getElementById('o-po').value.trim().toUpperCase();
    let qty = parseInt(document.getElementById('o-qty').value);

    if(!tgl || !area || !jenis || !item || !panjangRaw || isNaN(qty) || qty < 1) {
        return alert("Tanggal, Area, Jenis, Nama Item, Panjang, dan Qty wajib diisi dengan benar!");
    }

    let panjangFinal = panjangRaw.endsWith('M') ? panjangRaw : panjangRaw + "M";

    const btn = document.getElementById('btn-simpan-opname');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const payload = {
            tgl_produksii: tgl,
            mesin: mesin || '-',
            shift: shift || '-',
            area: area,
            jenis_item: jenis,
            nama_item: item,
            panjang: panjangFinal,
            grade: grade || '-',
            dus: dus || '-',
            shading: shading || '-',
            customer: po || '-',
            qty_print: qty,
            pic: currentUser.username,
            kode_barcode: `OPNAME_${new Date().getTime()}` // Fake barcode for opname
        };

        const { error } = await db.from('database_gudang').insert([payload]);
        if(error) throw error;

        // Reset form parsial
        document.getElementById('o-item').value = "";
        document.getElementById('o-panjang').value = "";
        document.getElementById('o-shading').value = "";
        document.getElementById('o-qty').value = "1";
        
        document.getElementById('modal-form-opname').classList.add('hidden');
        loadDataOpname();
    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.loadDataOpname = async function() {
    const tbody = document.getElementById('tbody-opname');
    tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Memuat data...</p></td></tr>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('database_gudang').select('*').order('created_at', { ascending: false }).limit(500);
        if (error) throw error;

        rawData = data || [];
        renderTable();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-5 text-center text-red-500 font-bold">Gagal: ${e.message}</td></tr>`;
    }
};

window.thSort = function(idx, label, cls = "") {
    const noFilter = ['col-cb', 'col-no'].includes(cls);
    return `<th class="hdr-std ${cls} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(${idx}, this.closest('th'))">${label}</span>
            ${!noFilter ? `<button onclick="sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition"><i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 text-white"></i></button>` : ''}
        </div>
    </th>`;
};

function renderTable() {
    const thead = document.getElementById('thead-opname');
    const tbody = document.getElementById('tbody-opname');
    sortState = {}; selectAllState = 0;

    let displayData = currentTab === 'pic' ? rawData.filter(r => r.pic === currentUser.username) : rawData;

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto"></button>
            </th>
            ${thSort(1, 'No', 'col-no')}
            ${thSort(2, 'Tgl Produksi', 'col-tgl')}
            ${thSort(3, 'Area', 'col-area')}
            ${thSort(4, 'Mesin', 'col-mesin')}
            ${thSort(5, 'Shift', 'col-shift')}
            ${thSort(6, 'Jenis Item', 'col-jenis')}
            ${thSort(7, 'Nama Item', 'col-nama')}
            ${thSort(8, 'Panjang', 'col-pjg')}
            ${thSort(9, 'Grade', 'col-grade')}
            ${thSort(10, 'Dus', 'col-dus')}
            ${thSort(11, 'Shading', 'col-shading')}
            ${thSort(12, 'Customer', 'col-customer')}
            ${thSort(13, 'QTY', 'col-qty text-amber-300')}
            ${thSort(14, 'PIC', 'col-pic')}
        </tr>`;

    if(displayData.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="15" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; 
        applyPagination(); return; 
    }

    tbody.innerHTML = displayData.map((r, i) => {
        return `
            <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"></td>
                <td class="px-4 py-3 font-bold text-slate-400 text-center col-no">${i+1}</td>
                <td class="px-4 py-3 font-medium text-slate-600 col-tgl">${r.tgl_produksii || '-'}</td>
                <td class="px-4 py-3 font-bold text-emerald-700 col-area">${r.area || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-600 col-mesin">${r.mesin || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-600 col-shift">${r.shift || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-jenis">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-bold text-slate-800 col-nama">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg">${r.panjang || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade">${r.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus">${r.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-semibold text-orange-600 col-customer">${r.customer || '-'}</td>
                <td class="px-4 py-3 font-black text-amber-600 bg-amber-50 text-center col-qty" data-search="${r.qty_print}">${r.qty_print || 0}</td>
                <td class="px-4 py-3 font-bold text-slate-400 text-xs uppercase col-pic">${r.pic || '-'}</td>
            </tr>`;
    }).join('');

    lucide.createIcons(); 
    saringTabel();
}

window.hapusDataOpname = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin dihapus!");
    if(!confirm(`Yakin ingin menghapus ${checked.length} data opname ini?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        const { error } = await db.from('database_gudang').delete().in('id', ids);
        if(error) throw error;
        alert("Data berhasil dihapus.");
        loadDataOpname();
    } catch(e) { alert("Gagal menghapus: " + e.message); }
};

// ==========================================
// PAGINASI & FILTER
// ==========================================
window.highlightRow = function(cb) {
    const tr = cb.closest('tr');
    if (cb.checked) tr.classList.add('selected-row'); else tr.classList.remove('selected-row');
    if(!cb.checked && selectAllState !== 0) { selectAllState = 0; updateSelectAllUI(); }
    updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    if (val === 'ALL') rowsPerPage = 999999; else rowsPerPage = parseInt(val);
    currentPage = 1; applyPagination();
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-opname tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });

    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    let sumQty = 0;
    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1'); else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty');
        if(qtyCell) sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } else { row.style.display = 'none'; }
    });

    document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    document.getElementById('lbl-total-qty').innerText = sumQty;
    document.getElementById('lbl-halaman').innerText = currentPage;
    document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (selectAllState === 1) { selectAllState = 0; updateSelectAllUI(); }
    applySelection(); updateSelectedCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-opname tr.r-row:not(.filtered-out)').length; if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } };
window.updateSelectedCount = function() { document.getElementById('lbl-pilih-baris').innerText = document.querySelectorAll('.cb-main:checked').length; };

window.cycleSelectAll = function() { selectAllState = (selectAllState + 1) % 3; updateSelectAllUI(); applySelection(); };
window.updateSelectAllUI = function() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto'; } 
    else if (selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-600 rounded flex items-center justify-center bg-amber-600 text-white transition mx-auto'; } 
    else if (selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-500 rounded flex items-center justify-center bg-blue-500 text-white transition mx-auto'; }
    lucide.createIcons();
};
window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-opname tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) { allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } }); } 
    else if (selectAllState === 1) {
        allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } });
        visibleRows.forEach((row, index) => { if(index >= startIndex && index < endIndex) { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; highlightRow(cb, true); } } });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; highlightRow(cb, true); } });
    }
    updateSelectedCount();
};

window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-opname');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim(); let valB = b.cells[colIndex].innerText.trim();
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

window.toggleSidebarFilter = function() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
};
window.tutupPopups = function() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-search').classList.add('hidden');
};
window.resetFilter = function() {
    const ids = ['fs-area','fs-tgl','fs-mesin','fs-shift','fs-jenis','fs-nama','fs-pjg','fs-grade','fs-dus','fs-shading','fs-customer'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    saringTabel(); toggleSidebarFilter();
};

window.saringTabel = function() {
    const f = {
        area: document.getElementById('fs-area')?.value.toLowerCase() || '',
        tgl: document.getElementById('fs-tgl')?.value.toLowerCase() || '',
        mesin: document.getElementById('fs-mesin')?.value.toLowerCase() || '',
        shift: document.getElementById('fs-shift')?.value.toLowerCase() || '',
        jenis: document.getElementById('fs-jenis')?.value.toLowerCase() || '',
        nama: document.getElementById('fs-nama')?.value.toLowerCase() || '',
        pjg: document.getElementById('fs-pjg')?.value.toLowerCase() || '',
        grade: document.getElementById('fs-grade')?.value.toLowerCase() || '',
        dus: document.getElementById('fs-dus')?.value.toLowerCase() || '',
        shading: document.getElementById('fs-shading')?.value.toLowerCase() || '',
        customer: document.getElementById('fs-customer')?.value.toLowerCase() || ''
    };

    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for(let key in f) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell && !cell.innerText.toLowerCase().includes(f[key])) { show = false; break; }
            }
        }
        if (show) row.classList.remove('filtered-out'); else row.classList.add('filtered-out');
    });
    selectAllState = 0; updateSelectAllUI(); currentPage = 1; applyPagination();
};
