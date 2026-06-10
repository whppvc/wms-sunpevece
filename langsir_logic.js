let masterData = { kamus: [], area: [] }; 
let deleteStack = []; 

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
            
            updateTotalBaris();
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
                updateTotalBaris();
                
                document.getElementById('input-qrcode').value = '';
                tutupModalAdd(); 
            });
        }
    }, 500);
});

// REVISI 1 & 3: "DUPLIKAT SCAN" DAN FONT NOMOR DIBESARKAN (text-2xl)
function addRow(area, code, isDuplicate = false) {
    const div = document.createElement('div'); 
    const rowClass = isDuplicate ? 'bg-red-100 hover:bg-red-200' : 'bg-white hover:bg-slate-50'; // Diganti putih sesuai request
    div.className = `row-item ${rowClass} border-[3px] border-slate-800 p-2 relative shadow-sm transition w-full rounded-md`; 
    
    const td = translateBarcode(code); 
    
    const stbjHtml = '<span class="text-slate-500 font-black bg-slate-200 border-b-2 border-slate-300 px-3 py-1.5 text-[11px] stbj-val rounded-sm shadow-sm" data-status="unverified">MENUNGGU VERIFIKASI...</span>';
    
    // REVISI 1: Duplikat Lokal (waktu input) disebut DUPLIKAT SCAN
    const kodeHtml = isDuplicate 
        ? '<span class="text-white font-black bg-red-600 border-b-2 border-red-800 px-3 py-1.5 text-[11px] kode-val rounded-sm shadow-sm" data-status="invalid">DUPLIKAT SCAN</span>'
        : '<span class="text-slate-500 font-black bg-slate-200 border-b-2 border-slate-300 px-3 py-1.5 text-[11px] kode-val rounded-sm shadow-sm" data-status="unverified">MENUNGGU VERIFIKASI...</span>';

    div.innerHTML = `
        <div class="flex w-full">
            
            <div class="flex flex-col items-center justify-start pr-3 mr-3 border-r border-slate-400 w-12 shrink-0 pt-1">
                <div class="font-black text-slate-800 text-2xl mb-3 leading-none"><span class="no-cell"></span></div>
                <input type="checkbox" onchange="highlightRow(this)" class="cb-row cursor-pointer w-5 h-5 accent-blue-600 rounded bg-white border-slate-400">
            </div>
            
            <div class="flex-1 flex flex-col gap-1 w-full min-w-0">
                <div class="flex justify-between items-start">
                    <div class="font-black text-[28px] text-emerald-700 leading-none area-cell col-area">${area}</div>
                    <button onclick="deleteRow(this)" class="bg-slate-700 text-white p-2 rounded hover:bg-rose-600 transition active:scale-95 border-b-2 border-slate-900 shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                
                <div class="font-mono font-black text-slate-900 text-[14px] break-all leading-tight qr-val col-qr mt-1">${code}</div>
                
                <div class="text-[13px] font-bold text-slate-600 tracking-tight mt-1">
                    <span class="col-tgl">${td.tglProduksi}</span> - <span class="col-mesin">${td.mesin}</span> - <span class="col-shift">${td.shift}</span>
                </div>
                
                <div class="text-[14px] font-black text-slate-900 leading-snug">
                    <span class="col-nama">${td.namaItem}</span> - <span class="col-pjg">${td.panjang}</span> - <span class="col-grade">${td.grade}</span> - <span class="col-dus">${td.dus}</span>
                    <span class="col-jenis hidden">${td.jenisItem}</span>
                </div>
                
                <div class="text-[14px] font-bold text-blue-600 col-shading">${td.shading}</div>
                <div class="text-[14px] font-bold text-orange-600 col-po uppercase">${td.po}</div>
                
                <div class="text-[13px] font-bold text-slate-600 mt-1">Keterangan: <span class="col-ket ket-cell text-slate-800">-</span></div>
                <div class="text-[13px] font-bold text-slate-600">Troli: <span class="col-troli troli-cell text-slate-800">-</span></div>
                
                <div class="flex flex-row flex-wrap items-center gap-2 mt-2">
                    ${stbjHtml}
                    ${kodeHtml}
                </div>
            </div>
            
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
    updateTotalBaris();
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
    deleteStack.push(div); 
    div.style.display = 'none'; 
    div.classList.add('filtered-out'); 
    updateRowNumbers(); 
    updateTotalBaris(); 
}

function undoDelete() { 
    if(deleteStack.length === 0) return alert("Belum ada data yang dihapus."); 
    const div = deleteStack.pop(); 
    div.style.display = 'flex'; 
    div.classList.remove('filtered-out'); 
    document.getElementById('tbody-langsir').prepend(div); 
    updateRowNumbers(); 
    updateTotalBaris(); 
}

// REVISI 4: PENGURUTAN NOMOR (Kode awal/pertama yang masuk = No 1)
function updateRowNumbers() { 
    const rows = Array.from(document.querySelectorAll('#tbody-langsir .row-item:not([style*="display: none"])')); 
    // Membalik loop dari bawah ke atas DOM (karena kita pakai prepend saat nambah data)
    let count = 1; 
    for (let i = rows.length - 1; i >= 0; i--) {
        const noCell = rows[i].querySelector('.no-cell');
        if(noCell) noCell.innerText = count++; 
    }
}

function updateTotalBaris() {
    const allRows = Array.from(document.querySelectorAll('#tbody-langsir .row-item'));
    let totalFiltered = 0;

    allRows.forEach(row => {
        if(row.style.display === 'none' && !row.classList.contains('filtered-out')) return; 
        if(!row.classList.contains('filtered-out')) { 
            row.style.display = 'flex'; 
            totalFiltered++;
        } else { 
            row.style.display = 'none'; 
        }
    });

    if(document.getElementById('lbl-tampil-baris')) {
        document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    }
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
    if (checkedBoxes.length === 0) return alert("Pilih / centang data yang keterangannya ingin diedit!");

    const newKet = prompt(`Masukkan keterangan baru untuk ${checkedBoxes.length} data terpilih:\n(Catatan: Akan menimpa Keterangan hasil Verifikasi)`);
    if (newKet === null) return; 

    checkedBoxes.forEach(cb => {
        const div = cb.closest('.row-item');
        const ketCell = div.querySelector('.ket-cell');
        if (ketCell) {
            ketCell.innerText = newKet.trim() || '-';
            ketCell.classList.remove('italic', 'text-red-500', 'text-slate-500'); 
            ketCell.classList.add('text-slate-800'); 
        }
    });
    
    document.querySelector('#cb-all').checked = false;
    toggleSemuaCentang(false);
    alert("Keterangan berhasil diperbarui secara lokal!");
}

async function VerifikasiDanCek() {
    const rows = document.querySelectorAll('.row-item:not([style*="display: none"])');
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
            
            if(stbjMap[qr]) {
                stbjSpan.className = 'text-white font-black bg-blue-600 border-b-2 border-blue-800 px-3 py-1.5 text-[11px] stbj-val rounded-sm shadow-sm';
                stbjSpan.setAttribute('data-status', 'valid');
                stbjSpan.innerText = 'SDH STBJ';
                
                troliCell.innerText = stbjMap[qr].troli || '-';
                
                if(!ketCell.classList.contains('text-slate-800')) {
                    ketCell.innerText = stbjMap[qr].keterangan || '-';
                }
            } else {
                stbjSpan.className = 'text-white font-black bg-[#ff7315] border-b-2 border-[#cc5b0f] px-3 py-1.5 text-[11px] stbj-val rounded-sm shadow-sm';
                stbjSpan.setAttribute('data-status', 'invalid-stbj');
                stbjSpan.innerText = 'BLM STBJ';
                troliCell.innerText = '-';
                ketCell.innerText = '-';
                hasError = true;
            }

            // REVISI 1: Cek apakah Local (Duplikat Scan) atau DB (Duplikat Item)
            if(kodeSpan.innerText.includes('DUPLIKAT SCAN')) {
                hasError = true;
            } 
            else if(stokList.includes(qr)) {
                kodeSpan.className = 'text-white font-black bg-red-600 border-b-2 border-red-800 px-3 py-1.5 text-[11px] kode-val rounded-sm shadow-sm';
                kodeSpan.setAttribute('data-status', 'invalid');
                kodeSpan.innerText = 'DUPLIKAT ITEM'; // Jika dari database, tulis ITEM
                r.classList.add('bg-red-50');
                r.classList.remove('bg-white');
                hasError = true;
            } else {
                kodeSpan.className = 'text-[#0e744a] font-black bg-[#a0ecd1] border-b-2 border-[#76c2a7] px-3 py-1.5 text-[11px] kode-val rounded-sm shadow-sm';
                kodeSpan.setAttribute('data-status', 'valid');
                kodeSpan.innerText = 'ACCEPT';
                r.classList.remove('bg-red-50');
                r.classList.add('bg-white');
            }
        });

        if(hasError) { alert("PERINGATAN!\nTerdapat data bermasalah (BLM STBJ / DUPLIKAT).\nSilakan pilih data tersebut untuk dipindahkan ke HOLD LANGSIR, atau hapus."); } 
        else { alert("MANTAP!\nSemua data Valid (SDH STBJ & ACCEPT). Troli dan Keterangan berhasil ditarik. Siap disimpan ke Gudang."); }
    } catch (e) { alert("Koneksi Error: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

async function saveToSupabase() {
    const btn = document.getElementById('btn-save'); const original = btn.innerHTML;
    
    const adaYgBelumDicek = document.querySelectorAll('span[data-status="unverified"]').length > 0;
    const adaDuplikat = document.querySelectorAll('span[data-status="invalid"]').length > 0;
    const adaBelumStbj = document.querySelectorAll('span[data-status="invalid-stbj"]').length > 0;

    if(adaYgBelumDicek || adaDuplikat || adaBelumStbj) {
        return alert("GAGAL MENYIMPAN!\nTerdapat data bermasalah atau belum di-Verifikasi. Cek kembali.");
    }
    
    const rows = document.querySelectorAll('.row-item:not([style*="display: none"])'); if(rows.length === 0) return;

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
    
    alert(`BERHASIL!\n${arrFisik.length} kardus masuk.\nData berhasil terupdate.`);
    document.getElementById('tbody-langsir').innerHTML = ''; btn.innerHTML = original; btn.disabled = false;
    updateRowNumbers();
    updateTotalBaris();
}

async function holdLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if(checkedBoxes.length === 0) return alert("Anda harus mencentang data yang bermasalah terlebih dahulu.");

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
        updateTotalBaris();
        document.querySelector('#cb-all').checked = false;
        
        alert(`SUKSES!\n${payloadUpload.length} Data berhasil diasingkan ke "Hold Langsir".`);
    } catch(e) { alert("Gagal melakukan Hold: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih data yang ingin disalin dengan mencentang kotak di kiri data!");

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
    tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj').select('*').order('created_at', {ascending: false});
        if(error) throw error;
        if(!data || data.length === 0) {
            tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Data STBJ Kosong.</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            const td = translateBarcode(r.qrcode);
            let statusGudang = r.posisi || 'STBJ';
            let colGudang = statusGudang === 'IN GUDANG' ? '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded text-[10px] border border-emerald-200">IN GUDANG</span>' 
                : statusGudang === 'KELUAR' ? '<span class="bg-red-100 text-red-800 font-bold px-2 py-1 rounded text-[10px] border border-red-200">KELUAR</span>' 
                : '<span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-[10px] border border-blue-200">STBJ</span>';
            
            h += `
                <div class="row-modal-stbj bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-400 text-xs">#${i+1} - ${tgl}</span>
                        ${colGudang}
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[13px] font-bold text-slate-600 grid grid-cols-2 gap-1 mt-1">
                        <div>Troli: <span class="text-blue-600">${r.troli || '-'}</span></div>
                        <div>PO: <span class="text-orange-600">${td.po}</span></div>
                        <div class="col-span-2">Item: <span class="text-slate-800">${td.namaItem} (${td.panjang})</span></div>
                    </div>
                </div>`;
        });
        tbody.innerHTML = h;
    } catch (e) { tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal: ${e.message}</div>`; }
}

function tutupModalSTBJ() { document.getElementById('modal-stbj-langsir').classList.add('hidden'); }

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

async function bukaModalHold() {
    document.getElementById('modal-hold-langsir').classList.remove('hidden');
    const tbody = document.getElementById('tbody-hold-modal');
    tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data Hold...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hold_langsir').select('*').order('created_at', {ascending: false});
        if(error) throw error;
        if(!data || data.length === 0) {
            tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Tabel Hold Kosong.</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            h += `
                <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 text-[13px] font-bold text-slate-600">
                    <div class="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1">
                        <span class="text-slate-400 text-xs">#${i+1} - ${tgl}</span>
                        <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] uppercase">Area: ${r.area}</span>
                    </div>
                    <div class="font-mono text-slate-900 break-all">${r.qrcode}</div>
                    <div class="mt-1">Troli: <span class="text-blue-600">${r.troli || '-'}</span></div>
                    <div class="text-rose-600 leading-tight">Ket: ${r.keterangan || '-'}</div>
                </div>`;
        });
        tbody.innerHTML = h;
    } catch (e) { tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal: ${e.message}</div>`; }
}

function tutupModalHold() { document.getElementById('modal-hold-langsir').classList.add('hidden'); }
