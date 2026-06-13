let currentMode = 'out';
let dataPic = [];
let picRowId = 0;
let riwayatKonversiList = [];
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};
let masterData = { kamus: [] };

window.tutupSemuaModal = function() {
    document.getElementById('modal-po-target').classList.add('hidden');
    document.getElementById('modal-riwayat-konversi').classList.add('hidden');
    document.getElementById('modal-lihat-po').classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'scan_pic', title: 'SCAN PIC AREA', url: 'scan_pic.html' }); 
    await loadInitialData();
    await loadAreas(); 
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
            const selIn = document.getElementById('in-area');
            const selPindah = document.getElementById('pindah-area-target');
            let ops = '<option value="">-- Pilih Area Gudang --</option>';
            [...new Set(data.map(d => (d.nama_area || d.area || '').trim()).filter(Boolean))].sort().forEach(a => {
                ops += `<option value="${a}">${a}</option>`;
            });
            selIn.innerHTML = ops;
            selPindah.innerHTML = ops;
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
window.setModeKonversi = function(mode) {
    currentMode = mode;
    const tabOut = document.getElementById('tab-out');
    const tabIn = document.getElementById('tab-in');
    const tabPindah = document.getElementById('tab-pindah');
    
    const panelOut = document.getElementById('panel-out');
    const panelIn = document.getElementById('panel-in');
    const panelPindah = document.getElementById('panel-pindah');
    const boxScanUmum = document.getElementById('box-scan-umum');
    
    const btnVerifUmum = document.getElementById('btn-verifikasi-umum');
    const btnSave = document.getElementById('btn-save-awal');
    const textSave = document.getElementById('text-save-awal');
    const btnRiwayatPindah = document.getElementById('btn-riwayat-pindah');

    [tabOut, tabIn, tabPindah].forEach(t => t.className = 'px-6 py-3.5 border-b-4 border-transparent text-slate-500 font-bold text-xs uppercase hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2');

    if(mode === 'out') {
        tabOut.className = 'px-6 py-3.5 border-b-4 border-rose-600 text-rose-600 bg-rose-50 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2';
        panelOut.classList.remove('hidden'); panelIn.classList.add('hidden'); panelPindah.classList.add('hidden'); boxScanUmum.classList.remove('hidden');
        btnRiwayatPindah.classList.add('hidden');
        
        btnVerifUmum.className = 'flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-medium transition shadow-sm active:scale-95';
        btnSave.className = 'w-full md:w-auto px-8 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase';
        textSave.innerText = "SIMPAN & EKSEKUSI";
    } else if(mode === 'in') {
        tabIn.className = 'px-6 py-3.5 border-b-4 border-emerald-600 text-emerald-600 bg-emerald-50 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2';
        panelIn.classList.remove('hidden'); panelOut.classList.add('hidden'); panelPindah.classList.add('hidden'); boxScanUmum.classList.remove('hidden');
        btnRiwayatPindah.classList.add('hidden');
        
        btnVerifUmum.className = 'flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition shadow-sm active:scale-95';
        btnSave.className = 'w-full md:w-auto px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase';
        textSave.innerText = "SIMPAN KE KARTU STOK";
    } else if(mode === 'pindah') {
        tabPindah.className = 'px-6 py-3.5 border-b-4 border-indigo-600 text-indigo-600 bg-indigo-50 font-black text-xs uppercase transition whitespace-nowrap flex items-center gap-2';
        panelPindah.classList.remove('hidden'); panelOut.classList.add('hidden'); panelIn.classList.add('hidden'); boxScanUmum.classList.add('hidden');
        btnRiwayatPindah.classList.remove('hidden');
        
        btnSave.className = 'w-full md:w-auto px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-95 uppercase';
        textSave.innerText = "SIMPAN PINDAH AREA";
    }

    dataPic = []; renderTablePic(dataPic);
};

window.toggleAktifitas = function(target) {
    const body = document.getElementById(target === 'out' ? 'body-aktifitas-out' : 'body-aktifitas-in');
    const icon = document.getElementById(target === 'out' ? 'icon-toggle-out' : 'icon-toggle-in');
    if (body.classList.contains('hidden')) { body.classList.remove('hidden'); icon.classList.remove('rotate-180'); } 
    else { body.classList.add('hidden'); icon.classList.add('rotate-180'); }
};

window.bukaModalRiwayatKonversi = async function() {
    const tbody = document.getElementById('tbody-modal-konversi');
    tbody.innerHTML = `<tr><td colspan="9" class="p-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-emerald-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-riwayat-konversi').classList.remove('hidden');

    try {
        const { data, error } = await db.from('laporan_konversi').select('*').ilike('aktifitas', 'OUT - %').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="9" class="p-10 font-bold text-slate-400 text-center">Tidak ada riwayat konversi OUT.</td></tr>`; return; }

        riwayatKonversiList = data; 
        let h = '';
        data.forEach(d => {
            const dt = new Date(d.created_at);
            const waktu = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            
            let detailObj = {}; try { detailObj = JSON.parse(d.detail); } catch(e){}
            let ket = detailObj.keterangan || '-';
            let detailItem = '-';
            
            if(detailObj.items && detailObj.items.length > 0) {
                let item = detailObj.items[0];
                detailItem = `<span class="text-blue-700">${item.namaItem || item.nama_item}</span> | ${item.panjang || item.pjg} | ${item.grade} | ${item.dus} | ${item.shading}`;
                if(detailObj.items.length > 1) detailItem += ` <br><span class="text-[10px] text-slate-400 font-black bg-slate-100 px-1 rounded">(+${detailObj.items.length - 1} item lain)</span>`;
            }

            h += `
                <tr class="border-b hover:bg-slate-50 text-xs transition">
                    <td class="p-2"><button onclick="pilihKodeKonversi('${d.kode_konversi}', '${d.aktifitas}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm transition active:scale-95">PILIH</button></td>
                    <td class="p-2">
                        <button onclick="lihatDetailKonversi('${d.kode_konversi}')" class="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition active:scale-95 mx-auto flex" title="Lihat Detail Item">
                            <i data-lucide="list" class="w-4 h-4"></i>
                        </button>
                    </td>
                    <td class="p-2 font-mono font-bold tracking-wider text-slate-800 border-r border-slate-200">${d.kode_konversi}</td>
                    <td class="p-2 font-semibold text-slate-500">${waktu}</td>
                    <td class="p-2 font-black text-rose-600 border-r border-slate-200">${d.aktifitas}</td>
                    <td class="p-3 font-bold text-slate-700 text-left whitespace-normal max-w-[400px] leading-relaxed">${detailItem}</td>
                    <td class="p-3 font-medium text-slate-600 text-left whitespace-normal max-w-[200px] leading-tight border-r border-slate-200">${ket}</td>
                    <td class="p-2 font-black text-emerald-600 bg-emerald-50">${d.qty_total}</td>
                    <td class="p-2 uppercase opacity-70 font-bold text-slate-500">${d.pic}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch(e) { tbody.innerHTML = `<tr><td colspan="9" class="p-5 text-red-500 text-center">${e.message}</td></tr>`; }
    finally { lucide.createIcons(); }
};

window.lihatDetailKonversi = function(kode) {
    const data = riwayatKonversiList.find(r => r.kode_konversi === kode);
    if(!data) return;

    let detailObj = {}; try { detailObj = JSON.parse(data.detail); } catch(e){}
    let items = detailObj.items || [];
    
    let t = `<table class="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead class="bg-slate-800 text-white text-center">
                    <tr><th class="p-2">No</th><th class="p-2">QRCode</th><th class="p-2">Nama Item</th><th class="p-2">Pjg</th><th class="p-2">Grade</th><th class="p-2">Dus</th><th class="p-2">Shading</th></tr>
                </thead>
                <tbody>`;
    items.forEach((item, idx) => {
        t += `<tr class="border-b text-center hover:bg-slate-50">
                <td class="p-2">${idx+1}</td>
                <td class="p-2 font-mono font-bold">${item.qrcode}</td>
                <td class="p-2 text-left font-bold text-blue-700">${item.namaItem || item.nama_item}</td>
                <td class="p-2 font-bold">${item.panjang || item.pjg}</td>
                <td class="p-2 font-bold">${item.grade}</td>
                <td class="p-2 font-bold">${item.dus}</td>
                <td class="p-2 font-bold">${item.shading}</td>
              </tr>`;
    });
    t += `</tbody></table>`;
    
    document.getElementById('lbl-detail-kode').innerText = kode;
    document.getElementById('detail-items-content').innerHTML = t;
    document.getElementById('modal-detail-items').classList.remove('hidden');
};

window.pilihKodeKonversi = function(kode, aktifitas) {
    document.getElementById('in-kode-konversi').value = kode;
    let baseAktifitas = aktifitas.replace('OUT - ', '');
    document.getElementById('in-aktifitas-ref').value = baseAktifitas;
    window.tutupSemuaModal();
};

window.bukaModalRiwayatPindah = async function() {
    const tbody = document.getElementById('tbody-riwayat-pindah');
    tbody.innerHTML = `<tr><td colspan="12" class="p-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-indigo-500"></i></td></tr>`;
    lucide.createIcons();
    document.getElementById('modal-riwayat-pindah').classList.remove('hidden');

    try {
        const { data, error } = await db.from('barang_pindah').select('*').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="12" class="p-10 font-bold text-slate-400 text-center">Tidak ada riwayat pindah area.</td></tr>`; return; }

        let h = '';
        data.forEach((d, i) => {
            const dt = new Date(d.created_at);
            const waktu = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            
            h += `
                <tr class="border-b hover:bg-slate-50 text-xs transition text-center">
                    <td class="p-2 font-bold text-slate-500">${i+1}</td>
                    <td class="p-2 font-semibold text-slate-500">${waktu}</td>
                    <td class="p-2 font-black text-indigo-700 bg-indigo-50 border-r border-slate-200">${d.area_awal} ➔ ${d.area_akhir}</td>
                    <td class="p-2 font-mono font-bold tracking-wider text-slate-800 border-r border-slate-200">${d.qrcode}</td>
                    <td class="p-2 font-bold text-blue-700 text-left">${d.nama_item}</td>
                    <td class="p-2 font-bold text-slate-600">${d.panjang}</td>
                    <td class="p-2 font-bold text-slate-800">${d.grade}</td>
                    <td class="p-2 font-bold text-slate-800">${d.dus}</td>
                    <td class="p-2 font-bold text-slate-600 border-r border-slate-200">${d.shading}</td>
                    <td class="p-2 font-black text-orange-600">${d.po}</td>
                    <td class="p-2 font-medium text-slate-600 text-left border-r border-slate-200">${d.keterangan || '-'}</td>
                    <td class="p-2 uppercase opacity-70 font-bold text-slate-500">${d.pic}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch(e) { tbody.innerHTML = `<tr><td colspan="12" class="p-5 text-red-500 text-center">${e.message}</td></tr>`; }
    finally { lucide.createIcons(); }
};

// ==========================================
// SCANNING HANDLER
// ==========================================
document.getElementById('form-scan-out').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-out')); });
document.getElementById('form-scan-in').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-in')); });
document.getElementById('form-scan-pindah').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-pindah')); });
document.getElementById('form-scan-umum').addEventListener('submit', (e) => { e.preventDefault(); handleScan(document.getElementById('input-qrcode-umum')); });

function handleScan(inputEl) {
    const rawInput = inputEl.value.trim();
    if(!rawInput) return;

    window.resetFilterWithoutRender();
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
}

window.hapusBaris = function(qrCode) {
    dataPic = dataPic.filter(d => d.qrcode !== qrCode);
    window.saringTabel();
};

function renderTablePic(dataToRender) {
    const tbody = document.getElementById('tbody-pic');
    if(dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</td></tr>';
        lucide.createIcons(); return;
    }
    
    let html = '';
    dataToRender.forEach((d, index) => {
        let badge = "bg-slate-200 text-slate-700";
        if(d.status === 'VALID') badge = "bg-emerald-600 text-white border-emerald-700";
        else if(d.status === 'KOSONG' || d.status === 'DUPLIKAT LOKAL') badge = "bg-red-600 text-white border-red-700";

        // REVISI 1: Tombol Lihat PO
        let btnPO = d.poAktualUI;
        if (d.status === 'VALID' && d.poAktualUI !== '-' && d.poAktualUI !== 'KOSONG' && d.poAktualUI !== 'Cek Stok...') {
            btnPO = `<button onclick="window.bukaModalLihatPO('${encodeURIComponent(d.poAktualUI)}')" class="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-1 rounded text-[10px] font-bold hover:bg-orange-200 transition flex items-center justify-center gap-1 mx-auto w-full max-w-[100px]"><i data-lucide="eye" class="w-3 h-3"></i> Lihat PO</button>`;
        }

        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs text-center">
                <td class="p-2 text-center">
                    <button onclick="window.hapusBaris('${d.qrcode}')" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
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
                <td class="p-2 text-center font-black text-orange-600 bg-slate-100 border-l border-slate-200 text-[10px] whitespace-normal leading-tight max-w-[150px]">${btnPO}</td>
            </tr>`;
    });
    tbody.innerHTML = html; lucide.createIcons();
}

window.toggleFilter = function() {
    const sidebar = document.getElementById('sidebar-filter'); const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) { sidebar.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); } 
    else { sidebar.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
};

window.saringTabel = function() {
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
};

window.resetFilterWithoutRender = function() { document.getElementById('f-status').value = ''; document.getElementById('f-nama').value = ''; document.getElementById('f-qr').value = ''; };
window.resetFilter = function() { window.resetFilterWithoutRender(); renderTablePic(dataPic); };

// ==========================================
// VERIFIKASI GUDANG (PINTAR OUT/IN/PINDAH)
// ==========================================
window.verifikasiGudang = async function() {
    if(dataPic.length === 0) return alert("Belum ada data untuk diverifikasi!");

    const btns = document.querySelectorAll('button[onclick="verifikasiGudang()"]');
    let originalTexts = [];
    btns.forEach((btn, idx) => { originalTexts[idx] = btn.innerHTML; btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Mengecek...'; btn.disabled = true; });

    const allQRs = dataPic.map(d => d.qrcode);

    try {
        // REVISI 2: Langsung ambil PO dari id_sku, tidak perlu ilike
        const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area, id_sku').in('qrcode', allQRs);
        if(error) throw error;

        let foundDb = dbQRs || [];
        let uniqueSpecs = new Set();

        if (currentMode === 'out' || currentMode === 'pindah') {
            dataPic.forEach(d => {
                let matched = foundDb.find(dbItem => dbItem.qrcode === d.qrcode);
                if (matched) {
                    d.status = 'VALID'; 
                    d.area = matched.area; 
                    d.poAsliDB = extractPOFromSKU(matched.id_sku);
                    d.poAktualUI = d.poAsliDB; // Langsung tampilkan PO Aktual
                    d.baseSpec = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}`;
                    uniqueSpecs.add(d.baseSpec);
                } else {
                    d.status = 'KOSONG'; 
                    d.poAktualUI = '-';
                }
            });

            // REVISI 2: Ambil distribusi PO Aktual dari stok_aktual
            let poDistMap = {};
            for (let spec of uniqueSpecs) {
                let parts = spec.split('_'); // nama_pjg_grade_dus_shading
                const { data: actData } = await db.from('stok_aktual').select('po_aktual, qty')
                    .eq('nama_item', parts[0]).eq('pjg', parts[1]).eq('grade', parts[2])
                    .eq('dus', parts[3]).eq('shading', parts[4]);
                
                if(actData) {
                    poDistMap[spec] = {};
                    actData.forEach(a => {
                        if(!poDistMap[spec][a.po_aktual]) poDistMap[spec][a.po_aktual] = 0;
                        poDistMap[spec][a.po_aktual] += a.qty;
                    });
                }
            }

            dataPic.forEach(d => { 
                if (d.status === 'VALID') {
                    let dist = poDistMap[d.baseSpec];
                    let arr = [];
                    if(dist) {
                        for(let po in dist) arr.push(`${po} (${dist[po]} Dus)`);
                    }
                    d.poAktualUI = arr.length > 0 ? arr.join(' | ') : 'KOSONG';
                } 
            });
            
            alert(`Selesai memverifikasi fisik Gudang untuk Mode ${currentMode.toUpperCase()}!`);

        } else if (currentMode === 'in') {
            const existingQRs = foundDb.map(d => d.qrcode);
            dataPic.forEach(d => {
                if (existingQRs.includes(d.qrcode)) {
                    d.status = 'DUPLIKAT LOKAL'; 
                    d.poAktualUI = '-';
                    d.area = 'TOLAK';
                } else {
                    d.status = 'VALID';
                    d.poAktualUI = d.poBawaan || '-'; 
                    d.area = 'OK'; 
                }
            });
            alert("Selesai memverifikasi fisik Gudang IN!\nBarcode yang VALID siap dimasukkan.");
        }
    } catch(err) { alert("Gagal koneksi ke Supabase: " + err.message); } 
    finally { 
        window.saringTabel(); 
        btns.forEach((btn, idx) => { btn.innerHTML = originalTexts[idx]; btn.disabled = false; });
        lucide.createIcons();
    }
};

// ==========================================
// PROSES SIMPAN / EKSEKUSI
// ==========================================
window.bukaModalSimpan = function() {
    if (currentMode === 'out') bukaModalSimpanOut();
    else if (currentMode === 'in') eksekusiSimpanFinalIn();
    else if (currentMode === 'pindah') eksekusiPindahArea();
};

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
        if (d.poAktualUI && d.poAktualUI !== 'KOSONG / NON-PO' && d.poAktualUI !== '-' && d.poAktualUI !== '?') {
            // Ekstrak nama PO dari string "PO (X Dus) | PO2 (Y Dus)"
            let parts = d.poAktualUI.split('|');
            parts.forEach(p => {
                let poName = p.split('(')[0].trim();
                if(poName) poSet.add(poName);
            });
        }
    });

    if (poSet.size === 0) return alert("Barang yang Anda scan belum memiliki jatah PO aktual di gudang untuk dikonversi OUT.");

    const sel = document.getElementById('out-po-target');
    sel.innerHTML = '<option value="">-- PILIH PO TARGET KONVERSI --</option>';
    Array.from(poSet).sort().forEach(po => { sel.innerHTML += `<option value="${po}">${po}</option>`; });

    document.getElementById('modal-po-target').classList.remove('hidden');
}

// REVISI 1: Modal Lihat PO
window.bukaModalLihatPO = function(encodedPOs) {
    const poStr = decodeURIComponent(encodedPOs);
    const poArr = poStr.split('|').map(p => p.trim()).filter(p => p);
    const ul = document.getElementById('list-po-aktual');
    if (poArr.length === 0 || poArr[0] === 'KOSONG') {
        ul.innerHTML = '<li class="text-slate-400 italic font-medium p-3 bg-slate-50 rounded-md text-center border border-slate-200">Tidak ada PO Aktual tersimpan.</li>';
    } else {
        ul.innerHTML = poArr.map(p => {
            let parts = p.split('(');
            let namaPo = parts[0].trim();
            let qtyPo = parts[1] ? parts[1].replace(')', '').trim() : '';
            return `<li class="p-3 bg-white border border-slate-200 shadow-sm text-slate-700 font-semibold rounded-md flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-orange-500"></i> <span>${namaPo}</span></div> 
                        <span class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-black">${qtyPo}</span>
                    </li>`;
        }).join('');
    }
    lucide.createIcons();
    document.getElementById('modal-lihat-po').classList.remove('hidden');
};

// ========================================================
// FUNGSI SINKRONISASI DATABASE (DIPANGGIL OTOMATIS)
// ========================================================
async function sinkronisasiUlangStokAktual() {
    try {
        const { data: fisikQr, error: errQr } = await db.from('stok_qr').select('*');
        if(errQr) throw errQr;
        
        let mapAgg = {};
        (fisikQr || []).forEach(r => {
            let p = r.id_sku ? r.id_sku.split('_') : [];
            let t = typeof translateBarcode === 'function' ? translateBarcode(r.qrcode) : {};
            
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
                mapAgg[key] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, area: area, po_aktual: po, keterangan: ket, qty: 0 };
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
}

window.eksekusiSimpanFinalOut = async function() {
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
            let [nm, pj, gr, ds, sh] = [parts[0], parts[1], parts[2], parts[3], parts[4]];
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
        for (let row of matchedRows) {
            if (row.poAsliDB !== poTarget) {
                let parts = row.baseSpec.split('_'); let [nm, pj, gr, ds, sh] = [parts[0], parts[1], parts[2], parts[3], parts[4]];
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

        const payloadData = { qrs: qrList, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
        const { error: rpcError } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });
        if (rpcError) throw rpcError;

        const { count, error: errCount } = await db.from('laporan_konversi').select('*', { count: 'exact', head: true });
        if(errCount) throw errCount;
        let nextNum = (count || 0) + 1;
        let kodeKonversi = `${prefix}-${String(nextNum).padStart(5, '0')}`;
        let allQRs = qrList.join(', ');

        let arrStokKonversi = [];
        matchedRows.forEach(d => {
            arrStokKonversi.push({
                kode_konversi: kodeKonversi, aktifitas: aktifitas, qrcode: d.qrcode,
                tgl_produksi: d.tglProduksi || '-', mesin: d.mesin || '-', shift: d.shift || '-',
                jenis_item: d.jenisItem || '-', nama_item: d.namaItem || '-', panjang: d.panjang || '-',
                grade: d.grade || '-', dus: d.dus || '-', shading: d.shading || '-',
                po_bawaan: d.poAsliDB || '-', po_aktual: poTarget, keterangan: keterangan || '-',
                pic: currentUser.username, area: d.area || '-', status: 'PENDING'
            });
        });
        if(arrStokKonversi.length > 0) {
            const { error: errSk } = await db.from('stok_konversi').insert(arrStokKonversi);
            if(errSk) throw errSk;
        }

        const payloadLog = {
            kode_konversi: kodeKonversi, aktifitas: aktifitas, qrcode: allQRs,
            detail: JSON.stringify({ keterangan: keterangan || '-', po_target: poTarget, items: matchedRows }),
            qty_total: qrList.length, pic: currentUser.username
        };
        const { error: errInsert } = await db.from('laporan_konversi').insert([payloadLog]);
        if (errInsert) throw errInsert;

        await sinkronisasiUlangStokAktual();

        let msg = `✅ EKSEKUSI KONVERSI OUT BERHASIL!\n\nID Audit: ${kodeKonversi}\nPO Target: ${poTarget}\nBerhasil dipotong dari Kartu Stok: ${qrList.length} Dus dan dimasukkan ke Stok Konversi.`;
        if (unmatchedCount > 0) msg += `\n\n⚠️ ${unmatchedCount} dus tidak diproses karena jatah PO kurang atau status fisik belum VALID.`;
        alert(msg);
        
        window.tutupSemuaModal(); dataPic = []; window.resetFilterWithoutRender(); renderTablePic(dataPic);
        document.getElementById('input-keterangan-out').value = '';
        document.getElementById('select-aktifitas').value = '';

    } catch(e) { alert("Kesalahan: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; }
};

window.eksekusiSimpanFinalIn = async function() {
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

    if(!confirm(`Lanjutkan memasukkan ${validItems.length} Kardus ke stok Gudang (Area: ${areaTujuan})?\nDengan Kode Konversi: ${kodeRef}`)) return;

    const btn = document.getElementById('btn-save-awal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES IN...'; btn.disabled = true;

    let insertsStokQr = [];
    let arrStokKonversi = [];

    validItems.forEach(d => {
        let poBawaanAsli = d.poBawaan && d.poBawaan !== '-' ? d.poBawaan : '-';
        let id_sku_baru = `${areaTujuan}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${poBawaanAsli}_${ket}`;
        
        insertsStokQr.push({
            qrcode: d.qrcode,
            id_sku: id_sku_baru,
            area: areaTujuan,
            keterangan: ket
        });

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

        await sinkronisasiUlangStokAktual();

        alert(`✅ BERHASIL KONVERSI IN!\n${validItems.length} dus masuk ke gudang pada area ${areaTujuan} & Saldo bertambah.`);
        dataPic = []; window.renderTablePic();
        document.getElementById('in-kode-konversi').value = '';
        document.getElementById('input-keterangan-in').value = '';
        
    } catch(err) { alert("GAGAL MENYIMPAN: " + err.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
};

window.eksekusiPindahArea = async function() {
    const areaTarget = document.getElementById('pindah-area-target').value;
    if(!areaTarget) return alert("Pilih Area Simpan Tujuan terlebih dahulu!");

    let validItems = dataPic.filter(d => d.status === 'VALID');
    if(validItems.length === 0) return alert("Tidak ada item berstatus VALID (Verifikasi Gudang Dulu).");

    if(!confirm(`Pindahkan ${validItems.length} item secara permanen ke Area: ${areaTarget}?`)) return;

    const btn = document.getElementById('btn-save-awal'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMINDAHKAN...'; btn.disabled = true;

    let payloadBarangPindah = [];
    
    try {
        for (let item of validItems) {
            let poBawaanAsli = item.poAsliDB && item.poAsliDB !== '-' ? item.poAsliDB : '-';
            let id_sku_baru = `${areaTarget}_${item.namaItem}_${item.panjang}_${item.grade}_${item.dus}_${item.shading}_${poBawaanAsli}_Pindah Area`;
            
            const { error: errUpdate } = await db.from('stok_qr').update({ area: areaTarget, id_sku: id_sku_baru }).eq('qrcode', item.qrcode);
            if (errUpdate) throw errUpdate;

            payloadBarangPindah.push({
                qrcode: item.qrcode,
                tgl_produksi: item.tglProduksi || '-',
                mesin: item.mesin || '-',
                shift: item.shift || '-',
                nama_item: item.namaItem || '-',
                panjang: item.panjang || '-',
                grade: item.grade || '-',
                dus: item.dus || '-',
                shading: item.shading || '-',
                po: poBawaanAsli,
                keterangan: 'Pindah Area',
                area_awal: item.area, 
                area_akhir: areaTarget,
                pic: currentUser.username
            });
        }

        if (payloadBarangPindah.length > 0) {
            const { error: errPindah } = await db.from('barang_pindah').insert(payloadBarangPindah);
            if (errPindah) throw errPindah;
        }

        await sinkronisasiUlangStokAktual();

        alert(`✅ SUKSES PINDAH AREA!\n${validItems.length} Item berhasil dipindahkan ke area ${areaTarget}.`);
        dataPic = []; window.renderTablePic();
        document.getElementById('pindah-area-target').value = '';

    } catch(e) {
        alert("GAGAL PINDAH AREA: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};
