// ==========================================
// FILE: js_plafon.js (VERSI FULL FITUR)
// ==========================================
let dataPlafon = {}; 
let selectedPlafonItem = ""; 
let selectedPlafonPO = ""; 

// VARIABEL UNTUK D-PAD & ZOOM
let globalZoom = 1;
let globalX = 0;
let globalY = 0;

// 1. INIT DATA DARI SUPABASE
async function initPlafon() {
    document.getElementById('p-tgl').valueAsDate = new Date();
    
    const { data, error } = await _supa.from('master_plafon').select('*');
    if (error) { alert("Gagal memuat data Plafon: " + error.message); return; }
    
    if (data) {
        const getUniq = (key) => [...new Set(data.map(i => i[key]).filter(Boolean))].sort();
        dataPlafon = {
            mesin: getUniq('mesin'), shift: getUniq('shift'), item: getUniq('nama_item'), grade: getUniq('grade'), po: getUniq('po')
        };
        isiDropdownPlafon(dataPlafon);
    }

    // Event Listener Deteksi Opsi "+ Tambah Mesin Baru" di Dropdown
    document.getElementById('p-mesin').addEventListener('change', function() {
        if(this.value === 'ADD_NEW') { bukaModal('p-modal-tambah-mesin'); this.value = ''; }
    });
}

// 2. MENGISI DROPDOWN & OPSI TAMBAH BARU
function isiDropdownPlafon(data) {
    const selMesin = document.getElementById('p-mesin');
    if(selMesin) selMesin.innerHTML = '<option value="">Pilih Mesin</option>' + 
        data.mesin.map(m => `<option value="${m}">${m}</option>`).join('') + 
        '<option value="ADD_NEW" style="font-weight:bold; color:#0d6efd;">+ Tambah Mesin Baru</option>';
    
    const selShift = document.getElementById('p-shift');
    if(selShift) selShift.innerHTML = '<option value="">Pilih Shift</option>' + data.shift.map(s => `<option value="${s}">${s}</option>`).join('');
    
    const selGrade = document.getElementById('p-grade');
    if(selGrade) selGrade.innerHTML = data.grade.map(g => `<option value="${g}">${g}</option>`).join('');

    const ulItem = document.getElementById('p-item-list');
    if(ulItem) ulItem.innerHTML = data.item.map(i => `<li onclick="pilihItemManual('p', '${i}', this)">${i}</li>`).join('');

    const ulPO = document.getElementById('p-po-list');
    if(ulPO) ulPO.innerHTML = data.po.map(p => `<li onclick="pilihPOManual('p', '${p}', this)">${p}</li>`).join('');
}

// ==========================================
// FUNGSI BARU: SIMPAN DATA KE MASTER SUPABASE
// ==========================================
async function simpanDataBaru(prefix, jenis) {
    let inputEl = document.getElementById(`${prefix}-input-${jenis}-baru`);
    if(!inputEl) return;
    
    let val = inputEl.value.trim();
    if(!val) return alert("Isian tidak boleh kosong!");

    let tableName = prefix === 'p' ? 'master_plafon' : 'master_lis';
    let colName = jenis === 'item' ? 'nama_item' : jenis; 
    
    let obj = {}; obj[colName] = val;
    
    let btn = document.getElementById(`${prefix}-btn-simpan-${jenis}`);
    if(btn) { btn.innerText = "⏳ Menyimpan..."; btn.disabled = true; }

    const { error } = await _supa.from(tableName).insert([obj]);

    if(btn) { btn.innerText = "Simpan"; btn.disabled = false; }

    if(error) {
        alert("Gagal menyimpan: " + error.message);
    } else {
        alert("Data berhasil ditambahkan ke Database!");
        inputEl.value = "";
        tutupModal(`${prefix}-modal-tambah-${jenis}`);
        if(prefix === 'p') initPlafon(); else initLis(); // Refresh dropdown otomatis
    }
}

// 3. FUNGSI UI & MODAL
function bukaModal(id) { document.getElementById(id).style.display = 'block'; }
function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
function pilihItemManual(prefix, val, el) { document.querySelectorAll(`#${prefix}-item-list li`).forEach(li => li.classList.remove('selected')); el.classList.add('selected'); if(prefix === 'p') selectedPlafonItem = val; else selectedLisItem = val; }
function pilihPOManual(prefix, val, el) { document.querySelectorAll(`#${prefix}-po-list li`).forEach(li => li.classList.remove('selected')); el.classList.add('selected'); selectedPlafonPO = val; }
function pilihItem(prefix) { document.getElementById(prefix + '-item').value = prefix === 'p' ? selectedPlafonItem : selectedLisItem; tutupModal(prefix + '-modal-cari-item'); }
function pilihPO(prefix) { document.getElementById(prefix + '-po').value = selectedPlafonPO; tutupModal(prefix + '-modal-cari-po'); }
function filterList(inputId, listId) { const val = document.getElementById(inputId).value.toUpperCase(); document.getElementById(listId).querySelectorAll('li').forEach(li => { li.style.display = li.innerText.toUpperCase().includes(val) ? "" : "none"; }); }

function cekValidasi(prefix) {
    let qty = parseInt(document.getElementById(prefix + '-qty').value) || 0;
    let btn = document.getElementById(prefix + '-btn-generate');
    if(btn) {
        if(qty > 0) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; btn.innerText = '1. BUAT QRCODE & SIMPAN'; } 
        else { btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; btn.innerText = '1. BUAT QRCODE (Terkunci)'; }
    }
}

function shortName(name, grade) {
    if(!name) return "";
    let abbr = name.toUpperCase().replace("GLOSSY","GLSY").replace("GOLD","GD").replace("SILVER","SLVR").replace("WHITE","WT").replace("BROWN","BRWN").replace(/\s/g, "");
    if(grade === 'A') abbr += " A"; return abbr;
}
function getJulianDateCode() {
    const dObj = new Date(); const start = new Date(dObj.getFullYear(), 0, 0);
    const dayStr = String(Math.floor((dObj - start + (start.getTimezoneOffset()-dObj.getTimezoneOffset())*60*1000) / 86400000)).padStart(3, '0');
    return dayStr + String(dObj.getFullYear()).slice(-2).split('').reverse().join('');
}

// ==========================================
// 4. FUNGSI GENERATE & VISUAL QR CODE
// ==========================================
async function prosesGenerate(prefix) {
    let btn = document.getElementById(prefix + '-btn-generate');
    if(btn) { btn.innerText = "⏳ Menyimpan..."; btn.disabled = true; }

    let item = document.getElementById(prefix + '-item').value;
    let panj = document.getElementById(prefix + '-panjang').value;
    let shad = document.getElementById(prefix + '-shading') ? document.getElementById(prefix + '-shading').value || "XX" : "XX";
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

    // Ambil nomor urut terakhir dari Supabase
    const { data: unikData } = await _supa.from('database_kode_unik').select('last_serial').eq('id_kombinasi', idKombinasi).single();
    let lastSerial = unikData ? parseInt(unikData.last_serial) : 0;
    let endSerial = lastSerial + qty;

   // --- RENDER VISUAL KE LAYAR ---
    const node = document.getElementById(prefix + '-node-label');
    if (node) {
        // 1. Kosongkan isi lama
        node.innerHTML = ""; 

        // 2. Buat container utama untuk D-Pad (Inner Label)
        let innerLabel = document.createElement('div');
        innerLabel.id = prefix + '-inner-label';
        innerLabel.style.display = "flex";
        innerLabel.style.flexDirection = "column";
        innerLabel.style.alignItems = "center";
        innerLabel.style.justifyContent = "center";
        innerLabel.style.width = "100%";
        innerLabel.style.transition = "transform 0.1s";

        // 3. Masukkan Teks Nama Item & Ukuran
        innerLabel.innerHTML = `
            <div style="font-weight:bold; font-size:11px; margin-bottom:2px; text-align:center;">${item} ${panj}M</div>
            <div id="${prefix}-qr-canvas" style="margin: 5px auto;"></div>
            <div style="font-size:10px; font-weight:bold; margin-top:2px; text-align:center;">${barcodeText}/${String(lastSerial+1).padStart(3, '0')}</div>
        `;

        node.appendChild(innerLabel);

        // 4. Generate QR Code ke dalam div yang baru dibuat
        new QRCode(document.getElementById(`${prefix}-qr-canvas`), {
            text: `${barcodeText}/${String(lastSerial+1).padStart(3, '0')}`,
            width: 55, // Ukuran sedikit diperbesar agar mudah discan
            height: 55,
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // 5. Reset posisi D-Pad ke tengah
        globalX = 0; globalY = 0; globalZoom = 1;
        applyTransform(); 
    }

    // Simpan ke Supabase
    await _supa.from('database_kode_unik').upsert({ id_kombinasi: idKombinasi, last_serial: endSerial, nama_item: item, panjang: panj, grade: grade, shading: shad });
    await _supa.from('database_label').insert([{ tanggal: new Date().toISOString(), nama_item: item, panjang: panj, shading: shad, msp: msp, barcode_base: idKombinasi, qty: qty, serial_range: `${lastSerial+1} - ${endSerial}` }]);

    if(btn) { btn.innerText = "1. BUAT QRCODE & SIMPAN"; btn.disabled = false; }
}

// ==========================================
// 5. FITUR D-PAD, ZOOM & PRINT ZEBRA
// ==========================================
function movePos(dir) {
    let step = 3; // Bergeser 3px per klik
    if(dir === 'up') globalY -= step;
    if(dir === 'down') globalY += step;
    if(dir === 'left') globalX -= step;
    if(dir === 'right') globalX += step;
    applyTransform();
}

function zoom(type) {
    if(type === 'in') globalZoom += 0.05;
    if(type === 'out') globalZoom -= 0.05;
    applyTransform();
}

function applyTransform() {
    let prefix = currentMenu; // Mengambil menu aktif dari js_global
    const inner = document.getElementById(prefix + '-inner-label');
    if(inner) {
        inner.style.transform = `scale(${globalZoom}) translate(${globalX}px, ${globalY}px)`;
    }
}

function renderPreview(prefix) {
    let targetId = prefix + '-node-label'; 
    const node = document.getElementById(targetId);
    if(!node) { alert("Area preview layout Zebra tidak ditemukan!"); return; }
    
    html2canvas(node, { scale: 2 }).then(canvas => {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><style>@page { size: 50.8mm 27.9mm; margin: 0; } body { margin: 0; display: flex; align-items: center; justify-content:center; } img { width: 100%; height: 100%; object-fit: contain; }</style></head><body><div><img src="${canvas.toDataURL()}"></div></body></html>`);
        win.document.close();
        setTimeout(() => win.print(), 500);
    });
}
