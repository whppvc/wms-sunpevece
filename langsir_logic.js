let masterData = { kamus: [], area: [] }; 
let deleteStack = [], globalRowId = 0;
let currentPage = 1;
const rowsPerPage = 10; 

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        try {
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
            
            if (typeof applyPagination === "function") applyPagination();
        } catch (e) { console.error("Gagal muat dropdown area:", e); }
    }, 200); 

    setTimeout(() => {
        const formScan = document.getElementById('form-scan');
        if(formScan) {
            formScan.addEventListener('submit', (e) => {
                e.preventDefault();
                const rawInput = document.getElementById('input-qrcode').value.trim();
                const area = document.getElementById('select-area').value;
                if(!area || !rawInput) return alert("Pilih Area Simpan dan isi QR Code!");
                
                const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
                const codes = rawInput.split(/[\s;]+/).map(q => q.trim()).filter(q => q);
                
                codes.forEach(code => { 
                    const isLocalDuplicate = existingQRs.includes(code);
                    addRow(area, code, isLocalDuplicate); 
                    existingQRs.push(code); 
                });
                
                updateRowNumbers();
                applyPagination();
                
                document.getElementById('input-qrcode').value = '';
                tutupModalAdd(); // Tutup pop up setelah add
            });
        }
    }, 500);
});

// FUNGSI UTAMA PENGHASIL CARD VIEW
function addRow(area, code, isDuplicate = false) {
    globalRowId++; 
    const div = document.createElement('div'); 
    // Sesuai mockup warna kekuningan pale
    const rowClass = isDuplicate ? 'bg-red-100 hover:bg-red-200' : 'bg-[#faedbe] hover:bg-[#f3e5b3]';
    div.className = `row-item ${rowClass} border-[3px] border-slate-800 p-4 relative flex flex-col shadow-sm transition`; 
    
    const td = translateBarcode(code); 
    const stbjHtml = '<span class="text-white font-black bg-[#ff7315] border-b-2 border-[#cc5b0f] px-3 py-1.5 text-[11px] stbj-val" data-status="unverified">BLM STBJ</span>';
    const kodeHtml = isDuplicate 
        ? '<span class="text-white font-black bg-red-600 border-b-2 border-red-800 px-3 py-1.5 text-[11px] kode-val shadow-sm" data-status="invalid">DUPLIKAT LOKAL</span>'
        : '<span class="text-[#0e744a] font-black bg-[#a0ecd1] border-b-2 border-[#76c2a7] px-3 py-1.5 text-[11px] kode-val" data-status="unverified">ACCEPT</span>';

    div.innerHTML = `
        <div class="flex justify-between items-start mb-1">
            <div class="flex items-center gap-3">
                <input type="checkbox" onchange="highlightRow(this)" class="cb-row cursor-pointer w-5 h-5 accent-blue-600 rounded">
                <span class="font-black text-lg text-slate-800 no-cell"></span>
                <span class="font-black text-lg area-cell col-area text-slate-800">${area}</span>
            </div>
            <button onclick="deleteRow(this)" class="bg-slate-700 text-white p-2 rounded-md hover:bg-rose-600 transition active:scale-95 border-b-2 border-slate-900"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
        
        <div class="font-mono font-black text-slate-900 text-[13px] mb-2 qr-val col-qr leading-tight break-all pl-8">${code}</div>
        
        <div class="text-xs font-bold text-slate-800 leading-relaxed grid grid-cols-1 gap-0.5 pl-8">
            <div>Tgl Produksi: <span class="col-tgl">${td.tglProduksi}</span></div>
            <div>Mesin: <span class="col-mesin">${td.mesin}</span></div>
            <div>Shift: <span class="col-shift">${td.shift}</span></div>
            <div>Nama: <span class="col-nama">${td.namaItem}</span> <span class="col-jenis hidden">${td.jenisItem}</span></div>
            <div>Pjg: <span class="col-pjg">${td.panjang}</span></div>
            <div>Grade: <span class="col-grade">${td.grade}</span></div>
            <div>Dus: <span class="col-dus">${td.dus}</span></div>
            <div>Shading: <span class="col-shading">${td.shading}</span></div>
            <div>Po Awal: <span class="col-po">${td.po}</span></div>
            <div>Keterangan: <span class="col-ket ket-cell">-</span> <span class="col-troli troli-cell hidden">-</span></div>
        </div>
        
        <div class="flex gap-2 mt-4 pl-8">
            ${stbjHtml}
            ${kodeHtml}
        </div>
    `;
    
    document.getElementById('tbody-langsir').prepend(div); 
    lucide.createIcons(); 
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
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); }
    });
    currentPage = 1;
    applyPagination();
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

function deleteRow(btn) { 
    const div = btn.closest('.row-item'); 
    deleteStack.push({ parent: div.parentNode, html: div.outerHTML, nextSibling: div.nextSibling }); 
    div.remove(); 
    updateRowNumbers(); 
    applyPagination(); 
}

function undoDelete() { 
    if(deleteStack.length === 0) return alert("Belum ada data yang dihapus."); 
    const last = deleteStack.pop(); 
    const temp = document.createElement('div'); 
    temp.innerHTML = last.html; 
    const element = temp.firstElementChild;
    if (last.nextSibling) last.parent.insertBefore(element, last.nextSibling); 
    else last.parent.appendChild(element); 
    lucide.createIcons(); 
    updateRowNumbers(); 
    applyPagination(); 
}

function updateRowNumbers() { 
    const rows = document.querySelectorAll('#tbody-langsir .row-item'); 
    let count = 1; 
    rows.forEach(div => { 
        const noCell = div.querySelector('.no-cell');
        if(noCell) noCell.innerText = count++; 
    }); 
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#tbody-langsir .row-item'));
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    
    const totalFiltered = visibleRows.length; 
    const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; 
    const endIndex = startIndex + rowsPerPage;

    visibleRows.forEach((row, index) => {
        if(index >= startIndex && index < endIndex) { 
            row.style.display = 'flex'; // Card menggunakan flex
        } else { 
            row.style.display = 'none'; 
        }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
}

function prevPage() { if(currentPage > 1) { currentPage--; applyPagination(); } }
function nextPage() { 
    const totalVisible = document.querySelectorAll('#tbody-langsir .row-item:not(.filtered-out)').length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; applyPagination(); } 
}

function toggleSemuaCentang(checked) {
    document.querySelectorAll('.cb-row').forEach(cb => {
        const row = cb.closest('.row-item');
        if (row && row.style.display !== 'none' && !row.classList.contains('filtered-out')) {
            cb.checked = checked;
            highlightRow(cb);
        }
    });
}

function highlightRow(cb) {
    const div = cb.closest('.row-item');
    if (div) {
        if (cb.checked) div.classList.add('selected-row');
        else div.classList.remove('selected-row');
    }
}

function editKeteranganMassal() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if (checkedBoxes.length === 0) return alert("Pilih / centang baris yang keterangannya ingin diedit!");

    const newKet = prompt(`Masukkan keterangan baru untuk ${checkedBoxes.length} baris terpilih:\n(Catatan: Akan menimpa Keterangan hasil Verifikasi)`);
    if (newKet === null) return; 

    checkedBoxes.forEach(cb => {
        const div = cb.closest('.row-item');
        const ketCell = div.querySelector('.ket-cell');
        if (ketCell) {
            ketCell.innerText = newKet.trim() || '-';
            ketCell.classList.remove('italic', 'text-red-500', 'text-slate-500'); 
            ketCell.classList.add('text-blue-700'); 
        }
    });
    
    document.querySelector('#cb-all').checked = false;
    toggleSemuaCentang(false);
    alert("Keterangan berhasil diperbarui secara lokal!");
}

async function VerifikasiDanCek() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk diVerifikasi.");
    
    const btn = document.getElementById('btn-Verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> PROSES...'; btn.disabled = true;
    
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
            
            // VERIFIKASI STBJ
            if(stbjMap[qr]) {
                stbjSpan.className = 'text-white font-black bg-blue-600 border-b-2 border-blue-800 px-3 py-1.5 text-[11px] stbj-val shadow-sm';
                stbjSpan.setAttribute('data-status', 'valid');
                stbjSpan.innerText = 'SDH STBJ';
                
                troliCell.innerText = stbjMap[qr].troli || '-';
                troliCell.classList.remove('hidden');
                
                if(!ketCell.classList.contains('text-blue-700')) {
                    ketCell.innerText = stbjMap[qr].keterangan || '-';
                }
            } else {
                stbjSpan.className = 'text-white font-black bg-[#ff7315] border-b-2 border-[#cc5b0f] px-3 py-1.5 text-[11px] stbj-val shadow-sm';
                stbjSpan.setAttribute('data-status', 'invalid-stbj');
                stbjSpan.innerText = 'BLM STBJ';
                troliCell.innerText = '-';
                ketCell.innerText = '-';
                hasError = true;
            }

            // VERIFIKASI KODE DUPLIKAT GUDANG
            if(kodeSpan.innerText.includes('LOKAL')) {
                hasError = true;
            } 
            else if(stokList.includes(qr)) {
                kodeSpan.className = 'text-white font-black bg-red-600 border-b-2 border-red-800 px-3 py-1.5 text-[11px] kode-val shadow-sm';
                kodeSpan.setAttribute('data-status', 'invalid');
                kodeSpan.innerText = 'DUPLIKAT';
                r.classList.replace('bg-[#faedbe]', 'bg-red-50');
                r.classList.replace('hover:bg-[#f3e5b3]', 'hover:bg-red-100');
                hasError = true;
            } else {
                kodeSpan.className = 'text-[#0e744a] font-black bg-[#a0ecd1] border-b-2 border-[#76c2a7] px-3 py-1.5 text-[11px] kode-val shadow-sm';
                kodeSpan.setAttribute('data-status', 'valid');
                kodeSpan.innerText = 'ACCEPT';
                r.classList.replace('bg-red-50', 'bg-[#faedbe]');
                r.classList.replace('hover:bg-red-100', 'hover:bg-[#f3e5b3]');
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

    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENYIMPAN...'; btn.disabled = true;
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
        arrFisik.push({ qrcode: qr, area: area, id_sku: id_sku, pic: user.username });
        
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
    updateRowNumbers();
    applyPagination();
}

async function holdLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if(checkedBoxes.length === 0) return alert("Anda harus mencentang kotak di baris yang bermasalah terlebih dahulu.");

    const btn = document.getElementById('btn-menu-utama'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i>'; btn.disabled = true;

    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    let payloadUpload = [];

    checkedBoxes.forEach(cb => {
        const div = cb.closest('.row-item');
        const qr = div.querySelector('.qr-val').innerText;
        const troli = div.querySelector('.troli-cell').innerText;
        const area = div.querySelector('.area-cell').innerText;
        const ketStbj = div.querySelector('.stbj-val').innerText;
        const ketKode = div.querySelector('.kode-val').innerText;
        const noteKet = div.querySelector('.ket-cell').innerText;
        
        payloadUpload.push({
            qrcode: qr, troli: troli, area: area,
            keterangan: `STBJ: ${ketStbj} | KODE: ${ketKode} | Ket User: ${noteKet}`,
            pic_input: user.username
        });
    });

    try {
        const { error } = await db.from('hold_langsir').insert(payloadUpload);
        if(error) throw error;
        
        checkedBoxes.forEach(cb => { cb.closest('.row-item').remove(); });
        updateRowNumbers(); 
        applyPagination();
        document.querySelector('#cb-all').checked = false;
        
        alert(`SUKSES!\n${payloadUpload.length} Data berhasil diasingkan ke "Hold Langsir".`);
    } catch(e) { alert("Gagal melakukan Hold: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih baris yang ingin disalin dengan mencentang kotak di data card!");

    let copyString = "Area\tQRCode\tTgl Produksi\tMesin\tShift\tNama Item\tPjg\tGrade\tDus\tShading\tPO\tKeterangan\n";
    
    cek.forEach(cb => {
        const div = cb.closest('.row-item');
        const area = div.querySelector('.col-area').innerText;
        const qr = div.querySelector('.col-qr').innerText;
        const tgl = div.querySelector('.col-tgl').innerText;
        const mesin = div.querySelector('.col-mesin').innerText;
        const shift = div.querySelector('.col-shift').innerText;
        const nama = div.querySelector('.col-nama').innerText;
        const pjg = div.querySelector('.col-pjg').innerText;
        const grade = div.querySelector('.col-grade').innerText;
        const dus = div.querySelector('.col-dus').innerText;
        const shading = div.querySelector('.col-shading').innerText;
        const po = div.querySelector('.col-po').innerText;
        const ket = div.querySelector('.col-ket').innerText;
        
        copyString += `${area}\t${qr}\t${tgl}\t${mesin}\t${shift}\t${nama}\t${pjg}\t${grade}\t${dus}\t${shading}\t${po}\t${ket}\n`;
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert(`Berhasil menyalin ${cek.length} baris!\nBuka Excel lalu tekan CTRL+V / Paste.`);
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
}

async function bukaModalSTBJ() {
    document.getElementById('modal-stbj-langsir').classList.remove('hidden');
    
    const tbody = document.getElementById('tbody-stbj-modal');
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat...</td></tr>';
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
            let colGudang = statusGudang === 'IN GUDANG' ? '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded text-[10px]">IN GUDANG</span>' 
                : statusGudang === 'KELUAR' ? '<span class="bg-red-100 text-red-800 font-bold px-2 py-1 rounded text-[10px]">KELUAR</span>' 
                : '<span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-[10px]">STBJ</span>';
            
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 text-xs">
                    <td class="p-3 font-bold text-slate-400">${i+1}</td>
                    <td class="p-3 text-slate-600 font-semibold">${tgl}</td>
                    <td class="p-3 font-bold text-slate-700">${r.troli || '-'}</td>
                    <td class="p-3 font-mono font-bold text-slate-900">${r.qrcode}</td>
                    <td class="p-3 font-bold text-blue-700 text-left">${td.namaItem}</td>
                    <td class="p-3 font-bold text-slate-600">${td.panjang}</td>
                    <td class="p-3 font-black text-orange-600">${td.po}</td>
                    <td class="p-3">${colGudang}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="p-6 font-bold text-red-500">Gagal: ${e.message}</td></tr>`; }
}

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('#tbody-stbj-modal tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}
