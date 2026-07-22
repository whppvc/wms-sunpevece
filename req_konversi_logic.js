window.rawData = []; 
window.stokKonvRaw = [];
window.sortState = {}; 

window.currentTab = 'REQUEST'; 
window.currentPage = 1;
window.rowsPerPage = 10; 
window.activeFilters = {}; 
window.currentFilterCol = ''; 
window.selectAllState = 0; 
window.userColOrder = []; 

// State untuk Proses Konversi
window.activeRequestRow = null;
window.jenisProsesKonv = ''; // 'OUT' atau 'IN'
window.scannedValidItems = [];

window.safeJSONParse = function(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
};

window.currentUser = window.safeJSONParse(localStorage.getItem('user_session'), {username: 'Admin', role: 'admin'});

window.formatWIB = function(isoString) {
    if (!isoString || isoString === '-') return '-';
    try {
        const dt = new Date(isoString);
        if (isNaN(dt.getTime())) return isoString;
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(dt).replace(/\./g, ':');
    } catch(e) { return isoString; }
};

// REVISI: HELPER FORMAT PANJANG DENGAN AKHIRAN 'M'
function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) {
        str += 'M';
    }
    return str;
}

window.loadUserPreferences = function() {
    const savedOrder = localStorage.getItem(`col_order_req_${window.currentUser.username}`);
    if (savedOrder) { try { window.userColOrder = JSON.parse(savedOrder); } catch(e) { window.userColOrder = []; } } 
    else { window.userColOrder = []; }
    
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

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'req_konversi', title: 'REQUEST KONVERSI', url: 'req_konversi.html' });
    
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

    window.loadUserPreferences(); 
    setTimeout(window.muatData, 200);
});

window.toggleActionMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('mobile-action-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-proses-pilih').classList.add('hidden');
    document.getElementById('modal-scan-konv').classList.add('hidden');
    document.getElementById('modal-error-konv').classList.add('hidden');
    document.getElementById('modal-konfirmasi-konv').classList.add('hidden');
    if(document.getElementById('sidebar-kolom')) document.getElementById('sidebar-kolom').classList.add('translate-x-full');
};

window.setModeReq = function(mode) {
    window.currentTab = mode;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    document.getElementById('tab-req').className = mode === 'REQUEST' ? activeClass : inactiveClass;
    document.getElementById('tab-konv').className = mode === 'KONVERSI' ? activeClass : inactiveClass;
    
    const isReq = mode === 'REQUEST';
    document.getElementById('btn-proses-konv').classList.toggle('hidden', !isReq);
    document.getElementById('btn-done-konv').classList.toggle('hidden', !isReq);
    document.getElementById('btn-undone-konv').classList.toggle('hidden', !isReq);
    document.getElementById('btn-cancel-konv').classList.toggle('hidden', !isReq);
    
    const btnHapusMob = document.getElementById('btn-hapus-req-mob');
    if(btnHapusMob) btnHapusMob.classList.toggle('hidden', !isReq);

    window.activeFilters = {};
    window.renderTabel();
};

window.muatData = async function() {
    const tbody = document.getElementById('tbody-req');
    tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500 text-sm">Menarik Data...</p></td></tr>`;
    lucide.createIcons();

    try {
        const [resReq, resStok] = await Promise.all([
            db.from('request_konversi').select('*').order('created_at', { ascending: false }),
            db.from('stok_konversi').select('*').order('created_at', { ascending: false })
        ]);
        
        if(resReq.error) throw resReq.error;
        if(resStok.error) throw resStok.error;

        window.rawData = resReq.data || [];
        window.stokKonvRaw = resStok.data || [];
        
        window.setModeReq(window.currentTab);
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center text-red-500 font-medium">Gagal: ${e.message}</td></tr>`; 
    }
};

function thSort(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-progres'].includes(colClass);
    
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
}
window.thSort = thSort; 

window.renderTabel = function() {
    const thead = document.getElementById('thead-req');
    const tbody = document.getElementById('tbody-req');
    window.sortState = {}; window.selectAllState = 0;

    const rowClassBase = "transition r-row text-[13px]";

    if(window.currentTab === 'REQUEST') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${window.thSort(1, 'Kode Konversi', 'col-kode')}
                ${window.thSort(2, 'Tgl Request', 'col-tgl')}
                ${window.thSort(3, 'Detail Item Asal', 'col-asal')}
                ${window.thSort(4, 'Request Konversi', 'col-req')}
                ${window.thSort(5, 'Qty Req', 'col-qty_req')}
                ${window.thSort(6, 'Qty Hasil', 'col-qty_hasil')}
                ${window.thSort(7, 'Qty Out', 'col-qty_out')}
                ${window.thSort(8, 'Qty In', 'col-qty_in')}
                ${window.thSort(9, 'Progres', 'col-progres')}
                ${window.thSort(10, 'PIC Request', 'col-pic')}
            </tr>`;
        
        if(window.rawData.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="p-8 text-center font-medium text-slate-400">Tidak ada data request.</td></tr>`; return; }

        tbody.innerHTML = window.rawData.map((r) => {
            const tgl = window.formatWIB(r.created_at);
            const pjgAsal = formatPanjang(r.panjang);
            const pjgReqStr = formatPanjang(r.panjang_req);
            
            const detailAsal = `
                <div class="text-[12px] font-bold text-slate-600 leading-snug">
                    Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | 
                    <span class="text-slate-800">${r.nama_item || '-'}</span> | 
                    <span class="text-slate-800">${pjgAsal}</span> | 
                    <span class="text-slate-800">${r.grade || '-'}</span> | 
                    <span class="text-slate-800">${r.dus || '-'}</span> | 
                    <span class="text-blue-600">${r.shading || '-'}</span>
                </div>
                <div class="text-[12px] font-bold text-slate-600 mt-1">Customer Aktual: <span class="text-orange-600">${r['customer aktual'] || '-'}</span></div>
                <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                <div class="text-[12px] font-bold text-slate-600">Area: <span class="text-emerald-600">${r.area || '-'}</span></div>
            `;
            const searchAsal = `${r.nama_item} ${pjgAsal} ${r.grade} ${r.dus} ${r.shading} ${r['customer aktual']} ${r.area}`;
            
            let reqArr = [];
            if(r.nama_item_req && r.nama_item_req !== r.nama_item) reqArr.push(`Nama: <span class="text-blue-600">${r.nama_item_req}</span>`);
            if(r.panjang_req && pjgReqStr !== pjgAsal) reqArr.push(`Panjang: <span class="text-slate-800">${pjgReqStr}</span>`);
            if(r.grade_req && r.grade_req !== r.grade) reqArr.push(`Grade: <span class="text-slate-800">${r.grade_req}</span>`);
            if(r.dus_req && r.dus_req !== r.dus) reqArr.push(`Dus: <span class="text-slate-800">${r.dus_req}</span>`);
            if(r.shading_req && r.shading_req !== r.shading) reqArr.push(`Shading: <span class="text-blue-600">${r.shading_req}</span>`);
            
            const detailReq = reqArr.length > 0 ? `<div class="text-[12px] font-bold text-slate-600">${reqArr.join(' | ')}</div>` : '<span class="text-slate-400 italic text-xs">Tidak ada perubahan spesifikasi</span>';
            const searchReq = `${r.nama_item_req} ${pjgReqStr} ${r.grade_req} ${r.dus_req} ${r.shading_req}`;

            let qtyOutNum = parseInt(r.qty_out) || 0;
            let qtyInNum = parseInt(r.qty_in) || 0;
            let rawProg = (r.progres_konversi || 'PENDING').toUpperCase();

            let displayProg = 'REQUEST';
            let badgeProgres = `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold text-[10px] border border-blue-200">REQUEST</span>`;

            if (rawProg === 'DONE') {
                displayProg = 'DONE';
                badgeProgres = `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-[10px] border border-emerald-200">DONE</span>`;
            } else if (qtyOutNum > 0 || qtyInNum > 0 || rawProg === 'PROSES') {
                displayProg = 'PROSES';
                badgeProgres = `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-[10px] border border-amber-200">PROSES</span>`;
            }

            return `
                <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-black text-slate-800 text-center tracking-wider col-kode" data-search="${r.kode_konversi || '-'}">${r.kode_konversi || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-center col-tgl" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 text-left col-asal" data-search="${searchAsal}">${detailAsal}</td>
                    <td class="px-4 py-3 text-left col-req" data-search="${searchReq}">${detailReq}</td>
                    <td class="px-4 py-3 font-black text-slate-700 text-center col-qty_req" data-search="${r.qty_req || 0}">${r.qty_req || 0}</td>
                    <td class="px-4 py-3 font-black text-indigo-600 text-center col-qty_hasil" data-search="${r.qty_hasil || 0}">${r.qty_hasil || 0}</td>
                    <td class="px-4 py-3 font-black text-rose-600 text-center col-qty_out" data-search="${r.qty_out || 0}">${r.qty_out || 0}</td>
                    <td class="px-4 py-3 font-black text-emerald-600 text-center col-qty_in" data-search="${r.qty_in || 0}">${r.qty_in || 0}</td>
                    <td class="px-4 py-3 text-center col-progres" data-search="${displayProg}">${badgeProgres}</td>
                    <td class="px-4 py-3 font-bold uppercase text-xs text-slate-400 text-center col-pic" data-search="${r.pic_request || '-'}">${r.pic_request || '-'}</td>
                </tr>`;
        }).join('');
    } 
    else if(window.currentTab === 'KONVERSI') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center sticky-col">
                    <button id="btn-select-all" onclick="window.cycleSelectAll()" class="w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto" title="Klik untuk Pilih Semua"></button>
                </th>
                ${window.thSort(1, 'Waktu', 'col-waktu')}
                ${window.thSort(2, 'Kode Konversi', 'col-kode')}
                ${window.thSort(3, 'Aktifitas', 'col-aktifitas')}
                ${window.thSort(4, 'QRCode', 'col-qr')}
                ${window.thSort(5, 'Nama Item', 'col-nama')}
                ${window.thSort(6, 'Pjg', 'col-pjg')}
                ${window.thSort(7, 'Grade', 'col-grade')}
                ${window.thSort(8, 'Dus', 'col-dus')}
                ${window.thSort(9, 'Shading', 'col-shading')}
                ${window.thSort(10, 'Customer', 'col-cust')}
                ${window.thSort(11, 'Area', 'col-area')}
                ${window.thSort(12, 'PIC', 'col-pic')}
                ${window.thSort(13, 'Status', 'col-status')}
            </tr>`;
        
        if(window.stokKonvRaw.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="p-8 text-center font-medium text-slate-400">Tidak ada data stok konversi.</td></tr>`; return; }

        let doneKodes = new Set();
        window.rawData.forEach(rq => {
            if((rq.progres_konversi || '').toUpperCase() === 'DONE') {
                doneKodes.add(rq.kode_konversi);
            }
        });

        tbody.innerHTML = window.stokKonvRaw.map((r) => {
            const tgl = window.formatWIB(r.created_at);
            const pjgFormatted = formatPanjang(r.panjang); // REVISI: Pastikan akhiran 'M' selalu ada
            
            let aktText = r.aktifitas || '-';
            let aktClass = "text-slate-600 font-bold";
            if (aktText.toLowerCase().includes('in')) {
                aktClass = "text-emerald-600 font-bold";
            } else if (aktText.toLowerCase().includes('out')) {
                aktClass = "text-rose-600 font-bold";
            }

            // REVISI: Status murni mengikuti apakah kode konversi induknya sudah DONE di request_konversi
            let isDone = doneKodes.has(r.kode_konversi);
            let displayStatus = isDone ? 'DONE' : 'PROSES';
            let badgeStatus = isDone 
                ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-[10px] border border-emerald-200">DONE</span>`
                : `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-[10px] border border-amber-200">PROSES</span>`;

            return `
                <tr class="transition r-row text-[13px] bg-white even:bg-slate-50 border-b border-slate-200">
                    <td class="px-4 py-3 text-center col-cb sticky-col"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-center col-waktu" data-search="${tgl}">${tgl}</td>
                    <td class="px-4 py-3 font-black text-slate-800 text-center tracking-wider col-kode" data-search="${r.kode_konversi || '-'}">${r.kode_konversi || '-'}</td>
                    <td class="px-4 py-3 text-center uppercase col-aktifitas ${aktClass}" data-search="${aktText}">${aktText}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900 text-left col-qr" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-pjg" data-search="${pjgFormatted}">${pjgFormatted}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 text-center col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                    <td class="px-4 py-3 font-semibold text-slate-900 text-left col-cust" data-search="${r.customer_aktual || '-'}">${r.customer_aktual || '-'}</td>
                    <td class="px-4 py-3 font-semibold text-emerald-600 text-center col-area" data-search="${r.area || '-'}">${r.area || '-'}</td>
                    <td class="px-4 py-3 font-bold uppercase text-xs text-slate-400 text-center col-pic" data-search="${r.pic || '-'}">${r.pic || '-'}</td>
                    <td class="px-4 py-3 text-center col-status" data-search="${displayStatus}">${badgeStatus}</td>
                </tr>`;
        }).join('');
    }

    window.applyColumnOrder(); 
    lucide.createIcons(); 
    window.updateSelectAllUI();
    window.saringTabelExcel(); 
    window.initResizableColumns(); 
};

// ==========================================
// LOGIKA PROSES KONVERSI (OUT / IN)
// ==========================================
window.bukaModalProsesKonv = function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length !== 1) return alert("Pilih TEPAT 1 baris request yang ingin diproses!");
    
    const idReq = checked[0].value;
    window.activeRequestRow = window.rawData.find(r => r.id == idReq);
    
    if(window.activeRequestRow.progres_konversi === 'DONE') return alert("Request ini sudah selesai (DONE)!");

    document.getElementById('modal-proses-pilih').classList.remove('hidden');
};

window.pilihJenisProses = function(jenis) {
    window.jenisProsesKonv = jenis;
    document.getElementById('modal-proses-pilih').classList.add('hidden');
    
    const title = document.getElementById('title-scan-konv');
    
    if(jenis === 'OUT') {
        title.innerHTML = '<i data-lucide="log-out" class="text-rose-600"></i> PROSES KONVERSI OUT';
    } else {
        title.innerHTML = '<i data-lucide="log-in" class="text-emerald-600"></i> PROSES KONVERSI IN';
    }
    
    document.getElementById('input-scan-konv').value = '';
    document.getElementById('modal-scan-konv').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-scan-konv').focus(), 100);
    lucide.createIcons();
};

window.verifikasiKodeKonv = async function() {
    const rawInput = document.getElementById('input-scan-konv').value.trim();
    if(!rawInput) return alert("Masukkan kode QR!");
    
    const btn = document.getElementById('btn-verifikasi-konv'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Mengecek...'; btn.disabled = true;

    const qrs = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    try {
        const [resGlobal, resKonv] = await Promise.all([
            db.from('stok_global').select('*').in('qrcode', qrs),
            db.from('stok_konversi').select('*').in('qrcode', qrs)
        ]);

        if(resGlobal.error) throw resGlobal.error;
        if(resKonv.error) throw resKonv.error;

        const globalData = resGlobal.data || [];
        const konvData = resKonv.data || [];

        let invalidQrs = [];
        window.scannedValidItems = [];

        qrs.forEach(qr => {
            const itemGlobal = globalData.find(g => g.qrcode === qr);
            const itemKonv = konvData.find(k => k.qrcode === qr);

            if(window.jenisProsesKonv === 'OUT') {
                if(itemGlobal && !itemKonv) {
                    if(itemGlobal.nama_item !== window.activeRequestRow.nama_item || 
                       formatPanjang(itemGlobal.panjang) !== formatPanjang(window.activeRequestRow.panjang) || 
                       itemGlobal.grade !== window.activeRequestRow.grade) {
                        invalidQrs.push({ qr: qr, reason: "Spesifikasi tidak cocok dengan request asal!" });
                    } else {
                        window.scannedValidItems.push(itemGlobal);
                    }
                } else if(!itemGlobal && itemKonv) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item sudah dikonversi OUT sebelumnya." });
                } else if(!itemGlobal && !itemKonv) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item tidak ditemukan di stok_global." });
                } else {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Duplikat data." });
                }
            } else {
                if(itemGlobal) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item sudah ada di stok_global (gudang)." });
                } else if(itemKonv) {
                    invalidQrs.push({ qr: qr, reason: "Gagal! Item sudah tercatat di stok_konversi." });
                } else {
                    const td = window.translateBarcode(qr);
                    window.scannedValidItems.push({ qrcode: qr, ...td });
                }
            }
        });

        if(invalidQrs.length > 0) {
            document.getElementById('lbl-error-count').innerText = invalidQrs.length;
            document.getElementById('list-error-konv').innerHTML = invalidQrs.map(err => `
                <li class="border-b border-rose-200/50 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0">
                    <span class="block text-slate-800 font-black mb-1">${err.qr}</span>
                    <span class="block text-[10px] text-rose-600 font-medium leading-tight">Gagal: ${err.reason}</span>
                </li>
            `).join('');
            document.getElementById('modal-error-konv').classList.remove('hidden');
            btn.innerHTML = ori; btn.disabled = false; return;
        }

        let html = '';
        window.scannedValidItems.forEach((item, idx) => {
            let pjgStr = formatPanjang(item.panjang || item.panjang);
            let detail = `${item.nama_item || item.namaItem} | ${pjgStr} | ${item.grade || item.grade}`;
            html += `<tr class="hover:bg-slate-50 transition">
                <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-slate-800">${item.qrcode}</td>
                <td class="p-3 font-medium text-slate-600">${detail}</td>
            </tr>`;
        });
        
        document.getElementById('lbl-jml-valid').innerText = window.scannedValidItems.length;
        document.getElementById('tbody-konfirmasi-konv').innerHTML = html;
        
        document.getElementById('modal-scan-konv').classList.add('hidden');
        document.getElementById('modal-konfirmasi-konv').classList.remove('hidden');

    } catch(e) {
        alert("Gagal verifikasi: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
};

window.eksekusiSaveKonv = async function() {
    const btn = document.getElementById('btn-eksekusi-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        if(window.jenisProsesKonv === 'OUT') {
            let insertsKonv = [];
            let qrs = window.scannedValidItems.map(item => item.qrcode);

            for(let item of window.scannedValidItems) {
                let pjgFormatted = formatPanjang(item.panjang);

                insertsKonv.push({
                    kode_konversi: window.activeRequestRow.kode_konversi,
                    aktifitas: 'Konversi Out',
                    qrcode: item.qrcode,
                    tgl_produksi: item.tgl_produksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenis_item,
                    nama_item: item.nama_item,
                    panjang: pjgFormatted, // REVISI: Selalu simpan Panjang bertanda 'M'
                    grade: item.grade,
                    dus: item.dus,
                    shading: item.shading,
                    customer_aktual: item.customer_aktual,
                    keterangan: item.keterangan || '-',
                    pic: window.currentUser.username,
                    area: item.area,
                    status: 'PENDING', // REVISI: Status tetap PENDING
                    id_sku: item.id_sku
                });

                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                    .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual)
                    .eq('konversi', window.activeRequestRow.kode_konversi) 
                    .limit(1);
                
                if(ext && ext.length > 0) {
                    let newQty = ext[0].qty - 1;
                    if(newQty <= 0) await db.from('stok_aktual').delete().eq('id', ext[0].id);
                    else await db.from('stok_aktual').update({qty: newQty}).eq('id', ext[0].id);
                }
            }

            await db.from('stok_global').delete().in('qrcode', qrs);
            await db.from('stok_qr').delete().in('qrcode', qrs);
            await db.from('stok_konversi').insert(insertsKonv);

            let newQtyOut = (parseInt(window.activeRequestRow.qty_out) || 0) + qrs.length;
            await db.from('request_konversi').update({ qty_out: newQtyOut.toString(), progres_konversi: 'PROSES' }).eq('id', window.activeRequestRow.id);

        } else {
            // PROSES IN
            let insertsKonv = [];
            let insertsGlobal = [];
            let insertsStokQr = [];
            let qrs = window.scannedValidItems.map(item => item.qrcode);

            let nama = window.activeRequestRow.nama_item_req || window.activeRequestRow.nama_item;
            let rawPjg = window.activeRequestRow.panjang_req || window.activeRequestRow.panjang;
            let pjg = formatPanjang(rawPjg); // REVISI: Dipastikan berakhiran 'M'
            
            let grade = window.activeRequestRow.grade_req || window.activeRequestRow.grade;
            let dus = window.activeRequestRow.dus_req || window.activeRequestRow.dus;
            let shading = window.activeRequestRow.shading_req || window.activeRequestRow.shading;
            let area = window.activeRequestRow.area;
            let customer = window.activeRequestRow['customer aktual'];
            let ket = window.activeRequestRow.keterangan || '-';
            let kondisi = 'Aman';

            let new_id_sku = `${area}_${nama}_${pjg}_${grade}_${dus}_${shading}_${ket}_${customer}_${kondisi}`;

            for(let item of window.scannedValidItems) {
                insertsKonv.push({
                    kode_konversi: window.activeRequestRow.kode_konversi,
                    aktifitas: 'Konversi In',
                    qrcode: item.qrcode,
                    tgl_produksi: item.tglProduksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenisItem,
                    nama_item: nama,
                    panjang: pjg, // REVISI: 'M' dipastikan ada
                    grade: grade,
                    dus: dus,
                    shading: shading,
                    customer_aktual: customer,
                    keterangan: ket,
                    pic: window.currentUser.username,
                    area: area,
                    status: 'PENDING', // REVISI: Disimpan sebagai PENDING (Bukan DONE)
                    id_sku: new_id_sku
                });

                insertsGlobal.push({
                    qrcode: item.qrcode,
                    area: area,
                    id_sku: new_id_sku,
                    tgl_produksi: item.tglProduksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenisItem,
                    nama_item: nama,
                    panjang: pjg, // REVISI: 'M' dipastikan ada
                    grade: grade,
                    dus: dus,
                    shading: shading,
                    customer_aktual: customer,
                    keterangan: ket,
                    kondisi: kondisi,
                    pic_input: window.currentUser.username,
                    jalur_masuk: 'konversi'
                });

                insertsStokQr.push({
                    qrcode: item.qrcode,
                    id_sku: new_id_sku,
                    area: area,
                    keterangan: ket
                });

                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', nama).eq('panjang', pjg).eq('grade', grade)
                    .eq('dus', dus).eq('shading', shading).eq('area', area)
                    .eq('customer_aktual', customer)
                    .eq('keterangan', ket)
                    .limit(1);
                
                if(ext && ext.length > 0) {
                    await db.from('stok_aktual').update({qty: ext[0].qty + 1}).eq('id', ext[0].id);
                } else {
                    await db.from('stok_aktual').insert([{
                        id_sku: new_id_sku, jenis_item: item.jenisItem, nama_item: nama, panjang: pjg, 
                        grade: grade, dus: dus, shading: shading, area: area, 
                        customer_aktual: customer, customer_estimasi: customer, keterangan: ket, qty: 1
                    }]);
                }
            }

            await db.from('stok_global').insert(insertsGlobal);
            await db.from('stok_qr').insert(insertsStokQr);
            await db.from('stok_konversi').insert(insertsKonv);

            let newQtyIn = (parseInt(window.activeRequestRow.qty_in) || 0) + qrs.length;
            await db.from('request_konversi').update({ qty_in: newQtyIn.toString(), progres_konversi: 'PROSES' }).eq('id', window.activeRequestRow.id);
        }

        alert("✅ BERHASIL MEMPROSES KONVERSI!");
        document.getElementById('modal-konfirmasi-konv').classList.add('hidden');
        window.muatData();

    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
};

// ==========================================
// LOGIKA DONE / UNDONE / CANCEL KONVERSI
// ==========================================
window.doneKonversiMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris request yang ingin di-Done kan!");
    
    if(!confirm(`Yakin ingin menyelesaikan (Done) ${checked.length} request konversi ini?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        await db.from('request_konversi').update({ progres_konversi: 'DONE' }).in('id', ids);
        alert("Status berhasil diubah menjadi DONE!");
        window.muatData();
    } catch(e) { alert("Gagal: " + e.message); }
};

window.undoneKonversiMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris request yang ingin di-Undone kan!");
    
    if(!confirm(`Yakin ingin mengembalikan status ${checked.length} request konversi ini menjadi PROSES?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        await db.from('request_konversi').update({ progres_konversi: 'PROSES' }).in('id', ids);
        alert("Status berhasil dikembalikan menjadi PROSES!");
        window.muatData();
    } catch(e) { alert("Gagal: " + e.message); }
};

window.cancelKonversiMassal = async function() {
    const checked = document.querySelectorAll('.cb-main:checked');
    if(checked.length === 0) return alert("Pilih baris request yang ingin di-Cancel!");
    
    const selectedRequests = window.rawData.filter(r => Array.from(checked).map(cb => cb.value).includes(r.id.toString()));
    
    const hasDone = selectedRequests.some(r => r.progres_konversi === 'DONE');
    if(hasDone) return alert("Gagal! Request yang sudah berstatus DONE tidak bisa di-cancel.");

    if(!confirm(`⚠️ PERHATIAN!\n\nCancel Konversi akan menghapus request dan otomatis MENGEMBALIKAN seluruh barang yang sudah dikonversi OUT kembali ke Gudang.\n\nApakah Anda yakin ingin membatalkan ${selectedRequests.length} request ini?`)) return;

    const btn = document.getElementById('btn-cancel-konv'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Membatalkan...'; btn.disabled = true;

    const kodes = selectedRequests.map(r => r.kode_konversi);

    try {
        const { data: itemsKonv, error: errKonv } = await db.from('stok_konversi')
            .select('*')
            .in('kode_konversi', kodes)
            .eq('aktifitas', 'Konversi Out');
        
        if(errKonv) throw errKonv;

        if(itemsKonv && itemsKonv.length > 0) {
            let insertsGlobal = [];
            let insertsStokQr = [];

            for(let item of itemsKonv) {
                let pjgFormatted = formatPanjang(item.panjang);

                insertsGlobal.push({
                    qrcode: item.qrcode,
                    area: item.area,
                    id_sku: item.id_sku,
                    tgl_produksi: item.tgl_produksi,
                    mesin: item.mesin,
                    shift: item.shift,
                    jenis_item: item.jenis_item,
                    nama_item: item.nama_item,
                    panjang: pjgFormatted,
                    grade: item.grade,
                    dus: item.dus,
                    shading: item.shading,
                    customer_aktual: item.customer_aktual,
                    keterangan: item.keterangan || '-',
                    kondisi: 'Aman',
                    pic_input: window.currentUser.username,
                    jalur_masuk: 'konversi-cancel'
                });

                insertsStokQr.push({
                    qrcode: item.qrcode,
                    id_sku: item.id_sku,
                    area: item.area,
                    keterangan: item.keterangan || '-'
                });

                const { data: ext } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', item.nama_item).eq('panjang', pjgFormatted).eq('grade', item.grade)
                    .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                    .eq('customer_aktual', item.customer_aktual)
                    .eq('konversi', item.kode_konversi)
                    .limit(1);
                
                if(ext && ext.length > 0) {
                    await db.from('stok_aktual').update({qty: ext[0].qty + 1}).eq('id', ext[0].id);
                } else {
                    await db.from('stok_aktual').insert([{
                        id_sku: item.id_sku, jenis_item: item.jenis_item, nama_item: item.nama_item, panjang: pjgFormatted, 
                        grade: item.grade, dus: item.dus, shading: item.shading, area: item.area, 
                        customer_aktual: item.customer_aktual, customer_estimasi: item.customer_aktual, keterangan: item.keterangan || '-', qty: 1, konversi: item.kode_konversi
                    }]);
                }
            }

            await db.from('stok_global').insert(insertsGlobal);
            await db.from('stok_qr').insert(insertsStokQr);
        }

        for(let req of selectedRequests) {
            const { data: rowKonv } = await db.from('stok_aktual').select('*')
                .eq('konversi', req.kode_konversi)
                .limit(1);
            
            if(rowKonv && rowKonv.length > 0) {
                let qtyRevert = rowKonv[0].qty;
                
                const { data: rowNormal } = await db.from('stok_aktual').select('id, qty')
                    .eq('nama_item', req.nama_item).eq('panjang', formatPanjang(req.panjang)).eq('grade', req.grade)
                    .eq('dus', req.dus).eq('shading', req.shading).eq('area', req.area)
                    .eq('customer_aktual', req['customer aktual'])
                    .is('konversi', null)
                    .limit(1);
                
                if(rowNormal && rowNormal.length > 0) {
                    await db.from('stok_aktual').update({ qty: rowNormal[0].qty + qtyRevert }).eq('id', rowNormal[0].id);
                    await db.from('stok_aktual').delete().eq('id', rowKonv[0].id);
                } else {
                    await db.from('stok_aktual').update({ konversi: null }).eq('id', rowKonv[0].id);
                }
            }
        }

        await db.from('stok_konversi').delete().in('kode_konversi', kodes);
        await db.from('request_konversi').delete().in('kode_konversi', kodes);

        alert(`✅ BERHASIL!\nRequest konversi dibatalkan dan barang telah dikembalikan ke Gudang secara utuh.`);
        window.muatData();

    } catch(e) {
        alert("Gagal membatalkan request: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

// ==========================================
// FUNGSI STANDAR (PAGINASI, FILTER, EXCEL)
// ==========================================
window.highlightRow = function(checkbox, skipStateReset = false) {
    const tr = checkbox.closest('tr');
    if (checkbox.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
    
    if(!skipStateReset && !checkbox.checked && window.selectAllState !== 0) { window.selectAllState = 0; window.updateSelectAllUI(); }
    if(!skipStateReset) window.updateSelectedCount();
};

window.changeRowsPerPage = function(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') { window.rowsPerPage = 999999; if(customInput) customInput.classList.add('hidden'); } 
    else if (val === 'CUSTOM') {
        if(customInput) { customInput.classList.remove('hidden'); customInput.focus(); window.rowsPerPage = parseInt(customInput.value) || window.rowsPerPage; }
    } else { window.rowsPerPage = parseInt(val); if(customInput) customInput.classList.add('hidden'); }
    localStorage.setItem('wms_rows_per_page', window.rowsPerPage); window.currentPage = 1; window.applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) { window.rowsPerPage = parsed; localStorage.setItem('wms_rows_per_page', window.rowsPerPage); window.currentPage = 1; window.applyPagination(); }
};

window.applyPagination = function() {
    let tbodyId = 'tbody-req'; 
    const allRows = Array.from(document.querySelectorAll(`#${tbodyId} tr.r-row`));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });

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
        if (index % 2 === 0) row.classList.add('stripe-1'); else row.classList.add('stripe-2');

        const qtyCell = row.querySelector('.col-qty_req') || row.querySelector('.col-dus');
        if(qtyCell) { sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; } 

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = window.currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if (window.selectAllState === 1) { window.selectAllState = 0; window.updateSelectAllUI(); }
    window.applySelection(); window.updateSelectedCount();
};

window.prevPage = function() { if(window.currentPage > 1) { window.currentPage--; window.applyPagination(); } };
window.nextPage = function() { const totalVisible = document.querySelectorAll('#tbody-req tr.r-row:not(.filtered-out)').length; if(window.currentPage < Math.ceil(totalVisible / window.rowsPerPage)) { window.currentPage++; window.applyPagination(); } };
window.updateSelectedCount = function() { const count = document.querySelectorAll('.cb-main:checked').length; if(document.getElementById('lbl-pilih-baris')) document.getElementById('lbl-pilih-baris').innerText = count; };

window.cycleSelectAll = function() { window.selectAllState = (window.selectAllState + 1) % 3; window.updateSelectAllUI(); window.applySelection(); };
window.updateSelectAllUI = function() {
    const btn = document.getElementById('btn-select-all'); if(!btn) return;
    if (window.selectAllState === 0) { btn.innerHTML = ''; btn.className = 'w-4 h-4 border border-slate-400 rounded flex items-center justify-center bg-white transition mx-auto'; } 
    else if (window.selectAllState === 1) { btn.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-blue-600 rounded flex items-center justify-center bg-blue-600 text-white transition mx-auto'; } 
    else if (window.selectAllState === 2) { btn.innerHTML = '<i data-lucide="check-check" class="w-3 h-3"></i>'; btn.className = 'w-4 h-4 border border-amber-500 rounded flex items-center justify-center bg-amber-500 text-white transition mx-auto'; }
    lucide.createIcons();
};
window.applySelection = function() {
    const allRows = Array.from(document.querySelectorAll('#tbody-req tr.r-row'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const startIndex = (window.currentPage - 1) * window.rowsPerPage; const endIndex = startIndex + window.rowsPerPage;

    if (window.selectAllState === 0) { allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }); } 
    else if (window.selectAllState === 1) {
        allRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } });
        visibleRows.forEach((row, index) => { if(index >= startIndex && index < endIndex) { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; window.highlightRow(cb, true); } } });
    } else if (window.selectAllState === 2) {
        visibleRows.forEach(row => { const cb = row.querySelector('.cb-main'); if(cb) { cb.checked = true; window.highlightRow(cb, true); } });
    }
    window.updateSelectedCount();
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); window.currentFilterCol = colClass; document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    document.querySelectorAll('#tbody-req tr.r-row').forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in window.activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = window.activeFilters[otherCol]; const c = row.querySelector('.' + otherCol);
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
        let isChecked = true; if (window.activeFilters[colClass] && !window.activeFilters[colClass].includes(val)) { isChecked = false; }
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
window.clearFilterForCurrentCol = function() { delete window.activeFilters[window.currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete window.activeFilters[window.currentFilterCol]; } 
    else { let selectedVals = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); window.activeFilters[window.currentFilterCol] = selectedVals; }
    window.closeFilterMenu(); window.saringTabelExcel(); 
};
window.saringTabelExcel = function() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in window.activeFilters) {
            const allowedValues = window.activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { let text = cell.getAttribute('data-search') || cell.innerText.trim(); if (!allowedValues.includes(text)) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-main'); if(cb) { cb.checked = false; window.highlightRow(cb, true); } }
    });
    window.selectAllState = 0; window.updateSelectAllUI(); window.currentPage = 1; window.applyPagination(); window.updateFilterIcons();
};
window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('text-white', 'opacity-40'); });
    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-white', 'opacity-40'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};

window.salinData = function() {
    const cek = document.querySelectorAll('.cb-main:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin!");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
            if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(val.replace(/\n/g, ' ')); }
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => { alert("Berhasil menyalin!"); }).catch(err => { alert("Browser menolak akses Clipboard."); });
};

window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat.");
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);
    document.querySelectorAll('.r-row').forEach(tr => {
        if(tr.style.display !== 'none' && tr.querySelector('.cb-main:checked')) {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
                if(window.getComputedStyle(td).display !== 'none') { let val = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim(); rowData.push(`"${val.replace(/\n/g, ' ')}"`); }
            });
            ws_data.push(rowData);
        }
    });
    if(ws_data.length <= 1) return alert("Pilih minimal 1 baris data untuk di-export!");
    let ws = XLSX.utils.aoa_to_sheet(ws_data); let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Request_Konversi"); XLSX.writeFile(wb, `Request_Konversi.xlsx`);
};

window.toggleSidebarKolom = function() {
    const sidebar = document.getElementById('sidebar-kolom'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); window.renderDragList(); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

window.renderDragList = function() {
    const container = document.getElementById('kolom-drag-container'); if(!container) return; container.innerHTML = '';
    const headers = Array.from(document.querySelectorAll('#thead-req th')).filter(th => th && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'));
    headers.forEach(th => {
        const colClass = Array.from(th.classList).find(c => c.startsWith('col-')) || ''; const label = th.innerText.trim() || 'Kolom';
        const div = document.createElement('div'); div.className = 'drag-item flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:border-blue-400 transition cursor-grab'; div.draggable = true; div.setAttribute('data-col', colClass);
        div.innerHTML = `<span class="font-bold text-slate-700 text-xs">${label}</span><i data-lucide="grip-vertical" class="w-4 h-4 text-slate-400"></i>`;
        div.addEventListener('dragstart', () => { div.classList.add('dragging'); }); div.addEventListener('dragend', () => { div.classList.remove('dragging'); });
        container.appendChild(div);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
    container.addEventListener('dragover', e => {
        e.preventDefault(); const afterElement = window.getDragAfterElement(container, e.clientY); const draggable = document.querySelector('.dragging');
        if (draggable) { if (afterElement == null) { container.appendChild(draggable); } else { container.insertBefore(draggable, afterElement); } }
    });
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
    window.userColOrder = newOrder; localStorage.setItem(`col_order_req_${window.currentUser.username}`, JSON.stringify(newOrder));
    alert("Urutan kolom berhasil disimpan!"); window.toggleSidebarKolom(); window.renderTabel(); 
};

window.resetUrutanKolom = function() {
    if(!confirm("Kembalikan urutan kolom ke default?")) return;
    window.userColOrder = []; localStorage.removeItem(`col_order_req_${window.currentUser.username}`);
    alert("Urutan dikembalikan ke default."); window.toggleSidebarKolom(); window.renderTabel();
};

window.applyColumnOrder = function() {
    if (!window.userColOrder || window.userColOrder.length === 0) return;
    const table = document.getElementById('main-table'); const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = Array.from(row.children); if (cells.length <= 1) return; 
        const cbCell = cells.find(c => c.classList.contains('col-cb')); const btnCell = cells.find(c => c.classList.contains('col-btn'));
        const cellMap = {}; cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass) cellMap[colClass] = c; });
        row.innerHTML = ''; if (cbCell) row.appendChild(cbCell); if (btnCell) row.appendChild(btnCell); 
        window.userColOrder.forEach(colId => { if (cellMap[colId]) { row.appendChild(cellMap[colId]); } });
        cells.forEach(c => { const colClass = Array.from(c.classList).find(cls => cls.startsWith('col-')); if (colClass !== 'col-cb' && colClass !== 'col-btn' && !window.userColOrder.includes(colClass)) { row.appendChild(c); } });
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
