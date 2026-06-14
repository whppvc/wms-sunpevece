let masterData = { kamus: [], area: [] }; 
let deleteStack = []; 

// Fungsi Global untuk Modal & Dropdown
window.toggleMenuUtama = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropdown-menu');
    if(menu) menu.classList.toggle('hidden');
};

window.bukaModalAdd = function() {
    document.getElementById('modal-add-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qrcode').focus(), 100);
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
};

window.toggleSidebarFilter = function() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
};

window.tutupModalSTBJ = function() {
    document.getElementById('modal-stbj-langsir').classList.add('hidden');
};

window.tutupModalHold = function() {
    document.getElementById('modal-hold-langsir').classList.add('hidden');
};

window.tutupSemuaPopup = function() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    window.tutupModalSTBJ();
    window.tutupModalHold();
    const menu = document.getElementById('dropdown-menu');
    if(menu) menu.classList.add('hidden');
};

window.resetFilter = function() {
    ['f-stbj','f-kode','f-troli','f-area','f-qr','f-tgl','f-mesin','f-shift','f-jenis','f-nama','f-pjg','f-grade','f-dus','f-shading','f-po','f-ket'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    saringTabelLangsir();
    toggleSidebarFilter();
};

document.addEventListener('click', function(e) {
    const menu = document.getElementById('dropdown-menu');
    const btn = document.getElementById('btn-menu-utama');
    if (menu && !menu.classList.contains('hidden')) {
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.classList.add('hidden');
        }
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    if(typeof initModernLayout === 'function') initModernLayout({ id: 'langsir', title: 'LANGSIR', url: 'langsir.html' }); 
    
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawInput = document.getElementById('input-qrcode').value.trim();
            const area = document.getElementById('select-area').value;
            if(!area || !rawInput) return alert("Pilih Area Simpan dan isi QR Code terlebih dahulu!");
            
            const activeRows = Array.from(document.querySelectorAll('.row-item:not(.deleted-row)'));
            const existingQRs = activeRows.map(r => r.querySelector('.qr-val').innerText);
            
            const codes = rawInput.split(/[\s;]+/).map(q => q.trim()).filter(q => q);
            
            codes.forEach(code => { 
                const isLocalDuplicate = existingQRs.includes(code);
                addRow(area, code, isLocalDuplicate); 
                if(!isLocalDuplicate) existingQRs.push(code); 
            });
            
            updateRowNumbers();
            updateTotalBaris();
            
            document.getElementById('input-qrcode').value = '';
            if(typeof tutupModalAdd === 'function') tutupModalAdd(); 
            
            const scrollContainer = document.getElementById('scroll-container');
            if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
    }

    setTimeout(async () => {
        try {
            const { data: mDataArea } = await db.from('master_area').select('*').order('id', { ascending: true });
            if(mDataArea) {
                masterData.area = [...new Set(mDataArea.map(r => (r.nama_area || r.area || '').trim()).filter(Boolean))]; 
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
    div.className = `row-item ${rowClass} border-b border-slate-300 p-2.5 relative transition w-full flex shrink-0`; 
    
    const td = typeof translateBarcode === 'function' ? translateBarcode(code) : {tglProduksi:'-', mesin:'-', shift:'-', jenisItem:'-', namaItem:'Unknown', panjang:'-', grade:'-', dus:'-', shading:'-', po:'-'}; 
    
    const stbjHtml = '<span class="text-slate-500 font-bold bg-slate-200 border border-slate-300 px-3 py-1 text-[10px] stbj-val rounded-sm" data-status="unverified">MENUNGGU VERIFIKASI...</span>';
    const kodeHtml = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 border border-red-800 px-3 py-1 text-[10px] kode-val rounded-sm shadow-sm" data-status="invalid">DUPLIKAT SCAN</span>'
        : '<span class="text-slate-500 font-bold bg-slate-200 border border-slate-300 px-3 py-1 text-[10px] kode-val rounded-sm" data-status="unverified">MENUNGGU VERIFIKASI...</span>';

    div.innerHTML = `
        <div class="flex flex-col items-center justify-start pr-2 mr-2 border-r border-slate-300 w-10 shrink-0 pt-1">
            <div class="font-black text-slate-800 text-xl mb-3 leading-none no-cell"></div>
            <input type="checkbox" onchange="highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 accent-blue-600 rounded bg-white border-slate-400">
        </div>
        
        <div class="flex-1 flex flex-col gap-0 w-full min-w-0">
            <div class="flex justify-between items-start mb-0.5">
                <div class="font-black text-[22px] text-emerald-700 leading-none area-cell col-area">${area}</div>
                <button onclick="deleteRow(this)" class="bg-slate-700 text-white p-1.5 rounded hover:bg-rose-600 transition active:scale-95 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
            
            <div class="font-mono font-black text-slate-900 text-[13px] break-all leading-tight qr-val col-qr">${code}</div>
            
            <div class="text-[12px] font-bold text-slate-600 tracking-tight">
                <span class="col-tgl">${td.tglProduksi}</span> - <span class="col-mesin">${td.mesin}</span> - <span class="col-shift">${td.shift}</span>
            </div>
            
            <div class="text-[13px] font-black text-slate-900 leading-snug my-0.5">
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
        if(row.classList.contains('deleted-row')) return; 
        
        let show = true;
        for(let key in f) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell && !cell.innerText.toLowerCase().includes(f[key])) { show = false; break; }
            }
        }
        
        if (show) {
            row.classList.remove('filtered-out');
            row.style.display = 'flex';
        } else {
            row.classList.add('filtered-out');
            row.style.display = 'none';
        }
    });
    updateTotalBaris();
}

function deleteRow(btn) { 
    const div = btn.closest('.row-item'); 
    deleteStack.push(div); 
    div.classList.add('deleted-row'); 
    div.style.display = 'none'; 
    updateRowNumbers(); 
    updateTotalBaris(); 
}

function undoDelete() { 
    if(deleteStack.length === 0) return alert("Belum ada data yang dihapus."); 
    const div = deleteStack.pop(); 
    div.classList.remove('deleted-row'); 
    saringTabelLangsir(); 
    updateRowNumbers(); 
}

function updateRowNumbers() { 
    const rows = document.querySelectorAll('#tbody-langsir .row-item:not(.deleted-row):not(.filtered-out)'); 
    let count = 1; 
    rows.forEach(div => { 
        const noCell = div.querySelector('.no-cell');
        if(noCell) noCell.innerText = count++; 
    }); 
}

function updateTotalBaris() {
    const visibleRows = document.querySelectorAll('#tbody-langsir .row-item:not(.deleted-row):not(.filtered-out)').length;
    const lbl = document.getElementById('lbl-tampil-baris');
    if(lbl) lbl.innerText = visibleRows;
}

function toggleSemuaCentang(checked) {
    document.querySelectorAll('.cb-row').forEach(cb => {
        const row = cb.closest('.row-item');
        if (row && !row.classList.contains('deleted-row') && !row.classList.contains('filtered-out')) {
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
    const rows = document.querySelectorAll('.row-item:not(.deleted-row):not(.filtered-out)');
    if(rows.length === 0) return alert("Belum ada data untuk diVerifikasi.");
    
    const btn = document.getElementById('btn-Verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 text-white"></i>'; btn.disabled = true;
    
    const qrs = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    try {
        const [resGlobal, resHold, resStok] = await Promise.all([
            db.from('stok_global').select('qrcode, troli, keterangan').in('qrcode', qrs),
            db.from('hold_stbj').select('qrcode, troli, keterangan').in('qrcode', qrs),
            db.from('stok_qr').select('qrcode').in('qrcode', qrs)
        ]);

        if(resGlobal.error) throw resGlobal.error;
        if(resHold.error) throw resHold.error;
        if(resStok.error) throw resStok.error;

        const globalMap = {}; resGlobal.data.forEach(d => globalMap[d.qrcode] = d);
        const holdMap = {}; resHold.data.forEach(d => holdMap[d.qrcode] = d);
        const stokList = resStok.data.map(d => d.qrcode);
        let hasError = false;

        rows.forEach(r => {
            const qr = r.querySelector('.qr-val').innerText;
            const stbjSpan = r.querySelector('.stbj-val');
            const kodeSpan = r.querySelector('.kode-val');
            const troliCell = r.querySelector('.troli-cell');
            const ketCell = r.querySelector('.ket-cell');
            
            if(globalMap[qr]) {
                stbjSpan.className = 'text-slate-900 font-bold bg-teal-100 border border-teal-300 px-3 py-1 text-[10px] stbj-val rounded-sm shadow-sm';
                stbjSpan.setAttribute('data-status', 'valid');
                stbjSpan.innerText = 'SUDAH STBJ';
                troliCell.innerText = globalMap[qr].troli || '-';
                if(!ketCell.classList.contains('text-slate-800')) ketCell.innerText = globalMap[qr].keterangan || '-';
            } else if (holdMap[qr]) {
                stbjSpan.className = 'text-white font-bold bg-amber-500 border border-amber-600 px-3 py-1 text-[10px] stbj-val rounded-sm shadow-sm';
                stbjSpan.setAttribute('data-status', 'invalid-stbj');
                stbjSpan.innerText = 'HOLD';
                troliCell.innerText = holdMap[qr].troli || '-';
                if(!ketCell.classList.contains('text-slate-800')) ketCell.innerText = holdMap[qr].keterangan || '-';
                hasError = true;
            } else {
                stbjSpan.className = 'text-white font-bold bg-orange-500 border border-orange-600 px-3 py-1 text-[10px] stbj-val rounded-sm shadow-sm';
                stbjSpan.setAttribute('data-status', 'invalid-stbj');
                stbjSpan.innerText = 'BELUM STBJ';
                troliCell.innerText = '-'; ketCell.innerText = '-'; hasError = true;
            }

            if(kodeSpan.innerText.includes('DUPLIKAT SCAN')) {
                hasError = true;
            } 
            else if(stokList.includes(qr)) {
                kodeSpan.className = 'text-white font-bold bg-red-600 border border-red-800 px-3 py-1 text-[10px] kode-val rounded-sm shadow-sm';
                kodeSpan.setAttribute('data-status', 'invalid');
                kodeSpan.innerText = 'DUPLIKAT DATA';
                r.classList.add('bg-red-50');
                r.classList.remove('bg-white');
                hasError = true;
            } else {
                kodeSpan.className = 'text-[#0e744a] font-bold bg-[#a0ecd1] border border-[#76c2a7] px-3 py-1 text-[10px] kode-val rounded-sm shadow-sm';
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

// =====================================================================
// REVISI: LOGICAL ALLOCATION (INCREMENTAL UPDATE) UNTUK STOK AKTUAL
// =====================================================================
async function saveToSupabase() {
    const btn = document.getElementById('btn-save'); const original = btn.innerHTML;
    
    const activeRows = Array.from(document.querySelectorAll('.row-item:not(.deleted-row)'));
    if(activeRows.length === 0) return;

    let adaYgBelumDicek = false;
    let adaDuplikat = false;
    let adaBelumStbj = false;

    activeRows.forEach(r => {
        const stbjStatus = r.querySelector('.stbj-val').getAttribute('data-status');
        const kodeStatus = r.querySelector('.kode-val').getAttribute('data-status');
        
        if(stbjStatus === 'unverified' || kodeStatus === 'unverified') adaYgBelumDicek = true;
        if(stbjStatus === 'invalid-stbj') adaBelumStbj = true;
        if(kodeStatus === 'invalid') adaDuplikat = true;
    });

    if(adaYgBelumDicek || adaDuplikat || adaBelumStbj) {
        return alert("GAGAL MENYIMPAN!\nTerdapat data bermasalah atau belum di-Verifikasi pada baris yang aktif.");
    }

    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENYIMPAN...'; btn.disabled = true;
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    
    let arrFisik = []; 
    let arrHasilLangsir = []; 
    let mapAktual = {}; // Untuk Incremental Update stok_aktual

    activeRows.forEach(r => {
        let area = r.querySelector('.area-cell').innerText; 
        let qr = r.querySelector('.qr-val').innerText;
        let jenis = r.querySelector('.col-jenis').innerText; 
        let nama = r.querySelector('.col-nama').innerText;
        let pjg = r.querySelector('.col-pjg').innerText; 
        let grade = r.querySelector('.col-grade').innerText;
        let dus = r.querySelector('.col-dus').innerText; 
        let shading = r.querySelector('.col-shading').innerText; 
        let po = r.querySelector('.col-po').innerText; 
        let ket = r.querySelector('.ket-cell').innerText;
        let troli = r.querySelector('.troli-cell').innerText;
        
        let tgl_produksi = r.querySelector('.col-tgl').innerText;
        let mesin = r.querySelector('.col-mesin').innerText;
        let shift = r.querySelector('.col-shift').innerText;
        
        let id_sku = `${area}_${nama}_${pjg}_${grade}_${dus}_${shading}_${po}_${ket}`;
        
        arrFisik.push({ 
            qrcode: qr, 
            area: area, 
            id_sku: id_sku, 
            tgl_produksi: tgl_produksi,
            mesin: mesin,
            shift: shift,
            jenis_item: jenis,
            nama_item: nama,
            panjang: pjg, 
            grade: grade,
            dus: dus,
            shading: shading,
            po_bawaan: po,
            keterangan: ket,
            pic_input: user.username 
        });

        arrHasilLangsir.push({
            qrcode: qr,
            area: area,
            troli: troli,
            tgl_produksi: tgl_produksi,
            mesin: mesin,
            shift: shift,
            jenis_item: jenis,
            nama_item: nama,
            panjang: pjg,
            grade: grade,
            dus: dus,
            shading: shading,
            po_bawaan: po,
            keterangan: ket,
            pic_input: user.username
        });

        // Siapkan data untuk stok_aktual (PO Aktual = PO Bawaan)
        let keyAkt = `${nama}_${pjg}_${grade}_${dus}_${shading}_${area}_${po}_${ket}`;
        if(!mapAktual[keyAkt]) {
            mapAktual[keyAkt] = {
                id_sku: id_sku, 
                jenis_item: jenis, 
                nama_item: nama, 
                panjang: pjg, 
                grade: grade,
                dus: dus, 
                shading: shading, 
                area: area, 
                po_bawaan: po, 
                po_aktual: po, // <--- KUNCI LOGICAL ALLOCATION
                keterangan: ket, 
                qty: 0
            };
        }
        mapAktual[keyAkt].qty++;
    });

    try {
        // 1. Insert ke stok_qr
        const { error: errInsert } = await db.from('stok_qr').insert(arrFisik);
        if (errInsert) throw errInsert;

        // 2. Insert ke hasil_langsir
        const { error: errLangsir } = await db.from('hasil_langsir').insert(arrHasilLangsir);
        if (errLangsir) throw errLangsir;

        // 3. Incremental Update ke stok_aktual
        for(let key in mapAktual) {
            let item = mapAktual[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('po_aktual', item.po_aktual).eq('keterangan', item.keterangan).limit(1);

            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + item.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([item]);
            }
        }

        alert(`BERHASIL!\n${arrFisik.length} kardus masuk ke Gudang & Riwayat Langsir.`);
        document.getElementById('tbody-langsir').innerHTML = ''; 
        updateRowNumbers();
        updateTotalBaris();
    } catch (error) { 
        alert("GAGAL SERVER: " + error.message); 
    } finally {
        btn.innerHTML = original; 
        btn.disabled = false; 
    }
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
        
        const tgl_produksi = div.querySelector('.col-tgl').innerText;
        const mesin = div.querySelector('.col-mesin').innerText;
        const shift = div.querySelector('.col-shift').innerText;
        const jenis = div.querySelector('.col-jenis').innerText;
        const nama = div.querySelector('.col-nama').innerText;
        const pjg = div.querySelector('.col-pjg').innerText;
        const grade = div.querySelector('.col-grade').innerText;
        const dus = div.querySelector('.col-dus').innerText;
        const shading = div.querySelector('.col-shading').innerText;
        const po = div.querySelector('.col-po').innerText;

        payloadUpload.push({
            qrcode: qr, troli: troli, area: area,
            tgl_produksi: tgl_produksi, mesin: mesin, shift: shift,
            jenis_item: jenis, nama_item: nama, panjang: pjg, grade: grade,
            dus: dus, shading: shading, po_bawaan: po,
            keterangan: `STBJ: ${ketStbj} | KODE: ${ketKode} | Ket User: ${noteKet}`,
            pic_input: user.username
        });
    });

    try {
        const { error } = await db.from('hold_langsir').insert(payloadUpload);
        if(error) throw error;
        
        checkedBoxes.forEach(cb => { 
            const div = cb.closest('.row-item');
            deleteStack.push(div); 
            div.classList.add('deleted-row');
            div.style.display = 'none'; 
        });
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
        copyString += `${div.querySelector('.col-area').innerText}\t${div.querySelector('.col-qr').innerText}\t${div.querySelector('.col-tgl').innerText}\t${div.querySelector('.col-mesin').innerText}\t${div.querySelector('.col-shift').innerText}\t${div.querySelector('.col-nama').innerText}\t${div.querySelector('.col-pjg').innerText}\t${div.querySelector('.col-grade').innerText}\t${div.querySelector('.col-dus').innerText}\t${div.querySelector('.col-shading').innerText}\t${div.querySelector('.col-po').innerText}\t${div.querySelector('.ket-cell').innerText}\n`;
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert("Berhasil menyalin!");
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
}

async function bukaModalSTBJ() {
    const mStbj = document.getElementById('modal-stbj-langsir'); if(mStbj) mStbj.classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</div>';
    lucide.createIcons();

    try {
        const { data: globalData, error: errGlobal } = await db.from('stok_global').select('*').order('created_at', {ascending: false}).limit(200);
        if(errGlobal) throw errGlobal;
        
        if(!globalData || globalData.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Data STBJ Kosong.</div>';
            return;
        }

        const qrs = globalData.map(d => d.qrcode);
        const { data: qrData, error: errQr } = await db.from('stok_qr').select('qrcode').in('qrcode', qrs);
        if(errQr) throw errQr;

        const qrSet = new Set(qrData.map(d => d.qrcode));
        const filteredData = globalData.filter(d => !qrSet.has(d.qrcode));

        if(filteredData.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Semua data STBJ sudah masuk gudang.</div>';
            return;
        }

        let h = '';
        filteredData.forEach((r, i) => {
            let tgl = '-';
            if (r.created_at) {
                const dt = new Date(r.created_at);
                const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                tgl = `${dt.getDate()} ${months[dt.getMonth()]}, ${String(dt.getHours()).padStart(2,'0')}.${String(dt.getMinutes()).padStart(2,'0')}`;
            }

            h += `
                <div class="row-modal-stbj bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-[10px] border border-blue-200">STBJ</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${r.tgl_produksi || '-'} - ${r.mesin || '-'} - ${r.shift || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${r.jenis_item || '-'}</span> | <span class="text-slate-800">${r.nama_item || '-'}</span> | <span class="text-slate-800">${r.panjang || '-'}</span> | <span class="text-slate-800">${r.grade || '-'}</span> | <span class="text-slate-800">${r.dus || '-'}</span> | <span class="text-blue-600">${r.shading || '-'}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">PO: <span class="text-orange-600">${r.po_bawaan || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Keterangan: <span class="text-slate-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
}

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

async function bukaModalHold(tabelTarget = 'hold_stbj') {
    const mHold = document.getElementById('modal-hold-langsir'); if(mHold) mHold.classList.remove('hidden');
    
    const tabStbj = document.getElementById('tab-hold-stbj');
    const tabLangsir = document.getElementById('tab-hold-langsir');
    
    if(tabelTarget === 'hold_stbj') {
        tabStbj.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabLangsir.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
    } else {
        tabLangsir.className = 'pb-2 px-4 tab-active transition whitespace-nowrap text-xs uppercase font-bold';
        tabStbj.className = 'pb-2 px-4 tab-inactive hover:text-slate-800 transition whitespace-nowrap text-xs uppercase font-bold';
    }

    const tbody = document.getElementById('tbody-hold-modal');
    if(tbody) tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data Hold...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from(tabelTarget).select('*').order('created_at', {ascending: false}).limit(100);
        if(error) throw error;
        if(!data || data.length === 0) {
            if(tbody) tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Tabel Hold Kosong.</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            let tgl = '-';
            if (r.created_at) {
                const dt = new Date(r.created_at);
                const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
                tgl = `${dt.getDate()} ${months[dt.getMonth()]}, ${String(dt.getHours()).padStart(2,'0')}.${String(dt.getMinutes()).padStart(2,'0')}`;
            }

            let namaItem = r.nama_item || '-';
            let pjg = r.panjang || '-';
            let grade = r.grade || '-';
            let dus = r.dus || '-';
            let shading = r.shading || '-';
            let po = r.po_bawaan || '-';
            let jenis = r.jenis_item || '-';
            let prod = r.tgl_produksi || '-';
            let mesin = r.mesin || '-';
            let shift = r.shift || '-';

            if(tabelTarget === 'hold_langsir' && namaItem === '-') {
                let td = typeof translateBarcode === 'function' ? translateBarcode(r.qrcode) : {};
                namaItem = td.namaItem || '-'; pjg = td.panjang || '-'; grade = td.grade || '-';
                dus = td.dus || '-'; shading = td.shading || '-'; po = td.po || '-';
                jenis = td.jenisItem || '-'; prod = td.tglProduksi || '-'; mesin = td.mesin || '-'; shift = td.shift || '-';
            }

            h += `
                <div class="row-modal-hold bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 mb-3">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-500 text-xs">#${i+1} - ${tgl}</span>
                        <span class="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] border border-amber-200">HOLD</span>
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[12px] font-bold text-slate-600 mt-1">Troli: <span class="text-slate-800">${r.troli || '-'}</span></div>
                    <div class="text-[12px] font-bold text-slate-600">Produksi: <span class="text-slate-800">${prod} - ${mesin} - ${shift}</span></div>
                    <div class="text-[12px] font-bold text-slate-600 leading-snug">
                        Item: <span class="text-blue-600">${jenis}</span> | <span class="text-slate-800">${namaItem}</span> | <span class="text-slate-800">${pjg}</span> | <span class="text-slate-800">${grade}</span> | <span class="text-slate-800">${dus}</span> | <span class="text-blue-600">${shading}</span>
                    </div>
                    <div class="text-[12px] font-bold text-slate-600">PO: <span class="text-orange-600">${po}</span></div>
                    <div class="text-[12px] font-bold text-rose-600">Keterangan: <span class="text-rose-800">${r.keterangan || '-'}</span></div>
                </div>`;
        });
        if(tbody) tbody.innerHTML = h;
    } catch (e) { if(tbody) tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
}
