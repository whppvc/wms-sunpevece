window.modeKS = 'area'; 
window.stokQRRaw = []; 
window.stokAktualRaw = []; 
window.stokLembaranRaw = [];
window.dataKSQR = []; 
window.dataKSArea = []; 
window.dataKSGlobal = [];
window.selectedForAction = []; 
window.sourcePOContext = ''; 
window.currentBreakdownData = [];
window.sortState = {};
window.masterData = { kamus: [] };
window.poDistributionMap = {}; 

window.currentPage = 1;
window.rowsPerPage = 10; 
window.activeFilters = {}; 
window.currentFilterCol = ''; 
window.selectAllState = 0; 
window.userColOrder = []; 
window.selectedForReq = null; 

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

window.currentUser = safeJSONParse(localStorage.getItem('user_session'), { username: 'Admin', role: 'admin' });

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_ks_${window.modeKS}_${window.currentUser.username}`);
    if (savedOrder) {
        try { window.userColOrder = JSON.parse(savedOrder); } catch(e) { window.userColOrder = []; }
    } else {
        window.userColOrder = [];
    }
    
    const savedRows = localStorage.getItem('wms_rows_per_page');
    if(savedRows) {
        window.rowsPerPage = parseInt(savedRows);
        const sel = document.getElementById('select-rows-per-page');
        if(sel) {
            let found = false;
            Array.from(sel.options).forEach(opt => { if(opt.value == window.rowsPerPage) { opt.selected = true; found = true; } });
            if(!found) {
                sel.value = 'CUSTOM';
                const inp = document.getElementById('input-custom-rows');
                if(inp) { inp.classList.remove('hidden'); inp.value = window.rowsPerPage; }
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    if(typeof initModernLayout === 'function') {
        initModernLayout({ id: 'kartu_stok', title: 'KARTU STOK', url: 'kartu_stok.html' });
    }
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                window.closeFilterMenu();
            }
        }
        
        const actionMenu = document.getElementById('mobile-action-menu');
        if (actionMenu && !actionMenu.classList.contains('hidden')) {
            if (!actionMenu.contains(e.target) && !actionMenu.closest('button[onclick^="toggleActionMenu"]')) {
                actionMenu.classList.add('hidden');
            }
        }
    });

    await window.loadMasterData();
    window.loadUserPreferences(); 
    window.muatDataStok(); 
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.loadMasterData = async function() {
    try {
        const {data, error} = await db.from('master_2').select('*');
        if (data) {
            window.masterData.kamus = data; 
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
};

window.translateBarcode = function(barcode) {
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
};

window.sinkronisasiUlangStokAktual = function(tampilkanAlert = false) {
    alert("Fungsi Sinkronisasi Wipe & Rebuild dinonaktifkan untuk menjaga integritas data Customer Aktual hasil editan user.\n\nSistem kini menggunakan metode Incremental Update (+/-) secara otomatis setiap kali ada transaksi.");
};

window.muatDataStok = async function() {
    const tbody = document.getElementById('tbody-ks');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menghubungkan ke Gudang Supabase...</p></td></tr>`;
    if(typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const [resStok, resAktual, resLembaran] = await Promise.all([
            db.from('stok_qr').select('*'),
            db.from('stok_aktual').select('*'),
            db.from('stok_lembaran').select('*').order('created_at', {ascending: false})
        ]);
        
        if(resStok.error) throw resStok.error;
        if(resAktual.error) throw resAktual.error;
        
        window.stokQRRaw = resStok.data || [];
        window.stokAktualRaw = resAktual.data || [];
        window.stokLembaranRaw = resLembaran.data || [];

        let aktualMap = {};
        window.stokAktualRaw.forEach(a => {
            let key = `${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}`;
            if(!aktualMap[key]) aktualMap[key] = {};
            let custAktual = a.customer_aktual || '-';
            if(!aktualMap[key][custAktual]) aktualMap[key][custAktual] = 0;
            aktualMap[key][custAktual] += (a.qty || 0);
        });
        window.poDistributionMap = aktualMap;

        let qrMap = {};
        window.stokQRRaw.forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = window.translateBarcode(r.qrcode);
            let area = p[0] || r.area || '-';
            let nama = p[1] || r.nama_item || t.namaItem;
            let pjg = p[2] || r.panjang || t.panjang;
            let grade = p[3] || r.grade || t.grade;
            let dus = p[4] || r.dus || t.dus;
            let shading = p[5] || r.shading || t.shading;
            let po = p[6] || r.customer_bawaan || t.customer || '-';
            let ket = p.length >= 8 ? p.slice(7).join('_') : (r.keterangan || '-');

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
            if(!qrMap[key]) qrMap[key] = [];
            qrMap[key].push(r.qrcode);
        });

        window.dataKSQR = window.stokQRRaw.map(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = window.translateBarcode(r.qrcode);
            return {
                qrcode: r.qrcode || '-', id_sku: r.id_sku || '-', id_po: r.id_po || '-', area: p[0] || r.area || '-', 
                tglProduksi: r.tgl_produksi || t.tglProduksi || '-', mesin: r.mesin || t.mesin || '-', shift: r.shift || t.shift || '-', 
                jenis: r.jenis_item || t.jenisItem || '-', nama: p[1] || r.nama_item || t.namaItem || '-',
                pjg: p[2] || r.panjang || t.panjang || '-', grade: p[3] || r.grade || t.grade || '-', 
                dus: p[4] || r.dus || t.dus || '-', shading: p[5] || r.shading || t.shading || '-',
                po_bawaan: r.customer_bawaan || t.customer || '-', po_aktual: p[6] || r.customer_bawaan || t.customer || '-', 
                ket: p.length >= 8 ? p.slice(7).join('_') : (r.keterangan || '-'), id: r.id 
            };
        });

        window.dataKSArea = window.stokAktualRaw.map(a => {
            let key = `${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.area}_${a.customer_bawaan}_${a.keterangan}`;
            return {
                ...a,
                pjg: a.panjang || '-', 
                jenis: a.jenis_item || '-', 
                nama: a.nama_item || '-',
                qrcodes: qrMap[key] || [],
                id_sku_base: a.id_sku || '-',
                id_po: a.id_po || '-',
                po_bawaan: a.customer_bawaan || '-',
                po_aktual: a.customer_aktual || '-',
                customer_estimasi: a.customer_estimasi || '-',
                qty: a.qty || 0
            };
        });

        let globalMap = {};
        window.dataKSArea.forEach(a => {
            let gKey = `${a.jenis}_${a.nama}_${a.pjg}_${a.grade}_${a.dus}_${a.shading}_${a.po_aktual}_${a.customer_estimasi}_${a.keterangan}`;
            if(!globalMap[gKey]) {
                globalMap[gKey] = { gKey: gKey, jenis: a.jenis, nama: a.nama, pjg: a.pjg, grade: a.grade, dus: a.dus, shading: a.shading, po: a.po_aktual, customer_estimasi: a.customer_estimasi, ket: a.keterangan, qty: 0, areas: [] };
            }
            globalMap[gKey].qty += a.qty;
            globalMap[gKey].areas.push(a);
        });
        window.dataKSGlobal = Object.values(globalMap);

        window.renderTabel();
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="16" class="p-10 text-center text-red-500 font-medium">Gagal mengolah data: ${e.message}</td></tr>`; 
    }
};

window.setModeKS = function(m) {
    window.modeKS = m;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    ['qr', 'global', 'area', 'lembaran'].forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    const btnGantiPO = document.getElementById('btn-ganti-po-main');
    if(btnGantiPO) btnGantiPO.classList.toggle('hidden', m === 'global' || m === 'lembaran');
    
    const btnReqKonv = document.getElementById('btn-req-konversi-main');
    if(btnReqKonv) btnReqKonv.classList.toggle('hidden', m !== 'area');
    
    window.activeFilters = {}; 
    window.loadUserPreferences(); 
    window.renderTabel();
};

window.sortTable = function(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-ks');
    const rows = Array.from(tbody.querySelectorAll('tr.row-ks'));
    let isAsc = window.sortState[colIndex] !== 'asc'; window.sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].getAttribute('data-search') || a.cells[colIndex].innerText.trim(); 
        let valB = b.cells[colIndex].getAttribute('data-search') || b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) { return isAsc ? numA - numB : numB - numA; } 
        else { return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    window.applyPagination();
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-open', 'col-proses'].includes(colClass);
    
    if (noFilter) {
        return `<th class="hdr-std ${cls} select-none text-center"><div class="flex items-center justify-center w-full">${label}</div></th>`;
    }

    return `<th class="hdr-std ${cls} select-none group">
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

window.renderTabel = function() {
    const thead = document.getElementById('thead-ks');
    const tbody = document.getElementById('tbody-ks');
    if(!thead || !tbody) return;
    
    window.sortState = {}; 
    window.selectAllState = 0;

    const rowClassBase = "transition row-ks text-[13px]";

    if(window.modeKS === 'qr') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
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
                ${window.thSort(12, 'Customer Bawaan', 'col-po-bawaan')}
                ${window.thSort(13, 'Customer Aktual', 'col-po')}
                ${window.thSort(14, 'Keterangan', 'col-ket')}
                <th class="hdr-std w-20 col-proses text-center">Proses</th>
            </tr>`;
        
        if(window.dataKSQR.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="16" class="p-8 text-center font-medium text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = window.dataKSQR.map((r) => {
            const safeQRs = JSON.stringify([r.qrcode]).replace(/"/g, "&quot;");
            const rowDataStr = encodeURIComponent(JSON.stringify(r));
            
            let baseSpec = `${r.nama}_${r.pjg}_${r.grade}_${r.dus}_${r.shading}`;
            let poDist = window.poDistributionMap[baseSpec];
            let poArr = [];
            if(poDist) {
                for(let po in poDist) {
                    poArr.push(`${po} (${poDist[po]} Dus)`);
                }
            }
            let poString = poArr.length > 0 ? poArr.join(' | ') : 'KOSONG';
            let btnPO = `<button onclick="window.bukaModalLihatPO('${encodeURIComponent(poString)}')" class="bg-white text-slate-700 border border-slate-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1 shadow-sm"><i data-lucide="eye" class="w-3 h-3 text-slate-400"></i> Lihat Customer</button>`;

            return `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="window.highlightRow(this)" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-ket="${r.ket}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-semibold text-slate-800 text-left col-area" data-search="${r.area}">${r.area}</td>
                    <td class="px-4 py-3 font-mono font-medium text-slate-800 text-left col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-tgl" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-mesin" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shift" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama}">${r.nama}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-po-bawaan" data-search="${r.po_bawaan}">${r.po_bawaan}</td>
                    <td class="px-4 py-3 text-left col-po" data-search="${poString}">${btnPO}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.ket}">${r.ket}</td>
                    <td class="px-4 py-3 text-center col-proses"><button onclick="window.prosesKartuStok('${rowDataStr}')" class="btn-proses bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-[10px] uppercase shadow-sm transition active:scale-95">Proses</button></td>
                </tr>`;
        }).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="16" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    }
    else if(window.modeKS === 'area') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${window.thSort(1, 'Area', 'col-area')}
                ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                ${window.thSort(3, 'Nama Item', 'col-nama')}
                ${window.thSort(4, 'Panjang', 'col-pjg')}
                ${window.thSort(5, 'Grade', 'col-grade')}
                ${window.thSort(6, 'Dus', 'col-dus')}
                ${window.thSort(7, 'Shading', 'col-shading')}
                ${window.thSort(8, 'Customer Aktual', 'col-po')}
                ${window.thSort(9, 'Customer Estimasi', 'col-estimasi text-purple-300')}
                ${window.thSort(10, 'Keterangan', 'col-ket')}
                ${window.thSort(11, 'Total Qty (Dus)', 'col-qty')}
                <th class="hdr-std w-20 col-proses text-center">Proses</th>
            </tr>`;
        
        if(window.dataKSArea.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="13" class="p-8 text-center font-medium text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = window.dataKSArea.map((r) => {
            const safeQRs = JSON.stringify(r.qrcodes).replace(/"/g, "&quot;");
            const rowDataStr = encodeURIComponent(JSON.stringify(r));
            return `
                <tr class="${rowClassBase}">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="window.highlightRow(this)" data-idsku="${r.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama_item}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-estimasi="${r.customer_estimasi}" data-qty="${r.qty}" data-ket="${r.keterangan}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-semibold text-slate-800 text-left col-area" data-search="${r.area}">${r.area}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama_item}">${r.nama_item}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po" data-search="${r.po_aktual}">${r.po_aktual}</td>
                    <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi" data-search="${r.customer_estimasi}">${r.customer_estimasi}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.keterangan}">${r.keterangan}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty text-base" data-search="${r.qty}">${r.qty}</td>
                    <td class="px-4 py-3 text-center col-proses"><button onclick="window.prosesKartuStok('${rowDataStr}')" class="btn-proses bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-[10px] uppercase shadow-sm transition active:scale-95">Proses</button></td>
                </tr>`;
        }).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="13" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    } 
    else if (window.modeKS === 'global') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                <th class="hdr-std w-12 col-open text-center">Detail</th>
                ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                ${window.thSort(3, 'Nama Item', 'col-nama')}
                ${window.thSort(4, 'Panjang', 'col-pjg')}
                ${window.thSort(5, 'Grade', 'col-grade')}
                ${window.thSort(6, 'Dus', 'col-dus')}
                ${window.thSort(7, 'Shading', 'col-shading')}
                ${window.thSort(8, 'Customer Aktual', 'col-po')}
                ${window.thSort(9, 'Customer Estimasi', 'col-estimasi text-purple-300')}
                ${window.thSort(10, 'Keterangan', 'col-ket')}
                ${window.thSort(11, 'TOTAL (DUS)', 'col-qty')}
                <th class="hdr-std w-20 col-proses text-center">Proses</th>
            </tr>`;

        if(window.dataKSGlobal.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="13" class="p-8 text-center font-medium text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = window.dataKSGlobal.map((r) => {
            const rowDataStr = encodeURIComponent(JSON.stringify(r));
            return `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 text-center col-open"><button onclick="window.bukaBreakdown('${r.gKey}')" class="p-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-md transition flex mx-auto items-center justify-center shadow-sm"><i data-lucide="box" class="w-4 h-4"></i></button></td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama}">${r.nama}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade}">${r.grade}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus}">${r.dus}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading}">${r.shading}</td>
                <td class="px-4 py-3 font-semibold text-slate-900 text-left col-po" data-search="${r.po}">${r.po}</td>
                <td class="px-4 py-3 font-semibold text-purple-700 text-left col-estimasi" data-search="${r.customer_estimasi}">${r.customer_estimasi}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.ket}">${r.ket}</td>
                <td class="px-4 py-3 font-black text-emerald-700 text-center col-qty text-base" data-search="${r.qty}">${r.qty}</td>
                <td class="px-4 py-3 text-center col-proses"><button onclick="window.prosesKartuStok('${rowDataStr}')" class="btn-proses bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-[10px] uppercase shadow-sm transition active:scale-95">Proses</button></td>
            </tr>
        `}).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="13" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    } 
    else if (window.modeKS === 'lembaran') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${window.thSort(1, 'Kode Master', 'col-area')}
                ${window.thSort(2, 'Nama Item', 'col-nama')}
                ${window.thSort(3, 'Panjang', 'col-pjg')}
                ${window.thSort(4, 'Grade', 'col-grade')}
                ${window.thSort(5, 'Dus', 'col-dus')}
                ${window.thSort(6, 'Shading', 'col-shading')}
                ${window.thSort(7, 'Keterangan', 'col-ket')}
                <th class="hdr-std w-20 col-proses text-center">Proses</th>
            </tr>`;
        
        if(window.stokLembaranRaw.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="9" class="p-8 text-center font-medium text-slate-400">Tidak ada data stok lembaran.</td></tr>`; return; }

        tbody.innerHTML = window.stokLembaranRaw.map((r) => {
            const rowDataStr = encodeURIComponent(JSON.stringify(r));
            return `
            <tr class="${rowClassBase}">
                <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-left col-area" data-search="${r.kode_master || '-'}">${r.kode_master || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-pjg" data-search="${r.pjg || '-'}">${r.pjg || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 text-left col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-left col-ket" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
                <td class="px-4 py-3 text-center col-proses"><button onclick="window.prosesKartuStok('${rowDataStr}')" class="btn-proses bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-[10px] uppercase shadow-sm transition active:scale-95">Proses</button></td>
            </tr>
        `}).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="9" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    }

    window.applyColumnOrder(); 
    if(typeof lucide !== 'undefined') lucide.createIcons(); 
    window.updateSelectAllUI();
    window.saringTabelExcel(); 
    window.initResizableColumns(); 
};

window.highlightRow = function(checkbox, skipStateReset = false) {
    const tr = checkbox.closest('tr');
    if (tr) {
        if (checkbox.checked) { tr.classList.add('selected-row'); } 
        else { tr.classList.remove('selected-row'); }
    }
    
    if(!skipStateReset && !checkbox.checked && window.selectAllState !== 0) {
        window.selectAllState = 0;
        window.updateSelectAllUI();
    }
    
    if(!skipStateReset) window.updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        window.rowsPerPage = 999999; 
        if(customInput) customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        if(customInput) {
            customInput.classList.remove('hidden');
            customInput.focus();
            let customVal = parseInt(customInput.value);
            window.rowsPerPage = (customVal > 0) ? customVal : window.rowsPerPage;
        }
    } else {
        window.rowsPerPage = parseInt(val);
        if(customInput) customInput.classList.add('hidden');
    }
    localStorage.setItem('wms_rows_per_page', window.rowsPerPage);
    window.currentPage = 1; 
    window.applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        window.rowsPerPage = parsed;
        localStorage.setItem('wms_rows_per_page', window.rowsPerPage);
        window.currentPage = 1;
        window.applyPagination();
    }
};

window.applyPagination = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-ks tr.row-ks'));
    
    allRows.forEach(row => {
        if(row.classList.contains('filtered-out')) {
            row.style.display = 'none';
        }
    });

    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / window.rowsPerPage) || 1;
    
    if(window.currentPage > totalPages) window.currentPage = totalPages;
    if(window.currentPage < 1) window.currentPage = 1;

    const startIndex = (window.currentPage - 1) * window.rowsPerPage;
    const endIndex = startIndex + window.rowsPerPage;

    let sumQty = 0;
    visibleRows.forEach((row, index) => {
        row.classList.remove('stripe-1', 'stripe-2');
        if (index % 2 === 0) row.classList.add('stripe-1');
        else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty');
        if(qtyCell) { sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; } 
        else { sumQty += 1; }

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    const emptyRow = document.getElementById('empty-row-ks');
    if(emptyRow) emptyRow.style.display = totalFiltered === 0 ? '' : 'none';

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = window.currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (window.selectAllState === 1) {
        window.selectAllState = 0;
        window.updateSelectAllUI();
    }
    
    window.applySelection();
    window.updateSelectedCount();
};

window.prevPage = function() { if(window.currentPage > 1) { window.currentPage--; window.applyPagination(); } };
window.nextPage = function() { 
    const totalVisible = document.querySelectorAll('#tbody-ks tr.row-ks:not(.filtered-out)').length;
    if(window.currentPage < Math.ceil(totalVisible / window.rowsPerPage)) { window.currentPage++; window.applyPagination(); } 
};

window.updateSelectedCount = function() {
    const count = document.querySelectorAll('.cb-main:checked').length;
    const lbl = document.getElementById('lbl-pilih-baris');
    if(lbl) lbl.innerText = count;
};

window.eksekusiGantiPO = async function() {
    const newPO = document.getElementById('input-new-po').value.trim().toUpperCase();
    if(!newPO) return alert("Silakan Pilih Customer Baru dari daftar dropdown!");

    const qtyDiminta = parseInt(document.getElementById('input-qty-ganti').value);
    if(isNaN(qtyDiminta) || qtyDiminta <= 0) return alert("Jumlah dus tidak valid!");

    let maxDus = window.selectedForAction.reduce((sum, row) => sum + row.qty, 0);
    if(qtyDiminta > maxDus) return alert(`Maksimal jatah adalah ${maxDus} dus!`);

    const btn = document.getElementById('btn-simpan-po'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        let qtySisaUntukDiupdate = qtyDiminta; 
        
        for(let row of window.selectedForAction) {
            if (qtySisaUntukDiupdate <= 0) break; 
            
            let qtyPotong = Math.min(row.qty, qtySisaUntukDiupdate);
            qtySisaUntukDiupdate -= qtyPotong;

            // Cari baris lama di stok_aktual
            const { data: oldRows, error: errOld } = await db.from('stok_aktual')
                .select('*')
                .eq('id_sku', row.id_sku)
                .eq('customer_estimasi', row.customer_estimasi)
                .eq('area', row.area)
                .limit(1);
            
            if (errOld) throw errOld;

            if (oldRows && oldRows.length > 0) {
                let oldRow = oldRows[0];
                
                // 1. Kurangi Qty Baris Lama
                let sisaQty = oldRow.qty - qtyPotong;
                if (sisaQty <= 0) {
                    await db.from('stok_aktual').delete().eq('id', oldRow.id);
                } else {
                    await db.from('stok_aktual').update({qty: sisaQty}).eq('id', oldRow.id);
                }

                // 2. Tambah Qty ke Baris Baru (dengan customer_estimasi baru)
                const { data: newRows, error: errNew } = await db.from('stok_aktual')
                    .select('id, qty')
                    .eq('id_sku', oldRow.id_sku)
                    .eq('customer_estimasi', newPO)
                    .eq('customer_aktual', oldRow.customer_aktual) // Pastikan aktual sama
                    .eq('area', oldRow.area)
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
        
        window.tutupModalPO(); 
        if(window.sourcePOContext === 'breakdown') window.tutupModalBreakdown();
        
        await window.muatDataStok();
        alert("Berhasil mengganti Customer Estimasi!");
    } catch (error) { 
        alert("GAGAL UPDATE: " + error.message); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons(); 
    }
};

window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin!");

    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-ks th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open') && !th.classList.contains('col-proses'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';

    cek.forEach(cb => {
        const tr = cb.closest('tr');
        const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-open') || td.classList.contains('col-proses')) return;
            if(window.getComputedStyle(td).display !== 'none') {
                let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                rowData.push(val.replace(/\n/g, ' '));
            }
        });
        copyString += rowData.join('\t') + '\n';
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert("Berhasil menyalin!");
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
    
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-ks th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open') && !th.classList.contains('col-proses'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);

    document.querySelectorAll('.row-ks').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-open') || td.classList.contains('col-proses')) return;
                if(window.getComputedStyle(td).display !== 'none') {
                    let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                    rowData.push(`"${val.replace(/\n/g, ' ')}"`);
                }
            });
            ws_data.push(rowData);
        }
    });

    if(ws_data.length <= 1) return alert("Pilih minimal 1 baris data untuk di-export!");

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kartu_Stok");
    XLSX.writeFile(wb, `Kartu_Stok_${window.modeKS.toUpperCase()}.xlsx`);
};

window.salinDataBreakdown = function() {
    const cek = document.querySelectorAll('.cb-bd:checked');
    if(cek.length === 0) return alert("Pilih data breakdown yang ingin disalin!");

    let copyString = "Area\tCustomer Aktual\tCustomer Estimasi\tKeterangan\tTotal Dus\n";
    cek.forEach(cb => {
        const tr = cb.closest('tr');
        const area = tr.children[1].innerText.trim();
        const po = tr.children[2].innerText.trim();
        const est = tr.children[3].innerText.trim();
        const ket = tr.children[4].innerText.trim();
        const qty = tr.children[5].innerText.trim();
        copyString += `${area}\t${po}\t${est}\t${ket}\t${qty}\n`;
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert("Berhasil menyalin detail breakdown!");
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
};

window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom');
    const overlay = document.getElementById('overlay-klik-luar');
    
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        window.renderDragList();
    } else {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container');
    if(!container) return;
    container.innerHTML = '';
    
    const headers = Array.from(document.querySelectorAll('#thead-ks th'))
        .filter(th => th && !th.classList.contains('col-cb') && !th.classList.contains('col-open') && !th.classList.contains('col-proses'));
    
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || '';
        const label = th.innerText.trim() || 'Kolom';
        
        const div = document.createElement('div');
        div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab';
        div.draggable = true;
        div.setAttribute('data-col', colClass);
        div.innerHTML = `
            <span class="font-bold text-slate-700 text-xs">${label}</span>
            <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>
        `;
        
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); });
        div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        
        container.appendChild(div);
    });
    
    if(typeof lucide !== 'undefined') lucide.createIcons();

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = window.getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        }
    });
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.simpanUrutanKolom = function() {
    const items = document.querySelectorAll('.drag-item');
    let newOrder = [];
    items.forEach(item => newOrder.push(item.getAttribute('data-col')));
    
    window.userColOrder = newOrder;
    localStorage.setItem(`col_order_ks_${window.modeKS}_${window.currentUser.username}`, JSON.stringify(newOrder));
    
    alert("Urutan kolom berhasil disimpan!");
    window.toggleSidebarKolom();
    window.renderTabel(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    window.userColOrder = [];
    localStorage.removeItem(`col_order_ks_${window.modeKS}_${window.currentUser.username}`);
    
    alert("Urutan dikembalikan ke default.");
    window.toggleSidebarKolom();
    window.renderTabel();
};

window.applyColumnOrder = function() {
    if (!window.userColOrder || window.userColOrder.length === 0) return;

    const table = document.getElementById('main-table');
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

        window.userColOrder.forEach(colId => {
            if (cellMap[colId]) {
                row.appendChild(cellMap[colId]);
            }
        });

        cells.forEach(c => {
            const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-'));
            if (colClass !== 'col-cb' && colClass !== 'col-open' && colClass !== 'col-proses' && !window.userColOrder.includes(colClass)) {
                row.appendChild(c);
            }
        });
        
        if (prosesCell) row.appendChild(prosesCell);
    });
};

window.tutupSemuaPopups = function() {
    document.getElementById('modal-lihat-po').classList.add('hidden');
    document.getElementById('modal-breakdown').classList.add('hidden');
    document.getElementById('modal-po').classList.add('hidden');
    document.getElementById('modal-req-konversi').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    if(document.getElementById('sidebar-kolom')) {
        document.getElementById('sidebar-kolom').classList.add('translate-x-full');
    }
};

window.bukaBreakdown = function(gKey) {
    const item = window.dataKSGlobal.find(g => g.gKey === gKey); if(!item) return;

    document.getElementById('bd-title-item').innerText = `${item.nama} | ${item.pjg} | ${item.grade} | DUS: ${item.dus} | SHADING: ${item.shading} | KET: ${item.ket}`;
    window.currentBreakdownData = item.areas;

    const tbody = document.getElementById('tbody-breakdown');
    tbody.innerHTML = item.areas.map((a, i) => {
        const safeQRs = JSON.stringify(a.qrcodes).replace(/"/g, "&quot;");
        const stripeClass = i % 2 === 0 ? 'stripe-1' : 'stripe-2';
        return `
            <tr class="transition bd-row text-[13px] ${stripeClass}">
                <td class="px-4 py-3 text-center sticky-col"><input type="checkbox" onchange="window.highlightBdRow(this)" data-idsku="${a.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po_aktual}" data-estimasi="${a.customer_estimasi}" data-qty="${a.qty}" data-ket="${a.keterangan}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
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
    document.querySelectorAll('.cb-bd').forEach(cb => { cb.checked = checked; window.highlightBdRow(cb); }); 
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
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-black">${qtyPo}</span>
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
        if(window.modeKS === 'global' || window.modeKS === 'lembaran') return;
        checkboxes = document.querySelectorAll('.cb-main:checked');
    } else { checkboxes = document.querySelectorAll('.cb-bd:checked'); }

    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diganti Customer Estimasi-nya.');

    window.selectedForAction = []; let totalDus = 0;
    checkboxes.forEach(cb => {
        window.selectedForAction.push({ 
            id_sku: cb.dataset.idsku, 
            po_aktual: cb.dataset.po,
            customer_estimasi: cb.dataset.estimasi,
            area: cb.dataset.area,
            qty: parseInt(cb.dataset.qty) || 1
        });
        totalDus += parseInt(cb.dataset.qty) || 1;
    });

    window.sourcePOContext = context;
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

window.cycleSelectAll = function() {
    window.selectAllState = (window.selectAllState + 1) % 3;
    window.updateSelectAllUI();
    window.applySelection();
};

window.updateSelectAllUI = function() {
    const btn = document.getElementById('btn-select-all');
    if(!btn) return;
    
    if (window.selectAllState === 0) {
        btn.innerHTML = '';
        btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto';
    } else if (window.selectAllState === 1) {
        btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto';
    } else if (window.selectAllState === 2) {
        btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>';
        btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto';
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-ks tr.row-ks'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const startIndex = (window.currentPage - 1) * window.rowsPerPage;
    const endIndex = startIndex + window.rowsPerPage;

    if (window.selectAllState === 0) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = false; window.highlightRow(cb, true); }
        });
    } else if (window.selectAllState === 1) {
        allRows.forEach(row => {
            const cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = false; window.highlightRow(cb, true); }
        });
        visibleRows.forEach((row, index) => {
            if(index >= startIndex && index < endIndex) {
                const cb = row.querySelector('.cb-main');
                if(cb) { cb.checked = true; window.highlightRow(cb, true); }
            }
        });
    } else if (window.selectAllState === 2) {
        visibleRows.forEach(row => {
            const cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = true; window.highlightRow(cb, true); }
        });
    }
    window.updateSelectedCount();
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation();
    window.currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;

    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-ks tr.row-ks').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in window.activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = window.activeFilters[otherCol];
                const c = row.querySelector('.' + otherCol);
                let t = c ? (c.getAttribute('data-search') || c.innerText.trim()) : '';
                if (!allowed.includes(t)) { showBasedOnOthers = false; break; }
            }
        }
        if (showBasedOnOthers) {
            let cell = row.querySelector('.' + colClass);
            if (cell) {
                let val = cell.getAttribute('data-search') || cell.innerText.trim();
                if(val !== '') uniqueValues.add(val);
            }
        }
    });

    let sortedValues = Array.from(uniqueValues).sort();
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = true;
        if (window.activeFilters[colClass] && !window.activeFilters[colClass].includes(val)) { isChecked = false; }
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml;
    window.updateSelectAllState();
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
    window.updateSelectAllState();
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

document.addEventListener('change', function(e) { if(e.target && e.target.classList.contains('filter-val-cb')) window.updateSelectAllState(); });

window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x); 
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        let matches = query.every(term => text.includes(term));
        label.style.display = matches ? '' : 'none';
    });
};

window.closeFilterMenu = function() { document.getElementById('excel-filter-menu').classList.add('hidden'); };

window.clearFilterForCurrentCol = function() {
    delete window.activeFilters[window.currentFilterCol];
    window.closeFilterMenu(); window.saringTabelExcel(); 
};

window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked');
    const totalBoxes = document.querySelectorAll('.filter-val-cb');
    
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') {
        delete window.activeFilters[window.currentFilterCol];
    } else {
        let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value));
        window.activeFilters[window.currentFilterCol] = selectedVals;
    }
    
    window.closeFilterMenu(); window.saringTabelExcel(); 
};

window.saringTabelExcel = function() {
    document.querySelectorAll('.row-ks').forEach(row => {
        let show = true;
        for (let colClass in window.activeFilters) {
            const allowedValues = window.activeFilters[colClass];
            const cell = row.querySelector('.' + colClass);
            if (cell) {
                let text = cell.getAttribute('data-search') || cell.innerText.trim();
                if (!allowedValues.includes(text)) { show = false; break; }
            }
        }
        
        if (show) { 
            row.classList.remove('filtered-out'); 
        } else { 
            row.classList.add('filtered-out'); 
            let cb = row.querySelector('.cb-main');
            if(cb) { cb.checked = false; window.highlightRow(cb, true); } 
        }
    });
    
    window.selectAllState = 0;
    window.updateSelectAllUI();
    window.currentPage = 1; 
    window.applyPagination(); 
    window.updateFilterIcons();
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.classList.remove('text-amber-400', 'opacity-100');
        icon.classList.add('text-white', 'opacity-40');
    });
    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) {
            const icon = th.querySelector('.filter-icon');
            if (icon) { 
                icon.classList.remove('text-white', 'opacity-40'); 
                icon.classList.add('text-amber-400', 'opacity-100'); 
            }
        }
    }
};

window.initResizableColumns = function() {
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
};

// ========================================================
// LOGIKA REQUEST KONVERSI
// ========================================================
window.siapkanReqKonversi = function() {
    const checkboxes = document.querySelectorAll('.cb-main:checked');
    if(checkboxes.length !== 1) return alert('Silakan centang TEPAT 1 (satu) baris item yang ingin direquest konversi.');

    const cb = checkboxes[0];
    window.selectedForReq = {
        jenis_item: cb.dataset.jenis || '-',
        nama_item: cb.dataset.nama || '-',
        panjang: cb.dataset.pjg || '-',
        grade: cb.dataset.grade || '-',
        dus: cb.dataset.dus || '-',
        shading: cb.dataset.shading || '-',
        customer_aktual: cb.dataset.po || '-',
        keterangan: cb.dataset.ket || '-',
        area: cb.dataset.area || '-',
        qty_max: parseInt(cb.dataset.qty) || 0
    };

    const infoAsal = document.getElementById('req-info-asal');
    if(infoAsal) {
        infoAsal.innerHTML = `
            <span class="text-blue-600">${window.selectedForReq.nama_item}</span> | 
            ${window.selectedForReq.panjang} | ${window.selectedForReq.grade} | ${window.selectedForReq.dus} | ${window.selectedForReq.shading} | 
            <span class="text-emerald-600">${window.selectedForReq.area}</span> | 
            <span class="text-orange-600">${window.selectedForReq.customer_aktual}</span>
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
    window.selectedForReq = null;
};

window.eksekusiReqKonversi = async function() {
    if(!window.selectedForReq) return alert("Data sumber tidak valid!");

    const namaReq = document.getElementById('req-nama-item').value.trim() || window.selectedForReq.nama_item;
    const pjgReq = document.getElementById('req-panjang').value.trim() || window.selectedForReq.panjang;
    const gradeReq = document.getElementById('req-grade').value.trim() || window.selectedForReq.grade;
    const dusReq = document.getElementById('req-dus').value.trim() || window.selectedForReq.dus;
    const shadingReq = document.getElementById('req-shading').value.trim() || window.selectedForReq.shading;
    
    const qtyReq = parseInt(document.getElementById('req-qty').value);
    const qtyHasil = parseInt(document.getElementById('req-qty-hasil').value);

    if(isNaN(qtyReq) || qtyReq <= 0) return alert("Qty Request tidak valid!");
    if(isNaN(qtyHasil) || qtyHasil <= 0) return alert("Qty Hasil tidak valid!");
    if(qtyReq > window.selectedForReq.qty_max) return alert(`Maksimal Qty Request adalah ${window.selectedForReq.qty_max} dus!`);

    const btn = document.getElementById('btn-save-req-konv'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        const { count } = await db.from('request_konversi').select('*', { count: 'exact', head: true });
        const nextNum = (count || 0) + 1;
        const kodeKonversi = `K-${String(nextNum).padStart(4, '0')}`;

        const payload = {
            kode_konversi: kodeKonversi,
            aktifitas_konversi: 'req',
            area: window.selectedForReq.area,
            jenis_item: window.selectedForReq.jenis_item,
            nama_item: window.selectedForReq.nama_item,
            panjang: window.selectedForReq.panjang,
            grade: window.selectedForReq.grade,
            dus: window.selectedForReq.dus,
            shading: window.selectedForReq.shading,
            keterangan: window.selectedForReq.keterangan,
            "customer aktual": window.selectedForReq.customer_aktual,
            nama_item_req: namaReq,
            panjang_req: pjgReq,
            grade_req: gradeReq,
            dus_req: dusReq,
            shading_req: shadingReq,
            qty_req: qtyReq.toString(),
            qty_hasil: qtyHasil.toString(),
            qty_proses: "0",
            progres_konversi: "PENDING"
        };

        const { error } = await db.from('request_konversi').insert([payload]);
        if(error) throw error;
        
        window.tutupModalReqKonversi();
        alert("Berhasil membuat Request Konversi!");
    } catch(e) {
        alert("Gagal menyimpan request: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// ========================================================
// FUNGSI PROSES KARTU STOK (GANTI CUSTOMER)
// ========================================================
window.prosesKartuStok = async function(encodedDataStr) {
    const data = JSON.parse(decodeURIComponent(encodedDataStr));
    
    // Ambil data yang relevan dari baris yang diklik
    const area = data.area || '-';
    const jenis_item = data.jenis_item || data.jenis || '-';
    const nama_item = data.nama_item || data.nama || '-';
    const panjang = data.panjang || data.pjg || '-';
    const grade = data.grade || '-';
    const dus = data.dus || '-';
    const shading = data.shading || '-';
    const customer_aktual_awal = data.po_aktual || data.po || '-';
    const customer_aktual_request = data.customer_estimasi || '-';
    const qty_request = (data.qty || 0).toString();
    const id_sku = data.id_sku_base || data.id_sku || '-';

    if(!confirm(`Ajukan request ganti customer untuk item ini?\n\nItem: ${nama_item}\nCustomer Aktual: ${customer_aktual_awal}\nCustomer Request: ${customer_aktual_request}\nQty: ${qty_request} Dus`)) return;

    const payload = {
        area: area,
        jenis_item: jenis_item,
        nama_item: nama_item,
        panjang: panjang,
        grade: grade,
        dus: dus,
        shading: shading,
        customer_aktual_awal: customer_aktual_awal,
        customer_aktual_request: customer_aktual_request,
        qty_request: qty_request,
        qty_proses: "0",
        id_sku: id_sku
    };

    try {
        const { error } = await db.from('ganti_customer').insert([payload]);
        if(error) throw error;
        alert("Berhasil mengirim request ke tabel Ganti Customer!");
    } catch(e) {
        alert("Gagal mengirim request: " + e.message);
    }
};
