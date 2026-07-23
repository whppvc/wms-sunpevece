let currentTab = 'stbj';
let rawData = [];
let rawDataSecondary = []; // Untuk Konversi (stok_konversi)
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
let userColOrder = []; 
let hiddenCols = [];

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

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

function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'reports', title: 'LAPORAN & REKAP', url: 'reports.html' });
    
    // Set default date range (1 bulan terakhir)
    const dEnd = new Date();
    const dStart = new Date(); dStart.setMonth(dStart.getMonth() - 1);
    document.getElementById('date-end').value = dEnd.toISOString().split('T')[0];
    document.getElementById('date-start').value = dStart.toISOString().split('T')[0];

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) { window.closeFilterMenu(); }
        }
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) { actionMenu.classList.add('hidden'); }
        }
    });

    switchTab('stbj');
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-export-stok').classList.add('hidden');
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
};

window.switchTab = function(tab) {
    currentTab = tab;
    const tabs = ['stbj', 'langsir', 'stok', 'customer', 'konversi', 'moving'];
    const activeClass = 'px-5 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-5 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    tabs.forEach(t => {
        const el = document.getElementById('tab-' + t);
        if(el) el.className = (t === tab) ? activeClass : inactiveClass;
    });

    // Toggle Toolbar
    document.getElementById('filter-date-container').classList.toggle('hidden', !['stbj', 'langsir'].includes(tab));
    document.getElementById('filter-mode-container').classList.toggle('hidden', tab !== 'stok');

    if (tab === 'moving') {
        const tbody = document.getElementById('tbody-report');
        document.getElementById('thead-report').innerHTML = '';
        tbody.innerHTML = `<tr><td class="p-10 text-center font-bold text-slate-400">Menu Moving masih dalam tahap pengembangan.</td></tr>`;
        return;
    }

    activeFilters = {};
    loadUserPreferences();
    loadData();
};

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_rep_${currentTab}_${currentUser.username}`);
    if (savedOrder) { try { window.userColOrder = JSON.parse(savedOrder); } catch(e) { window.userColOrder = []; } } else { window.userColOrder = []; }
    
    const savedHidden = localStorage.getItem(`col_hidden_rep_${currentTab}_${currentUser.username}`);
    if (savedHidden) { try { window.hiddenCols = JSON.parse(savedHidden); } catch(e) { window.hiddenCols = []; } } else { window.hiddenCols = []; }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        window.rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) sel.value = window.rowsPerPage;
    }
};

window.loadData = async function() {
    const tbody = document.getElementById('tbody-report');
    tbody.innerHTML = `<tr><td colspan="20" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    lucide.createIcons();

    try {
        if (currentTab === 'stbj' || currentTab === 'langsir') {
            const dStart = document.getElementById('date-start').value;
            const dEnd = document.getElementById('date-end').value;
            
            // Tambahkan waktu agar mencakup seluruh hari di dEnd
            const startISO = dStart ? new Date(dStart + 'T00:00:00Z').toISOString() : null;
            const endISO = dEnd ? new Date(dEnd + 'T23:59:59Z').toISOString() : null;

            let query = db.from('hasil_stbj_langsir').select('*');
            if (currentTab === 'langsir') query = query.eq('status', 'IN GUDANG');
            
            // Filter Tanggal
            if (startISO && endISO) {
                const dateCol = currentTab === 'stbj' ? 'created_at' : 'waktu_langsir';
                query = query.gte(dateCol, startISO).lte(dateCol, endISO);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if(error) throw error;
            rawData = data || [];
        } 
        else if (currentTab === 'stok' || currentTab === 'customer') {
            const [resAktual, resGlobal, resNonaktif] = await Promise.all([
                db.from('stok_aktual').select('*'),
                db.from('stok_global').select('*'),
                db.from('stok_nonaktif').select('*')
            ]);
            if(resAktual.error) throw resAktual.error;
            
            // LOGIKA PENGGABUNGAN KONVERSI:
            // Kita abaikan kolom 'konversi' saat grouping, sehingga item pecahan otomatis menyatu dengan induknya.
            let mergedAktual = [];
            let mapMerge = {};
            (resAktual.data || []).forEach(a => {
                let key = `${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.area}_${a.customer_aktual}_${a.customer_estimasi}_${a.keterangan}_${a.kondisi}`;
                if(!mapMerge[key]) {
                    mapMerge[key] = { ...a, qty: 0 };
                }
                mapMerge[key].qty += a.qty;
            });
            mergedAktual = Object.values(mapMerge);

            rawData = {
                aktual: mergedAktual,
                global: resGlobal.data || [],
                nonaktif: resNonaktif.data || []
            };
        }
        else if (currentTab === 'konversi') {
            const [resReq, resStok] = await Promise.all([
                db.from('request_konversi').select('*').order('created_at', { ascending: false }),
                db.from('stok_konversi').select('*').order('created_at', { ascending: false })
            ]);
            if(resReq.error) throw resReq.error;
            rawData = resReq.data || [];
            rawDataSecondary = resStok.data || [];
        }

        renderTable();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="20" class="p-10 text-center text-red-500 font-medium">Gagal: ${e.message}</td></tr>`;
    }
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const isHidden = window.hiddenCols.includes(colClass) ? 'col-hidden' : '';
    const noFilter = ['col-no'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} ${isHidden} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} ${isHidden} select-none group">
        <div class="flex items-center justify-between w-full min-w-max gap-4">
            <span class="cursor-pointer hover:text-blue-300 transition truncate flex-1 text-left" onclick="window.sortTable(${idx}, this.closest('th'))" title="Sort ${label}">${label}</span>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="window.sortTable(${idx}, this.closest('th'))" class="p-1 hover:bg-slate-700 rounded transition" title="Sort ${label}">
                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 sort-icon opacity-40 group-hover:opacity-100 transition-opacity text-white"></i>
                </button>
                <button onclick="window.openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-700 rounded transition" title="Filter ${label}">
                    <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
                </button>
            </div>
        </div>
    </th>`;
};

window.renderTable = function() {
    const thead = document.getElementById('thead-report');
    const tbody = document.getElementById('tbody-report');
    window.sortState = {}; 

    const rowClassBase = "transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200";
    let h = '';

    if (currentTab === 'stbj') {
        thead.innerHTML = `<tr>
            ${window.thSort(0, 'No', 'col-no w-12')}
            ${window.thSort(1, 'Waktu STBJ', 'col-waktu')}
            ${window.thSort(2, 'Troli', 'col-troli')}
            ${window.thSort(3, 'QRCode', 'col-qr')}
            ${window.thSort(4, 'Tgl Produksi', 'col-tgl')}
            ${window.thSort(5, 'Mesin', 'col-mesin')}
            ${window.thSort(6, 'Shift', 'col-shift')}
            ${window.thSort(7, 'Jenis Item', 'col-jenis')}
            ${window.thSort(8, 'Nama Item', 'col-nama')}
            ${window.thSort(9, 'Panjang', 'col-pjg')}
            ${window.thSort(10, 'Grade', 'col-grade')}
            ${window.thSort(11, 'Dus', 'col-dus')}
            ${window.thSort(12, 'Shading', 'col-shading')}
            ${window.thSort(13, 'Customer Aktual', 'col-cust')}
            ${window.thSort(14, 'Keterangan', 'col-ket')}
            ${window.thSort(15, 'PIC', 'col-pic')}
        </tr>`;

        h = rawData.map((r, i) => `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                <td class="px-4 py-3 text-slate-600 col-waktu ${window.hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${window.formatWIB(r.created_at)}">${window.formatWIB(r.created_at)}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-troli ${window.hiddenCols.includes('col-troli')?'col-hidden':''}" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                <td class="px-4 py-3 font-mono font-bold text-slate-900 col-qr ${window.hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                <td class="px-4 py-3 text-slate-600 col-tgl ${window.hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                <td class="px-4 py-3 text-slate-600 col-mesin ${window.hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                <td class="px-4 py-3 text-slate-600 col-shift ${window.hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-jenis ${window.hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-semibold text-orange-600 col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer || '-'}">${r.customer || '-'}</td>
                <td class="px-4 py-3 text-slate-500 col-ket ${window.hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                <td class="px-4 py-3 text-slate-400 col-pic ${window.hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
            </tr>`).join('');
    } 
    else if (currentTab === 'langsir') {
        thead.innerHTML = `<tr>
            ${window.thSort(0, 'No', 'col-no w-12')}
            ${window.thSort(1, 'Waktu Langsir', 'col-waktu')}
            ${window.thSort(2, 'Troli', 'col-troli')}
            ${window.thSort(3, 'Area', 'col-area')}
            ${window.thSort(4, 'QRCode', 'col-qr')}
            ${window.thSort(5, 'Tgl Produksi', 'col-tgl')}
            ${window.thSort(6, 'Mesin', 'col-mesin')}
            ${window.thSort(7, 'Shift', 'col-shift')}
            ${window.thSort(8, 'Jenis Item', 'col-jenis')}
            ${window.thSort(9, 'Nama Item', 'col-nama')}
            ${window.thSort(10, 'Panjang', 'col-pjg')}
            ${window.thSort(11, 'Grade', 'col-grade')}
            ${window.thSort(12, 'Dus', 'col-dus')}
            ${window.thSort(13, 'Shading', 'col-shading')}
            ${window.thSort(14, 'Customer Aktual', 'col-cust')}
            ${window.thSort(15, 'Keterangan', 'col-ket')}
            ${window.thSort(16, 'PIC', 'col-pic')}
        </tr>`;

        h = rawData.map((r, i) => `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                <td class="px-4 py-3 text-slate-600 col-waktu ${window.hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${window.formatWIB(r.waktu_langsir)}">${window.formatWIB(r.waktu_langsir)}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-troli ${window.hiddenCols.includes('col-troli')?'col-hidden':''}" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                <td class="px-4 py-3 font-bold text-emerald-600 col-area ${window.hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.posisi || '-'}">${r.posisi || '-'}</td>
                <td class="px-4 py-3 font-mono font-bold text-slate-900 col-qr ${window.hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                <td class="px-4 py-3 text-slate-600 col-tgl ${window.hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                <td class="px-4 py-3 text-slate-600 col-mesin ${window.hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                <td class="px-4 py-3 text-slate-600 col-shift ${window.hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-jenis ${window.hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 text-slate-700 col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-semibold text-orange-600 col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer || '-'}">${r.customer || '-'}</td>
                <td class="px-4 py-3 text-slate-500 col-ket ${window.hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                <td class="px-4 py-3 text-slate-400 col-pic ${window.hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
            </tr>`).join('');
    }
    else if (currentTab === 'stok') {
        const mode = document.getElementById('select-mode-stok').value;
        if (mode === 'area') {
            thead.innerHTML = `<tr>
                ${window.thSort(0, 'No', 'col-no w-12')}
                ${window.thSort(1, 'Area', 'col-area')}
                ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                ${window.thSort(3, 'Nama Item', 'col-nama')}
                ${window.thSort(4, 'Panjang', 'col-pjg')}
                ${window.thSort(5, 'Grade', 'col-grade')}
                ${window.thSort(6, 'Dus', 'col-dus')}
                ${window.thSort(7, 'Shading', 'col-shading')}
                ${window.thSort(8, 'Customer Aktual', 'col-cust')}
                ${window.thSort(9, 'Customer Estimasi', 'col-est text-purple-300')}
                ${window.thSort(10, 'Keterangan', 'col-ket')}
                ${window.thSort(11, 'Total Qty (Dus)', 'col-qty')}
            </tr>`;
            h = rawData.aktual.map((r, i) => `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                    <td class="px-4 py-3 font-bold text-slate-800 col-area ${window.hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.area}">${r.area}</td>
                    <td class="px-4 py-3 text-slate-700 col-jenis ${window.hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item}">${r.jenis_item}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item}">${r.nama_item}</td>
                    <td class="px-4 py-3 text-slate-700 col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 text-slate-700 col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 text-slate-700 col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 text-slate-700 col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-semibold text-slate-900 col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer_aktual}">${r.customer_aktual}</td>
                    <td class="px-4 py-3 font-semibold text-purple-700 col-est ${window.hiddenCols.includes('col-est')?'col-hidden':''}" data-search="${r.customer_estimasi}">${r.customer_estimasi}</td>
                    <td class="px-4 py-3 text-slate-500 col-ket ${window.hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan}">${r.keterangan}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty ${window.hiddenCols.includes('col-qty')?'col-hidden':''}" data-search="${r.qty}">${r.qty}</td>
                </tr>`).join('');
        } else if (mode === 'global') {
            let mapGlb = {};
            rawData.aktual.forEach(a => {
                let key = `${a.jenis_item}_${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.customer_aktual}_${a.customer_estimasi}_${a.keterangan}`;
                if(!mapGlb[key]) mapGlb[key] = { ...a, qty: 0 };
                mapGlb[key].qty += a.qty;
            });
            let dataGlb = Object.values(mapGlb);

            thead.innerHTML = `<tr>
                ${window.thSort(0, 'No', 'col-no w-12')}
                ${window.thSort(1, 'Jenis Item', 'col-jenis')}
                ${window.thSort(2, 'Nama Item', 'col-nama')}
                ${window.thSort(3, 'Panjang', 'col-pjg')}
                ${window.thSort(4, 'Grade', 'col-grade')}
                ${window.thSort(5, 'Dus', 'col-dus')}
                ${window.thSort(6, 'Shading', 'col-shading')}
                ${window.thSort(7, 'Customer Aktual', 'col-cust')}
                ${window.thSort(8, 'Customer Estimasi', 'col-est text-purple-300')}
                ${window.thSort(9, 'Keterangan', 'col-ket')}
                ${window.thSort(10, 'Total Qty (Dus)', 'col-qty')}
            </tr>`;
            h = dataGlb.map((r, i) => `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                    <td class="px-4 py-3 text-slate-700 col-jenis ${window.hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item}">${r.jenis_item}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item}">${r.nama_item}</td>
                    <td class="px-4 py-3 text-slate-700 col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 text-slate-700 col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 text-slate-700 col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 text-slate-700 col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-semibold text-slate-900 col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer_aktual}">${r.customer_aktual}</td>
                    <td class="px-4 py-3 font-semibold text-purple-700 col-est ${window.hiddenCols.includes('col-est')?'col-hidden':''}" data-search="${r.customer_estimasi}">${r.customer_estimasi}</td>
                    <td class="px-4 py-3 text-slate-500 col-ket ${window.hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan}">${r.keterangan}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty ${window.hiddenCols.includes('col-qty')?'col-hidden':''}" data-search="${r.qty}">${r.qty}</td>
                </tr>`).join('');
        } else if (mode === 'qr') {
            thead.innerHTML = `<tr>
                ${window.thSort(0, 'No', 'col-no w-12')}
                ${window.thSort(1, 'Area', 'col-area')}
                ${window.thSort(2, 'QRCode', 'col-qr')}
                ${window.thSort(3, 'Tgl Produksi', 'col-tgl')}
                ${window.thSort(4, 'Mesin', 'col-mesin')}
                ${window.thSort(5, 'Shift', 'col-shift')}
                ${window.thSort(6, 'Jenis Item', 'col-jenis')}
                ${window.thSort(7, 'Nama Item', 'col-nama')}
                ${window.thSort(8, 'Panjang', 'col-pjg')}
                ${window.thSort(9, 'Grade', 'col-grade')}
                ${window.thSort(10, 'Dus', 'col-dus')}
                ${window.thSort(11, 'Shading', 'col-shading')}
                ${window.thSort(12, 'Customer Aktual', 'col-cust')}
                ${window.thSort(13, 'Keterangan', 'col-ket')}
            </tr>`;
            h = rawData.global.map((r, i) => `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                    <td class="px-4 py-3 font-bold text-slate-800 col-area ${window.hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.area}">${r.area}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 col-qr ${window.hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 text-slate-600 col-tgl ${window.hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${r.tgl_produksi}">${r.tgl_produksi}</td>
                    <td class="px-4 py-3 text-slate-600 col-mesin ${window.hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 text-slate-600 col-shift ${window.hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 text-slate-700 col-jenis ${window.hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item}">${r.jenis_item}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item}">${r.nama_item}</td>
                    <td class="px-4 py-3 text-slate-700 col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang}">${r.panjang}</td>
                    <td class="px-4 py-3 text-slate-700 col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 text-slate-700 col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 text-slate-700 col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-semibold text-slate-900 col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer_aktual}">${r.customer_aktual}</td>
                    <td class="px-4 py-3 text-slate-500 col-ket ${window.hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan}">${r.keterangan}</td>
                </tr>`).join('');
        } else if (mode === 'nonaktif') {
            thead.innerHTML = `<tr>
                ${window.thSort(0, 'No', 'col-no w-12')}
                ${window.thSort(1, 'Waktu', 'col-waktu')}
                ${window.thSort(2, 'Area', 'col-area')}
                ${window.thSort(3, 'QRCode', 'col-qr')}
                ${window.thSort(4, 'Jenis Item', 'col-jenis')}
                ${window.thSort(5, 'Nama Item', 'col-nama')}
                ${window.thSort(6, 'Panjang', 'col-pjg')}
                ${window.thSort(7, 'Grade', 'col-grade')}
                ${window.thSort(8, 'Dus', 'col-dus')}
                ${window.thSort(9, 'Shading', 'col-shading')}
                ${window.thSort(10, 'Customer Aktual', 'col-cust')}
                ${window.thSort(11, 'Customer Estimasi', 'col-est')}
                ${window.thSort(12, 'Keterangan', 'col-ket')}
            </tr>`;
            h = rawData.nonaktif.map((r, i) => `
                <tr class="${rowClassBase} !bg-red-50 !text-red-900">
                    <td class="px-4 py-3 text-center font-bold text-red-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                    <td class="px-4 py-3 font-medium col-waktu ${window.hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${window.formatWIB(r.created_at)}">${window.formatWIB(r.created_at)}</td>
                    <td class="px-4 py-3 font-semibold col-area ${window.hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.posisi || '-'}">${r.posisi || '-'}</td>
                    <td class="px-4 py-3 font-mono font-bold col-qr ${window.hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-medium col-jenis ${window.hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                    <td class="px-4 py-3 font-semibold col-nama ${window.hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="px-4 py-3 font-medium col-pjg ${window.hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                    <td class="px-4 py-3 font-medium col-grade ${window.hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="px-4 py-3 font-medium col-dus ${window.hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="px-4 py-3 font-medium col-shading ${window.hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="px-4 py-3 font-semibold col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer_aktual || '-'}">${r.customer_aktual || '-'}</td>
                    <td class="px-4 py-3 font-semibold col-est ${window.hiddenCols.includes('col-est')?'col-hidden':''}" data-search="${r.customer_estimasi || '-'}">${r.customer_estimasi || '-'}</td>
                    <td class="px-4 py-3 font-medium col-ket ${window.hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                </tr>`).join('');
        }
    }
    else if (currentTab === 'customer') {
        thead.innerHTML = `<tr>
            ${window.thSort(0, 'No', 'col-no w-12')}
            ${window.thSort(1, 'Customer Aktual', 'col-cust')}
            ${window.thSort(2, 'Total Qty (Dus)', 'col-qty')}
        </tr>`;

        let mapCust = {};
        rawData.aktual.forEach(a => {
            let c = a.customer_aktual || 'KOSONG / FREE STOCK';
            if(!mapCust[c]) mapCust[c] = 0;
            mapCust[c] += a.qty;
        });
        let dataCust = Object.keys(mapCust).map(k => ({ customer: k, qty: mapCust[k] })).sort((a,b) => b.qty - a.qty);

        h = dataCust.map((r, i) => `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                <td class="px-4 py-3 font-black text-slate-800 col-cust ${window.hiddenCols.includes('col-cust')?'col-hidden':''}" data-search="${r.customer}">${r.customer}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty ${window.hiddenCols.includes('col-qty')?'col-hidden':''}" data-search="${r.qty}">${r.qty}</td>
            </tr>`).join('');
    }
    else if (currentTab === 'konversi') {
        thead.innerHTML = `<tr>
            ${window.thSort(0, 'No', 'col-no w-12')}
            ${window.thSort(1, 'Kode Konversi', 'col-kode')}
            ${window.thSort(2, 'Tgl Request', 'col-tgl')}
            ${window.thSort(3, 'Nama Item Asal', 'col-asal')}
            ${window.thSort(4, 'Nama Item Req', 'col-req')}
            ${window.thSort(5, 'Qty Req', 'col-qty_req')}
            ${window.thSort(6, 'Qty Hasil', 'col-qty_hasil')}
            ${window.thSort(7, 'Qty Out', 'col-qty_out')}
            ${window.thSort(8, 'Qty In', 'col-qty_in')}
            ${window.thSort(9, 'Progres', 'col-progres')}
            ${window.thSort(10, 'PIC', 'col-pic')}
        </tr>`;

        h = rawData.map((r, i) => `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${window.hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                <td class="px-4 py-3 font-black text-slate-800 col-kode ${window.hiddenCols.includes('col-kode')?'col-hidden':''}" data-search="${r.kode_konversi}">${r.kode_konversi}</td>
                <td class="px-4 py-3 text-slate-600 col-tgl ${window.hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${window.formatWIB(r.created_at)}">${window.formatWIB(r.created_at)}</td>
                <td class="px-4 py-3 font-semibold text-slate-700 col-asal ${window.hiddenCols.includes('col-asal')?'col-hidden':''}" data-search="${r.nama_item}">${r.nama_item}</td>
                <td class="px-4 py-3 font-semibold text-blue-700 col-req ${window.hiddenCols.includes('col-req')?'col-hidden':''}" data-search="${r.nama_item_req}">${r.nama_item_req}</td>
                <td class="px-4 py-3 font-black text-slate-700 text-center col-qty_req ${window.hiddenCols.includes('col-qty_req')?'col-hidden':''}" data-search="${r.qty_req}">${r.qty_req}</td>
                <td class="px-4 py-3 font-black text-indigo-600 text-center col-qty_hasil ${window.hiddenCols.includes('col-qty_hasil')?'col-hidden':''}" data-search="${r.qty_hasil}">${r.qty_hasil}</td>
                <td class="px-4 py-3 font-black text-rose-600 text-center col-qty_out ${window.hiddenCols.includes('col-qty_out')?'col-hidden':''}" data-search="${r.qty_out}">${r.qty_out}</td>
                <td class="px-4 py-3 font-black text-emerald-600 text-center col-qty_in ${window.hiddenCols.includes('col-qty_in')?'col-hidden':''}" data-search="${r.qty_in}">${r.qty_in}</td>
                <td class="px-4 py-3 text-center font-bold col-progres ${window.hiddenCols.includes('col-progres')?'col-hidden':''}" data-search="${r.progres_konversi}">${r.progres_konversi}</td>
                <td class="px-4 py-3 text-slate-500 col-pic ${window.hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_request}">${r.pic_request}</td>
            </tr>`).join('');
    }

    if(h === '') {
        tbody.innerHTML = `<tr><td colspan="20" class="p-10 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`;
    } else {
        tbody.innerHTML = h;
    }

    window.applyColumnOrder();
    lucide.createIcons();
    window.saringTabelExcel();
    window.initResizableColumns();
};

// ==========================================
// SORT & FILTER EXCEL PRO
// ==========================================
window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-report');
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
    window.applyPagination();
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-report tr.r-row').forEach(row => {
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
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    sortedValues.forEach(val => {
        let isChecked = true; if (activeFilters[colClass] && !activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}"><input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> <span class="truncate text-slate-600">${val}</span></label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; window.updateSelectAllState(); document.getElementById('filter-search-input').value = '';
    const menu = document.getElementById('excel-filter-menu'); menu.classList.remove('hidden');
    const btnRect = event.currentTarget.getBoundingClientRect(); const menuWidth = 256; 
    let topPos = btnRect.bottom + 4; let leftPos = btnRect.left; 
    if (leftPos + menuWidth > window.innerWidth) { leftPos = btnRect.right - menuWidth; }
    if (leftPos < 10) { leftPos = 10; }
    menu.style.position = 'fixed'; menu.style.top = `${topPos}px`; menu.style.left = `${leftPos}px`;
    document.getElementById('filter-search-input').focus();
};

window.toggleAllFilterValues = function(checked) { document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; }); window.updateSelectAllState(); };
window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked'); const selectAll = document.getElementById('filter-select-all');
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
        let matches = query.every(term => text.includes(term)); label.style.display = matches ? '' : 'none';
    });
};
window.closeFilterMenu = function() { document.getElementById('excel-filter-menu').classList.add('hidden'); };
window.clearFilterForCurrentCol = function() { delete activeFilters[currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); activeFilters[currentFilterCol] = selectedVals; }
    window.closeFilterMenu(); window.saringTabelExcel(); 
};
window.saringTabelExcel = function() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowedValues = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); }
    });
    currentPage = 1; window.applyPagination(); window.updateFilterIcons();
};
window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};

// ==========================================
// PAGINASI
// ==========================================
window.changeRowsPerPage = function(val) {
    if (val === 'ALL') { rowsPerPage = 999999; } else { rowsPerPage = parseInt(val); }
    localStorage.setItem('wms_rows_per_page', rowsPerPage); currentPage = 1; window.applyPagination();
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-report tr.r-row'));
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
        if(qtyCell) { sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; } 
        else { sumQty += 1; }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; window.applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-report tr.r-row:not(.filtered-out)').length; if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; window.applyPagination(); } };

// ==========================================
// ATUR KOLOM (DRAG & DROP + HIDE)
// ==========================================
window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); window.renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-report th'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; 
        const label = th.innerText.trim() || 'Kolom';
        if(!colClass) return;

        const isHidden = window.hiddenCols.includes(colClass);
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
    lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = window.getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
};

window.toggleHideCol = function(e, colClass) {
    e.stopPropagation();
    if(window.hiddenCols.includes(colClass)) {
        window.hiddenCols = window.hiddenCols.filter(c => c !== colClass);
    } else {
        window.hiddenCols.push(colClass);
    }
    window.renderDragList();
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item'); let newOrder = []; items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    window.userColOrder = newOrder; 
    localStorage.setItem(`col_order_rep_${currentTab}_${currentUser.username}`, JSON.stringify(newOrder));
    localStorage.setItem(`col_hidden_rep_${currentTab}_${currentUser.username}`, JSON.stringify(window.hiddenCols));
    alert("Pengaturan kolom berhasil disimpan!"); window.toggleSidebarKolom(); window.renderTable(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan pengaturan kolom ke default?")) return;
    window.userColOrder = []; window.hiddenCols = [];
    localStorage.removeItem(`col_order_rep_${currentTab}_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_rep_${currentTab}_${currentUser.username}`);
    alert("Pengaturan dikembalikan ke default."); window.toggleSidebarKolom(); window.renderTable();
};

window.applyColumnOrder = function() {
    if (!window.userColOrder || window.userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; 
        window.userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (!window.userColOrder.includes(colClass)) { row.appendChild(c); } });
    });
};

window.initResizableColumns = function() {
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
};

// ==========================================
// EXPORT EXCEL
// ==========================================
window.exportExcel = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat.");
    
    if (currentTab === 'stok') {
        document.getElementById('modal-export-stok').classList.remove('hidden');
        document.getElementById('overlay-klik-luar').classList.remove('hidden');
    } else if (currentTab === 'konversi') {
        exportKonversiExcel();
    } else {
        exportStandardExcel();
    }
};

function exportStandardExcel() {
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-report th'))
        .filter(th => !th.classList.contains('col-hidden') && window.getComputedStyle(th).display !== 'none')
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);

    document.querySelectorAll('#tbody-report tr.r-row').forEach(tr => {
        if(tr.style.display !== 'none') {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(!td.classList.contains('col-hidden') && window.getComputedStyle(td).display !== 'none') { 
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); 
                    rowData.push(val); 
                }
            });
            ws_data.push(rowData);
        }
    });

    if(ws_data.length <= 1) return alert("Tidak ada data untuk di-export!");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); let wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, currentTab.toUpperCase()); 
    XLSX.writeFile(wb, `Laporan_${currentTab.toUpperCase()}_${getTodayDate()}.xlsx`);
}

window.eksekusiExportStok = function() {
    const expArea = document.getElementById('exp-area').checked;
    const expGlobal = document.getElementById('exp-global').checked;
    const expQr = document.getElementById('exp-qr').checked;
    const expNonaktif = document.getElementById('exp-nonaktif').checked;
    const expCust = document.getElementById('exp-cust').checked;

    if(!expArea && !expGlobal && !expQr && !expNonaktif && !expCust) return alert("Pilih minimal 1 sheet!");

    let wb = XLSX.utils.book_new();

    if (expArea) {
        let ws_data = [['Area', 'Jenis Item', 'Nama Item', 'Panjang', 'Grade', 'Dus', 'Shading', 'Customer Aktual', 'Customer Estimasi', 'Keterangan', 'Total Qty (Dus)']];
        rawData.aktual.forEach(r => {
            ws_data.push([r.area, r.jenis_item, r.nama_item, r.panjang, r.grade, r.dus, r.shading, r.customer_aktual, r.customer_estimasi, r.keterangan, r.qty]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "KS Area");
    }

    if (expGlobal) {
        let mapGlb = {};
        rawData.aktual.forEach(a => {
            let key = `${a.jenis_item}_${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.customer_aktual}_${a.customer_estimasi}_${a.keterangan}`;
            if(!mapGlb[key]) mapGlb[key] = { ...a, qty: 0 };
            mapGlb[key].qty += a.qty;
        });
        let ws_data = [['Jenis Item', 'Nama Item', 'Panjang', 'Grade', 'Dus', 'Shading', 'Customer Aktual', 'Customer Estimasi', 'Keterangan', 'Total Qty (Dus)']];
        Object.values(mapGlb).forEach(r => {
            ws_data.push([r.jenis_item, r.nama_item, r.panjang, r.grade, r.dus, r.shading, r.customer_aktual, r.customer_estimasi, r.keterangan, r.qty]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "KS Global");
    }

    if (expQr) {
        let ws_data = [['Area', 'QRCode', 'Tgl Produksi', 'Mesin', 'Shift', 'Jenis Item', 'Nama Item', 'Panjang', 'Grade', 'Dus', 'Shading', 'Customer Aktual', 'Keterangan']];
        rawData.global.forEach(r => {
            ws_data.push([r.area, r.qrcode, r.tgl_produksi, r.mesin, r.shift, r.jenis_item, r.nama_item, r.panjang, r.grade, r.dus, r.shading, r.customer_aktual, r.keterangan]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "KS QR Code");
    }

    if (expNonaktif) {
        let ws_data = [['Waktu', 'Area', 'QRCode', 'Jenis Item', 'Nama Item', 'Panjang', 'Grade', 'Dus', 'Shading', 'Customer Aktual', 'Customer Estimasi', 'Keterangan']];
        rawData.nonaktif.forEach(r => {
            ws_data.push([formatWIB(r.created_at), r.posisi, r.qrcode, r.jenis_item, r.nama_item, r.panjang, r.grade, r.dus, r.shading, r.customer_aktual, r.customer_estimasi, r.keterangan]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "Stok Nonaktif");
    }

    if (expCust) {
        let mapCust = {};
        rawData.aktual.forEach(a => {
            let c = a.customer_aktual || 'KOSONG / FREE STOCK';
            if(!mapCust[c]) mapCust[c] = 0;
            mapCust[c] += a.qty;
        });
        let ws_data = [['Customer Aktual', 'Total Qty (Dus)']];
        Object.keys(mapCust).sort().forEach(k => {
            ws_data.push([k, mapCust[k]]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "Customer & Freestock");
    }

    XLSX.writeFile(wb, `Laporan_Stok_${getTodayDate()}.xlsx`);
    window.tutupSemuaPopups();
};

function exportKonversiExcel() {
    let wb = XLSX.utils.book_new();

    // Sheet 1: Request Konversi (DOM based for filters)
    let ws_req = [];
    const headers = Array.from(document.querySelectorAll('#thead-report th'))
        .filter(th => !th.classList.contains('col-hidden') && window.getComputedStyle(th).display !== 'none')
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_req.push(headers);

    document.querySelectorAll('#tbody-report tr.r-row').forEach(tr => {
        if(tr.style.display !== 'none') {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(!td.classList.contains('col-hidden') && window.getComputedStyle(td).display !== 'none') { 
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); 
                    rowData.push(val); 
                }
            });
            ws_req.push(rowData);
        }
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_req), "Request Konversi");

    // Sheet 2: Daftar Konversi (Raw Data Secondary)
    let ws_stok = [['Waktu', 'Kode Konversi', 'Aktifitas', 'QRCode', 'Nama Item', 'Panjang', 'Grade', 'Dus', 'Shading', 'Customer', 'Area', 'PIC', 'Status']];
    rawDataSecondary.forEach(r => {
        ws_stok.push([formatWIB(r.created_at), r.kode_konversi, r.aktifitas, r.qrcode, r.nama_item, r.panjang, r.grade, r.dus, r.shading, r.customer_aktual, r.area, r.pic, r.status]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_stok), "Daftar Konversi");

    XLSX.writeFile(wb, `Laporan_Konversi_${getTodayDate()}.xlsx`);
}
