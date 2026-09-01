let modeRiwayat = 'qr'; 
let logLangsirRaw = []; 
let holdLangsirRaw = [];
let kamusData = []; 
let areaData = []; 
let sortState = {}; 

let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 
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

// ==========================================
// CUSTOM ALERT & NOTIFICATION SYSTEM
// ==========================================
window.tampilkanAlert = function(pesan, tipe = 'info') {
    const modal = document.getElementById('modal-custom-alert');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const iconContainer = document.getElementById('alert-icon-container');
    const icon = document.getElementById('alert-icon');

    if(!modal) { alert(pesan); return; } // Fallback

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

function loadUserPreferences() {
    const savedOrder = localStorage.getItem(`col_order_rlangsir_${modeRiwayat}_${currentUser.username}`);
    if (savedOrder) { try { userColOrder = JSON.parse(savedOrder); } catch(e) { userColOrder = []; } } 
    else { userColOrder = []; }
    
    const savedHidden = localStorage.getItem(`col_hidden_rlangsir_${modeRiwayat}_${currentUser.username}`);
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
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    
    const tabsData = [
        { id: 'tab-r-qr', label: 'Detail QRCode', icon: 'list', onClick: "gantiModeRiwayat('qr')" },
        { id: 'tab-r-agregasi', label: 'Rangkuman Item & Qty', icon: 'bar-chart-2', onClick: "gantiModeRiwayat('agregasi')" },
        { id: 'tab-r-hold', label: 'Tabel Hold', icon: 'pause-circle', onClick: "gantiModeRiwayat('hold')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-r-qr');
    }
    
    if (typeof window.renderTableFooter === 'function') {
        window.renderTableFooter('container-footer', 'Total Qty (Dus)');
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
    });

    setTimeout(async () => {
        const { data: mk } = await db.from('master_2').select('*'); 
        if(mk) {
            kamusData = mk;
            window.masterData = { kamus: mk }; 
        }
        
        const { data: ma } = await db.from('master_area').select('nama_area'); 
        if(ma) {
            areaData = ma.map(m => m.nama_area);
            const selArea = document.getElementById('select-new-area');
            if(selArea) {
                selArea.innerHTML = '<option value="">-- PILIH AREA --</option>';
                areaData.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }
        await ambilSemuaData();
        gantiModeRiwayat('qr');
    }, 200);
});

window.tutupModalArea = function() { document.getElementById('modal-ganti-area').classList.add('hidden'); };
window.tutupModalSTBJ = function() { document.getElementById('modal-stbj-langsir').classList.add('hidden'); };
window.tutupModalHold = function() { document.getElementById('modal-hold-langsir').classList.add('hidden'); };
window.tutupSemuaPopup = function() { 
    window.tutupModalArea(); window.tutupModalSTBJ(); window.tutupModalHold(); 
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    const sidebarK = document.getElementById('sidebar-kolom');
    if(sidebarK) sidebarK.classList.add('translate-x-full');
    closeFilterMenu();
};

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

async function ambilSemuaData() {
    const tbody = document.getElementById('tbody-riwayat');
    if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    lucide.createIcons();

    try {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await db.from('hasil_stbj_langsir')
                .select('*')
                .in('status', ['IN GUDANG', 'HOLD LANGSIR'])
                .order('waktu_langsir', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;
            allData.push(...data);
            if (data.length < pageSize) break;
            page++;
        }

        logLangsirRaw = allData.filter(r => r.status === 'IN GUDANG');
        holdLangsirRaw = allData.filter(r => r.status === 'HOLD LANGSIR');

        renderTabelRiwayat();
    } catch(e) { 
        if(tbody) tbody.innerHTML = `<tr><td colspan="19" class="p-10 text-center text-red-500 font-medium">Error: ${e.message}</td></tr>`; 
    }
}

window.gantiModeRiwayat = function(m) {
    modeRiwayat = m;
    
    const tabsData = [
        { id: 'tab-r-qr', label: 'Detail QRCode', icon: 'list', onClick: "gantiModeRiwayat('qr')" },
        { id: 'tab-r-agregasi', label: 'Rangkuman Item & Qty', icon: 'bar-chart-2', onClick: "gantiModeRiwayat('agregasi')" },
        { id: 'tab-r-hold', label: 'Tabel Hold', icon: 'pause-circle', onClick: "gantiModeRiwayat('hold')" }
    ];
    if (typeof window.renderSubmenuTabs === 'function') {
        window.renderSubmenuTabs('container-submenu', tabsData, 'tab-r-' + m);
    }
    
    const btnGA = document.getElementById('btn-ganti-area'); if(btnGA) btnGA.classList.toggle('hidden', m !== 'qr');
    const btnCL = document.getElementById('btn-cancel-langsir'); if(btnCL) btnCL.classList.toggle('hidden', m !== 'qr');
    const btnCLMob = document.getElementById('btn-cancel-langsir-mob'); if(btnCLMob) btnCLMob.classList.toggle('hidden', m !== 'qr');
    
    const userRole = (currentUser.role || '').toLowerCase();
    const showHapus = (m === 'hold' && ['creator', 'admin', 'pic area'].includes(userRole));
    const btnHH = document.getElementById('btn-hapus-hold'); if(btnHH) btnHH.classList.toggle('hidden', !showHapus);
    const btnHHMob = document.getElementById('btn-hapus-hold-mob'); if(btnHHMob) btnHHMob.classList.toggle('hidden', !showHapus);

    activeFilters = {}; 
    sortState = { col: null, isAsc: true };
    selectAllState = 0;
    currentPage = 1;

    loadUserPreferences();
    renderTabelRiwayat();
};

function sortTable(colClass, headerEl) {
    const tbody = document.getElementById('tbody-riwayat');
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

window.renderTabelRiwayat = function() {
    const thead = document.getElementById('thead-riwayat'); 
    const tbody = document.getElementById('tbody-riwayat');
    if(!thead || !tbody) return;

    const rowClassBase = "transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200";

    if(modeRiwayat === 'qr' || modeRiwayat === 'hold') {
        const isHold = modeRiwayat === 'hold'; 
        const dataset = isHold ? holdLangsirRaw : logLangsirRaw;
        
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('No', 'col-no w-12')}
                ${thSort('Waktu Langsir', 'col-waktu')}
                ${thSort('Troli', 'col-troli')}
                ${thSort('Area', 'col-area')}
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
                ${thSort('Customer Bawaan', 'col-customer')}
                ${thSort('Keterangan', 'col-ket')}
                ${thSort('PIC', 'col-pic')}
            </tr>`;
        
        if(!dataset || dataset.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="18" class="p-8 text-center font-medium text-slate-400">Tidak ada data.</td></tr>`; 
            applyPagination(); 
            return; 
        }
        
        let h = '';
        dataset.forEach((r, i) => {
            const tgl = formatWIB(r.waktu_langsir || r.created_at);
            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this)" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-400 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                    <td class="px-4 py-3 text-slate-600 font-medium text-left col-waktu ${hiddenCols.includes('col-waktu')?'col-hidden':''}" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-troli ${hiddenCols.includes('col-troli')?'col-hidden':''}" data-search="${r.troli || '-'}">${r.troli || '-'}</td>
                    <td class="px-4 py-3 text-left col-area ${hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.posisi || '-'}"><span class="text-emerald-600 font-bold">${r.posisi || '-'}</span></td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 tracking-wider text-left col-qr ${hiddenCols.includes('col-qr')?'col-hidden':''}" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-tgl ${hiddenCols.includes('col-tgl')?'col-hidden':''}" data-search="${r.tgl_produksi || '-'}">${r.tgl_produksi || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-mesin ${hiddenCols.includes('col-mesin')?'col-hidden':''}" data-search="${r.mesin || '-'}">${r.mesin || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-left col-shift ${hiddenCols.includes('col-shift')?'col-hidden':''}" data-search="${r.shift || '-'}">${r.shift || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis_item || '-'}">${r.jenis_item || '-'}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.panjang || '-'}">${r.panjang || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="px-4 py-3 font-semibold text-orange-600 text-left col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}" data-search="${r.customer || '-'}">${r.customer || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket ${hiddenCols.includes('col-ket')?'col-hidden':''}" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                    <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic ${hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic_input || '-'}">${r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if(modeRiwayat === 'agregasi') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${thSort('No', 'col-no w-12')}
                ${thSort('Area', 'col-area')}
                ${thSort('Jenis Item', 'col-jenis')}
                ${thSort('Nama Item', 'col-nama')}
                ${thSort('Panjang', 'col-pjg')}
                ${thSort('Grade', 'col-grade')}
                ${thSort('Dus', 'col-dus')}
                ${thSort('Shading', 'col-shading')}
                ${thSort('Customer Bawaan', 'col-customer')}
                ${thSort('PIC', 'col-pic')}
                ${thSort('QTY TOTAL (DUS)', 'col-qty text-emerald-300')}
            </tr>`;

        let groups = {};
        logLangsirRaw.forEach(r => {
            let key = `${r.posisi}_${r.jenis_item}_${r.nama_item}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.customer}_${r.pic_input}`;
            if(!groups[key]) groups[key] = { area: r.posisi, jenis: r.jenis_item, nama: r.nama_item, pjg: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, customer: r.customer, pic: r.pic_input, qty: 0 };
            groups[key].qty++;
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { 
            tbody.innerHTML = `<tr><td colspan="12" class="p-8 text-center font-medium text-slate-400">Kosong.</td></tr>`; 
            applyPagination(); 
            return; 
        }

        let h = '';
        arr.forEach((r, i) => {
            h += `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="highlightRow(this)" value="agg" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-400 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 text-center font-bold text-slate-400 col-no ${hiddenCols.includes('col-no')?'col-hidden':''}">${i+1}</td>
                    <td class="px-4 py-3 text-left col-area ${hiddenCols.includes('col-area')?'col-hidden':''}" data-search="${r.area}"><span class="text-emerald-600 font-bold">${r.area}</span></td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis ${hiddenCols.includes('col-jenis')?'col-hidden':''}" data-search="${r.jenis}">${r.jenis}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 text-left col-nama ${hiddenCols.includes('col-nama')?'col-hidden':''}" data-search="${r.nama}">${r.nama}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg ${hiddenCols.includes('col-pjg')?'col-hidden':''}" data-search="${r.pjg}">${r.pjg}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade ${hiddenCols.includes('col-grade')?'col-hidden':''}" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus ${hiddenCols.includes('col-dus')?'col-hidden':''}" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading ${hiddenCols.includes('col-shading')?'col-hidden':''}" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-semibold text-orange-600 text-left col-customer ${hiddenCols.includes('col-customer')?'col-hidden':''}" data-search="${r.customer}">${r.customer}</td>
                    <td class="px-4 py-3 font-medium uppercase text-xs text-slate-400 text-left col-pic ${hiddenCols.includes('col-pic')?'col-hidden':''}" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty ${hiddenCols.includes('col-qty')?'col-hidden':''}" data-search="${r.qty}">${r.qty}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    
    applyColumnOrder();
    lucide.createIcons(); 
    updateSelectAllUI();
    saringTabelExcel();
    initResizableColumns();
};

window.openColumnFilter = function(event, colClass, colName) {
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

    let listHtml = `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 cursor-pointer rounded-lg transition"><input type="checkbox" id="filter-select-all" checked onchange="toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-bold text-slate-800">(Pilih Semua)</span></label>`;
    
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
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; highlightRow(cb, true); } }
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
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    if (selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
    } else if (selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
            if(cb) { cb.checked = false; highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.cb-row');
                if(cb) { cb.checked = true; highlightRow(cb, true); }
            }
        });
    } else if (selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.cb-row');
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
    const totalVisible = document.querySelectorAll('#tbody-riwayat tr.r-row:not(.filtered-out)').length;
    const totalPages = Math.ceil(totalVisible / rowsPerPage) || 1;
    if (isNaN(p) || p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    
    currentPage = p;
    const inp = document.getElementById('input-page-jump');
    if(inp) inp.value = currentPage;
    applyPagination();
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-riwayat tr.r-row'));
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
        if (qtyCell && modeRiwayat === 'agregasi') { 
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
    const totalVisible = document.querySelectorAll('#tbody-riwayat tr.r-row:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
};

window.updateSelectedCount = function() {
    const count = document.querySelectorAll('.cb-row:checked').length;
    if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count;
};

window.bukaModalGantiArea = function() {
    if(modeRiwayat !== 'qr') return tampilkanAlert("Hanya bisa dilakukan di mode DETAIL QRCODE.", "warning");
    const cek = document.querySelectorAll('.cb-row:checked'); 
    if(cek.length === 0) return tampilkanAlert("Pilih baris terlebih dahulu!", "warning");
    
    document.getElementById('teks-info-area').innerText = `Anda akan memindahkan ${cek.length} kardus ke lokasi baru.`;
    document.getElementById('select-new-area').value = ''; 
    document.getElementById('modal-ganti-area').classList.remove('hidden');
};

window.eksekusiGantiArea = async function() {
    const newArea = document.getElementById('select-new-area').value; 
    if(!newArea) return tampilkanAlert("Pilih Area Tujuan!", "warning");
    
    const btn = document.getElementById('btn-eks-area'); 
    let original = btn ? btn.innerHTML : 'Simpan';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true; }

    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); 
    const qrsToUpdate = Array.from(checkedBoxes).map(cb => cb.value);
    
    try {
        let mapDeduct = {};
        let mapAdd = {};
        
        for(let qr of qrsToUpdate) {
            let dbRow = logLangsirRaw.find(r => r.qrcode === qr);
            if(dbRow) {
                const oldArea = dbRow.posisi || '-';
                
                let id_sku_old = `${oldArea}_${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${dbRow.keterangan || '-'}_${dbRow.customer}_Aman`;
                let id_sku_baru = `${newArea}_${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${dbRow.keterangan || '-'}_${dbRow.customer}_Aman`;
                
                await db.from('stok_qr').update({ area: newArea, id_sku: id_sku_baru }).eq('qrcode', qr);
                await db.from('stok_global').update({ area: newArea, id_sku: id_sku_baru }).eq('qrcode', qr);
                await db.from('hasil_stbj_langsir').update({ posisi: newArea }).eq('qrcode', qr);
                
                let keyOld = `${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${oldArea}_${dbRow.customer}_${dbRow.keterangan || '-'}`;
                if(!mapDeduct[keyOld]) mapDeduct[keyOld] = { nama_item: dbRow.nama_item, pjg: dbRow.panjang, grade: dbRow.grade, dus: dbRow.dus, shading: dbRow.shading, area: oldArea, customer_aktual: dbRow.customer, keterangan: dbRow.keterangan || '-', qty: 0 };
                mapDeduct[keyOld].qty++;

                let keyNew = `${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${newArea}_${dbRow.customer}_${dbRow.keterangan || '-'}`;
                if(!mapAdd[keyNew]) mapAdd[keyNew] = { id_sku: id_sku_baru, jenis_item: dbRow.jenis_item, nama_item: dbRow.nama_item, panjang: dbRow.panjang, grade: dbRow.grade, dus: dbRow.dus, shading: dbRow.shading, area: newArea, customer_bawaan: dbRow.customer, customer_aktual: dbRow.customer, keterangan: dbRow.keterangan || '-', qty: 0 };
                mapAdd[keyNew].qty++;
            }
        }

        for(let key in mapDeduct) {
            let item = mapDeduct[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.pjg).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).eq('keterangan', item.keterangan).limit(1);
            
            if(existing && existing.length > 0) {
                let newQty = existing[0].qty - item.qty;
                if (newQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', existing[0].id);
                } else {
                    await db.from('stok_aktual').update({ qty: newQty }).eq('id', existing[0].id);
                }
            }
        }

        for(let key in mapAdd) {
            let item = mapAdd[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).eq('keterangan', item.keterangan).limit(1);
            
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + item.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([item]);
            }
        }

        tutupModalArea();
        tampilkanAlert(`${qrsToUpdate.length} item berhasil dipindahkan ke area "${newArea}".`, "success");
        await ambilSemuaData();
    } catch (error) {
        tampilkanAlert("Gagal memindahkan area: " + error.message, "error");
    } finally {
        if(btn) { btn.innerHTML = original; btn.disabled = false; }
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.cancelLangsir = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); 
    if(checkedBoxes.length === 0) return tampilkanAlert("Centang minimal 1 baris!", "warning");
    
    if(!confirm(`Batal Langsir untuk ${checkedBoxes.length} kardus ini?\nData akan dihapus dari gudang (stok_global & stok_aktual) dan statusnya di hasil_stbj_langsir dikembalikan ke 'HOLD LANGSIR'.`)) return;
    
    const btn = document.getElementById('btn-cancel-langsir'); 
    const ori = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Proses...'; btn.disabled = true; }

    let arrFisik = []; 
    let mapDeduct = {};
    const wibNow = getWIBTimestamp();
    
    checkedBoxes.forEach(cb => {
        const qr = cb.value; 
        const r = logLangsirRaw.find(x => x.qrcode === qr);
        if(r) {
            arrFisik.push(qr);

            let keyAkt = `${r.nama_item}_${r.panjang}_${r.grade}_${r.dus}_${r.shading}_${r.posisi}_${r.customer}_${r.keterangan || '-'}`;
            if(!mapDeduct[keyAkt]) mapDeduct[keyAkt] = { nama_item: r.nama_item, pjg: r.panjang, grade: r.grade, dus: r.dus, shading: r.shading, area: r.posisi, customer_aktual: r.customer, keterangan: r.keterangan || '-', qty: 0 };
            mapDeduct[keyAkt].qty++;
        }
    });

    try {
        const { error: errStok } = await db.from('stok_qr').delete().in('qrcode', arrFisik);
        if(errStok) throw errStok;

        const { error: errGlobal } = await db.from('stok_global').delete().in('qrcode', arrFisik);
        if(errGlobal) throw errGlobal;

        const { error: errHasil } = await db.from('hasil_stbj_langsir')
            .update({ status: 'HOLD LANGSIR', keterangan: 'Cancel Langsir', waktu_langsir: wibNow })
            .in('qrcode', arrFisik);
        if(errHasil) throw errHasil;

        for(let key in mapDeduct) {
            let item = mapDeduct[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.pjg).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).eq('keterangan', item.keterangan).limit(1);
            
            if(existing && existing.length > 0) {
                let newQty = existing[0].qty - item.qty;
                if (newQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', existing[0].id);
                } else {
                    await db.from('stok_aktual').update({ qty: newQty }).eq('id', existing[0].id);
                }
            }
        }
        
        await ambilSemuaData();
        tampilkanAlert(`${arrFisik.length} item berhasil di-cancel dan dikembalikan ke 'HOLD LANGSIR'.`, "success");
    } catch (e) { 
        tampilkanAlert("Gagal Cancel Langsir: " + e.message, "error"); 
    } finally { 
        if(btn) { btn.innerHTML = ori; btn.disabled = false; } 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
    }
};

window.hapusBarisHold = async function() {
    const checked = document.querySelectorAll('.cb-row:checked'); 
    if(checked.length === 0) return tampilkanAlert("Pilih baris!", "warning");
    
    if(!confirm("Hapus permanen data hold ini dari database?")) return;
    
    try {
        const { error } = await db.from('hasil_stbj_langsir').delete().in('qrcode', Array.from(checked).map(cb => cb.value));
        if (error) throw error;
        await ambilSemuaData();
        tampilkanAlert("Berhasil menghapus data hold.", "success");
    } catch(e) { tampilkanAlert("Gagal: " + e.message, "error"); }
};

window.salinDataTabel = function() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return tampilkanAlert("Pilih data yang ingin disalin dengan mencentang kotak di kiri data!", "warning");

    let copyString = "";
    if (modeRiwayat === 'agregasi') {
        copyString = "Area\tJenis Item\tNama Item\tPjg\tGrade\tDus\tShading\tCustomer Bawaan\tPIC\tQTY\n";
        cek.forEach(cb => {
            const tr = cb.closest('tr');
            copyString += `${tr.querySelector('.col-area').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-jenis').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-nama').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-pjg').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-grade').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-dus').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-shading').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-customer').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-pic').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\t${tr.querySelector('.col-qty').innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()}\n`;
        });
    } else {
        copyString = "Waktu Langsir\tTroli\tArea\tQRCode\tTgl Produksi\tMesin\tShift\tNama Item\tPjg\tGrade\tDus\tShading\tCustomer\tKeterangan\tPIC\n";
        cek.forEach(cb => {
            const tr = cb.closest('tr');
            copyString += `${tr.querySelector('.col-waktu')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-troli')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-area')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-qr')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-tgl')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-mesin')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-shift')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-nama')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-pjg')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-grade')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-dus')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-shading')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-customer')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-ket')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\t${tr.querySelector('.col-pic')?.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim() || '-'}\n`;
        });
    }

    navigator.clipboard.writeText(copyString).then(() => {
        tampilkanAlert("Berhasil menyalin data!", "success");
    }).catch(err => { tampilkanAlert("Browser menolak akses Clipboard. Silakan salin manual.", "error"); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return tampilkanAlert("Library Excel belum termuat, pastikan ada koneksi internet.", "error");
    
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-riwayat th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);

    document.querySelectorAll('.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-row:checked')) {
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
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat_Langsir");
    XLSX.writeFile(wb, `Riwayat_Langsir_${modeRiwayat.toUpperCase()}.xlsx`);
};

window.bukaModalSTBJ = async function() {
    const mStbj = document.getElementById('modal-stbj-langsir'); if(mStbj) mStbj.classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</div>';
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj_langsir')
            .select('*')
            .eq('status', 'STBJ')
            .order('created_at', { ascending: false })
            .limit(200);
        
        if(error) throw error;
        
        if(!data || data.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Data STBJ Kosong (Semua sudah dilangsir).</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = formatWIB(r.created_at);
            h += `
                <div class="row-modal-stbj bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-[10px] border border-blue-200">STBJ</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${r.tgl_produksi || '-'} - ${r.mesin || '-'} - ${r.shift || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | <span class="text-slate-800">${r.nama_item || '-'}</span> | <span class="text-slate-800">${r.panjang || '-'}</span> | <span class="text-slate-800">${r.grade || '-'}</span> | <span class="text-slate-800">${r.dus || '-'}</span> | <span class="text-blue-600">${r.shading || '-'}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">Customer: <span class="text-orange-600">${r.customer || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { 
        if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; 
    }
};

window.saringTabelModalSTBJ = function() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.bukaModalHold = async function(tabelTarget = 'hold_stbj') {
    const mHold = document.getElementById('modal-hold-langsir'); if(mHold) mHold.classList.remove('hidden');
    
    const tabStbj = document.getElementById('tab-hold-stbj');
    const tabLangsir = document.getElementById('tab-hold-langsir');
    
    let statusFilter = 'HOLD STBJ';
    if(tabelTarget === 'hold_stbj') {
        tabStbj.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabLangsir.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
        statusFilter = 'HOLD STBJ';
    } else {
        tabLangsir.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabStbj.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
        statusFilter = 'HOLD LANGSIR';
    }

    const tbody = document.getElementById('tbody-hold-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data Hold...</div>';
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj_langsir')
            .select('*')
            .eq('status', statusFilter)
            .order('created_at', {ascending: false})
            .limit(100);
            
        if(error) throw error;
        if(!data || data.length === 0) {
            if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-slate-400">Tabel ${statusFilter} Kosong.</div>`;
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = formatWIB(r.created_at);

            h += `
                <div class="row-modal-hold bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] border border-amber-200">HOLD</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${r.tgl_produksi || '-'} - ${r.mesin || '-'} - ${r.shift || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | <span class="text-slate-800">${r.nama_item || '-'}</span> | <span class="text-slate-800">${r.panjang || '-'}</span> | <span class="text-slate-800">${r.grade || '-'}</span> | <span class="text-slate-800">${r.dus || '-'}</span> | <span class="text-blue-600">${r.shading || '-'}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">Customer: <span class="text-orange-600">${r.customer || '-'}</span></div>
                    <div class="text-[12px] font-bold text-rose-600">Keterangan: <span class="text-rose-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
};

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

function renderDragList() {
    const container = document.getElementById('kolom-drag-container'); 
    if(!container) return; 
    container.innerHTML = '';
    
    const headers = Array.from(document.querySelectorAll('#thead-riwayat th'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; 
        const label = th.innerText.trim() || 'Kolom';
        if(!colClass || colClass === 'col-cb') return;

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
    if(typeof lucide !== 'undefined') lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); 
        const afterElement = getDragAfterElement(container, e.clientY); 
        const draggable = document.querySelector('.dragging');
        if (draggable) { 
            if (afterElement == null) { container.appendChild(draggable); } 
            else { container.insertBefore(draggable, afterElement); } 
        }
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
    const items = document.querySelectorAll('.drag-item'); 
    let newOrder = []; 
    items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    userColOrder = newOrder; 
    localStorage.setItem(`col_order_rlangsir_${modeRiwayat}_${currentUser.username}`, JSON.stringify(newOrder));
    localStorage.setItem(`col_hidden_rlangsir_${modeRiwayat}_${currentUser.username}`, JSON.stringify(hiddenCols));
    tampilkanAlert("Pengaturan kolom berhasil disimpan!", "success"); 
    window.toggleSidebarKolom(); 
    renderTabelRiwayat(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan pengaturan kolom ke default?")) return;
    userColOrder = []; hiddenCols = [];
    localStorage.removeItem(`col_order_rlangsir_${modeRiwayat}_${currentUser.username}`);
    localStorage.removeItem(`col_hidden_rlangsir_${modeRiwayat}_${currentUser.username}`);
    tampilkanAlert("Pengaturan dikembalikan ke default.", "success"); 
    window.toggleSidebarKolom(); 
    renderTabelRiwayat();
};

function applyColumnOrder() {
    if (!userColOrder || userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); 
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
