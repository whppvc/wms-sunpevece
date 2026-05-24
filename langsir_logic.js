const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let masterData = { kamus: [], troli: [], area: [] };
let deleteStack = [], globalRowId = 0;

window.onload = async () => {
    lucide.createIcons();
    document.body.setAttribute('data-bg', localStorage.getItem('app_bg') || 'light');
    await loadInitialData();
};

function switchView(view) {
    document.getElementById('view-menu').classList.add('hidden');
    document.getElementById('view-scan').classList.toggle('hidden', view !== 'scan');
    document.getElementById('view-ambil').classList.toggle('hidden', view !== 'ambil');
}

async function loadInitialData() {
    const { data: mData1 } = await db.from('master_1').select('nama_troli').order('id', { ascending: true });
    if(mData1) {
        masterData.troli = [...new Set(mData1.map(r => r.nama_troli).filter(x => x && x.trim() !== ''))]; 
        const selTroli = document.getElementById('select-troli');
        if(selTroli) {
            selTroli.innerHTML = '<option value="">-- Pilih Troli --</option>';
            masterData.troli.forEach(t => selTroli.innerHTML += `<option value="${t}">${t}</option>`);
        }
    }
    
    const { data: mDataArea } = await db.from('master_area').select('nama_area').order('id', { ascending: true });
    if(mDataArea) {
        masterData.area = [...new Set(mDataArea.map(r => r.nama_area).filter(x => x && x.trim() !== ''))]; 
        const selArea = document.getElementById('select-area');
        if(selArea) {
            masterData.area.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
        }
    }

    const { data: mData2 } = await db.from('master_2').select('*');
    if(mData2) masterData.kamus = mData2; 
}

function translateBarcode(barcode) {
    const parts = barcode.split('/');
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', po: '-' };
    if (parts.length < 4) return data;

    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon';
    else if (hurufDepan === 'L') data.jenisItem = 'List';
    else if (hurufDepan === 'W') data.jenisItem = 'WPC';
    else data.jenisItem = hurufDepan;

    let rawItem = parts[0];
    let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem);
    data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem;

    data.shading = parts[1];

    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1;
        let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 

        let rawGrade = p2.substring(digitPjg, digitPjg + 1);
        if (rawGrade === '1') data.grade = 'BAGUS';
        else if (rawGrade === '2') data.grade = 'A';
        else data.grade = rawGrade;

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
        // REGEX ANTI-BUG UNTUK MESIN, SHIFT, PO
        let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        
        if (match) {
            let rawMesin = match[1]; 
            let rawShift = match[2]; 
            let rawPO = match[3];    

            let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin);
            data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;

            let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift);
            data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
            
            let cariPO = masterData.kamus.find(m => m.kode_po === rawPO);
            data.po = cariPO && cariPO.po ? cariPO.po : rawPO;
        } else {
            data.mesin = "FORMAT SALAH"; data.shift = "FORMAT SALAH"; data.po = "FORMAT SALAH";
        }
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawInput = document.getElementById('input-qrcode').value.trim();
            const troli = document.getElementById('select-troli').value;
            const area = document.getElementById('select-area').value;
            
            if(!troli || !area || !rawInput) return alert("Pilih Troli, Area, dan isi QR Code terlebih dahulu!");
            
            const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
            const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
            
            codes.forEach(code => {
                if(!existingQRs.includes(code)) { addRow(troli, area, code); existingQRs.push(code); }
            });
            document.getElementById('input-qrcode').value = '';
        });
    }
});

function addRow(troli, area, code) {
    globalRowId++;
    const tr = document.createElement('tr'); 
    tr.className = "border-b border-inherit hover:bg-black/5 transition row-item"; 
    const td = translateBarcode(code); 
    
    let html = `
        <td class="p-3 text-center"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer"><i data-lucide="trash-2"></i></button></td>
        <td class="p-3 font-bold no-cell text-center"></td>
        <td class="p-3 font-bold text-center col-val"><span class="text-gray-400 font-bold">-</span></td>
        <td class="p-3 troli-cell font-bold text-blue-600">${troli}</td>
        <td class="p-3 area-cell font-bold text-emerald-600">${area}</td>
        <td class="p-3 font-mono font-bold text-black qr-val border-r border-inherit">${code}</td>
        <td class="p-3 col-tgl">${td.tglProduksi}</td>
        <td class="p-3 col-mesin">${td.mesin}</td>
        <td class="p-3 col-shift">${td.shift}</td>
        <td class="p-3 font-bold text-blue-700 col-jenis">${td.jenisItem}</td>
        <td class="p-3 font-bold col-nama">${td.namaItem}</td>
        <td class="p-3 font-bold col-pjg">${td.panjang}</td>
        <td class="p-3 font-bold col-grade">${td.grade}</td>
        <td class="p-3 col-dus">${td.dus}</td>
        <td class="p-3 col-shading">${td.shading}</td>
        <td class="p-3 font-bold col-po">${td.po}</td>
        <td class="p-2"><input type="text" class="input-dynamic w-full p-2 border rounded outline-none uppercase text-xs font-bold ket-input"></td>`;
    
    tr.innerHTML = html; document.getElementById('tbody-langsir').prepend(tr);
    lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) {
    const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling });
    tr.remove(); updateRowNumbers();
}

function undoDelete() {
    if(deleteStack.length === 0) return; const lastData = deleteStack.pop();
    const tempDiv = document.createElement('tbody'); tempDiv.innerHTML = lastData.html;
    if (lastData.nextSibling) lastData.parent.insertBefore(tempDiv.firstChild, lastData.nextSibling); else lastData.parent.appendChild(tempDiv.firstChild);
    lucide.createIcons(); updateRowNumbers();
}

function updateRowNumbers() {
    const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; });
}

// ==========================================
// 1. FUNGSI CROSSCEK KEAMANAN GUDANG
// ==========================================
async function crossCekSTBJ() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk di cek.");

    const btnSave = document.getElementById('btn-save');
    const btnCross = document.querySelector('button[onclick="crossCekSTBJ()"]');
    const originalCrossText = btnCross.innerHTML;
    
    btnCross.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENGECEK...';
    btnCross.disabled = true;

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    // Cek ke tabel fisik gudang (stok_qr)
    const { data: existingData, error } = await db.from('stok_qr').select('qrcode').in('qrcode', allQRCodes);
    
    if(error) {
        alert("Gagal koneksi ke server: " + error.message);
        btnCross.innerHTML = originalCrossText; btnCross.disabled = false; return;
    }

    const duplicateQRs = existingData.map(d => d.qrcode);
    let hasDuplicate = false;

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        const valCell = row.querySelector('.col-val');
        
        if(duplicateQRs.includes(qr)) {
            // JIKA SUDAH ADA DI GUDANG -> TOLAK
            valCell.innerHTML = '<span class="text-red-600 font-black bg-red-100 px-3 py-1 rounded-full border border-red-300 shadow-sm text-xs" data-status="invalid">DUPLIKAT</span>';
            row.classList.add('bg-red-50'); 
            hasDuplicate = true;
        } else {
            // JIKA BELUM ADA -> AMAN MASUK
            valCell.innerHTML = '<span class="text-emerald-600 font-black bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 shadow-sm text-xs" data-status="valid">AMAN</span>';
            row.classList.remove('bg-red-50');
        }
    });

    if(hasDuplicate) {
        alert("PERINGATAN!\nDitemukan QR Code yang sudah ada di dalam gudang (Duplikat).\nSistem MENGUNCI penyimpanan. Silakan klik ikon 'Tong Sampah' pada baris berwarna merah jambu untuk menghapusnya.");
    } else {
        alert("Pengecekan Selesai.\nSemua QR Code AMAN dan siap dimasukkan ke gudang.");
    }

    btnCross.innerHTML = originalCrossText; 
    btnCross.disabled = false;
}

// ==========================================
// 2. LOGIKA SAVE SISTEM DECOUPLED INVENTORY
// ==========================================
async function saveToSupabase() {
    const btnSave = document.getElementById('btn-save'); 
    const originalText = btnSave.innerHTML;
    
    // KEAMANAN: Cek apakah ada status INVALID di layar
    const invalidRows = document.querySelectorAll('span[data-status="invalid"]');
    if(invalidRows.length > 0) {
        alert("TIDAK BISA DISIMPAN!\nMasih ada QR Code Duplikat di layar. Hapus baris yang berwarna MERAH terlebih dahulu.");
        return; 
    }

    btnSave.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MEMPROSES DATA...'; 
    btnSave.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) { alert("Tidak ada data."); btnSave.innerHTML = originalText; btnSave.disabled = false; return; }

    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    let arrFisikQR = []; 
    let mapVirtual = {}; 

    rows.forEach(row => {
        let area = row.querySelector('.area-cell').innerText;
        let qr = row.querySelector('.qr-val').innerText;
        let jenis = row.querySelector('.col-jenis').innerText;
        let nama = row.querySelector('.col-nama').innerText;
        let pjg = row.querySelector('.col-pjg').innerText;
        let grade = row.querySelector('.col-grade').innerText;
        let dus = row.querySelector('.col-dus').innerText;
        let shading = row.querySelector('.col-shading').innerText;
        let po = row.querySelector('.col-po').innerText;
        
        let id_sku = `${area}_${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}_${po}`;

        arrFisikQR.push({ qrcode: qr, area: area, id_sku: id_sku, pic_input: user.username });

        if(!mapVirtual[id_sku]) {
            mapVirtual[id_sku] = { 
                id_sku: id_sku, area: area, jenis_item: jenis, nama_item: nama, 
                panjang: pjg, grade: grade, dus: dus, shading: shading, po_aktual: po, qty: 0 
            };
        }
        mapVirtual[id_sku].qty += 1;
    });

    // SIMPAN KE TABEL FISIK (stok_qr)
    const { error: errQR } = await db.from('stok_qr').insert(arrFisikQR);
    if (errQR) {
        alert("SISTEM MENOLAK: Terdeteksi QR ganda di Database. Klik Crosscek Data untuk menemukan baris yang bermasalah.\n" + errQR.message);
        btnSave.innerHTML = originalText; btnSave.disabled = false; return;
    }

    // UPDATE TABEL VIRTUAL (stok_global)
    let skuKeys = Object.keys(mapVirtual);
    const { data: oldData } = await db.from('stok_global').select('id_sku, qty').in('id_sku', skuKeys);
    
    let arrVirtualUpdate = [];
    skuKeys.forEach(key => {
        let existing = oldData ? oldData.find(d => d.id_sku === key) : null;
        let qtySekarang = existing ? existing.qty : 0;
        let dataBaru = { ...mapVirtual[key], qty: qtySekarang + mapVirtual[key].qty }; 
        arrVirtualUpdate.push(dataBaru);
    });

    await db.from('stok_global').upsert(arrVirtualUpdate);

    // CATAT LOG MUTASI
    await db.from('log_mutasi').insert([{
        aktifitas: 'LANGSIR IN',
        detail: `Masuk ${arrFisikQR.length} Dus via Langsir.`,
        pic: user.username
    }]);

    alert(`BERHASIL!\n${arrFisikQR.length} kardus berhasil didaftarkan ke Gudang.`);
    document.getElementById('tbody-langsir').innerHTML = ''; 
    btnSave.innerHTML = originalText; btnSave.disabled = false;
    lucide.createIcons();
}
