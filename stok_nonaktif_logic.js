let currentTab = 'scan'; // 'scan' atau 'tabel'

// State Tab 1: Scan (Staging Cards)
let stagingData = [];
let deletedStagingStack = [];
let globalRowId = 0;

// State Tab 2: Tabel Database
let dbNonaktifRaw = [];
let activeFilters = {};
let currentFilterCol = '';
let sortState = { col: null, isAsc: true };
let currentPage = 1;
let rowsPerPage = 10;
let selectAllState = 0;
let userColOrder = [];
let hiddenCols = [];

let filterTimeout;

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

// Helper Custom Alert
window.tampilkanAlert = function(pesan, tipe = 'info') {
    const modal = document.getElementById('modal-custom-alert');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const iconContainer = document.getElementById('alert-icon-container');
    const icon = document.getElementById('alert-icon');

    if(!modal) { alert(pesan); return; }

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
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

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

async function fetchAllRows(tableName, selectCols = '*', orderCol = 'created_at') {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await db.from(tableName)
            .select(selectCols)
            .order(orderCol, { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.warn(`Query non-fatal warning on ${tableName}:`, error);
            break;
        }
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

document.addEventListener('DOMContentLoaded', async () => {
    await initModernLayout({ id: 'stok_nonaktif', title: 'STOK NONAKTIF', url: 'stok_nonaktif.html' });
    
    // Inisialisasi Submenu Tabs & Footer
    const tabsData = [
        { id: 'tab-scan', label: '1. SCAN NONAKTIF', icon: 'scan-line', onClick: "switchTab('scan')" },
        { id: 'tab-tabel', label: '2. TABEL NONAKTIF', icon: 'table', onClick: "switchTab('tabel')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-scan');
    }
    
    if (typeof window.renderTableFooter === 'function') {
        window.renderTableFooter('container-footer', 'Total Dus Nonaktif');
    }

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('th.cursor-pointer')) {
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
        if(sel) {
            Array.from(sel.options).forEach(opt => { if(opt.value == rowsPerPage) opt.selected = true; });
        }
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
    document.getElementById('modal-custom-alert').classList.add('hidden');
    const sidebar = document.getElementById('sidebar-filter');
    if(sidebar) sidebar.classList.add('translate-x-full');
    const sidebarK = document.getElementById('sidebar-kolom');
    if(sidebarK) sidebarK.classList.add('translate-x-full');
    closeFilterMenu();
};

window.switchTab = function(tab) {
    currentTab = tab;
    
    const tabsData = [
        { id: 'tab-scan', label: '1. SCAN NONAKTIF', icon: 'scan-line', onClick: "switchTab('scan')" },
        { id: 'tab-tabel', label: '2. TABEL NONAKTIF', icon: 'table', onClick: "switchTab('tabel')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-' + tab);
    }

    const isScan = (tab === 'scan');
    const viewScan = document.getElementById('view-scan');
    const toolbarScan = document.getElementById('toolbar-scan');
    const footerScanAction = document.getElementById('footer-scan-action');

    const viewTabel = document.getElementById('view-tabel');
    const toolbarTabel = document.getElementById('toolbar-tabel');
    const footerPagination = document.getElementById('container-footer');

    if(viewScan) viewScan.classList.toggle('hidden', !isScan);
    if(toolbarScan) toolbarScan.classList.toggle('hidden', !isScan);
    if(footerScanAction) footerScanAction.classList.toggle('hidden', !isScan);

    if(viewTabel) viewTabel.classList.toggle('hidden', isScan);
    if(toolbarTabel) toolbarTabel.classList.toggle('hidden', isScan);
    
    if(footerPagination) {
        if(isScan) {
            footerPagination.classList.add('hidden');
            footerPagination.style.display = 'none';
        } else {
            footerPagination.classList.remove('hidden');
            footerPagination.style.display = 'flex';
        }
    }

    if (isScan) {
        renderStagingCards();
    } else {
        muatDataTabel();
    }
};

// ========================================================
// TAB 1: LOGIKA SCAN NONAKTIF (STAGING CARDS)
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
                Belum ada item di-scan.
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
                        <button onclick="hapusStagingRow(${d.id})" class="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-rose-600 hover:text-white transition active:scale-95 shrink-0 border border-slate-200 cursor-pointer"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
    if(deletedStagingStack.length === 0) return tampilkanAlert("Tidak ada data hapus untuk di-undo.", "warning");
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
    if(stagingData.length === 0) return tampilkanAlert("Belum ada data di-scan.", "warning");
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
            tampilkanAlert(`Verifikasi Selesai!\n⚠️ Terdapat ${notFoundCount} item yang TIDAK DITEMUKAN di Gudang.`, "warning");
        } else {
            tampilkanAlert(`✅ Verifikasi Selesai! Semua data VALID (${validCount} dus) dan siap dinonaktifkan.`, "success");
        }

    } catch (e) {
        tampilkanAlert("Gagal verifikasi: " + e.message, "error");
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// ==========================================
// 2. SIMPAN NONAKTIF (POTONG GUDANG & CATAT USER DI HASIL_STBJ_LANGSIR)
// ==========================================
window.simpanNonaktifKeDB = async function() {
    if(stagingData.length === 0) return tampilkanAlert("Antrean scan kosong!", "warning");

    const unverified = stagingData.some(d => d.status === 'BELUM CEK');
    if(unverified) return tampilkanAlert("Silakan klik tombol 'Verifikasi' terlebih dahulu sebelum menonaktifkan!", "warning");

    const invalid = stagingData.some(d => d.status !== 'VALID');
    if(invalid) return tampilkanAlert("Hapus item yang berstatus merah (Tidak Ditemukan / Duplikat) sebelum menyimpan!", "warning");

    const validItems = stagingData.filter(d => d.status === 'VALID');
    if(validItems.length === 0) return tampilkanAlert("Tidak ada item valid untuk diproses!", "warning");

    if(!confirm(`Yakin ingin menonaktifkan ${validItems.length} item ini?\nitem akan dihapus dari stok gudang.`)) return;

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
                keterangan: 'Barang Rusak / BS',
                pic: currentUser.username
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

        // 2. Update status dan pic_input pada hasil_stbj_langsir menjadi 'NONAKTIF' beserta siapa yang menonaktifkan
        await db.from('hasil_stbj_langsir')
            .update({ 
                status: 'NONAKTIF', 
                keterangan: `Nonaktif oleh ${currentUser.username}`,
                pic_input: currentUser.username 
            })
            .in('qrcode', qrsToDelete);

        // 3. Delete dari stok_global & stok_qr (Fisik Gudang)
        await db.from('stok_global').delete().in('qrcode', qrsToDelete);
        await db.from('stok_qr').delete().in('qrcode', qrsToDelete);

        // 4. Kurangi stok_aktual secara incremental
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

        tampilkanAlert(`\n${validItems.length} dus telah dinonaktifkan oleh ${currentUser.username}.`, "success");
        stagingData = [];
        renderStagingCards();

    } catch(e) {
        tampilkanAlert("GAGAL MENYIMPAN: " + e.message, "error");
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// ========================================================
// TAB 2: LOGIKA TABEL NONAKTIF (DATABASE ARSIP)
// ========================================================
window.muatDataTabel = async function() {
    const tbody = document.getElementById('tbody-nonaktif');
    tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menarik Data Nonaktif...</p></td></tr>`;
    lucide.createIcons();

    try {
        dbNonaktifRaw = await fetchAllRows('stok_nonaktif', '*');
        renderTabelNonaktifHeaders();
        saringTabelExcel();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center text-red-500 font-bold">Gagal: ${e.message}</td></tr>`;
    }
};

function thSort(label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb'].includes(colClass);

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

function renderTabelNonaktifHeaders() {
    const thead = document.getElementById('thead-nonaktif');
    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center sticky-col">
                <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto cursor-pointer" title="Klik untuk Pilih Semua"></button>
            </th>
            ${thSort('Waktu', 'col-waktu')}
            ${thSort('Area', 'col-area')}
            ${thSort('QRCode', 'col-qr')}
            ${thSort('Jenis Item', 'col-jenis')}
            ${thSort('Nama Item', 'col-nama')}
            ${thSort('Panjang', 'col-pjg')}
            ${thSort('Grade', 'col-grade')}
            ${thSort('Dus', 'col-dus')}
            ${thSort('Shading', 'col-shading')}
            ${thSort('Customer Aktual', 'col-cust')}
            ${thSort('Customer Estimasi', 'col-est')}
            ${thSort('Keterangan', 'col-ket')}
            ${thSort('PIC', 'col-pic')}
        </tr>`;
    
    updateSelectAllUI();
}

function renderTabelNonaktifBody() {
    const tbody = document.getElementById('tbody-nonaktif');
    if(!tbody) return;

    if(dbNonaktifRaw.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-8 text-center font-medium text-slate-400">Tidak ada data stok nonaktif di database.</td></tr>`;
        updatePaginationUI();
        return;
    }

    const rowClassBase = "transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200";

    tbody.innerHTML = dbNonaktifRaw.map(r => {
        const rowDataStr = encodeURIComponent(JSON.stringify(r));
        const pjgFormatted = formatPanjang(r.panjang);
        const waktuStr = formatWIB(r.created_at);

        return `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" data-row="${rowDataStr}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"></td>
                <td class="px-4 py-3 font-medium text-slate-600 col-waktu ${hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${waktuStr}">${waktuStr}</td>
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
                <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 col-pic ${hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
            </tr>`;
    }).join('');

    applyColumnOrder();
    lucide.createIcons();
    initResizableColumns();
    applyPagination();
}

// ========================================================
// AKSI TABEL: CANCEL NONAKTIF & PROSES BS
// ========================================================
window.cancelNonaktifMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih baris yang ingin di-cancel nonaktif!", "warning");
    if(!confirm(`Yakin ingin membatalkan (Cancel) ${checked.length} item nonaktif ini?\nBarang akan dikembalikan ke kondisi 'Aman' di Stok Gudang dan status di STBJ diubah kembali ke 'IN GUDANG' oleh ${currentUser.username}.`)) return;

    const btn = document.getElementById('btn-cancel-nonaktif'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    try {
        let insertsGlobal = [];
        let insertsStokQr = [];
        let mapAktual = {};
        let idsToDelete = [];
        let qrsToRestore = [];

        checked.forEach(cb => { 
            const d = JSON.parse(decodeURIComponent(cb.getAttribute('data-row')));
            idsToDelete.push(d.id);
            qrsToRestore.push(d.qrcode);
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

        // 1. Update status dan pic_input pada hasil_stbj_langsir kembali menjadi 'IN GUDANG'
        await db.from('hasil_stbj_langsir')
            .update({ 
                status: 'IN GUDANG', 
                keterangan: `Retur dari Nonaktif oleh ${currentUser.username}`,
                pic_input: currentUser.username 
            })
            .in('qrcode', qrsToRestore);

        // 2. Insert ke stok_global & stok_qr
        await db.from('stok_global').insert(insertsGlobal);
        await db.from('stok_qr').insert(insertsStokQr);

        // 3. Incremental Update ke stok_aktual
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

        // 4. Hapus dari stok_nonaktif
        await db.from('stok_nonaktif').delete().in('id', idsToDelete);

        tampilkanAlert(`✅ BERHASIL!\nItem telah dikembalikan ke stok gudang dan status STBJ kembali menjadi IN GUDANG (PIC: ${currentUser.username}).`, "success");
        muatDataTabel();
    } catch(e) {
        tampilkanAlert("GAGAL: " + e.message, "error");
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.prosesBSMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return tampilkanAlert("Pilih baris yang ingin di-BS-kan!", "warning");
    if(!confirm(`Yakin ingin memproses BS ${checked.length} item ini?\nItem akan dihapus permanen dari tabel Stok Nonaktif dan status di STBJ diset ke 'BS' oleh ${currentUser.username}.`)) return;

    const btn = document.getElementById('btn-bs-massal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true;

    let idsToDelete = [];
    let qrsToDelete = [];

    checked.forEach(cb => {
        const d = JSON.parse(decodeURIComponent(cb.getAttribute('data-row')));
        idsToDelete.push(d.id);
        qrsToDelete.push(d.qrcode);
    });

    try {
        // 1. Update status dan pic_input di hasil_stbj_langsir menjadi 'BS'
        await db.from('hasil_stbj_langsir')
            .update({ 
                status: 'BS', 
                keterangan: `Barang Rusak / BS oleh ${currentUser.username}`,
                pic_input: currentUser.username 
            })
            .in('qrcode', qrsToDelete);

        // 2. Hapus dari stok_nonaktif
        const { error } = await db.from('stok_nonaktif').delete().in('id', idsToDelete);
        if(error) throw error;
        
        tampilkanAlert(`✅ BERHASIL!\nItem telah diproses BS permanen (PIC: ${currentUser.username}).`, "success");
        muatDataTabel();
    } catch(e) {
        tampilkanAlert("GAGAL: " + e.message, "error");
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

window.jumpToPage = function(val) {
    let p = parseInt(val);
    const totalVisible = document.querySelectorAll('#tbody-nonaktif tr.r-row:not(.filtered-out)').length;
    const totalPages = Math.ceil(totalVisible / rowsPerPage) || 1;
    if (isNaN(p) || p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    
    currentPage = p;
    const inp = document.getElementById('input-page-jump');
    if(inp) inp.value = currentPage;
    applyPagination();
};

function updatePaginationUI() {
    const visibleRows = Array.from(document.querySelectorAll('#tbody-nonaktif tr.r-row:not(.filtered-out)'));
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;

    const lblTampil = document.getElementById('lbl-tampil-baris');
    const lblQty = document.getElementById('lbl-total-qty');
    const inpPage = document.getElementById('input-page-jump');
    const lblTotHal = document.getElementById('lbl-total-halaman');

    if(lblTampil) lblTampil.innerText = totalFiltered;
    if(lblQty) lblQty.innerText = totalFiltered; 
    if(lblTotHal) lblTotHal.innerText = totalPages;
    if(inpPage) {
        inpPage.value = currentPage;
        inpPage.max = totalPages;
    }
    updateSelectedCount();
}

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
        if (index % 2 === 0) row.classList.add('stripe-1'); 
        else row.classList.add('stripe-2');

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    updatePaginationUI();
    
    if (selectAllState === 1) { selectAllState = 0; updateSelectAllUI(); }
    applySelection(); 
    updateSelectedCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-nonaktif tr.r-row:not(.filtered-out)').length; if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } };
window.updateSelectedCount = function() { const count = document.querySelectorAll('.cb-main:checked').length; if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count; };

window.cycleSelectAll = function() { selectAllState = (selectAllState + 1) % 3; updateSelectAllUI(); applySelection(); };
function updateSelectAllUI() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto cursor-pointer'; } 
    else if (selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto cursor-pointer'; } 
    else if (selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto cursor-pointer'; }
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
// SMART EXCEL FILTER & SORTING
// ==========================================
function sortTable(colClass, headerEl) {
    const tbody = document.getElementById('tbody-nonaktif');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row'));
    let isAsc = sortState.col === colClass ? !sortState.isAsc : true;
    sortState = { col: colClass, isAsc: isAsc };
    
    rows.sort((a, b) => {
        let cellA = a.querySelector('.' + colClass);
        let cellB = b.querySelector('.' + colClass);
        let valA = cellA ? (cellA.getAttribute('data-search') || cellA.innerText.trim()) : ''; 
        let valB = cellB ? (cellB.getAttribute('data-search') || cellB.innerText.trim()) : '';
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    rows.forEach(row => tbody.appendChild(row));
    applyPagination();
}

window.sortFromMenu = function(dir) {
    if(!currentFilterCol) return;
    sortState = { col: currentFilterCol, isAsc: dir === 'asc' };
    closeFilterMenu();
    
    const th = document.querySelector(`th[onclick*="'${currentFilterCol}'"]`);
    if(th) sortTable(currentFilterCol, th);
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; 
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
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
    window.currentFilterValues = sortedValues;
    renderFilterList('');

    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    if (menu) {
        menu.classList.remove('hidden');
        const btnRect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 256; 
        let topPos = btnRect.bottom + 4; 
        let leftPos = btnRect.left; 
        if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
        if (leftPos < 10) { leftPos = 10; }
        menu.style.position = 'fixed'; menu.style.top = `${topPos}px`; menu.style.left = `${leftPos}px`;
    }
    const sInput = document.getElementById('filter-search-input');
    if (sInput) sInput.focus();
};

window.renderFilterList = function(searchQuery) {
    const colClass = currentFilterCol;
    let filteredVals = window.currentFilterValues || [];
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase().split(' ').filter(x => x);
        filteredVals = (window.currentFilterValues || []).filter(val => {
            const text = String(val).toLowerCase();
            return query.every(term => text.includes(term));
        });
    }

    const limit = 100;
    const displayVals = filteredVals.slice(0, limit);

    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded-lg transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-bold text-slate-800">(Pilih Semua)</span></label>`;
    
    displayVals.forEach(val => {
        let isChecked = !activeFilters[colClass] || activeFilters[colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded-lg transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate font-medium text-slate-700">${val}</span>
        </label>`;
    });

    if (filteredVals.length > limit) {
        listHtml += `<div class="p-2 text-center text-xs font-bold text-slate-400 italic">Menampilkan 100 dari ${filteredVals.length} hasil. Ketik untuk mencari.</div>`;
    }

    document.getElementById('filter-values-list').innerHTML = listHtml;
    updateSelectAllState();
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
    updateSelectAllState(); 
};

function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); 
    const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); 
    const selectAll = document.getElementById('filter-select-all');
    if(!selectAll) return;
    if(allCbs.length === checkedCbs.length && allCbs.length > 0) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
}

document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) updateSelectAllState(); });

function closeFilterMenu() { 
    const menu = document.getElementById('excel-filter-menu'); 
    if(menu) menu.classList.add('hidden'); 
}

function clearFilterForCurrentCol() { 
    delete activeFilters[currentFilterCol]; 
    closeFilterMenu(); 
    saringTabelExcel(); 
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
    closeFilterMenu(); 
    saringTabelExcel(); 
}

function saringTabelExcel() {
    renderTabelNonaktifBody();
    
    document.querySelectorAll('#tbody-nonaktif tr.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    
    selectAllState = 0; 
    updateSelectAllUI(); 
    currentPage = 1; 
    applyPagination(); 
    updateFilterIcons();
}

function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => { 
        icon.classList.remove('text-amber-400', 'opacity-100'); 
        icon.classList.add('text-slate-400', 'opacity-40'); 
    });
    document.querySelectorAll('th.hdr-filtered').forEach(th => th.classList.remove('hdr-filtered'));

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
// EXPORT EXCEL & SALIN DATA
// ==========================================
window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return tampilkanAlert("Pilih data yang ingin disalin!", "warning");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-nonaktif th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr');
        if (tr) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { 
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); 
                    rowData.push(val.replace(/\n/g, ' ')); 
                }
            });
            copyString += rowData.join('\t') + '\n';
        }
    });
    navigator.clipboard.writeText(copyString).then(() => { 
        tampilkanAlert("Berhasil menyalin data! Buka Excel dan Paste (Ctrl+V).", "success"); 
    });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return tampilkanAlert("Library Excel belum termuat.", "error");
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-nonaktif th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);
    document.querySelectorAll('#tbody-nonaktif tr.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { 
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); 
                    rowData.push(`"${val.replace(/\n/g, ' ')}"`); 
                }
            });
            ws_data.push(rowData);
        }
    });
    if(ws_data.length <= 1) return tampilkanAlert("Pilih minimal 1 baris data untuk di-export!", "warning");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); 
    let wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, "Stok_Nonaktif"); 
    XLSX.writeFile(wb, `Stok_Nonaktif.xlsx`);
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
    tampilkanAlert("Urutan kolom berhasil disimpan!", "success"); 
    toggleSidebarKolom(); 
    renderTabelNonaktifHeaders();
    renderTabelNonaktifBody();
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    userColOrder = []; localStorage.removeItem(`col_order_nonaktif_${currentUser.username}`);
    tampilkanAlert("Urutan dikembalikan ke default.", "success"); 
    toggleSidebarKolom(); 
    renderTabelNonaktifHeaders();
    renderTabelNonaktifBody();
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
