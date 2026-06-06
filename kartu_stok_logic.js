let modeKS = 'qr'; 
let stokQRRaw = []; let stokLembaranRaw = [];
let dataKSQR = []; let dataKSArea = []; let dataKSGlobal = [];
let selectedForAction = []; let sourcePOContext = ''; let currentBreakdownData = [];
let sortState = {};
let masterData = { kamus: [] };

let currentPage = 1;
const rowsPerPage = 8;

function safeJSONParse(data, fallback = null) {
    if (!data || data === 'undefined' || data === 'null') return fallback;
    if (typeof data !== 'string') return data; 
    try { return JSON.parse(data); } catch (e) { return fallback; }
}

const currentUser = safeJSONParse(localStorage.getItem('user_session'), { username: 'Admin', role: 'admin' });

// ========================================================
// 1. STYLING MANAGEMENT 
// ========================================================
const defaultSettings = { 
    thBg: '#2c3e50', thColor: '#ffffff', thSize: 11, thAlign: 'center', 
    tdColor: '#334155', tdSize: 12, tdAlign: 'center',
    customCols: {} 
};

let currentSettings = null;

function terapkanSettingAwal() {
    currentSettings = safeJSONParse(localStorage.getItem('wms_table_settings'), defaultSettings);
    if (!currentSettings || !currentSettings.thBg) currentSettings = JSON.parse(JSON.stringify(defaultSettings));
    if (!currentSettings.customCols) currentSettings.customCols = {};
    applyCSS(currentSettings);
}

function applyCSS(s) {
    const styleEl = document.getElementById('dynamic-table-settings');
    if (!styleEl) return;
    const justify = s.thAlign === 'left' ? 'flex-start' : (s.thAlign === 'right' ? 'flex-end' : 'center');
    
    let customCSS = `:root { --th-bg: ${s.thBg}; --th-color: ${s.thColor}; --th-size: ${s.thSize}px; } \n`;
    customCSS += `#main-table th.hdr-std > div { justify-content: ${justify} !important; text-align: ${s.thAlign} !important; } \n`;
    if (s.tdColor !== defaultSettings.tdColor) customCSS += `#main-table td { color: ${s.tdColor} !important; } \n`;
    if (s.tdSize !== defaultSettings.tdSize) customCSS += `#main-table td { font-size: ${s.tdSize}px !important; } \n`;
    if (s.tdAlign !== defaultSettings.tdAlign) customCSS += `#main-table td { text-align: ${s.tdAlign} !important; } \n`;
    for (let colClass in s.customCols) {
        let cs = s.customCols[colClass];
        customCSS += `#main-table td.${colClass} { color: ${cs.color} !important; font-size: ${cs.size}px !important; text-align: ${cs.align} !important; }`;
    }
    styleEl.innerHTML = customCSS;
}

function bukaModalSetting() {
    document.getElementById('set-th-bg').value = currentSettings.thBg;
    document.getElementById('set-th-color').value = currentSettings.thColor;
    document.getElementById('set-th-size').value = currentSettings.thSize;
    document.getElementById('set-th-align').value = currentSettings.thAlign;
    document.getElementById('set-td-color').value = currentSettings.tdColor;
    document.getElementById('set-td-size').value = currentSettings.tdSize;
    document.getElementById('set-td-align').value = currentSettings.tdAlign;
    document.getElementById('modal-setting').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
}

function livePreviewSetting() {
    currentSettings.thBg = document.getElementById('set-th-bg').value; currentSettings.thColor = document.getElementById('set-th-color').value; currentSettings.thSize = parseInt(document.getElementById('set-th-size').value) || 11; currentSettings.thAlign = document.getElementById('set-th-align').value;
    currentSettings.tdColor = document.getElementById('set-td-color').value; currentSettings.tdSize = parseInt(document.getElementById('set-td-size').value) || 12; currentSettings.tdAlign = document.getElementById('set-td-align').value;
    applyCSS(currentSettings);
}

['set-th-bg', 'set-th-color', 'set-th-size', 'set-th-align', 'set-td-color', 'set-td-size', 'set-td-align'].forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', livePreviewSetting); });

function simpanSettingTabel() { livePreviewSetting(); localStorage.setItem('wms_table_settings', JSON.stringify(currentSettings)); tutupSemuaPopups(); }

function resetSettingDefault() { localStorage.removeItem('wms_table_settings'); currentSettings = JSON.parse(JSON.stringify(defaultSettings)); applyCSS(currentSettings); tutupSemuaPopups(); }

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'kartu_stok', title: 'KARTU STOK', url: 'kartu_stok.html' });
    terapkanSettingAwal(); 
    await loadMasterData();
    setTimeout(muatDataStok, 200);
});

async function loadMasterData() {
    try {
        const {data, error} = await db.from('master_2').select('*');
        if (data) {
            masterData.kamus = data; let poSet = new Set(); data.forEach(d => { if(d.po) poSet.add(d.po.trim()); });
            const sel = document.getElementById('input-new-po'); let html = '<option value="">-- PILIH PO --</option>';
            Array.from(poSet).sort().forEach(po => { html += `<option value="${po}">${po}</option>`; });
            if(sel) sel.innerHTML = html;
        }
    } catch (e) { if(document.getElementById('input-new-po')) document.getElementById('input-new-po').innerHTML = '<option value="">-- GAGAL MEMUAT PO --</option>'; }
}

function translateBarcode(barcode) {
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
}

async function sinkronisasiUlangStokAktual(tampilkanAlert = false) {
    const btn = document.getElementById('btn-sync-db');
    if(btn) { btn.innerHTML = '<div class="bg-teal-700 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></div><div class="bg-teal-500 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wider">Sinkron DB</div>'; btn.disabled = true; }

    try {
        const { data: fisikQr, error: errQr } = await db.from('stok_qr').select('*');
        if(errQr) throw errQr;
        
        let mapAgg = {};
        (fisikQr || []).forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = translateBarcode(r.qrcode);
            
            let area = r.area || p[0] || '-';
            let nama = r.nama_item || p[2] || t.namaItem;
            let pjg = r.panjang || p[3] || t.panjang;
            let grade = r.grade || p[4] || t.grade;
            let dus = r.dus || p[5] || t.dus;
            let shading = r.shading || p[6] || t.shading;
            let po = p.length >= 8 ? p[7] : (r.po_bawaan || t.po || '-');
            let ket = r.keterangan || '-';

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
            if(!mapAgg[key]) {
                mapAgg[key] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, area: area, po_aktual: po, keterangan: ket, qty: 0 };
            }
            mapAgg[key].qty++;
        });

        let dataAktualBaru = Object.values(mapAgg);
        const { error: errDel } = await db.from('stok_aktual').delete().neq('qty', -99999);
        if(errDel) throw errDel; 

        for(let i = 0; i < dataAktualBaru.length; i += 500) {
            const { error: errIns } = await db.from('stok_aktual').insert(dataAktualBaru.slice(i, i + 500));
            if(errIns) throw errIns;
        }
        
        if(tampilkanAlert) alert("✅ Sinkronisasi Selesai!\nTabel stok_aktual di database telah diperbarui 100% mengikuti data fisik stok_qr.");
    } catch(e) {
        alert("⚠️ GAGAL SINKRONISASI STOK AKTUAL KE SUPABASE!\nPastikan RLS pada tabel 'stok_aktual' sudah dimatikan.");
    } finally {
        if(btn) { btn.innerHTML = '<div class="bg-teal-700 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="database-backup" class="w-4 h-4"></i></div><div class="bg-teal-500 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wider">Sinkron DB</div>'; btn.disabled = false; lucide.createIcons(); }
    }
}

async function muatDataStok() {
    const tbody = document.getElementById('tbody-ks');
    tbody.innerHTML = `<tr><td colspan="17" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500">Menghubungkan ke Gudang Supabase...</p></td></tr>`;
    lucide.createIcons();

    try {
        const [resStok, resSTBJ, resLembaran] = await Promise.all([
            db.from('stok_qr').select('*'),
            db.from('hasil_stbj').select('qrcode, keterangan'),
            db.from('stok_lembaran').select('*').order('created_at', {ascending: false})
        ]);
        
        if(resStok.error) throw resStok.error;
        stokQRRaw = resStok.data || [];
        stokLembaranRaw = resLembaran.data || [];

        let aktualMap = {};
        stokQRRaw.forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = translateBarcode(r.qrcode);
            let nama = r.nama_item || p[2] || t.namaItem;
            let pjg = r.panjang || p[3] || t.panjang;
            let grade = r.grade || p[4] || t.grade;
            let dus = r.dus || p[5] || t.dus;
            let shading = r.shading || p[6] || t.shading;
            let poAktual = p.length >= 8 ? p[7] : (r.po_bawaan || t.po || '-');

            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}`;
            if(!aktualMap[key]) aktualMap[key] = new Set();
            if(poAktual && poAktual !== '-') aktualMap[key].add(poAktual.trim());
        });

        let ketMap = {};
        if(resSTBJ.data) resSTBJ.data.forEach(d => { if(d.qrcode) ketMap[d.qrcode.trim()] = d.keterangan || '-'; });

        dataKSQR = [];
        let areaMap = {};
        
        stokQRRaw.forEach(r => {
            if(!r.id_sku) return;
            let trimQR = (r.qrcode || '').toString().trim();
            let ket = ketMap[trimQR] || r.keterangan || '-';
            let t = translateBarcode(trimQR);
            
            let p = r.id_sku.split('_'); 
            let areaBarang = r.area || p[0] || '-';
            let jenisBarang = r.jenis_item || p[1] || t.jenisItem;
            let namaBarang = r.nama_item || p[2] || t.namaItem;
            let panjangBarang = r.panjang || p[3] || t.panjang;
            let gradeBarang = r.grade || p[4] || t.grade;
            let dusBarang = r.dus || p[5] || t.dus;
            let shadingBarang = r.shading || p[6] || t.shading;

            let rawMesin = (r.mesin || t.mesin || '').toString().trim();
            let cM = masterData.kamus.find(m => m.kode_mesin && m.kode_mesin.toString().trim() === rawMesin);
            let txtMesin = cM && cM.mesin ? cM.mesin : rawMesin;

            let rawShift = (r.shift || t.shift || '').toString().trim();
            let cS = masterData.kamus.find(m => m.kode_shift && m.kode_shift.toString().trim() === rawShift);
            let txtShift = cS && cS.shift ? cS.shift : rawShift;

            let rawPoBawaan = (r.po_bawaan || t.po || '').toString().trim();
            let cP = masterData.kamus.find(m => m.kode_po && m.kode_po.toString().trim() === rawPoBawaan);
            let txtPoBawaan = cP && cP.po ? cP.po : rawPoBawaan;

            let rawPoAktual = (p.length >= 8 ? p[7] : rawPoBawaan).toString().trim();
            let cPA = masterData.kamus.find(m => m.kode_po && m.kode_po.toString().trim() === rawPoAktual);
            
            let txtPoAktualSpesifik = cPA && cPA.po ? cPA.po : rawPoAktual;

            let specKey = `${namaBarang}_${panjangBarang}_${gradeBarang}_${dusBarang}_${shadingBarang}`;
            let poGabunganArray = aktualMap[specKey] ? Array.from(aktualMap[specKey]) : [];
            let txtPoAktualGabungan = poGabunganArray.length > 0 ? poGabunganArray.join(', ') : 'NON-PO / KOSONG';

            dataKSQR.push({
                qrcode: trimQR || '-', id_sku: r.id_sku || '-', area: areaBarang || '-', tglProduksi: r.tgl_produksi || t.tglProduksi || '-',
                mesin: txtMesin || '-', shift: txtShift || '-', jenis: jenisBarang || '-', nama: namaBarang || '-',
                pjg: panjangBarang || '-', grade: gradeBarang || '-', dus: dusBarang || '-', shading: shadingBarang || '-',
                po_bawaan: txtPoBawaan || '-', po_aktual_spesifik: txtPoAktualSpesifik, po_aktual_gabungan: txtPoAktualGabungan, ket: ket,
                id: r.id 
            });

            let keyArea = `${r.id_sku}_${ket}`;
            if(!areaMap[keyArea]) {
                areaMap[keyArea] = { 
                    id_sku: r.id_sku, key_lengkap: keyArea, area: areaBarang, jenis: jenisBarang, nama: namaBarang, 
                    pjg: panjangBarang, grade: gradeBarang, dus: dusBarang, shading: shadingBarang, po: txtPoAktualSpesifik, ket: ket, qty: 0, qrcodes: [] 
                };
            }
            areaMap[keyArea].qty++;
            areaMap[keyArea].qrcodes.push(trimQR);
        });
        dataKSArea = Object.values(areaMap);

        let globalMap = {};
        dataKSArea.forEach(a => {
            let gKey = `${a.jenis}_${a.nama}_${a.pjg}_${a.grade}_${a.dus}_${a.shading}_${a.po}_${a.ket}`;
            if(!globalMap[gKey]) {
                globalMap[gKey] = { gKey: gKey, jenis: a.jenis, nama: a.nama, pjg: a.pjg, grade: a.grade, dus: a.dus, shading: a.shading, po: a.po, ket: a.ket, qty: 0, areas: [] };
            }
            globalMap[gKey].qty += a.qty;
            globalMap[gKey].areas.push({
                id_sku: a.id_sku, key_lengkap: a.key_lengkap, area: a.area, po: a.po, ket: a.ket, qty: a.qty, qrcodes: a.qrcodes,
                nama: a.nama, pjg: a.pjg, grade: a.grade, dus: a.dus, shading: a.shading, jenis: a.jenis 
            });
        });
        dataKSGlobal = Object.values(globalMap);

        renderTabel();
    } catch(e) { tbody.innerHTML = `<tr><td colspan="17" class="p-10 text-red-500 font-bold">Gagal mengolah data: ${e.message}</td></tr>`; }
}

// REVISI TABS: Styling Blocky Metro Design saat diganti mode
function setModeKS(m) {
    modeKS = m;
    const activeClass = 'px-6 py-3.5 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2 bg-[#2c3e50] text-white';
    const inactiveClass = 'px-6 py-3.5 font-bold text-xs uppercase transition whitespace-nowrap flex items-center gap-2 bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-800';
    
    ['qr', 'area', 'global', 'lembaran'].forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if(el) el.className = (m === tab) ? activeClass : inactiveClass;
    });
    
    document.getElementById('btn-ganti-po-main').classList.toggle('hidden', m === 'global' || m === 'lembaran');
    document.getElementById('f-qr-container').classList.toggle('hidden', m !== 'qr');
    document.getElementById('f-area-container').classList.toggle('hidden', m === 'global' || m === 'lembaran');
    
    renderTabel();
}

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-ks');
    const rows = Array.from(tbody.querySelectorAll('tr.row-ks'));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim(); let valB = b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) { return isAsc ? numA - numB : numB - numA; } 
        else { return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    applyPagination();
}

const thSort = (idx, label, cls = "") => `<th class="hdr-std ${cls} cursor-pointer hover:bg-black/10 transition select-none" onclick="sortTable(${idx}, this)"><div class="flex items-center gap-1.5">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></div></th>`;

function renderTabel() {
    const thead = document.getElementById('thead-ks');
    const tbody = document.getElementById('tbody-ks');
    sortState = {}; 

    if(modeKS === 'qr') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded border-slate-300"></th>
                ${thSort(1, 'Area', 'col-area')}
                ${thSort(2, 'QRCode', 'col-qr')}
                ${thSort(3, 'Tgl Produksi', 'col-tgl')}
                ${thSort(4, 'Mesin', 'col-mesin')}
                ${thSort(5, 'Shift', 'col-shift')}
                ${thSort(6, 'Jenis Item', 'col-jenis')}
                ${thSort(7, 'Nama Item', 'col-nama')}
                ${thSort(8, 'Panjang', 'col-pjg')}
                ${thSort(9, 'Grade', 'col-grade')}
                ${thSort(10, 'Dus', 'col-dus')}
                ${thSort(11, 'Shading', 'col-shading')}
                ${thSort(12, 'PO Bawaan', 'col-po-bawaan')}
                ${thSort(13, 'PO Aktual', 'col-po')}
                ${thSort(14, 'Keterangan', 'col-ket')}
            </tr>`;
        
        if(dataKSQR.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="15" class="p-6 font-bold text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = dataKSQR.map((r, i) => {
            const safeQRs = JSON.stringify([r.qrcode]).replace(/"/g, "&quot;");
            return `
                <tr class="hover:bg-slate-100 transition row-ks">
                    <td class="p-3 col-cb"><input type="checkbox" onchange="updateSelectedCount()" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual_spesifik}" data-ket="${r.ket}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300"></td>
                    <td class="p-3 font-bold text-emerald-700 bg-emerald-50/50 col-area">${r.area}</td>
                    <td class="p-3 font-mono font-bold tracking-wide text-slate-900 col-qr text-left">${r.qrcode}</td>
                    <td class="p-3 font-semibold text-slate-500 col-tgl">${r.tglProduksi}</td>
                    <td class="p-3 font-semibold text-slate-500 col-mesin">${r.mesin}</td>
                    <td class="p-3 font-semibold text-slate-500 col-shift">${r.shift}</td>
                    <td class="p-3 font-bold text-blue-600 col-jenis">${r.jenis}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama}</td>
                    <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg}</td>
                    <td class="p-3 font-bold text-slate-700 col-grade">${r.grade}</td>
                    <td class="p-3 font-bold text-slate-700 col-dus">${r.dus}</td>
                    <td class="p-3 font-bold text-slate-600 col-shading">${r.shading}</td>
                    <td class="p-3 font-semibold text-slate-400 col-po-bawaan">${r.po_bawaan}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/40 whitespace-normal leading-relaxed min-w-[200px] col-po">${r.po_aktual_gabungan}</td>
                    <td class="p-3 font-semibold text-slate-500 col-ket">${r.ket}</td>
                </tr>`;
        }).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="15" class="p-6 font-bold text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    }
    else if(modeKS === 'area') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300"></th>
                ${thSort(1, 'Area', 'col-area')}
                ${thSort(2, 'Jenis Item', 'col-jenis')}
                ${thSort(3, 'Nama Item', 'col-nama')}
                ${thSort(4, 'Panjang', 'col-pjg')}
                ${thSort(5, 'Grade', 'col-grade')}
                ${thSort(6, 'Dus', 'col-dus')}
                ${thSort(7, 'Shading', 'col-shading')}
                ${thSort(8, 'PO Aktual', 'col-po')}
                ${thSort(9, 'Keterangan', 'col-ket')}
                ${thSort(10, 'Total Qty (Dus)', 'col-qty')}
            </tr>`;
        
        if(dataKSArea.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="11" class="p-6 font-bold text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = dataKSArea.map((r, i) => {
            const safeQRs = JSON.stringify(r.qrcodes).replace(/"/g, "&quot;");
            return `
                <tr class="hover:bg-slate-100 transition row-ks">
                    <td class="p-3 col-cb"><input type="checkbox" onchange="updateSelectedCount()" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po}" data-ket="${r.ket}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300"></td>
                    <td class="p-3 font-black text-emerald-700 bg-emerald-50/50 col-area">${r.area}</td>
                    <td class="p-3 font-bold text-blue-600 col-jenis">${r.jenis}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama}</td>
                    <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg}</td>
                    <td class="p-3 font-bold text-slate-700 col-grade">${r.grade}</td>
                    <td class="p-3 font-bold text-slate-700 col-dus">${r.dus}</td>
                    <td class="p-3 font-bold text-slate-600 col-shading">${r.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/40 col-po">${r.po}</td>
                    <td class="p-3 font-semibold text-slate-500 col-ket">${r.ket}</td>
                    <td class="p-3 font-black text-slate-900 bg-slate-50 col-qty text-base">${r.qty}</td>
                </tr>`;
        }).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="11" class="p-6 font-bold text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    } 
    else if (modeKS === 'global') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300"></th>
                <th class="hdr-std w-12 col-open">Detail</th>
                ${thSort(2, 'Jenis Item', 'col-jenis')}
                ${thSort(3, 'Nama Item', 'col-nama')}
                ${thSort(4, 'Panjang', 'col-pjg')}
                ${thSort(5, 'Grade', 'col-grade')}
                ${thSort(6, 'Dus', 'col-dus')}
                ${thSort(7, 'Shading', 'col-shading')}
                ${thSort(8, 'PO Aktual', 'col-po')}
                ${thSort(9, 'Keterangan', 'col-ket')}
                ${thSort(10, 'TOTAL (DUS)', 'col-qty')}
            </tr>`;

        if(dataKSGlobal.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="11" class="p-6 font-bold text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        tbody.innerHTML = dataKSGlobal.map((r, i) => `
            <tr class="hover:bg-slate-100 transition row-ks">
                <td class="p-3 col-cb"><input type="checkbox" onchange="updateSelectedCount()" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300"></td>
                <td class="p-2 col-open"><button onclick="bukaBreakdown('${r.gKey}')" class="p-1.5 bg-slate-100 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white rounded transition flex mx-auto items-center justify-center"><i data-lucide="box" class="w-4 h-4"></i></button></td>
                <td class="p-3 font-bold text-blue-600 col-jenis">${r.jenis}</td>
                <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama}</td>
                <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg}</td>
                <td class="p-3 font-bold text-slate-700 col-grade">${r.grade}</td>
                <td class="p-3 font-bold text-slate-700 col-dus">${r.dus}</td>
                <td class="p-3 font-bold text-slate-600 col-shading">${r.shading}</td>
                <td class="p-3 font-black text-orange-600 bg-orange-50/40 col-po">${r.po}</td>
                <td class="p-3 font-semibold text-slate-500 col-ket">${r.ket}</td>
                <td class="p-3 font-black text-slate-900 bg-slate-50 col-qty text-base">${r.qty}</td>
            </tr>
        `).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="11" class="p-6 font-bold text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    } 
    else if (modeKS === 'lembaran') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600 border-slate-300"></th>
                ${thSort(1, 'Kode Master', 'col-area')}
                ${thSort(2, 'Nama Item', 'col-nama')}
                ${thSort(3, 'Panjang', 'col-pjg')}
                ${thSort(4, 'Grade', 'col-grade')}
                ${thSort(5, 'Dus', 'col-dus')}
                ${thSort(6, 'Shading', 'col-shading')}
                ${thSort(7, 'Keterangan', 'col-ket')}
            </tr>`;
        
        if(stokLembaranRaw.length === 0) { tbody.innerHTML = `<tr id="empty-row-ks"><td colspan="8" class="p-6 font-bold text-slate-400">Tidak ada data stok lembaran.</td></tr>`; return; }

        tbody.innerHTML = stokLembaranRaw.map((r, i) => `
            <tr class="hover:bg-slate-100 transition row-ks">
                <td class="p-3 col-cb"><input type="checkbox" value="${r.id}" onchange="updateSelectedCount()" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300"></td>
                <td class="p-3 font-black text-emerald-700 bg-emerald-50/50 col-area">${r.kode_master || '-'}</td>
                <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama_item || '-'}</td>
                <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg || '-'}</td>
                <td class="p-3 font-bold text-slate-700 col-grade">${r.grade || '-'}</td>
                <td class="p-3 font-bold text-slate-700 col-dus">${r.dus || '-'}</td>
                <td class="p-3 font-bold text-slate-600 col-shading">${r.shading || '-'}</td>
                <td class="p-3 font-semibold text-slate-500 col-ket">${r.keterangan || '-'}</td>
            </tr>
        `).join('');
        tbody.innerHTML += `<tr id="empty-row-ks" style="display:none;"><td colspan="8" class="p-6 font-bold text-slate-400">Tidak ada stok yang cocok dengan filter.</td></tr>`;
    }

    lucide.createIcons(); 
    currentPage = 1;
    applyPagination(); 
}

// ========================================================
// FUNGSI PAGINASI KENCANG
// ========================================================
function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-ks tr.row-ks'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const totalRows = allRows.length;
    const totalFiltered = visibleRows.length;
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;

    visibleRows.forEach((row, index) => {
        if(index >= startIndex && index < endIndex) {
            row.style.display = ''; 
        } else {
            row.style.display = 'none'; 
        }
    });

    const emptyRow = document.getElementById('empty-row-ks');
    if(emptyRow) emptyRow.style.display = totalFiltered === 0 ? '' : 'none';

    const lblTotal = document.getElementById('lbl-total-baris');
    const lblTampil = document.getElementById('lbl-tampil-baris');
    const lblHal = document.getElementById('lbl-halaman');
    const lblTotalHal = document.getElementById('lbl-total-halaman');

    if(lblTotal) lblTotal.innerText = totalRows;
    if(lblTampil) lblTampil.innerText = totalFiltered;
    if(lblHal) lblHal.innerText = currentPage;
    if(lblTotalHal) lblTotalHal.innerText = totalPages;
    
    updateSelectedCount();
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-ks tr.row-ks:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}

function toggleCentangUtama(checked) { 
    document.querySelectorAll('.cb-main').forEach(cb => {
        const row = cb.closest('tr');
        if (row.style.display !== 'none' && !row.classList.contains('filtered-out')) {
            cb.checked = checked;
        }
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.cb-main:checked').length;
    const lbl = document.getElementById('lbl-pilih-baris');
    if(lbl) lbl.innerText = count;
}


// ========================================================
// 6. ACTION HANDLERS & MODALS
// ========================================================
function bukaBreakdown(gKey) {
    const item = dataKSGlobal.find(g => g.gKey === gKey); if(!item) return;

    document.getElementById('bd-title-item').innerText = `${item.nama} | ${item.pjg} | ${item.grade} | DUS: ${item.dus} | SHADING: ${item.shading} | KET: ${item.ket}`;
    currentBreakdownData = item.areas;

    const tbody = document.getElementById('tbody-breakdown');
    tbody.innerHTML = item.areas.map((a, i) => {
        const safeQRs = JSON.stringify(a.qrcodes).replace(/"/g, "&quot;");
        return `
            <tr class="hover:bg-slate-50 transition bd-row">
                <td class="p-3 border-b border-slate-200 border-r"><input type="checkbox" data-idsku="${a.id_sku}" data-qrs="${safeQRs}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po}" data-ket="${a.ket}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                <td class="p-3 border-b border-slate-200 font-bold opacity-50 border-r">${i+1}</td>
                <td class="p-3 border-b border-slate-200 font-black text-emerald-700 bg-emerald-50 border-r">${a.area}</td>
                <td class="p-3 border-b border-slate-200 font-black text-orange-600 bg-orange-50/50 border-r col-po">${a.po}</td>
                <td class="p-3 border-b border-slate-200 font-semibold text-slate-500 text-left opacity-80 border-r">${a.ket}</td>
                <td class="p-3 border-b border-slate-200 font-black text-slate-900 bg-slate-100 border-r">${a.qty}</td>
            </tr>`;
    }).join('');

    document.getElementById('modal-breakdown').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    lucide.createIcons();
}

function tutupModalBreakdown() { document.getElementById('modal-breakdown').classList.add('hidden'); document.getElementById('overlay-klik-luar').classList.add('hidden'); }
function toggleCentangBreakdown(checked) { document.querySelectorAll('.cb-bd').forEach(cb => cb.checked = checked); }

// ========================================================
// EDIT KETERANGAN
// ========================================================
function siapkanEditKet(context) {
    let checkboxes = context === 'main' ? document.querySelectorAll('.cb-main:checked') : document.querySelectorAll('.cb-bd:checked');
    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diedit keterangannya terlebih dahulu.');

    selectedForAction = [];
    checkboxes.forEach(cb => {
        if (modeKS === 'lembaran') {
            selectedForAction.push({ id: cb.value });
        } else {
            const qrs = safeJSONParse(cb.dataset.qrs, []);
            selectedForAction.push({ qrcodes: qrs });
        }
    });

    sourcePOContext = context;
    document.getElementById('input-new-ket').value = '';
    document.getElementById('modal-ket').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
}

function tutupModalKet() { 
    document.getElementById('modal-ket').classList.add('hidden'); 
    if(document.getElementById('modal-breakdown').classList.contains('hidden') && document.getElementById('modal-setting').classList.contains('hidden')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
}

async function eksekusiEditKet() {
    const newKet = document.getElementById('input-new-ket').value.trim();
    if(!newKet) return alert("Keterangan tidak boleh kosong!");

    const btn = document.getElementById('btn-simpan-ket'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...'; btn.disabled = true;

    try {
        if (modeKS === 'lembaran') {
            let ids = selectedForAction.map(x => x.id);
            const {error} = await db.from('stok_lembaran').update({keterangan: newKet}).in('id', ids);
            if(error) throw error;
        } else {
            let allQrs = [];
            selectedForAction.forEach(row => { allQrs.push(...row.qrcodes); });
            const {error} = await db.from('stok_qr').update({keterangan: newKet}).in('qrcode', allQrs);
            if(error) throw error;
            
            await sinkronisasiUlangStokAktual();
        }
        
        tutupModalKet(); 
        if(sourcePOContext === 'breakdown') tutupModalBreakdown();
        await muatDataStok();
    } catch (e) {
        alert("GAGAL MENGEDIT KETERANGAN: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
}

// ========================================================
// GANTI PO
// ========================================================
function siapkanGantiPO(context) {
    let checkboxes = [];
    if(context === 'main') {
        if(modeKS === 'global' || modeKS === 'lembaran') return;
        checkboxes = document.querySelectorAll('.cb-main:checked');
    } else { checkboxes = document.querySelectorAll('.cb-bd:checked'); }

    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diganti PO-nya.');

    selectedForAction = []; let totalDus = 0;
    checkboxes.forEach(cb => {
        const qrs = safeJSONParse(cb.dataset.qrs, []);
        selectedForAction.push({ 
            id_sku: cb.dataset.idsku, qrcodes: qrs, jenis: cb.dataset.jenis, nama: cb.dataset.nama,
            pjg: cb.dataset.pjg, grade: cb.dataset.grade, dus: cb.dataset.dus, shading: cb.dataset.shading,
            area: cb.dataset.area, po: cb.dataset.po, ket: cb.dataset.ket
        });
        totalDus += qrs.length;
    });

    sourcePOContext = context;
    document.getElementById('input-new-po').value = '';
    const inputQty = document.getElementById('input-qty-ganti');
    inputQty.value = totalDus; inputQty.max = totalDus; 

    document.getElementById('modal-po').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
}

function tutupModalPO() { 
    document.getElementById('modal-po').classList.add('hidden'); 
    if(document.getElementById('modal-breakdown').classList.contains('hidden') && document.getElementById('modal-setting').classList.contains('hidden')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
}

async function eksekusiGantiPO() {
    const newPO = document.getElementById('input-new-po').value.trim().toUpperCase();
    if(!newPO) return alert("Silakan Pilih PO Baru dari daftar dropdown!");

    const qtyDiminta = parseInt(document.getElementById('input-qty-ganti').value);
    if(isNaN(qtyDiminta) || qtyDiminta <= 0) return alert("Jumlah dus tidak valid!");

    let maxDus = selectedForAction.reduce((sum, row) => sum + row.qrcodes.length, 0);
    if(qtyDiminta > maxDus) return alert(`Maksimal jatah adalah ${maxDus} dus!`);

    const btn = document.getElementById('btn-simpan-po'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...'; btn.disabled = true;

    try {
        let qtySisaUntukDiupdate = qtyDiminta; let payloadItems = [];
        for(let row of selectedForAction) {
            if (qtySisaUntukDiupdate <= 0) break; 
            let qrsUntukDiupdate = row.qrcodes.slice(0, qtySisaUntukDiupdate);
            let jumlahBerubah = qrsUntukDiupdate.length; qtySisaUntukDiupdate -= jumlahBerubah;

            let parts = row.id_sku.split('_'); parts[7] = newPO; let newIdSku = parts.join('_');
            payloadItems.push({
                new_id_sku: newIdSku, qrcodes: qrsUntukDiupdate, jenis_item: row.jenis, 
                nama: row.nama, pjg: row.pjg, grade: row.grade, dus: row.dus,
                shading: row.shading, area: row.area, po_lama: row.po, po_baru: newPO, ket: row.ket, qty_berubah: jumlahBerubah
            });
        }
        const { error } = await db.rpc('eksekusi_ganti_po_aman', { payload: { items: payloadItems } });
        if(error) throw error;
        
        tutupModalPO(); if(sourcePOContext === 'breakdown') tutupModalBreakdown();
        
        await sinkronisasiUlangStokAktual();
        await muatDataStok();
    } catch (error) { alert("GAGAL UPDATE: " + error.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

function toggleSidebarFilter() { document.getElementById('sidebar-filter').classList.toggle('translate-x-full'); document.getElementById('overlay-klik-luar').classList.toggle('hidden'); }
function tutupSemuaPopups() { document.getElementById('sidebar-filter').classList.add('translate-x-full'); document.getElementById('dropdown-kolom').classList.add('hidden'); tutupModalPO(); tutupModalKet(); tutupModalBreakdown(); document.getElementById('modal-setting').classList.add('hidden'); document.getElementById('overlay-klik-luar').classList.add('hidden'); }

function resetFilter() { const ids = ['f-area','f-qr','f-jenis','f-nama','f-pjg','f-grade','f-dus','f-shading','f-po','f-ket']; ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; }); saringTabel(); toggleSidebarFilter(); }

function saringTabel() {
    const f = { area: document.getElementById('f-area').value.toLowerCase(), qr: document.getElementById('f-qr') ? document.getElementById('f-qr').value.toLowerCase() : '', jenis: document.getElementById('f-jenis').value.toLowerCase(), nama: document.getElementById('f-nama').value.toLowerCase(), pjg: document.getElementById('f-pjg').value.toLowerCase(), grade: document.getElementById('f-grade').value.toLowerCase(), dus: document.getElementById('f-dus').value.toLowerCase(), shading: document.getElementById('f-shading').value.toLowerCase(), po: document.getElementById('f-po').value.toLowerCase(), ket: document.getElementById('f-ket').value.toLowerCase() };
    document.querySelectorAll('.row-ks').forEach(row => {
        let show = true;
        for(let key in f) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell && !cell.innerText.toLowerCase().includes(f[key])) { show = false; break; }
            }
        }
        if (show) row.classList.remove('filtered-out');
        else row.classList.add('filtered-out');
    });
    currentPage = 1;
    applyPagination();
}

function salinData() {
    const cek = document.querySelectorAll('.cb-main:checked'); if(cek.length === 0) return alert("Pilih baris yang ingin disalin (centang).");
    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-ks th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';
    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-open')) return;
            if(window.getComputedStyle(td).display !== 'none') { rowData.push(td.innerText.trim().replace(/\n/g, ' ')); }
        });
        copyString += rowData.join('\t') + '\n';
    });
    navigator.clipboard.writeText(copyString).then(() => alert(`Tersalin ${cek.length} baris!\nBuka Excel lalu Paste.`));
}

function salinDataBreakdown() {
    const cek = document.querySelectorAll('.cb-bd:checked'); if(cek.length === 0) return alert("Centang baris detail Area yang ingin disalin.");
    let copyString = "Area\tPO Aktual\tKeterangan\tQTY\n";
    cek.forEach(cb => { const tr = cb.closest('tr'); copyString += `${tr.children[2].innerText}\t${tr.children[3].innerText}\t${tr.children[4].innerText}\t${tr.children[5].innerText}\n`; });
    navigator.clipboard.writeText(copyString).then(() => alert(`Tersalin!\nBuka Excel lalu Paste.`));
}

function downloadXLS() {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = Array.from(document.querySelectorAll('#thead-ks th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-open')).map(th => th.innerText.trim());
    csvContent += headers.join(",") + "\n";
    
    document.querySelectorAll('.row-ks:not(.filtered-out)').forEach(tr => {
        const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-open')) return;
            if(window.getComputedStyle(td).display !== 'none') { rowData.push(`"${td.innerText.trim()}"`); }
        });
        csvContent += rowData.join(",") + "\n";
    });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `KartuStok_${modeKS.toUpperCase()}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
