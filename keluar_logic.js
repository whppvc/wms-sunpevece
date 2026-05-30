let masterData = { kamus: [] };
let deleteStack = [], globalRowId = 0;

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
            inputEl.value = ''; // Cegah double scan instan
            
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
    tr.className = `border-b border-slate-200 transition row-item ${rowClass}`; 

    const td = translateBarcode(code); 
    
    const badgeHtml = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 px-2 py-1 rounded text-[10px] shadow-sm" data-status="invalid">DUPLIKAT LOKAL</span>'
        : '<span class="text-slate-400 font-bold" data-status="unverified">-</span>';
        
    let html = `
        <td class="p-3 text-center"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer p-1.5 rounded border border-slate-200 bg-white"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        <td class="p-3 font-bold no-cell text-center text-slate-400"></td>
        <td class="p-3 font-bold text-center border-r border-slate-200 col-val">${badgeHtml}</td>
        <td class="p-3 font-black text-slate-400 border-r border-slate-200 area-cell">?</td>
        <td class="p-3 font-mono font-bold text-slate-900 bg-slate-50/50 qr-val border-r border-slate-200 tracking-wider">${code}</td>
        <td class="p-3 text-slate-600 font-semibold col-tgl">${td.tglProduksi}</td>
        <td class="p-3 text-slate-600 font-semibold col-mesin">${td.mesin}</td>
        <td class="p-3 text-slate-600 font-semibold border-r border-slate-200 col-shift">${td.shift}</td>
        <td class="p-3 font-black text-blue-700 col-jenis">${td.jenisItem}</td>
        <td class="p-3 font-bold text-slate-800 text-left col-nama">${td.namaItem}</td>
        <td class="p-3 font-bold text-slate-600 col-pjg">${td.panjang}</td>
        <td class="p-3 font-bold text-slate-800 col-grade">${td.grade}</td>
        <td class="p-3 font-bold text-slate-800 col-dus">${td.dus}</td>
        <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shading">${td.shading}</td>
        <td class="p-3 text-center font-bold text-slate-500 col-pobawaan">${td.poBawaan}</td>
        <td class="p-3 text-center font-black text-slate-400 bg-slate-100 border-l border-slate-200 col-poaktual">Cek Stok...</td>`;
    
    tr.innerHTML = html; document.getElementById('tbody-keluar').prepend(tr);
    lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) { const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling }); tr.remove(); updateRowNumbers(); }
function undoDelete() { if(deleteStack.length === 0) return; const lastData = deleteStack.pop(); const tempDiv = document.createElement('tbody'); tempDiv.innerHTML = lastData.html; if (lastData.nextSibling) lastData.parent.insertBefore(tempDiv.firstChild, lastData.nextSibling); else lastData.parent.appendChild(tempDiv.firstChild); lucide.createIcons(); updateRowNumbers(); }
function updateRowNumbers() { const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; }); }

// PERUBAHAN UTAMA: Konsep PO Gabungan
async function crossCekOutbound() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk dicek.");

    const btnCross = document.getElementById('btn-crosscek'); const originalText = btnCross.innerHTML;
    btnCross.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMVERIFIKASI...'; btnCross.disabled = true;

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    // 1. Cek apakah QR fisik ada di gudang
    const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area').in('qrcode', allQRCodes);
    if(error) { alert("Koneksi gagal: " + error.message); btnCross.innerHTML = originalText; btnCross.disabled = false; return; }

    let missingCount = 0;
    let uniqueSpecs = new Set();
    let validRows = [];

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        const valCell = row.querySelector('.col-val');
        const areaCell = row.querySelector('.area-cell');
        
        if(valCell.innerText.includes('LOKAL')) { missingCount++; return; }

        let foundDb = dbQRs.find(d => d.qrcode === qr);

        if(foundDb) {
            validRows.push(row);
            
            // Susun base spec item (Tanpa PO)
            let jenis = row.querySelector('.col-jenis').innerText; let nama = row.querySelector('.col-nama').innerText;
            let pjg = row.querySelector('.col-pjg').innerText; let grade = row.querySelector('.col-grade').innerText;
            let dus = row.querySelector('.col-dus').innerText; let shading = row.querySelector('.col-shading').innerText;
            
            let baseSpec = `${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}`;
            row.dataset.baseSpec = baseSpec; // Simpan ke dalam element
            row.dataset.area = foundDb.area; // Simpan area aslinya
            uniqueSpecs.add(baseSpec);

            valCell.innerHTML = '<span class="text-emerald-700 font-black bg-emerald-100 px-3 py-1 rounded shadow-sm text-[10px] border border-emerald-300" data-status="valid">VALID FISIK</span>';
            areaCell.innerText = foundDb.area; areaCell.className = "p-3 font-black text-emerald-600 border-r border-slate-200 area-cell";
            row.classList.remove('bg-red-50');
        } else {
            valCell.innerHTML = '<span class="text-white font-black bg-red-600 px-3 py-1 rounded shadow-sm text-[10px] tracking-wide" data-status="invalid">BLM STBJ / KOSONG</span>';
            areaCell.innerText = "KOSONG"; areaCell.className = "p-3 font-black text-red-600 border-r border-slate-200 area-cell";
            row.querySelector('.col-poaktual').innerText = "-";
            row.classList.add('bg-red-50'); 
            missingCount++;
        }
    });

    // 2. Cek Kartu Stok: Ada PO apa saja untuk spesifikasi barang ini?
    for(let spec of uniqueSpecs) {
        // Cari id_sku di gudang yang memuat gabungan spesifikasi ini
        const { data: specStock } = await db.from('stok_qr').select('id_sku').like('id_sku', `%_${spec}_%`);
        let poAvailable = new Set();
        
        if(specStock) {
            specStock.forEach(d => {
                let po = extractPOFromSKU(d.id_sku);
                if(po && po !== '-') poAvailable.add(po);
            });
        }
        
        // Tampilkan semua PO yang tersedia di sel tabel
        let poText = poAvailable.size > 0 ? Array.from(poAvailable).join(', ') : 'KOSONG/NON-PO';
        
        validRows.forEach(row => {
            if(row.dataset.baseSpec === spec) {
                let poCell = row.querySelector('.col-poaktual');
                poCell.innerText = poText;
                poCell.className = "p-3 text-center font-bold text-blue-700 bg-blue-50 border-l border-slate-200 col-poaktual text-[10px] whitespace-normal max-w-[150px] leading-tight";
            }
        });
    }

    if(missingCount > 0) alert(`Selesai! Ditemukan fisik kosong / BLM STBJ (Merah). Baris bermasalah ini tidak akan bisa keluar, tapi Anda dapat memindahkannya via tombol "REQUEST GANTI PO".`);
    btnCross.innerHTML = originalText; btnCross.disabled = false;
}

// PERUBAHAN UTAMA: Mengumpulkan PO dari tabel (Gabungan)
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
            // Pecah string "PO-A, PO-B" menjadi array untuk dimasukkan ke Set dropdown
            let pos = cellText.split(',').map(s => s.trim());
            pos.forEach(p => { if(p && p !== 'KOSONG/NON-PO' && p !== '?') poSet.add(p); });
        }
    });

    if(hasUnverified) return alert("Silakan klik Verifikasi FISIK GUDANG terlebih dahulu.");
    if(poSet.size === 0) return alert("Barang yang Anda scan belum memiliki PO di Gudang. Ajukan Request Ganti PO terlebih dahulu.");

    const sel = document.getElementById('out-po-target');
    sel.innerHTML = '<option value="">-- PILIH PO TUJUAN --</option>';
    Array.from(poSet).sort().forEach(po => {
        sel.innerHTML += `<option value="${po}">${po}</option>`;
    });

    document.getElementById('out-keterangan').value = '';
    document.getElementById('modal-keluar').classList.remove('hidden');
}

// PERUBAHAN UTAMA: Memotong stok berdasarkan pilihan target PO
// ========================================================
// REVISI EKSEKUSI KELUAR: Ambil kardus bebas selama kuota PO masih ada!
// ========================================================
async function eksekusiKeluar() {
    const poTarget = document.getElementById('out-po-target').value;
    const keterangan = document.getElementById('out-keterangan').value.trim();
    if(!poTarget) return alert("Pilih PO Tujuan Pengeluaran!");

    const btnEks = document.getElementById('btn-eksekusi');
    const oriBuka = btnEks.innerHTML;
    btnEks.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENGHITUNG STOK DB...'; 
    btnEks.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    // 1. Kumpulkan spesifikasi fisik barang yang ada di layar
    let specsToProcess = new Set();
    rows.forEach(row => {
        let status = row.querySelector('span[data-status]').getAttribute('data-status');
        if (status === 'valid') specsToProcess.add(row.dataset.baseSpec);
    });

    // 2. Hitung KUOTA AKTUAL di DB khusus untuk PO yang diplih
    let stockCapacity = {}; 
    try {
        for(let spec of specsToProcess) {
            const { data, error } = await db.from('stok_qr').select('id_sku, area').like('id_sku', `%_${spec}_%`);
            if(data) {
                data.forEach(d => {
                    let po = extractPOFromSKU(d.id_sku);
                    // HANYA hitung stok jika PO-nya cocok dengan PO Tujuan
                    if(po === poTarget) {
                        let virtual_sku = `${d.area}_${spec}_${poTarget}`;
                        if(!stockCapacity[virtual_sku]) stockCapacity[virtual_sku] = 0;
                        stockCapacity[virtual_sku]++;
                    }
                });
            }
        }
    } catch(e) {
        alert("Gagal memverifikasi kapasitas stok ke server: " + e.message);
        btnEks.innerHTML = oriBuka; btnEks.disabled = false; return;
    }

    let qrList = []; 
    let requiredMap = {};
    let matchedRows = []; 
    let unmatchedCount = 0;

    // 3. SAPU BERSIH DARI ATAS: Ambil kardus acak selama kuota masih ada!
    rows.forEach(row => {
        let status = row.querySelector('span[data-status]').getAttribute('data-status');

        if (status === 'valid') {
            let area = row.dataset.area;
            let baseSpec = row.dataset.baseSpec;
            let virtual_sku = `${area}_${baseSpec}_${poTarget}`;
            
            // KITA GAK PEDULI PO ASLINYA APA. 
            // Selama spek fisiknya cocok & kuota PO Target di DB masih sisa, AMBIL!
            if(stockCapacity[virtual_sku] && stockCapacity[virtual_sku] > 0) {
                matchedRows.push(row);
                qrList.push(row.querySelector('.qr-val').innerText);
                
                if(!requiredMap[virtual_sku]) requiredMap[virtual_sku] = 0;
                requiredMap[virtual_sku] += 1;
                
                // Kurangi jatah di memori agar baris selanjutnya tidak dapat jatah kalau sudah habis
                stockCapacity[virtual_sku] -= 1; 
            } else {
                // Kuota habis! Tinggalkan kardus ini di layar.
                unmatchedCount++; 
            }
        } else {
            unmatchedCount++;
        }
    });

    // 4. Validasi jika kuota DB ternyata kosong
    if (qrList.length === 0) {
        alert(`STOK HABIS.\n\nJatah stok aktual untuk "${poTarget}" sudah kosong di Database.\n\nSilakan klik "Req Ganti PO" agar CS mengalihkan sisa kardus di layar Anda menjadi PO ini.`);
        btnEks.innerHTML = oriBuka; btnEks.disabled = false;
        return;
    }

    let deductionsArray = [];
    for(let sku in requiredMap) { deductionsArray.push({ sku: sku, qty: requiredMap[sku] }); }
    const payloadData = { qrs: qrList, deductions: deductionsArray, po: poTarget, ket: keterangan, pic: user.username };
    
    // 5. Tembak ke Database
    btnEks.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES KELUAR...';
    const { error } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });

    if (error) {
        alert("Transaksi Ditolak Server:\n" + error.message);
        btnEks.innerHTML = oriBuka; btnEks.disabled = false;
        return;
    }

    // 6. Bersihkan layar HANYA sebanyak kardus yang dapat jatah
    matchedRows.forEach(r => r.remove());
    updateRowNumbers();

    let msg = `✅ BERHASIL KELUAR: ${qrList.length} Kardus berhasil diproses.\n`;
    if (unmatchedCount > 0) {
        msg += `\n⚠️ SISA DI LAYAR: ${unmatchedCount} kardus ditinggalkan karena kuota stok ${poTarget} sudah habis.\n\nSilakan klik "Req Ganti PO" untuk sisa kardus tersebut.`;
    }
    
    alert(msg);
    document.getElementById('modal-keluar').classList.add('hidden');
    btnEks.innerHTML = oriBuka; btnEks.disabled = false;
}

function bukaModalReqPO() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Tidak ada data tabel.");
    
    let hasVerified = false;
    rows.forEach(r => {
        let status = r.querySelector('span[data-status]').getAttribute('data-status');
        // Asalkan statusnya bukan 'unverified', berarti user sudah klik Verifikasi Gudang
        if(status !== 'unverified') hasVerified = true; 
    });

    if(!hasVerified) return alert("Semua baris tampak belum diverifikasi. Verifikasi dulu sebelum request.");
    
    const sel = document.getElementById('req-po-target');
    sel.innerHTML = '<option value="">-- PILIH PO TUJUAN --</option>';
    
    let poAcuan = new Set();
    masterData.kamus.forEach(m => {
        if(m.po) poAcuan.add(m.po);
    });
    Array.from(poAcuan).sort().forEach(po => {
        sel.innerHTML += `<option value="${po}">${po}</option>`;
    });

    document.getElementById('req-keterangan').value = '';
    document.getElementById('modal-req-po').classList.remove('hidden');
}

async function submitReqPO() {
    const poRequest = document.getElementById('req-po-target').value;
    const ketReq = document.getElementById('req-keterangan').value.trim();
    if(!poRequest) return alert("Pilih PO Tujuan untuk pengajuan!");

    const btn = document.getElementById('btn-submit-req'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENGAJUKAN...'; btn.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    let payloadUpload = [];

    rows.forEach(tr => {
        let status = tr.querySelector('span[data-status]').getAttribute('data-status');
        if(status !== 'unverified') {
            const qr = tr.querySelector('.qr-val').innerText;
            let poAsli = tr.querySelector('.col-pobawaan').innerText; // Info untuk CS
            
            payloadUpload.push({
                qrcode: qr,
                po_awal: poAsli,
                po_request: poRequest,
                keterangan: ketReq,
                status: 'PENDING',
                pic_request: user.username
            });
        }
    });

    if(payloadUpload.length === 0) {
        alert("Tidak ada baris yang bisa diajukan.");
        btn.innerHTML = ori; btn.disabled = false; return;
    }

    try {
        const { error } = await db.from('request_ganti_po').insert(payloadUpload);
        if(error) {
            if(error.code === '42P01') alert("Tabel 'request_ganti_po' belum dibuat di Database Supabase Anda! (Akan saya bantu buatkan tabelnya jika belum ada).");
            else throw error;
            return;
        }
        
        rows.forEach(tr => {
            if(tr.querySelector('span[data-status]').getAttribute('data-status') !== 'unverified') tr.remove();
        });
        updateRowNumbers();

        alert(`BERHASIL!\n${payloadUpload.length} QRCode bermasalah diajukan ke CS untuk ganti PO.`);
        document.getElementById('modal-req-po').classList.add('hidden');
        if(typeof cekNotifikasiInbox === 'function') cekNotifikasiInbox();
    } catch(e) { alert("Gagal mengajukan: " + e.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; }
}
