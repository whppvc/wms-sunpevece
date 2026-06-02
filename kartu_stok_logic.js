let modeKS = 'qr'; 
let stokQRRaw = []; let stokLembaranRaw = [];
let dataKSQR = []; let dataKSArea = []; let dataKSGlobal = [];
let selectedForPO = []; let sourcePOContext = ''; let currentBreakdownData = [];
let sortState = {};
let masterData = { kamus: [] };

function safeJSONParse(str, fallback) {
    try { return str && str !== 'undefined' ? JSON.parse(str) : fallback; }
    catch(e) { return fallback; }
}

// LOGIKA STYLING (SETTING TABEL)
const defaultSettings = { thBg: '#1e293b', thColor: '#ffffff', thSize: 11, thAlign: 'center', tdColor: '#334155', tdSize: 12, tdAlign: 'center' };

function terapkanSettingAwal() {
    let saved = safeJSONParse(localStorage.getItem('wms_table_settings'), defaultSettings);
    if (!saved || !saved.thBg) saved = defaultSettings;
    applyCSS(saved);
}

function applyCSS(s) {
    const styleEl = document.getElementById('dynamic-table-settings');
    styleEl.innerHTML = `
        #main-table th.hdr-std { background-color: ${s.thBg} !important; color: ${s.thColor} !important; font-size: ${s.thSize}px !important; text-align: ${s.thAlign} !important; justify-content: ${s.thAlign === 'left' ? 'flex-start' : (s.thAlign === 'right' ? 'flex-end' : 'center')} !important; }
        #main-table td { color: ${s.tdColor} !important; font-size: ${s.tdSize}px !important; text-align: ${s.tdAlign} !important; }
    `;
}

function bukaModalSetting() {
    let s = safeJSONParse(localStorage.getItem('wms_table_settings'), defaultSettings);
    if (!s || !s.thBg) s = defaultSettings;

    document.getElementById('set-th-bg').value = s.thBg;
    document.getElementById('set-th-color').value = s.thColor;
    document.getElementById('set-th-size').value = s.thSize;
    document.getElementById('set-th-align').value = s.thAlign;
    document.getElementById('set-td-color').value = s.tdColor;
    document.getElementById('set-td-size').value = s.tdSize;
    document.getElementById('set-td-align').value = s.tdAlign;

    document.getElementById('modal-setting').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
}

function simpanSettingTabel() {
    let s = {
        thBg: document.getElementById('set-th-bg').value,
        thColor: document.getElementById('set-th-color').value,
        thSize: parseInt(document.getElementById('set-th-size').value) || 11,
        thAlign: document.getElementById('set-th-align').value,
        tdColor: document.getElementById('set-td-color').value,
        tdSize: parseInt(document.getElementById('set-td-size').value) || 12,
        tdAlign: document.getElementById('set-td-align').value
    };
    localStorage.setItem('wms_table_settings', JSON.stringify(s));
    applyCSS(s);
    tutupSemuaPopups();
}

function resetSettingDefault() {
    localStorage.removeItem('wms_table_settings');
    applyCSS(defaultSettings);
    tutupSemuaPopups();
}

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'kartu_stok', title: 'KARTU STOK', url: 'kartu_stok.html' });
    terapkanSettingAwal(); 
    await loadMasterData();
    setTimeout(muatDataStok, 200);
});

// LOGIKA SORT TABEL
function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-ks');
    const rows = Array.from(tbody.querySelectorAll('tr.row-ks'));
    
    let isAsc = sortState[colIndex] !== 'asc';
    sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim();
        let valB = b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) { return isAsc ? numA - numB : numB - numA; } 
        else { return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-50'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-50'); lucide.createIcons(); }
}

async function loadMasterData() {
    try {
        const {data, error} = await db.from('master_2').select('*');
        if (data) {
            masterData.kamus = data;
            let poSet = new Set(); data.forEach(d => { if(d.po) poSet.add(d.po.trim()); });
            const sel = document.getElementById('input-new-po');
            let html = '<option value="">-- PILIH PO --</option>';
            Array.from(poSet).sort().forEach(po => { html += `<option value="${po}">${po}</option>`; });
            sel.innerHTML = html;
        }
    } catch (e) { console.error("Gagal muat master_2:", e); }
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

async function muatDataStok() {
    document.getElementById('tbody-ks').innerHTML = `<tr><td colspan="17" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500">Menghubungkan ke Gudang Supabase...</p></td></tr>`;
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

            // PENERJEMAHAN KODE DENGAN SAFE TRIM() ANTI-SPASI
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
            let txtPoAktual = cPA && cPA.po ? cPA.po : rawPoAktual;

            dataKSQR.push({
                qrcode: trimQR || '-',
                id_sku: r.id_sku || '-',
                area: areaBarang || '-',
                tglProduksi: r.tgl_produksi || t.tglProduksi || '-',
                mesin: txtMesin || '-',
                shift: txtShift || '-',
                jenis: jenisBarang || '-',
                nama: namaBarang || '-',
                pjg: panjangBarang || '-',
                grade: gradeBarang || '-',
                dus: dusBarang || '-',
                shading: shadingBarang || '-',
                po_bawaan: txtPoBawaan || '-',
                po_aktual: txtPoAktual || '-',
                ket: ket
            });

            let keyArea = `${r.id_sku}_${ket}`;
            if(!areaMap[keyArea]) {
                areaMap[keyArea] = { 
                    id_sku: r.id_sku, key_lengkap: keyArea, area: areaBarang, jenis: jenisBarang, nama: namaBarang, 
                    pjg: panjangBarang, grade: gradeBarang, dus: dusBarang, shading: shadingBarang, po: txtPoAktual, ket: ket,
                    qty: 0, qrcodes: [] 
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
                globalMap[gKey] = { 
                    gKey: gKey, jenis: a.jenis, nama: a.nama, pjg: a.pjg, 
                    grade: a.grade, dus: a.dus, shading: a.shading, po: a.po, ket: a.ket,
                    qty: 0, areas: [] 
                };
            }
            globalMap[gKey].qty += a.qty;
            globalMap[gKey].areas.push({
                id_sku: a.id_sku, key_lengkap: a.key_lengkap, area: a.area, po: a.po, ket: a.ket, qty: a.qty, qrcodes: a.qrcodes,
                nama: a.nama, pjg: a.pjg, grade: a.grade, dus: a.dus, shading: a.shading, jenis: a.jenis 
            });
        });
        dataKSGlobal = Object.values(globalMap);

        renderTabel();
    } catch(e) { document.getElementById('tbody-ks').innerHTML = `<tr><td colspan="17" class="p-10 text-red-500 font-bold">Gagal mengolah data: ${e.message}</td></tr>`; }
}

function setModeKS(m) {
    modeKS = m;
    ['qr', 'area', 'global', 'lembaran'].forEach(tab => {
        const el = document.getElementById('tab-' + tab);
        if(el) el.className = (m === tab) ? 'px-5 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-5 py-3.5 tab-inactive hover:text-slate-800 hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    });
    
    document.getElementById('btn-ganti-po-main').classList.toggle('hidden', m === 'global' || m === 'lembaran');
    document.getElementById('f-qr-container').classList.toggle('hidden', m !== 'qr');
    document.getElementById('f-area-container').classList.toggle('hidden', m === 'global' || m === 'lembaran');
    
    renderTabel();
}

function renderTabel() {
    const thead = document.getElementById('thead-ks');
    const tbody = document.getElementById('tbody-ks');
    sortState = {}; 

    if(modeKS === 'qr') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600"></th>
                <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(1, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-area cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">Area <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-qr cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">QRCode <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-tgl cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Tgl Produksi <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-mesin cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(5, this)"><div class="flex items-center justify-center gap-1">Mesin <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shift cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Shift <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-blue-300 col-jenis cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(7, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-nama cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(9, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(10, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-dus cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(11, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shading cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(12, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 text-slate-400 col-po-bawaan cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(13, this)"><div class="flex items-center justify-center gap-1">PO Bawaan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-orange-400 bg-orange-900 border-r border-slate-500 col-po cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(14, this)"><div class="flex items-center justify-center gap-1">PO Aktual <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-center col-ket cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(15, this)"><div class="flex items-center justify-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
            </tr>`;
        
        if(dataKSQR.length === 0) { tbody.innerHTML = `<tr><td colspan="16" class="p-6 font-bold text-slate-400">Gudang Kosong.</td></tr>`; return; }

        let h = '';
        dataKSQR.forEach((r, i) => {
            const safeQRs = JSON.stringify([r.qrcode]).replace(/"/g, "&quot;");
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition row-ks">
                    <td class="p-3 col-cb"><input type="checkbox" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po_aktual}" data-ket="${r.ket}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-3 font-bold opacity-50 col-no">${i+1}</td>
                    <td class="p-3 font-black text-emerald-700 bg-emerald-50 border-r border-slate-200 col-area">${r.area}</td>
                    <td class="p-3 font-mono font-bold tracking-wide border-r border-slate-200 col-qr text-left">${r.qrcode}</td>
                    <td class="p-3 font-bold opacity-80 col-tgl">${r.tglProduksi}</td>
                    <td class="p-3 font-bold opacity-80 col-mesin">${r.mesin}</td>
                    <td class="p-3 font-bold opacity-80 border-r border-slate-200 col-shift">${r.shift}</td>
                    <td class="p-3 font-black text-blue-700 col-jenis">${r.jenis}</td>
                    <td class="p-3 font-bold text-left col-nama">${r.nama}</td>
                    <td class="p-3 font-bold col-pjg">${r.pjg}</td>
                    <td class="p-3 font-bold col-grade">${r.grade}</td>
                    <td class="p-3 font-bold col-dus">${r.dus}</td>
                    <td class="p-3 font-bold border-r border-slate-200 col-shading">${r.shading}</td>
                    <td class="p-3 font-bold border-r border-slate-200 col-po-bawaan opacity-50">${r.po_bawaan}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 border-r border-slate-200 col-po">${r.po_aktual}</td>
                    <td class="p-3 font-semibold opacity-70 col-ket">${r.ket}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    else if(modeKS === 'area') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600"></th>
                <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(1, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-area cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">Area <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-blue-300 col-jenis cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-nama cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(5, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-dus border-r border-slate-500 cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(7, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-shading cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-orange-300 bg-slate-900 border-x border-slate-500 col-po cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(9, this)"><div class="flex items-center justify-center gap-1">PO Aktual <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-ket border-r border-slate-500 cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(10, this)"><div class="flex items-center justify-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-emerald-300 bg-slate-900 col-qty cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(11, this)"><div class="flex items-center justify-center gap-1">QTY (DUS) <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
            </tr>`;
        
        if(dataKSArea.length === 0) { tbody.innerHTML = `<tr><td colspan="12" class="p-6 font-bold text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        let h = '';
        dataKSArea.forEach((r, i) => {
            const safeQRs = JSON.stringify(r.qrcodes).replace(/"/g, "&quot;");
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition row-ks">
                    <td class="p-3 col-cb"><input type="checkbox" data-idsku="${r.id_sku}" data-qrs="${safeQRs}" data-jenis="${r.jenis}" data-nama="${r.nama}" data-pjg="${r.pjg}" data-grade="${r.grade}" data-dus="${r.dus}" data-shading="${r.shading}" data-area="${r.area}" data-po="${r.po}" data-ket="${r.ket}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-3 font-bold opacity-50 col-no">${i+1}</td>
                    <td class="p-3 font-black text-emerald-700 bg-emerald-50 border-r border-slate-200 col-area">${r.area}</td>
                    <td class="p-3 font-black text-blue-700 col-jenis">${r.jenis}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama}</td>
                    <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg}</td>
                    <td class="p-3 font-bold text-slate-800 col-grade">${r.grade}</td>
                    <td class="p-3 font-bold border-r border-slate-200 col-dus">${r.dus}</td>
                    <td class="p-3 font-bold col-shading">${r.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 border-x border-slate-200 col-po">${r.po}</td>
                    <td class="p-3 font-semibold opacity-70 border-r border-slate-200 col-ket">${r.ket}</td>
                    <td class="p-3 font-black text-slate-900 bg-slate-100 col-qty">${r.qty}</td>
                </tr>`;
        });
        tbody.innerHTML = h;

    } else if (modeKS === 'global') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600"></th>
                <th class="hdr-std w-12 bg-slate-900 text-blue-300 col-open">OPEN</th>
                <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-blue-300 border-l border-slate-500 col-jenis cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-nama cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(5, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-dus cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(7, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-shading cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-orange-300 bg-slate-900 border-x border-slate-500 w-48 col-po cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(9, this)"><div class="flex items-center justify-center gap-1">PO Aktual <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-ket border-r border-slate-500 cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(10, this)"><div class="flex items-center justify-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-emerald-300 bg-slate-900 col-qty cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(11, this)"><div class="flex items-center justify-center gap-1">TOTAL (DUS) <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
            </tr>`;

        if(dataKSGlobal.length === 0) { tbody.innerHTML = `<tr><td colspan="12" class="p-6 font-bold text-slate-400">Tidak ada stok tersimpan.</td></tr>`; return; }

        let h = '';
        dataKSGlobal.forEach((r, i) => {
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition row-ks">
                    <td class="p-3 col-cb"><input type="checkbox" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-2 col-open"><button onclick="bukaBreakdown('${r.gKey}')" class="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded shadow-sm transition flex mx-auto items-center justify-center"><i data-lucide="box" class="w-4 h-4"></i></button></td>
                    <td class="p-3 font-bold opacity-50 col-no">${i+1}</td>
                    <td class="p-3 font-black text-blue-700 border-l border-slate-200 col-jenis">${r.jenis}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama}</td>
                    <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg}</td>
                    <td class="p-3 font-bold text-slate-800 col-grade">${r.grade}</td>
                    <td class="p-3 font-bold text-slate-800 border-r border-slate-200 col-dus">${r.dus}</td>
                    <td class="p-3 font-bold text-slate-600 col-shading">${r.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 border-x border-slate-200 col-po">${r.po}</td>
                    <td class="p-3 font-semibold opacity-70 border-r border-slate-200 col-ket">${r.ket}</td>
                    <td class="p-3 font-black text-slate-900 bg-slate-100 col-qty">${r.qty}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if (modeKS === 'lembaran') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleCentangUtama(this.checked)" class="cursor-pointer rounded text-blue-600"></th>
                <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(1, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-area cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">Kode Master <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-nama cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(5, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-dus cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shading cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(7, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-ket cursor-pointer hover:bg-slate-700 transition" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
            </tr>`;
        
        if(stokLembaranRaw.length === 0) { tbody.innerHTML = `<tr><td colspan="9" class="p-6 font-bold text-slate-400">Tidak ada data stok lembaran.</td></tr>`; return; }

        let h = '';
        stokLembaranRaw.forEach((r, i) => {
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition row-ks">
                    <td class="p-3 col-cb"><input type="checkbox" value="${r.id}" class="cb-main cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-3 font-bold opacity-50 col-no">${i+1}</td>
                    <td class="p-3 font-black text-emerald-700 bg-emerald-50 border-r border-slate-200 col-area">${r.kode_master || '-'}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.nama_item || '-'}</td>
                    <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg || '-'}</td>
                    <td class="p-3 font-bold text-slate-800 col-grade">${r.grade || '-'}</td>
                    <td class="p-3 font-bold text-slate-800 col-dus">${r.dus || '-'}</td>
                    <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shading">${r.shading || '-'}</td>
                    <td class="p-3 font-semibold opacity-70 col-ket">${r.keterangan || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }

    lucide.createIcons(); 
    if(modeKS !== 'lembaran') saringTabel();
}

function toggleCentangUtama(checked) { document.querySelectorAll('.cb-main').forEach(cb => cb.checked = checked); }

function bukaBreakdown(gKey) {
    const item = dataKSGlobal.find(g => g.gKey === gKey);
    if(!item) return;

    document.getElementById('bd-title-item').innerText = `${item.nama} | ${item.pjg} | ${item.grade} | DUS: ${item.dus} | SHADING: ${item.shading} | KET: ${item.ket}`;
    currentBreakdownData = item.areas;

    const tbody = document.getElementById('tbody-breakdown');
    let h = '';
    item.areas.forEach((a, i) => {
        const safeQRs = JSON.stringify(a.qrcodes).replace(/"/g, "&quot;");
        h += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition bd-row">
                <td class="p-3"><input type="checkbox" data-idsku="${a.id_sku}" data-qrs="${safeQRs}" data-jenis="${a.jenis}" data-nama="${a.nama}" data-pjg="${a.pjg}" data-grade="${a.grade}" data-dus="${a.dus}" data-shading="${a.shading}" data-area="${a.area}" data-po="${a.po}" data-ket="${a.ket}" class="cb-bd cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                <td class="p-3 font-bold opacity-50">${i+1}</td>
                <td class="p-3 font-black text-emerald-700 bg-emerald-50">${a.area}</td>
                <td class="p-3 font-black text-orange-600 border-r border-slate-200 bg-orange-50/50">${a.po}</td>
                <td class="p-3 font-semibold opacity-70 border-r border-slate-200">${a.ket}</td>
                <td class="p-3 font-black text-slate-900 bg-slate-100">${a.qty}</td>
            </tr>`;
    });
    tbody.innerHTML = h;

    document.getElementById('modal-breakdown').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    lucide.createIcons();
}

function tutupModalBreakdown() { document.getElementById('modal-breakdown').classList.add('hidden'); document.getElementById('overlay-klik-luar').classList.add('hidden'); }
function toggleCentangBreakdown(checked) { document.querySelectorAll('.cb-bd').forEach(cb => cb.checked = checked); }

function siapkanGantiPO(context) {
    let checkboxes = [];
    if(context === 'main') {
        if(modeKS === 'global' || modeKS === 'lembaran') return;
        checkboxes = document.querySelectorAll('.cb-main:checked');
    } else { checkboxes = document.querySelectorAll('.cb-bd:checked'); }

    if(checkboxes.length === 0) return alert('Silakan centang item / area yang ingin diganti PO-nya.');

    selectedForPO = []; let totalDus = 0;
    checkboxes.forEach(cb => {
        const qrs = JSON.parse(cb.dataset.qrs);
        selectedForPO.push({ 
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

    let maxDus = selectedForPO.reduce((sum, row) => sum + row.qrcodes.length, 0);
    if(qtyDiminta > maxDus) return alert(`Maksimal yang bisa diganti adalah ${maxDus} dus!`);

    const btn = document.getElementById('btn-simpan-po'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...'; btn.disabled = true;

    try {
        let qtySisaUntukDiupdate = qtyDiminta; let payloadItems = [];
        for(let row of selectedForPO) {
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
        
        alert(`BERHASIL! PO Aktual berubah ke ${newPO}.`);
        tutupModalPO(); if(sourcePOContext === 'breakdown') tutupModalBreakdown();
        await muatDataStok();
    } catch (error) { alert("GAGAL UPDATE: " + error.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

function toggleSidebarFilter() { document.getElementById('sidebar-filter').classList.toggle('translate-x-full'); document.getElementById('overlay-klik-luar').classList.toggle('hidden'); }
function tutupSemuaPopups() { document.getElementById('sidebar-filter').classList.add('translate-x-full'); document.getElementById('dropdown-kolom').classList.add('hidden'); tutupModalPO(); tutupModalBreakdown(); document.getElementById('modal-setting').classList.add('hidden'); document.getElementById('overlay-klik-luar').classList.add('hidden'); }

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
        row.style.display = show ? '' : 'none';
    });
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
    document.querySelectorAll('.row-ks').forEach(tr => {
        if(tr.style.display !== 'none') {
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-open')) return;
                if(window.getComputedStyle(td).display !== 'none') { rowData.push(`"${td.innerText.trim()}"`); }
            });
            csvContent += rowData.join(",") + "\n";
        }
    });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `KartuStok_${modeKS.toUpperCase()}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
    </script>
