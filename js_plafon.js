// ==========================================
// FILE: js_plafon.js
// ==========================================
let dataPlafon = {}; 
let selectedPlafonItem = ""; 
let selectedPlafonPO = ""; 

// 1. INIT DATA DARI SUPABASE
async function initPlafon() {
    document.getElementById('p-tgl').valueAsDate = new Date();
    
    // Ambil data langsung dari Supabase (Menggantikan google.script.run)
    const { data, error } = await _supa.from('master_plafon').select('*');
    if (error) {
        alert("Gagal memuat data Plafon: " + error.message);
        return;
    }
    if (data) {
        // Menyaring data unik untuk Dropdown
        const getUniq = (key) => [...new Set(data.map(i => i[key]).filter(Boolean))].sort();
        dataPlafon = {
            mesin: getUniq('mesin'),
            shift: getUniq('shift'),
            item: getUniq('nama_item'),
            grade: getUniq('grade'),
            po: getUniq('po')
        };
        isiDropdownPlafon(dataPlafon);
    }
}

// 2. MENGISI DROPDOWN & LIST
function isiDropdownPlafon(data) {
    const selMesin = document.getElementById('p-mesin');
    if(selMesin) selMesin.innerHTML = '<option value="">Pilih Mesin</option>' + data.mesin.map(m => `<option value="${m}">${m}</option>`).join('');
    
    const selShift = document.getElementById('p-shift');
    if(selShift) selShift.innerHTML = '<option value="">Pilih Shift</option>' + data.shift.map(s => `<option value="${s}">${s}</option>`).join('');
    
    const selGrade = document.getElementById('p-grade');
    if(selGrade) selGrade.innerHTML = data.grade.map(g => `<option value="${g}">${g}</option>`).join('');

    const ulItem = document.getElementById('p-item-list');
    if(ulItem) ulItem.innerHTML = data.item.map(i => `<li onclick="pilihItemManual('p', '${i}', this)">${i}</li>`).join('');

    const ulPO = document.getElementById('p-po-list');
    if(ulPO) ulPO.innerHTML = data.po.map(p => `<li onclick="pilihPOManual('p', '${p}', this)">${p}</li>`).join('');
}

// 3. FUNGSI UI & MODAL
function bukaModal(id) { document.getElementById(id).style.display = 'block'; }
function tutupModal(id) { document.getElementById(id).style.display = 'none'; }

function pilihItemManual(prefix, val, el) {
    document.querySelectorAll(`#${prefix}-item-list li`).forEach(li => li.classList.remove('selected'));
    el.classList.add('selected');
    if(prefix === 'p') selectedPlafonItem = val; else selectedLisItem = val;
}

function pilihPOManual(prefix, val, el) {
    document.querySelectorAll(`#${prefix}-po-list li`).forEach(li => li.classList.remove('selected'));
    el.classList.add('selected');
    selectedPlafonPO = val;
}

function pilihItem(prefix) { 
    document.getElementById(prefix + '-item').value = prefix === 'p' ? selectedPlafonItem : selectedLisItem; 
    tutupModal(prefix + '-modal-cari-item'); 
}

function pilihPO(prefix) { 
    document.getElementById(prefix + '-po').value = selectedPlafonPO; 
    tutupModal(prefix + '-modal-cari-po'); 
}

function filterList(inputId, listId) {
    const val = document.getElementById(inputId).value.toUpperCase();
    document.getElementById(listId).querySelectorAll('li').forEach(li => { 
        li.style.display = li.innerText.toUpperCase().includes(val) ? "" : "none"; 
    });
}

function cekValidasi(prefix) {
    let qty = parseInt(document.getElementById(prefix + '-qty').value) || 0;
    let btn = document.getElementById(prefix + '-btn-generate');
    if(btn) {
        if(qty > 0) {
            btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; btn.innerText = '1. BUAT QRCODE & SIMPAN';
        } else {
            btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; btn.innerText = '1. BUAT QRCODE (Terkunci)';
        }
    }
}

// 4. LOGIKA BARCODE (Singkatan & Julian Date)
function shortName(name, grade) {
    if(!name) return "";
    let abbr = name.toUpperCase().replace("GLOSSY","GLSY").replace("GOLD","GD").replace("SILVER","SLVR").replace("WHITE","WT").replace("BROWN","BRWN").replace(/\s/g, "");
    if(grade === 'A') abbr += " A";
    return abbr;
}

function getJulianDateCode() {
    const dObj = new Date();
    const start = new Date(dObj.getFullYear(), 0, 0);
    const dayStr = String(Math.floor((dObj - start + (start.getTimezoneOffset()-dObj.getTimezoneOffset())*60*1000) / 86400000)).padStart(3, '0');
    const yrRev = String(dObj.getFullYear()).slice(-2).split('').reverse().join('');
    return dayStr + yrRev;
}

// 5. FUNGSI UTAMA GENERATE (Terkoneksi ke Supabase)
async function prosesGenerate(prefix) {
    let btn = document.getElementById(prefix + '-btn-generate');
    if(btn) { btn.innerText = "⏳ Menyimpan ke Database..."; btn.disabled = true; }

    let item = document.getElementById(prefix + '-item').value;
    let panj = document.getElementById(prefix + '-panjang').value;
    let shad = document.getElementById(prefix + '-shading') ? document.getElementById(prefix + '-shading').value || "XX" : "XX";
    
    // Cek apakah ini form Plafon atau Lis
    if (prefix === 'p') {
        let grade = document.getElementById('p-grade').value;
        let msp = document.getElementById('p-mesin').value + document.getElementById('p-shift').value + document.getElementById('p-po').value;
        let qty = parseInt(document.getElementById('p-qty').value);

        if(!item || !panj || qty === 0) {
            alert("Harap lengkapi form dan jumlah cetak!");
            if(btn) { btn.innerText = "1. BUAT QRCODE & SIMPAN"; btn.disabled = false; }
            return;
        }

        let idKombinasi = `${item}_${panj}_${grade}_${shad}`;
        let barcodeText = `${shortName(item, grade)}/${shad}/${panj}/${getJulianDateCode()}/${msp}`;

        // Supabase Process: Ambil nomor urut terakhir
        const { data: unikData } = await _supa.from('database_kode_unik').select('last_serial').eq('id_kombinasi', idKombinasi).single();
        let lastSerial = unikData ? parseInt(unikData.last_serial) : 0;
        let endSerial = lastSerial + qty;

        // Simpan Data Baru
        await _supa.from('database_kode_unik').upsert({ id_kombinasi: idKombinasi, last_serial: endSerial, nama_item: item, panjang: panj, grade: grade, shading: shad });
        await _supa.from('database_label').insert([{ tanggal: new Date().toISOString(), nama_item: item, panjang: panj, shading: shad, msp: msp, barcode_base: idKombinasi, qty: qty, serial_range: `${lastSerial+1} - ${endSerial}` }]);

        alert("Data Plafon Berhasil Disimpan ke Supabase!\nSerial: " + (lastSerial+1) + " s/d " + endSerial);
    } 
    // Logika LIS
    else if (prefix === 'l') {
        let msp = document.getElementById('l-mesin').value + document.getElementById('l-shift').value;
        let qty = parseInt(document.getElementById('l-qty').value);
        let idKombinasi = `${item}_${panj}_POLOS_${shad}`;
        
        const { data: unikData } = await _supa.from('database_kode_unik').select('last_serial').eq('id_kombinasi', idKombinasi).single();
        let lastSerial = unikData ? parseInt(unikData.last_serial) : 0;
        let endSerial = lastSerial + qty;

        await _supa.from('database_kode_unik').upsert({ id_kombinasi: idKombinasi, last_serial: endSerial, nama_item: item, panjang: panj, shading: shad });
        alert("Data Lis Berhasil Disimpan!\nSerial: " + (lastSerial+1) + " s/d " + endSerial);
    }

    if(btn) { btn.innerText = "1. BUAT QRCODE & SIMPAN"; btn.disabled = false; }
}

// 6. FITUR PRINT ZEBRA (html2canvas)
function renderPreview(prefix) {
    // Mencari elemen layout zebra yang akan di screenshot
    let targetId = prefix === 'p' ? 'p-layout-kanan' : 'l-layout-kanan'; 
    const node = document.getElementById(targetId);
    
    if(!node) { alert("Area preview layout Zebra tidak ditemukan!"); return; }
    
    html2canvas(node, { scale: 2 }).then(canvas => {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><style>@page { size: 50.8mm 27.9mm; margin: 0; } body { margin: 0; display: flex; align-items: center; justify-content:center; } img { width: 100%; height: 100%; object-fit: contain; }</style></head><body><div><img src="${canvas.toDataURL()}"></div></body></html>`);
        win.document.close();
        setTimeout(() => win.print(), 500);
    });
}
