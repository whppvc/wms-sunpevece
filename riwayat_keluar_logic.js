const isMobileDevice = window.innerWidth < 640;
let modeSekarang = isMobileDevice ? 'mobile' : 'item';

let rawDataRaw = [];
let holdDataRaw = [];
let kamusData = [];
let sortState = {}; 
let globalCheckedCancel = []; 

let activeFilters = {}; 
let currentFilterCol = '';
let currentPage = 1;
let rowsPerPage = 10; 
let selectAllState = 0; 
let userColOrder = []; 
let hiddenCols = []; 

let mobileLevel = 1; 
let mobileSelectedCust = '';
let mobileSelectedTrip = '';
let mobileSelectedItem = '';
let mobileSelectedShading = '';

let filterTimeout;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

// ==========================================
// CUSTOM ALERT & NOTIFICATION SYSTEM
// ==========================================
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
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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

async function fetchAllRows(tableName, orderCol = 'created_at') {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await db
            .from(tableName)
            .select('*')
            .order(orderCol, { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        page++;
    }
    return allData;
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_keluar', title: 'RIWAYAT KELUAR', url: 'riwayat_keluar.html' });
    
    // KOMPONEN DINAMIS: TABS & FOOTER
    const tabsData = [
        { id: 'tab-mode-mobile', label: 'MOBILE', icon: 'smartphone', onClick: "setMode('mobile')", mobileOnly: true },
        { id: 'tab-mode-item', label: 'RANGKUMAN ITEM', icon: 'boxes', onClick: "setMode('item')" },
        { id: 'tab-mode-hold', label: 'TABEL HOLD KELUAR', icon: 'pause-circle', onClick: "setMode('hold')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, isMobileDevice ? 'tab-mode-mobile' : 'tab-mode-item');
    }
    
    if (typeof window.renderTableFooter === 'function') {
        window.renderTableFooter('container-footer', 'Total Qty (Dus)');
    }

    const dateInput = document.getElementById('filter-date-mobile');
    if(dateInput) dateInput.value = getTodayDate();

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
    });

    setTimeout(async () => {
        await loadKamus();
        await loadAreasForCancel(); 
        loadUserPreferences();
        await muatDataDariSupabase();
    }, 200);
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.tutupSemuaPopups = function() {
    const modalCancel = document.getElementById('modal-cancel-hold');
    if(modalCancel) modalCancel.classList.add('hidden');
    
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    closeFilterMenu();
};

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_rkeluar_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } } 
    else { userColOrder = []; }
    
    const savedHidden = localStorage.getItem(`col_hidden_rkeluar_${currentUser.username}`);
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
};

async function loadAreasForCancel() {
    try {
        const { data } = await db.from('master_area').select('*');
        if (data) {
            const areas = [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))];
            const sel = document.getElementById('cancel-area');
            if(sel) {
                sel.innerHTML = '<option value="">-- PILIH AREA GUDANG --</option>';
                areas.sort().forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

async function loadKamus() {
    const { data: d2 } = await db.from('master_2').select('*'); 
    if(d2) {
        kamusData = d2;
        window.masterData = { kamus: d2 };
    }
}

function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

function extractAreaFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length > 0 ? parts[0] : '-';
}

window.muatDataDariSupabase = async function() {
    const tbody = document.getElementById('tbody-keluar');
    if(tbody) tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Semua Data Riwayat Keluar...</p></td></tr>`;
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const [dataKeluar, dataHold] = await Promise.all([
            fetchAllRows('stok_keluar'),
            fetchAllRows('hold_keluar')
        ]);
        
        rawDataRaw = dataKeluar || [];
        holdDataRaw = dataHold || [];
        
        setMode(modeSekarang);
    } catch(err) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-red-500 font-bold">Gagal memuat data: ${err.message}</td></tr>`; 
    }
};

window.setMode = function(m) {
    modeSekarang = m;
    
    const tabsData = [
        { id: 'tab-mode-mobile', label: 'MOBILE', icon: 'smartphone', onClick: "setMode('mobile')", mobileOnly: true },
        { id: 'tab-mode-item', label: 'RANGKUMAN ITEM', icon: 'boxes', onClick: "setMode('item')" },
        { id: 'tab-mode-hold', label: 'TABEL HOLD KELUAR', icon: 'pause-circle', onClick: "setMode('hold')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-mode-' + m);
    }

    const btnCancel = document.getElementById('btn-cancel');
    const dateFilter = document.getElementById('mobile-date-filter');
    
    const viewTable = document.getElementById('view-table');
    const viewMobile = document.getElementById('view-mobile');
    const footerPagination = document.getElementById('container-footer');
    const lvl5Footer = document.getElementById('mobile-lvl5-footer');

    if(m === 'hold') { 
        if(btnCancel) btnCancel.classList.remove('hidden'); 
        if(dateFilter) dateFilter.classList.add('hidden');
        if(viewTable) viewTable.classList.remove('hidden'); 
        if(viewMobile) viewMobile.classList.add('hidden');
        if(footerPagination) { footerPagination.classList.remove('hidden'); footerPagination.style.display = 'flex'; }
        if(lvl5Footer) { lvl5Footer.classList.add('hidden'); lvl5Footer.style.display = 'none'; }
    }
    else if(m === 'mobile') {
        if(btnCancel) btnCancel.classList.add('hidden'); 
        if(dateFilter) dateFilter.classList.remove('hidden');
        if(viewTable) viewTable.classList.add('hidden'); 
        if(viewMobile) viewMobile.classList.remove('hidden');
        if(footerPagination) { footerPagination.classList.add('hidden'); footerPagination.style.display = 'none'; }
        mobileLevel = 1; 
    }
    else { 
        if(btnCancel) btnCancel.classList.add('hidden'); 
        if(dateFilter) dateFilter.classList.add('hidden');
        if(viewTable) viewTable.classList.remove('hidden'); 
        if(viewMobile) viewMobile.classList.add('hidden');
        if(footerPagination) { footerPagination.classList.remove('hidden'); footerPagination.style.display = 'flex'; }
        if(lvl5Footer) { lvl5Footer.classList.add('hidden'); lvl5Footer.style.display = 'none'; }
    }

    activeFilters = {};
    if (m === 'mobile') {
        renderMobileView();
    } else {
        renderHeaderDanTabel();
    }
};

// ==========================================
// LOGIKA MOBILE VIEW (DRILL DOWN)
// ==========================================
window.goToMobileLevel2 = function(cust) { mobileSelectedCust = cust; mobileLevel = 2; renderMobileView(); };
window.goToMobileLevel3 = function(trip) { mobileSelectedTrip = trip; mobileLevel = 3; renderMobileView(); };
window.goToMobileLevel4 = function(itemKey) { mobileSelectedItem = itemKey; mobileLevel = 4; renderMobileView(); };
window.goToMobileLevel5 = function(shading) { mobileSelectedShading = shading; mobileLevel = 5; renderMobileView(); };

window.goBackMobile = function() {
    if (mobileLevel > 1) {
        mobileLevel--;
        renderMobileView();
    }
};

function mapItemForFilter(r) {
    const t = window.translateBarcode(r.qrcode);
    const custAktual = r.customer_aktual || t.customer || '-';
    const custEstimasi = r.customer_estimasi || '-';
    const customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
    const pjgFormatted = formatPanjang(r.panjang || t.panjang);
    const asalArea = r.area || extractAreaFromSKU(r.id_sku) || '-';

    return {
        qrcode: r.qrcode,
        id_sku: r.id_sku,
        customerKeluar: customerKeluar,
        trip: r.trip || '-',
        customerAktual: custAktual,
        customerEstimasi: custEstimasi,
        jenisItem: r.jenis_item || t.jenisItem || '-',
        namaItem: r.nama_item || t.namaItem || '-',
        panjang: pjgFormatted,
        grade: r.grade || t.grade || '-',
        dus: r.dus || t.dus || '-',
        shading: r.shading || t.shading || '-',
        pic: r.pic_keluar || r.pic_input || '-',
        keterangan: r.keterangan || '-',
        created_at: r.created_at,
        tglProduksi: t.tglProduksi || '-',
        mesin: t.mesin || '-',
        shift: t.shift || '-',
        area: asalArea
    };
}

window.toggleSelectAllLvl5 = function(checked) {
    document.querySelectorAll('.cb-lvl5').forEach(cb => {
        cb.checked = checked;
        const card = cb.closest('.card-lvl5');
        if (card) {
            if (checked) card.classList.add('border-blue-500', 'bg-blue-50/50');
            else card.classList.remove('border-blue-500', 'bg-blue-50/50');
        }
    });
};

window.highlightLvl5Card = function(cb) {
    const card = cb.closest('.card-lvl5');
    if (card) {
        if (cb.checked) card.classList.add('border-blue-500', 'bg-blue-50/50');
        else card.classList.remove('border-blue-500', 'bg-blue-50/50');
    }
};

window.cancelKeluarMobile = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-lvl5:checked');
    if (checkedBoxes.length === 0) return tampilkanAlert("Pilih / centang minimal 1 kardus yang ingin di-cancel keluar!", "warning");

    const qrsToCancel = Array.from(checkedBoxes).map(cb => cb.value);

    if (!confirm(`Yakin ingin membatalkan (Cancel) ${qrsToCancel.length} item ini dari status Keluar?\nItem akan langsung dipindahkan ke Tabel Hold Keluar.`)) return;

    const btn = document.getElementById('btn-cancel-mobile-lvl5');
    const oriText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btn.disabled = true; }

    const itemsToHold = rawDataRaw.filter(r => qrsToCancel.includes(r.qrcode)).map(r => ({
        qrcode: r.qrcode,
        id_sku: r.id_sku,
        customer_keluar: r.customer_keluar,
        trip: r.trip,
        customer_aktual: r.customer_aktual,
        customer_estimasi: r.customer_estimasi,
        keterangan: 'DI-CANCEL dari Mobile Riwayat',
        pic_input: currentUser.username
    }));

    try {
        const { error: errAdd } = await db.from('hold_keluar').insert(itemsToHold);
        if (errAdd) throw errAdd;

        const { error: errDel } = await db.from('stok_keluar').delete().in('qrcode', qrsToCancel);
        if (errDel) throw errDel;

        rawDataRaw = rawDataRaw.filter(r => !qrsToCancel.includes(r.qrcode));
        holdDataRaw.push(...itemsToHold);

        tampilkanAlert(`${qrsToCancel.length} kardus berhasil di-cancel dan dipindahkan ke Tabel Hold Keluar.`, "success");
        renderMobileView();

    } catch (e) {
        tampilkanAlert("Gagal memproses cancel keluar: " + e.message, "error");
    } finally {
        if(btn) { btn.innerHTML = oriText; btn.disabled = false; }
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};

function renderMobileView() {
    const container = document.getElementById('view-mobile');
    const targetDate = document.getElementById('filter-date-mobile')?.value;
    const lvl5Footer = document.getElementById('mobile-lvl5-footer');

    if (lvl5Footer) {
        if (modeSekarang === 'mobile' && mobileLevel === 5) {
            lvl5Footer.classList.remove('hidden');
            lvl5Footer.style.display = 'flex';
            const cbAllLvl5 = document.getElementById('cb-all-lvl5');
            if (cbAllLvl5) cbAllLvl5.checked = false;
        } else {
            lvl5Footer.classList.add('hidden');
            lvl5Footer.style.display = 'none';
        }
    }

    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;

    let mobileData = [];
    targetData.forEach(r => {
        const rowDate = (r.created_at || '').split('T')[0];
        if (targetDate && rowDate !== targetDate) return;

        const mapped = mapItemForFilter(r);
        mobileData.push(mapped);
    });

    if (mobileData.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-56 bg-white rounded-2xl border border-slate-200 shadow-sm mt-4 p-6 text-center">
                <i data-lucide="package-x" class="w-12 h-12 text-slate-300 mb-2"></i>
                <h4 class="font-bold text-slate-700 text-sm">Tidak ada data keluar</h4>
                <p class="text-xs text-slate-400 mt-1">Coba sesuaikan tanggal atau reset filter.</p>
            </div>`;
        if(typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    let html = '';

    if (mobileLevel === 1) {
        let custMap = {};
        mobileData.forEach(r => {
            let cust = r.customerKeluar || '-';
            if(!custMap[cust]) custMap[cust] = 0;
            custMap[cust]++;
        });

        html += `<div class="flex justify-between items-center mb-1 px-1">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-wider">Daftar Pengiriman (Customer)</h3>
            <span class="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">${mobileData.length} Total Dus</span>
        </div>`;
        
        Object.keys(custMap).sort().forEach(cust => {
            html += `
                <div onclick="goToMobileLevel2('${cust}')" class="bg-white border border-blue-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-blue-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="truck" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-base uppercase leading-tight">${cust}</h4>
                            <p class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max mt-1 border border-blue-100">${custMap[cust]} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    } 
    else if (mobileLevel === 2) {
        let tripMap = {};
        mobileData.forEach(r => {
            if (r.customerKeluar !== mobileSelectedCust) return;
            let trip = r.trip || '-';
            if(!tripMap[trip]) tripMap[trip] = 0;
            tripMap[trip]++;
        });

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-4 px-4 py-2.5 border-b border-slate-200 shadow-sm flex items-center gap-3 mb-2">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-[10px] font-black text-slate-400 uppercase leading-none">Customer Tujuan</span>
                    <span class="text-base font-black text-blue-700 uppercase leading-tight truncate">${mobileSelectedCust}</span>
                </div>
            </div>
        `;

        Object.keys(tripMap).sort().forEach(trip => {
            html += `
                <div onclick="goToMobileLevel3('${trip}')" class="bg-white border border-indigo-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-indigo-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="truck-fast" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-base uppercase leading-tight">${trip}</h4>
                            <p class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-max mt-1 border border-indigo-100">${tripMap[trip]} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    }
    else if (mobileLevel === 3) {
        let itemMap = {};
        mobileData.forEach(r => {
            if (r.customerKeluar !== mobileSelectedCust) return;
            if (r.trip !== mobileSelectedTrip) return;

            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            if(!itemMap[key]) {
                itemMap[key] = { nama: r.namaItem, pjg: r.panjang, grade: r.grade, dus: r.dus, qty: 0 };
            }
            itemMap[key].qty++;
        });

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-4 px-4 py-2.5 border-b border-slate-200 shadow-sm flex items-center gap-3 mb-2">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-[10px] font-black text-slate-400 uppercase leading-none">${mobileSelectedCust}</span>
                    <span class="text-base font-black text-blue-700 uppercase leading-tight truncate">${mobileSelectedTrip}</span>
                </div>
            </div>
        `;

        Object.keys(itemMap).sort().forEach(key => {
            let item = itemMap[key];
            html += `
                <div onclick="goToMobileLevel4('${key}')" class="bg-white border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-emerald-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="box" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <h4 class="font-black text-slate-800 text-sm leading-snug">${item.nama} - ${item.pjg} - ${item.grade} - ${item.dus}</h4>
                            <p class="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-max mt-1 border border-emerald-100">${item.qty} Dus</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                </div>
            `;
        });
    }
    else if (mobileLevel === 4) {
        let shadingMap = {};
        mobileData.forEach(r => {
            if (r.customerKeluar !== mobileSelectedCust) return;
            if (r.trip !== mobileSelectedTrip) return;

            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            if (key !== mobileSelectedItem) return;

            let shading = r.shading || '-';
            if(!shadingMap[shading]) shadingMap[shading] = 0;
            shadingMap[shading]++;
        });

        let itemParts = mobileSelectedItem.split('_');
        let displayItem = `${itemParts[0]} - ${itemParts[1]} - ${itemParts[2]} - ${itemParts[3]}`;

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-4 px-4 py-2.5 border-b border-slate-200 shadow-sm flex items-center gap-3 mb-2">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-base font-black text-rose-700 uppercase leading-snug truncate">${mobileSelectedCust} (${mobileSelectedTrip})</span>
                    <span class="text-xs sm:text-sm font-black text-slate-800 uppercase leading-snug truncate">${displayItem}</span>
                </div>
            </div>
        `;

        Object.keys(shadingMap).sort().forEach(shading => {
            html += `
                <div onclick="goToMobileLevel5('${shading}')" class="bg-white border border-amber-200 p-4 rounded-xl flex justify-between items-center shadow-sm active:scale-95 transition cursor-pointer hover:bg-amber-50">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i data-lucide="palette" class="w-5 h-5"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Shading</span>
                            <h4 class="font-black text-slate-800 text-base leading-tight">${shading}</h4>
                            <span class="text-[10px] font-bold text-amber-700 mt-0.5">Klik untuk melihat detail item</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                            <span class="text-sm font-black text-amber-700">${shadingMap[shading]} Dus</span>
                        </div>
                        <i data-lucide="chevron-right" class="text-slate-400 w-5 h-5"></i>
                    </div>
                </div>
            `;
        });
    }
    else if (mobileLevel === 5) {
        let detailItems = mobileData.filter(r => {
            if (r.customerKeluar !== mobileSelectedCust) return false;
            if (r.trip !== mobileSelectedTrip) return false;
            let key = `${r.namaItem}_${r.panjang}_${r.grade}_${r.dus}`;
            if (key !== mobileSelectedItem) return false;
            if (r.shading !== mobileSelectedShading) return false;
            return true;
        });

        let itemParts = mobileSelectedItem.split('_');
        let displayItem = `${itemParts[0]} - ${itemParts[1]} - ${itemParts[2]} - ${itemParts[3]}`;

        html += `
            <div class="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md -mx-4 px-4 py-2.5 border-b border-slate-300 shadow-sm flex items-center gap-3 mb-3">
                <button onclick="goBackMobile()" class="p-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition flex items-center gap-1.5 text-xs font-black text-slate-700 shrink-0">
                    <i data-lucide="arrow-left" class="w-4 h-4 text-slate-600"></i> Kembali
                </button>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-base font-black text-rose-700 uppercase leading-snug truncate">${mobileSelectedCust} (${mobileSelectedTrip})</span>
                    <span class="text-xs sm:text-sm font-black text-slate-800 uppercase leading-snug truncate">${displayItem} • Shading: <span class="text-amber-600 font-black">${mobileSelectedShading}</span></span>
                </div>
            </div>
        `;

        detailItems.forEach(d => {
            const waktuKeluar = formatWIB(d.created_at);

            html += `
                <div class="card-lvl5 bg-white border border-slate-300 rounded-2xl p-4 mb-2 relative transition w-full flex flex-col shadow-sm">
                    <div class="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" value="${d.qrcode}" onchange="highlightLvl5Card(this)" class="cb-lvl5 cursor-pointer w-5 h-5 accent-blue-600 rounded border-slate-400">
                            <span class="font-mono text-xs font-black text-slate-500 uppercase">PILIH DUS</span>
                        </label>
                        <span class="font-bold px-2.5 py-0.5 text-[10px] rounded-md border bg-emerald-600 text-white border-emerald-700 shadow-sm">KELUAR</span>
                    </div>
                    
                    <div class="font-mono font-black text-slate-900 text-sm break-all leading-tight bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-center mb-3">
                        ${d.qrcode}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-x-3 gap-y-3">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Waktu Scan Keluar</span>
                            <span class="text-xs font-bold text-slate-700">${waktuKeluar}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Asal Area</span>
                            <span class="text-xs font-black text-emerald-700 uppercase">${d.area || '-'}</span>
                        </div>

                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Customer Aktual</span>
                            <span class="text-xs font-bold text-orange-600 uppercase">${d.customerAktual}</span>
                        </div>
                        
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase">Customer Estimasi</span>
                            <span class="text-xs font-bold text-purple-600 uppercase">${d.customerEstimasi}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ========================================================
// LOGIKA TABEL DESKTOP (SORT & FILTER EXCEL PRO)
// ========================================================
function sortTable(colClass, headerEl) {
    const tbody = document.getElementById('tbody-keluar');
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
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    applyPagination();
}

window.sortFromMenu = function(dir) {
    if(!currentFilterCol) return;
    sortState = { col: currentFilterCol, isAsc: dir === 'asc' };
    closeFilterMenu();
    
    const th = document.querySelector(`th[onclick*="'${currentFilterCol}'"]`);
    if(th) sortTable(currentFilterCol, th);
};

function thSort(label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-cb', 'col-no'].includes(colClass);
    
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

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-keluar');
    const tbody = document.getElementById('tbody-keluar');
    if(!thead || !tbody) return;
    
    sortState = {};
    selectAllState = 0;

    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;
    const rowClassBase = "transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200";

    if(modeSekarang === 'hold') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Waktu Keluar', 'col-waktu')}
                ${thSort('QRCode', 'col-qr')}
                ${thSort('Trip', 'col-trip')}
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Aktual', 'col-customer')}
                ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
                ${thSort('Customer Keluar', 'col-tujuan text-amber-300')}
                ${thSort('Keterangan', 'col-ket')}
                ${thSort('PIC Keluar', 'col-pic')}
            </tr>`;
        
        if(targetData.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="18" class="p-10 text-center font-medium text-slate-400">Tidak ada data.</td></tr>'; 
            applyPagination(); 
            return; 
        }
        
        let h = '';
        targetData.forEach((r) => {
            const dt = new Date(r.created_at);
            const tglKeluar = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            const td = window.translateBarcode(r.qrcode);
            
            const custAktual = r.customer_aktual || td.customer || '-';
            const custEstimasi = r.customer_estimasi || '-';
            const customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-'; 
            const pjgFormatted = formatPanjang(r.panjang || td.panjang);

            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.qrcode}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-slate-600 font-medium text-left col-waktu ${hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${tglKeluar}">${tglKeluar}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 text-left tracking-wider col-qr ${hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-black text-indigo-700 text-center col-trip ${hiddenCols.includes('col-trip')?'col-hidden':''}" data-search="${r.trip || '-'}">${r.trip || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${td.tglProduksi}">${td.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${td.mesin}">${td.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${td.shift}">${td.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${td.jenisItem}">${td.jenisItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${td.namaItem}">${td.namaItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${pjgFormatted}">${pjgFormatted}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${td.grade}">${td.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${td.dus}">${td.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${td.shading}">${td.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}" data-search="${custAktual}">${custAktual}</td>
                    <td class="px-4 py-3 font-medium text-purple-600 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}" data-search="${custEstimasi}">${custEstimasi}</td>
                    <td class="px-4 py-3 font-black text-amber-600 text-left col-tujuan ${hiddenCols.includes('col-tujuan')?'col-hidden':''}" data-search="${customerKeluar}">${customerKeluar}</td>
                    <td class="px-4 py-3 text-slate-500 font-medium text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic ${hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_keluar || r.pic_input || '-'}">${r.pic_keluar || r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if(modeSekarang === 'item') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('Tgl Produksi', 'col-tgl')}
                ${thSort('Mesin', 'col-mesin')}
                ${thSort('Shift', 'col-shift')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Pjg', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Aktual', 'col-customer')}
                ${thSort('Customer Estimasi', 'col-estimasi text-purple-300')}
                ${thSort('Customer Keluar', 'col-tujuan text-amber-300')}
                ${thSort('Trip', 'col-trip')}
                ${thSort('QTY KELUAR (DUS)', 'col-qty text-emerald-300')}
                ${thSort('Keterangan', 'col-ket')}
            </tr>`;
        
        let groups = {};
        targetData.forEach(r => {
            let t = window.translateBarcode(r.qrcode); 
            let n = t.namaItem;
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let custAktual = r.customer_aktual || t.customer || '-';
            let custEstimasi = r.customer_estimasi || '-';
            let customerKeluar = r.customer_keluar || extractPOFromSKU(r.id_sku) || '-';
            let pjgFormatted = formatPanjang(r.panjang || t.panjang);
            let trip = r.trip || '-';
            
            let key = `${t.jenisItem}_${n}_${pjgFormatted}_${t.grade}_${t.dus}_${t.shading}_${custAktual}_${custEstimasi}_${customerKeluar}_${trip}_${t.tglProduksi}_${t.mesin}_${t.shift}_${ket}`;
            
            if(!groups[key]) {
                groups[key] = { ...t, panjang: pjgFormatted, displayNama: n, qty: 0, qrcodes: [], tj: customerKeluar, trip: trip, ket: ket, custAktual: custAktual, custEstimasi: custEstimasi };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="16" class="p-10 text-center font-medium text-slate-400">Kosong.</td></tr>'; 
            applyPagination(); 
            return; 
        }

        let h = '';
        arr.forEach((r) => {
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.qrcodes.join(',')}" onchange="highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenisItem}">${r.jenisItem}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.displayNama}">${r.displayNama}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}" data-search="${r.custAktual}">${r.custAktual}</td>
                    <td class="px-4 py-3 font-medium text-purple-600 text-left col-estimasi ${hiddenCols.includes('col-estimasi')?'col-hidden':''}" data-search="${r.custEstimasi}">${r.custEstimasi}</td>
                    <td class="px-4 py-3 font-black text-amber-600 text-left col-tujuan ${hiddenCols.includes('col-tujuan')?'col-hidden':''}" data-search="${r.tj}">${r.tj}</td>
                    <td class="px-4 py-3 font-black text-indigo-700 text-center col-trip ${hiddenCols.includes('col-trip')?'col-hidden':''}" data-search="${r.trip}">${r.trip}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty ${hiddenCols.includes('col-qty')?'col-hidden':''}" data-search="${r.qty}">${r.qty}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${displayKet}">${displayKet}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    
    applyColumnOrder();
    if(typeof lucide !== 'undefined') lucide.createIcons(); 
    updateSelectAllUI();
    saringTabelExcel();
    initResizableColumns();
}

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-keluar tr.r-row').forEach(row => {
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
    window.currentFilterValues = sortedValues;
    renderFilterList('');

    document.getElementById('filter-search-input').value = '';
    
    const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        const btnRect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 256; 
        let topPos = btnRect.bottom + 4; 
        let leftPos = btnRect.left; 

        if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
        if (leftPos < 10) { leftPos = 10; }

        menu.style.position = 'fixed'; 
        menu.style.top = `${topPos}px`;
        menu.style.left = `${leftPos}px`;
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
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
            renderFilterList(val);
        });
    }, 150);
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    updateSelectAllState();
};

window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length && allCbs.length > 0) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};

document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) updateSelectAllState(); });

window.closeFilterMenu = function() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); };

window.clearFilterForCurrentCol = function() { delete activeFilters[currentFilterCol]; closeFilterMenu(); saringTabelExcel(); };

window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    closeFilterMenu(); saringTabelExcel(); 
};

window.saringTabelExcel = function() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowedValues.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
    });
    selectAllState = 0;
    updateSelectAllUI();
    currentPage = 1; applyPagination(); updateFilterIcons();
};

window.updateFilterIcons = function() {
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
};

window.cycleSelectAll = function() {
    selectAllState = (selectAllState + 1) % 3;
    updateSelectAllUI();
    applySelection();
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

window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-keluar tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
    } else if (selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.cb-main');
                if(cb) { cb.checked = true; highlightRow(cb, true); }
            }
        });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = true; highlightRow(cb, true); }
        });
    }
    updateSelectedCount();
};

window.highlightRow = function(cb, skipStateReset = false) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
    
    if(!skipStateReset && !cb.checked && selectAllState !== 0) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    
    if(!skipStateReset) updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
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
    applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        rowsPerPage = parsed;
        localStorage.setItem('wms_rows_per_page', rowsPerPage);
        currentPage = 1;
        applyPagination();
    }
};

window.jumpToPage = function(val) {
    let p = parseInt(val);
    const totalVisible = document.querySelectorAll('#tbody-keluar tr.r-row:not(.filtered-out)').length;
    const totalPages = Math.ceil(totalVisible / rowsPerPage) || 1;
    if (isNaN(p) || p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    
    currentPage = p;
    const inp = document.getElementById('input-page-jump');
    if(inp) inp.value = currentPage;
    applyPagination();
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-keluar tr.r-row'));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    let sumQty = 0;

    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1');
        else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty');
        if (qtyCell && modeSekarang === 'item') { 
            sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 
        } else { 
            sumQty += 1; 
        }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    const inpPage = document.getElementById('input-page-jump');
    if(inpPage) {
        inpPage.value = currentPage;
        inpPage.max = totalPages;
    }

    if (selectAllState === 1) {
        selectAllState = 0;
        updateSelectAllUI();
    }
    
    applySelection();
    updateSelectedCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; applyPagination(); } };
window.nextPage = function() { 
    const totalVisible = document.querySelectorAll('#tbody-keluar tr.r-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
};

window.updateSelectedCount = function() {
    const count = document.querySelectorAll('.cb-main:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
};

window.aksiMassal = async function(tipe) {
    let checkedValues = [];
    document.querySelectorAll('.cb-main:checked').forEach(cb => { cb.value.split(',').forEach(v => { if(v) checkedValues.push(v); }); });
    if(checkedValues.length === 0) return tampilkanAlert("Centang baris tabel terlebih dahulu!", "warning");

    if(tipe === 'salin') {
        let textSalin = "";
        const headers = Array.from(document.querySelectorAll('#thead-keluar th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        document.querySelectorAll('.cb-main:checked').forEach(cb => {
            const tr = cb.closest('tr'); const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { 
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                    let cleanVal = String(val).replace(/<[^>]*>?/gm, '').replace(/(\r\n|\n|\r)/gm, " ").trim();
                    rowData.push(cleanVal); 
                }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        navigator.clipboard.writeText(textSalin);
        tampilkanAlert(`Tersalin! Buka Excel dan Paste (Ctrl+V).`, "success");
    } 
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return tampilkanAlert("Library Excel belum termuat, pastikan ada koneksi internet.", "error");
        let ws_data = [];
        const headers = Array.from(document.querySelectorAll('#thead-keluar th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim().replace(/\n/g, ' '));
        ws_data.push(headers);
        
        document.querySelectorAll('.r-row').forEach(tr => {
            if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
                const rowData = [];
                Array.from(tr.children).forEach(td => {
                    if(td.classList.contains('col-cb')) return;
                    if(window.getComputedStyle(td).display !== 'none') { 
                        let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                        let cleanVal = String(val).replace(/<[^>]*>?/gm, '').replace(/(\r\n|\n|\r)/gm, " ").trim();
                        rowData.push(`"${cleanVal}"`); 
                    }
                });
                ws_data.push(rowData);
            }
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Keluar_Data");
        XLSX.writeFile(wb, `Riwayat_Keluar_${modeSekarang.toUpperCase()}.xlsx`);
    }
    else if(tipe === 'cancel') {
        if(modeSekarang !== 'hold') return tampilkanAlert("CANCEL hanya bisa dilakukan dari Tabel Hold.", "warning");
        
        globalCheckedCancel = checkedValues;
        
        document.getElementById('cancel-ket').value = '';
        document.getElementById('cancel-area').value = '';
        
        document.getElementById('modal-cancel-hold').classList.remove('hidden');
    }
};

window.eksekusiCancelHold = async function() {
    const areaCancel = document.getElementById('cancel-area').value;
    const ketCancel = document.getElementById('cancel-ket').value.trim();

    if(!areaCancel) return tampilkanAlert("Pilih Area Pengembalian terlebih dahulu!", "warning");
    if(!ketCancel) return tampilkanAlert("Keterangan wajib diisi!", "warning");

    const btn = document.getElementById('btn-submit-cancel'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> RETUR STOK...'; btn.disabled = true;

    const dataReturn = holdDataRaw.filter(r => globalCheckedCancel.includes(r.qrcode));
    let insertsGlobal = [];
    let aktualUpdates = {};

    dataReturn.forEach(item => {
        let parts = item.id_sku.split('_');
        let customerAktual = item.customer_aktual || '-';
        let customerEstimasi = item.customer_estimasi || '-';
        
        if(parts.length >= 8) {
            parts[0] = areaCancel; 
            item.id_sku = parts.join('_');
            
            let [a, jenis, nama, pjg, grade, dus, shading] = parts;
            let pjgFormatted = formatPanjang(pjg);
            let key = `${nama}_${pjgFormatted}_${grade}_${dus}_${shading}_${customerAktual}_${customerEstimasi}`;
            if(!aktualUpdates[key]) aktualUpdates[key] = { nama_item: nama, pjg: pjgFormatted, grade: grade, dus: dus, shading: shading, customer_aktual: customerAktual, customer_estimasi: customerEstimasi, qty: 0 };
            aktualUpdates[key].qty++;
        }

        insertsGlobal.push({
            qrcode: item.qrcode,
            id_sku: item.id_sku,
            area: areaCancel,
            tgl_produksi: item.tgl_produksi || '-',
            mesin: item.mesin || '-',
            shift: item.shift || '-',
            jenis_item: item.jenis_item || '-',
            nama_item: item.nama_item,
            panjang: item.panjang,
            grade: item.grade,
            dus: item.dus,
            shading: item.shading,
            customer_aktual: customerAktual,
            keterangan: ketCancel,
            kondisi: 'Aman',
            pic_input: currentUser.username,
            jalur_masuk: 'cancel-hold'
        });
    });

    try {
        const { error: e1 } = await db.from('stok_global').insert(insertsGlobal);
        if(e1) throw e1;

        for(let key in aktualUpdates) {
            let u = aktualUpdates[key];
            const {data: curData} = await db.from('stok_aktual').select('id, qty').eq('nama_item', u.nama_item).eq('panjang', u.pjg).eq('grade', u.grade).eq('dus', u.dus).eq('shading', u.shading).eq('area', areaCancel).eq('customer_aktual', u.customer_aktual).eq('customer_estimasi', u.customer_estimasi).is('konversi', null).limit(1);
            if(curData && curData.length > 0) {
                await db.from('stok_aktual').update({qty: curData[0].qty + u.qty}).eq('id', curData[0].id);
            } else {
                await db.from('stok_aktual').insert([{
                    area: areaCancel,
                    nama_item: u.nama_item,
                    panjang: u.pjg,
                    grade: u.grade,
                    dus: u.dus,
                    shading: u.shading,
                    customer_aktual: u.customer_aktual,
                    customer_estimasi: u.customer_estimasi,
                    keterangan: ketCancel,
                    qty: u.qty
                }]); 
            }
        }

        const { error: e3 } = await db.from('hold_keluar').delete().in('qrcode', globalCheckedCancel);
        if(e3) throw e3;

        tampilkanAlert(`${globalCheckedCancel.length} item telah dikembalikan ke Kartu Stok pada Area "${areaCancel}".`, "success");
        window.muatDataDariSupabase();
        document.getElementById('modal-cancel-hold').classList.add('hidden');
    } catch(e) { tampilkanAlert("GAGAL RETUR: " + e.message, "error"); }
    finally { btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons(); }
};

window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

function renderDragList() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-keluar th'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; 
        const label = th.innerText.trim() || 'Kolom';
        if(!colClass || colClass === 'col-cb') return;

        const isHidden = hiddenCols.includes(colClass);
        const eyeIcon = isHidden ? 'eye-off' : 'eye';
        const eyeColor = isHidden ? 'text-slate-300' : 'text-blue-600';

        const div = document.createElement('div'); div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab'; div.draggable = true; div.setAttribute('data-col', colClass);
        div.innerHTML = `
            <span class="font-bold text-slate-700 text-xs">${label}</span>
            <div class="flex items-center gap-3">
                <button onclick="toggleHideCol(event, '${colClass}')" class="p-1 hover:bg-slate-100 rounded"><i data-lucide="${eyeIcon}" class="w-4 h-4 ${eyeColor}"></i></button>
                <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>
            </div>
        `;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); }); div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
}

window.toggleHideCol = function(e, colClass) {
    e.stopPropagation();
    if(hiddenCols.includes(colClass)) {
        hiddenCols = hiddenCols.filter(c => c !== colClass);
    } else {
        hiddenCols.push(colClass);
    }
    renderDragList();
};

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    userColOrder = newOrder; 
    localStorage.setItem(`col_order_rkeluar_${currentUser.username}`, JSON.stringify(newOrder));
    localStorage.setItem(`col_hidden_rkeluar_${currentUser.username}`, JSON.stringify(hiddenCols));
    tampilkanAlert("Pengaturan kolom berhasil disimpan!", "success"); window.toggleSidebarKolom(); renderHeaderDanTabel(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan pengaturan kolom ke default?")) return;
    userColOrder = []; hiddenCols = [];
    localStorage.removeItem(`col_order_rkeluar_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_rkeluar_${currentUser.username}`);
    tampilkanAlert("Pengaturan dikembalikan ke default.", "success"); window.toggleSidebarKolom(); renderHeaderDanTabel();
};

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;
    const table = document.getElementById('table-keluar-main');
    if(!table) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; 
        if (cbCell) row.appendChild(cbCell);
        userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && !userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#table-keluar-main th');
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
