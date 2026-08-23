let modeKS = 'area'; 
let stokQRRaw = []; 
let stokAktualRaw = []; 
let stokLembaranRaw = [];

// Data Arrays
let dataKSQR = []; 
let dataKSArea = []; 
let dataKSGlobal = [];
let dataKSNonaktif = []; 

let processedData = []; // Data yang aktif sesuai tab
let filteredData = [];  // Data setelah difilter & disort

let sourcePOContext = ''; 
let currentBreakdownData = [];
let sortState = { col: null, isAsc: true };
let masterData = { kamus: [] };
let poDistributionMap = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
let selectAllState = 0; 
let userColOrder = []; 
let hiddenCols = []; 
let selectedRows = new Set(); // Menyimpan ID baris yang dicentang
let selectedForReq = null; 

let processedGantiKeys = new Set();
let processedGlobalKeys = new Set();

let filterTimeout;

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), { username: 'Admin', role: 'admin' });

function loadUserPreferences() {
    const savedOrder = localStorage.getItem(`col_order_ks_${modeKS}_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } } 
    else { userColOrder = []; }
    
    const savedHidden = localStorage.getItem(`col_hidden_ks_${modeKS}_${currentUser.username}`);
    if (savedHidden) { try { hiddenCols = JSON.parse(savedHidden); } catch(e) { hiddenCols = []; } } 
    else { hiddenCols = []; }
    
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
}

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'kartu_stok', title: 'KARTU STOK', url: 'kartu_stok.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    // Keyboard Navigation for Filter Menu
    const filterMenuEl = document.getElementById('excel-filter-menu');
    if (filterMenuEl) {
        filterMenuEl.addEventListener('keydown', function(e) {
            const searchInput = document.getElementById('filter-search-input');
            const visibleLabels = Array.from(document.querySelectorAll('.filter-val-item')).filter(lbl => lbl.style.display !== 'none');
            const visibleCbs = visibleLabels.map(lbl => lbl.querySelector('input[type="checkbox"]'));
            const selectAllCb = document.getElementById('filter-select-all');
            if(selectAllCb && selectAllCb.closest('label').style.display !== 'none') visibleCbs.unshift(selectAllCb);

            const currentIndex = visibleCbs.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (document.activeElement === searchInput && visibleCbs.length > 0) visibleCbs[0].focus();
                else if (currentIndex >= 0 && currentIndex < visibleCbs.length - 1) visibleCbs[currentIndex + 1].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentIndex === 0) searchInput.focus();
                else if (currentIndex > 0) visibleCbs[currentIndex - 1].focus();
            } else if (e.key === 'Enter') {
                e.preventDefault(); applyFilterForCurrentCol();
            }
        });
    }

    await loadMasterData();
    loadUserPreferences(); 
    setTimeout(muatDataStok, 200);
});

function toggleActionMenu(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
}

// REVISI: Fungsi untuk bypass limit 1000 baris Supabase
async function fetchAllRows(baseQuery) {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await baseQuery.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

async function loadMasterData() {
    try {
        const {data, error} = await db.from('master_2').select('*');
        if (data) {
            masterData.kamus = data; 
            let poSet = new Set(); 
            let namaSet = new Set();
            let gradeSet = new Set();
            let dusSet = new Set();

            data.forEach(d => { 
                if(d.customer) poSet.add(d.customer.trim()); 
                if(d.nama_item) namaSet.add(d.nama_item.trim());
                if(d.grade) gradeSet.add(d.grade.trim());
                if(d.dus) dusSet.add(d.dus.trim());
            });

            const selPO = document.getElementById('input-new-po'); 
            if(selPO) {
                let htmlPO = '<option value="">-- PILIH CUSTOMER --</option>';
                Array.from(poSet).sort().forEach(po => { htmlPO += `<option value="${po}">${po}</option>`; });
                selPO.innerHTML = htmlPO;
            }

            const selNama = document.getElementById('req-nama-item');
            if(selNama) {
                let htmlNama = '<option value="">-- Tetap --</option>';
                Array.from(namaSet).sort().forEach(n => { htmlNama += `<option value="${n}">${n}</option>`; });
                selNama.innerHTML = htmlNama;
            }
            const selGrade = document.getElementById('req-grade');
            if(selGrade) {
                let htmlGrade = '<option value="">-- Tetap --</option>';
                Array.from(gradeSet).sort().forEach(g => { htmlGrade += `<option value="${g}">${g}</option>`; });
                selGrade.innerHTML = htmlGrade;
            }
            const selDus = document.getElementById('req-dus');
            if(selDus) {
                let htmlDus = '<option value="">-- Tetap --</option>';
                Array.from(dusSet).sort().forEach(d => { htmlDus += `<option value="${d}">${d}</option>`; });
                selDus.innerHTML = htmlDus;
            }
        }
    } catch (e) { console.error("Gagal memuat master data:", e); }
}

function translateBarcode(barcode) {
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', customer: '-' };
    if(!barcode) return data;
    const parts = barcode.split('/'); if (parts.length < 1) return data;
    const h = barcode.charAt(0).toUpperCase();
    if (h === 'P') data.jenisItem = 'Plafon'; else if (h === 'L') data.jenisItem = 'List'; else if (h === 'W') data.jenisItem = 'WPC'; else data.jenisItem = h;

    data.namaItem = parts[0] || '-'; 
    data.shading = parts[1] || '-';
    
    if(parts[2] && parts[2].length >= 4) {
        let p2 = parts[2];
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M";
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        data.dus = p2.substring(p2.length - 2);
    }
    
    if(parts[3] && parts[3].length >= 5) {
        let p3 = parts[3];
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        if (!isNaN(dayOfYear) && !isNaN(realYear)) {
            const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
            data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        }
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if(match) { data.mesin = match[1]; data.shift = match[2]; data.customer = match[3]; }
    }
    return data;
}

function sinkronisasiUlangStokAktual(tampilkanAlert = false) {
    alert("Fungsi Sinkronisasi Wipe & Rebuild dinonaktifkan untuk menjaga integritas data Customer Aktual hasil editan user.\n\nSistem kini menggunakan metode Incremental Update (+/-) secara otomatis setiap kali ada transaksi.");
}

async function muatDataStok() {
    const tbody = document.getElementById('tbody-ks');
    if(!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menghubungkan ke database...</p></td></tr>`;
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        // REVISI: Gunakan fetchAllRows untuk stok_global agar menembus limit 1000
        const [stokGlobalData, resAktual, resLembaran, resGanti] = await Promise.all([
            fetchAllRows(db.from('stok_global').select('*')), 
            db.from('stok_aktual').select('*'),
            db.from('stok_nonaktif').select('*').order('created_at', {ascending: false}),
            db.from('ganti_customer').select('id_sku, customer_aktual_request, area').neq('progres', 'DONE') 
        ]);
        
        if(resAktual.error) throw resAktual.error;
        
        stokQRRaw = stokGlobalData || []; 
        stokAktualRaw = resAktual.data || [];
        stokLembaranRaw = resLembaran.data || [];

        processedGantiKeys.clear();
        processedGlobalKeys.clear();
        if (resGanti && resGanti.data) {
            resGanti.data.forEach(g => {
                processedGantiKeys.add(`${g.id_sku}_${g.customer_aktual_request}_${g.area}`);
                let parts = (g.id_sku || '').split('_');
                if(parts.length >= 8) {
                    let globalSku = `${parts[1]}_${parts[2]}_${parts[3]}_${parts[4]}_${parts[5]}_${parts[6]}_${parts[7]}`;
                    processedGlobalKeys.add(`${globalSku}_${g.customer_aktual_request}`);
                }
            });
        }

        let aktualMap = {};
        stokAktualRaw.forEach(a => {
            let key = `${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}`;
            if(!aktualMap[key]) aktualMap[key] = {};
            let custAktual = a.customer_aktual || '-';
            if(!aktualMap[key][custAktual]) aktualMap[key][custAktual] = 0;
            aktualMap[key][custAktual] += (a.qty || 0);
        });
        poDistributionMap = aktualMap;

        let qrMap = {};
        stokQRRaw.forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = translateBarcode(r.qrcode);
            let area = p[0] || r.area || '-';
            let nama = p[1] || r.nama_item || t.namaItem;
            let pjg = p[2] || r.panjang || t.panjang;
            let grade = p[3] || r.grade || t.grade;
            let dus = p[4] || r.dus || t.dus;
            let shading = p[5] || r.shading || t.shading;
            let ket = p[6] || r.keterangan || '-'; 
            let po = p[7] || r.customer_aktual || t.customer || '-'; 
            let kondisi = p[8] || r.kondisi || 'Aman'; 

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}_${kondisi}`;
            if(!qrMap[key]) qrMap[key] = [];
            qrMap[key].push(r.qrcode);
        });

        dataKSQR = stokQRRaw.filter(r => r.kondisi !== 'NONAKTIF').map(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = translateBarcode(r.qrcode);
            return {
                _id: r.qrcode,
                qrcode: r.qrcode || '-', id_sku: r.id_sku || '-', id_po: r.id_po || '-', area: p[0] || r.area || '-', 
                tglProduksi: r.tgl_produksi || t.tglProduksi || '-', mesin: r.mesin || t.mesin || '-', shift: r.shift || t.shift || '-', 
                jenis: r.jenis_item || t.jenisItem || '-', nama: p[1] || r.nama_item || t.namaItem || '-',
                pjg: p[2] || r.panjang || t.panjang || '-', grade: p[3] || r.grade || t.grade || '-', 
                dus: p[4] || r.dus || t.dus || '-', shading: p[5] || r.shading || t.shading || '-',
                po_aktual: p[7] || r.customer_aktual || t.customer || '-', 
                ket: p[6] || r.keterangan || '-', 
                kondisi: p[8] || r.kondisi || 'Aman', 
                id: r.id 
            };
        });

        dataKSArea = stokAktualRaw.filter(a => a.kondisi !== 'NONAKTIF').map(a => {
            let key = `${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.area}_${a.customer_aktual}_${a.keterangan}_${a.kondisi}`; 
            return {
                ...a,
                _id: a.id.toString(),
                pjg: a.panjang || '-', jenis: a.jenis_item || '-', nama: a.nama_item || '-',
                qrcodes: qrMap[key] || [], id_sku_base: a.id_sku || '-', id_po: a.id_po || '-',
                po_aktual: a.customer_aktual || '-', customer_estimasi: a.customer_estimasi || '-',
                kondisi: a.kondisi || 'Aman', konversi: a.konversi || null, qty: a.qty || 0
            };
        });

        let globalMap = {};
        dataKSArea.forEach(a => {
            let gKey = `${a.jenis}_${a.nama}_${a.pjg}_${a.grade}_${a.dus}_${a.shading}_${a.po_aktual}_${a.customer_estimasi}_${a.keterangan}_${a.kondisi}`;
            if(!globalMap[gKey]) {
                globalMap[gKey] = { _id: gKey, gKey: gKey, jenis: a.jenis, nama: a.nama, pjg: a.pjg, grade: a.grade, dus: a.dus, shading: a.shading, po: a.po_aktual, customer_estimasi: a.customer_estimasi, ket: a.keterangan, kondisi: a.kondisi, qty: 0, areas: [] };
            }
            globalMap[gKey].qty += a.qty;
            globalMap[gKey].areas.push(a);
        });
        dataKSGlobal = Object.values(globalMap);

        dataKSNonaktif = stokLembaranRaw.map(r => ({ ...r, _id: r.id.toString() })); 

        setModeKS(modeKS);
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center text-red-500 font-medium">Gagal mengolah data: ${e.message}</td></tr>`; 
    }
}

function setModeKS(m) {
    modeKS = m;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    ['qr', 'global', 'area', 'nonaktif'].forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    const btnGantiPO = document.getElementById('btn-ganti-po-main');
    if(btnGantiPO) btnGantiPO.classList.toggle('hidden', m === 'global' || m === 'nonaktif');
    
    const btnReqKonv = document.getElementById('btn-req-konversi-main');
    if(btnReqKonv) btnReqKonv.classList.toggle('hidden', m !== 'area');
    
    const btnProsesGanti = document.getElementById('btn-proses-ganti-main');
    if(btnProsesGanti) btnProsesGanti.classList.toggle('hidden', m !== 'area');
    
    activeFilters = {}; 
    sortState = { col: null, isAsc: true };
    selectedRows.clear();
    selectAllState = 0;
    
    loadUserPreferences(); 
    buildProcessedData();
}

// ============================================================================
// DATA-DRIVEN PIPELINE (MEMORI) - REVISI UNTUK PERFORMA
// ============================================================================

function buildProcessedData() {
    if (modeKS === 'qr') processedData = dataKSQR;
    else if (modeKS === 'area') processedData = dataKSArea;
    else if (modeKS === 'global') processedData = dataKSGlobal;
    else if (modeKS === 'nonaktif') processedData = dataKSNonaktif;

    // Buat searchValues untuk mempermudah filter dan sort
    processedData.forEach(r => {
        if (modeKS === 'qr') {
            let baseSpec = `${r.nama}_${r.pjg}_${r.grade}_${r.dus}_${r.shading}`;
            let poDist = poDistributionMap[baseSpec];
            let poArr = [];
            if(poDist) { for(let po in poDist) { poArr.push(`${po} (${poDist[po]} Dus)`); } }
            let poString = poArr.length > 0 ? poArr.join(' | ') : 'KOSONG';

            r.searchValues = {
                'col-area': r.area, 'col-qr': r.qrcode, 'col-tgl': r.tglProduksi, 'col-mesin': r.mesin,
                'col-shift': r.shift, 'col-jenis': r.jenis, 'col-nama': r.nama, 'col-pjg': r.pjg,
                'col-grade': r.grade, 'col-dus': r.dus, 'col-shading': r.shading, 'col-po': poString, 'col-ket': r.ket
            };
        } else if (modeKS === 'area') {
            r.searchValues = {
                'col-area': r.area, 'col-jenis': r.jenis, 'col-nama': r.nama, 'col-pjg': r.pjg,
                'col-grade': r.grade, 'col-dus': r.dus, 'col-shading': r.shading, 'col-po': r.po_aktual,
                'col-estimasi': r.customer_estimasi, 'col-ket': r.keterangan, 'col-konversi': r.konversi || '-', 'col-qty': r.qty.toString()
            };
        } else if (modeKS === 'global') {
            r.searchValues = {
                'col-jenis': r.jenis, 'col-nama': r.nama, 'col-pjg': r.pjg, 'col-grade': r.grade,
                'col-dus': r.dus, 'col-shading': r.shading, 'col-po': r.po, 'col-estimasi': r.customer_estimasi,
                'col-ket': r.ket, 'col-qty': r.qty.toString()
            };
        } else if (modeKS === 'nonaktif') {
            r.searchValues = {
                'col-area': r.posisi || '-', 'col-qr': r.qrcode || '-', 'col-jenis': r.jenis_item || '-',
                'col-nama': r.nama_item || '-', 'col-pjg': r.panjang || '-', 'col-grade': r.grade || '-',
                'col-dus': r.dus || '-', 'col-shading': r.shading || '-', 'col-po': r.customer_aktual || '-',
                'col-estimasi': r.customer_estimasi || '-', 'col-ket': r.keterangan || '-'
            };
        }
    });

    applyFilters();
}

function applyFilters() {
    filteredData = processedData.filter(row => {
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass];
            const val = row.searchValues[colClass] || '';
            if (!allowed.includes(val)) return false;
        }
        return true;
    });
    applySort();
}

function applySort() {
    if (sortState.col) {
        filteredData.sort((a, b) => {
            let valA = a.searchValues[sortState.col] || '';
            let valB = b.searchValues[sortState.col] || '';
            let numA = parseFloat(valA); let numB = parseFloat(valB);
            let res = 0;
            if (!isNaN(numA) && !isNaN(numB)) res = numA - numB;
            else res = String(valA).localeCompare(String(valB));
            return sortState.isAsc ? res : -res;
        });
    }
    currentPage = 1;
    renderTableHeaders();
    renderTableBody();
}

function sortTable(colClass, headerEl) {
    let isAsc = sortState.col === colClass ? !sortState.isAsc : true;
    sortState = { col: colClass, isAsc: isAsc };
    applySort();
}

function thSort(label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb', 'col-open', 'col-proses'].includes(colClass);
    
    let sortIcon = 'arrow-up-down';
    let sortOpacity = 'opacity-30';
    if (sortState.col === colClass) {
        sortIcon = sortState.isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a';
        sortOpacity = 'opacity-100';
    }

    let filterIconColor = activeFilters[colClass] ? 'text-amber-400 opacity-100' : 'text-white opacity-40';

    if (noFilter) {
        return `<th class="hdr-std ${cls} ${isHidden} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} ${isHidden} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable('${colClass}', this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable('${colClass}', this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="${sortIcon}" class="w-3.5 h-3.5 sort-icon ${sortOpacity} group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon ${filterIconColor} hover:opacity-100 transition-all"></i>
                </button>
            </div>
        </div>
    </th>`;
}

function renderTableHeaders() {
    const thead = document.getElementById('thead-ks');
    if(!thead) return;

    let h = `<tr>
        <th class="hdr-std w-10 col-cb text-center sticky-col">
            <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
        </th>`;

    if(modeKS === 'qr') {
        h += `${thSort('Area', 'col-area')}
              ${thSort('QRCode', 'col-qr')}
              ${thSort('Tgl Produksi', 'col-tgl')}
              ${thSort('Mesin', 'col-mesin')}
              ${thSort('Shift', 'col-shift')}
              ${thSort('Jenis Item', 'col-jenis')}
              ${thSort('Nama Item', 'col-nama')}
              ${thSort('Panjang', 'col-pjg')}
              ${thSort('Grade', 'col-grade')}
              ${thSort('Dus', 'col-dus')}
              ${thSort('Shading', 'col-shading')}
              ${thSort('Customer Aktual', 'col-po')}
              ${thSort('Keterangan', 'col-ket')}`;
    } else if(modeKS === 'area') {
        h += `${thSort('Area', 'col-area')}
              ${thSort('Jenis Item', 'col-jenis')}
              ${thSort('Nama Item', 'col-nama')}
              ${thSort('Panjang', 'col-pjg')}
              ${thSort('Grade', 'col-grade')}
              ${thSort('Dus', 'col-dus')}
              ${thSort('Shading', 'col-shading')}
              ${thSort('Customer Aktual', 'col-po')}
              ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
              ${thSort('Keterangan', 'col-ket')}
              ${thSort('Konversi', 'col-konversi text-rose-300')}
              ${thSort('Total Qty (Dus)', 'col-qty')}`;
    } else if (modeKS === 'global') {
        h += `<th class="hdr-std w-12 col-open text-center">Detail</th>
              ${thSort('Jenis Item', 'col-jenis')}
              ${thSort('Nama Item', 'col-nama')}
              ${thSort('Panjang', 'col-pjg')}
              ${thSort('Grade', 'col-grade')}
              ${thSort('Dus', 'col-dus')}
              ${thSort('Shading', 'col-shading')}
              ${thSort('Customer Aktual', 'col-po')}
              ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
              ${thSort('Keterangan', 'col-ket')}
              ${thSort('TOTAL (DUS)', 'col-qty')}`;
    } else if (modeKS === 'nonaktif') {
        h += `${thSort('Area', 'col-area')}
              ${thSort('QRCode', 'col-qr')}
              ${thSort('Jenis Item', 'col-jenis')}
              ${thSort('Nama Item', 'col-nama')}
              ${thSort('Panjang', 'col-pjg')}
              ${thSort('Grade', 'col-grade')}
              ${thSort('Dus', 'col-dus')}
              ${thSort('Shading', 'col-shading')}
              ${thSort('Customer Aktual', 'col-po')}
              ${thSort('Customer Estimasi', 'col-estimasi')}
              ${thSort('Keterangan', 'col-ket')}`;
    }
    h += `</tr>`;
    thead.innerHTML = h;
    updateSelectAllUI();
}

function renderTableBody() {
    const tbody = document.getElementById('tbody-ks');
    if(!tbody) return;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginated = filteredData.slice(startIndex, endIndex);

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
        updatePaginationUI();
        return;
    }

    let h = '';
    paginated.forEach((r, i) => {
        const isSelected = selectedRows.has(r._id);
        const sv = r.searchValues;
        
        let customRowClass = "transition row-ks text-[13px]";
        if (modeKS === 'nonaktif') customRowClass += " !bg-red-100 !text-red-900 font-bold is-nonaktif";
        else if (modeKS === 'area' && sv['col-konversi'] !== '-') customRowClass += " !bg-rose-100 !text-rose-900 font-bold is-konversi";
        else customRowClass += (i % 2 === 0 ? ' stripe-1' : ' stripe-2');

        if (isSelected) customRowClass += ' selected-row';

        h += `<tr class="${customRowClass}">`;

        if (modeKS === 'qr') {
            const safeQRs = JSON.stringify([r.qrcode]).replace(/"/g, "&quot;");
            let btnPO = `<button onclick="bukaModalLihatPO('${encodeURIComponent(sv['col-po'])}')" class="bg-white text-slate-700 border border-slate-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1 shadow-sm"><i data-lucide="eye" class="w-3 h-3 text-slate-400"></i> Lihat Customer</button>`;

            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-ket="${r.ket}" data-kondisi="${r.kondisi}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left col-area ${hiddenCols.includes('col-area')?'col-hidden':''}">${sv['col-area']}</td>
                <td class="px-4 py-3 font-mono font-medium text-slate-800 text-left col-qr ${hiddenCols.includes('col-qr')?'col-hidden':''}">${sv['col-qr']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}">${sv['col-tgl']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}">${sv['col-mesin']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}">${sv['col-shift']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}">${sv['col-jenis']}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}">${sv['col-nama']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}">${sv['col-pjg']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}">${sv['col-grade']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}">${sv['col-dus']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}">${sv['col-shading']}</td>
                <td class="px-4 py-3 text-left col-po ${hiddenCols.includes('col-po')?'col-hidden':''}">${btnPO}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}">${sv['col-ket']}</td>
            `;
        } else if (modeKS === 'area') {
            const safeQRs = JSON.stringify(r.qrcodes).replace(/"/g, "&quot;");
            let isProcessing = processedGantiKeys.has(`${r.id_sku_base}_${r.customer_estimasi}_${r.area}`);
            let iconGanti = isProcessing ? `<div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white rounded-full shadow-md border border-blue-300 p-1 text-blue-600" title="Sedang diproses ganti label"><i data-lucide="arrow-right-left" class="w-3 h-3"></i></div>` : '';

            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" data-id="${r.id}" data-idsku="${r.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-estimasi="${r.customer_estimasi}" data-qty="${r.qty}" data-ket="${r.keterangan}" data-kondisi="${r.kondisi}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left col-area ${hiddenCols.includes('col-area')?'col-hidden':''}">${sv['col-area']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}">${sv['col-jenis']}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}">${sv['col-nama']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}">${sv['col-pjg']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}">${sv['col-grade']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}">${sv['col-dus']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}">${sv['col-shading']}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po relative ${hiddenCols.includes('col-po')?'col-hidden':''}">
                    ${sv['col-po']}
                    ${iconGanti}
                </td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}">${sv['col-estimasi']}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}">${sv['col-ket']}</td>
                <td class="px-4 py-3 font-bold text-rose-600 text-center col-konversi ${hiddenCols.includes('col-konversi')?'col-hidden':''}">${sv['col-konversi']}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty text-base ${hiddenCols.includes('col-qty')?'col-hidden':''}">${sv['col-qty']}</td>
            `;
        } else if (modeKS === 'global') {
            let checkKey = `${r.nama}_${r.pjg}_${r.grade}_${r.dus}_${r.shading}_${r.ket}_${r.po}`;
            let isProcessing = processedGlobalKeys.has(`${checkKey}_${r.customer_estimasi}`);
            let iconGanti = isProcessing ? `<div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white rounded-full shadow-md border border-blue-300 p-1 text-blue-600" title="Sedang diproses ganti label"><i data-lucide="arrow-right-left" class="w-3 h-3"></i></div>` : '';

            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 text-center col-open"><button onclick="bukaBreakdown('${r.gKey}')" class="p-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-md transition flex mx-auto items-center justify-center shadow-sm"><i data-lucide="box" class="w-4 h-4"></i></button></td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}">${sv['col-jenis']}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}">${sv['col-nama']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}">${sv['col-pjg']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}">${sv['col-grade']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}">${sv['col-dus']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}">${sv['col-shading']}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po relative ${hiddenCols.includes('col-po')?'col-hidden':''}">
                    ${sv['col-po']}
                    ${iconGanti}
                </td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}">${sv['col-estimasi']}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}">${sv['col-ket']}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty text-base ${hiddenCols.includes('col-qty')?'col-hidden':''}">${sv['col-qty']}</td>
            `;
        } else if (modeKS === 'nonaktif') {
            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" value="${r.id}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 font-semibold text-left col-area ${hiddenCols.includes('col-area')?'col-hidden':''}">${sv['col-area']}</td>
                <td class="px-4 py-3 font-mono font-bold text-left col-qr ${hiddenCols.includes('col-qr')?'col-hidden':''}">${sv['col-qr']}</td>
                <td class="px-4 py-3 font-medium text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}">${sv['col-jenis']}</td>
                <td class="px-4 py-3 font-medium text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}">${sv['col-nama']}</td>
                <td class="px-4 py-3 font-medium text-left col-panjang ${hiddenCols.includes('col-pjg')?'col-hidden':''}">${sv['col-pjg']}</td>
                <td class="px-4 py-3 font-medium text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}">${sv['col-grade']}</td>
                <td class="px-4 py-3 font-medium text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}">${sv['col-dus']}</td>
                <td class="px-4 py-3 font-medium text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}">${sv['col-shading']}</td>
                <td class="px-4 py-3 font-medium text-left col-po ${hiddenCols.includes('col-po')?'col-hidden':''}">${sv['col-po']}</td>
                <td class="px-4 py-3 font-medium text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}">${sv['col-estimasi']}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}">${sv['col-ket']}</td>
            `;
        }
        h += `</tr>`;
    });
    
    tbody.innerHTML = h;
    applyColumnOrder();
    if(typeof lucide !== 'undefined') lucide.createIcons();
    updatePaginationUI();
}

function updatePaginationUI() {
    const totalFiltered = filteredData.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    let sumQty = 0;
    if (modeKS === 'qr' || modeKS === 'nonaktif') {
        sumQty = totalFiltered;
    } else {
        filteredData.forEach(r => { sumQty += parseInt(r.searchValues['col-qty']) || 0; });
    }

    document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    document.getElementById('lbl-total-qty').innerText = sumQty;
    document.getElementById('lbl-halaman').innerText = currentPage;
    document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    updateSelectedCount();
}

function changeRowsPerPage(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        rowsPerPage = 999999; 
        if(customInput) customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        if(customInput) {
            customInput.classList.remove('hidden');
            customInput.focus();
            let customVal = parseInt(customInput.value);
            rowsPerPage = (customVal > 0) ? customVal : rowsPerPage;
        }
    } else {
        rowsPerPage = parseInt(val);
        if(customInput) customInput.classList.add('hidden');
    }
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    renderTableBody();
}

function setCustomRowsPerPage(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        rowsPerPage = parsed;
        localStorage.setItem('wms_rows_per_page', rowsPerPage);
        currentPage = 1;
        renderTableBody();
    }
}

function prevPage() { if(currentPage > 1) { currentPage--; renderTableBody(); } }
function nextPage() { 
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    if(currentPage < totalPages) { currentPage++; renderTableBody(); } 
}

function updateSelectedCount() {
    const lbl = document.getElementById('lbl-pilih-baris');
    if(lbl) lbl.innerText = selectedRows.size;
}

function cycleSelectAll() {
    selectAllState = (selectAllState + 1) % 3;
    if (selectAllState === 0) {
        selectedRows.clear();
    } else if (selectAllState === 1) {
        selectedRows.clear();
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        filteredData.slice(startIndex, endIndex).forEach(r => selectedRows.add(r._id));
    } else if (selectAllState === 2) {
        filteredData.forEach(r => selectedRows.add(r._id));
    }
    updateSelectAllUI();
    renderTableBody(); 
}

function updateSelectAllUI() {
    const btn = document.getElementById('btn-select-all');
    if(!btn) return;
    
    if (selectAllState === 0) {
        btn.innerHTML = '';
        btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto';
    } else if (selectAllState === 1) {
        btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto';
    } else if (selectAllState === 2) {
        btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto';
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function highlightRow(cb, id) {
    if (cb.checked) {
        selectedRows.add(id);
    } else {
        selectedRows.delete(id);
    }
    
    if(!cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    renderTableBody(); // Re-render to apply selected class
}

// ========================================================
// FILTER EXCEL PRO (SMART FILTERING & POSITIONING)
// ========================================================
window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation();
    currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    processedData.forEach(row => {
        let show = true;
        for (let c in activeFilters) {
            if (c !== colClass && !activeFilters[c].includes(row.searchValues[c])) {
                show = false; break;
            }
        }
        if (show) uniqueValues.add(row.searchValues[colClass] || '');
    });

    let sortedValues = Array.from(uniqueValues).sort();
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = true;
        if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml;
    updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
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
    
    document.getElementById('filter-search-input').focus();
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    updateSelectAllState();
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

document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) updateSelectAllState(); });

window.searchFilterList = function(val) {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        const query = val.toLowerCase().split(' ').filter(x => x); 
        requestAnimationFrame(() => {
            document.querySelectorAll('.filter-val-item').forEach(label => {
                const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
                let matches = query.every(term => text.includes(term));
                label.style.display = matches ? '' : 'none';
            });
        });
    }, 150);
};

window.closeFilterMenu = function() { document.getElementById('excel-filter-menu').classList.add('hidden'); };

window.clearFilterForCurrentCol = function() {
    delete activeFilters[currentFilterCol];
    closeFilterMenu(); applyFilters(); updateFilterIcons();
};

window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked');
    const totalBoxes = document.querySelectorAll('.filter-val-cb');
    
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') {
        delete activeFilters[currentFilterCol];
    } else {
        let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value));
        activeFilters[currentFilterCol] = selectedVals;
    }
    
    closeFilterMenu(); applyFilters(); updateFilterIcons();
};

function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-amber-400', 'opacity-100');
        icon.classList.add('opacity-40', 'text-white');
    });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            const icon = th.querySelector('.filter-icon');
            if (icon) { 
                icon.classList.remove('opacity-40', 'text-white'); 
                icon.classList.add('text-amber-400', 'opacity-100'); 
            }
        }
    }
}

// ==========================================
// ATUR KOLOM (DRAG & DROP + HIDE)
// ==========================================
window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom');
    const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full'); 
        overlay.classList.remove('hidden'); 
        renderDragList();
    } else {
        sidebar.classList.add('translate-x-full'); 
        overlay.classList.add('hidden');
    }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container');
    container.innerHTML = '';
    
    const headers = Array.from(document.querySelectorAll('#thead-ks th')).filter(th => 
        !th.classList.contains('col-cb') && 
        !th.classList.contains('col-open') && 
        !th.classList.contains('col-proses')
    );
    
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
        const label = th.innerText.trim() || 'Kolom';
        if(!colClass) return;

        const isHidden = hiddenCols.includes(colClass);
        const eyeIcon = isHidden ? 'eye-off' : 'eye';
        const eyeColor = isHidden ? 'text-slate-300' : 'text-blue-600';

        const div = document.createElement('div');
        div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab';
        div.draggable = true; 
        div.setAttribute('data-col', colClass);
        div.innerHTML = `
            <span class="font-bold text-slate-700 text-xs">${label}</span>
            <div class="flex items-center gap-3">
                <button onclick="toggleHideCol(event, '${colClass}')" class="p-1 hover:bg-slate-100 rounded"><i data-lucide="${eyeIcon}" class="w-4 h-4 ${eyeColor}"></i></button>
                <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>
            </div>
        `;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); });
        div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    lucide.createIcons();
    
    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) { container.appendChild(draggable); } 
        else { container.insertBefore(draggable, afterElement); }
    });
};

window.toggleHideCol = function(e, colClass) {
    e.stopPropagation();
    if(hiddenCols.includes(colClass)) {
        hiddenCols = hiddenCols.filter(c => c !== colClass);
    } else {
        hiddenCols.push(colClass);
    }
    renderDragList();
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } 
        else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item');
    let newOrder = [];
    items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    userColOrder = newOrder;
    
    localStorage.setItem(`col_order_ks_${modeKS}_${currentUser.username}`, JSON.stringify(newOrder));
    localStorage.setItem(`col_hidden_ks_${modeKS}_${currentUser.username}`, JSON.stringify(hiddenCols));
    
    alert("Pengaturan kolom berhasil disimpan!");
    toggleSidebarKolom(); 
    renderTableHeaders();
    renderTableBody(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan pengaturan kolom ke default?")) return;
    userColOrder = [];
    hiddenCols = [];
    localStorage.removeItem(`col_order_ks_${modeKS}_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_ks_${modeKS}_${currentUser.username}`);
    
    alert("Pengaturan dikembalikan ke default.");
    toggleSidebarKolom(); 
    renderTableHeaders();
    renderTableBody();
};

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;

    const table = document.getElementById('main-table');
    if(!table) return;
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cells = Array.from(row.children);
        if (cells.length <= 1) return; 

        const cbCell = cells.find(c => c.classList.contains('col-cb'));
        const openCell = cells.find(c => c.classList.contains('col-open'));
        const prosesCell = cells.find(c => c.classList.contains('col-proses'));
        
        const cellMap = {};
        cells.forEach(c => {
            const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-'));
            if (colClass) cellMap[colClass] = c;
        });

        row.innerHTML = ''; 
        if (cbCell) row.appendChild(cbCell); 
        if (openCell) row.appendChild(openCell); 

        userColOrder.forEach(colId => {
            if (cellMap[colId]) {
                row.appendChild(cellMap[colId]);
            }
        });

        cells.forEach(c => {
            const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-'));
            if (colClass !== 'col-cb' && colClass !== 'col-open' && colClass !== 'col-proses' && !userColOrder.includes(colClass)) {
                row.appendChild(c);
            }
        });
        
        if (prosesCell) row.appendChild(prosesCell);
    });
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#main-table th');
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
}

// ==========================================
// EXPORT EXCEL & SALIN DATA
// ==========================================
window.salinData = function() {
    if (selectedRows.size === 0) return alert("Pilih data yang ingin disalin dengan mencentang kotak di kiri data!");

    let textSalin = "";
    const headers = Array.from(document.querySelectorAll('#thead-ks th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    
    textSalin += headers.join('\t') + '\n';

    let exportData = filteredData.filter(r => selectedRows.has(r._id));
    exportData.forEach(row => {
        const sv = row.searchValues;
        const rowData = [];
        
        document.querySelectorAll('#thead-ks th').forEach(th => {
            if(window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')) {
                const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
                if(colClass) {
                    let val = sv[colClass] || '-';
                    let cleanVal = String(val).replace(/<[^>]*>?/gm, '').trim();
                    rowData.push(cleanVal);
                }
            }
        });
        textSalin += rowData.join('\t') + '\n';
    });
    
    navigator.clipboard.writeText(textSalin);
    alert(`Tersalin! Buka Excel dan Paste (Ctrl+V).`);
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
    if (selectedRows.size === 0) return alert("Pilih minimal 1 baris data untuk di-export!");
    
    let ws_data = [];
    const activeHeaders = [];
    
    document.querySelectorAll('#thead-ks th').forEach(th => {
        if(window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')) {
            const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
            let headerText = th.innerText.trim().replace(/\n/g, ' ');
            activeHeaders.push({ text: headerText, colClass: colClass });
        }
    });

    ws_data.push(activeHeaders.map(h => h.text));

    let exportData = filteredData.filter(r => selectedRows.has(r._id));
    exportData.forEach(row => {
        const sv = row.searchValues;
        const rowData = [];
        activeHeaders.forEach(h => {
            let val = sv[h.colClass] || '-';
            let cleanVal = String(val).replace(/<[^>]*>?/gm, '').trim();
            rowData.push(cleanVal);
        });
        ws_data.push(rowData);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kartu_Stok");
    XLSX.writeFile(wb, `Kartu_Stok_${modeKS.toUpperCase()}.xlsx`);
};

// ==========================================
// MODAL & POPUPS
// ==========================================
function tutupSemuaPopups() {
    document.getElementById('modal-lihat-po').classList.add('hidden');
    document.getElementById('modal-breakdown').classList.add('hidden');
    document.getElementById('modal-po').classList.add('hidden');
    document.getElementById('modal-req-konversi').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    if(document.getElementById('sidebar-kolom')) {
        document.getElementById('sidebar-kolom').classList.add('translate-x-full');
    }
}

window.bukaBreakdown = function(gKey) {
    const item = dataKSGlobal.find(g => g.gKey === gKey); if(!item) return;

    document.getElementById('bd-title-item').innerText = `${item.nama} | ${item.pjg} | ${item.grade} | DUS: ${item.dus} | SHADING: ${item.shading} | KET: ${item.ket}`;
    currentBreakdownData = item.areas;

    const tbody = document.getElementById('tbody-breakdown');
    tbody.innerHTML = item.areas.map((a, i) => {
        const safeQRs = JSON.stringify(a.qrcodes).replace(/"/g, "&quot;");
        const stripeClass = i % 2 === 0 ? 'stripe-1' : 'stripe-2';
        
        return `
            <tr class="transition bd-row text-[13px] ${stripeClass}">
                <td class="px-4 py-3 text-center sticky-col"><input type="checkbox" onchange="highlightBdRow(this)" data-idsku="${a.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po_aktual}" data-estimasi="${a.customer_estimasi}" data-qty="${a.qty}" data-ket="${a.keterangan}" data-kondisi="${a.kondisi}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left">${a.area}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po">${a.po_aktual}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi">${a.customer_estimasi}</td>
                <td class="px-4 py-3 font-medium text-slate-600 text-left whitespace-normal min-w-[200px]">${a.keterangan}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center">${a.qty}</td>
            </tr>`;
    }).join('');

    document.getElementById('modal-breakdown').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalBreakdown = function() { 
    document.getElementById('modal-breakdown').classList.add('hidden'); 
    document.getElementById('overlay-klik-luar').classList.add('hidden'); 
};

window.highlightBdRow = function(cb) {
    const tr = cb.closest('tr');
    if(cb.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
};

window.toggleCentangBreakdown = function(checked) { 
    document.querySelectorAll('.cb-bd').forEach(cb => { cb.checked = checked; highlightBdRow(cb); }); 
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
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded text-xs font-black">${qtyPo}</span>
                    </li>`;
        }).join('');
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('modal-lihat-po').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.siapkanGantiPO = function(context) {
    let checkboxes = [];
    if(context === 'main') {
        if(modeKS === 'global' || modeKS === 'nonaktif') return;
        
        // Ambil data dari filteredData berdasarkan selectedRows
        selectedForAction = [];
        let totalDus = 0;
        filteredData.forEach(r => {
            if(selectedRows.has(r._id)) {
                selectedForAction.push({
                    id_sku: r.id_sku_base,
                    nama_item: r.nama,
                    pjg: r.pjg,
                    grade: r.grade,
                    dus: r.dus,
                    shading: r.shading,
                    po_aktual: r.po_aktual,
                    customer_estimasi: r.customer_estimasi,
                    area: r.area,
                    keterangan: r.keterangan,
                    kondisi: r.kondisi,
                    qty: r.qty
                });
                totalDus += r.qty;
            }
        });
        
        if(selectedForAction.length === 0) return alert('Silakan centang item / area yang ingin diganti Customer Estimasi-nya.');

    } else { 
        checkboxes = document.querySelectorAll('.cb-bd:checked'); 
        if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diganti Customer Estimasi-nya.');
        
        selectedForAction = []; let totalDus = 0;
        checkboxes.forEach(cb => {
            selectedForAction.push({ 
                id_sku: cb.dataset.idsku, 
                nama_item: cb.dataset.nama,
                pjg: cb.dataset.pjg,
                grade: cb.dataset.grade,
                dus: cb.dataset.dus,
                shading: cb.dataset.shading,
                po_aktual: cb.dataset.po,
                customer_estimasi: cb.dataset.estimasi,
                area: cb.dataset.area,
                keterangan: cb.dataset.ket,
                kondisi: cb.dataset.kondisi, 
                qty: parseInt(cb.dataset.qty) || 0
            });
            totalDus += parseInt(cb.dataset.qty) || 0;
        });
    }

    sourcePOContext = context;
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
    if(!newPO) return alert("Silakan Pilih Customer Baru dari daftar dropdown!");

    const qtyDiminta = parseInt(document.getElementById('input-qty-ganti').value);
    if(isNaN(qtyDiminta) || qtyDiminta <= 0) return alert("Jumlah dus tidak valid!");

    let maxDus = selectedForAction.reduce((sum, row) => sum + row.qty, 0);
    if(qtyDiminta > maxDus) return alert(`Maksimal jatah adalah ${maxDus} dus!`);

    const btn = document.getElementById('btn-simpan-po'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        let qtySisaUntukDiupdate = qtyDiminta; 
        
        for(let row of selectedForAction) {
            if (qtySisaUntukDiupdate <= 0) break; 
            
            let qtyPotong = Math.min(row.qty, qtySisaUntukDiupdate);
            qtySisaUntukDiupdate -= qtyPotong;

            const { data: oldRows, error: errOld } = await db.from('stok_aktual')
                .select('*')
                .eq('nama_item', row.nama_item)
                .eq('panjang', row.pjg)
                .eq('grade', row.grade)
                .eq('dus', row.dus)
                .eq('shading', row.shading)
                .eq('area', row.area)
                .eq('customer_aktual', row.po_aktual)
                .eq('customer_estimasi', row.customer_estimasi)
                .eq('keterangan', row.keterangan)
                .eq('kondisi', row.kondisi) 
                .limit(1);
            
            if (errOld) throw errOld;

            if (oldRows && oldRows.length > 0) {
                let oldRow = oldRows[0];
                
                let sisaQty = oldRow.qty - qtyPotong;
                if (sisaQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', oldRow.id);
                } else {
                    await db.from('stok_aktual').update({qty: sisaQty}).eq('id', oldRow.id);
                }

                const { data: newRows, error: errNew } = await db.from('stok_aktual')
                    .select('id, qty')
                    .eq('nama_item', oldRow.nama_item)
                    .eq('panjang', oldRow.panjang)
                    .eq('grade', oldRow.grade)
                    .eq('dus', oldRow.dus)
                    .eq('shading', oldRow.shading)
                    .eq('area', oldRow.area)
                    .eq('customer_aktual', oldRow.customer_aktual)
                    .eq('customer_estimasi', newPO)
                    .eq('keterangan', oldRow.keterangan)
                    .eq('kondisi', oldRow.kondisi) 
                    .limit(1);

                if (errNew) throw errNew;

                if (newRows && newRows.length > 0) {
                    await db.from('stok_aktual').update({qty: newRows[0].qty + qtyPotong}).eq('id', newRows[0].id);
                } else {
                    let insertData = { ...oldRow };
                    delete insertData.id; 
                    delete insertData.created_at; 
                    insertData.customer_estimasi = newPO;
                    insertData.qty = qtyPotong;
                    await db.from('stok_aktual').insert([insertData]);
                }
            }
        }
        
        tutupModalPO(); 
        if(sourcePOContext === 'breakdown') tutupModalBreakdown();
        
        await muatDataStok();
        alert("Berhasil mengganti Customer Estimasi!");
    } catch (error) { 
        alert("GAGAL UPDATE: " + error.message); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons(); 
    }
};

window.prosesLabelCustomerMassal = async function() {
    if (selectedRows.size === 0) return alert("Pilih baris yang ingin diproses label customernya!");

    let payload = [];
    let invalidCount = 0;

    filteredData.forEach(r => {
        if(selectedRows.has(r._id)) {
            let poAktual = r.po_aktual;
            let poEstimasi = r.customer_estimasi;
            
            if(poAktual !== poEstimasi) {
                payload.push({
                    id_sku: r.id_sku_base,
                    area: r.area,
                    jenis_item: r.jenis,
                    nama_item: r.nama,
                    panjang: r.pjg,
                    grade: r.grade,
                    dus: r.dus,
                    shading: r.shading,
                    keterangan: r.keterangan,
                    customer_aktual_awal: poAktual,
                    customer_aktual_request: poEstimasi,
                    qty_request: r.qty,
                    qty_proses: 0,
                    progres: 'PENDING'
                });
            } else {
                invalidCount++;
            }
        }
    });

    if(payload.length === 0) {
        return alert("Tidak ada baris valid untuk diproses.\nPastikan Anda memilih baris yang Customer Aktual dan Customer Estimasinya BERBEDA.");
    }

    if(!confirm(`Akan memproses ${payload.length} item ke tabel Ganti Customer.\nLanjutkan?`)) return;

    const btn = document.getElementById('btn-proses-ganti-main');
    const ori = btn.innerHTML;
    btn.innerHTML = '<div class="bg-emerald-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-emerald-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-emerald-700 transition">Memproses...</div>';
    btn.disabled = true;

    try {
        const { error } = await db.from('ganti_customer').insert(payload);
        if(error) throw error;

        alert(`✅ BERHASIL!\n${payload.length} item telah dikirim ke antrean Ganti Customer.`);
        await muatDataStok(); 
    } catch(e) {
        alert("Gagal memproses: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.siapkanReqKonversi = function() {
    if(selectedRows.size !== 1) return alert('Silakan centang TEPAT 1 (satu) baris item yang ingin direquest konversi.');

    const selectedId = Array.from(selectedRows)[0];
    const r = filteredData.find(d => d._id === selectedId);
    
    if(!r) return alert("Data tidak ditemukan!");

    selectedForReq = {
        id: r.id, 
        jenis_item: r.jenis || '-',
        nama_item: r.nama || '-',
        panjang: r.pjg || '-',
        grade: r.grade || '-',
        dus: r.dus || '-',
        shading: r.shading || '-',
        customer_aktual: r.po_aktual || '-',
        customer_estimasi: r.customer_estimasi || '-', 
        keterangan: r.keterangan || '-',
        area: r.area || '-',
        qty_max: r.qty || 0
    };

    const infoAsal = document.getElementById('req-info-asal');
    if(infoAsal) {
        infoAsal.innerHTML = `
            <span class="text-blue-600">${selectedForReq.nama_item}</span> | 
            ${selectedForReq.panjang} | ${selectedForReq.grade} | ${selectedForReq.dus} | ${selectedForReq.shading} | 
            <span class="text-emerald-600">${selectedForReq.area}</span> | 
            <span class="text-orange-600">${selectedForReq.customer_aktual}</span>
        `;
    }

    // Reset Form Input
    ['req-nama-item', 'req-panjang', 'req-grade', 'req-dus', 'req-shading', 'req-qty', 'req-qty-hasil'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });

    document.getElementById('modal-req-konversi').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalReqKonversi = function() {
    document.getElementById('modal-req-konversi').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    selectedForReq = null;
};

window.eksekusiReqKonversi = async function() {
    if(!selectedForReq) return alert("Data sumber tidak valid!");

    const namaReq = document.getElementById('req-nama-item').value.trim() || selectedForReq.nama_item;
    
    const rawPjgReq = document.getElementById('req-panjang').value.trim();
    let pjgReq = selectedForReq.panjang;
    if (rawPjgReq) {
        let pUpper = rawPjgReq.toUpperCase();
        pjgReq = pUpper.endsWith('M') ? pUpper : pUpper + 'M';
    }

    const gradeReq = document.getElementById('req-grade').value.trim() || selectedForReq.grade;
    const dusReq = document.getElementById('req-dus').value.trim() || selectedForReq.dus;
    const shadingReq = document.getElementById('req-shading').value.trim() || selectedForReq.shading;
    
    const qtyReq = parseInt(document.getElementById('req-qty').value);
    const qtyHasil = parseInt(document.getElementById('req-qty-hasil').value);

    if(isNaN(qtyReq) || qtyReq <= 0) return alert("Qty Request tidak valid!");
    if(isNaN(qtyHasil) || qtyHasil <= 0) return alert("Qty Hasil tidak valid!");
    if(qtyReq > selectedForReq.qty_max) return alert(`Maksimal Qty Request adalah ${selectedForReq.qty_max} dus!`);

    const btn = document.getElementById('btn-save-req-konv'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        // 1. Generate Kode Konversi: K-DDMMYYXX
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const prefix = `K-${dd}${mm}${yy}`;

        const { data: existingCodes, error: errCodes } = await db
            .from('request_konversi')
            .select('kode_konversi')
            .like('kode_konversi', `${prefix}%`);
        
        if(errCodes) throw errCodes;

        let seq = 1;
        if(existingCodes && existingCodes.length > 0) {
            let seqs = existingCodes.map(c => {
                let s = c.kode_konversi.replace(prefix, '');
                return parseInt(s) || 0;
            });
            seq = Math.max(...seqs) + 1;
        }
        const kodeKonversi = `${prefix}${String(seq).padStart(2, '0')}`;

        // 2. Cari baris normal di stok_aktual berdasarkan ID
        const { data: origRow, error: errOrig } = await db.from('stok_aktual')
            .select('*')
            .eq('id', selectedForReq.id)
            .single();

        if (errOrig || !origRow) throw new Error("Gagal menemukan baris stok asal di database.");

        // 3. Potong saldo asal
        let newOrigQty = origRow.qty - qtyReq;
        if(newOrigQty <= 0) {
            await db.from('stok_aktual').delete().eq('id', origRow.id);
        } else {
            await db.from('stok_aktual').update({ qty: newOrigQty }).eq('id', origRow.id);
        }

        // 4. Masukkan baris pecahan baru bertanda konversi = KODE KONVERSI
        let splitRow = { ...origRow };
        delete splitRow.id;
        delete splitRow.created_at;
        splitRow.qty = qtyReq;
        splitRow.konversi = kodeKonversi; 
        await db.from('stok_aktual').insert([splitRow]);

        // 5. Masukkan data ke request_konversi
        const payload = {
            kode_konversi: kodeKonversi,
            aktifitas_konversi: 'req',
            area: selectedForReq.area,
            jenis_item: selectedForReq.jenis_item,
            nama_item: selectedForReq.nama_item,
            panjang: selectedForReq.panjang,
            grade: selectedForReq.grade,
            dus: selectedForReq.dus,
            shading: selectedForReq.shading,
            keterangan: selectedForReq.keterangan,
            "customer aktual": selectedForReq.customer_aktual,
            customer_estimasi: selectedForReq.customer_estimasi, 
            nama_item_req: namaReq,
            panjang_req: pjgReq, 
            grade_req: gradeReq,
            dus_req: dusReq,
            shading_req: shadingReq,
            qty_req: qtyReq.toString(),
            qty_hasil: qtyHasil.toString(),
            qty_out: "0",
            qty_in: "0",
            progres_konversi: "PENDING",
            pic_request: currentUser.username
        };

        const { error } = await db.from('request_konversi').insert([payload]);
        if(error) throw error;
        
        tutupModalReqKonversi();
        alert(`Berhasil membuat Request Konversi dengan Kode: ${kodeKonversi}`);
        await muatDataStok();
    } catch(e) {
        alert("Gagal menyimpan request: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};
