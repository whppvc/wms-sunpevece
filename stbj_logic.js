// KONEKSI SUPABASE
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let masterData = { item: [], rules: [], troli: [], mesin: [], dus: [], po: [] };
let importConfigs = [], deleteStack = [], globalRowId = 0;

window.onload = async () => {
    lucide.createIcons();
    document.body.setAttribute('data-bg', localStorage.getItem('app_bg') || 'light');
    await loadInitialData();
    generateImportRows();
};

function switchView(view) {
    document.getElementById('view-menu').classList.add('hidden');
    document.getElementById('view-scan').classList.toggle('hidden', view !== 'scan');
    document.getElementById('view-import').classList.toggle('hidden', view !== 'import');
}

async function loadInitialData() {
    const { data: mData1 } = await db.from('master_1').select('nama_troli').order('id', { ascending: true });
    if(mData1) {
        masterData.troli = [...new Set(mData1.map(r => r.nama_troli).filter(x => x && x.trim() !== ''))]; 
        const sel = document.getElementById('select-troli');
        if(sel) {
            sel.innerHTML = '<option value="">-- Pilih Troli --</option>';
            masterData.troli.forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
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
        if (digitPjg === 1) data.panjang = rawPjg + "M"; 
        else data.panjang = rawPjg[0] + "." + rawPjg[1] + "M"; 

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
        // 1. Ekstrak Tanggal (5 digit pertama)
        const dayOfYear = parseInt(p3.substring(0, 3));
        const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

        // 2. Ekstrak Sisa Kode (Mesin, Shift, PO)
        let sisaString = p3.substring(5); // Ambil sisa teks setelah 5 digit tanggal
        
        // 3. Gunakan Regex untuk menangkap teks berdasarkan awalan C, S, dan P
        // Penjelasan: (C.*?) ambil C beserta apapun setelahnya sampai ketemu S
        let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        
        if (match) {
            let rawMesin = match[1]; // Hasil: C12, C1, dst.
            let rawShift = match[2]; // Hasil: S1, S2, dst.
            let rawPO = match[3];    // Hasil: P4, P24, dst.

            let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin);
            data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;

            let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift);
            data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
            
            let cariPO = masterData.kamus.find(m => m.kode_po === rawPO);
            data.po = cariPO && cariPO.po ? cariPO.po : rawPO;
        } else {
            // Jika format barcode tidak memiliki unsur C, S, dan P yang berurutan
            data.mesin = "FORMAT SALAH";
            data.shift = "FORMAT SALAH";
            data.po = "FORMAT SALAH";
        }
    }
    return data;
}

// PEMISAH SPASI DAN TITIK KOMA
document.addEventListener('DOMContentLoaded', () => {
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawInput = document.getElementById('input-qrcode').value.trim();
            const troli = document.getElementById('select-troli').value;
            if(!troli || !rawInput) return;
            
            const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
            // REGEX: Memecah berdasarkan spasi ( ), Enter (\n), atau titik koma (;)
            const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
            let hasDuplicate = false;
            
            codes.forEach(code => {
                if(existingQRs.includes(code)) hasDuplicate = true;
                else { addRow(troli, code); existingQRs.push(code); }
            });
            
            if(hasDuplicate) { 
                document.getElementById('dup-notif').classList.remove('hidden'); 
                setTimeout(() => document.getElementById('dup-notif').classList.add('hidden'), 2000); 
            }
            document.getElementById('input-qrcode').value = '';
        });
    }
});

// OTOMATIS TERJEMAH SAAT BARIS DITAMBAHKAN
function addRow(troli, code) {
    globalRowId++;
    const tr = document.createElement('tr'); 
    tr.className = "border-b border-inherit hover:bg-black/5 transition row-item"; 
    tr.id = `row-${globalRowId}`;
    
    const td = translateBarcode(code); // Langsung terjemah
    
    let html = `<td class="p-3 text-center"><button onclick="deleteRow(this)" class="text-red-500 hover:text-red-700 cursor-pointer"><i data-lucide="trash-2"></i></button></td>
        <td class="p-3 font-bold no-cell text-center"></td>
        <td class="p-3 troli-cell font-bold text-blue-600">${troli}</td>
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
    
    tr.innerHTML = html; document.getElementById('tbody-stbj').prepend(tr);
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

// LOGIKA SAVE CANGGIH & ANTI DUPLIKAT SUPABASE
async function saveToSupabase() {
    const btnSave = document.getElementById('btn-save'); 
    const originalText = btnSave.innerHTML;
    
    // Animasi tanpa men-disable secara permanen
    btnSave.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MENYIMPAN...'; 
    btnSave.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) {
        alert("Tidak ada data untuk disimpan.");
        btnSave.innerHTML = originalText; btnSave.disabled = false; return;
    }

    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    let allQRCodes = [];
    let rowMap = {}; 

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        allQRCodes.push(qr);
        rowMap[qr] = row;
        // Bersihkan warna merah (jika user nge-save ulang)
        row.classList.remove('bg-red-200', 'hover:bg-red-300', 'text-red-900');
    });

    // Cek Duplikat ke Supabase secara massal
    const { data: existingData, error: checkError } = await db.from('hasil_stbj').select('qrcode').in('qrcode', allQRCodes);

    if (checkError) {
        alert("Gagal menghubungi server: " + checkError.message);
        btnSave.innerHTML = originalText; btnSave.disabled = false; return;
    }

    const existingQRs = existingData.map(d => d.qrcode);
    const dataToSave = [];
    let duplikatCount = 0;
    let masukCount = 0;

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        if (existingQRs.includes(qr)) {
            // MERAHKAN BARIS JIKA DUPLIKAT
            row.classList.add('bg-red-200', 'hover:bg-red-300', 'text-red-900');
            duplikatCount++;
        } else {
            // JIKA BELUM ADA, SIAPKAN UNTUK DISIMPAN
            dataToSave.push({
                troli: row.querySelector('.troli-cell').innerText,
                qrcode: qr,
                tgl_produksi: row.querySelector('.col-tgl').innerText,
                mesin: row.querySelector('.col-mesin').innerText,
                shift: row.querySelector('.col-shift').innerText,
                jenis_item: row.querySelector('.col-jenis').innerText,
                nama_item: row.querySelector('.col-nama').innerText,
                panjang: row.querySelector('.col-pjg').innerText,
                grade: row.querySelector('.col-grade').innerText,
                dus: row.querySelector('.col-dus').innerText,
                shading: row.querySelector('.col-shading').innerText,
                po: row.querySelector('.col-po').innerText,
                keterangan: row.querySelector('.ket-input').value.toUpperCase(),
                pic_input: user.username,
                status: 'STBJ'
            });
            masukCount++;
        }
    });

    if (dataToSave.length > 0) {
        const { error: insertError } = await db.from('hasil_stbj').insert(dataToSave);
        if (insertError) {
            alert("Gagal Simpan ke Supabase: " + insertError.message);
        } else {
            // BERSIHKAN DATA YANG SUKSES DARI LAYAR
            dataToSave.forEach(d => {
                if(rowMap[d.qrcode]) rowMap[d.qrcode].remove();
            });
            updateRowNumbers();
        }
    }

    btnSave.innerHTML = originalText; 
    btnSave.disabled = false;
    lucide.createIcons();

    // MUNCULKAN POP-UP HASIL
    alert(`PROSES SELESAI!\n✅ Berhasil disimpan: ${masukCount} data\n❌ Ditolak (Sudah ada di database): ${duplikatCount} data`);
}

// LOGIKA IMPORT CSV
function generateImportRows() {
    const container = document.getElementById('import-rows');
    if(!container) return;
    for (let i = 1; i <= 40; i++) {
        container.innerHTML += `
            <div class="flex items-center gap-2 p-2 bg-black/5 rounded-xl border border-inherit shadow-sm">
                <button onclick="pickTroliImport(${i})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-3 rounded-lg text-sm font-bold w-28">Pilih Troli</button>
                <div class="flex flex-col flex-1 gap-1">
                    <div id="troli-box-${i}" class="input-dynamic p-2 rounded border font-bold text-sm h-10 flex items-center text-blue-600 shadow-inner">Nama Troli...</div>
                    <div id="file-box-${i}" class="input-dynamic p-2 rounded border italic text-sm h-10 flex items-center opacity-70 overflow-hidden">File CSV...</div>
                </div>
                <input type="file" id="file-input-${i}" class="hidden" accept=".csv, .xlsx" onchange="handleFileSelect(this, ${i})">
                <button onclick="document.getElementById('file-input-${i}').click()" class="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-lg"><i data-lucide="upload" class="w-5 h-5"></i></button>
            </div>`;
    }
    lucide.createIcons();
}

function pickTroliImport(idx) {
    let optionsHTML = masterData.troli.map(t => `<option value="${t}">${t}</option>`).join('');
    const div = document.createElement('div'); div.className = "fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm";
    div.innerHTML = `<div class="card-dynamic p-6 rounded-xl w-80 shadow-2xl border"><h3 class="font-bold mb-4">Pilih Troli (Baris ${idx})</h3><select id="dialog-select" class="input-dynamic w-full p-3 border-2 rounded-lg mb-4 font-bold outline-none border-blue-400">${optionsHTML}</select><div class="flex justify-end gap-2"><button onclick="this.parentElement.parentElement.parentElement.remove()" class="px-4 py-2 bg-gray-200 text-gray-800 rounded font-bold">Batal</button><button id="dialog-ok" class="px-4 py-2 bg-blue-600 text-white rounded font-bold">Pilih</button></div></div>`;
    document.body.appendChild(div);
    document.getElementById('dialog-ok').onclick = () => { const name = document.getElementById('dialog-select').value; document.getElementById(`troli-box-${idx}`).innerText = name.toUpperCase(); if (!importConfigs[idx]) importConfigs[idx] = {}; importConfigs[idx].troli = name.toUpperCase(); div.remove(); };
}

function handleFileSelect(input, idx) {
    const file = input.files[0]; if (!file) return;
    document.getElementById(`file-box-${idx}`).innerText = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result), workbook = XLSX.read(data, {type: 'array'}), sheet = workbook.Sheets[workbook.SheetNames[0]];
        const qrCodes = XLSX.utils.sheet_to_json(sheet, {header: 1}).slice(1).map(r => r[2]).filter(c => c && String(c).trim() !== '');
        if (!importConfigs[idx]) importConfigs[idx] = {}; importConfigs[idx].codes = qrCodes;
    };
    reader.readAsArrayBuffer(file);
}

function processImportToTable() {
    if(!importConfigs.some(c => c && c.troli && c.codes && c.codes.length > 0)) return alert("Isi Troli & File dengan benar.");
    switchView('scan'); const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
    importConfigs.forEach(conf => { if (conf && conf.troli && conf.codes) { conf.codes.forEach(c => { let code = String(c).trim(); if(!existingQRs.includes(code)) { addRow(conf.troli, code); existingQRs.push(code); } }); } });
    importConfigs = [];
}
