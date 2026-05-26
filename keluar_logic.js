let masterData = { kamus: [] };
let deleteStack = [], globalRowId = 0;

async function loadInitialOutboundData() {
    const { data: mData2 } = await db.from('master_2').select('*');
    if(mData2) masterData.kamus = mData2; 

    const { data: poData } = await db.from('master_2').select('po');
    if (poData) {
        const listPO = [...new Set(poData.map(d => d.po).filter(x => x && x.trim() !== ''))].sort();
        const sel = document.getElementById('out-po-target');
        sel.innerHTML = '<option value="">-- PILIH PO TARGET --</option>';
        listPO.forEach(p => { sel.innerHTML += `<option value="${p}">${p}</option>` });
    }
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

// =====================================
// PEMISAH SCAN KELUAR
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawInput = document.getElementById('input-qrcode').value.trim();
            if(!rawInput) return;
            
            const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
            const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
            
            codes.forEach(code => {
                // REVISI: Cek apakah duplikat, dan panggil fungsi dengan isDuplicate
                const isLocalDuplicate = existingQRs.includes(code);
                addRowKeluar(code, isLocalDuplicate); 
                existingQRs.push(code); // Tambah agar duplikat berturut-turut terdeteksi
            });
            document.getElementById('input-qrcode').value = '';
        });
    }
});

// REVISI: Terima isDuplicate dan aplikasikan kelas warna merah
function addRowKeluar(code, isDuplicate = false) {
    globalRowId++;
    const tr = document.createElement('tr'); 
    
    let rowClass = isDuplicate ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-slate-100';
    tr.className = `border-b border-inherit transition row-item ${rowClass}`; 
    
    const td = translateBarcode(code); 
    
    let statusBadge = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 px-3 py-1 rounded-full text-xs shadow-sm" data-status="invalid">DUPLIKAT LOKAL</span>' 
        : '<span class="text-gray-400 font-bold" data-status="unverified">-</span>';
        
    let html = `
        <td class="p-3 text-center"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer"><i data-lucide="trash-2"></i></button></td>
        <td class="p-3 font-bold no-cell text-center"></td>
        <td class="p-3 font-bold text-center col-val">${statusBadge}</td>
        <td class="p-3 font-black text-emerald-600 area-cell">?</td>
        <td class="p-3 font-mono font-bold text-black qr-val border-r border-inherit">${code}</td>
        <td class="p-3 col-tgl">${td.tglProduksi}</td>
        <td class="p-3 col-mesin">${td.mesin}</td>
        <td class="p-3 col-shift">${td.shift}</td>
        <td class="p-3 font-bold text-blue-700 col-jenis">${td.jenisItem}</td>
        <td class="p-3 font-bold col-nama">${td.namaItem}</td>
        <td class="p-3 font-bold col-pjg">${td.panjang}</td>
        <td class="p-3 font-bold col-grade">${td.grade}</td>
        <td class="p-3 col-dus">${td.dus}</td>
        <td class="p-3 font-bold col-shading border-r border-inherit">${td.shading}</td>
        <td class="p-3 text-center text-gray-500 bg-gray-100 font-medium text-xs col-pobawaan">${td.poBawaan}</td>`;
    
    tr.innerHTML = html; document.getElementById('tbody-keluar').prepend(tr);
    lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) { const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling }); tr.remove(); updateRowNumbers(); }
function undoDelete() { if(deleteStack.length === 0) return; const lastData = deleteStack.pop(); const tempDiv = document.createElement('tbody'); tempDiv.innerHTML = lastData.html; if (lastData.nextSibling) lastData.parent.insertBefore(tempDiv.firstChild, lastData.nextSibling); else lastData.parent.appendChild(tempDiv.firstChild); lucide.createIcons(); updateRowNumbers(); }
function updateRowNumbers() { const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; }); }

// =====================================
// VALIDASI (TARIK LOKASI FISIK)
// =====================================
async function crossCekOutbound() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk dicek.");

    const btnCross = document.getElementById('btn-crosscek');
    const originalText = btnCross.innerHTML;
    btnCross.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMVALIDASI GUDANG...'; btnCross.disabled = true;

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    const { data: dbQRs, error } = await db.from('stok_qr').select('qrcode, area').in('qrcode', allQRCodes);
    if(error) { alert("Koneksi gagal: " + error.message); btnCross.innerHTML = originalText; btnCross.disabled = false; return; }

    let missingCount = 0;
    let processedQRs = []; // REVISI: Track duplikat layar

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        const valCell = row.querySelector('.col-val');
        const areaCell = row.querySelector('.area-cell');
        
        let foundDb = dbQRs.find(d => d.qrcode === qr);

        if(foundDb) {
            // REVISI: Jika barang ada di DB, pastikan ia belum dicentang di baris sebelumnya
            if (processedQRs.includes(qr)) {
                valCell.innerHTML = '<span class="text-white font-black bg-red-600 px-3 py-1 rounded-full shadow-sm text-xs" data-status="invalid">DUPLIKAT SCAN</span>';
                areaCell.innerText = "DUPLIKAT";
                row.classList.add('bg-red-100'); 
                missingCount++;
            } else {
                processedQRs.push(qr);
                valCell.innerHTML = '<span class="text-emerald-600 font-black bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 shadow-sm text-xs" data-status="valid">VALID FISIK</span>';
                areaCell.innerText = foundDb.area; 
                row.classList.remove('bg-red-50', 'bg-red-100', 'hover:bg-red-200');
            }
        } else {
            valCell.innerHTML = '<span class="text-white font-black bg-red-600 px-3 py-1 rounded-full shadow-sm text-xs" data-status="invalid">TDK ADA DI DB</span>';
            areaCell.innerText = "KOSONG";
            row.classList.add('bg-red-100'); 
            missingCount++;
        }
    });

    if(missingCount > 0) alert(`Ditemukan masalah (Warna Merah Muda).\nBisa jadi Barang TDK ADA, atau Anda scan BARANG YANG SAMA dua kali.\nHapus baris merah muda sebelum lanjut.`);
    
    btnCross.innerHTML = originalText; btnCross.disabled = false;
}

// =====================================
// BUKA MODAL POTONG PO (KARTU STOK)
// =====================================
function bukaModalKeluar() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data.");

    let unverified = document.querySelector('span[data-status="unverified"]');
    let invalid = document.querySelector('span[data-status="invalid"]');
    
    if(unverified || invalid) {
        return alert("STOP!\nAnda belum menekan VALIDASI GUDANG atau masih ada baris error (Merah). Pastikan semua QR Valid Fisik!");
    }

    document.getElementById('out-po-target').value = '';
    document.getElementById('out-keterangan').value = '';
    document.getElementById('modal-keluar').classList.remove('hidden');
}

async function eksekusiKeluar() {
    const poTarget = document.getElementById('out-po-target').value;
    const keterangan = document.getElementById('out-keterangan').value.trim();
    if(!poTarget) return alert("Pilih PO Target Pengeluaran!");

    const btnEks = document.getElementById('btn-eksekusi');
    btnEks.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES...'; btnEks.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    let qrList = [];
    let requiredMap = {};

    rows.forEach(row => {
        let area = row.querySelector('.area-cell').innerText;
        let qr = row.querySelector('.qr-val').innerText;
        let jenis = row.querySelector('.col-jenis').innerText; let nama = row.querySelector('.col-nama').innerText;
        let pjg = row.querySelector('.col-pjg').innerText; let grade = row.querySelector('.col-grade').innerText;
        let dus = row.querySelector('.col-dus').innerText; let shading = row.querySelector('.col-shading').innerText;
        
        qrList.push(qr);
        let virtual_sku = `${area}_${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}_${poTarget}`;
        
        if(!requiredMap[virtual_sku]) requiredMap[virtual_sku] = 0;
        requiredMap[virtual_sku] += 1;
    });

    let deductionsArray = [];
    for(let sku in requiredMap) {
        deductionsArray.push({ sku: sku, qty: requiredMap[sku] });
    }

    const payloadData = { qrs: qrList, deductions: deductionsArray, po: poTarget, ket: keterangan, pic: user.username };
    const { data, error } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });

    if (error) {
        alert(error.message || "Gagal memproses pengeluaran. Transaksi dibatalkan secara otomatis oleh sistem.");
        btnEks.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> KELUARKAN BARANG'; btnEks.disabled = false;
        return;
    }

    alert("PENGELUARAN BARANG BERHASIL!\nBarang fisik terhapus & Saldo Kartu Stok terpotong dengan aman.");
    
    document.getElementById('modal-keluar').classList.add('hidden');
    document.getElementById('tbody-keluar').innerHTML = ''; 
    btnEks.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> KELUARKAN BARANG'; btnEks.disabled = false;
}
