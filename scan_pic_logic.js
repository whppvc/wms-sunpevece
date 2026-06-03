let currentMode = 'out';
let dataPic = [];
let picRowId = 0;
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};
let masterData = { kamus: [] };

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'scan_pic', title: 'SCAN PIC AREA', url: 'scan_pic.html' }); 
    await loadInitialData();
    await loadAreas(); // Load Master Area untuk Inbound
});

async function loadInitialData() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) masterData.kamus = mData2; 
    } catch(err) { console.error("Gagal load master_2:", err); }
}

async function loadAreas() {
    try {
        const { data } = await db.from('master_area').select('*');
        if (data) {
            const sel = document.getElementById('in-area');
            sel.innerHTML = '<option value="">-- PILIH AREA GUDANG --</option>';
            [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))].sort().forEach(a => {
                sel.innerHTML += `<option value="${a}">${a}</option>`;
            });
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

function translateBarcode(barcode) {
    const parts = barcode.split('/');
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', poBawaan: '-' };
    if (parts.length < 4) return data;

    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon'; else if (hurufDepan === 'L') data.jenisItem = 'List'; else if (hurufDepan === 'W') data.jenisItem = 'WPC'; else data.jenisItem = hurufDepan;

    let rawItem = parts[0]; let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem);
    data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem;
    data.shading = parts[1];

    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1);
        if (rawGrade === '1') data.grade = 'BAGUS'; else if (rawGrade === '2') data.grade = 'A'; else data.grade = rawGrade;
        let rawDus = p2.substring(p2.length - 2); 
        let cariDus = masterData.kamus.find(m => m.kode_dus === rawDus);
        data.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }

    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let rawMesin = match[1]; let rawShift = match[2]; let rawPO = match[3];   
            let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin); data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;
            let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift); data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
            let cariPO = masterData.kamus.find(m => m.kode_po === rawPO); data.poBawaan = cariPO && cariPO.po ? cariPO.po : rawPO;
        }
    }
    return data;
}

// ==========================================
// TABS & MODES MANAGEMENT
// ==========================================
function setModeKonversi(mode) {
    currentMode = mode;
    const tabOut = document.getElementById('tab-out');
    const tabIn = document.getElementById('tab-in');
    const panelOut = document.getElementById('panel-out');
    const panelIn = document.getElementById('panel-in');

    if(mode === 'out') {
        tabOut.className = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        tabIn.className = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        panelOut.classList.remove('hidden'); panelIn.classList.add('hidden');
    } else {
        tabIn.className = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase text-blue-600 border-blue-600';
        tabOut.className = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        panelIn.classList.remove('hidden'); panelOut.classList.add('hidden');
    }

    dataPic = []; renderTablePic(dataPic);
}

function toggleAktifitas() {
    const body = document.getElementById('body-aktifitas'); const icon = document.getElementById('icon-toggle-aktifitas');
    if (body.classList.contains('hidden')) { body.classList.remove('hidden'); icon.classList.remove('rotate-180'); } 
    else { body.classList.add('hidden'); icon.classList.add('rotate-180'); }
}

function toggleAktifitasIn() {
    const body = document.getElementById('body-aktifitas-in'); const icon = document.getElementById('icon-toggle-aktifitas-in');
    if (body.classList.contains('hidden')) { body.classList.remove('hidden'); icon.classList.remove('rotate-180'); } 
    else { body.classList.add('hidden'); icon.classList.add('rotate-180'); }
}

async function bukaModalRiwayatKonversi() {
    const tbody = document.getElementById('tbody-modal-konversi');
    tbody.innerHTML = `<tr><td colspan="8" class="p-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-blue-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-riwayat-konversi').classList.remove('hidden');

    try {
        const { data, error } = await db.from('laporan_konversi').select('*').ilike('aktifitas', 'OUT - %').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-10 font-bold text-slate-400">Tidak ada riwayat konversi OUT.</td></tr>`; return; }

        let h = '';
        data.forEach(d => {
            const dt = new Date(d.created_at);
            const waktu = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            
            // Ekstrak detail JSON
            let detailObj = {};
            try { detailObj = JSON.parse(d.detail); } catch(e){}
            let ket = detailObj.keterangan || '-';
            let detailItem = '-';
            
            if(detailObj.items && detailObj.items.length > 0) {
                let item = detailObj.items[0];
                detailItem = `<span class="text-blue-700">${item.namaItem}</span> | ${item.panjang} | ${item.grade} | ${item.dus} | ${item.shading}`;
                if(detailObj.items.length > 1) detailItem += ` <br><span class="text-[10px] text-slate-400 font-black bg-slate-100 px-1 rounded">(+${detailObj.items.length - 1} item lain)</span>`;
            }

            h += `
                <tr class="border-b hover:bg-slate-50 text-xs transition">
                    <td class="p-2"><button onclick="pilihKodeKonversi('${d.kode_konversi}', '${d.aktifitas}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm transition active:scale-95">PILIH</button></td>
                    <td class="p-2 font-mono font-bold tracking-wider text-slate-800 border-r border-slate-200">${d.kode_konversi}</td>
                    <td class="p-2 font-semibold text-slate-500">${waktu}</td>
                    <td class="p-2 font-black text-rose-600 border-r border-slate-200">${d.aktifitas}</td>
                    <td class="p-3 font-bold text-slate-700 text-left whitespace-normal max-w-[200px] leading-tight">${detailItem}</td>
                    <td class="p-3 font-medium text-slate-600 text-left whitespace-normal max-w-[150px] leading-tight border-r border-slate-200">${ket}</td>
                    <td class="p-2 font-black text-emerald-600 bg-emerald-50">${d.qty_total}</td>
                    <td class="p-2 uppercase opacity-70 font-bold text-slate-500">${d.pic}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch(e) { tbody.innerHTML = `<tr><td colspan="8" class="p-5 text-red-500">${e.message}</td></tr>`; }
}

function pilihKodeKonversi(kode, aktifitas) {
    document.getElementById('in-kode-konversi').value = kode;
    let baseAktifitas = aktifitas.replace('OUT - ', '');
    document.getElementById('in-aktifitas-ref').value = baseAktifitas;
    tutupSemuaModal();
}

function tutupSemuaModal() {
    document.getElementById('modal-po-target').classList.add('hidden');
    document.getElementById('modal-riwayat-konversi').classList.add('hidden');
}

// ==========================================
// SCANNING & TABLE RENDERING
// ==========================================
document.getElementById('form-scan').addEventListener('submit', (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('input-qrcode');
    const rawInput = inputEl.value.trim();
    if(!rawInput) return;

    resetFilterWithoutRender();
    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        const isDuplicate = dataPic.some(d => d.qrcode === code);
        const trans = translateBarcode(code);
        
        dataPic.unshift({ 
            id: ++picRowId, qrcode: code, 
            status: isDuplicate ? 'DUPLIKAT LOKAL' : 'BELUM CEK',
            area: '?', ...trans, poAktualUI: 'Cek Stok...', baseSpec: '', poAsliDB: '-'
        });
    });

    renderTablePic(dataPic);
    inputEl.value = ''; inputEl.focus();
});

function hapusBaris(qrCode) {
    dataPic = dataPic.filter(d => d.qrcode !== qrCode);
    saringTabel();
}

function renderTablePic(dataToRender) {
    const tbody = document.getElementById('tbody-pic');
    if(dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" class="p-10 text-slate-400 font-bold"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</td></tr>';
        lucide.createIcons(); return;
    }
    
    let html = '';
    dataToRender.forEach((d, index) => {
        let badge = "bg-slate-200 text-slate-700";
        if(d.status === 'VALID') badge = "bg-emerald-600 text-white border-emerald-700";
        else if(d.status === 'KOSONG' || d.status === 'DUPLIKAT LOKAL') badge = "bg-red-600 text-white border-red-700";

        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs text-center">
                <td class="p-2 text-center">
                    <button onclick="hapusBaris('${d.qrcode}')" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-2 font-bold">${index + 1}</td>
                <td class="p-2 font-black text-[10px] border-r border-slate-200"><span class="px-2 py-1 rounded shadow-sm border ${badge}">${d.status}</span></td>
                <td class="p-2 font-black text-amber-600">${d.area}</td>
                <td class="p-2 font-mono font-bold text-left tracking-wider border-r border-slate-200">${d.qrcode}</td>
                
                <td class="p-2 font-bold text-slate-600">${d.tglProduksi || '-'}</td>
                <td class="p-2 font-bold text-slate-600">${d.mesin || '-'}</td>
                <td class="p-2 font-bold text-slate-600 border-r border-slate-200">${d.shift || '-'}</td>
                
                <td class="p-2 font-black text-blue-700">${d.jenisItem || '-'}</td>
                <td class="p-2 font-bold text-slate-800 text-left">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold text-slate-600">${d.panjang || '-'}</td>
                <td class="p-2 font-bold text-slate-800">${d.grade || '-'}</td>
                <td class="p-2 font-bold text-slate-800">${d.dus || '-'}</td>
                <td class="p-2 font-bold text-slate-600 border-r border-slate-200">${d.shading || '-'}</td>
                <td class="p-2 text-center font-bold text-slate-500">${d.poBawaan || '-'}</td>
                <td class="p-2 text-center font-black text-orange-600 bg-slate-100 border-l border-slate-200 text-[10px] whitespace-normal leading-tight max-w-[150px]">${d.poAktualUI || 'Cek Stok...'}</td>
            </tr>`;
    });
    tbody.innerHTML = html; lucide.createIcons();
}

function toggleFilter() {
    const sidebar = document.getElementById('sidebar-filter'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
}

function saringTabel() {
    const fStatus = document.getElementById('f-status').value.toLowerCase();
    const fNama = document.getElementById('f-nama').value.toLowerCase();
    const fQr = document.getElementById('f-qr').value.toLowerCase();

    const filtered = dataPic.filter(r => {
        const matchStatus = (r.status || '').toLowerCase().includes(fStatus);
        const matchNama = (r.namaItem || '').toLowerCase().includes(fNama);
        const matchQr = (r.qrcode || '').toLowerCase().includes(fQr);
        return matchStatus && matchNama && matchQr;
    });
    renderTablePic(filtered);
}

function resetFilterWithoutRender() { document.getElementById('f-status').value = ''; document.getElementById('f-nama').value = ''; document.getElementById('f-qr').value = ''; }
function resetFilter() { resetFilterWithoutRender(); renderTablePic(dataPic); }

// ==========================================
// VERIFIKASI GUDANG (PINTAR OUT/IN)
// ==========================================
async function verifikasiGudang() {
    if(dataPic.length === 0) return alert("Belum ada data untuk diverifikasi!");

    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENGECEK...'; btn.disabled = true;

    const allQRs = dataPic.map(d => d.qrcode);

    try {
        const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area, id_sku').in('qrcode', allQRs);
        if(error) throw error;

        let foundDb = dbQRs || [];
        let uniqueSpecs = new Set();

        if (currentMode === 'out') {
            // LOGIKA OUT: Harus ada di stok_qr
            dataPic.forEach(d => {
                let matched = foundDb.find(dbItem => dbItem.qrcode === d.qrcode);
                if (matched) {
                    d.status = 'VALID'; d.area = matched.area; d.poAsliDB = extractPOFromSKU(matched.id_sku);
                    let baseSpec = `${d.jenisItem}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}`;
                    d.baseSpec = baseSpec; uniqueSpecs.add(baseSpec);
                } else {
                    d.status = 'KOSONG'; d.poAktualUI = '-';
                }
            });

            for (let spec of uniqueSpecs) {
                const { data: specStock } = await db.from('stok_qr').select('id_sku').ilike('id_sku', `%_${spec}_%`);
                let poAvailable = new Set();
                if (specStock) { specStock.forEach(row => { let po = extractPOFromSKU(row.id_sku); if (po && po !== '-') poAvailable.add(po); }); }
                let poText = poAvailable.size > 0 ? Array.from(poAvailable).join(', ') : 'KOSONG / NON-PO';
                dataPic.forEach(d => { if (d.status === 'VALID' && d.baseSpec === spec) d.poAktualUI = poText; });
            }
            alert("Selesai memverifikasi fisik Gudang OUT!");

        } else {
            // LOGIKA IN (LANGSIR INBOUND): Harus TIDAK ADA di stok_qr
            const existingQRs = foundDb.map(d => d.qrcode);
            dataPic.forEach(d => {
                if (existingQRs.includes(d.qrcode)) {
                    d.status = 'DUPLIKAT LOKAL'; // Barcode sudah eksis di gudang
                    d.poAktualUI = '-';
                    d.area = 'TOLAK';
                } else {
                    d.status = 'VALID';
                    d.poAktualUI = d.poBawaan || '-'; // Inbound po aktual nya mengikuti po bawaan barcode
                    d.area = 'OK'; // Tunggu area dari dropdown
                }
            });
            alert("Selesai memverifikasi fisik Gudang IN!\nBarcode yang VALID siap dimasukkan.");
        }
    } catch(err) { alert("Gagal koneksi ke Supabase: " + err.message); } 
    finally { saringTabel(); btn.innerHTML = ori; btn.disabled = false; }
}

// ==========================================
// PROSES SIMPAN / EKSEKUSI
// ==========================================
function bukaModalSimpan() {
    if (currentMode === 'out') bukaModalSimpanOut();
    else eksekusiSimpanFinalIn();
}

function bukaModalSimpanOut() {
    const aktifitas = document.getElementById('select-aktifitas').value;
    const keterangan = document.getElementById('input-keterangan-out').value.trim();

    if(!aktifitas) return alert("GAGAL! Anda wajib memilih Jenis Aktifitas OUT terlebih dahulu.");
    if(!keterangan) return alert("GAGAL! Anda wajib mengisi Keterangan / Alasan konversi OUT.");
    if(dataPic.length === 0) return alert("GAGAL! Belum ada item fisik yang di-scan.");

    let unverified = dataPic.filter(d => d.status !== 'VALID');
    if (unverified.length > 0) return alert("GAGAL! Terdapat barcode yang berstatus 'BELUM CEK' atau 'KOSONG'.\nHapus baris merah sebelum simpan.");

    let poSet = new Set();
    dataPic.forEach(d => {
        let pos = d.poAktualUI.split(',').map(s => s.trim());
        pos.forEach(p => { if (p && p !== 'KOSONG / NON-PO' && p !== '?') poSet.add(p); });
    });

    if (poSet.size === 0) return alert("Barang yang Anda scan belum memiliki jatah PO aktual di gudang untuk dikonversi OUT.");

    const sel = document.getElementById('out-po-target');
    sel.innerHTML = '<option value="">-- PILIH PO TARGET KONVERSI --</option>';
    Array.from(poSet).sort().forEach(po => { sel.innerHTML += `<option value="${po}">${po}</option>`; });

    document.getElementById('modal-po-target').classList.remove('hidden');
}

async function eksekusiSimpanFinalOut() {
    const poTarget = document.getElementById('out-po-target').value;
    if(!poTarget) return alert("Wajib memilih PO Tujuan Konversi!");

    const rawAktifitas = document.getElementById('select-aktifitas').value;
    const aktifitas = "OUT - " + rawAktifitas; 
    const keterangan = document.getElementById('input-keterangan-out').value.trim();

    const btn = document.getElementById('btn-eksekusi-final'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...'; btn.disabled = true;

    let prefix = "XX";
    if(rawAktifitas === "Ganti nama item") prefix = "NA";
    else if(rawAktifitas === "Potong panjang") prefix = "PJG";
    else if(rawAktifitas === "Ganti grade") prefix = "GR";
    else if(rawAktifitas === "Ganti dus") prefix = "DS";
    else if(rawAktifitas === "Ganti shading") prefix = "SH";
    else if(rawAktifitas === "Ganti label/qrcode") prefix = "QR";

    let stockCapacity = {}; let specsToProcess = new Set();
    dataPic.forEach(row => { if (row.status === 'VALID') specsToProcess.add(row.baseSpec); });

    try {
        for(let spec of specsToProcess) {
            let parts = spec.split('_');
            let [nm, pj, gr, ds, sh] = [parts[1], parts[2], parts[3], parts[4], parts[5]];
            const { data, error } = await db.from('stok_aktual').select('qty')
                .eq('nama_item', nm).eq('pjg', pj).eq('grade', gr).eq('dus', ds).eq('shading', sh)
                .ilike('po_aktual', `%${poTarget}%`); 
            if (error) throw error;
            let count = 0; if(data) data.forEach(d => count += (d.qty || 0));
            stockCapacity[spec] = count;
        }
    } catch(e) { alert("Gagal membaca kapasitas stok_aktual: " + e.message); btn.innerHTML = ori; btn.disabled = false; return; }

    let qrList = []; let mapAktual = {}; let mapGlobal = {};
    let matchedRows = []; let unmatchedCount = 0;

    dataPic.forEach(d => {
        if (d.status === 'VALID') {
            let baseSpec = d.baseSpec;
            if(stockCapacity[baseSpec] && stockCapacity[baseSpec] > 0) {
                matchedRows.push(d); qrList.push(d.qrcode); stockCapacity[baseSpec] -= 1; 

                let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${poTarget}_-`;
                if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { jenis_item: d.jenisItem, nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, area: d.area, po_aktual: poTarget, ket: '-', qty: 0 };
                mapAktual[keyAkt].qty++;

                let keyGlb = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${poTarget}_-`;
                if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { jenis_item: d.jenisItem, nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, po_bawaan: poTarget, ket: '-', qty: 0 };
                mapGlobal[keyGlb].qty++;
            } else { unmatchedCount++; }
        } else { unmatchedCount++; }
    });

    if (qrList.length === 0) { alert(`❌ TIDAK ADA JATAH.\nSisa stok aktual untuk PO "${poTarget}" adalah 0.`); btn.innerHTML = ori; btn.disabled = false; return; }

    try {
        // A. Mutasi
        for (let row of matchedRows) {
            if (row.poAsliDB !== poTarget) {
                let parts = row.baseSpec.split('_'); let [nm, pj, gr, ds, sh] = [parts[1], parts[2], parts[3], parts[4], parts[5]];
                const targetSkuPattern = `%_${nm}_${pj}_${gr}_${ds}_${sh}_${poTarget}`;
                const { data: qrToSwap, error: swapErr } = await db.from('stok_qr').select('qrcode, id_sku').ilike('id_sku', targetSkuPattern).limit(1);
                if (swapErr) throw swapErr;
                if (qrToSwap && qrToSwap.length > 0) {
                    const oldSku = qrToSwap[0].id_sku; const newSku = oldSku.replace(`_${poTarget}`, `_${row.poAsliDB}`);
                    const { error: updateErr } = await db.from('stok_qr').update({ id_sku: newSku }).eq('qrcode', qrToSwap[0].qrcode);
                    if (updateErr) throw updateErr;
                }
            }
        }

        // B. Eksekusi
        const payloadData = { qrs: qrList, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
        const { error: rpcError } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });
        if (rpcError) throw rpcError;

        // C. Generate Kode
        const { count, error: errCount } = await db.from('laporan_konversi').select('*', { count: 'exact', head: true });
        if(errCount) throw errCount;
        let nextNum = (count || 0) + 1;
        let kodeKonversi = `${prefix}-${String(nextNum).padStart(5, '0')}`;
        let allQRs = qrList.join(', ');

        // D. Insert stok_konversi
        let arrStokKonversi = [];
        matchedRows.forEach(d => {
            arrStokKonversi.push({
                kode_konversi: kodeKonversi, aktifitas: aktifitas, qrcode: d.qrcode,
                tgl_produksi: d.tglProduksi || '-', mesin: d.mesin || '-', shift: d.shift || '-',
                jenis_item: d.jenisItem || '-', nama_item: d.namaItem || '-', pjg: d.panjang || '-',
                grade: d.grade || '-', dus: d.dus || '-', shading: d.shading || '-',
                po_bawaan: d.poAsliDB || '-', po_aktual: poTarget, keterangan: keterangan || '-',
                pic: currentUser.username, area: d.area || '-', status: 'PENDING'
            });
        });
        if(arrStokKonversi.length > 0) {
            const { error: errSk } = await db.from('stok_konversi').insert(arrStokKonversi);
            if(errSk) throw errSk;
        }

        // E. Laporan
        const payloadLog = {
            kode_konversi: kodeKonversi, aktifitas: aktifitas, qrcode: allQRs,
            detail: JSON.stringify({ keterangan: keterangan || '-', po_target: poTarget, items: matchedRows }),
            qty_total: qrList.length, pic: currentUser.username
        };
        const { error: errInsert } = await db.from('laporan_konversi').insert([payloadLog]);
        if (errInsert) throw errInsert;

        let msg = `✅ EKSEKUSI KONVERSI OUT BERHASIL!\n\nID Audit: ${kodeKonversi}\nPO Target: ${poTarget}\nBerhasil dipotong dari Kartu Stok: ${qrList.length} Dus dan dimasukkan ke Stok Konversi.`;
        if (unmatchedCount > 0) msg += `\n\n⚠️ ${unmatchedCount} dus tidak diproses karena jatah PO kurang atau status fisik belum VALID.`;
        alert(msg);
        
        tutupSemuaModal(); dataPic = []; resetFilter();
        document.getElementById('input-keterangan-out').value = '';
        document.getElementById('select-aktifitas').value = '';

    } catch(e) { alert("Kesalahan: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; }
}

async function eksekusiSimpanFinalIn() {
    const kodeRef = document.getElementById('in-kode-konversi').value;
    const aktifitasRef = document.getElementById('in-aktifitas-ref').value;
    const areaTujuan = document.getElementById('in-area').value;
    const ket = document.getElementById('input-keterangan-in').value.trim() || '-';

    if(!kodeRef) return alert("Pilih Kode Konversi OUT (PILIH KODE) sebagai referensi!");
    if(!areaTujuan) return alert("Pilih Area Tujuan Gudang terlebih dahulu!");

    let validItems = dataPic.filter(d => d.status === 'VALID');
    let duplicateItems = dataPic.filter(d => d.status === 'DUPLIKAT LOKAL');
    
    if(duplicateItems.length > 0) return alert("Masih ada barcode DUPLIKAT di dalam tabel! Hapus baris merah terlebih dahulu.");
    if(validItems.length === 0) return alert("Tidak ada item VALID untuk disimpan!");

    if(!confirm(`Lanjutkan memasukkan ${validItems.length} Kardus ke stok Gudang (Area: ${areaTujuan})?\nDengan Kode Induk Konversi: ${kodeRef}`)) return;

    const btn = document.getElementById('btn-save-awal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES IN...'; btn.disabled = true;

    let insertsStokQr = [];
    let aktualUpdates = {};
    let arrStokKonversi = [];

    validItems.forEach(d => {
        let poBawaanAsli = d.poBawaan && d.poBawaan !== '-' ? d.poBawaan : '-';
        let id_sku_baru = `${areaTujuan}_${d.jenisItem}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${poBawaanAsli}`;
        
        insertsStokQr.push({
            qrcode: d.qrcode,
            id_sku: id_sku_baru,
            area: areaTujuan,
            keterangan: ket
        });

        let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${poBawaanAsli}`;
        if(!aktualUpdates[keyAkt]) {
            aktualUpdates[keyAkt] = { nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, po_aktual: poBawaanAsli, qty: 0 };
        }
        aktualUpdates[keyAkt].qty++;

        // REVISI: Kode konversi menggunakan kode yang persis sama, tanpa tambahan "-IN"
        arrStokKonversi.push({
            kode_konversi: kodeRef,
            aktifitas: `IN - ${aktifitasRef}`,
            qrcode: d.qrcode,
            tgl_produksi: d.tglProduksi || '-',
            mesin: d.mesin || '-',
            shift: d.shift || '-',
            jenis_item: d.jenisItem || '-',
            nama_item: d.namaItem || '-',
            pjg: d.panjang || '-',
            grade: d.grade || '-',
            dus: d.dus || '-',
            shading: d.shading || '-',
            po_bawaan: poBawaanAsli,
            po_aktual: poBawaanAsli,
            keterangan: ket,
            pic: currentUser.username,
            area: areaTujuan,
            status: 'PENDING'
        });
    });

    try {
        const { error: e1 } = await db.from('stok_qr').insert(insertsStokQr);
        if(e1) throw e1;

        for(let key in aktualUpdates) {
            let u = aktualUpdates[key];
            const {data: curData} = await db.from('stok_aktual').select('id, qty').eq('nama_item', u.nama_item).eq('pjg', u.pjg).eq('grade', u.grade).eq('dus', u.dus).eq('shading', u.shading).eq('po_aktual', u.po_aktual).single();
            if(curData) {
                await db.from('stok_aktual').update({qty: curData.qty + u.qty}).eq('id', curData.id);
            } else {
                await db.from('stok_aktual').insert([{...u}]); 
            }
        }

        const { error: e3 } = await db.from('stok_konversi').insert(arrStokKonversi);
        if(e3) throw e3;

        const payloadLog = {
            kode_konversi: kodeRef, 
            aktifitas: `IN - ${aktifitasRef}`,
            qrcode: validItems.map(d=>d.qrcode).join(', '),
            detail: JSON.stringify({ keterangan: ket, area_tujuan: areaTujuan, items: validItems }),
            qty_total: validItems.length,
            pic: currentUser.username
        };
        await db.from('laporan_konversi').insert([payloadLog]);

        alert(`✅ BERHASIL KONVERSI IN!\n${validItems.length} dus masuk ke gudang pada area ${areaTujuan} & Saldo bertambah.`);
        dataPic = []; renderTablePic(dataPic);
        document.getElementById('in-kode-konversi').value = '';
        document.getElementById('input-keterangan-in').value = '';
        
    } catch(err) { alert("GAGAL MENYIMPAN: " + err.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}
