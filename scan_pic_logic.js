let dataPic = [];
let picRowId = 0;
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};
let masterData = { kamus: [] };

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'scan_pic', title: 'SCAN PIC AREA', url: 'scan_pic.html' }); 
    loadInitialData(); // Load master dictionary WMS
});

// --- FUNGSI LOAD MASTER DATA (Kamus WMS) ---
async function loadInitialData() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) masterData.kamus = mData2; 
    } catch(err) {
        console.error("Gagal load master_2:", err);
    }
}

function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

// Fungsi Penerjemah Barcode
function translateBarcode(barcode) {
    const parts = barcode.split('/');
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', poBawaan: '-' };
    if (parts.length < 4) return data;

    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon'; else if (hurufDepan === 'L') data.jenisItem = 'List'; else if (hurufDepan === 'W') data.jenisItem = 'WPC'; else data.jenisItem = hurufDepan;

    let rawItem = parts[0];
    let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem);
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
        const dayOfYear = parseInt(p3.substring(0, 3));
        const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

        let sisaString = p3.substring(5); 
        let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let rawMesin = match[1]; let rawShift = match[2]; let rawPO = match[3];   
            let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin); data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;
            let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift); data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
            let cariPO = masterData.kamus.find(m => m.kode_po === rawPO); data.poBawaan = cariPO && cariPO.po ? cariPO.po : rawPO;
        }
    }
    return data;
}

// --- FUNGSI MINIMIZE/MAXIMIZE BOX AKTIFITAS ---
function toggleAktifitas() {
    const body = document.getElementById('body-aktifitas');
    const icon = document.getElementById('icon-toggle-aktifitas');
    
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.classList.remove('rotate-180');
    } else {
        body.classList.add('hidden');
        icon.classList.add('rotate-180');
    }
}

// --- FUNGSI SCAN BARCODE ---
document.getElementById('form-scan').addEventListener('submit', (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('input-qrcode');
    const rawInput = inputEl.value.trim();
    if(!rawInput) return;

    resetFilterWithoutRender();
    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        const isDuplicate = dataPic.some(d => d.qrcode === code);
        
        // Terjemahkan murni dari fungsi translateBarcode
        const trans = translateBarcode(code);
        
        dataPic.unshift({ 
            id: ++picRowId, 
            qrcode: code, 
            status: isDuplicate ? 'DUPLIKAT LOKAL' : 'BELUM CEK',
            area: '?', 
            ...trans,
            poAktualUI: 'Cek Stok...',
            baseSpec: '',
            poAsliDB: '-',
            ket_baris: ''
        });
    });

    renderTablePic(dataPic);
    inputEl.value = ''; inputEl.focus();
});

// --- FUNGSI RENDER TABEL & HAPUS BARIS ---
function hapusBaris(qrCode) {
    dataPic = dataPic.filter(d => d.qrcode !== qrCode);
    saringTabel();
}

function updateKetBaris(input, qrCode) {
    let row = dataPic.find(d => d.qrcode === qrCode);
    if(row) row.ket_baris = input.value;
}

function renderTablePic(dataToRender) {
    const tbody = document.getElementById('tbody-pic');
    if(dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="17" class="p-10 text-slate-400 font-bold"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan / filter kosong.</td></tr>';
        lucide.createIcons();
        return;
    }
    
    let html = '';
    dataToRender.forEach((d, index) => {
        let badge = "bg-slate-200 text-slate-700";
        if(d.status === 'VALID') badge = "bg-emerald-600 text-white border-emerald-700";
        else if(d.status === 'KOSONG' || d.status === 'DUPLIKAT LOKAL') badge = "bg-red-600 text-white border-red-700";

        html += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-xs">
                <td class="p-2 text-center">
                    <button onclick="hapusBaris('${d.qrcode}')" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
                <td class="p-2 font-bold">${index + 1}</td>
                <td class="p-2 font-black text-[10px] border-r border-slate-200"><span class="px-2 py-1 rounded shadow-sm border ${badge}">${d.status}</span></td>
                <td class="p-2 font-black text-amber-600">${d.area}</td>
                <td class="p-2 font-mono font-bold border-r border-slate-200">${d.qrcode}</td>
                
                <td class="p-2 font-bold">${d.tglProduksi || '-'}</td>
                <td class="p-2 font-bold">${d.mesin || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shift || '-'}</td>
                
                <td class="p-2 font-black text-blue-700">${d.jenisItem || '-'}</td>
                <td class="p-2 font-bold text-left">${d.namaItem || '-'}</td>
                <td class="p-2 font-bold">${d.panjang || '-'}</td>
                <td class="p-2 font-bold">${d.grade || '-'}</td>
                <td class="p-2 font-bold">${d.dus || '-'}</td>
                <td class="p-2 font-bold border-r border-slate-200">${d.shading || '-'}</td>
                <td class="p-2 text-center font-bold text-slate-500">${d.poBawaan || '-'}</td>
                <td class="p-2 text-center font-black text-orange-600 bg-slate-100 border-l border-slate-200 text-[10px] whitespace-normal leading-tight max-w-[150px]">${d.poAktualUI || 'Cek Stok...'}</td>
                <td class="p-2"><input type="text" onchange="updateKetBaris(this, '${d.qrcode}')" value="${d.ket_baris || ''}" class="w-full p-1.5 text-[11px] font-bold border border-slate-300 rounded focus:border-blue-500 outline-none" placeholder="Ket..."></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    lucide.createIcons();
}

// --- FUNGSI FILTER SIDEBAR ---
function toggleFilter() {
    const sidebar = document.getElementById('sidebar-filter');
    const overlay = document.getElementById('overlay-klik-luar');
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    }
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
function resetFilterWithoutRender() {
    document.getElementById('f-status').value = '';
    document.getElementById('f-nama').value = '';
    document.getElementById('f-qr').value = '';
}
function resetFilter() {
    resetFilterWithoutRender();
    renderTablePic(dataPic);
}

// --- FUNGSI VERIFIKASI GUDANG & HITUNG PO AKTUAL ---
async function verifikasiKeluar() {
    if(dataPic.length === 0) return alert("Belum ada data untuk diverifikasi!");

    const btn = document.getElementById('btn-verifikasi');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENGECEK...';
    btn.disabled = true;

    const allQRs = dataPic.map(d => d.qrcode);
    let uniqueSpecs = new Set();

    try {
        const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area, id_sku').in('qrcode', allQRs);
        if(error) throw error;

        let foundDb = dbQRs || [];
        
        dataPic.forEach(d => {
            let matched = foundDb.find(dbItem => dbItem.qrcode === d.qrcode);
            if (matched) {
                d.status = 'VALID';
                d.area = matched.area; 
                d.poAsliDB = extractPOFromSKU(matched.id_sku);
                
                let baseSpec = `${d.jenisItem}_${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}`;
                d.baseSpec = baseSpec;
                uniqueSpecs.add(baseSpec);
            } else {
                d.status = 'KOSONG';
                d.poAktualUI = '-';
            }
        });

        for (let spec of uniqueSpecs) {
            const { data: specStock } = await db.from('stok_qr').select('id_sku').ilike('id_sku', `%_${spec}_%`);
            let poAvailable = new Set();
            
            if (specStock) {
                specStock.forEach(row => {
                    let po = extractPOFromSKU(row.id_sku);
                    if (po && po !== '-') poAvailable.add(po);
                });
            }
            
            let poText = poAvailable.size > 0 ? Array.from(poAvailable).join(', ') : 'KOSONG / NON-PO';
            
            dataPic.forEach(d => {
                if (d.status === 'VALID' && d.baseSpec === spec) {
                    d.poAktualUI = poText;
                }
            });
        }

        alert("Selesai memverifikasi fisik Gudang dan mengecek jatah PO!");
    } catch(err) {
        alert("Gagal koneksi ke Supabase: " + err.message);
    } finally {
        saringTabel(); 
        btn.innerHTML = ori; btn.disabled = false;
    }
}


// --- FUNGSI BUKA MODAL PO & EKSEKUSI ---
function tutupModalPO() {
    document.getElementById('modal-po-target').classList.add('hidden');
}

function bukaModalSimpan() {
    const aktifitas = document.getElementById('select-aktifitas').value;
    const keterangan = document.getElementById('input-keterangan').value.trim();

    if(!aktifitas) return alert("GAGAL! Anda wajib memilih Jenis Aktifitas terlebih dahulu.");
    if(dataPic.length === 0) return alert("GAGAL! Belum ada item fisik yang di-scan.");

    let unverified = dataPic.filter(d => d.status !== 'VALID');
    if (unverified.length > 0) {
        return alert("GAGAL! Terdapat barcode yang berstatus 'BELUM CEK' atau 'KOSONG'.\n\nSilakan hapus baris yang error (warna merah) menggunakan ikon keranjang.");
    }

    let poSet = new Set();
    dataPic.forEach(d => {
        if (d.status === 'VALID') {
            let pos = d.poAktualUI.split(',').map(s => s.trim());
            pos.forEach(p => { if (p && p !== 'KOSONG / NON-PO' && p !== '?') poSet.add(p); });
        }
    });

    if (poSet.size === 0) return alert("Barang yang Anda scan belum memiliki jatah PO aktual di gudang untuk dikonversi.");

    const sel = document.getElementById('out-po-target');
    sel.innerHTML = '<option value="">-- PILIH PO TARGET KONVERSI --</option>';
    Array.from(poSet).sort().forEach(po => {
        sel.innerHTML += `<option value="${po}">${po}</option>`;
    });

    document.getElementById('modal-po-target').classList.remove('hidden');
}

// --- FUNGSI BUKA MODAL PO & EKSEKUSI ---
async function eksekusiSimpanFinal() {
    const poTarget = document.getElementById('out-po-target').value;
    if(!poTarget) return alert("Wajib memilih PO Tujuan Konversi!");

    const aktifitas = document.getElementById('select-aktifitas').value;
    const keterangan = document.getElementById('input-keterangan').value.trim();

    const btn = document.getElementById('btn-eksekusi-final');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...';
    btn.disabled = true;

    // 1. GENERATE PREFIX KODE
    let prefix = "";
    if(aktifitas === "Ganti nama item") prefix = "NA";
    else if(aktifitas === "Potong panjang") prefix = "PJG";
    else if(aktifitas === "Ganti grade") prefix = "GR";
    else if(aktifitas === "Ganti dus") prefix = "D";
    else if(aktifitas === "Ganti shading") prefix = "SH";
    else if(aktifitas === "Ganti label/qrcode") prefix = "QR";
    else if(aktifitas === "Sampel") prefix = "SM";
    else prefix = "XX";

    // 2. CEK KAPASITAS JATAH DI STOK_AKTUAL
    let stockCapacity = {};
    let specsToProcess = new Set();
    dataPic.forEach(row => {
        if (row.status === 'VALID') specsToProcess.add(row.baseSpec);
    });

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
    } catch(e) {
        alert("Gagal membaca kapasitas stok_aktual: " + e.message); 
        btn.innerHTML = ori; btn.disabled = false; return;
    }

    // 3. SIAPKAN PAYLOAD UNTUK PEMOTONGAN
    let qrList = []; let mapAktual = {}; let mapGlobal = {};
    let matchedRows = []; let unmatchedCount = 0;

    dataPic.forEach(d => {
        if (d.status === 'VALID') {
            let baseSpec = d.baseSpec;
            if(stockCapacity[baseSpec] && stockCapacity[baseSpec] > 0) {
                matchedRows.push(d);
                qrList.push(d.qrcode);
                stockCapacity[baseSpec] -= 1; 

                // Payload Aktual
                let keyAkt = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${poTarget}_${d.ket_baris || '-'}`;
                if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, area: d.area, po_aktual: poTarget, ket: d.ket_baris || '-', qty: 0 };
                mapAktual[keyAkt].qty++;

                // Payload Global (Potong target)
                let keyGlb = `${d.namaItem}_${d.panjang}_${d.grade}_${d.dus}_${d.shading}_${poTarget}_${d.ket_baris || '-'}`;
                if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { nama_item: d.namaItem, pjg: d.panjang, grade: d.grade, dus: d.dus, shading: d.shading, po_bawaan: poTarget, ket: d.ket_baris || '-', qty: 0 };
                mapGlobal[keyGlb].qty++;
            } else { unmatchedCount++; }
        } else { unmatchedCount++; }
    });

    if (qrList.length === 0) {
        alert(`❌ TIDAK ADA JATAH.\nSisa stok aktual untuk PO "${poTarget}" adalah 0.`);
        btn.innerHTML = ori; btn.disabled = false; return;
    }

    // 4. EKSEKUSI DATABASE
    try {
        // A. Fitur Auto-Swap PO (Jika Scan Cross-PO)
        for (let row of matchedRows) {
            let baseSpec = row.baseSpec;
            let poBawaan = row.poAsliDB;
            
            if (poBawaan !== poTarget) {
                let parts = baseSpec.split('_');
                let [nm, pj, gr, ds, sh] = [parts[1], parts[2], parts[3], parts[4], parts[5]];
                const targetSkuPattern = `%_${nm}_${pj}_${gr}_${ds}_${sh}_${poTarget}`;
                
                const { data: qrToSwap, error: swapErr } = await db.from('stok_qr').select('qrcode, id_sku').ilike('id_sku', targetSkuPattern).limit(1);
                if (swapErr) throw swapErr;
                
                if (qrToSwap && qrToSwap.length > 0) {
                    const oldQr = qrToSwap[0].qrcode;
                    const oldSku = qrToSwap[0].id_sku;
                    const newSku = oldSku.replace(`_${poTarget}`, `_${poBawaan}`);
                    
                    const { error: updateErr } = await db.from('stok_qr').update({ id_sku: newSku }).eq('qrcode', oldQr);
                    if (updateErr) throw updateErr;
                }
            }
        }

        // B. Hapus Fisik & Potong Kartu Stok via RPC
        const payloadData = { qrs: qrList, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
        const { error: rpcError } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });
        if (rpcError) throw rpcError;

        // C. Simpan ke Laporan Konversi (Audit Log)
        const { count, error: errCount } = await db.from('laporan_konversi').select('*', { count: 'exact', head: true });
        if(errCount) throw errCount;

        let nextNum = (count || 0) + 1;
        let kodeKonversi = `${prefix}-${String(nextNum).padStart(5, '0')}`;

        // Hanya masukkan QR yang lolos dipotong ke laporan audit
        let allQRs = qrList.join(', ');

        const payloadLog = {
            kode_konversi: kodeKonversi,
            aktifitas: aktifitas,
            qrcode: qrList.join(', '), 
            detail: JSON.stringify({
                keterangan: keterangan || '-',
                po_target: poTarget,
                items: matchedRows // Menyimpan seluruh spesifikasi fisik kardus
            }),
            qty_total: qrList.length,
            pic: currentUser.username
        };

        const { error: errInsert } = await db.from('laporan_konversi').insert([payloadLog]);
        if (errInsert) throw errInsert;

        // 5. SELESAI
        let msg = `✅ EKSEKUSI KONVERSI OUT BERHASIL!\n\nID Audit: ${kodeKonversi}\nPO Target: ${poTarget}\nBerhasil dipotong dari Kartu Stok: ${qrList.length} Dus.`;
        if (unmatchedCount > 0) msg += `\n\n⚠️ ${unmatchedCount} dus tidak diproses karena jatah PO kurang atau status fisik belum VALID.`;
        alert(msg);
        
        tutupModalPO();
        dataPic = [];
        resetFilter();
        document.getElementById('input-keterangan').value = '';
        document.getElementById('select-aktifitas').value = '';

    } catch(e) {
        alert("Terjadi kesalahan saat memotong stok & menyimpan konversi: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false;
    }
}
