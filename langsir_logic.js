// KONEKSI SUPABASE
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
    document.getElementById('view-scan').classList.toggle('hidden', view === 'scan');
    document.getElementById('view-ambil').classList.toggle('hidden', view === 'ambil');
}

async function loadInitialData() {
    // Load Troli
    const { data: mData1 } = await db.from('master_1').select('nama_troli').order('id', { ascending: true });
    if(mData1) {
        masterData.troli = [...new Set(mData1.map(r => r.nama_troli).filter(x => x && x.trim() !== ''))]; 
        const selTroli = document.getElementById('select-troli');
        if(selTroli) {
            selTroli.innerHTML = '<option value="">-- Pilih Troli --</option>';
            masterData.troli.forEach(t => selTroli.innerHTML += `<option value="${t}">${t}</option>`);
        }
    }
    
    // Load Area
    const { data: mDataArea } = await db.from('master_area').select('nama_area').order('id', { ascending: true });
    if(mDataArea) {
        masterData.area = [...new Set(mDataArea.map(r => r.nama_area).filter(x => x && x.trim() !== ''))]; 
        const selArea = document.getElementById('select-area');
        if(selArea) {
            masterData.area.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
        }
    }

    // Load Kamus
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
        const dayOfYear = parseInt(p3.substring(0, 3));
        const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

        let lenMesin = (data.jenisItem === 'Plafon') ? 2 : 3;
        let rawMesin = p3.substring(5, 5 + lenMesin);
        let cariMesin = masterData.kamus.find(m => m.kode_mesin === rawMesin);
        data.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : rawMesin;

        let startShift = 5 + lenMesin;
        let rawShift = p3.substring(startShift, startShift + 2);
        let cariShift = masterData.kamus.find(m => m.kode_shift === rawShift);
        data.shift = cariShift && cariShift.shift ? cariShift.shift : rawShift;
        
        let startPO = startShift + 2;
        let rawPO = p3.substring(startPO); 
        let cariPO = masterData.kamus.find(m => m.kode_po === rawPO);
        data.po = cariPO && cariPO.po ? cariPO.po : rawPO;
    }
    return data;
}

// PEMISAH SPASI DAN TITIK KOMA PADA INPUT SCAN
document.addEventListener('DOMContentLoaded', () => {
    const formScan = document.getElementById('form-scan');
    if(formScan) {
        formScan.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawInput = document.getElementById('input-qrcode').value.trim();
            const troli = document.getElementById('select-troli').value;
            const area = document.getElementById('select-area').value;
            
            if(!troli || !area || !rawInput) {
                alert("Pilih Troli, Area, dan isi QR Code terlebih dahulu!");
                return;
            }
            
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

// CROSSCEK DATA KE HASIL_STBJ
async function crossCekSTBJ() {
    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) return alert("Belum ada data untuk di cek.");

    const allQRCodes = Array.from(rows).map(r => r.querySelector('.qr-val').innerText);
    
    // Cari QR di hasil_stbj
    const { data: stbjData, error } = await db.from('hasil_stbj').select('qrcode').in('qrcode', allQRCodes);
    if(error) return alert("Gagal koneksi ke server: " + error.message);

    const validQRs = stbjData.map(d => d.qrcode);

    rows.forEach(row => {
        const qr = row.querySelector('.qr-val').innerText;
        const valCell = row.querySelector('.col-val');
        if(validQRs.includes(qr)) {
            valCell.innerHTML = '<span class="text-green-600 font-black bg-green-100 px-3 py-1 rounded-full border border-green-300 shadow-sm text-xs">VALID</span>';
        } else {
            valCell.innerHTML = '<span class="text-red-600 font-black bg-red-100 px-3 py-1 rounded-full border border-red-300 shadow-sm text-xs">INVALID</span>';
        }
    });
}

// SIMPAN DATA LANGSIR KE DATABASE
async function saveToSupabase() {
    const btnSave = document.getElementById('btn-save'); 
    const originalText = btnSave.innerHTML;
    
    btnSave.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6"></i> MENYIMPAN...'; 
    btnSave.disabled = true;

    const rows = document.querySelectorAll('.row-item');
    if(rows.length === 0) {
        alert("Tidak ada data untuk disimpan.");
        btnSave.innerHTML = originalText; btnSave.disabled = false; return;
    }

    const user = JSON.parse(localStorage.getItem('user_session')) || {username: 'Unknown'};
    const dataToSave = [];

    rows.forEach(row => {
        dataToSave.push({
            troli: row.querySelector('.troli-cell').innerText,
            area: row.querySelector('.area-cell').innerText,
            qrcode: row.querySelector('.qr-val').innerText,
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
            activity: 'Langsir'
        });
    });

    const { error: insertError } = await db.from('hasil_langsir').insert(dataToSave);
    
    if (insertError) {
        alert("Gagal Simpan ke Supabase: " + insertError.message);
    } else {
        alert(`BERHASIL!\n${dataToSave.length} data Langsir telah disimpan.`);
        document.getElementById('tbody-langsir').innerHTML = ''; // Bersihkan layar
    }

    btnSave.innerHTML = originalText; 
    btnSave.disabled = false;
    lucide.createIcons();
}
