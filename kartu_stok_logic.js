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

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

window.currentUser = safeJSONParse(localStorage.getItem('user_session'), { username: 'Admin', role: 'admin' });

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'kartu_stok', title: 'KARTU STOK', url: 'kartu_stok.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                window.closeFilterMenu();
            }
        }
    });

    await window.loadMasterData();
    setTimeout(window.muatDataStok, 200);
});

window.loadMasterData = async function() {
    try {
        const {data, error} = await db.from('master_2').select('*');
        if (data) {
            window.masterData.kamus = data; 
            let poSet = new Set(); 
            data.forEach(d => { if(d.po) poSet.add(d.po.trim()); });
            const sel = document.getElementById('input-new-po'); 
            let html = '<option value="">-- PILIH PO --</option>';
            Array.from(poSet).sort().forEach(po => { html += `<option value="${po}">${po}</option>`; });
            if(sel) sel.innerHTML = html;
        }
    } catch (e) { 
        if(document.getElementById('input-new-po')) document.getElementById('input-new-po').innerHTML = '<option value="">-- GAGAL MEMUAT PO --</option>'; 
    }
};

window.translateBarcode = function(barcode) {
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', po: '-' };
    if(!barcode) return data;
    const parts = barcode.split('/'); if (parts.length < 1) return data;
    const h = barcode.charAt(0).toUpperCase();
    if (h === 'P') data.jenisItem = 'Plafon'; else if (h === 'L') data.jenisItem = 'List'; else if (h === 'W') data.jenisItem = 'WPC'; else data.jenisItem = h;

    let rawItem = parts[0]; data.namaItem = rawItem; data.shading = parts[1] || '-';
    const p2 = parts[2];
    if(p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M";
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); data.dus = rawDus;
    }
    const p3 = parts[3];
    if(p3 && p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        if (!isNaN(dayOfYear) && !isNaN(realYear)) {
            const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
            data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        }
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if(match) { data.mesin = match[1]; data.shift = match[2]; data.po = match[3]; }
    }
    return data;
};

window.sinkronisasiUlangStokAktual = async function(tampilkanAlert = false) {
    const btn = document.getElementById('btn-sync-db');
    if(btn) { btn.innerHTML = '<div class="bg-slate-100 text-teal-600 flex items-center justify-center px-3 py-2.5 border-r border-slate-300"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></div><div class="bg-white text-slate-700 font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-50 transition">Sinkron DB</div>'; btn.disabled = true; }

    try {
        const { data: fisikQr, error: errQr } = await db.from('stok_qr').select('*');
        if(errQr) throw errQr;
        
        let mapAgg = {};
        (fisikQr || []).forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = window.translateBarcode(r.qrcode);
            
            let area = p[0] || r.area || '-';
            let nama = p[1] || r.nama_item || t.namaItem;
            let pjg = p[2] || r.panjang || t.panjang;
            let grade = p[3] || r.grade || t.grade;
            let dus = p[4] || r.dus || t.dus;
            let shading = p[5] || r.shading || t.shading;
            let po = p[6] || r.po_bawaan || t.po || '-';
            let ket = p.length >= 8 ? p.slice(7).join('_') : (r.keterangan || '-');

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
            if(!mapAgg[key]) {
                mapAgg[key] = { 
                    jenis_item: r.jenis_item || t.jenisItem,
                    nama_item: nama, 
                    panjang: pjg, 
                    grade: grade, 
                    dus: dus, 
                    shading: shading, 
                    area: area, 
                    po_aktual: po, 
                    keterangan: ket, 
                    qty: 0 
                };
            }
            mapAgg[key].qty++;
        });

        let dataAktualBaru = Object.values(mapAgg);
        await db.from('stok_aktual').delete().neq('qty', -99999); 

        for(let i = 0; i < dataAktualBaru.length; i += 500) {
            await db.from('stok_aktual').insert(dataAktualBaru.slice(i, i + 500));
        }
        
        if(tampilkanAlert) {
            alert("✅ Sinkronisasi Selesai!\nTabel stok_aktual di database telah diperbarui 100% mengikuti data fisik stok_qr.");
            window.muatDataStok();
        }
    } catch(e) {
        alert("⚠️ GAGAL SINKRONISASI STOK AKTUAL KE SUPABASE!\n" + e.message);
    } finally {
        if(btn) { btn.innerHTML = '<div class="bg-slate-100 text-teal-600 flex items-center justify-center px-3 py-2.5 border-r border-slate-300"><i data-lucide="database-backup" class="w-4 h-4"></i></div><div class="bg-white text-slate-700 font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-50 transition">Sinkron DB</div>'; btn.disabled = false; lucide.createIcons(); }
    }
};

window.muatDataStok = async function() {
    const tbody = document.getElementById('tbody-ks');
    tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-500"></i><p class="font-medium text-slate-500">Menghubungkan ke Gudang Supabase...</p></td></tr>`;
    lucide.createIcons();

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
            if(!aktualMap[key][a.po_aktual]) aktualMap[key][a.po_aktual] = 0;
            aktualMap[key][a.po_aktual] += a.qty;
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
            let po = p[6] || r.po_bawaan || t.po || '-';
            let ket = p.length >= 8 ? p.slice(7).join('_') : (r.keterangan || '-');

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
            if(!qrMap[key]) qrMap[key] = [];
            qrMap[key].push(r.qrcode);
        });

        window.dataKSQR = window.stokQRRaw.map(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = window.translateBarcode(r.qrcode);
            return {
                qrcode: r.qrcode || '-', id_sku: r.id_sku || '-', area: p[0] || r.area || '-', 
                tglProduksi: r.tgl_produksi || t.tglProduksi || '-', mesin: r.mesin || t.mesin || '-', shift: r.shift || t.shift || '-', 
                jenis: r.jenis_item || t.jenisItem || '-', nama: p[1] || r.nama_item || t.namaItem || '-',
                pjg: p[2] || r.panjang || t.panjang || '-', grade: p[3] || r.grade || t.grade || '-', 
                dus: p[4] || r.dus || t.dus || '-', shading: p[5] || r.shading || t.shading || '-',
                po_bawaan: r.po_bawaan || t.po || '-', po_aktual: p[6] || r.po_bawaan || t.po || '-', 
                ket: p.length >= 8 ? p.slice(7).join('_') : (r.keterangan || '-'), id: r.id 
            };
        });

        window.dataKSArea = window.stokAktualRaw.map(a => {
            let key = `${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.area}_${a.po_aktual}_${a.keterangan}`;
            return {
                ...a,
                pjg: a.panjang || '-', 
                jenis: a.jenis_item || '-', 
                nama: a.nama_item || '-',
                qrcodes: qrMap[key] || [],
                id_sku_base: `${a.area}_${a.nama_item}_${a.panjang}_${a.grade}_${a.dus}_${a.shading}_${a.po_aktual}_${a.keterangan}`
            };
        });

        let globalMap = {};
        window.dataKSArea.forEach(a => {
            let gKey = `${a.jenis}_${a.nama}_${a.pjg}_${a.grade}_${a.dus}_${a.shading}_${a.po_aktual}_${a.keterangan}`;
            if(!globalMap[gKey]) {
                globalMap[gKey] = { gKey: gKey, jenis: a.jenis, nama: a.nama, pjg: a.pjg, grade: a.grade, dus: a.dus, shading: a.shading, po: a.po_aktual, ket: a.keterangan, qty: 0, areas: [] };
            }
            globalMap[gKey].qty += a.qty;
            globalMap[gKey].areas.push(a);
        });
        window.dataKSGlobal = Object.values(globalMap);

        window.renderTabel();
    } catch(e) { 
        tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center text-red-500 font-medium">Gagal mengolah data: ${e.message}</td></tr>`; 
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
    
    document.getElementById('btn-ganti-po-main').classList.toggle('hidden', m === 'global' || m === 'lembaran');
    
    window.activeFilters = {}; 
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
    const noFilter = ['col-cb', 'col-open'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="window.openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-200 rounded ml-1 transition text-slate-400 hover:text-slate-700" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon transition-all"></i>
        </button>`;

    return `<th class="hdr-std ${cls} select-none">
        <div class="flex items-center justify-center gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-blue-300 transition" onclick="window.sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

window.renderTabel = function() {
    const thead = document.getElementById('thead-ks');
    const tbody = document.getElementById('tbody-ks');
    window.sortState = {}; 

    if(window.modeKS === 'qr') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="window.toggleCentangUtama(this.checked)" class="cursor-pointer rounded border-slate-300 w-4 h-4 text-blue-600 focus:ring-blue-500"></th>
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
                ${window.thSort(12, 'PO Bawaan', 'col-po-bawaan')}
                ${window.thSort(13, 'PO Aktual', 'col-po')}
                ${window.thSort(14, 'Keterangan', 'col-ket')}
            </tr>`;
        
        if(window.dataKSQR.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="15" class="p-8 text-center font-medium text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = window.dataKSQR.map((r) => {
            const safeQRs = JSON.stringify([r.qrcode]).replace(/"/g, "&quot;");
            
            let baseSpec = `${r.nama}_${r.pjg}_${r.grade}_${r.dus}_${r.shading}`;
            let poDist = window.poDistributionMap[baseSpec];
            let poArr = [];
            if(poDist) {
                for(let po in poDist) {
                    poArr.push(`${po} (${poDist[po]} Dus)`);
                }
            }
            let poString = poArr.length > 0 ? poArr.join(' | ') : 'KOSONG';
            let btnPO = `<button onclick="window.bukaModalLihatPO('${encodeURIComponent(poString)}')" class="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition flex items-center justify-center gap-1 mx-auto w-full max-w-[100px]"><i data-lucide="eye" class="w-3 h-3"></i> Lihat PO</button>`;

            // REVISI 1: Baris selang-seling yang lebih jelas (even:bg-slate-100)
            return `
                <tr class="bg-white even:bg-slate-200 hover:bg-green-200 transition row-ks text-sm border-b border-slate-200">
                    <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="window.highlightRow(this)" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-ket="${r.ket}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-semibold text-emerald-700 col-area" data-search="${r.area}">${r.area}</td>
                    <td class="px-4 py-3 font-mono font-medium text-slate-800 col-qr text-left" data-search="${r.qrcode}">${r.qrcode}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 col-tgl" data-search="${r.tglProduksi}">${r.tglProduksi}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 col-mesin" data-search="${r.mesin}">${r.mesin}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 col-shift" data-search="${r.shift}">${r.shift}</td>
                    <td class="px-4 py-3 font-medium text-blue-600 col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama}">${r.nama}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 col-po-bawaan" data-search="${r.po_bawaan}">${r.po_bawaan}</td>
                    <td class="px-4 py-2 col-po" data-search="${poString}">${btnPO}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 col-ket text-left" data-search="${r.ket}">${r.ket}</td>
                </tr>`;
        }).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="15" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    }
    else if(window.modeKS === 'area') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="window.toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                ${window.thSort(1, 'Area', 'col-area')}
                ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                ${window.thSort(3, 'Nama Item', 'col-nama')}
                ${window.thSort(4, 'Panjang', 'col-pjg')}
                ${window.thSort(5, 'Grade', 'col-grade')}
                ${window.thSort(6, 'Dus', 'col-dus')}
                ${window.thSort(7, 'Shading', 'col-shading')}
                ${window.thSort(8, 'PO Aktual', 'col-po')}
                ${window.thSort(9, 'Keterangan', 'col-ket')}
                ${window.thSort(10, 'Total Qty (Dus)', 'col-qty')}
            </tr>`;
        
        if(window.dataKSArea.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="11" class="p-8 text-center font-medium text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = window.dataKSArea.map((r) => {
            const safeQRs = JSON.stringify(r.qrcodes).replace(/"/g, "&quot;");
            return `
                <tr class="bg-white even:bg-slate-200 hover:bg-green-200 transition row-ks text-sm border-b border-slate-200">
                    <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="window.highlightRow(this)" data-idsku="${r.id_sku_base}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama_item}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-ket="${r.keterangan}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                    <td class="px-4 py-3 font-semibold text-emerald-700 col-area" data-search="${r.area}">${r.area}</td>
                    <td class="px-4 py-3 font-medium text-blue-600 col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                    <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama_item}">${r.nama_item}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade}">${r.grade}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus}">${r.dus}</td>
                    <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading}">${r.shading}</td>
                    <td class="px-4 py-3 font-semibold text-orange-600 col-po" data-search="${r.po_aktual}">${r.po_aktual}</td>
                    <td class="px-4 py-3 font-medium text-slate-500 col-ket text-left" data-search="${r.keterangan}">${r.keterangan}</td>
                    <td class="px-4 py-3 font-black text-emerald-700 col-qty text-base" data-search="${r.qty}">${r.qty}</td>
                </tr>`;
        }).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="11" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    } 
    else if (window.modeKS === 'global') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="window.toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                <th class="hdr-std w-12 col-open text-center">Detail</th>
                ${window.thSort(2, 'Jenis Item', 'col-jenis')}
                ${window.thSort(3, 'Nama Item', 'col-nama')}
                ${window.thSort(4, 'Panjang', 'col-pjg')}
                ${window.thSort(5, 'Grade', 'col-grade')}
                ${window.thSort(6, 'Dus', 'col-dus')}
                ${window.thSort(7, 'Shading', 'col-shading')}
                ${window.thSort(8, 'PO Aktual', 'col-po')}
                ${window.thSort(9, 'Keterangan', 'col-ket')}
                ${window.thSort(10, 'TOTAL (DUS)', 'col-qty')}
            </tr>`;

        if(window.dataKSGlobal.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="11" class="p-8 text-center font-medium text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = window.dataKSGlobal.map((r) => `
            <tr class="bg-white even:bg-slate-200 hover:bg-green-200 transition row-ks text-sm border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb"><input type="checkbox" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 text-center col-open"><button onclick="window.bukaBreakdown('${r.gKey}')" class="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md transition flex mx-auto items-center justify-center"><i data-lucide="box" class="w-4 h-4"></i></button></td>
                <td class="px-4 py-3 font-medium text-blue-600 col-jenis" data-search="${r.jenis}">${r.jenis}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama}">${r.nama}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.pjg}">${r.pjg}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade}">${r.grade}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus}">${r.dus}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading}">${r.shading}</td>
                <td class="px-4 py-3 font-semibold text-orange-600 col-po" data-search="${r.po}">${r.po}</td>
                <td class="px-4 py-3 font-medium text-slate-500 col-ket text-left" data-search="${r.ket}">${r.ket}</td>
                <td class="px-4 py-3 font-black text-emerald-700 col-qty text-base" data-search="${r.qty}">${r.qty}</td>
            </tr>
        `).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="11" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    } 
    else if (window.modeKS === 'lembaran') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb text-center"><input type="checkbox" onchange="window.toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300 w-4 h-4 focus:ring-blue-500"></th>
                ${window.thSort(1, 'Kode Master', 'col-area')}
                ${window.thSort(2, 'Nama Item', 'col-nama')}
                ${window.thSort(3, 'Panjang', 'col-pjg')}
                ${window.thSort(4, 'Grade', 'col-grade')}
                ${window.thSort(5, 'Dus', 'col-dus')}
                ${window.thSort(6, 'Shading', 'col-shading')}
                ${window.thSort(7, 'Keterangan', 'col-ket')}
            </tr>`;
        
        if(window.stokLembaranRaw.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="8" class="p-8 text-center font-medium text-slate-400">Tidak ada data stok lembaran.</td></tr>`; return; }

        tbody.innerHTML = window.stokLembaranRaw.map((r) => `
            <tr class="bg-white even:bg-slate-200 hover:bg-green-200 transition row-ks text-sm border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-semibold text-emerald-700 col-area" data-search="${r.kode_master || '-'}">${r.kode_master || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-800 text-left col-nama" data-search="${r.nama_item || '-'}">${r.nama_item || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg" data-search="${r.pjg || '-'}">${r.pjg || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade" data-search="${r.grade || '-'}">${r.grade || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus" data-search="${r.dus || '-'}">${r.dus || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading" data-search="${r.shading || '-'}">${r.shading || '-'}</td>
                <td class="px-4 py-3 font-medium text-slate-500 col-ket text-left" data-search="${r.keterangan || '-'}">${r.keterangan || '-'}</td>
            </tr>
        `).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="8" class="p-8 text-center font-medium text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    }

    lucide.createIcons(); 
    window.saringTabelExcel(); 
};

window.highlightRow = function(checkbox) {
    const tr = checkbox.closest('tr');
    if (checkbox.checked) { tr.classList.add('selected-row'); } 
    else { tr.classList.remove('selected-row'); }
    window.updateSelectedCount();
};

window.toggleCentangUtama = function(checked) { 
    document.querySelectorAll('.cb-main').forEach(cb => {
        const row = cb.closest('tr');
        if (row.style.display !== 'none' && !row.classList.contains('filtered-out')) {
            cb.checked = checked; window.highlightRow(cb);
        }
    });
};

window.changeRowsPerPage = function(val) {
    const customInput = document.getElementById('input-custom-rows');
    if (val === 'ALL') {
        window.rowsPerPage = 999999; 
        customInput.classList.add('hidden');
    } else if (val === 'CUSTOM') {
        customInput.classList.remove('hidden');
        customInput.focus();
        let customVal = parseInt(customInput.value);
        window.rowsPerPage = (customVal > 0) ? customVal : window.rowsPerPage;
    } else {
        window.rowsPerPage = parseInt(val);
        customInput.classList.add('hidden');
    }
    window.currentPage = 1; 
    window.applyPagination();
};

window.setCustomRowsPerPage = function(val) {
    let parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
        window.rowsPerPage = parsed;
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
    
    const totalRows = allRows.length;
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / window.rowsPerPage) || 1;
    
    if(window.currentPage > totalPages) window.currentPage = totalPages;
    if(window.currentPage < 1) window.currentPage = 1;

    const startIndex = (window.currentPage - 1) * window.rowsPerPage;
    const endIndex = startIndex + window.rowsPerPage;

    let sumQty = 0;
    visibleRows.forEach((row, index) => {
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

// REVISI 4: Export ke XLSX menggunakan SheetJS (Format Asli Excel)
window.downloadXLS = function() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
    
    let ws_data = [];
    const headers = Array.from(document.querySelectorAll('#thead-ks th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    ws_data.push(headers);

    document.querySelectorAll('.row-ks:not(.filtered-out)').forEach(tr => {
        const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-open')) return;
            if(window.getComputedStyle(td).display !== 'none') { 
                let rawText = td.getAttribute('data-search') ? td.getAttribute('data-search') : td.innerText.trim();
                rowData.push(rawText); 
            }
        });
        ws_data.push(rowData);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kartu_Stok");
    XLSX.writeFile(wb, `KartuStok_${window.modeKS.toUpperCase()}.xlsx`);
};
