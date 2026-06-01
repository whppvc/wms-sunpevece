let masterData = { kamus: [], area: [] }; 
let deleteStack = [], globalRowId = 0;
let sortState = {}; // REVISI 3: Objek pelacak status sorting

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        try {
            const { data: mDataArea } = await db.from('master_area').select('nama_area').order('id', { ascending: true });
            if(mDataArea) {
                masterData.area = [...new Set(mDataArea.map(r => r.nama_area).filter(x => x && x.trim() !== ''))]; 
                const selArea = document.getElementById('select-area');
                if(selArea) { selArea.innerHTML = '<option value="">-- Pilih Area --</option>'; masterData.area.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`); }
            }

            const { data: mData2 } = await db.from('master_2').select('*');
            if(mData2) masterData.kamus = mData2; 

            // REVISI 2: buatDropdownKolom() telah dihapus
        } catch (e) { console.error("Gagal muat dropdown:", e); }
    }, 200); 
});

// REVISI 3: FUNGSI SORT TABEL A-Z, Z-A
function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-langsir');
    const rows = Array.from(tbody.querySelectorAll('tr.row-item'));
    
    // Cek apakah sedang Ascending atau Descending
    let isAsc = sortState[colIndex] !== 'asc';
    sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim();
        let valB = b.cells[colIndex].innerText.trim();
        
        // Coba konversi ke angka jika itu adalah nilai numerik (contoh: No)
        let numA = parseFloat(valA);
        let numB = parseFloat(valB);
        
        if(!isNaN(numA) && !isNaN(numB)) {
            return isAsc ? numA - numB : numB - numA;
        } else {
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });
    
    // Terapkan hasil urutan ke dalam tabel HTML
    rows.forEach(row => tbody.appendChild(row));
    
    // Update Ikon Lucide di Header
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.setAttribute('data-lucide', 'arrow-up-down'); // Reset semua icon
        icon.classList.add('opacity-50');
    });
    
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) {
        icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a');
        icon.classList.remove('opacity-50');
        lucide.createIcons();
    }
}

function saringTabelLangsir() {
    const f = {
        stbj: document.getElementById('f-stbj').value.toLowerCase(),
        kode: document.getElementById('f-kode').value.toLowerCase(),
        troli: document.getElementById('f-troli').value.toLowerCase(),
        area: document.getElementById('f-area').value.toLowerCase(),
        qr: document.getElementById('f-qr').value.toLowerCase(),
        tgl: document.getElementById('f-tgl').value.toLowerCase(),
        mesin: document.getElementById('f-mesin').value.toLowerCase(),
        shift: document.getElementById('f-shift').value.toLowerCase(),
        jenis: document.getElementById('f-jenis').value.toLowerCase(),
        nama: document.getElementById('f-nama').value.toLowerCase(),
        pjg: document.getElementById('f-pjg').value.toLowerCase(),
        grade: document.getElementById('f-grade').value.toLowerCase(),
        dus: document.getElementById('f-dus').value.toLowerCase(),
        shading: document.getElementById('f-shading').value.toLowerCase(),
        po: document.getElementById('f-po').value.toLowerCase(),
        ket: document.getElementById('f-ket').value.toLowerCase()
    };

    document.querySelectorAll('.row-item').forEach(row => {
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

function translateBarcode(barcode) {
    const parts = barcode.split('/'); let data = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', po: '-' };
    if (parts.length < 4) return data;
    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') data.jenisItem = 'Plafon'; else if (hurufDepan === 'L') data.jenisItem = 'List'; else if (hurufDepan === 'W') data.jenisItem = 'WPC'; else data.jenisItem = hurufDepan;

    let rawItem = parts[0]; let cariItem = masterData.kamus.find(m => m.kode_nama_item === rawItem); data.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem; data.shading = parts[1];
    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); let cariDus = masterData.kamus.find(m => m.kode_dus === rawDus); data.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }
    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let cariMesin = masterData.kamus.find(m => m.kode_mesin === match[1]); data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : match[1];
            let cariShift = masterData.kamus.find(m => m.kode_shift === match[2]); data.shift = cariShift && cariShift.shift ? cariShift.shift : match[2];
            let cariPO = masterData.kamus.find(m => m.kode_po === match[3]); data.po = cariPO && cariPO.po ? cariPO.po : match[3];
        } else { data.mesin = "SALAH"; data.shift = "SALAH"; data.po = "SALAH"; }
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const formScan = document.getElementById('form-scan');
        if(formScan) {
            formScan.addEventListener('submit', (e) => {
                e.preventDefault();
                const rawInput = document.getElementById('input-qrcode').value.trim();
                const area = document.getElementById('select-area').value;
                if(!area || !rawInput) return alert("Pilih Area Simpan dan isi QR Code!");
                
                const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
                const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
                
                codes.forEach(code => { 
                    const isLocalDuplicate = existingQRs.includes(code);
                    addRow(area, code, isLocalDuplicate); 
                    existingQRs.push(code); 
                });
                
                document.getElementById('input-qrcode').value = '';
            });
        }
    }, 500);
});

function toggleSemuaCentang(checked) {
    document.querySelectorAll('.cb-row').forEach(cb => cb.checked = checked);
}

function addRow(area, code, isDuplicate = false) {
    globalRowId++; const tr = document.createElement('tr'); 
    const rowClass = isDuplicate ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-slate-50';
    tr.className = `border-b border-slate-200 transition row-item ${rowClass}`; 
    
    const td = translateBarcode(code); 
    const stbjHtml = '<span class="text-slate-400 font-bold stbj-val" data-status="unverified">-</span>';
    const kodeHtml = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 px-2 py-1 text-[10px] rounded kode-val shadow-sm" data-status="invalid">DUPLIKAT LOKAL</span>'
        : '<span class="text-slate-400 font-bold kode-val" data-status="unverified">-</span>';

    tr.innerHTML = `
        <td class="p-3 col-cb"><input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
        <td class="p-3 text-center col-btn"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer p-1.5 rounded bg-white shadow-sm border border-slate-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        <td class="p-3 font-bold no-cell text-center text-slate-500 col-no"></td>
        <td class="p-3 font-bold text-center border-r border-slate-200 col-stbj">${stbjHtml}</td>
        <td class="p-3 font-bold text-center border-r border-slate-200 col-kode">${kodeHtml}</td>
        <td class="p-3 troli-cell font-bold text-slate-400 italic text-center col-troli text-[11px]">Tunggu Cek</td>
        <td class="p-3 area-cell font-black text-emerald-600 border-r border-slate-200 col-area">${area}</td>
        <td class="p-3 font-mono font-bold text-slate-900 qr-val border-r border-slate-200 bg-slate-50/50 tracking-wider col-qr">${code}</td>
        <td class="p-3 col-tgl text-slate-600 font-semibold">${td.tglProduksi}</td>
        <td class="p-3 col-mesin text-slate-600 font-semibold">${td.mesin}</td>
        <td class="p-3 col-shift text-slate-600 font-semibold border-r border-slate-200">${td.shift}</td>
        <td class="p-3 font-black text-blue-700 col-jenis">${td.jenisItem}</td>
        <td class="p-3 font-bold text-slate-800 col-nama text-left">${td.namaItem}</td>
        <td class="p-3 font-bold text-slate-600 col-pjg">${td.panjang}</td>
        <td class="p-3 font-bold text-slate-800 col-grade">${td.grade}</td>
        <td class="p-3 font-bold text-slate-800 col-dus">${td.dus}</td>
        <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shading">${td.shading}</td>
        <td class="p-3 font-black text-center text-orange-600 bg-orange-50/50 border-r border-slate-200 col-po">${td.po}</td>
        <td class="p-3 font-bold text-slate-500 ket-cell col-ket text-left italic text-[11px]">Tunggu Cek</td>`;
    
    document.getElementById('tbody-langsir').prepend(tr); lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) { const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling }); tr.remove(); updateRowNumbers(); }
function undoDelete() { if(deleteStack.length === 0) return alert("Belum ada data yang dihapus."); const last = deleteStack.pop(); const temp = document.createElement('tbody'); temp.innerHTML = last.html; if (last.nextSibling) last.parent.insertBefore(temp.firstChild, last.nextSibling); else last.parent.appendChild(temp.firstChild); lucide.createIcons(); updateRowNumbers(); }

// Kita tidak menghitung ulang No secara manual saat di-sort, karena agar urutannya mengacu pada index aslinya.
// Fungsi updateRowNumbers hanya berjalan pas penambahan/penghapusan row.
function updateRowNumbers() { const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; }); }

async function VerifikasiDanCek() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk diVerifikasi.");
    
    const btn = document.getElementById('btn-Verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENGAMBIL DATA...'; btn.disabled = true;
    
    const qrs = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    try {
        const [resStbj, resStok] = await Promise.all([
            db.from('hasil_stbj').select('qrcode, troli, keterangan').in('qrcode', qrs),
            db.from('stok_qr').select('qrcode').in('qrcode', qrs)
        ]);

        if(resStbj.error) throw resStbj.error;
        if(resStok.error) throw resStok.error;

        const stbjMap = {};
        resStbj.data.forEach(d => { stbjMap[d.qrcode] = d; });
        const stokList = resStok.data.map(d => d.qrcode);
        let hasError = false;

        rows.forEach(r => {
            const qr = r.querySelector('.qr-val').innerText;
            const stbjSpan = r.querySelector('.stbj-val');
            const kodeSpan = r.querySelector('.kode-val');
            const troliCell = r.querySelector('.troli-cell');
            const ketCell = r.querySelector('.ket-cell');
            
            if(stbjMap[qr]) {
                stbjSpan.className = 'text-white font-bold bg-blue-600 px-3 py-1.5 rounded shadow-sm text-[10px] stbj-val';
                stbjSpan.setAttribute('data-status', 'valid');
                stbjSpan.innerText = 'SDH STBJ';
                
                troliCell.innerText = stbjMap[qr].troli || '-';
                troliCell.className = "p-3 font-bold text-slate-700 troli-cell col-troli text-center";
                
                ketCell.innerText = stbjMap[qr].keterangan || '-';
                ketCell.className = "p-3 font-bold text-slate-700 ket-cell col-ket text-left";
            } else {
                stbjSpan.className = 'text-white font-bold bg-orange-500 px-3 py-1.5 rounded shadow-sm text-[10px] stbj-val';
                stbjSpan.setAttribute('data-status', 'invalid-stbj');
                stbjSpan.innerText = 'BLM STBJ';
                
                troliCell.innerText = '-';
                troliCell.className = "p-3 font-bold text-red-500 troli-cell col-troli text-center";
                ketCell.innerText = '-';
                ketCell.className = "p-3 font-bold text-red-500 ket-cell col-ket text-left";
                
                hasError = true;
            }

            if(kodeSpan.innerText.includes('LOKAL')) {
                hasError = true;
            } 
            else if(stokList.includes(qr)) {
                kodeSpan.className = 'text-white font-black bg-red-600 px-3 py-1.5 rounded shadow-sm text-[10px] tracking-wide kode-val';
                kodeSpan.setAttribute('data-status', 'invalid');
                kodeSpan.innerText = 'DUPLIKAT';
                r.classList.add('bg-red-50');
                hasError = true;
            } else {
                kodeSpan.className = 'text-emerald-700 font-black bg-emerald-100 border border-emerald-300 px-3 py-1 rounded shadow-sm text-[10px] kode-val';
                kodeSpan.setAttribute('data-status', 'valid');
                kodeSpan.innerText = 'ACCEPT';
                r.classList.remove('bg-red-50');
            }
        });

        if(hasError) { alert("PERINGATAN!\nTerdapat data bermasalah (BLM STBJ / DUPLIKAT).\nSilakan pilih baris tersebut untuk dipindahkan ke HOLD LANGSIR, atau hapus barisnya."); } 
        else { alert("MANTAP!\nSemua baris Valid (SDH STBJ & ACCEPT). Troli dan Keterangan berhasil ditarik. Siap disimpan ke Gudang."); }
    } catch (e) { alert("Koneksi Error: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

async function saveToSupabase() {
    const btn = document.getElementById('btn-save'); const original = btn.innerHTML;
    
    const adaYgBelumDicek = document.querySelectorAll('span[data-status="unverified"]').length > 0;
    const adaDuplikat = document.querySelectorAll('span[data-status="invalid"]').length > 0;
    const adaBelumStbj = document.querySelectorAll('span[data-status="invalid-stbj"]').length > 0;

    if(adaYgBelumDicek || adaDuplikat || adaBelumStbj) {
        return alert("GAGAL MENYIMPAN!\nTerdapat baris bermasalah. Tahan/Hapus baris tersebut.");
    }
    
    const rows = document.querySelectorAll('.row-item'); if(rows.length === 0) return;

    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MENYIMPAN...'; btn.disabled = true;
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    let arrFisik = []; let mapAktual = {}; let mapGlobal = {}; 

    rows.forEach(r => {
        let area = r.querySelector('.area-cell').innerText; let qr = r.querySelector('.qr-val').innerText;
        let jenis = r.querySelector('.col-jenis').innerText; let nama = r.querySelector('.col-nama').innerText;
        let pjg = r.querySelector('.col-pjg').innerText; let grade = r.querySelector('.col-grade').innerText;
        let dus = r.querySelector('.col-dus').innerText; let shading = r.querySelector('.col-shading').innerText; 
        let po = r.querySelector('.col-po').innerText; 
        let ket = r.querySelector('.col-ket').innerText;
        
        let td = translateBarcode(qr);
        let poBawaan = td.po; 
        
        let id_sku = `${area}_${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}_${po}`;
        arrFisik.push({ qrcode: qr, area: area, id_sku: id_sku, pic_input: user.username });
        
        let keyAkt = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
        if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { jenis_item: jenis, nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, area: area, po_aktual: po, ket: ket, qty: 0 };
        mapAktual[keyAkt].qty += 1;

        let keyGlb = `${nama}_${pjg}_${grade}_${dus}_${shading}_${poBawaan}_${ket}`;
        if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { jenis_item: jenis, nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, po_bawaan: poBawaan, ket: ket, qty: 0 };
        mapGlobal[keyGlb].qty += 1;
    });

    const payloadData = { qrs: arrFisik, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
    const { data, error } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });

    if (error) { alert("GAGAL SERVER: " + error.message); btn.innerHTML = original; btn.disabled = false; return; }
    
    alert(`BERHASIL!\n${arrFisik.length} kardus masuk.\nTabel Stok Aktual & Stok Global sukses terupdate bersamaan.`);
    document.getElementById('tbody-langsir').innerHTML = ''; btn.innerHTML = original; btn.disabled = false;
}

async function holdLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if(checkedBoxes.length === 0) return alert("Anda harus mencentang kotak di baris yang bermasalah terlebih dahulu untuk memindahkannya ke antrean Hold.");

    const btn = document.getElementById('btn-hold'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> HOLDING...'; btn.disabled = true;

    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    let payloadUpload = [];

    checkedBoxes.forEach(cb => {
        const tr = cb.closest('tr');
        const qr = tr.querySelector('.qr-val').innerText;
        const troli = tr.querySelector('.troli-cell').innerText;
        const area = tr.querySelector('.area-cell').innerText;
        const ketStbj = tr.querySelector('.stbj-val').innerText;
        const ketKode = tr.querySelector('.kode-val').innerText;
        const noteKet = tr.querySelector('.ket-cell').innerText;
        
        payloadUpload.push({
            qrcode: qr, troli: troli, area: area,
            keterangan: `STBJ: ${ketStbj} | KODE: ${ketKode} | Ket User: ${noteKet}`,
            pic_input: user.username
        });
    });

    try {
        const { error } = await db.from('hold_langsir').insert(payloadUpload);
        if(error) throw error;
        
        checkedBoxes.forEach(cb => { cb.closest('tr').remove(); });
        updateRowNumbers(); document.querySelector('input[onchange="toggleSemuaCentang(this.checked)"]').checked = false;
        
        alert(`SUKSES!\n${payloadUpload.length} Data berhasil diasingkan ke "Hold Langsir".`);
    } catch(e) { alert("Gagal melakukan Hold: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih baris yang ingin disalin dengan mencentang kotak di kiri tabel!");

    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-langsir th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';

    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
            if(window.getComputedStyle(td).display !== 'none') {
                rowData.push(td.innerText.trim().replace(/\n/g, ' '));
            }
        });
        copyString += rowData.join('\t') + '\n';
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert(`Berhasil menyalin ${cek.length} baris!\nBuka Excel lalu tekan CTRL+V / Paste.`);
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
}

async function bukaModalSTBJ() {
    document.getElementById('modal-stbj-langsir').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    
    const tbody = document.getElementById('tbody-stbj-modal');
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</td></tr>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj').select('*').order('created_at', {ascending: false});
        if(error) throw error;
        
        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-6 font-bold text-slate-400">Tabel STBJ Kosong.</td></tr>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            const td = translateBarcode(r.qrcode);
            
            let statusGudang = r.posisi || 'STBJ';
            let colGudang = '';
            
            if(statusGudang === 'IN GUDANG') {
                colGudang = '<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">IN GUDANG</span>';
            } else if (statusGudang === 'KELUAR') {
                colGudang = '<span class="bg-red-100 text-red-800 border border-red-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">KELUAR</span>';
            } else {
                colGudang = '<span class="bg-blue-100 text-blue-800 border border-blue-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">STBJ</span>';
            }
            
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition row-modal-stbj">
                    <td class="p-3 font-bold text-slate-400">${i+1}</td>
                    <td class="p-3 text-slate-600 font-semibold">${tgl}</td>
                    <td class="p-3 font-bold text-slate-700">${r.troli || '-'}</td>
                    <td class="p-3 font-mono font-bold text-slate-900 border-r border-slate-200 tracking-wider">${r.qrcode}</td>
                    <td class="p-3 font-bold text-blue-700 text-left">${td.namaItem}</td>
                    <td class="p-3 font-bold text-slate-600">${td.panjang}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 border-r border-slate-200">${td.po}</td>
                    <td class="p-3">${colGudang}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 font-bold text-red-500">Gagal: ${e.message}</td></tr>`;
    }
}

function tutupModalSTBJ() { 
    document.getElementById('modal-stbj-langsir').classList.add('hidden'); 
    if(document.getElementById('sidebar-filter').classList.contains('translate-x-full')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
}

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}
