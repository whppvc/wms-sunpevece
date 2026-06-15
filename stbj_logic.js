let currentTab = 'scan';
let dataStbj = []; 
let deletedStbjStack = []; 
let masterKamus = [];
let globalRowId = 0;
let sortState = {}; 

// State Filter Excel
let activeFilters = {}; 
let currentFilterCol = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', async () => { 
    // 1. Render Layout (Top Navbar & Sidebar) terlebih dahulu
    initModernLayout({ id: 'stbj', title: 'SCAN STBJ', url: 'stbj.html' }); 
    
    // 2. Kunci Body & Main agar tidak double scroll (Anti-Bounce)
    document.body.style.overflow = 'hidden';
    const wmsMain = document.querySelector('main');
    if(wmsMain) {
        wmsMain.style.overflow = 'hidden';
        wmsMain.style.padding = '0'; 
    }

    // 3. Event Listener untuk menutup modal filter jika klik di luar
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[onclick^="openColumnFilter"]')) {
                closeFilterMenu();
            }
        }
    });

    // 4. Load Data Master
    await loadInitialSTBJData();
});

function toggleInputSTBJ() {
    const body = document.getElementById('body-input-stbj');
    const icon = document.getElementById('icon-toggle-input');
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.classList.remove('rotate-180');
    } else {
        body.classList.add('hidden');
        icon.classList.add('rotate-180');
    }
}

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-stbj');
    const rows = Array.from(tbody.querySelectorAll('tr.row-stbj'));
    
    let isAsc = sortState[colIndex] !== 'asc';
    sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let cellA = a.cells[colIndex];
        let cellB = b.cells[colIndex];
        
        let valA = cellA.querySelector('input') ? cellA.querySelector('input').value.trim() : cellA.innerText.trim();
        let valB = cellB.querySelector('input') ? cellB.querySelector('input').value.trim() : cellB.innerText.trim();
        
        let numA = parseFloat(valA);
        let numB = parseFloat(valB);
        
        if(!isNaN(numA) && !isNaN(numB)) {
            return isAsc ? numA - numB : numB - numA;
        } else {
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.setAttribute('data-lucide', 'arrow-up-down'); 
        icon.classList.add('opacity-50');
    });
    
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) {
        icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a');
        icon.classList.remove('opacity-50');
        lucide.createIcons();
    }
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('view-scan').classList.toggle('hidden', tab !== 'scan');
    document.getElementById('view-csv').classList.toggle('hidden', tab !== 'csv');
    document.getElementById('btn-tab-scan').className = tab === 'scan' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs';
    document.getElementById('btn-tab-csv').className = tab === 'csv' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs';
}

async function loadInitialSTBJData() {
    try {
        const { data: mData1 } = await db.from('master_1').select('nama_troli').order('id', { ascending: true });
        if(mData1) {
            const trolis = [...new Set(mData1.map(r => r.nama_troli).filter(x => x))];
            const sel = document.getElementById('select-troli');
            sel.innerHTML = '<option value="">-- Memuat Troli... --</option>';
            trolis.forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
        }
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) masterKamus = mData2;
    } catch (err) { console.error("Gagal muat referensi:", err); }
}

function translateBarcode(barcode) {
    let td = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', po: '-' };
    const parts = barcode.split('/'); if (parts.length < 4) return td;
    
    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') td.jenisItem = 'Plafon'; else if (hurufDepan === 'L') td.jenisItem = 'List'; else if (hurufDepan === 'W') td.jenisItem = 'WPC'; else td.jenisItem = hurufDepan;

    let rawItem = parts[0]; let cariItem = masterKamus.find(m => m.kode_nama_item === rawItem); 
    td.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem; td.shading = parts[1];
    
    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        td.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); td.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); let cariDus = masterKamus.find(m => m.kode_dus === rawDus); td.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }
    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        td.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let cariMesin = masterKamus.find(m => m.kode_mesin === match[1]); td.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : match[1];
            let cariShift = masterKamus.find(m => m.kode_shift === match[2]); td.shift = cariShift && cariShift.shift ? cariShift.shift : match[2];
            let cariPO = masterKamus.find(m => m.kode_po === match[3]); td.po = cariPO && cariPO.po ? cariPO.po : match[3];
        }
    }
    return td;
}

document.getElementById('form-scan').addEventListener('submit', (e) => {
    e.preventDefault();
    const troli = document.getElementById('select-troli').value;
    const inputEl = document.getElementById('input-qrcode');
    const rawInput = inputEl.value.trim();
    if(!troli) return alert("Pilih Troli terlebih dahulu!");
    if(!rawInput) return;

    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        const isLocalDuplicate = dataStbj.some(d => d.qrcode === code);
        const trans = translateBarcode(code);
        
        dataStbj.push({ 
            id: ++globalRowId, 
            qrcode: code, 
            troli: troli, 
            status: 'BELUM CEK', 
            keterangan: isLocalDuplicate ? 'DUPLIKAT SCAN' : '', 
            pic: currentUser.username, 
            isLocalDuplicate: isLocalDuplicate,
            ...trans 
        });
    });
    renderTable();
    inputEl.value = ''; inputEl.focus();
    
    const scrollContainer = document.querySelector('.table-container');
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
});

function prosesCSV() {
    const troli = document.getElementById('select-troli').value;
    const fileInput = document.getElementById('input-csv');
    if(!troli) return alert("Pilih Troli terlebih dahulu!");
    if(!fileInput.files.length) return alert("Pilih file CSV!");

    Papa.parse(fileInput.files[0], {
        header: false, skipEmptyLines: true,
        complete: function(results) {
            let added = 0;
            results.data.forEach(row => {
                const code = row[0] ? row[0].trim() : '';
                if(code) {
                    const isLocalDuplicate = dataStbj.some(d => d.qrcode === code);
                    const trans = translateBarcode(code);
                    
                    dataStbj.push({ 
                        id: ++globalRowId, 
                        qrcode: code, 
                        troli: troli, 
                        status: 'BELUM CEK', 
                        keterangan: isLocalDuplicate ? 'DUPLIKAT SCAN' : 'Dari CSV', 
                        pic: currentUser.username, 
                        isLocalDuplicate: isLocalDuplicate, 
                        ...trans 
                    });
                    added++;
                }
            });
            alert(`${added} QR Code dari CSV berhasil dimuat ke tabel.`); renderTable(); fileInput.value = '';
            
            const scrollContainer = document.querySelector('.table-container');
            if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    });
}

function toggleAll(checked) { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = checked); }
function getCheckedIds() {
    const ids = []; document.querySelectorAll('.row-cb:checked').forEach(cb => ids.push(parseInt(cb.value))); return ids;
}

function hapusBaris(id) {
    const removed = dataStbj.find(d => d.id === id);
    if(removed) {
        deletedStbjStack.push([removed]);
        dataStbj = dataStbj.filter(d => d.id !== id);
        renderTable();
    }
}

function undoHapusSTBJ() {
    if(deletedStbjStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedStbjStack.pop();
    dataStbj = [...dataStbj, ...last]; 
    renderTable();
}

function holdManual() {
    const ids = getCheckedIds(); if(ids.length === 0) return alert("Centang baris yang ingin di-HOLD manual!");
    dataStbj.forEach(d => { if(ids.includes(d.id)) { d.status = 'HOLD'; d.keterangan = 'Dihold Manual'; } });
    renderTable(); document.querySelector('input[onchange="toggleAll(this.checked)"]').checked = false;
}

// ========================================================
// FILTER EXCEL PRO (SMART FILTERING)
// ========================================================
function openColumnFilter(event, colClass, colName) {
    event.stopPropagation();
    currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-stbj tr.row-stbj').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol];
                const c = row.querySelector('.' + otherCol);
                if (c) {
                    let inputEl = c.querySelector('input');
                    let t = inputEl ? inputEl.value.trim() : (c.getAttribute('data-search') || c.innerText.trim());
                    if (!allowed.includes(t)) { showBasedOnOthers = false; break; }
                }
            }
        }
        if (showBasedOnOthers) {
            let cell = row.querySelector('.' + colClass);
            if (cell) {
                let inputEl = cell.querySelector('input');
                let val = inputEl ? inputEl.value.trim() : (cell.getAttribute('data-search') || cell.innerText.trim());
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
    document.querySelectorAll('.row-stbj').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass];
            const cell = row.querySelector('.' + colClass);
            if (cell) {
                let inputEl = cell.querySelector('input');
                let text = inputEl ? inputEl.value.trim() : (cell.getAttribute('data-search') || cell.innerText.trim());
                if (!allowedValues.includes(text)) { show = false; break; }
            }
        }
        
        if (show) { 
            row.classList.remove('filtered-out'); 
            row.style.display = '';
        } else { 
            row.classList.add('filtered-out'); 
            row.style.display = 'none';
            let cb = row.querySelector('.row-cb');
            if(cb) cb.checked = false; 
        }
    });
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

// ========================================================
// FITUR RESIZABLE COLUMNS (DRAG LEBAR KOLOM)
// ========================================================
function initResizableColumns() {
    const cols = document.querySelectorAll('#table-stbj th');
    cols.forEach(col => {
        const existing = col.querySelector('.resizer');
        if(existing) existing.remove();

        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        col.appendChild(resizer);
        
        createResizableColumn(col, resizer);
    });
}

function createResizableColumn(col, resizer) {
    let x = 0;
    let w = 0;

    const mouseDownHandler = function(e) {
        x = e.clientX;
        const styles = window.getComputedStyle(col);
        w = parseInt(styles.width, 10);

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        resizer.classList.add('resizing');
    };

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

    resizer.addEventListener('mousedown', mouseDownHandler);
}

function renderTable() {
    const tbody = document.getElementById('tbody-stbj');
    if(dataStbj.length === 0) return tbody.innerHTML = '<tr><td colspan="18" class="p-10 text-slate-400 font-bold"><i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan / di-import.</td></tr>';
    
    let html = '';
    dataStbj.forEach((d, index) => {
        let badgeClass = "bg-slate-200 text-slate-700";
        let displayStatus = d.status;

        if(d.status === 'BELUM STBJ') badgeClass = "bg-orange-500 text-white border-orange-600";
        if(d.status === 'SUDAH STBJ') badgeClass = "bg-red-600 text-white border-red-700"; 
        if(d.status === 'DUPLIKAT SCAN') badgeClass = "bg-red-600 text-white border-red-700";
        if(d.status === 'HOLD') badgeClass = "bg-amber-500 text-white";

        if(d.status === 'BELUM CEK' && d.isLocalDuplicate) {
            badgeClass = "bg-red-600 text-white";
            displayStatus = "DUPLIKAT SCAN";
        }

        const isRedHighlight = d.status === 'SUDAH STBJ' || d.status === 'DUPLIKAT SCAN' || d.isLocalDuplicate;
        const trBaseClass = isRedHighlight ? 'bg-red-50 hover:bg-red-100 text-red-900' : (d.status === 'HOLD' ? 'bg-amber-50 hover:bg-amber-100 text-amber-900' : 'hover:bg-slate-50 text-slate-700');

        html += `
            <tr class="border-b border-slate-200 transition ${trBaseClass} row-stbj text-sm">
                <td class="p-3 text-center col-cb border-r border-slate-200 border-b border-slate-200"><input type="checkbox" value="${d.id}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                <td class="p-2 text-center col-btn border-r border-slate-200 border-b border-slate-200">
                    <button onclick="hapusBaris(${d.id})" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-3 font-bold col-no border-r border-slate-200 border-b border-slate-200">${index + 1}</td>
                <td class="p-3 font-black text-xs border-r border-slate-200 border-b border-slate-200 col-status" data-search="${displayStatus}"><span class="px-2 py-1 rounded shadow-sm border border-black/10 ${badgeClass}">${displayStatus}</span></td>
                <td class="p-3 font-bold ${isRedHighlight ? 'text-red-900' : 'text-slate-700'} col-troli border-r border-slate-200 border-b border-slate-200" data-search="${d.troli}">${d.troli}</td>
                <td class="p-3 font-mono font-bold border-r border-slate-200 border-b border-slate-200 tracking-wider col-qr" data-search="${d.qrcode}">${d.qrcode}</td>
                <td class="p-3 font-bold col-tgl border-r border-slate-200 border-b border-slate-200" data-search="${d.tglProduksi}">${d.tglProduksi}</td>
                <td class="p-3 font-bold col-mesin border-r border-slate-200 border-b border-slate-200" data-search="${d.mesin}">${d.mesin}</td>
                <td class="p-3 font-bold border-r border-slate-200 border-b border-slate-200 col-shift" data-search="${d.shift}">${d.shift}</td>
                <td class="p-3 font-black ${isRedHighlight ? 'text-red-700' : 'text-blue-700'} col-jenis border-r border-slate-200 border-b border-slate-200" data-search="${d.jenisItem}">${d.jenisItem}</td>
                <td class="p-3 font-bold text-center col-nama border-r border-slate-200 border-b border-slate-200" data-search="${d.namaItem}">${d.namaItem}</td>
                <td class="p-3 font-bold col-pjg border-r border-slate-200 border-b border-slate-200" data-search="${d.panjang}">${d.panjang}</td>
                <td class="p-3 font-bold col-grade border-r border-slate-200 border-b border-slate-200" data-search="${d.grade}">${d.grade}</td>
                <td class="p-3 font-bold col-dus border-r border-slate-200 border-b border-slate-200" data-search="${d.dus}">${d.dus}</td>
                <td class="p-3 font-bold border-r border-slate-200 border-b border-slate-200 col-shading" data-search="${d.shading}">${d.shading}</td>
                <td class="p-3 font-black ${isRedHighlight ? 'text-red-700' : 'text-orange-600'} col-po border-r border-slate-200 border-b border-slate-200" data-search="${d.po}">${d.po}</td>
                <td class="p-2 col-ket text-center border-r border-slate-200 border-b border-slate-200"><input type="text" onchange="updateKet(${d.id}, this.value)" value="${d.keterangan}" class="w-full p-2 text-sm text-center border border-slate-300 rounded outline-none focus:border-blue-500 bg-white/50 ${isRedHighlight ? 'placeholder-red-400' : ''}" placeholder="Keterangan..."></td>
                <td class="p-3 font-bold uppercase text-xs opacity-70 col-pic border-b border-slate-200" data-search="${d.pic}">${d.pic}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html; 
    lucide.createIcons(); 
    saringTabelExcel();
    initResizableColumns(); // Panggil fungsi resizable setelah render
}

function updateKet(id, val) { const item = dataStbj.find(d => d.id === id); if(item) item.keterangan = val; }

async function cekGudangSTBJ() {
    if(dataStbj.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-cek-gudang'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENCEK DB...'; btn.disabled = true;

    const allQRs = dataStbj.map(d => d.qrcode);
    try {
        const { data: resStokGlobal, error } = await db.from('stok_global').select('qrcode').in('qrcode', allQRs);
        if(error) throw error;
        
        const existingGlobal = resStokGlobal.map(d => d.qrcode);

        let infoDuplikat = 0;
        dataStbj.forEach(d => {
            if(d.status === 'HOLD') return; 
            
            if (existingGlobal.includes(d.qrcode)) {
                d.status = 'SUDAH STBJ'; 
                d.keterangan = 'SUDAH ADA DI STOK GLOBAL';
                infoDuplikat++;
            } else if (d.isLocalDuplicate) {
                d.status = 'DUPLIKAT SCAN';
            } else {
                d.status = 'BELUM STBJ'; 
            }
        });

        renderTable();
        if(infoDuplikat > 0) alert(`Verifikasi Selesai!\nDitemukan ${infoDuplikat} data DUPLIKAT (sudah ada di Stok Global).`);
        else alert("Verifikasi Selesai!\nSemua data UNIK (Belum STBJ) dan aman untuk disimpan.");

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

async function saveToDatabaseSTBJ() {
    if(dataStbj.length === 0) return alert('Data kosong!');
    const blmCek = dataStbj.filter(d => d.status === 'BELUM CEK');
    if(blmCek.length > 0) return alert('Tekan tombol Verifikasi Kode terlebih dahulu sebelum menyimpan!');

    const btn = document.getElementById('btn-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES...'; btn.disabled = true;

    const UNIKs = dataStbj.filter(d => d.status === 'BELUM STBJ');
    const dupes = dataStbj.filter(d => d.status === 'SUDAH STBJ' || d.status === 'DUPLIKAT SCAN' || d.status === 'HOLD');

    const mapToSchema = (d, finalStatus) => ({
        troli: d.troli,
        qrcode: d.qrcode,
        tgl_produksi: d.tglProduksi,
        shift: d.shift,
        mesin: d.mesin,
        jenis_item: d.jenisItem, 
        nama_item: d.namaItem,
        panjang: d.panjang,
        grade: d.grade,
        dus: d.dus,
        shading: d.shading,
        po_bawaan: d.po,
        keterangan: d.keterangan || '-',
        status: finalStatus,
        status_data: 'BELUM',
        posisi: 'TROLI',
        pic_input: d.pic,
        created_at: new Date().toISOString() 
    });

    try {
        if(UNIKs.length > 0) {
            const payloadGlobal = UNIKs.map(d => mapToSchema(d, 'SUDAH STBJ'));
            const { error: err1 } = await db.from('stok_global').insert(payloadGlobal);
            if(err1) throw err1;
        }
        
        if(dupes.length > 0) {
            const payloadHold = dupes.map(d => mapToSchema(d, 'HOLD'));
            const { error: err2 } = await db.from('hold_stbj').insert(payloadHold);
            if(err2) throw err2;
        }

        alert(`BERHASIL DISIMPAN!\n- ${UNIKs.length} Barang UNIK masuk ke Stok Global\n- ${dupes.length} Barang Hold/Duplikat masuk ke Hold STBJ`);
        dataStbj = []; renderTable();
        document.querySelector('input[onchange="toggleAll(this.checked)"]').checked = false;
    } catch (err) { alert('GAGAL MENYIMPAN: ' + err.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}
