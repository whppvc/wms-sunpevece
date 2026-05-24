let masterData = { kamus: [], troli: [], area: [] };
let deleteStack = [], globalRowId = 0;

// FUNGSI TARIK DATA (TIDAK PERLU addEventListener lagi di sini, dipanggil dari HTML)
async function loadInitialData() {
    try {
        console.log("Menarik data master Troli & Area...");
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
                selArea.innerHTML = '<option value="">-- Pilih Area --</option>';
                masterData.area.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
            }
        }

        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) masterData.kamus = mData2; 
        console.log("Data berhasil ditarik.");
    } catch (e) { console.error("Error muat data:", e); }
}

// Global expose
window.loadInitialData = loadInitialData;

// ... (Kode translateBarcode, addRow, dan saveToSupabase di bawah tetap sama) ...

function translateBarcode(barcode) {
    const parts = barcode.split('/');
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', po: '-' };
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
            let cariPO = masterData.kamus.find(m => m.kode_po === rawPO); data.po = cariPO && cariPO.po ? cariPO.po : rawPO;
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
    tr.className = "border-b border-gray-300 hover:bg-amber-50 transition row-item"; 
    const td = translateBarcode(code); 
    
    // Teks hitam pada cell diatur di class masing-masing atau diturunkan dari table
    let html = `
        <td class="p-3 text-center border-r border-gray-300"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer"><i data-lucide="trash-2"></i></button></td>
        <td class="p-3 font-bold no-cell text-center text-black border-r border-gray-300"></td>
        <td class="p-3 font-bold text-center col-val border-r border-gray-300"><span class="text-gray-500 font-bold" data-status="unverified">-</span></td>
        <td class="p-3 troli-cell font-bold text-amber-900 bg-amber-50/50">${troli}</td>
        <td class="p-3 area-cell font-bold text-amber-900 bg-amber-50/50 border-r border-gray-300">${area}</td>
        <td class="p-3 font-mono font-bold text-black qr-val border-r border-gray-300 bg-gray-50">${code}</td>
        <td class="p-3 col-tgl text-black">${td.tglProduksi}</td>
        <td class="p-3 col-mesin text-black">${td.mesin}</td>
        <td class="p-3 col-shift text-black border-r border-gray-300">${td.shift}</td>
        <td class="p-3 font-bold text-blue-800 col-jenis">${td.jenisItem}</td>
        <td class="p-3 font-bold text-black col-nama">${td.namaItem}</td>
        <td class="p-3 font-bold text-black col-pjg">${td.panjang}</td>
        <td class="p-3 font-bold text-black col-grade">${td.grade}</td>
        <td class="p-3 text-black col-dus">${td.dus}</td>
        <td class="p-3 text-black col-shading border-r border-gray-300">${td.shading}</td>
        <td class="p-3 font-bold text-center text-black bg-gray-100 col-po">${td.po}</td>`;
    
    tr.innerHTML = html; document.getElementById('tbody-langsir').prepend(tr);
    lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) { const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling }); tr.remove(); updateRowNumbers(); }
function undoDelete() { if(deleteStack.length === 0) return; const lastData = deleteStack.pop(); const tempDiv = document.createElement('tbody'); tempDiv.innerHTML = lastData.html; if (lastData.nextSibling) lastData.parent.insertBefore(tempDiv.firstChild, lastData.nextSibling); else lastData.parent.appendChild(tempDiv.firstChild); lucide.createIcons(); updateRowNumbers(); }
function updateRowNumbers() { const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; }); }

// ==========================================
// FUNGSI 1: CEK GUDANG (MENCEGAH DUPLIKAT MASUK GUDANG)
// ==========================================
async function cekGudang() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk di cek.");

    const btnCross = document.querySelector('button[onclick="cekGudang()"]');
    const originalCrossText = btnCross.innerHTML;
    btnCross.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENGECEK...'; btnCross.disabled = true;

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    // Cek ke tabel fisik gudang (stok_qr)
    const { data: existingData, error } = await db.from('stok_qr').select('qrcode').in('qrcode', allQRCodes);
    
    if(error) { alert("Gagal koneksi: " + error.message); btnCross.innerHTML = originalCrossText; btnCross.disabled = false; return; }

    const duplicateQRs = existingData.map(d => d.qrcode);
    let hasDuplicate = false;

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        const valCell = row.querySelector('.col-val');
        
        if(duplicateQRs.includes(qr)) {
            valCell.innerHTML = '<span class="text-black font-black bg-red-400 px-3 py-1 rounded-full border border-red-600 shadow-sm text-[11px] uppercase tracking-wider" data-status="invalid">Duplikat</span>';
            row.classList.add('bg-red-100'); hasDuplicate = true;
        } else {
            valCell.innerHTML = '<span class="text-black font-black bg-emerald-300 px-3 py-1 rounded-full border border-emerald-500 shadow-sm text-[11px] uppercase tracking-wider" data-status="valid">AMAN</span>';
            row.classList.remove('bg-red-100');
            row.classList.remove('bg-orange-100'); // Bersihkan sisa warna STBJ jika ada
        }
    });

    if(hasDuplicate) alert("PERINGATAN!\nDitemukan QR Code Duplikat. Hapus baris merah sebelum Anda bisa menyimpan ke gudang.");
    else alert("Gudang Aman! Tidak ada Duplikat.");

    btnCross.innerHTML = originalCrossText; btnCross.disabled = false;
}

// ==========================================
// FUNGSI 2: VALIDASI STBJ (CEK KEBERADAAN DI HASIL_STBJ)
// ==========================================
async function validasiSTBJ() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk divalidasi STBJ.");

    const btnSTBJ = document.querySelector('button[onclick="validasiSTBJ()"]');
    const originalText = btnSTBJ.innerHTML;
    btnSTBJ.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> VALIDASI...'; btnSTBJ.disabled = true;

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    // Cek ke tabel hasil_stbj
    const { data: stbjData, error } = await db.from('hasil_stbj').select('qrcode').in('qrcode', allQRCodes);
    
    if(error) { alert("Gagal koneksi: " + error.message); btnSTBJ.innerHTML = originalText; btnSTBJ.disabled = false; return; }

    const validQRs = stbjData.map(d => d.qrcode);
    let adaInvalid = false;

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        const valCell = row.querySelector('.col-val');
        
        // Cek dulu apakah statusnya sedang merah karena duplikat, jangan ditimpa jika duplikat
        const currentHtml = valCell.innerHTML;
        if(currentHtml.includes("Duplikat")) return; 

        if(validQRs.includes(qr)) {
            valCell.innerHTML = '<span class="text-black font-black bg-blue-300 px-3 py-1 rounded-full border border-blue-500 shadow-sm text-[11px] uppercase tracking-wider">VALID STBJ</span>';
            row.classList.remove('bg-orange-100');
        } else {
            valCell.innerHTML = '<span class="text-black font-black bg-orange-300 px-3 py-1 rounded-full border border-orange-500 shadow-sm text-[11px] uppercase tracking-wider" data-status="invalid-stbj">BELUM STBJ</span>';
            row.classList.add('bg-orange-100'); adaInvalid = true;
        }
    });

    if(adaInvalid) alert("Informasi: Ditemukan QR Code yang Belum di-STBJ (Baris warna Oren).");
    else alert("Sempurna! Semua QR Code telah melalui proses STBJ.");

    btnSTBJ.innerHTML = originalText; btnSTBJ.disabled = false;
}

// ==========================================
// 3. LOGIKA SAVE (MENYIMPAN KE GUDANG)
// ==========================================
async function // ==========================================
// LOGIKA SAVE (VIA RPC DATABASE)
// ==========================================
async function saveToSupabase() {
    const btnSave = document.getElementById('btn-save'); 
    const originalText = btnSave.innerHTML;
    
    // Keamanan Frontend
    if(document.querySelectorAll('span[data-status="invalid"]').length > 0) return alert("Hapus baris QR Duplikat (MERAH) terlebih dahulu!");
    if(document.querySelectorAll('span[data-status="unverified"]').length > 0) return alert("Harap tekan tombol CEK GUDANG terlebih dahulu!");
    if(document.querySelectorAll('span[data-status="invalid-stbj"]').length > 0) {
        if(!confirm("Ada baris BELUM STBJ. Tetap lanjutkan?")) return;
    }

    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Tidak ada data.");

    btnSave.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MENYIMPAN TRANSAKSI...'; 
    btnSave.disabled = true;

    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    let arrFisikQR = []; let mapVirtual = {}; 

    // Kumpulkan Data
    rows.forEach(row => {
        let area = row.querySelector('.area-cell').innerText; let qr = row.querySelector('.qr-val').innerText;
        let jenis = row.querySelector('.col-jenis').innerText; let nama = row.querySelector('.col-nama').innerText;
        let pjg = row.querySelector('.col-pjg').innerText; let grade = row.querySelector('.col-grade').innerText;
        let dus = row.querySelector('.col-dus').innerText; let shading = row.querySelector('.col-shading').innerText; let po = row.querySelector('.col-po').innerText;
        
        let id_sku = `${area}_${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}_${po}`;
        
        arrFisikQR.push({ qrcode: qr, area: area, id_sku: id_sku, pic_input: user.username });
        if(!mapVirtual[id_sku]) { mapVirtual[id_sku] = { id_sku: id_sku, area: area, jenis_item: jenis, nama_item: nama, panjang: pjg, grade: grade, dus: dus, shading: shading, po_aktual: po, qty: 0 }; }
        mapVirtual[id_sku].qty += 1;
    });

    let arrVirtualUpdate = Object.values(mapVirtual);

    // BUNGKUS PAYLOAD
    const payloadData = {
        qrs: arrFisikQR,
        virtuals: arrVirtualUpdate,
        detail_log: `Masuk ${arrFisikQR.length} Dus via Langsir.`,
        pic: user.username
    };

    // TEMBAK RPC SUPABASE
    const { data, error } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });

    if (error || (data && data.startsWith('ERROR'))) { 
        alert("SISTEM MENOLAK: " + (error ? error.message : data)); 
        btnSave.innerHTML = originalText; btnSave.disabled = false; return; 
    }

    alert(`BERHASIL!\n${arrFisikQR.length} kardus berhasil disimpan ke Database secara permanen.`);
    document.getElementById('tbody-langsir').innerHTML = ''; 
    btnSave.innerHTML = originalText; btnSave.disabled = false;
}
