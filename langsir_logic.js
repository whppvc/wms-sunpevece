let masterData = { kamus: [], troli: [], area: [] };
let deleteStack = [], globalRowId = 0;
let hiddenCols = [];

// Definisi Kolom Hide/Unhide
const colDefinitions = [
    { id: 'col-btn', label: 'Action Hapus', default: true },
    { id: 'col-stbj', label: 'Status STBJ', default: true },
    { id: 'col-kode', label: 'Status Kode', default: true },
    { id: 'col-troli', label: 'Troli', default: true },
    { id: 'col-area', label: 'Area', default: true },
    { id: 'col-qr', label: 'QRCode', default: true },
    { id: 'col-tgl', label: 'Tgl Produksi', default: true },
    { id: 'col-mesin', label: 'Mesin', default: true },
    { id: 'col-shift', label: 'Shift', default: true },
    { id: 'col-jenis', label: 'Jenis Item', default: true },
    { id: 'col-nama', label: 'Nama Item', default: true },
    { id: 'col-pjg', label: 'Pjg', default: true },
    { id: 'col-grade', label: 'Grade', default: true },
    { id: 'col-dus', label: 'Dus', default: true },
    { id: 'col-shading', label: 'Shading', default: true },
    { id: 'col-po', label: 'PO Awal', default: true }
];

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        try {
            const { data: mData1 } = await db.from('master_1').select('nama_troli').order('id', { ascending: true });
            if(mData1) {
                masterData.troli = [...new Set(mData1.map(r => r.nama_troli).filter(x => x && x.trim() !== ''))]; 
                const selTroli = document.getElementById('select-troli');
                if(selTroli) { selTroli.innerHTML = '<option value="">-- Pilih Troli --</option>'; masterData.troli.forEach(t => selTroli.innerHTML += `<option value="${t}">${t}</option>`); }
            }
            
            const { data: mDataArea } = await db.from('master_area').select('nama_area').order('id', { ascending: true });
            if(mDataArea) {
                masterData.area = [...new Set(mDataArea.map(r => r.nama_area).filter(x => x && x.trim() !== ''))]; 
                const selArea = document.getElementById('select-area');
                if(selArea) { selArea.innerHTML = '<option value="">-- Pilih Area --</option>'; masterData.area.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`); }
            }

            const { data: mData2 } = await db.from('master_2').select('*');
            if(mData2) masterData.kamus = mData2; 

            buatDropdownKolom();
        } catch (e) { console.error("Gagal muat dropdown:", e); }
    }, 200); 
});

// --- SISTEM HIDE/UNHIDE KOLOM ---
function buatDropdownKolom() {
    const container = document.getElementById('list-kolom-toggles');
    if(!container) return;
    let html = '';
    colDefinitions.forEach(col => {
        html += `
            <label class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded">
                <input type="checkbox" checked onchange="toggleKolom('${col.id}', this.checked)" class="w-4 h-4 cursor-pointer text-blue-600 rounded border-slate-300 focus:ring-blue-500">
                <span class="text-xs font-bold text-slate-700">${col.label}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

function toggleKolom(colId, isVisible) {
    if(isVisible) { hiddenCols = hiddenCols.filter(id => id !== colId); } 
    else { if(!hiddenCols.includes(colId)) hiddenCols.push(colId); }
    terapkanStyleKolom();
}

function resetKolom() {
    hiddenCols = [];
    document.querySelectorAll('#list-kolom-toggles input[type="checkbox"]').forEach(cb => cb.checked = true);
    terapkanStyleKolom();
}

function terapkanStyleKolom() {
    const cssString = hiddenCols.map(id => `.${id} { display: none !important; }`).join('\n');
    document.getElementById('dynamic-col-styles').innerHTML = cssString;
}

// --- SCANNER LOGIC ---
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
                const troli = document.getElementById('select-troli').value;
                const area = document.getElementById('select-area').value;
                if(!troli || !area || !rawInput) return alert("Pilih Troli, Area, dan isi QR Code!");
                
                const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
                const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
                
                codes.forEach(code => { 
                    const isLocalDuplicate = existingQRs.includes(code);
                    addRow(troli, area, code, isLocalDuplicate); 
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

function addRow(troli, area, code, isDuplicate = false) {
    globalRowId++; const tr = document.createElement('tr'); 
    
    // Baris kembar lokal langsung merah background-nya
    const rowClass = isDuplicate ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-slate-50';
    tr.className = `border-b border-slate-200 transition row-item ${rowClass}`; 
    
    const td = translateBarcode(code); 
    
    const stbjHtml = '<span class="text-slate-400 font-bold stbj-val" data-status="unverified">-</span>';
    const kodeHtml = isDuplicate 
        ? '<span class="text-white font-bold bg-red-600 px-2 py-1 text-[10px] rounded kode-val shadow-sm" data-status="invalid">DUPLIKAT LOKAL</span>'
        : '<span class="text-slate-400 font-bold kode-val" data-status="unverified">-</span>';

    tr.innerHTML = `
        <td class="p-3"><input type="checkbox" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
        <td class="p-3 text-center col-btn"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer p-1.5 rounded bg-white shadow-sm border border-slate-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        <td class="p-3 font-bold no-cell text-center text-slate-500"></td>
        <td class="p-3 font-bold text-center border-r border-slate-200 col-stbj">${stbjHtml}</td>
        <td class="p-3 font-bold text-center border-r border-slate-200 col-kode">${kodeHtml}</td>
        <td class="p-3 troli-cell font-bold text-slate-700 col-troli">${troli}</td>
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
        <td class="p-3 font-black text-center text-orange-600 bg-orange-50/50 col-po">${td.po}</td>`;
    
    document.getElementById('tbody-langsir').prepend(tr); lucide.createIcons(); updateRowNumbers();
}

function deleteRow(btn) { const tr = btn.closest('tr'); deleteStack.push({ parent: tr.parentNode, html: tr.outerHTML, nextSibling: tr.nextSibling }); tr.remove(); updateRowNumbers(); }
function undoDelete() { if(deleteStack.length === 0) return; const last = deleteStack.pop(); const temp = document.createElement('tbody'); temp.innerHTML = last.html; if (last.nextSibling) last.parent.insertBefore(temp.firstChild, last.nextSibling); else last.parent.appendChild(temp.firstChild); lucide.createIcons(); updateRowNumbers(); }
function updateRowNumbers() { const rows = document.querySelectorAll('.row-item'); let count = rows.length; rows.forEach(tr => { tr.querySelector('.no-cell').innerText = count--; }); }

// --- FUNGSI GABUNGAN: VALIDASI STBJ & CEK KODE DB ---
async function validasiDanCek() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk divalidasi.");
    
    const btn = document.getElementById('btn-validasi');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMERIKSA DATA...'; btn.disabled = true;
    
    const qrs = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    try {
        // Lakukan 2 Fetch Database secara bersamaan / berbarengan (Sangat Cepat)
        const [resStbj, resStok] = await Promise.all([
            db.from('hasil_stbj').select('qrcode').in('qrcode', qrs),
            db.from('stok_qr').select('qrcode').in('qrcode', qrs)
        ]);

        if(resStbj.error) throw resStbj.error;
        if(resStok.error) throw resStok.error;

        const stbjList = resStbj.data.map(d => d.qrcode);
        const stokList = resStok.data.map(d => d.qrcode);

        let hasError = false;

        rows.forEach(r => {
            const qr = r.querySelector('.qr-val').innerText;
            const stbjCell = r.querySelector('.stbj-val');
            const kodeCell = r.querySelector('.kode-val');
            
            // 1. UPDATE STATUS STBJ
            if(stbjList.includes(qr)) {
                stbjCell.innerHTML = '<span class="text-white font-bold bg-blue-600 px-3 py-1.5 rounded shadow-sm text-[10px]" data-status="valid">SDH STBJ</span>';
            } else {
                stbjCell.innerHTML = '<span class="text-white font-bold bg-orange-500 px-3 py-1.5 rounded shadow-sm text-[10px]" data-status="invalid-stbj">BLM STBJ</span>';
                hasError = true;
            }

            // 2. UPDATE STATUS KODE
            // Amankan Duplikat Lokal (agar tak ditimpa menjadi Accept)
            if(kodeCell.innerText.includes('LOKAL')) {
                hasError = true;
            } 
            else if(stokList.includes(qr)) {
                kodeCell.innerHTML = '<span class="text-white font-black bg-red-600 px-3 py-1.5 rounded shadow-sm text-[10px] tracking-wide" data-status="invalid">DUPLIKAT</span>';
                r.classList.add('bg-red-50');
                hasError = true;
            } else {
                kodeCell.innerHTML = '<span class="text-emerald-700 font-black bg-emerald-100 border border-emerald-300 px-3 py-1 rounded shadow-sm text-[10px]" data-status="valid">ACCEPT</span>';
                r.classList.remove('bg-red-50');
            }
        });

        if(hasError) {
            alert("PERINGATAN!\nTerdapat data bermasalah (BLM STBJ / DUPLIKAT).\nSilakan pilih baris tersebut untuk dipindahkan ke HOLD LANGSIR, atau hapus barisnya.");
        } else {
            alert("MANTAP!\nSemua baris Valid (SDH STBJ & ACCEPT). Siap disimpan ke Gudang.");
        }
    } catch (e) {
        alert("Koneksi Error: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
}

// --- FUNGSI TOLAK SIMPAN OTOMATIS ---
async function saveToSupabase() {
    const btn = document.getElementById('btn-save'); const original = btn.innerHTML;
    
    const adaYgBelumDicek = document.querySelectorAll('span[data-status="unverified"]').length > 0;
    const adaDuplikat = document.querySelectorAll('span[data-status="invalid"]').length > 0;
    const adaBelumStbj = document.querySelectorAll('span[data-status="invalid-stbj"]').length > 0;

    if(adaYgBelumDicek || adaDuplikat || adaBelumStbj) {
        return alert("GAGAL MENYIMPAN!\n\nTerdapat baris yang bermasalah (Belum Validasi / DUPLIKAT / BLM STBJ). Anda harus mencentang baris-baris tersebut dan menekan tombol 'HOLD LANGSIR' atau menghapusnya (Tong Sampah) sebelum sistem mengizinkan penyimpanan.");
    }
    
    const rows = document.querySelectorAll('.row-item'); if(rows.length === 0) return;

    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MENYIMPAN KE DATABASE...'; btn.disabled = true;
    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    let arrFisik = []; let mapVirtual = {}; 

    rows.forEach(r => {
        let area = r.querySelector('.area-cell').innerText; let qr = r.querySelector('.qr-val').innerText;
        let jenis = r.querySelector('.col-jenis').innerText; let nama = r.querySelector('.col-nama').innerText;
        let pjg = r.querySelector('.col-pjg').innerText; let grade = r.querySelector('.col-grade').innerText;
        let dus = r.querySelector('.col-dus').innerText; let shading = r.querySelector('.col-shading').innerText; let po = r.querySelector('.col-po').innerText;
        let id_sku = `${area}_${jenis}_${nama}_${pjg}_${grade}_${dus}_${shading}_${po}`;
        
        arrFisik.push({ qrcode: qr, area: area, id_sku: id_sku, pic_input: user.username });
        if(!mapVirtual[id_sku]) { mapVirtual[id_sku] = { id_sku: id_sku, area: area, jenis_item: jenis, nama_item: nama, panjang: pjg, grade: grade, dus: dus, shading: shading, po_aktual: po, qty: 0 }; }
        mapVirtual[id_sku].qty += 1;
    });

    const payloadData = { qrs: arrFisik, virtuals: Object.values(mapVirtual), detail_log: `Masuk ${arrFisik.length} Dus via Langsir.`, pic: user.username };
    const { data, error } = await db.rpc('eksekusi_langsir_aman', { payload: payloadData });

    if (error || (data && data.startsWith('ERROR'))) { alert("GAGAL SERVER: " + (error ? error.message : data)); btn.innerHTML = original; btn.disabled = false; return; }
    alert(`BERHASIL!\n${arrFisik.length} kardus telah masuk dengan aman ke Kartu Stok Gudang.`);
    document.getElementById('tbody-langsir').innerHTML = ''; btn.innerHTML = original; btn.disabled = false;
}

// --- FUNGSI HOLD LANGSIR ---
async function holdLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if(checkedBoxes.length === 0) return alert("Anda harus mencentang kotak di baris yang bermasalah terlebih dahulu untuk memindahkannya ke antrean Hold.");

    const btn = document.getElementById('btn-hold');
    const ori = btn.innerHTML;
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
        
        // Peringatan: Pastikan Anda telah membuat tabel hold_langsir di Supabase
        payloadUpload.push({
            qrcode: qr,
            troli: troli,
            area: area,
            keterangan: `STBJ: ${ketStbj} | KODE: ${ketKode}`,
            pic_input: user.username
        });
    });

    try {
        const { error } = await db.from('hold_langsir').insert(payloadUpload);
        if(error) throw error;
        
        // Hapus paksa baris yang berhasil dihold dari layar
        checkedBoxes.forEach(cb => { cb.closest('tr').remove(); });
        updateRowNumbers();
        document.querySelector('input[onchange="toggleSemuaCentang(this.checked)"]').checked = false;
        
        alert(`SUKSES!\n${payloadUpload.length} Data berhasil diasingkan ke "Hold Langsir".`);
    } catch(e) {
        alert("Gagal melakukan Hold: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
}

// --- FUNGSI SALIN TABEL ---
function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih baris yang ingin disalin dengan mencentang kotak di kiri tabel!");

    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-langsir th'))
        .filter(th => window.getComputedStyle(th).display !== 'none' && !th.querySelector('input') && !th.querySelector('.lucide-trash-2'))
        .map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';

    cek.forEach(cb => {
        const tr = cb.closest('tr');
        const rowData = [];
        Array.from(tr.children).forEach((td, idx) => {
            if(idx === 0 || idx === 1) return; // Lewati kolom checkbox & Hapus
            if(window.getComputedStyle(td).display !== 'none') {
                rowData.push(td.innerText.trim().replace(/\n/g, ' '));
            }
        });
        copyString += rowData.join('\t') + '\n';
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert(`Berhasil menyalin ${cek.length} baris!\nBuka Excel lalu tekan CTRL+V / Paste.`);
    }).catch(err => {
        alert("Browser menolak akses Clipboard. Silakan salin manual.");
    });
}
