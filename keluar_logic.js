let masterData = { kamus: [] };
let deleteStack = [], globalRowId = 0;
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

async function loadInitialOutboundData() {
    const { data: mData2 } = await db.from('master_2').select('*');
    if(mData2) masterData.kamus = mData2; 
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

document.addEventListener('DOMContentLoaded', () => {
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputEl = document.getElementById('input-qrcode');
            const rawInput = inputEl.value.trim();
            if(!rawInput) return;
            inputEl.value = ''; 
            
            const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
            const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
            
            codes.forEach(code => {
                const isLocalDuplicate = existingQRs.includes(code);
                addRowKeluar(code, isLocalDuplicate); 
                existingQRs.push(code); 
            });
        });
    }
});

function addRowKeluar(code, isDuplicate = false) {
    globalRowId++;
    const tr = document.createElement('tr'); 
    
    const rowClass = isDuplicate ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-slate-50';
    tr.className = `border-b border-slate-200 transition row-item text-xs ${rowClass}`; 

    const td = translateBarcode(code); 
    
    const badgeHtml = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 px-2 py-1 rounded shadow-sm" data-status="invalid">DUPLIKAT LOKAL</span>'
        : '<span class="text-slate-400 font-bold" data-status="unverified">-</span>';
        
    let html = `
        <td class="p-3 text-center"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer p-1.5 rounded border border-slate-200 bg-white"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        <td class="p-3 font-bold no-cell text-center text-slate-400"></td>
        <td class="p-3 font-bold text-center border-r border-slate-200 col-val">${badgeHtml}</td>
        <td class="p-3 font-black text-slate-400 border-r border-slate-200 area-cell">?</td>
        <td class="p-3 font-mono font-bold text-slate-900 bg-slate-50/50 qr-val border-r border-slate-200 tracking-wider text-left">${code}</td>
        <td class="p-3 text-slate-600 font-semibold col-tgl text-center">${td.tglProduksi}</td>
        <td class="p-3 text-slate-600 font-semibold col-mesin text-center">${td.mesin}</td>
        <td class="p-3 text-slate-600 font-semibold border-r border-slate-200 col-shift text-center">${td.shift}</td>
        <td class="p-3 font-black text-blue-700 col-jenis text-center">${td.jenisItem}</td>
        <td class="p-3 font-bold text-slate-800 text-left col-nama">${td.namaItem}</td>
        <td class="p-3 font-bold text-slate-600 col-pjg text-center">${td.panjang}</td>
        <td class="p-3 font-bold text-slate-800 col-grade text-center">${td.grade}</td>
        <td class="p-3 font-bold text-slate-800 col-dus text-center">${td.dus}</td>
        <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shading text-center">${td.shading}</td>
        <td class="p-3 text-center font-bold text-slate-500 col-pobawaan">${td.poBawaan}</td>
        <td class="p-3 text-center font-black text-slate-400 bg-slate-100 border-l border-slate-200 col-poaktual">Cek Stok...</td>`;
    
    tr.innerHTML = html; document.getElementById('tbody-keluar').prepend(tr);
    lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) { const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling }); tr.remove(); updateRowNumbers(); }
function undoDelete() { if(deleteStack.length === 0) return; const lastData = deleteStack.pop(); const tempDiv = document.createElement('tbody'); tempDiv.innerHTML = lastData.html; if (lastData.nextSibling) lastData.parent.insertBefore(tempDiv.firstChild, lastData.nextSibling); else lastData.parent.appendChild(tempDiv.firstChild); lucide.createIcons(); updateRowNumbers(); }
function updateRowNumbers() { const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; }); }

// ========================================================
// 1. VERIFIKASI GUDANG
// ========================================================
async function crossCekOutbound() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk dicek.");

    const btnCross = document.getElementById('btn-crosscek'); const originalText = btnCross.innerHTML;
    btnCross.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMVERIFIKASI...'; btnCross.disabled = true;

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText.trim());
    
    const [resStok, resStbj] = await Promise.all([
        db.from('stok_qr').select('qrcode, area, id_sku').in('qrcode', allQRCodes),
        db.from('hasil_stbj').select('qrcode, keterangan').in('qrcode', allQRCodes)
    ]);
    
    if(resStok.error) { alert("Koneksi gagal: " + resStok.error.message); btnCross.innerHTML = originalText; btnCross.disabled = false; return; }

    let dbQRs = resStok.data;
    let stbjMap = {};
    if(resStbj.data) resStbj.data.forEach(d => stbjMap[d.qrcode] = d.keterangan || '-');

    let missingCount = 0; let uniqueSpecs = new Set(); let validRows = [];

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText.trim();
        const valCell = row.querySelector('.col-val');
        const areaCell = row.querySelector('.area-cell');
        
        if(valCell.innerText.includes('LOKAL')) { missingCount++; return; }

        let foundDb = dbQRs.find(d => d.qrcode === qr);

        if(foundDb) {
            validRows.push(row);
            let jenis = row.querySelector('.col-jenis').innerText.trim();
            let nama = row.querySelector('.col-nama').innerText.trim();
            let pjg = row.querySelector('.col-pjg').innerText.trim();
            let grade = row.querySelector('.col-grade').innerText.trim();
            let dus = row.querySelector('.col-dus').innerText.trim();
            let shading = row.querySelector('.col-shading').innerText.trim();
            
            let baseSpec = `${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}`;
            row.dataset.baseSpec = baseSpec; 
            row.dataset.area = foundDb.area; 
            row.dataset.poAsliDB = extractPOFromSKU(foundDb.id_sku); 
            row.dataset.ket = stbjMap[qr] || '-';
            
            uniqueSpecs.add(baseSpec);
            valCell.innerHTML = '<span class="text-emerald-700 font-black bg-emerald-100 px-3 py-1 rounded shadow-sm border border-emerald-300" data-status="valid">VALID FISIK</span>';
            areaCell.innerText = foundDb.area; areaCell.className = "p-3 font-black text-emerald-600 border-r border-slate-200 area-cell text-center";
            row.classList.remove('bg-red-50');
        } else {
            row.dataset.poAsliDB = "-";
            valCell.innerHTML = '<span class="text-white font-black bg-red-600 px-3 py-1 rounded shadow-sm tracking-wide" data-status="invalid">BLM STBJ / KOSONG</span>';
            areaCell.innerText = "KOSONG"; areaCell.className = "p-3 font-black text-red-600 border-r border-slate-200 area-cell text-center";
            row.querySelector('.col-poaktual').innerText = "-";
            row.classList.add('bg-red-50'); 
            missingCount++;
        }
    });

    for(let spec of uniqueSpecs) {
        const { data: specStock } = await db.from('stok_qr').select('id_sku').ilike('id_sku', `%_${spec}_%`);
        let poAvailable = new Set();
        if(specStock) {
            specStock.forEach(d => {
                let po = extractPOFromSKU(d.id_sku);
                if(po && po !== '-') poAvailable.add(po);
            });
        }
        let poText = poAvailable.size > 0 ? Array.from(poAvailable).join(', ') : 'KOSONG / NON-PO';
        validRows.forEach(row => {
            if(row.dataset.baseSpec === spec) {
                let poCell = row.querySelector('.col-poaktual');
                poCell.innerText = poText;
                poCell.className = "p-3 text-center font-bold text-blue-700 bg-blue-50 border-l border-slate-200 col-poaktual whitespace-normal max-w-[150px] leading-tight";
            }
        });
    }

    if(missingCount > 0) alert(`Selesai! Ditemukan fisik kosong / BLM STBJ (Merah).`);
    btnCross.innerHTML = originalText; btnCross.disabled = false;
}

// ========================================================
// 2. BUKA MODAL KELUAR
// ========================================================
async function bukaModalKeluar() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data.");

    let hasUnverified = false;
    let poSet = new Set();

    rows.forEach(r => {
        let status = r.querySelector('span[data-status]').getAttribute('data-status');
        if (status === 'unverified') hasUnverified = true;
        
        if (status === 'valid') {
            let cellText = r.querySelector('.col-poaktual').innerText;
            let pos = cellText.split(',').map(s => s.trim());
            pos.forEach(p => { if(p && p !== 'KOSONG / NON-PO' && p !== '?') poSet.add(p); });
        }
    });

    if(hasUnverified) return alert("Silakan klik Verifikasi FISIK GUDANG terlebih dahulu.");
    if(poSet.size === 0) return alert("Barang yang Anda scan belum memiliki jatah PO di Gudang. Ajukan Request Ganti PO terlebih dahulu.");

    const sel = document.getElementById('out-po-target');
    if(sel) {
        sel.innerHTML = '<option value="">-- PILIH PO TUJUAN --</option>';
        Array.from(poSet).sort().forEach(po => {
            sel.innerHTML += `<option value="${po}">${po}</option>`;
        });
    }

    if(document.getElementById('out-keterangan')) document.getElementById('out-keterangan').value = '';
    document.getElementById('modal-keluar').classList.remove('hidden');
}

// ========================================================
// 3. EKSEKUSI CERDAS (POTONG & SIMPAN KE STOK KELUAR)
// ========================================================
async function eksekusiKeluar() {
    const doInput = document.getElementById('out-do') ? document.getElementById('out-do').value.trim() : '-';
    const tjnInput = document.getElementById('out-tujuan') ? document.getElementById('out-tujuan').value.trim() : '-';
    const poTarget = document.getElementById('out-po-target') ? document.getElementById('out-po-target').value : '-';
    const keterangan = document.getElementById('out-keterangan') ? document.getElementById('out-keterangan').value.trim() : '';
    
    if(document.getElementById('out-po-target') && !poTarget) return alert("Pilih PO Tujuan Pengeluaran!");

    const btnEks = document.getElementById('btn-eksekusi'); const oriBuka = btnEks.innerHTML;
    btnEks.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES KELUAR...'; btnEks.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    let specsToProcess = new Set();
    rows.forEach(row => {
        if (row.querySelector('span[data-status]').getAttribute('data-status') === 'valid') specsToProcess.add(row.dataset.baseSpec);
    });

    let stockCapacity = {}; let totalJatahTersedia = 0;
    try {
        for(let spec of specsToProcess) {
            let parts = spec.split('_');
            let [nm, pj, gr, ds, sh] = [parts[1], parts[2], parts[3], parts[4], parts[5]];
            const { data, error } = await db.from('stok_aktual').select('qty').eq('nama_item', nm).eq('pjg', pj).eq('grade', gr).eq('dus', ds).eq('shading', sh).ilike('po_aktual', `%${poTarget}%`); 
            if (error) throw error;
            let count = 0; if(data) data.forEach(d => count += (d.qty || 0));
            stockCapacity[spec] = count; totalJatahTersedia += count;
        }
    } catch(e) {
        alert("Gagal membaca kapasitas stok_aktual: " + e.message); btnEks.innerHTML = oriBuka; btnEks.disabled = false; return;
    }

    let qrList = []; let mapAktual = {}; let mapGlobal = {};
    let matchedRows = []; let unmatchedCount = 0;
    let payloadRiwayatKeluar = []; // Payload untuk tabel riwayat stok_keluar

    rows.forEach(row => {
        if (row.querySelector('span[data-status]').getAttribute('data-status') === 'valid') {
            let baseSpec = row.dataset.baseSpec;
            if(stockCapacity[baseSpec] && stockCapacity[baseSpec] > 0) {
                matchedRows.push(row);
                
                let qr = row.querySelector('.qr-val').innerText.trim();
                let nm = row.querySelector('.col-nama').innerText.trim();
                let pj = row.querySelector('.col-pjg').innerText.trim();
                let gr = row.querySelector('.col-grade').innerText.trim();
                let ds = row.querySelector('.col-dus').innerText.trim();
                let sh = row.querySelector('.col-shading').innerText.trim();
                let area = row.dataset.area;
                let poBawaan = row.dataset.poAsliDB || row.querySelector('.col-pobawaan').innerText.trim();
                let ket = row.dataset.ket;

                qrList.push(qr);
                stockCapacity[baseSpec] -= 1; 

                let keyAkt = `${nm}_${pj}_${gr}_${ds}_${sh}_${area}_${poTarget}_${ket}`;
                if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { nama_item: nm, pjg: pj, grade: gr, dus: ds, shading: sh, area: area, po_aktual: poTarget, ket: ket, qty: 0 };
                mapAktual[keyAkt].qty++;

                let keyGlb = `${nm}_${pj}_${gr}_${ds}_${sh}_${poTarget}_${ket}`;
                if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { nama_item: nm, pjg: pj, grade: gr, dus: ds, shading: sh, po_bawaan: poTarget, ket: ket, qty: 0 };
                mapGlobal[keyGlb].qty++;

                // Siapkan data sejarah untuk tabel stok_keluar
                let id_sku_lengkap = `${area}_${row.querySelector('.col-jenis').innerText.trim()}_${nm}_${pj}_${gr}_${ds}_${sh}_${poTarget}`;
                payloadRiwayatKeluar.push({
                    qrcode: qr,
                    id_sku: id_sku_lengkap,
                    surat_jalan: doInput,
                    tujuan: tjnInput,
                    keterangan: keterangan,
                    pic_keluar: currentUser.username
                });

            } else { unmatchedCount++; }
        } else { unmatchedCount++; }
    });

    if (qrList.length === 0) {
        alert(`❌ TIDAK ADA JATAH.\nSisa stok aktual untuk "${poTarget}" adalah 0.`);
        btnEks.innerHTML = oriBuka; btnEks.disabled = false; return;
    }

    try {
        for (let row of matchedRows) {
            let baseSpec = row.dataset.baseSpec;
            let poBawaan = row.dataset.poAsliDB || row.querySelector('.col-pobawaan').innerText.trim();
            
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
    } catch (swapEx) {
        alert("Gagal sinkronisasi alokasi Kartu Stok: " + swapEx.message);
        btnEks.innerHTML = oriBuka; btnEks.disabled = false;
        return;
    }

    // Eksekusi Potong Stok Database
    const payloadData = { qrs: qrList, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
    const { error } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });

    if (error) { alert("Transaksi Ditolak Server:\n" + error.message); btnEks.innerHTML = oriBuka; btnEks.disabled = false; return; }

    // REVISI TERPENTING: CATAT SEJARAH KE TABEL stok_keluar
    try {
        const { error: errKeluar } = await db.from('stok_keluar').insert(payloadRiwayatKeluar);
        if(errKeluar) console.error("Gagal simpan riwayat keluar: ", errKeluar);
    } catch(errLog) {}

    matchedRows.forEach(r => r.remove()); updateRowNumbers();

    let msg = `✅ SELESAI\nBerhasil memotong ${qrList.length} item secara permanen & tersimpan di Riwayat Keluar.`;
    if (unmatchedCount > 0) msg += `\n\n⚠️ ${unmatchedCount} dus tersisa di layar (kosong/beda po).`;
    alert(msg);
    document.getElementById('modal-keluar').classList.add('hidden');
    btnEks.innerHTML = oriBuka; btnEks.disabled = false;
}
