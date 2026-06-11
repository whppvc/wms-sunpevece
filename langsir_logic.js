// File: langsir_logic.js

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
        } catch (e) { console.error("Gagal muat data master:", e); }
    }, 200); 
});

function addRow(area, code, isDuplicate = false) {
    const div = document.createElement('div'); 
    const rowClass = isDuplicate ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-slate-50';
    div.className = `row-item ${rowClass} border border-slate-300 p-2 relative shadow-sm transition w-full flex shrink-0 rounded`; 
    
    const td = typeof translateBarcode === 'function' ? translateBarcode(code) : {tglProduksi:'-', mesin:'-', shift:'-', jenisItem:'-', namaItem:'Unknown', panjang:'-', grade:'-', dus:'-', shading:'-', po:'-'}; 
    
    const stbjHtml = '<span class="text-slate-500 font-bold bg-slate-200 border border-slate-300 px-3 py-1 text-[10px] stbj-val rounded-sm shadow-sm" data-status="unverified">MENUNGGU VERIFIKASI...</span>';
    const kodeHtml = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 border border-red-800 px-3 py-1 text-[10px] kode-val rounded-sm shadow-sm" data-status="invalid">DUPLIKAT SCAN</span>'
        : '<span class="text-slate-500 font-bold bg-slate-200 border border-slate-300 px-3 py-1 text-[10px] kode-val rounded-sm shadow-sm" data-status="unverified">MENUNGGU VERIFIKASI...</span>';

    div.innerHTML = `
        <div class="flex flex-col items-center justify-start pr-2 mr-2 border-r border-slate-300 w-10 shrink-0 pt-1">
            <div class="font-black text-slate-800 text-xl mb-3 leading-none no-cell"></div>
            <input type="checkbox" onchange="highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 accent-blue-600 rounded bg-white border-slate-400">
        </div>
        
        <div class="flex-1 flex flex-col gap-0.5 w-full min-w-0">
            <div class="flex justify-between items-start mb-0.5">
                <div class="font-black text-[22px] text-emerald-700 leading-none area-cell col-area">${area}</div>
                <button onclick="deleteRow(this)" class="bg-slate-700 text-white p-1.5 rounded hover:bg-rose-600 transition active:scale-95 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
            
            <div class="font-mono font-black text-slate-900 text-[13px] break-all leading-tight qr-val col-qr">${code}</div>
            
            <div class="text-[12px] font-bold text-slate-600 tracking-tight">
                <span class="col-tgl">${td.tglProduksi}</span> - <span class="col-mesin">${td.mesin}</span> - <span class="col-shift">${td.shift}</span>
            </div>
            
            <div class="text-[13px] font-black text-slate-900 leading-snug">
                <span class="col-nama">${td.namaItem}</span> - <span class="col-pjg">${td.panjang}</span> - <span class="col-grade">${td.grade}</span> - <span class="col-dus">${td.dus}</span>
                <span class="col-jenis hidden">${td.jenisItem}</span>
            </div>
            
            <div class="text-[12px] font-bold text-blue-600 col-shading">${td.shading}</div>
            <div class="text-[12px] font-bold text-orange-600 col-po uppercase">${td.po}</div>
            
            <div class="text-[11px] font-bold text-slate-500 mt-1">Keterangan: <span class="col-ket ket-cell text-slate-700">-</span></div>
            <div class="text-[11px] font-bold text-slate-500">Troli: <span class="col-troli troli-cell text-slate-700">-</span></div>
            
            <div class="flex flex-row flex-wrap items-center gap-1.5 mt-1.5">
                ${stbjHtml}
                ${kodeHtml}
            </div>
        </div>
    `;
    
    document.getElementById('tbody-langsir').appendChild(div); 
    lucide.createIcons(); 
}

function saringTabelLangsir() {
    const f = {
        stbj: document.getElementById('f-stbj').value.toLowerCase(),
        kode: document.getElementById('f-kode').value.toLowerCase(),
        troli: document.getElementById('f-troli').value.toLowerCase(),
        area: document.getElementById('f-area').value.toLowerCase(),
        qr: document.getElementById('f-qr').value.toLowerCase()
    };

    document.querySelectorAll('.row-item').forEach(row => {
        let show = true;
        for(let key in f) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell && !cell.innerText.toLowerCase().includes(f[key])) { show = false; break; }
            }
        }
        if (show) row.classList.remove('filtered-out'); else row.classList.add('filtered-out');
    });
    updateTotalBaris();
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
    updateRowNumbers(); 
    updateTotalBaris(); 
}

function updateRowNumbers() { 
    const rows = document.querySelectorAll('#tbody-langsir .row-item:not([style*="display: none"])'); 
    let count = 1; 
    rows.forEach(div => { 
        const noCell = div.querySelector('.no-cell');
        if(noCell) noCell.innerText = count++; 
    }); 
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

    const lbl = document.getElementById('lbl-tampil-baris');
    if(lbl) lbl.innerText = totalFiltered;
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
    if (checkedBoxes.length === 0) return alert("Pilih data yang keterangannya ingin diedit!");

    const newKet = prompt(`Masukkan keterangan baru:\n(Akan menimpa Keterangan Verifikasi)`);
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
}

async function VerifikasiDanCek() {
    const rows = document.querySelectorAll('.row-item:not([style*="display: none"])');
    if(rows.length === 0) return alert("Belum ada data untuk diVerifikasi.");
    
    const btn = document.getElementById('btn-Verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i>'; btn.disabled = true;
    
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
                stbjSpan.className = 'text-white font-bold bg-blue-600 border border-blue-800 px-3 py-1 text-[10px] stbj-val rounded shadow-sm';
                stbjSpan.setAttribute('data-status', 'valid');
                stbjSpan.innerText = 'SDH STBJ';
                troliCell.innerText = stbjMap[qr].troli || '-';
                if(!ketCell.classList.contains('text-slate-800')) ketCell.innerText = stbjMap[qr].keterangan || '-';
            } else {
                stbjSpan.className = 'text-white font-bold bg-[#ff7315] border border-[#cc5b0f] px-3 py-1 text-[10px] stbj-val rounded shadow-sm';
                stbjSpan.setAttribute('data-status', 'invalid-stbj');
                stbjSpan.innerText = 'BLM STBJ';
                troliCell.innerText = '-'; ketCell.innerText = '-'; hasError = true;
            }

            if(kodeSpan.innerText.includes('DUPLIKAT SCAN')) {
                hasError = true;
            } 
            else if(stokList.includes(qr)) {
                kodeSpan.className = 'text-white font-bold bg-red-600 border border-red-800 px-3 py-1 text-[10px] kode-val rounded shadow-sm';
                kodeSpan.setAttribute('data-status', 'invalid');
                kodeSpan.innerText = 'DUPLIKAT ITEM';
                r.classList.add('bg-red-50');
                r.classList.remove('bg-white');
                hasError = true;
            } else {
                kodeSpan.className = 'text-[#0e744a] font-bold bg-[#a0ecd1] border border-[#76c2a7] px-3 py-1 text-[10px] kode-val rounded shadow-sm';
                kodeSpan.setAttribute('data-status', 'valid');
                kodeSpan.innerText = 'ACCEPT';
                r.classList.remove('bg-red-50');
                r.classList.add('bg-white');
            }
        });

        if(hasError) { alert("PERINGATAN!\nTerdapat data bermasalah. Pindahkan ke HOLD LANGSIR, atau hapus."); } 
        else { alert("MANTAP!\nSemua data Valid. Siap disimpan."); }
    } catch (e) { alert("Koneksi Error: " + e.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

async function saveToSupabase() {
    const btn = document.getElementById('btn-save'); const original = btn.innerHTML;
    const adaYgBelumDicek = document.querySelectorAll('span[data-status="unverified"]').length > 0;
    const adaDuplikat = document.querySelectorAll('span[data-status="invalid"]').length > 0;
    const adaBelumStbj = document.querySelectorAll('span[data-status="invalid-stbj"]').length > 0;

    if(adaYgBelumDicek || adaDuplikat || adaBelumStbj) {
        return alert("GAGAL MENYIMPAN!\nTerdapat data bermasalah atau belum di-Verifikasi.");
    }
    
    const rows = document.querySelectorAll('.row-item:not([style*="display: none"])'); if(rows.length === 0) return;

    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i>'; btn.disabled = true;
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    let arrFisik = []; let mapAktual = {}; let mapGlobal = {}; 

    rows.forEach(r => {
        let area = r.querySelector('.area-cell').innerText; let qr = r.querySelector('.qr-val').innerText;
        let jenis = r.querySelector('.col-jenis').innerText; let nama = r.querySelector('.col-nama').innerText;
        let pjg = r.querySelector('.col-pjg').innerText; let grade = r.querySelector('.col-grade').innerText;
        let dus = r.querySelector('.col-dus').innerText; let shading = r.querySelector('.col-shading').innerText; 
        let po = r.querySelector('.col-po').innerText; let ket = r.querySelector('.col-ket').innerText;
        
        let td = typeof translateBarcode === 'function' ? translateBarcode(qr) : { po: po };
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
    
    alert(`BERHASIL!\n${arrFisik.length} kardus masuk.`);
    document.getElementById('tbody-langsir').innerHTML = ''; btn.innerHTML = original; btn.disabled = false;
    updateRowNumbers();
    updateTotalBaris();
}

async function holdLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if(checkedBoxes.length === 0) return alert("Anda harus mencentang data yang bermasalah terlebih dahulu.");

    const btn = document.getElementById('btn-menu-utama'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i>'; btn.disabled = true;

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
    if(cek.length === 0) return alert("Pilih data yang ingin disalin!");

    let copyString = "Area\tQRCode\tTgl Produksi\tMesin\tShift\tNama Item\tPjg\tGrade\tDus\tShading\tPO\tKeterangan\n";
    
    cek.forEach(cb => {
        const div = cb.closest('.row-item');
        copyString += `${div.querySelector('.col-area').innerText}\t${div.querySelector('.col-qr').innerText}\t${div.querySelector('.col-tgl').innerText}\t${div.querySelector('.col-mesin').innerText}\t${div.querySelector('.col-shift').innerText}\t${div.querySelector('.col-nama').innerText}\t${div.querySelector('.col-pjg').innerText}\t${div.querySelector('.col-grade').innerText}\t${div.querySelector('.col-dus').innerText}\t${div.querySelector('.col-shading').innerText}\t${div.querySelector('.col-po').innerText}\t${div.querySelector('.col-ket').innerText}\n`;
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert("Berhasil menyalin!");
    }).catch(err => { alert("Gagal menyalin."); });
}
