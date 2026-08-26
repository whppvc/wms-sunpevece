let currentTab = 'scan'; // 'scan' atau 'tabel'

// State Tab 1: Scan (Staging Cards)
let stagingData = [];
let deletedStagingStack = [];
let globalRowId = 0;
let pendingEstimasiItem = null;

// State Tab 2: Tabel Database
let dbNonaktifRaw = [];
let activeFilters = {};
let currentFilterCol = '';
let sortState = {};
let currentPage = 1;
let rowsPerPage = 10;
let selectAllState = 0;
let userColOrder = [];
let hiddenCols = [];

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

function formatWIB(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', { 
            timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', hour12: false 
        }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
}

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'stok_nonaktif', title: 'STOK NONAKTIF', url: 'stok_nonaktif.html' });
    
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

        const dropupMore = document.getElementById('dropup-more');
        if (dropupMore && !dropupMore.classList.contains('hidden') && !e.target.closest('.relative')) {
            dropupMore.classList.add('hidden');
        }
    });

    await loadMasterKamus();
    loadUserPreferences();
    switchTab('scan');
});

async function loadMasterKamus() {
    try {
        const { data } = await db.from('master_2').select('*');
        if(data) {
            if(!window.masterData) window.masterData = {};
            window.masterData.kamus = data;
        }
    } catch(e) { console.error("Gagal load master_2:", e); }
}

function loadUserPreferences() {
    const savedOrder = localStorage.getItem(`col_order_nonaktif_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } }
    
    const savedHidden = localStorage.getItem(`col_hidden_nonaktif_${currentUser.username}`);
    if (savedHidden) { try { hiddenCols = JSON.parse(savedHidden); } catch(e) { hiddenCols = []; } }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) sel.value = rowsPerPage;
    }
}

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.toggleMoreMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropup-more');
    if(menu) menu.classList.toggle('hidden');
};

window.toggleSidebarFilter = function() {
    const sidebar = document.getElementById('sidebar-filter');
    const overlay = document.getElementById('overlay-klik-luar');
    sidebar.classList.toggle('translate-x-full');
    overlay.classList.toggle('hidden');
    if (!sidebar.classList.contains('translate-x-full')) {
        updateFilterDropdowns();
    }
};

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-add-scan').classList.add('hidden');
    document.getElementById('modal-estimasi').classList.add('hidden');
    const sidebar = document.getElementById('sidebar-filter');
    if(sidebar) sidebar.classList.add('translate-x-full');
    const sidebarK = document.getElementById('sidebar-kolom');
    if(sidebarK) sidebarK.classList.add('translate-x-full');
    closeFilterMenu();
};

window.switchTab = function(tab) {
    currentTab = tab;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';

    document.getElementById('tab-scan').className = (tab === 'scan') ? activeClass : inactiveClass;
    document.getElementById('tab-tabel').className = (tab === 'tabel') ? activeClass : inactiveClass;

    const isScan = (tab === 'scan');
    document.getElementById('view-scan').classList.toggle('hidden', !isScan);
    document.getElementById('toolbar-scan').classList.toggle('hidden', !isScan);
    document.getElementById('footer-scan-action').classList.toggle('hidden', !isScan);

    document.getElementById('view-tabel').classList.toggle('hidden', isScan);
    document.getElementById('toolbar-tabel').classList.toggle('hidden', isScan);
    document.getElementById('footer-tabel-pagination').classList.toggle('hidden', isScan);

    if (isScan) {
        renderStagingCards();
    } else {
        muatDataTabel();
    }
};

// ========================================================
// TAB 1: LOGIKA SCAN (CARD VIEW & ALUR WORKFLOW)
// ========================================================
window.bukaModalAdd = function() {
    document.getElementById('input-qrcode').value = '';
    document.getElementById('modal-add-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qrcode').focus(), 100);
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
};

document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-scan') {
        e.preventDefault();
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        if(!rawInput) return;

        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);

        codes.forEach(code => {
            const isLocalDuplicate = stagingData.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);

            stagingData.unshift({
                id: ++globalRowId,
                qrcode: code,
                status: 'BELUM CEK',
                area: '?',
                customer_aktual: trans.customer || '-',
                customer_estimasi: '-',
                keterangan: isLocalDuplicate ? 'DUPLIKAT SCAN' : '-',
                isLocalDuplicate: isLocalDuplicate,
                db_data: null,
                ...trans
            });
        });

        renderStagingCards();
        inputEl.value = '';
        inputEl.focus();

        const scrollContainer = document.getElementById('scroll-container-scan');
        if (scrollContainer) scrollContainer.scrollTop = 0;
    }
});

function renderStagingCards() {
    const tbody = document.getElementById('tbody-scan-cards');
    if(!tbody) return;

    if(stagingData.length === 0) {
        tbody.innerHTML = `
            <div class="p-10 text-center font-medium text-slate-400 h-full flex flex-col items-center justify-center">
                <i data-lucide="package-x" class="w-12 h-12 mx-auto mb-3 opacity-30"></i> 
                Belum ada kardus di-scan.
            </div>`;
        document.getElementById('lbl-total-scan').innerText = '0';
        updateFilterDropdowns();
        lucide.createIcons();
        return;
    }

    let html = '';
    let count = stagingData.length;
    let visibleCount = 0;

    stagingData.forEach(d => {
        let badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
        let displayStatus = d.status;

        if(d.status === 'VALID') {
            badgeClass = "bg-emerald-600 text-white border-emerald-700";
        } else if(['TIDAK DITEMUKAN', 'DUPLIKAT SCAN', 'SUDAH NONAKTIF'].includes(d.status)) {
            badgeClass = "bg-red-600 text-white border-red-800";
        }

        if(d.status === 'BELUM CEK' && d.isLocalDuplicate) {
            badgeClass = "bg-red-600 text-white border-red-800";
            displayStatus = "DUPLIKAT SCAN";
        }

        const isRed = ['TIDAK DITEMUKAN', 'DUPLIKAT SCAN', 'SUDAH NONAKTIF'].includes(d.status) || d.isLocalDuplicate;
        const rowClass = isRed ? 'bg-red-50 border-red-200' : 'bg-white border-slate-300';
        const areaColor = d.area === '?' ? 'text-slate-400' : 'text-emerald-700';

        html += `
            <div class="row-staging ${rowClass} border rounded-xl p-4 mb-3 relative transition w-full flex flex-col shadow-sm">
                
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow-inner">${count--}</div>
                        <div class="flex flex-col">
                            <span class="font-black text-xl ${areaColor} leading-none uppercase col-area">${d.area}</span>
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Area Gudang</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" value="${d.id}" onchange="highlightStagingRow(this)" class="cb-staging cursor-pointer w-5 h-5 accent-rose-600 rounded bg-white border-slate-400">
                        <button onclick="hapusStagingRow(${d.id})" class="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-rose-600 hover:text-white transition active:scale-95 shrink-0 border border-slate-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
                
                <div class="flex flex-col gap-1 mb-3">
                    <div class="font-mono font-black text-slate-900 text-base break-all leading-tight bg-slate-100 p-2 rounded-lg border border-slate-200 text-center col-qr">${d.qrcode}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-x-2 gap-y-3 mb-3">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Produksi</span>
                        <span class="text-sm font-bold text-slate-700"><span class="col-tgl">${d.tglProduksi}</span> - <span class="col-mesin">${d.mesin}</span> - <span class="col-shift">${d.shift}</span></span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Customer Aktual</span>
                        <span class="text-sm font-bold text-orange-600 uppercase col-cust">${d.customer_aktual}</span>
                    </div>
                    <div class="flex flex-col col-span-2 bg-rose-50/70 p-2 rounded-lg border border-rose-100">
                        <span class="text-[10px] font-black text-rose-600 uppercase mb-0.5">Spesifikasi Item</span>
                        <span class="text-base font-black text-slate-900 leading-snug">
                            <span class="col-nama">${d.namaItem}</span> - <span class="col-pjg">${d.panjang}</span> - <span class="col-grade">${d.grade}</span> - <span class="col-dus">${d.dus}</span>
                            <span class="col-jenis hidden">${d.jenisItem}</span>
                        </span>
                        <span class="text-xs font-bold text-rose-700 mt-0.5">Shading: <span class="col-shading">${d.shading}</span></span>
                    </div>
                </div>
                
                <div class="flex flex-row justify-between items-center mt-auto pt-2 border-t border-slate-100">
                    <span class="font-bold px-3 py-1.5 text-xs rounded-md border ${badgeClass} shadow-sm col-status">${displayStatus}</span>
                    <span class="text-[11px] font-bold text-purple-700 col-est">${d.customer_estimasi !== '-' ? 'Est: ' + d.customer_estimasi : ''}</span>
                </div>
            </div>
        `;
        visibleCount++;
    });

    tbody.innerHTML = html;
    document.getElementById('lbl-total-scan').innerText = visibleCount;
    updateFilterDropdowns();
    lucide.createIcons();
}

function highlightStagingRow(cb) {
    const div = cb.closest('.row-staging');
    if (div) {
        if (cb.checked) div.classList.add('border-rose-500', 'bg-rose-50');
        else div.classList.remove('border-rose-500', 'bg-rose-50');
    }
}

window.toggleAllStaging = function(checked) {
    document.querySelectorAll('.cb-staging').forEach(cb => {
        const row = cb.closest('.row-staging');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightStagingRow(cb);
        }
    });
};

function hapusStagingRow(id) {
    const removed = stagingData.find(d => d.id === id);
    if(removed) {
        deletedStagingStack.push([removed]);
        stagingData = stagingData.filter(d => d.id !== id);
        renderStagingCards();
    }
}

window.undoHapusStaging = function() {
    if(deletedStagingStack.length === 0) return alert("Tidak ada data hapus untuk di-undo.");
    const last = deletedStagingStack.pop();
    stagingData = [...last, ...stagingData];
    renderStagingCards();
};

window.resetLayarScan = function() {
    if(stagingData.length === 0) return;
    if(!confirm("Bersihkan seluruh antrean scan di layar?")) return;
    stagingData = [];
    renderStagingCards();
};

// ==========================================
// 1. VERIFIKASI SEBELUM NONAKTIF
// ==========================================
window.verifikasiNonaktif = async function() {
    if(stagingData.length === 0) return alert("Belum ada data di-scan.");
    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Cek...'; btn.disabled = true;

    const allQRs = stagingData.map(d => d.qrcode);

    try {
        const [resGlobal, resNonaktif] = await Promise.all([
            db.from('stok_global').select('*').in('qrcode', allQRs),
            db.from('stok_nonaktif').select('qrcode').in('qrcode', allQRs)
        ]);

        if(resGlobal.error) throw resGlobal.error;
        if(resNonaktif.error) throw resNonaktif.error;

        const globalMap = {}; (resGlobal.data || []).forEach(d => globalMap[d.qrcode] = d);
        const nonaktifSet = new Set((resNonaktif.data || []).map(d => d.qrcode));

        let validCount = 0;
        let notFoundCount = 0;

        stagingData.forEach(d => {
            if (d.isLocalDuplicate) {
                d.status = 'DUPLIKAT SCAN';
            } else if (nonaktifSet.has(d.qrcode)) {
                d.status = 'SUDAH NONAKTIF';
            } else if (globalMap[d.qrcode]) {
                d.status = 'VALID';
                d.area = globalMap[d.qrcode].area;
                d.customer_aktual = globalMap[d.qrcode].customer_aktual;
                d.db_data = globalMap[d.qrcode];
                validCount++;
            } else {
                d.status = 'TIDAK DITEMUKAN';
                notFoundCount++;
            }
        });

        renderStagingCards();

        if (notFoundCount > 0) {
            alert(`Verifikasi Selesai!\n⚠️ Terdapat ${notFoundCount} item yang TIDAK DITEMUKAN di Gudang.`);
        } else {
            alert(`✅ Verifikasi Selesai! Semua data VALID (${validCount} dus) dan siap dinonaktifkan.`);
        }

    } catch (e) {
        alert("Gagal verifikasi: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// ==========================================
// 2. SIMPAN NONAKTIF (POTONG GUDANG)
// ==========================================
window.simpanNonaktifKeDB = async function() {
    if(stagingData.length === 0) return alert("Antrean scan kosong!");

    const unverified = stagingData.some(d => d.status === 'BELUM CEK');
    if(unverified) return alert("Silakan klik tombol 'Verifikasi' terlebih dahulu sebelum menonaktifkan!");

    const invalid = stagingData.some(d => d.status !== 'VALID');
    if(invalid) return alert("Hapus item yang berstatus merah (Tidak Ditemukan / Duplikat) sebelum menyimpan!");

    const validItems = stagingData.filter(d => d.status === 'VALID');
    if(validItems.length === 0) return alert("Tidak ada item valid untuk diproses!");

    if(!confirm(`Yakin ingin menonaktifkan ${validItems.length} kardus ini?\nBarang akan dihapus dari stok gudang dan dipindahkan ke tabel Stok Nonaktif.`)) return;

    const btn = document.getElementById('btn-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Proses...'; btn.disabled = true;

    try {
        let qrsToDelete = [];
        let insertsNonaktif = [];
        let mapDeductAktual = {};

        for (let item of validItems) {
            const d = item.db_data;
            const pjgFormatted = formatPanjang(d.panjang);
            qrsToDelete.push(d.qrcode);

            // Cek alokasi customer estimasi di stok_aktual
            const { data: aktData } = await db.from('stok_aktual')
                .select('id, customer_estimasi, qty')
                .eq('nama_item', d.nama_item)
                .eq('panjang', pjgFormatted)
                .eq('grade', d.grade)
                .eq('dus', d.dus)
                .eq('shading', d.shading)
                .eq('area', d.area)
                .eq('customer_aktual', d.customer_aktual)
                .gt('qty', 0);

            let custEstTarget = d.customer_aktual;
            if (aktData && aktData.length > 0) {
                custEstTarget = aktData[0].customer_estimasi || d.customer_aktual;
            }

            insertsNonaktif.push({
                qrcode: d.qrcode,
                posisi: d.area,
                jenis_item: d.jenis_item,
                nama_item: d.nama_item,
                panjang: pjgFormatted,
                grade: d.grade,
                dus: d.dus,
                shading: d.shading,
                customer_aktual: d.customer_aktual,
                customer_estimasi: custEstTarget,
                keterangan: 'Barang Rusak / BS'
            });

            let keyAkt = `${d.nama_item}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer_aktual}_${custEstTarget}`;
            if(!mapDeductAktual[keyAkt]) {
                mapDeductAktual[keyAkt] = {
                    nama_item: d.nama_item, panjang: pjgFormatted, grade: d.grade,
                    dus: d.dus, shading: d.shading, area: d.area,
                    customer_aktual: d.customer_aktual, customer_estimasi: custEstTarget, qty: 0
                };
            }
            mapDeductAktual[keyAkt].qty++;
        }

        // 1. Insert ke tabel stok_nonaktif
        const { error: errNonaktif } = await db.from('stok_nonaktif').insert(insertsNonaktif);
        if(errNonaktif) throw errNonaktif;

        // 2. Delete dari stok_global & stok_qr
        await db.from('stok_global').delete().in('qrcode', qrsToDelete);
        await db.from('stok_qr').delete().in('qrcode', qrsToDelete);

        // 3. Kurangi stok_aktual secara incremental
        for(let key in mapDeductAktual) {
            let u = mapDeductAktual[key];
            const { data: ext } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', u.nama_item).eq('panjang', u.panjang).eq('grade', u.grade)
                .eq('dus', u.dus).eq('shading', u.shading).eq('area', u.area)
                .eq('customer_aktual', u.customer_aktual).eq('customer_estimasi', u.customer_estimasi)
                .limit(1);

            if(ext && ext.length > 0) {
                let newQty = ext[0].qty - u.qty;
                if(newQty <= 0) await db.from('stok_aktual').delete().eq('id', ext[0].id);
                else await db.from('stok_aktual').update({ qty: newQty }).eq('id', ext[0].id);
            }
        }

        alert(`✅ BERHASIL!\n${validItems.length} kardus telah dinonaktifkan dan dikeluarkan dari stok gudang.`);
        stagingData = [];
        renderStagingCards();

    } catch(e) {
        alert("GAGAL MENYIMPAN: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// ========================================================
// TAB 2: LOGIKA TABEL NONAKTIF (DATABASE ARSIP)
// ========================================================
window.muatDataTabel = async function() {
    const tbody = document.getElementById('tbody-nonaktif');
    tbody.innerHTML = `<tr><td colspan="13" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menarik Data Nonaktif...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from('stok_nonaktif').select('*').order('created_at', { ascending: false });
        if(error) throw error;
        dbNonaktifRaw = data || [];
        renderTabelNonaktif();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-10 text-center text-red-500 font-bold">Gagal: ${e.message}</td></tr>`;
    }
};

function thSort(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb'].includes(colClass);

    if (noFilter) {
        return `<th class="hdr-std ${cls} ${isHidden} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} ${isHidden} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="sortTable(${idx}, this.closest('th'))">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition"><i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 text-white"></i></button>
                <button onclick="openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition"><i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 text-white"></i></button>
            </div>
        </div>
    </th>`;
}

function renderTabelNonaktif() {
    const thead = document.getElementById('thead-nonaktif');
    const tbody = document.getElementById('tbody-nonaktif');
    sortState = {}; selectAllState = 0;

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
            </th>
            ${thSort(1, 'Waktu', 'col-waktu')}
            ${thSort(2, 'Area', 'col-area')}
            ${thSort(3, 'QRCode', 'col-qr')}
            ${thSort(4, 'Jenis Item', 'col-jenis')}
            ${thSort(5, 'Nama Item', 'col-nama')}
            ${thSort(6, 'Panjang', 'col-pjg')}
            ${thSort(7, 'Grade', 'col-grade')}
            ${thSort(8, 'Dus', 'col-dus')}
            ${thSort(9, 'Shading', 'col-shading')}
            ${thSort(10, 'Customer Aktual', 'col-cust')}
            ${thSort(11, 'Customer Estimasi', 'col-est')}
            ${thSort(12, 'Keterangan', 'col-ket')}
        </tr>`;

    if(dbNonaktifRaw.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="p-8 text-center font-medium text-slate-400">Tidak ada data stok nonaktif di database.</td></tr>`;
        return;
    }

    tbody.innerHTML = dbNonaktifRaw.map(r => {
        const rowDataStr = encodeURIComponent(JSON.stringify(r));
        const pjgFormatted = formatPanjang(r.panjang);

        return `
            <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" data-row="${rowDataStr}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"></td>
                <td class="px-4 py-3 font-medium text-slate-600 col-waktu ${hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${formatWIB(r.created_at)}">${formatWIB(r.created_at)}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-area ${hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.posisi || '-'}">${r.posisi || '-'}</td>
                <td class="px-4 py-3 font-mono font-bold text-rose-600 col-qr ${hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${pjgFormatted}">${pjgFormatted}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 col-cust ${hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer_aktual || '-'}">${r.customer_aktual || '-'}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 col-est ${hiddenCols.includes('col-est')?'col-hidden':''}" data-search="${r.customer_estimasi || '-'}">${r.customer_estimasi || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-500 col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
            </tr>`;
    }).join('');

    applyColumnOrder();
    lucide.createIcons();
    saringTabelExcel();
    initResizableColumns();
}

// ========================================================
// AKSI TABEL: CANCEL NONAKTIF & PROSES BS
// ========================================================
window.cancelNonaktifMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin di-cancel nonaktif!");
    if(!confirm(`Yakin ingin membatalkan (Cancel) ${checked.length} item nonaktif ini?\nBarang akan dikembalikan ke kondisi 'Aman' di Stok Gudang.`)) return;

    const btn = document.getElementById('btn-cancel-nonaktif'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    try {
        let insertsGlobal = [];
        let insertsStokQr = [];
        let mapAktual = {};
        let idsToDelete = [];

        checked.forEach(cb => { 
            const d = JSON.parse(decodeURIComponent(cb.getAttribute('data-row')));
            idsToDelete.push(d.id);
            const pjgFormatted = formatPanjang(d.panjang);

            let id_sku = `${d.posisi}_${d.nama_item}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_-_${d.customer_aktual}_Aman`;

            insertsGlobal.push({
                qrcode: d.qrcode,
                area: d.posisi,
                id_sku: id_sku,
                tgl_produksi: '-',
                mesin: '-',
                shift: '-',
                jenis_item: d.jenis_item,
                nama_item: d.nama_item,
                panjang: pjgFormatted,
                grade: d.grade,
                dus: d.dus,
                shading: d.shading,
                customer_aktual: d.customer_aktual,
                keterangan: '-',
                kondisi: 'Aman',
                pic_input: currentUser.username,
                jalur_masuk: 'cancel-nonaktif'
            });

            insertsStokQr.push({
                qrcode: d.qrcode, id_sku: id_sku, area: d.posisi, keterangan: '-'
            });

            let keyAkt = `${d.nama_item}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_${d.posisi}_${d.customer_aktual}_${d.customer_estimasi}`;
            if(!mapAktual[keyAkt]) {
                mapAktual[keyAkt] = {
                    id_sku: id_sku, jenis_item: d.jenis_item, nama_item: d.nama_item, panjang: pjgFormatted,
                    grade: d.grade, dus: d.dus, shading: d.shading, area: d.posisi,
                    customer_aktual: d.customer_aktual, customer_estimasi: d.customer_estimasi,
                    keterangan: '-', kondisi: 'Aman', qty: 0
                };
            }
            mapAktual[keyAkt].qty++;
        });

        // 1. Insert ke stok_global & stok_qr
        await db.from('stok_global').insert(insertsGlobal);
        await db.from('stok_qr').insert(insertsStokQr);

        // 2. Incremental Update ke stok_aktual
        for(let key in mapAktual) {
            let item = mapAktual[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).eq('customer_estimasi', item.customer_estimasi)
                .eq('keterangan', item.keterangan).is('konversi', null).limit(1);
            
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + item.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([item]);
            }
        }

        // 3. Hapus dari stok_nonaktif
        await db.from('stok_nonaktif').delete().in('id', idsToDelete);

        alert("✅ BERHASIL! Item telah dikembalikan ke stok gudang.");
        muatDataTabel();
    } catch(e) {
        alert("GAGAL: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.prosesBSMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin di-BS-kan!");
    if(!confirm(`Yakin ingin memproses BS ${checked.length} item ini?\nItem akan dihapus permanen dari sistem WMS.`)) return;

    const btn = document.getElementById('btn-bs-massal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    let idsToDelete = Array.from(checked).map(cb => cb.value);

    try {
        const { error } = await db.from('stok_nonaktif').delete().in('id', idsToDelete);
        if(error) throw error;
        
        alert("✅ BERHASIL! Item telah diproses BS dan dihapus permanen.");
        muatDataTabel();
    } catch(e) {
        alert("GAGAL: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// ==========================================
// FILTER, SORTING, PAGINASI, ATUR KOLOM
// ==========================================
function updateFilterDropdowns() {
    const fields = [
        { id: 'fs-status', key: 'status' },
        { id: 'fs-area', key: 'posisi' },
        { id: 'fs-jenis', key: 'jenis_item' },
        { id: 'fs-nama', key: 'nama_item' },
        { id: 'fs-pjg', key: 'panjang' },
        { id: 'fs-grade', key: 'grade' },
        { id: 'fs-dus', key: 'dus' },
        { id: 'fs-shading', key: 'shading' },
        { id: 'fs-cust', key: 'customer_aktual' },
        { id: 'fs-est', key: 'customer_estimasi' }
    ];

    let dataset = currentTab === 'scan' ? stagingData : dbNonaktifRaw;

    fields.forEach(field => {
        const select = document.getElementById(field.id);
        if (!select) return;
        
        const currentVal = select.value;
        const uniqueVals = [...new Set(dataset.map(d => d[field.key] || '-'))].filter(x => x && x !== '-').sort();

        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => { html += `<option value="${val}">${val}</option>`; });
        select.innerHTML = html;

        if (uniqueVals.includes(currentVal)) select.value = currentVal;
    });
}

window.resetFilter = function() {
    ['fs-status', 'fs-qr', 'fs-area', 'fs-jenis', 'fs-nama', 'fs-pjg', 'fs-grade', 'fs-dus', 'fs-shading', 'fs-cust', 'fs-est'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    saringTabel();
    toggleSidebarFilter();
};

window.saringTabel = function() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        area: document.getElementById('fs-area')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        cust: document.getElementById('fs-cust')?.value || '',
        est: document.getElementById('fs-est')?.value || ''
    };

    if (currentTab === 'scan') {
        let visibleCount = 0;
        document.querySelectorAll('.row-staging').forEach(row => {
            let show = true;
            const checkMatch = (colCls, val) => {
                if(!val) return true;
                const cell = row.querySelector('.' + colCls);
                return cell ? cell.innerText.trim() === val : true;
            };

            if(!checkMatch('col-status', f.status)) show = false;
            if(!checkMatch('col-area', f.area)) show = false;
            if(!checkMatch('col-jenis', f.jenis)) show = false;
            if(!checkMatch('col-nama', f.nama)) show = false;
            if(!checkMatch('col-pjg', f.pjg)) show = false;
            if(!checkMatch('col-grade', f.grade)) show = false;
            if(!checkMatch('col-dus', f.dus)) show = false;
            if(!checkMatch('col-shading', f.shading)) show = false;
            if(!checkMatch('col-cust', f.cust)) show = false;

            if(show && f.qr) {
                const cell = row.querySelector('.col-qr');
                if(cell && !cell.innerText.toLowerCase().includes(f.qr)) show = false;
            }

            row.style.display = show ? 'flex' : 'none';
            if(show) visibleCount++;
        });
        document.getElementById('lbl-total-scan').innerText = visibleCount;
    }
};

window.highlightRow = function(checkbox, skipStateReset = false) {
    const tr = checkbox.closest('tr');
    if (tr) {
        if (checkbox.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    
    if(!skipStateReset && !checkbox.checked && selectAllState !== 0) { 
        selectAllState = 0; 
        updateSelectAllUI(); 
    }
    if(!skipStateReset) updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    rowsPerPage = (val === 'ALL') ? 999999 : parseInt(val);
    localStorage.setItem('wms_rows_per_page', rowsPerPage);
    currentPage = 1; 
    applyPagination();
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-nonaktif tr.r-row'));
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
    
    if (selectAllState === 1) { selectAllState = 0; updateSelectAllUI(); }
    applySelection(); updateSelectedCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-nonaktif tr.r-row:not(.filtered-out)').length; if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } };
window.updateSelectedCount = function() { const count = document.querySelectorAll('.cb-main:checked').length; if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count; };

window.cycleSelectAll = function() { selectAllState = (selectAllState + 1) % 3; updateSelectAllUI(); applySelection(); };
function updateSelectAllUI() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto'; } 
    else if (selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto'; } 
    else if (selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto'; }
    lucide.createIcons();
}

function applySelection() {
    const allRows = Array.from(document.querySelectorAll('#tbody-nonaktif tr.r-row'));
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
}

// ==========================================
// FILTER EXCEL PRO (DESKTOP TABEL)
// ==========================================
window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-nonaktif tr.r-row').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol]; const cell = row.querySelector('.' + otherCol);
                let t = cell ? (cell.getAttribute('data-search') || cell.innerText.trim()) : '';
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
        let isChecked = true; if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}"><input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> <span class="truncate text-slate-600">${val}</span></label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; updateSelectAllState(); document.getElementById('filter-search-input').value = '';
    const menu = document.getElementById('excel-filter-menu'); menu.classList.remove('hidden');
    const btnRect = event.currentTarget.getBoundingClientRect(); const menuWidth = 256; 
    let topPos = btnRect.bottom + 4; let leftPos = btnRect.left; 
    if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
    if (leftPos < 10) { leftPos = 10; }
    menu.style.position = 'fixed'; menu.style.top = `${topPos}px`; menu.style.left = `${leftPos}px`;
    document.getElementById('filter-search-input').focus();
};

window.toggleAllFilterValues = function(checked) { document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; }); updateSelectAllState(); };
function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
}
document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) updateSelectAllState(); });
window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x); 
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        let matches = query.every(term => text.includes(term)); label.style.display = matches ? '' : 'none';
    });
};
function closeFilterMenu() { document.getElementById('excel-filter-menu').classList.add('hidden'); }
function clearFilterForCurrentCol() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); }
function applyFilterForCurrentCol() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); activeFilters[currentFilterCol] = selectedVals; }
    closeFilterMenu(); saringTabelExcel(); 
}
function saringTabelExcel() {
    document.querySelectorAll('#tbody-nonaktif tr.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    selectAllState = 0; updateSelectAllUI(); currentPage = 1; applyPagination(); updateFilterIcons();
}
function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
}

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-nonaktif');
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

// ==========================================
// EXPORT EXCEL & SALIN DATA
// ==========================================
window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin!");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-nonaktif th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr');
        if (tr) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(val.replace(/\n/g, ' ')); }
            });
            copyString += rowData.join('\t') + '\n';
        }
    });
    navigator.clipboard.writeText(copyString).then(() => { alert("Berhasil menyalin data!"); }).catch(err => { alert("Browser menolak akses Clipboard."); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat.");
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-nonaktif th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);
    document.querySelectorAll('#tbody-nonaktif tr.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(`"${val.replace(/\n/g, ' ')}"`); }
            });
            ws_data.push(rowData);
        }
    });
    if(ws_data.length <= 1) return alert("Pilih minimal 1 baris data untuk di-export!");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Stok_Nonaktif"); XLSX.writeFile(wb, `Stok_Nonaktif.xlsx`);
};

// ==========================================
// ATUR KOLOM
// ==========================================
window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

function renderDragList() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-nonaktif th')).filter(th => th && !th.classList.contains('col-cb'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; const label = th.innerText.trim() || 'Kolom';
        const div = document.createElement('div'); div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab'; div.draggable = true; div.setAttribute('data-col', colClass);
        div.innerHTML = `<span class="font-bold text-slate-700 text-xs">${label}</span><i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>`;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); }); div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    userColOrder = newOrder; localStorage.setItem(`col_order_nonaktif_${currentUser.username}`, JSON.stringify(newOrder));
    alert("Urutan kolom berhasil disimpan!"); toggleSidebarKolom(); renderTabelNonaktif(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    userColOrder = []; localStorage.removeItem(`col_order_nonaktif_${currentUser.username}`);
    alert("Urutan dikembalikan ke default."); toggleSidebarKolom(); renderTabelNonaktif();
};

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; if (cbCell) row.appendChild(cbCell);
        userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && !userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
}

function initResizableColumns() {
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
                }
