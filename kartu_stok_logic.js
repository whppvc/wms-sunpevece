let modeKS = 'area'; 
let stokGlobalRaw = []; 
let stokAktualRaw = []; 
let namaJasperRaw = [];

// Data Arrays
let dataKSArea = []; 
let dataKSGlobal = [];
let dataKSDetail = [];

let processedData = []; 
let filteredData = [];  

let sourcePOContext = ''; 
let currentBreakdownData = [];
let sortState = { col: null, isAsc: true };
let masterData = { kamus: [] };

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
let selectAllState = 0; 
let userColOrder = []; 
let hiddenCols = []; 
let selectedRows = new Set(); 
let selectedForReq = null; 
let selectedForAction = []; 
let selectedForActionKet = [];

let processedGantiKeys = new Set();
let processedGlobalKeys = new Set();

let filterTimeout;

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), { username: 'Admin', role: 'admin' });

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

// ==========================================
// CUSTOM ALERT & NOTIFICATION SYSTEM
// ==========================================
window.tampilkanAlert = function(pesan, tipe = 'info') {
    const modal = document.getElementById('modal-custom-alert');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const iconContainer = document.getElementById('alert-icon-container');
    const icon = document.getElementById('alert-icon');

    msg.innerText = pesan;
    modal.classList.remove('hidden');

    if (tipe === 'warning') {
        title.innerText = 'Perhatian';
        title.className = 'text-lg font-black mb-2 text-amber-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-600';
        icon.setAttribute('data-lucide', 'alert-triangle');
    } else if (tipe === 'success') {
        title.innerText = 'Berhasil';
        title.className = 'text-lg font-black mb-2 text-emerald-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-emerald-100 text-emerald-600';
        icon.setAttribute('data-lucide', 'check-circle');
    } else if (tipe === 'error') {
        title.innerText = 'Gagal';
        title.className = 'text-lg font-black mb-2 text-rose-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-rose-100 text-rose-600';
        icon.setAttribute('data-lucide', 'x-circle');
    } else {
        title.innerText = 'Informasi';
        title.className = 'text-lg font-black mb-2 text-blue-600';
        iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-blue-100 text-blue-600';
        icon.setAttribute('data-lucide', 'info');
    }
    lucide.createIcons();
};

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
            Array.from(sel.options).forEach(opt => { if(opt.value == rowsPerPage) opt.selected = true; });
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initModernLayout({ id: 'kartu_stok', title: 'KARTU STOK', url: 'kartu_stok.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('th.cursor-pointer')) {
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

    await loadMasterData();
    loadUserPreferences(); 
    
    const userRole = (currentUser.role || '').toLowerCase();
    if (userRole === 'creator' || userRole === 'superadmin') {
        const btnSync = document.getElementById('btn-sync-stok');
        if(btnSync) {
            btnSync.classList.remove('hidden');
            btnSync.classList.add('flex');
        }
    }

    setTimeout(muatDataStok, 200);
});

window.toggleActionMenu = toggleActionMenu;
function toggleActionMenu(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
}

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
        const { data } = await db.from('master_2').select('*');
        if (data) {
            masterData.kamus = data; 
            let poSet = new Set(), namaSet = new Set(), gradeSet = new Set(), dusSet = new Set();

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

            const fillSel = (id, setArr) => {
                const sel = document.getElementById(id);
                if(sel) {
                    let html = '<option value="">-- Tetap --</option>';
                    Array.from(setArr).sort().forEach(n => { html += `<option value="${n}">${n}</option>`; });
                    sel.innerHTML = html;
                }
            };
            fillSel('req-nama-item', namaSet);
            fillSel('req-grade', gradeSet);
            fillSel('req-dus', dusSet);
        }
    } catch (e) { console.error("Gagal load master_2:", e); }
}

window.bukaModalSync = function() {
    const userRole = (currentUser.role || '').toLowerCase();
    if(!['creator', 'superadmin'].includes(userRole)) {
        return tampilkanAlert("Akses Ditolak! Hanya Creator atau Superadmin yang dapat melakukan sinkronisasi data.", "error");
    }
    
    const msg = "PERINGATAN KERAS!\n\nProses ini akan MENGHAPUS SELURUH DATA di tabel stok_aktual dan menghitung ulang dari nol berdasarkan fisik di stok_global.\n\nCatatan: Data Customer Estimasi dan Status Konversi yang sedang menggantung mungkin akan ter-reset.\n\nApakah Anda yakin ingin melanjutkan?";
    
    if(confirm(msg)) {
        eksekusiSyncStok();
    }
};

window.eksekusiSyncStok = async function() {
    document.getElementById('modal-sync').classList.remove('hidden');
    const title = document.getElementById('sync-title');
    const subtitle = document.getElementById('sync-subtitle');
    const bar = document.getElementById('sync-progress-bar');
    const txt = document.getElementById('sync-progress-text');

    try {
        subtitle.innerText = "Menarik data fisik gudang...";
        const globalData = await fetchAllRows(db.from('stok_global').select('*').neq('kondisi', 'NONAKTIF'));
        
        subtitle.innerText = "Menghitung akumulasi...";
        let mapAgg = {};
        globalData.forEach(g => {
            let pjg = formatPanjang(g.panjang);
            let key = `${g.nama_item}_${pjg}_${g.grade}_${g.dus}_${g.shading}_${g.area}_${g.customer_aktual}_${g.keterangan}`;
            
            if(!mapAgg[key]) {
                mapAgg[key] = {
                    id_sku: g.id_sku,
                    jenis_item: g.jenis_item,
                    nama_item: g.nama_item,
                    panjang: pjg,
                    grade: g.grade,
                    dus: g.dus,
                    shading: g.shading,
                    area: g.area,
                    customer_aktual: g.customer_aktual,
                    customer_estimasi: g.customer_aktual,
                    keterangan: g.keterangan || '-',
                    kondisi: g.kondisi || 'Aman',
                    qty: 0
                };
            }
            mapAgg[key].qty++;
        });
        const insertData = Object.values(mapAgg);

        subtitle.innerText = "Mempersiapkan penghapusan...";
        const aktualData = await fetchAllRows(db.from('stok_aktual').select('id'));
        const idsToDelete = aktualData.map(a => a.id);

        subtitle.innerText = "Menghapus data lama...";
        let delCount = 0;
        const chunkSize = 500;
        for (let i = 0; i < idsToDelete.length; i += chunkSize) {
            const chunk = idsToDelete.slice(i, i + chunkSize);
            await db.from('stok_aktual').delete().in('id', chunk);
            delCount += chunk.length;
            let pct = Math.round((delCount / idsToDelete.length) * 50); 
            bar.style.width = pct + '%';
            txt.innerText = pct + '%';
        }

        subtitle.innerText = "Memasukkan data baru...";
        let insCount = 0;
        for (let i = 0; i < insertData.length; i += chunkSize) {
            const chunk = insertData.slice(i, i + chunkSize);
            await db.from('stok_aktual').insert(chunk);
            insCount += chunk.length;
            let pct = 50 + Math.round((insCount / insertData.length) * 50); 
            bar.style.width = pct + '%';
            txt.innerText = pct + '%';
        }

        title.innerText = "Selesai!";
        subtitle.innerText = "Data berhasil disinkronisasi.";
        setTimeout(() => {
            document.getElementById('modal-sync').classList.add('hidden');
            muatDataStok();
        }, 1500);

    } catch (e) {
        tampilkanAlert("Terjadi kesalahan saat sinkronisasi: " + e.message, "error");
        document.getElementById('modal-sync').classList.add('hidden');
    }
};

window.muatDataStok = muatDataStok;
async function muatDataStok() {
    const tbody = document.getElementById('tbody-ks');
    if(tbody) tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-3 text-blue-500"></i><p class="font-bold text-slate-500">Menghubungkan ke database...</p></td></tr>`;
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const [stokGlobalData, resAktual, resGanti, resJasper] = await Promise.all([
            fetchAllRows(db.from('stok_global').select('*')), 
            fetchAllRows(db.from('stok_aktual').select('*')),
            fetchAllRows(db.from('ganti_customer').select('id_sku, customer_aktual_request, area').neq('progres', 'DONE')),
            fetchAllRows(db.from('nama_jasper').select('*'))
        ]);
        
        stokGlobalRaw = stokGlobalData || []; 
        stokAktualRaw = resAktual || [];
        namaJasperRaw = resJasper || [];

        processedGantiKeys.clear();
        processedGlobalKeys.clear();
        if (resGanti) {
            resGanti.forEach(g => {
                processedGantiKeys.add(`${g.id_sku}_${g.customer_aktual_request}_${g.area}`);
                let parts = (g.id_sku || '').split('_');
                if(parts.length >= 8) {
                    let globalSku = `${parts[1]}_${parts[2]}_${parts[3]}_${parts[4]}_${parts[5]}_${parts[6]}_${parts[7]}`;
                    processedGlobalKeys.add(`${globalSku}_${g.customer_aktual_request}`);
                }
            });
        }

        // 1. DATA KS AREA (Langsung dari stok_aktual)
        dataKSArea = stokAktualRaw.filter(a => a.kondisi !== 'NONAKTIF').map(a => {
            let pjgFormatted = formatPanjang(a.panjang);
            return {
                ...a,
                _id: a.id.toString(),
                id: a.id,
                pjg: pjgFormatted, 
                jenis: a.jenis_item || '-', 
                nama: a.nama_item || '-',
                id_sku_base: a.id_sku || '-',
                po_aktual: a.customer_aktual || '-', 
                customer_estimasi: a.customer_estimasi || '-',
                kondisi: a.kondisi || 'Aman', 
                konversi: a.konversi || null, 
                qty: parseInt(a.qty) || 0
            };
        });

        // 2. DATA KS GLOBAL (Agregasi dari dataKSArea)
        let globalMap = {};
        dataKSArea.forEach(a => {
            let gKey = `${a.jenis}_${a.nama}_${a.pjg}_${a.grade}_${a.dus}_${a.shading}_${a.po_aktual}_${a.customer_estimasi}_${a.keterangan}_${a.kondisi}_${a.konversi}`;
            if(!globalMap[gKey]) {
                globalMap[gKey] = { 
                    _id: gKey, gKey: gKey, jenis: a.jenis, nama: a.nama, pjg: a.pjg, 
                    grade: a.grade, dus: a.dus, shading: a.shading, po: a.po_aktual, 
                    customer_estimasi: a.customer_estimasi, ket: a.keterangan, kondisi: a.kondisi, 
                    konversi: a.konversi, qty: 0, areas: [] 
                };
            }
            globalMap[gKey].qty += parseInt(a.qty) || 0;
            globalMap[gKey].areas.push(a);
        });
        dataKSGlobal = Object.values(globalMap);

        // 3. DATA KS DETAIL (Agregasi dari stok_aktual dengan tambahan info produksi dari stok_global)
        let detailMap = {};
        
        let prodInfoMap = {};
        stokGlobalRaw.forEach(g => {
            if(g.kondisi === 'NONAKTIF') return;
            let pjgFormatted = formatPanjang(g.panjang);
            let key = `${g.nama_item}_${pjgFormatted}_${g.grade}_${g.dus}_${g.shading}_${g.area}_${g.customer_aktual}_${g.keterangan}`;
            if(!prodInfoMap[key]) {
                prodInfoMap[key] = { tgl: g.tgl_produksi || '-', mesin: g.mesin || '-', shift: g.shift || '-' };
            }
        });

        dataKSArea.forEach(a => {
            let pjgFormatted = formatPanjang(a.panjang);
            let prodKey = `${a.nama_item}_${pjgFormatted}_${a.grade}_${a.dus}_${a.shading}_${a.area}_${a.customer_aktual}_${a.keterangan}`;
            let prodInfo = prodInfoMap[prodKey] || { tgl: '-', mesin: '-', shift: '-' };

            let jName = a.nama_item || '-';
            if(namaJasperRaw.length > 0) {
                const cJasper = namaJasperRaw.find(j => j.nama_item === a.nama_item && formatPanjang(j.panjang) === pjgFormatted && j.grade === a.grade);
                if(cJasper) jName = cJasper.nama_jasper;
                else jName = `JAS-${a.nama_item}`;
            } else { jName = `JAS-${a.nama_item}`; }

            let dKey = `${prodInfo.tgl}_${prodInfo.mesin}_${prodInfo.shift}_${a.jenis_item}_${a.nama_item}_${jName}_${pjgFormatted}_${a.grade}_${a.dus}_${a.shading}_${a.customer_aktual}_${a.customer_estimasi}_${a.keterangan}_${a.konversi}`;
            
            if(!detailMap[dKey]) {
                detailMap[dKey] = {
                    _id: dKey, tgl: prodInfo.tgl, mesin: prodInfo.mesin, shift: prodInfo.shift,
                    jenis: a.jenis_item || '-', nama: a.nama_item || '-', jasper: jName, pjg: pjgFormatted,
                    grade: a.grade || '-', dus: a.dus || '-', shading: a.shading || '-',
                    po_aktual: a.customer_aktual || '-', customer_estimasi: a.customer_estimasi || '-', ket: a.keterangan || '-',
                    konversi: a.konversi || null, qty: 0
                };
            }
            detailMap[dKey].qty += parseInt(a.qty) || 0;
        });
        dataKSDetail = Object.values(detailMap);

        buildProcessedData();
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center text-red-500 font-bold">Gagal mengolah data: ${e.message}</td></tr>`; 
    }
}

window.gantiTab = function(mode) {
    activeFilters = {}; 
    sortState = { col: null, isAsc: true };
    selectedRows.clear();
    selectAllState = 0;
    currentPage = 1;
    
    setModeKS(mode);
};

function setModeKS(m) {
    modeKS = m;
    
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    ['area', 'global', 'detail'].forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });

    const btnGantiPO = document.getElementById('btn-ganti-po-main');
    if(btnGantiPO) btnGantiPO.classList.toggle('hidden', m === 'global' || m === 'detail');

    const btnReqKonv = document.getElementById('btn-req-konversi-main');
    if(btnReqKonv) btnReqKonv.classList.toggle('hidden', m !== 'area');
    
    const btnProsesGanti = document.getElementById('btn-proses-ganti-main');
    if(btnProsesGanti) btnProsesGanti.classList.toggle('hidden', m !== 'area');

    const btnGantiKet = document.getElementById('btn-ganti-ket-main');
    if(btnGantiKet) btnGantiKet.classList.toggle('hidden', m === 'detail');
    
    loadUserPreferences(); 
    buildProcessedData();
}

function buildProcessedData() {
    if (modeKS === 'area') processedData = dataKSArea;
    else if (modeKS === 'global') processedData = dataKSGlobal;
    else if (modeKS === 'detail') processedData = dataKSDetail;

    processedData.forEach(r => {
        if (modeKS === 'area') {
            r.searchValues = {
                'col-area': r.area, 'col-jenis': r.jenis, 'col-nama': r.nama, 'col-pjg': r.pjg,
                'col-grade': r.grade, 'col-dus': r.dus, 'col-shading': r.shading, 'col-po': r.po_aktual,
                'col-estimasi': r.customer_estimasi, 'col-ket': r.keterangan || '-', 'col-konversi': r.konversi || '-', 'col-qty': r.qty.toString()
            };
        } else if (modeKS === 'global') {
            r.searchValues = {
                'col-jenis': r.jenis, 'col-nama': r.nama, 'col-pjg': r.pjg, 'col-grade': r.grade,
                'col-dus': r.dus, 'col-shading': r.shading, 'col-po': r.po, 'col-estimasi': r.customer_estimasi,
                'col-ket': r.ket || '-', 'col-qty': r.qty.toString()
            };
        } else if (modeKS === 'detail') {
            r.searchValues = {
                'col-tgl': r.tgl, 'col-mesin': r.mesin, 'col-shift': r.shift, 'col-jenis': r.jenis,
                'col-nama': r.nama, 'col-jasper': r.jasper, 'col-pjg': r.pjg, 'col-grade': r.grade,
                'col-dus': r.dus, 'col-shading': r.shading, 'col-po': r.po_aktual, 'col-estimasi': r.customer_estimasi,
                'col-ket': r.ket || '-', 'col-konversi': r.konversi || '-', 'col-qty': r.qty.toString()
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

window.sortFromMenu = function(dir) {
    if(!currentFilterCol) return;
    sortState = { col: currentFilterCol, isAsc: dir === 'asc' };
    closeFilterMenu();
    applySort();
};

function thSort(label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb', 'col-open'].includes(colClass);
    
    let isFiltered = activeFilters[colClass] && activeFilters[colClass].length > 0;
    let hdrBgClass = isFiltered ? 'hdr-filtered' : '';
    let filterIconColor = isFiltered ? 'text-amber-400 opacity-100' : 'text-slate-400 opacity-40';

    if (noFilter) {
        return `<th class="hdr-std ${cls} ${isHidden} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} ${isHidden} ${hdrBgClass} select-none group cursor-pointer hover:bg-slate-700 transition" onclick="openColumnFilter(event, '${colClass}', '${label}')">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="truncate flex-1 text-left" title="${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <i data-lucide="chevron-down" class="w-4 h-4 filter-icon ${filterIconColor} group-hover:opacity-100 transition-all"></i>
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

    if(modeKS === 'area') {
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
              ${thSort('Total Qty (Dus)', 'col-qty text-emerald-300')}`;
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
              ${thSort('TOTAL (DUS)', 'col-qty text-emerald-300')}`;
    } else if (modeKS === 'detail') {
        h += `${thSort('Tgl Produksi', 'col-tgl')}
              ${thSort('Mesin', 'col-mesin')}
              ${thSort('Shift', 'col-shift')}
              ${thSort('Jenis Item', 'col-jenis')}
              ${thSort('Nama Item', 'col-nama')}
              ${thSort('Nama Jasper', 'col-jasper text-purple-300')}
              ${thSort('Panjang', 'col-pjg')}
              ${thSort('Grade', 'col-grade')}
              ${thSort('Dus', 'col-dus')}
              ${thSort('Shading', 'col-shading')}
              ${thSort('Customer Aktual', 'col-po')}
              ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
              ${thSort('Keterangan', 'col-ket')}
              ${thSort('Konversi', 'col-konversi text-rose-300')}
              ${thSort('QTY (DUS)', 'col-qty text-emerald-300')}`;
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
        let isKonversi = sv['col-konversi'] && sv['col-konversi'] !== '-' && sv['col-konversi'] !== 'null';
        
        if (isKonversi) {
            customRowClass += " !bg-red-100 !text-red-900 font-bold";
        } else {
            customRowClass += (i % 2 === 0 ? ' stripe-1' : ' stripe-2');
        }

        if (isSelected) customRowClass += ' selected-row';

        h += `<tr class="${customRowClass}">`;

        if (modeKS === 'area') {
            let isProcessing = processedGantiKeys.has(`${r.id_sku_base}_${r.customer_estimasi}_${r.area}`);
            let iconGanti = isProcessing ? `<div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white rounded-full shadow-md border border-blue-300 p-1 text-blue-600" title="Sedang diproses ganti label"><i data-lucide="arrow-right-left" class="w-3 h-3"></i></div>` : '';

            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-400 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
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
                <td class="px-4 py-3 font-bold text-red-700 text-center col-konversi ${hiddenCols.includes('col-konversi')?'col-hidden':''}">${sv['col-konversi']}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty text-base ${hiddenCols.includes('col-qty')?'col-hidden':''}">${sv['col-qty']}</td>
            `;
        } else if (modeKS === 'global') {
            let checkKey = `${r.nama}_${r.pjg}_${r.grade}_${r.dus}_${r.shading}_${r.ket}_${r.po}`;
            let isProcessing = processedGlobalKeys.has(`${checkKey}_${r.customer_estimasi}`);
            let iconGanti = isProcessing ? `<div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white rounded-full shadow-md border border-blue-300 p-1 text-blue-600" title="Sedang diproses ganti label"><i data-lucide="arrow-right-left" class="w-3 h-3"></i></div>` : '';
            
            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-400 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
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
        } else if (modeKS === 'detail') {
            let ketText = isKonversi ? `[LOCKED: ${sv['col-konversi']}] ${sv['col-ket']}` : sv['col-ket'];
            
            h += `
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this, '${r._id}')" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-400 focus:ring-blue-500" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-3 font-medium text-slate-600 text-center col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}">${sv['col-tgl']}</td>
                <td class="px-4 py-3 font-medium text-slate-600 text-center col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}">${sv['col-mesin']}</td>
                <td class="px-4 py-3 font-medium text-slate-600 text-center col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}">${sv['col-shift']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}">${sv['col-jenis']}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}">${sv['col-nama']}</td>
                <td class="px-4 py-3 font-black text-purple-700 text-left col-jasper ${hiddenCols.includes('col-jasper')?'col-hidden':''}">${sv['col-jasper']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-center col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}">${sv['col-pjg']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-center col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}">${sv['col-grade']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-center col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}">${sv['col-dus']}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-center col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}">${sv['col-shading']}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po ${hiddenCols.includes('col-po')?'col-hidden':''}">${sv['col-po']}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}">${sv['col-estimasi']}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}">${ketText}</td>
                <td class="px-4 py-3 font-bold text-red-700 text-center col-konversi ${hiddenCols.includes('col-konversi')?'col-hidden':''}">${sv['col-konversi']}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty text-base ${hiddenCols.includes('col-qty')?'col-hidden':''}">${sv['col-qty']}</td>
            `;
        }
        h += `</tr>`;
    });
    
    tbody.innerHTML = h;
    applyColumnOrder();
    initResizableColumns();
    if(typeof lucide !== 'undefined') lucide.createIcons();
    updatePaginationUI();
}

function updatePaginationUI() {
    const totalFiltered = filteredData.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    let sumQty = 0;
    filteredData.forEach(r => { sumQty += parseInt(r.searchValues['col-qty']) || 0; });

    document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    document.getElementById('lbl-total-qty').innerText = sumQty;
    
    const inpPage = document.getElementById('input-page-jump');
    if(inpPage) {
        inpPage.value = currentPage;
        inpPage.max = totalPages;
    }
    document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    updateSelectedCount();
}

window.changeRowsPerPage = function(val) {
    rowsPerPage = (val === 'ALL') ? 999999 : parseInt(val);
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    renderTableBody();
};

window.jumpToPage = function(val) {
    let p = parseInt(val);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    if (isNaN(p) || p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    
    currentPage = p;
    document.getElementById('input-page-jump').value = currentPage;
    renderTableBody();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; renderTableBody(); } };
window.nextPage = function() { 
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    if(currentPage < totalPages) { currentPage++; renderTableBody(); } 
};

window.updateSelectedCount = function() {
    const lbl = document.getElementById('lbl-pilih-baris');
    if(lbl) lbl.innerText = selectedRows.size;
};

window.cycleSelectAll = function() {
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
};

window.updateSelectAllUI = function() {
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
};

window.highlightRow = function(cb, id) {
    const tr = cb.closest('tr');
    if (cb.checked) {
        selectedRows.add(id);
        if(tr) tr.classList.add('selected-row');
    } else {
        selectedRows.delete(id);
        if(tr) tr.classList.remove('selected-row');
    }
    
    if(!cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    updateSelectedCount();
};

// ==========================================
// FILTER EXCEL PRO (SMART FILTERING & POSITIONING)
// ==========================================
window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation();
    currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    processedData.forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol];
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
    window.currentFilterValues = sortedValues;
    renderFilterList('');

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

window.renderFilterList = function(searchQuery) {
    const colClass = currentFilterCol;
    let filteredVals = window.currentFilterValues;
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase().split(' ').filter(x => x);
        filteredVals = window.currentFilterValues.filter(val => {
            const text = String(val).toLowerCase();
            return query.every(term => text.includes(term));
        });
    }

    const limit = 100;
    const displayVals = filteredVals.slice(0, limit);

    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded-lg transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-bold text-slate-800">(Pilih Semua)</span></label>`;
    
    displayVals.forEach(val => {
        let isChecked = true;
        if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded-lg transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate font-medium text-slate-700">${val}</span>
        </label>`;
    });

    if (filteredVals.length > limit) {
        listHtml += `<div class="p-2 text-center text-xs font-bold text-slate-400 italic">Menampilkan 100 dari ${filteredVals.length} hasil. Ketik untuk mencari.</div>`;
    }

    document.getElementById('filter-values-list').innerHTML = listHtml;
    window.updateSelectAllState();
};

window.searchFilterList = function(val) {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
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
        
        if (activeFilters[currentFilterCol]) {
            const oldVals = new Set(activeFilters[currentFilterCol]);
            selectedVals.forEach(v => oldVals.add(v));
            selectedVals = Array.from(oldVals);
        }
        
        activeFilters[currentFilterCol] = selectedVals;
    }
    
    closeFilterMenu(); applyFilters(); updateFilterIcons();
};

function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-amber-400', 'opacity-100');
        icon.classList.add('text-slate-400', 'opacity-40');
    });
    
    document.querySelectorAll('th.hdr-filtered').forEach(th => {
        th.classList.remove('hdr-filtered');
    });

    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            th.classList.add('hdr-filtered');
            const icon = th.querySelector('.filter-icon');
            if (icon) { 
                icon.classList.remove('text-slate-400', 'opacity-40'); 
                icon.classList.add('text-amber-400', 'opacity-100'); 
            }
        }
    }
}

// ==========================================
// LOGIKA GANTI KETERANGAN (KS AREA & KS GLOBAL)
// ==========================================
window.bukaModalGantiKet = function(context, gKey = null) {
    selectedForActionKet = [];

    if (context === 'main') {
        filteredData.forEach(r => {
            if(selectedRows.has(r._id)) {
                selectedForActionKet.push(r);
            }
        });
        if(selectedForActionKet.length === 0) {
            return tampilkanAlert("Pilih / centang minimal 1 baris item yang ingin diganti keterangannya!", "warning");
        }
    } else if (context === 'breakdown') {
        const checkboxes = document.querySelectorAll(`.cb-sub-${gKey}:checked`);
        if(checkboxes.length === 0) {
            return tampilkanAlert("Centang minimal 1 baris area pada detail breakdown!", "warning");
        }
        checkboxes.forEach(cb => {
            const id = cb.dataset.id ? parseInt(cb.dataset.id) : null;
            const matchRow = dataKSArea.find(a => a.id === id);
            if(matchRow) selectedForActionKet.push(matchRow);
        });
    }

    document.getElementById('lbl-jml-ganti-ket').innerText = selectedForActionKet.length;
    document.getElementById('input-keterangan-baru').value = '';
    document.getElementById('modal-ganti-keterangan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-keterangan-baru').focus(), 100);
};

window.eksekusiGantiKet = async function() {
    const newKet = document.getElementById('input-keterangan-baru').value.trim() || '-';
    if(selectedForActionKet.length === 0) return;

    const btn = document.getElementById('btn-simpan-ket');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...';
    btn.disabled = true;

    try {
        for (let item of selectedForActionKet) {
            let oldKet = item.keterangan || '-';
            let pjgFormatted = formatPanjang(item.panjang || item.pjg);

            let newSku = `${item.area}_${item.nama_item || item.nama}_${pjgFormatted}_${item.grade}_${item.dus}_${item.shading}_${newKet}_${item.customer_aktual || item.po_aktual}_${item.kondisi || 'Aman'}`;

            await db.from('stok_global')
                .update({ keterangan: newKet, id_sku: newSku })
                .eq('nama_item', item.nama_item || item.nama)
                .eq('panjang', pjgFormatted)
                .eq('grade', item.grade)
                .eq('dus', item.dus)
                .eq('shading', item.shading)
                .eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual || item.po_aktual);

            if (item.id) {
                await db.from('stok_aktual').update({ keterangan: newKet, id_sku: newSku }).eq('id', item.id);
            } else {
                await db.from('stok_aktual')
                    .update({ keterangan: newKet, id_sku: newSku })
                    .eq('nama_item', item.nama_item || item.nama)
                    .eq('panjang', pjgFormatted)
                    .eq('grade', item.grade)
                    .eq('dus', item.dus)
                    .eq('shading', item.shading)
                    .eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual || item.po_aktual)
                    .eq('keterangan', oldKet);
            }
        }

        document.getElementById('modal-ganti-keterangan').classList.add('hidden');
        if(!document.getElementById('modal-breakdown').classList.contains('hidden')) {
            window.tutupModalBreakdown();
        }

        tampilkanAlert(`Keterangan berhasil diubah menjadi "${newKet}".`, "success");
        await muatDataStok();

    } catch (e) {
        tampilkanAlert("Gagal mengubah keterangan: " + e.message, "error");
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ==========================================
// EXPORT EXCEL & SALIN DATA
// ==========================================
window.salinData = function() {
    if (selectedRows.size === 0) return tampilkanAlert("Pilih data yang ingin disalin dengan mencentang kotak di kiri data!", "warning");

    let textSalin = "";
    const headers = Array.from(document.querySelectorAll('#thead-ks th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open'))
        .map(th => th.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim());
    
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
                    let cleanVal = String(val).replace(/<[^>]*>?/gm, '').replace(/(\r\n|\n|\r)/gm, " ").trim();
                    rowData.push(cleanVal);
                }
            }
        });
        textSalin += rowData.join('\t') + '\n';
    });
    
    navigator.clipboard.writeText(textSalin).then(() => {
        tampilkanAlert(`Data berhasil disalin! Buka Excel dan Paste (Ctrl+V).`, "success");
    });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return tampilkanAlert("Library Excel belum termuat, pastikan ada koneksi internet.", "error");
    if (selectedRows.size === 0) return tampilkanAlert("Pilih minimal 1 baris data untuk di-export!", "warning");
    
    let ws_data = [];
    const activeHeaders = [];
    
    document.querySelectorAll('#thead-ks th').forEach(th => {
        if(window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')) {
            const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
            let headerText = th.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
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
            let cleanVal = String(val).replace(/<[^>]*>?/gm, '').replace(/(\r\n|\n|\r)/gm, " ").trim();
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
// MODAL BREAKDOWN & GANTI PO & KONVERSI
// ==========================================
window.bukaBreakdown = function(gKey) {
    const item = dataKSGlobal.find(g => g.gKey === gKey); if(!item) return;

    document.getElementById('bd-title-item').innerText = `${item.nama} | ${item.pjg} | ${item.grade} | DUS: ${item.dus} | SHADING: ${item.shading} | KET: ${item.ket}`;
    currentBreakdownData = item.areas;

    const tbody = document.getElementById('tbody-breakdown');
    tbody.innerHTML = item.areas.map((a, i) => {
        const stripeClass = i % 2 === 0 ? 'stripe-1' : 'stripe-2';
        
        const isKonversi = a.konversi && a.konversi !== '-' && a.konversi !== 'null';
        const rowBg = isKonversi ? '!bg-red-100 !text-red-900 font-bold' : stripeClass;
        const ketText = isKonversi ? `[LOCKED: ${a.konversi}] ${a.keterangan || '-'}` : (a.keterangan || '-');

        return `
            <tr class="transition bd-row text-[13px] ${rowBg}">
                <td class="px-4 py-3 text-center sticky-col"><input type="checkbox" onchange="window.highlightBdRow(this)" data-id="${a.id}" data-idsku="${a.id_sku_base}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po_aktual}" data-estimasi="${a.customer_estimasi}" data-qty="${a.qty}" data-ket="${a.keterangan}" data-kondisi="${a.kondisi}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-400 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left">${a.area}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po">${a.po_aktual}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi">${a.customer_estimasi}</td>
                <td class="px-4 py-3 font-medium text-slate-600 text-left whitespace-normal min-w-[200px] ${isKonversi ? '!text-red-800' : ''}">${ketText}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center">${a.qty}</td>
            </tr>`;
    }).join('');

    document.getElementById('modal-breakdown').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    if(typeof lucide !== 'undefined') lucide.createIcons();
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
    document.querySelectorAll('.cb-bd').forEach(cb => { cb.checked = checked; window.highlightBdRow(cb); }); 
};

window.salinDataBreakdown = function() {
    const cek = document.querySelectorAll('.cb-bd:checked');
    if(cek.length === 0) return tampilkanAlert("Centang baris area yang ingin disalin!", "warning");

    let textSalin = "Area Penyimpanan\tCustomer Aktual\tCustomer Estimasi\tKeterangan\tTotal Dus\n";
    cek.forEach(cb => {
        const tr = cb.closest('tr');
        if(tr) {
            const cols = tr.querySelectorAll('td');
            textSalin += `${cols[1].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${cols[2].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${cols[3].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${cols[4].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${cols[5].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\n`;
        }
    });

    navigator.clipboard.writeText(textSalin).then(() => {
        tampilkanAlert("Berhasil menyalin detail area!", "success");
    });
};

window.siapkanGantiPO = function(context) {
    selectedForAction = [];
    let totalDus = 0;

    if(context === 'main') {
        if(modeKS === 'global' || modeKS === 'detail') return;
        
        filteredData.forEach(r => {
            if(selectedRows.has(r._id)) {
                selectedForAction.push({
                    id: r.id, 
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
        
        if(selectedForAction.length === 0) {
            return tampilkanAlert('Silakan centang item / area yang ingin diganti Customer Estimasi-nya!', "warning");
        }

    } else { 
        const checkboxes = document.querySelectorAll('.cb-bd:checked'); 
        if(checkboxes.length === 0) {
            return tampilkanAlert('Silakan centang item / area yang ingin diganti Customer Estimasi-nya!', "warning");
        }
        
        checkboxes.forEach(cb => {
            selectedForAction.push({ 
                id: cb.dataset.id ? parseInt(cb.dataset.id) : null,
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
    inputQty.value = totalDus; 
    inputQty.max = totalDus; 

    document.getElementById('modal-po').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalPO = function() { 
    document.getElementById('modal-po').classList.add('hidden'); 
    if(document.getElementById('modal-breakdown') && !document.getElementById('modal-breakdown').classList.contains('hidden')) {
        // Do nothing, let breakdown modal stay open
    } else {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
};

window.eksekusiGantiPO = function() {
    const newPO = document.getElementById('input-new-po').value.trim().toUpperCase();
    if(!newPO) {
        tampilkanAlert("Pilih customer dulu atau batalkan.", "warning");
        return;
    }

    const qtyDiminta = parseInt(document.getElementById('input-qty-ganti').value);
    if(isNaN(qtyDiminta) || qtyDiminta <= 0) return tampilkanAlert("Jumlah dus tidak valid!", "warning");

    let maxDus = selectedForAction.reduce((sum, row) => sum + row.qty, 0);
    if(qtyDiminta > maxDus) return tampilkanAlert(`Maksimal jatah adalah ${maxDus} dus!`, "warning");

    // Tampilkan Modal Konfirmasi 2 Pilihan
    document.getElementById('modal-confirm-ganti-po').classList.remove('hidden');
};

window.prosesGantiPOSaja = async function() {
    document.getElementById('modal-confirm-ganti-po').classList.add('hidden');
    await jalankanUpdateGantiPO(false);
};

window.prosesGantiPODanLabel = async function() {
    document.getElementById('modal-confirm-ganti-po').classList.add('hidden');
    await jalankanUpdateGantiPO(true);
};

async function jalankanUpdateGantiPO(isProsesLabel) {
    const newPO = document.getElementById('input-new-po').value.trim().toUpperCase();
    const qtyDiminta = parseInt(document.getElementById('input-qty-ganti').value);
    
    const btn = document.getElementById('btn-simpan-po'); 
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; 
    btn.disabled = true;

    try {
        let qtySisaUntukDiupdate = qtyDiminta; 
        let payloadLabel = [];
        
        for(let row of selectedForAction) {
            if (qtySisaUntukDiupdate <= 0) break; 
            
            let qtyPotong = Math.min(row.qty, qtySisaUntukDiupdate);
            qtySisaUntukDiupdate -= qtyPotong;

            let oldRow = null;
            if (row.id) {
                const { data, error } = await db.from('stok_aktual').select('*').eq('id', row.id).single();
                if (!error && data) oldRow = data;
            }

            if (!oldRow) {
                const { data } = await db.from('stok_aktual')
                    .select('*')
                    .eq('nama_item', row.nama_item)
                    .eq('panjang', row.pjg)
                    .eq('grade', row.grade)
                    .eq('dus', row.dus)
                    .eq('shading', row.shading)
                    .eq('area', row.area)
                    .eq('customer_aktual', row.po_aktual)
                    .eq('customer_estimasi', row.customer_estimasi)
                    .limit(1);
                
                if (data && data.length > 0) oldRow = data[0];
            }

            if (oldRow) {
                let sisaQty = oldRow.qty - qtyPotong;
                if (sisaQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', oldRow.id);
                } else {
                    await db.from('stok_aktual').update({ qty: sisaQty }).eq('id', oldRow.id);
                }

                const { data: newRows } = await db.from('stok_aktual')
                    .select('id, qty')
                    .eq('nama_item', oldRow.nama_item)
                    .eq('panjang', oldRow.panjang)
                    .eq('grade', oldRow.grade)
                    .eq('dus', oldRow.dus)
                    .eq('shading', oldRow.shading)
                    .eq('area', oldRow.area)
                    .eq('customer_aktual', oldRow.customer_aktual)
                    .eq('customer_estimasi', newPO)
                    .limit(1);

                if (newRows && newRows.length > 0) {
                    await db.from('stok_aktual').update({ qty: newRows[0].qty + qtyPotong }).eq('id', newRows[0].id);
                } else {
                    let insertData = { ...oldRow };
                    delete insertData.id; 
                    delete insertData.created_at; 
                    insertData.customer_estimasi = newPO;
                    insertData.qty = qtyPotong;
                    await db.from('stok_aktual').insert([insertData]);
                }

                if (isProsesLabel && oldRow.customer_aktual !== newPO) {
                    payloadLabel.push({
                        id_sku: oldRow.id_sku,
                        area: oldRow.area,
                        jenis_item: oldRow.jenis_item,
                        nama_item: oldRow.nama_item,
                        panjang: oldRow.panjang,
                        grade: oldRow.grade,
                        dus: oldRow.dus,
                        shading: oldRow.shading,
                        keterangan: oldRow.keterangan || '-',
                        customer_aktual_awal: oldRow.customer_aktual,
                        customer_aktual_request: newPO,
                        qty_request: qtyPotong,
                        qty_proses: 0,
                        progres: 'PENDING'
                    });
                }
            }
        }

        if (payloadLabel.length > 0) {
            await db.from('ganti_customer').insert(payloadLabel);
        }
        
        tutupModalPO(); 
        if(sourcePOContext === 'breakdown') window.tutupModalBreakdown();
        
        tampilkanAlert("Customer Estimasi berhasil diganti!", "success");
        await muatDataStok();
    } catch (error) { 
        tampilkanAlert("GAGAL UPDATE: " + error.message, "error"); 
    } finally { 
        btn.innerHTML = ori; 
        btn.disabled = false; 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
    }
}

window.prosesLabelCustomerMassal = async function() {
    if (selectedRows.size === 0) return tampilkanAlert("Pilih baris yang ingin diproses label customernya!", "warning");

    let payload = [];
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
                    keterangan: r.keterangan || '-',
                    customer_aktual_awal: poAktual,
                    customer_aktual_request: poEstimasi,
                    qty_request: r.qty,
                    qty_proses: 0,
                    progres: 'PENDING'
                });
            }
        }
    });

    if(payload.length === 0) {
        return tampilkanAlert("Tidak ada baris valid untuk diproses.\nPastikan Anda memilih baris yang Customer Aktual dan Customer Estimasinya BERBEDA.", "warning");
    }

    if(!confirm(`Akan memproses ${payload.length} item ke tabel Ganti Customer.\nLanjutkan?`)) return;

    const btn = document.getElementById('btn-proses-ganti-main');
    const ori = btn.innerHTML;
    btn.innerHTML = '<div class="bg-emerald-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-emerald-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-emerald-700 transition">Memproses...</div>';
    btn.disabled = true;

    try {
        const { error } = await db.from('ganti_customer').insert(payload);
        if(error) throw error;

        tampilkanAlert(`${payload.length} item telah dikirim ke antrean Ganti Customer.`, "success");
        await muatDataStok(); 
    } catch(e) {
        tampilkanAlert("Gagal memproses: " + e.message, "error");
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.siapkanReqKonversi = function(context) {
    selectedForReq = null;

    if(context === 'main') {
        if(selectedRows.size !== 1) return tampilkanAlert('Silakan centang TEPAT 1 (satu) baris item yang ingin direquest konversi.', "warning");
        const selectedId = Array.from(selectedRows)[0];
        const r = filteredData.find(d => d._id === selectedId);
        if(!r) return tampilkanAlert("Data tidak ditemukan!", "error");

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
    } else if (context === 'breakdown') {
        const checkboxes = document.querySelectorAll('.cb-bd:checked');
        if(checkboxes.length !== 1) return tampilkanAlert('Silakan centang TEPAT 1 (satu) baris area pada detail breakdown!', "warning");
        
        const cb = checkboxes[0];
        selectedForReq = {
            id: cb.dataset.id ? parseInt(cb.dataset.id) : null,
            jenis_item: cb.dataset.jenis || '-',
            nama_item: cb.dataset.nama || '-',
            panjang: cb.dataset.pjg || '-',
            grade: cb.dataset.grade || '-',
            dus: cb.dataset.dus || '-',
            shading: cb.dataset.shading || '-',
            customer_aktual: cb.dataset.po || '-',
            customer_estimasi: cb.dataset.estimasi || '-', 
            keterangan: cb.dataset.ket || '-',
            area: cb.dataset.area || '-',
            qty_max: parseInt(cb.dataset.qty) || 0
        };
    }

    const infoAsal = document.getElementById('req-info-asal');
    if(infoAsal) {
        infoAsal.innerHTML = `
            <span class="text-blue-600 font-black">${selectedForReq.nama_item}</span> | 
            ${selectedForReq.panjang} | ${selectedForReq.grade} | ${selectedForReq.dus} | ${selectedForReq.shading} | 
            <span class="text-emerald-600 font-bold">${selectedForReq.area}</span> | 
            <span class="text-orange-600 font-bold">${selectedForReq.customer_aktual}</span>
        `;
    }

    ['req-nama-item', 'req-panjang', 'req-grade', 'req-dus', 'req-shading', 'req-qty', 'req-qty-hasil'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });

    document.getElementById('modal-req-konversi').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
};

window.tutupModalReqKonversi = function() {
    document.getElementById('modal-req-konversi').classList.add('hidden');
    if(document.getElementById('modal-breakdown') && !document.getElementById('modal-breakdown').classList.contains('hidden')) {
        // Do nothing, breakdown stays open
    } else {
        document.getElementById('overlay-klik-luar').classList.add('hidden');
    }
    selectedForReq = null;
};

window.eksekusiReqKonversi = async function() {
    if(!selectedForReq) return tampilkanAlert("Data sumber tidak valid!", "error");

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

    if(isNaN(qtyReq) || qtyReq <= 0) return tampilkanAlert("Qty Request tidak valid!", "warning");
    if(isNaN(qtyHasil) || qtyHasil <= 0) return tampilkanAlert("Qty Hasil tidak valid!", "warning");
    if(qtyReq > selectedForReq.qty_max) return tampilkanAlert(`Maksimal Qty Request adalah ${selectedForReq.qty_max} dus!`, "warning");

    const btn = document.getElementById('btn-save-req-konv'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const prefix = `K-${dd}${mm}${yy}`;

        const { data: existingCodes } = await db.from('request_konversi').select('kode_konversi').like('kode_konversi', `${prefix}%`);
        
        let seq = 1;
        if(existingCodes && existingCodes.length > 0) {
            let seqs = existingCodes.map(c => parseInt(c.kode_konversi.replace(prefix, '')) || 0);
            seq = Math.max(...seqs) + 1;
        }
        const kodeKonversi = `${prefix}${String(seq).padStart(2, '0')}`;

        const { data: origRow, error: errOrig } = await db.from('stok_aktual').select('*').eq('id', selectedForReq.id).single();
        if (errOrig || !origRow) throw new Error("Gagal menemukan baris stok asal di database.");

        let newOrigQty = origRow.qty - qtyReq;
        if(newOrigQty <= 0) {
            await db.from('stok_aktual').delete().eq('id', origRow.id);
        } else {
            await db.from('stok_aktual').update({ qty: newOrigQty }).eq('id', origRow.id);
        }

        let splitRow = { ...origRow };
        delete splitRow.id;
        delete splitRow.created_at;
        splitRow.qty = qtyReq;
        splitRow.konversi = kodeKonversi; 
        await db.from('stok_aktual').insert([splitRow]);

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
        
        window.tutupModalReqKonversi();
        if(!document.getElementById('modal-breakdown').classList.contains('hidden')) {
            window.tutupModalBreakdown();
        }

        tampilkanAlert(`Berhasil membuat Request Konversi dengan Kode: ${kodeKonversi}`, "success");
        await muatDataStok();
    } catch(e) {
        tampilkanAlert("Gagal menyimpan request: " + e.message, "error");
    } finally {
        btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ==========================================
// FUNGSI SISTEM URUTAN KOLOM & RESIZE
// ==========================================
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
            if (cellMap[colId]) row.appendChild(cellMap[colId]);
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
        !th.classList.contains('col-cb') && !th.classList.contains('col-open') && !th.classList.contains('col-proses')
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
    if(hiddenCols.includes(colClass)) hiddenCols = hiddenCols.filter(c => c !== colClass);
    else hiddenCols.push(colClass);
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
    
    tampilkanAlert("Pengaturan kolom berhasil disimpan!", "success");
    window.toggleSidebarKolom(); 
    renderTableHeaders();
    renderTableBody(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan pengaturan kolom ke default?")) return;
    userColOrder = [];
    hiddenCols = [];
    localStorage.removeItem(`col_order_ks_${modeKS}_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_ks_${modeKS}_${currentUser.username}`);
    
    tampilkanAlert("Pengaturan dikembalikan ke default.", "success");
    window.toggleSidebarKolom(); 
    renderTableHeaders();
    renderTableBody(); 
};
