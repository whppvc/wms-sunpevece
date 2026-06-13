// ========================================================
// FUNGSI FILTER EXCEL PRO
// ========================================================
window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); window.currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    document.querySelectorAll('#tbody-riwayat tr.r-row').forEach(row => {
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
        let isChecked = !window.activeFilters[colClass] || window.activeFilters[colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; window.updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    const rect = event.currentTarget.getBoundingClientRect(); const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        let top = rect.bottom + window.scrollY + 5; let left = rect.left + window.scrollX;
        if (left + 256 > window.innerWidth) { left = window.innerWidth - 266; }
        menu.style.top = top + 'px'; menu.style.left = left + 'px';
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    window.updateSelectAllState();
};

window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};

window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
};

window.closeFilterMenu = function() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); };

window.clearFilterForCurrentCol = function() { delete window.activeFilters[window.currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); window.updateFilterIcons(); };

window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete window.activeFilters[window.currentFilterCol]; } 
    else { window.activeFilters[window.currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    window.closeFilterMenu(); window.saringTabelExcel(); window.updateFilterIcons();
};

window.saringTabelExcel = function() {
    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for (let colClass in window.activeFilters) {
            const allowed = window.activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row'); if(cb) { cb.checked = false; window.highlightRow(cb); } }
    });
    window.currentPage = 1; window.applyPagination();
};

window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-blue-600'); icon.classList.add('text-slate-400'); });
    for (let colClass in window.activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('text-slate-400'); icon.classList.add('text-blue-600'); } }
    }
};

// ========================================================
// FUNGSI AKSI DATABASE (CANCEL, GANTI AREA, SALIN)
// ========================================================
window.cancelLangsir = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); if(checkedBoxes.length === 0) return alert("Pilih minimal 1 baris!");
    if(!confirm(`Batal Langsir untuk ${checkedBoxes.length} kardus ini?\nData akan dihapus dari gudang dan dipindah ke tabel Hold Langsir.`)) return;
    
    const btn = document.getElementById('btn-cancel-langsir'); 
    const ori = btn.innerHTML;
    if(btn) { btn.innerHTML = 'Proses...'; btn.disabled = true; }

    let arrFisik = []; 
    let payloadHold = [];
    
    checkedBoxes.forEach(cb => {
        const qr = cb.value; 
        const r = window.logLangsirRaw.find(x => x.qrcode === qr);
        if(r) {
            arrFisik.push(qr);
            payloadHold.push({ 
                qrcode: qr, 
                troli: r.troli || '-', 
                area: r.area || '-', 
                tgl_produksi: r.tgl_produksi, 
                mesin: r.mesin, 
                shift: r.shift,
                jenis_item: r.jenis_item, 
                nama_item: r.nama_item, 
                panjang: r.panjang, 
                grade: r.grade,
                dus: r.dus, 
                shading: r.shading, 
                po_bawaan: r.po_bawaan,
                keterangan: 'Cancel Langsir', 
                pic_input: window.currentUser.username 
            });
        }
    });

    try {
        const { error: errStok } = await db.from('stok_qr').delete().in('qrcode', arrFisik);
        if(errStok) throw errStok;

        const { error: errHasil } = await db.from('hasil_langsir').delete().in('qrcode', arrFisik);
        if(errHasil) throw errHasil;

        const { error: errHold } = await db.from('hold_langsir').insert(payloadHold);
        if(errHold) throw errHold;

        await window.sinkronisasiUlangStokAktual(); 
        await window.ambilSemuaData();
        
        alert(`SUKSES!\n${arrFisik.length} item berhasil di-cancel dan dipindah ke Hold Langsir.`);
    } catch (e) { 
        alert("Gagal Cancel Langsir: " + e.message); 
    } finally { 
        if(btn) { btn.innerHTML = ori; btn.disabled = false; } 
        lucide.createIcons(); 
    }
};

window.sinkronisasiUlangStokAktual = async function() {
    try {
        const { data: fisikQr, error: errQr } = await db.from('stok_qr').select('*');
        if(errQr) throw errQr;
        
        let mapAgg = {};
        (fisikQr || []).forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = typeof window.translateBarcode === 'function' ? window.translateBarcode(r.qrcode) : {};
            
            let area = p[0] || r.area || '-';
            let nama = p[1] || r.nama_item || t.nama || '-'; 
            let pjg = p[2] || r.panjang || t.pjg || '-';
            let grade = p[3] || r.grade || t.grade || '-';
            let dus = p[4] || r.dus || t.dus || '-';
            let shading = p[5] || r.shading || t.shading || '-';
            let po = p[6] || r.po_bawaan || t.po || '-';
            let ket = p.length >= 8 ? p.slice(7).join('_') : (r.keterangan || '-');

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
            if(!mapAgg[key]) {
                mapAgg[key] = { 
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
    } catch(e) {
        console.error("Gagal sinkronisasi stok_aktual otomatis:", e.message);
    }
};

window.hapusBarisHold = async function() {
    const checked = document.querySelectorAll('.cb-row:checked'); if(checked.length === 0) return alert("Pilih baris!");
    if(!confirm("Hapus permanen dari Hold?")) return;
    try {
        await db.from('hold_langsir').delete().in('qrcode', Array.from(checked).map(cb => cb.value));
        await window.ambilSemuaData();
    } catch(e) { alert("Gagal: " + e.message); }
};

window.bukaModalGantiArea = function() {
    if(window.modeRiwayat !== 'qr') return alert("Hanya bisa dilakukan di mode DETAIL QRCODE.");
    const cek = document.querySelectorAll('.cb-row:checked'); if(cek.length === 0) return alert("Pilih baris!");
    document.getElementById('teks-info-area').innerText = `Anda akan memindahkan ${cek.length} kardus ke lokasi baru.`;
    document.getElementById('select-new-area').value = ''; document.getElementById('modal-ganti-area').classList.remove('hidden');
};

window.eksekusiGantiArea = async function() {
    const newArea = document.getElementById('select-new-area').value; if(!newArea) return alert("Pilih Area Tujuan!");
    const btn = document.getElementById('btn-eks-area'); let original = btn ? btn.innerHTML : 'Simpan';
    if(btn) { btn.innerHTML = 'Menyimpan...'; btn.disabled = true; }

    const checkedBoxes = document.querySelectorAll('.cb-row:checked'); 
    const qrsToUpdate = Array.from(checkedBoxes).map(cb => cb.value);
    
    let payloadItems = [];
    
    for(let qr of qrsToUpdate) {
        let dbRow = window.logLangsirRaw.find(r => r.qrcode === qr);
        if(dbRow) {
            let id_sku_baru = `${newArea}_${dbRow.nama_item}_${dbRow.panjang}_${dbRow.grade}_${dbRow.dus}_${dbRow.shading}_${dbRow.po_bawaan}_${dbRow.keterangan}`;
            
            payloadItems.push({
                qrcode: qr,
                area_baru: newArea,
                id_sku_baru: id_sku_baru,
                pic: window.currentUser.username || 'Unknown'
            });
        }
    }
    
    try {
        const { error } = await db.rpc('ganti_area_langsir', { payload: payloadItems }); 
        if(error) throw error;
        
        window.tutupModalArea(); 
        await window.sinkronisasiUlangStokAktual(); 
        await window.ambilSemuaData();
    } catch (error) { 
        alert("Gagal: " + error.message + "\n\nPastikan Anda sudah membuat Function 'ganti_area_langsir' di SQL Editor Supabase."); 
    } finally { 
        if(btn) { btn.innerHTML = original; btn.disabled = false; } 
        lucide.createIcons(); 
    }
};

window.salinDataTabel = function() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin dengan mencentang kotak di kiri data!");

    let copyString = "";
    if (window.modeRiwayat === 'agregasi') {
        copyString = "Area\tJenis Item\tNama Item\tPjg\tGrade\tDus\tShading\tPO Bawaan\tPIC\tQTY\n";
        cek.forEach(cb => {
            const tr = cb.closest('tr');
            copyString += `${tr.querySelector('.col-area')?.innerText || '-'}\t${tr.querySelector('.col-jenis')?.innerText || '-'}\t${tr.querySelector('.col-nama')?.innerText || '-'}\t${tr.querySelector('.col-pjg')?.innerText || '-'}\t${tr.querySelector('.col-grade')?.innerText || '-'}\t${tr.querySelector('.col-dus')?.innerText || '-'}\t${tr.querySelector('.col-shading')?.innerText || '-'}\t${tr.querySelector('.col-po')?.innerText || '-'}\t${tr.querySelector('.col-pic')?.innerText || '-'}\t${tr.querySelector('.col-qty')?.innerText || '-'}\n`;
        });
    } else {
        copyString = "Waktu\tTroli\tArea\tQRCode\tTgl Produksi\tMesin\tShift\tNama Item\tPjg\tGrade\tDus\tShading\tPO\tKeterangan\n";
        cek.forEach(cb => {
            const tr = cb.closest('tr');
            copyString += `${tr.querySelector('.col-waktu')?.innerText || '-'}\t${tr.querySelector('.col-troli')?.innerText || '-'}\t${tr.querySelector('.col-area')?.innerText || '-'}\t${tr.querySelector('.col-qr')?.innerText || '-'}\t${tr.querySelector('.col-tgl')?.innerText || '-'}\t${tr.querySelector('.col-mesin')?.innerText || '-'}\t${tr.querySelector('.col-shift')?.innerText || '-'}\t${tr.querySelector('.col-nama')?.innerText || '-'}\t${tr.querySelector('.col-pjg')?.innerText || '-'}\t${tr.querySelector('.col-grade')?.innerText || '-'}\t${tr.querySelector('.col-dus')?.innerText || '-'}\t${tr.querySelector('.col-shading')?.innerText || '-'}\t${tr.querySelector('.col-po')?.innerText || '-'}\t${tr.querySelector('.col-ket')?.innerText || '-'}\n`;
        });
    }

    navigator.clipboard.writeText(copyString).then(() => {
        alert("Berhasil menyalin!");
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
};

// ========================================================
// FUNGSI MODAL STBJ & HOLD (CARD FORMAT)
// ========================================================
window.bukaModalSTBJ = async function() {
    const mStbj = document.getElementById('modal-stbj-langsir'); if(mStbj) mStbj.classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</div>';
    lucide.createIcons();

    try {
        const { data: globalData, error: errGlobal } = await db.from('stok_global').select('*').order('created_at', {ascending: false}).limit(200);
        if(errGlobal) throw errGlobal;
        
        if(!globalData || globalData.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Data STBJ Kosong.</div>';
            return;
        }

        const qrs = globalData.map(d => d.qrcode);
        const { data: qrData, error: errQr } = await db.from('stok_qr').select('qrcode').in('qrcode', qrs);
        if(errQr) throw errQr;

        const qrSet = new Set(qrData.map(d => d.qrcode));
        const filteredData = globalData.filter(d => !qrSet.has(d.qrcode));

        if(filteredData.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Semua data STBJ sudah masuk gudang.</div>';
            return;
        }

        let h = '';
        filteredData.forEach((r, i) => {
            let tgl = '-';
            if (r.created_at) {
                const dt = new Date(r.created_at);
                const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                tgl = `${dt.getDate()} ${months[dt.getMonth()]}, ${String(dt.getHours()).padStart(2,'0')}.${String(dt.getMinutes()).padStart(2,'0')}`;
            }

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
                    <div class="text-[12px] font-bold text-slate-600">PO: <span class="text-orange-600">${r.po_bawaan || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
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
    
    if(tabelTarget === 'hold_stbj') {
        tabStbj.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabLangsir.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
    } else {
        tabLangsir.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabStbj.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
    }

    const tbody = document.getElementById('tbody-hold-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data Hold...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from(tabelTarget).select('*').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Tabel Hold Kosong.</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            let tgl = '-';
            if (r.created_at) {
                const dt = new Date(r.created_at);
                const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                tgl = `${dt.getDate()} ${months[dt.getMonth()]}, ${String(dt.getHours()).padStart(2,'0')}.${String(dt.getMinutes()).padStart(2,'0')}`;
            }

            let namaItem = r.nama_item || '-';
            let pjg = r.panjang || '-';
            let grade = r.grade || '-';
            let dus = r.dus || '-';
            let shading = r.shading || '-';
            let po = r.po_bawaan || '-';
            let jenis = r.jenis_item || '-';
            let prod = r.tgl_produksi || '-';
            let mesin = r.mesin || '-';
            let shift = r.shift || '-';

            if(tabelTarget === 'hold_langsir' && namaItem === '-') {
                let td = typeof window.translateBarcode === 'function' ? window.translateBarcode(r.qrcode) : {};
                namaItem = td.nama || '-'; pjg = td.pjg || '-'; grade = td.grade || '-';
                dus = td.dus || '-'; shading = td.shading || '-'; po = td.po || '-';
                jenis = td.jenis || '-'; prod = td.tglProduksi || '-'; mesin = td.mesin || '-'; shift = td.shift || '-';
            }

            h += `
                <div class="row-modal-hold bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] border border-amber-200">HOLD</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${prod} - ${mesin} - ${shift}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${jenis}</span> | <span class="text-slate-800">${namaItem}</span> | <span class="text-slate-800">${pjg}</span> | <span class="text-slate-800">${grade}</span> | <span class="text-slate-800">${dus}</span> | <span class="text-blue-600">${shading}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">PO: <span class="text-orange-600">${po}</span></div>
                    <div class="text-[12px] font-bold text-rose-600">Keterangan: <span class="text-rose-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
};

window.saringTabelLangsir = function() {
    const f = {
        status: document.getElementById('f-stbj')?.value.toLowerCase() || '',
        kode: document.getElementById('f-kode')?.value.toLowerCase() || '',
        troli: document.getElementById('f-troli')?.value.toLowerCase() || '',
        area: document.getElementById('f-area')?.value.toLowerCase() || '',
        qr: document.getElementById('f-qr')?.value.toLowerCase() || '',
        tgl: document.getElementById('f-tgl')?.value.toLowerCase() || '',
        mesin: document.getElementById('f-mesin')?.value.toLowerCase() || '',
        shift: document.getElementById('f-shift')?.value.toLowerCase() || '',
        jenis: document.getElementById('f-jenis')?.value.toLowerCase() || '',
        nama: document.getElementById('f-nama')?.value.toLowerCase() || '',
        pjg: document.getElementById('f-pjg')?.value.toLowerCase() || '',
        grade: document.getElementById('f-grade')?.value.toLowerCase() || '',
        dus: document.getElementById('f-dus')?.value.toLowerCase() || '',
        shading: document.getElementById('f-shading')?.value.toLowerCase() || '',
        po: document.getElementById('f-po')?.value.toLowerCase() || '',
        ket: document.getElementById('f-ket')?.value.toLowerCase() || ''
    };

    document.querySelectorAll('.r-row').forEach(row => {
        let show = true;
        for(let key in f) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell && !cell.innerText.toLowerCase().includes(f[key])) { show = false; break; }
            }
        }
        if (show) row.classList.remove('filtered-out'); else row.classList.add('filtered-out');
    });
    window.currentPage = 1;
    window.applyPagination();
};
