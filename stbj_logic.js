let dataStbj = []; 
let deletedStbjStack = []; 
let masterKamus = [];
let globalRowId = 0;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'stbj', title: 'SCAN STBJ', url: 'stbj.html' }); 
    
    document.body.style.overflow = 'hidden';
    const wmsMain = document.querySelector('main');
    if(wmsMain) {
        wmsMain.style.overflow = 'hidden';
        wmsMain.style.padding = '0'; 
    }

    await loadInitialSTBJData();
});

window.bukaModalAdd = function() {
    document.getElementById('modal-add-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qrcode').focus(), 100);
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
};

async function loadInitialSTBJData() {
    try {
        const { data: mData1 } = await db.from('master_1').select('nama_troli').order('id', { ascending: true });
        if(mData1) {
            const trolis = [...new Set(mData1.map(r => r.nama_troli).filter(x => x))];
            const sel = document.getElementById('select-troli');
            sel.innerHTML = '<option value="">-- Memuat Troli... --</option>';
            trolis.forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
        }
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) masterKamus = mData2;
    } catch (err) { console.error("Gagal muat referensi:", err); }
}

// FUNGSI PENERJEMAH BARCODE
function translateBarcode(barcode) {
    let td = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', customer: '-' };
    const parts = barcode.split('/'); if (parts.length < 4) return td;
    
    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') td.jenisItem = 'Plafon'; else if (hurufDepan === 'L') td.jenisItem = 'List'; else if (hurufDepan === 'W') td.jenisItem = 'WPC'; else td.jenisItem = hurufDepan;

    let rawItem = parts[0]; let cariItem = masterKamus.find(m => m.kode_nama_item === rawItem); 
    td.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem; td.shading = parts[1];
    
    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        td.panjang = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M"; 
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); td.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); let cariDus = masterKamus.find(m => m.kode_dus === rawDus); td.dus = cariDus && cariDus.dus ? cariDus.dus : rawDus;
    }
    const p3 = parts[3];
    if (p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        td.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if (match) {
            let cariMesin = masterKamus.find(m => m.kode_mesin === match[1]); td.mesin = cariMesin && cariMesin.mesin ? cariMesin.mesin : match[1];
            let cariShift = masterKamus.find(m => m.kode_shift === match[2]); td.shift = cariShift && cariShift.shift ? cariShift.shift : match[2];
            let cariCustomer = masterKamus.find(m => m.kode_customer === match[3]); td.customer = cariCustomer && cariCustomer.customer ? cariCustomer.customer : match[3];
        }
    }
    return td;
}

document.getElementById('form-scan').addEventListener('submit', (e) => {
    e.preventDefault();
    const troli = document.getElementById('select-troli').value;
    const inputEl = document.getElementById('input-qrcode');
    const rawInput = inputEl.value.trim();
    if(!troli) return alert("Pilih Troli terlebih dahulu!");
    if(!rawInput) return;

    const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
    
    codes.forEach(code => {
        const isLocalDuplicate = dataStbj.some(d => d.qrcode === code);
        const trans = translateBarcode(code);
        
        dataStbj.push({ 
            id: ++globalRowId, 
            qrcode: code, 
            troli: troli, 
            status: 'BELUM CEK', 
            keterangan: isLocalDuplicate ? 'DUPLIKAT SCAN' : '', 
            pic: currentUser.username, 
            isLocalDuplicate: isLocalDuplicate,
            ...trans 
        });
    });
    
    renderTable();
    
    // Kosongkan input agar bisa scan terus menerus tanpa menutup modal
    inputEl.value = ''; 
    inputEl.focus();
    
    const scrollContainer = document.getElementById('scroll-container');
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
});

function renderTable() {
    const tbody = document.getElementById('tbody-stbj');
    if(dataStbj.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400"><i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-tampil-baris').innerText = '0';
        updateFilterDropdowns(); // Update dropdown filter
        lucide.createIcons(); return;
    }
    
    let html = '';
    let count = 1;

    dataStbj.forEach((d) => {
        let badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
        let displayStatus = d.status;

        if(d.status === 'BELUM STBJ') badgeClass = "bg-orange-500 text-white border-orange-600";
        if(d.status === 'SUDAH STBJ') badgeClass = "bg-red-600 text-white border-red-700"; 
        if(d.status === 'DUPLIKAT SCAN') badgeClass = "bg-red-600 text-white border-red-700";
        if(d.status === 'HOLD') badgeClass = "bg-amber-500 text-white border-amber-600";

        if(d.status === 'BELUM CEK' && d.isLocalDuplicate) {
            badgeClass = "bg-red-600 text-white border-red-700";
            displayStatus = "DUPLIKAT SCAN";
        }

        const isRedHighlight = d.status === 'SUDAH STBJ' || d.status === 'DUPLIKAT SCAN' || d.isLocalDuplicate;
        const rowClass = isRedHighlight ? 'bg-red-50 hover:bg-red-100' : (d.status === 'HOLD' ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-slate-50');

        html += `
            <div class="row-stbj ${rowClass} border-b border-slate-300 p-2.5 relative transition w-full flex shrink-0">
                <div class="flex flex-col items-center justify-start pr-2 mr-2 border-r border-slate-300 w-10 shrink-0 pt-1">
                    <div class="font-black text-slate-800 text-xl mb-3 leading-none no-cell">${count++}</div>
                    <input type="checkbox" value="${d.id}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 accent-blue-600 rounded bg-white border-slate-400">
                </div>
                
                <div class="flex-1 flex flex-col gap-0 w-full min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <div class="font-black text-[22px] text-emerald-700 leading-none col-troli">${d.troli || '-'}</div>
                        <button onclick="hapusBaris(${d.id})" class="bg-slate-700 text-white p-1.5 rounded hover:bg-rose-600 transition active:scale-95 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                    
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all leading-tight col-qr">${d.qrcode}</div>
                    
                    <div class="text-[12px] font-bold text-slate-600 tracking-tight">
                        <span class="col-tgl">${d.tglProduksi}</span> - <span class="col-mesin">${d.mesin}</span> - <span class="col-shift">${d.shift}</span>
                    </div>
                    
                    <div class="text-[13px] font-black text-slate-900 leading-snug my-0.5">
                        <span class="col-nama">${d.namaItem}</span> - <span class="col-pjg">${d.panjang}</span> - <span class="col-grade">${d.grade}</span> - <span class="col-dus">${d.dus}</span>
                        <span class="col-jenis hidden">${d.jenisItem}</span>
                    </div>
                    
                    <div class="text-[12px] font-bold text-blue-600 col-shading">${d.shading}</div>
                    <div class="text-[12px] font-bold text-orange-600 col-customer uppercase">${d.customer}</div>
                    
                    <div class="mt-1.5 mb-1">
                        <input type="text" onchange="updateKet(${d.id}, this.value)" value="${d.keterangan}" class="w-full p-1.5 text-[11px] font-bold border border-slate-300 rounded outline-none focus:border-blue-500 bg-white/80 col-ket" placeholder="Keterangan...">
                    </div>
                    
                    <div class="flex flex-row flex-wrap items-center gap-1.5 mt-0.5">
                        <span class="font-bold px-3 py-1 text-[10px] rounded-sm border col-status ${badgeClass}">${displayStatus}</span>
                    </div>
                </div>
            </div>
        `;
    });
    tbody.innerHTML = html; 
    document.getElementById('lbl-tampil-baris').innerText = dataStbj.length;
    
    updateFilterDropdowns(); // Update dropdown filter setiap kali tabel dirender
    lucide.createIcons(); 
}

// REVISI: Fungsi untuk mengisi opsi dropdown filter secara dinamis
function updateFilterDropdowns() {
    const fields = {
        'fs-status': 'statusUI', // Custom logic untuk status
        'fs-troli': 'troli',
        'fs-tgl': 'tglProduksi',
        'fs-mesin': 'mesin',
        'fs-shift': 'shift',
        'fs-jenis': 'jenisItem',
        'fs-nama': 'namaItem',
        'fs-pjg': 'panjang',
        'fs-grade': 'grade',
        'fs-dus': 'dus',
        'fs-shading': 'shading',
        'fs-customer': 'customer'
    };

    for (let id in fields) {
        const select = document.getElementById(id);
        if (!select) continue;
        
        const currentVal = select.value; // Simpan pilihan user sebelumnya
        const key = fields[id];
        
        let uniqueVals = [];
        if (key === 'statusUI') {
            uniqueVals = [...new Set(dataStbj.map(d => {
                if(d.status === 'BELUM CEK' && d.isLocalDuplicate) return 'DUPLIKAT SCAN';
                return d.status;
            }))].sort();
        } else {
            uniqueVals = [...new Set(dataStbj.map(item => item[key] || '-'))].sort();
        }
        
        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => {
            html += `<option value="${val}">${val}</option>`;
        });
        
        select.innerHTML = html;
        
        // Kembalikan pilihan jika masih ada di daftar
        if (uniqueVals.includes(currentVal)) {
            select.value = currentVal;
        }
    }
}

function highlightRow(cb) {
    const div = cb.closest('.row-stbj');
    if (div) {
        if (cb.checked) div.classList.add('selected-row');
        else div.classList.remove('selected-row');
    }
}

function toggleAll(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('.row-stbj');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    }); 
}

function getCheckedIds() {
    const ids = []; document.querySelectorAll('.row-cb:checked').forEach(cb => ids.push(parseInt(cb.value))); return ids;
}

function hapusBaris(id) {
    const removed = dataStbj.find(d => d.id === id);
    if(removed) {
        deletedStbjStack.push([removed]);
        dataStbj = dataStbj.filter(d => d.id !== id);
        renderTable();
    }
}

function undoHapusSTBJ() {
    if(deletedStbjStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedStbjStack.pop();
    dataStbj = [...dataStbj, ...last]; 
    renderTable();
}

function holdManual() {
    const ids = getCheckedIds(); if(ids.length === 0) return alert("Centang baris yang ingin di-HOLD manual!");
    dataStbj.forEach(d => { if(ids.includes(d.id)) { d.status = 'HOLD'; d.keterangan = 'Dihold Manual'; } });
    renderTable(); document.querySelector('#cb-all').checked = false;
}

function updateKet(id, val) { const item = dataStbj.find(d => d.id === id); if(item) item.keterangan = val; }

function toggleSidebarFilter() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
}

function tutupPopups() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    tutupModalAdd();
}

function resetFilterSTBJ() {
    const ids = ['fs-status','fs-troli','fs-qr','fs-tgl','fs-mesin','fs-shift','fs-jenis','fs-nama','fs-pjg','fs-grade','fs-dus','fs-shading','fs-customer','fs-ket'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    saringTabelSTBJ(); toggleSidebarFilter();
}

// REVISI: Logika filter disesuaikan untuk Dropdown (Exact Match)
function saringTabelSTBJ() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        troli: document.getElementById('fs-troli')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        tgl: document.getElementById('fs-tgl')?.value || '',
        mesin: document.getElementById('fs-mesin')?.value || '',
        shift: document.getElementById('fs-shift')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        customer: document.getElementById('fs-customer')?.value || '',
        ket: document.getElementById('fs-ket')?.value.toLowerCase() || ''
    };

    let visibleCount = 0;
    document.querySelectorAll('.row-stbj').forEach(row => {
        let show = true;
        
        // Exact match untuk Dropdown
        const exactFields = ['status', 'troli', 'tgl', 'mesin', 'shift', 'jenis', 'nama', 'pjg', 'grade', 'dus', 'shading', 'customer'];
        for(let key of exactFields) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell) {
                    let text = cell.innerText.trim();
                    if(text !== f[key]) { show = false; break; }
                }
            }
        }

        // Partial match untuk Text Input (QRCode & Keterangan)
        if(show && f.qr) {
            const cell = row.querySelector('.col-qr');
            if(cell && !cell.innerText.toLowerCase().includes(f.qr)) show = false;
        }
        if(show && f.ket) {
            const cell = row.querySelector('.col-ket');
            if(cell) {
                let inputEl = cell.querySelector('input');
                let text = inputEl ? inputEl.value.toLowerCase() : cell.innerText.toLowerCase();
                if(!text.includes(f.ket)) show = false;
            }
        }

        row.style.display = show ? 'flex' : 'none';
        if(show) visibleCount++;
    });
    document.getElementById('lbl-tampil-baris').innerText = visibleCount;
}

async function cekGudangSTBJ() {
    if(dataStbj.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-cek-gudang'); const ori = btn.innerHTML;
    btn.innerHTML = '<div class="bg-slate-900 text-white flex items-center justify-center px-3 py-2.5"><i data-lucide="loader-2" class="animate-spin w-4 h-4"></i></div><div class="bg-slate-800 text-white font-bold text-[11px] px-4 py-2.5 flex items-center uppercase tracking-wide group-hover:bg-slate-700 transition">Mengecek...</div>'; btn.disabled = true;

    const allQRs = dataStbj.map(d => d.qrcode);
    try {
        const { data: resStokGlobal, error } = await db.from('stok_global').select('qrcode').in('qrcode', allQRs);
        if(error) throw error;
        
        const existingGlobal = resStokGlobal.map(d => d.qrcode);

        let infoDuplikat = 0;
        dataStbj.forEach(d => {
            if(d.status === 'HOLD') return; 
            
            if (existingGlobal.includes(d.qrcode)) {
                d.status = 'SUDAH STBJ'; 
                d.keterangan = 'SUDAH ADA DI STOK GLOBAL';
                infoDuplikat++;
            } else if (d.isLocalDuplicate) {
                d.status = 'DUPLIKAT SCAN';
            } else {
                d.status = 'BELUM STBJ'; 
            }
        });

        renderTable();
        if(infoDuplikat > 0) alert(`Verifikasi Selesai!\nDitemukan ${infoDuplikat} data DUPLIKAT (sudah ada di Stok Global).`);
        else alert("Verifikasi Selesai!\nSemua data UNIK (Belum STBJ) dan aman untuk disimpan.");

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

async function saveToDatabaseSTBJ() {
    if(dataStbj.length === 0) return alert('Data kosong!');
    const blmCek = dataStbj.filter(d => d.status === 'BELUM CEK');
    if(blmCek.length > 0) return alert('Tekan tombol Verifikasi Kode terlebih dahulu sebelum menyimpan!');

    const btn = document.getElementById('btn-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MEMPROSES...'; btn.disabled = true;

    const UNIKs = dataStbj.filter(d => d.status === 'BELUM STBJ');
    const dupes = dataStbj.filter(d => d.status === 'SUDAH STBJ' || d.status === 'DUPLIKAT SCAN' || d.status === 'HOLD');

    const mapToSchema = (d, finalStatus) => ({
        troli: d.troli,
        qrcode: d.qrcode,
        tgl_produksi: d.tglProduksi,
        shift: d.shift,
        mesin: d.mesin,
        jenis_item: d.jenisItem, 
        nama_item: d.namaItem,
        panjang: d.panjang,
        grade: d.grade,
        dus: d.dus,
        shading: d.shading,
        customer_bawaan: d.customer,
        keterangan: d.keterangan || '-',
        status: finalStatus,
        status_data: 'BELUM',
        posisi: 'TROLI',
        pic_input: d.pic,
        created_at: new Date().toISOString() 
    });

    try {
        if(UNIKs.length > 0) {
            const payloadGlobal = UNIKs.map(d => mapToSchema(d, 'SUDAH STBJ'));
            const { error: err1 } = await db.from('stok_global').insert(payloadGlobal);
            if(err1) throw err1;
        }
        
        if(dupes.length > 0) {
            const payloadHold = dupes.map(d => mapToSchema(d, 'HOLD'));
            const { error: err2 } = await db.from('hold_stbj').insert(payloadHold);
            if(err2) throw err2;
        }

        alert(`BERHASIL DISIMPAN!\n- ${UNIKs.length} Barang UNIK masuk ke Stok Global\n- ${dupes.length} Barang Hold/Duplikat masuk ke Hold STBJ`);
        dataStbj = []; renderTable();
        document.getElementById('cb-all').checked = false;
    } catch (err) { alert('GAGAL MENYIMPAN: ' + err.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}
