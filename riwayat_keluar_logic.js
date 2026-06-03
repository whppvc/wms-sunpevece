let modeSekarang = 'qrcode'; 
let rawDataRaw = [];
let holdDataRaw = [];
let kamusData = [];
let jasperData = [];
let sortState = {}; 
let globalCheckedCancel = []; // Untuk simpan memory checkbox
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_keluar', title: 'RIWAYAT KELUAR', url: 'riwayat_keluar.html' });
    setTimeout(async () => {
        await loadKamusDanJasper();
        await loadAreasForCancel(); // Tarik master Area untuk Pop up
        await muatDataDariSupabase();
    }, 200);
});

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-keluar');
    const rows = Array.from(tbody.querySelectorAll('tr.text-row'));
    
    let isAsc = sortState[colIndex] !== 'asc';
    sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim();
        let valB = b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) { return isAsc ? numA - numB : numB - numA; } 
        else { return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-50'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-50'); lucide.createIcons(); }
}

function toggleSidebarFilter() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar-k').classList.toggle('hidden');
}

function tutupPopups() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('modal-cancel-hold').classList.add('hidden');
    document.getElementById('overlay-klik-luar-k').classList.add('hidden');
}

// Fungsi Tarik Master Area untuk Dropdown Pop up Cancel
async function loadAreasForCancel() {
    try {
        const { data } = await db.from('master_1').select('nama_area').not('nama_area', 'is', null);
        if (data) {
            const areas = [...new Set(data.map(d => d.nama_area.trim()).filter(Boolean))];
            const sel = document.getElementById('cancel-area');
            sel.innerHTML = '<option value="">-- PILIH AREA GUDANG --</option>';
            areas.sort().forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);
        }
    } catch (e) { console.error("Gagal load area:", e); }
}

async function loadKamusDanJasper() {
    const { data: d2 } = await db.from('master_2').select('*'); if(d2) kamusData = d2;
    try {
        const { data: dj } = await db.from('nama_jasper').select('*').order('created_at', {ascending: false});
        if(dj) jasperData = dj;
    } catch(e) {}
}

// Fungsi Tarik PO Target dari string id_sku yang panjang
function extractPOFromSKU(id_sku) {
    if(!id_sku) return '-';
    const parts = id_sku.split('_');
    return parts.length >= 8 ? parts[7] : '-';
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-keluar');
    tbody.innerHTML = `<tr><td colspan="22" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data Keluar...</p></td></tr>`;
    lucide.createIcons();
    
    let queryKeluar = db.from('stok_keluar').select('*').order('created_at', {ascending: false}); 
    let queryHold = db.from('hold_keluar').select('*').order('created_at', {ascending: false}); 

    try {
        const [resK, resH] = await Promise.all([queryKeluar, queryHold]);
        if(resK.error) throw resK.error;
        if(resH.error) throw resH.error;
        
        rawDataRaw = resK.data || [];
        holdDataRaw = resH.data || [];
        renderHeaderDanTabel();
    } catch(err) { 
        tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`; 
    }
}

function translateBarcode(barcode) {
    let td = { tglProduksi: '-', mesin: '-', shift: '-', jenisItem: '-', namaItem: '-', panjang: '-', grade: '-', dus: '-', shading: '-', po: '-', jasper: '-' };
    if(!barcode) return td;
    const parts = barcode.split('/'); if (parts.length < 1) return td;
    
    const hurufDepan = barcode.charAt(0).toUpperCase();
    if (hurufDepan === 'P') td.jenisItem = 'Plafon'; else if (hurufDepan === 'L') td.jenisItem = 'List'; else if (hurufDepan === 'W') td.jenisItem = 'WPC'; else td.jenisItem = hurufDepan;

    let rawItem = parts[0]; let cariItem = kamusData.find(m => m.kode_nama_item === rawItem); 
    td.namaItem = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem; td.shading = parts[1] || '-';
    
    const p2 = parts[2];
    if (p2 && p2.length >= 4) {
        let dP = (p2.length === 5) ? 2 : 1; let rP = p2.substring(0, dP); td.panjang = (dP === 1) ? rP + "M" : rP[0] + "." + rP[1] + "M"; 
        let rG = p2.substring(dP, dP + 1); td.grade = rG === '1' ? 'BAGUS' : (rG === '2' ? 'A' : rG);
        let rD = p2.substring(p2.length - 2); let cD = kamusData.find(m => m.kode_dus === rD); td.dus = cD && cD.dus ? cD.dus : rD;
    }
    const p3 = parts[3];
    if (p3 && p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        if (!isNaN(dayOfYear) && !isNaN(realYear)) {
            const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
            td.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        }
        let s = p3.substring(5); let m = s.match(/(C.*?)(S.*?)(P.*)/);
        if (m) {
            let cM = kamusData.find(x => x.kode_mesin === m[1]); td.mesin = cM && cM.mesin ? cM.mesin : m[1];
            let cS = kamusData.find(x => x.kode_shift === m[2]); td.shift = cS && cS.shift ? cS.shift : m[2];
            let cPO = kamusData.find(x => x.kode_po === m[3]); td.po = cPO && cPO.po ? cPO.po : m[3];
        }
    }

    if(jasperData && jasperData.length > 0) {
        const cJasper = jasperData.find(j => j.nama_item === td.namaItem && j.panjang === td.panjang && j.grade === td.grade);
        td.jasper = cJasper ? cJasper.nama_jasper : `JAS-${td.namaItem}`;
    } else { td.jasper = `JAS-${td.namaItem}`; }

    return td;
}

function setMode(m) {
    modeSekarang = m;
    ['qrcode', 'item', 'jasper', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-mode-' + tab);
        if(el) {
            if(m === tab) el.className = 'px-6 py-4 border-b-4 border-blue-800 text-blue-800 font-black text-xs whitespace-nowrap flex items-center gap-2 transition';
            else el.className = 'px-6 py-4 border-b-4 border-transparent text-slate-500 font-bold text-xs whitespace-nowrap flex items-center gap-2 hover:text-slate-800 transition';
        }
    });

    const btnHold = document.getElementById('btn-hold');
    const btnCancel = document.getElementById('btn-cancel');

    if(m === 'qrcode') { btnHold.classList.remove('hidden'); btnCancel.classList.add('hidden'); }
    else if(m === 'hold') { btnHold.classList.add('hidden'); btnCancel.classList.remove('hidden'); }
    else { btnHold.classList.add('hidden'); btnCancel.classList.add('hidden'); }

    renderHeaderDanTabel();
}

const thSort = (idx, label, cls = "") => `<th class="hdr-std ${cls} cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${idx}, this)"><div class="flex items-center justify-center gap-1">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>`;

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-keluar');
    const tbody = document.getElementById('tbody-keluar');
    sortState = {};

    let targetData = modeSekarang === 'hold' ? holdDataRaw : rawDataRaw;

    if(modeSekarang === 'qrcode' || modeSekarang === 'hold') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded border-slate-300"></th>
                ${thSort(1, 'No', 'w-12 col-no')}
                ${thSort(2, 'Waktu Keluar', 'col-waktu')}
                ${thSort(3, 'QRCode', 'border-r border-slate-500 col-qr')}
                ${thSort(4, 'Tgl Produksi', 'col-tgl')}
                ${thSort(5, 'Mesin', 'col-mesin')}
                ${thSort(6, 'Shift', 'border-r border-slate-500 col-shift')}
                ${thSort(7, 'Jenis Item', 'text-blue-300 col-jenis')}
                ${thSort(8, 'Nama Item', 'col-nama')}
                ${thSort(9, 'Pjg', 'col-pjg')}
                ${thSort(10, 'Grade', 'col-grade')}
                ${thSort(11, 'Dus', 'col-dus')}
                ${thSort(12, 'Shading', 'border-r border-slate-500 col-shading')}
                ${thSort(13, 'PO Bawaan', 'col-po')}
                ${thSort(14, 'PO Tujuan', 'text-amber-300 bg-amber-50/10 col-tujuan')}
                ${thSort(15, 'Keterangan', 'col-ket border-r border-slate-500')}
                ${thSort(16, 'PIC Keluar', 'col-pic')}
            </tr>`;
        
        if(targetData.length === 0) { tbody.innerHTML = '<tr><td colspan="17" class="p-6 font-bold text-slate-400">Tidak ada data.</td></tr>'; return; }
        
        let h = '';
        targetData.forEach((r, i) => {
            const dt = new Date(r.created_at);
            const tglKeluar = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            const td = translateBarcode(r.qrcode);
            const poTarget = extractPOFromSKU(r.id_sku); // Tarik PO Target

            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 text-row transition text-sm">
                    <td class="p-3 text-center col-cb"><input type="checkbox" value="${r.qrcode}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-3 font-bold text-slate-500 text-center col-no">${i+1}</td>
                    <td class="p-3 text-slate-600 font-semibold text-center col-waktu">${tglKeluar}</td>
                    <td class="p-3 font-mono font-bold text-slate-900 text-left bg-slate-50/50 tracking-wider border-r border-slate-200 col-qr">${r.qrcode}</td>
                    <td class="p-3 font-bold text-slate-600 text-center col-tgl">${td.tglProduksi}</td>
                    <td class="p-3 font-bold text-slate-600 text-center col-mesin">${td.mesin}</td>
                    <td class="p-3 font-bold text-slate-600 text-center border-r border-slate-200 col-shift">${td.shift}</td>
                    <td class="p-3 font-black text-blue-700 text-center col-jenis">${td.jenisItem}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${td.namaItem}</td>
                    <td class="p-3 font-bold text-slate-600 text-center col-pjg">${td.panjang}</td>
                    <td class="p-3 font-bold text-slate-800 text-center col-grade">${td.grade}</td>
                    <td class="p-3 font-bold text-slate-800 text-center col-dus">${td.dus}</td>
                    <td class="p-3 font-bold text-slate-600 text-center border-r border-slate-200 col-shading">${td.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 text-center col-po">${td.po}</td>
                    <td class="p-3 font-black text-amber-600 bg-amber-50/50 text-center col-tujuan">${poTarget}</td>
                    <td class="p-3 text-slate-600 font-semibold text-left border-r border-slate-200 col-ket">${r.keterangan || '-'}</td>
                    <td class="p-3 font-bold uppercase text-xs text-slate-400 text-center col-pic">${r.pic_keluar || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if(modeSekarang === 'item' || modeSekarang === 'jasper') {
        const isJasper = modeSekarang === 'jasper';
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded border-slate-300"></th>
                ${thSort(1, 'No', 'w-12 col-no')}
                ${thSort(2, 'Tgl Produksi', 'col-tgl')}
                ${thSort(3, 'Mesin', 'col-mesin')}
                ${thSort(4, 'Shift', 'border-r border-slate-500 col-shift')}
                ${thSort(5, 'Jenis Item', 'col-jenis')}
                ${thSort(6, isJasper ? 'Nama Barang Jasper' : 'Nama Item', 'col-nama')}
                ${thSort(7, 'Pjg', 'col-pjg')}
                ${thSort(8, 'Grade', 'col-grade')}
                ${thSort(9, 'Dus', 'col-dus')}
                ${thSort(10, 'Shading', 'border-r border-slate-500 col-shading')}
                ${thSort(11, 'PO Bawaan', 'col-po')}
                ${thSort(12, 'PO Tujuan', 'text-amber-300 bg-amber-50/10 col-tujuan')}
                ${thSort(13, 'QTY KELUAR (DUS)', 'bg-slate-900 text-emerald-300 border-l border-slate-500 border-r col-qty')}
                ${thSort(14, 'Keterangan', 'border-r border-slate-500 col-ket')}
            </tr>`;
        
        let groups = {};
        targetData.forEach(r => {
            let t = translateBarcode(r.qrcode); 
            let n = isJasper ? t.jasper : t.namaItem;
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let poTarget = extractPOFromSKU(r.id_sku);
            
            let key = `${t.jenisItem}_${n}_${t.panjang}_${t.grade}_${t.dus}_${t.shading}_${t.po}_${poTarget}_${t.tglProduksi}_${t.mesin}_${t.shift}_${ket}`;
            
            if(!groups[key]) {
                groups[key] = { ...t, displayNama: n, qty: 0, qrcodes: [], tj: poTarget, ket: ket };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = '<tr><td colspan="15" class="p-6 font-bold text-slate-400">Kosong.</td></tr>'; return; }

        let h = '';
        arr.forEach((r, i) => {
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 text-row text-center transition text-sm">
                    <td class="p-3 col-cb"><input type="checkbox" value="${r.qrcodes.join(',')}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-3 font-bold text-slate-500 col-no">${i+1}</td>
                    <td class="p-3 font-bold text-slate-600 col-tgl">${r.tglProduksi}</td>
                    <td class="p-3 font-bold text-slate-600 col-mesin">${r.mesin}</td>
                    <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shift">${r.shift}</td>
                    <td class="p-3 font-black text-blue-700 col-jenis">${r.jenisItem}</td>
                    <td class="p-3 font-bold text-slate-800 text-left col-nama">${r.displayNama}</td>
                    <td class="p-3 font-bold text-slate-500 col-pjg">${r.panjang}</td>
                    <td class="p-3 font-semibold text-slate-800 col-grade">${r.grade}</td>
                    <td class="p-3 font-bold text-slate-800 col-dus">${r.dus}</td>
                    <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shading">${r.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/40 col-po">${r.po}</td>
                    <td class="p-3 font-black text-amber-600 bg-amber-50/40 col-tujuan">${r.tj}</td>
                    <td class="p-3 font-black text-base text-emerald-700 bg-emerald-50 border-l border-r border-slate-200 col-qty">${r.qty}</td>
                    <td class="p-3 font-bold text-slate-600 text-left col-ket border-r border-slate-200">${displayKet}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    lucide.createIcons(); jalankanSaring();
}

function toggleSemuaCentang(checked) { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = checked); }

function bersihkanFilter() { 
    const ids = ['f-waktu','f-tujuan','f-qr','f-tgl','f-mesin','f-shift','f-jenis','f-nama','f-pjg','f-grade','f-dus','f-shading','f-po','f-ket','f-pic'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; }); 
    jalankanSaring(); toggleSidebarFilter();
}

function jalankanSaring() {
    const f = {
        waktu: document.getElementById('f-waktu').value.toLowerCase(),
        tujuan: document.getElementById('f-tujuan').value.toLowerCase(),
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
        ket: document.getElementById('f-ket').value.toLowerCase(),
        pic: document.getElementById('f-pic').value.toLowerCase()
    };

    document.querySelectorAll('.text-row').forEach(row => {
        let show = true;
        for(let key in f) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell && !cell.innerText.toLowerCase().includes(f[key])) { show = false; break; }
            }
        }
        row.style.display = show ? '' : 'none';
    });
}

async function aksiMassal(tipe) {
    let checkedValues = [];
    document.querySelectorAll('.row-cb:checked').forEach(cb => { cb.value.split(',').forEach(v => { if(v) checkedValues.push(v); }); });
    if(checkedValues.length === 0) return alert("Centang baris tabel terlebih dahulu!");

    if(tipe === 'salin') {
        let textSalin = "";
        const headers = Array.from(document.querySelectorAll('#thead-keluar th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr'); const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb')) return;
                if(window.getComputedStyle(td).display !== 'none') { rowData.push(td.innerText.trim().replace(/\n/g, ' ')); }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        navigator.clipboard.writeText(textSalin);
        alert(`Tersalin! Buka Excel dan Paste (Ctrl+V).`);
    } 
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat.");
        let ws_data = [];
        const headers = Array.from(document.querySelectorAll('#thead-keluar th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim());
        ws_data.push(headers);
        
        document.querySelectorAll('.text-row').forEach(tr => {
            if(tr.style.display !== 'none' && tr.querySelector('.row-cb:checked')) {
                const rowData = [];
                Array.from(tr.children).forEach(td => {
                    if(td.classList.contains('col-cb')) return;
                    if(window.getComputedStyle(td).display !== 'none') { rowData.push(`"${td.innerText.trim()}"`); }
                });
                ws_data.push(rowData);
            }
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Keluar_Data");
        XLSX.writeFile(wb, `Riwayat_Keluar.xlsx`);
    }
    else if(tipe === 'hold') {
        if(modeSekarang !== 'qrcode') return alert("HOLD hanya bisa dilakukan dari Mode QRCODE.");
        if(!confirm(`Yakin ingin menahan (HOLD) ${checkedValues.length} item ini?\n\n(Hanya memindahkan riwayat, TIDAK MENGEMBALIKAN barang ke Gudang).`)) return;
        
        const btn = document.getElementById('btn-hold'); const ori = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> PROSES...'; btn.disabled = true;

        const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({
            qrcode: r.qrcode, id_sku: r.id_sku, surat_jalan: r.surat_jalan, tujuan: r.tujuan, 
            keterangan: 'DI-HOLD dari Riwayat', pic_keluar: r.pic_keluar
        }));

        try {
            const { error: errAdd } = await db.from('hold_keluar').insert(dataPindah);
            if(errAdd) throw errAdd;
            const { error: errDel } = await db.from('stok_keluar').delete().in('qrcode', checkedValues);
            if(errDel) throw errDel;
            
            alert(`Berhasil Memindahkan ${checkedValues.length} Item ke TABEL HOLD.`);
            muatDataDariSupabase();
        } catch(e) { alert("GAGAL HOLD: " + e.message); }
        finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
    }
    else if(tipe === 'cancel') {
        if(modeSekarang !== 'hold') return alert("CANCEL hanya bisa dilakukan dari Tabel Hold.");
        
        // Simpan data centang ke global variabel untuk diproses pop-up
        globalCheckedCancel = checkedValues;
        
        document.getElementById('cancel-ket').value = '';
        document.getElementById('cancel-area').value = '';
        
        document.getElementById('modal-cancel-hold').classList.remove('hidden');
        document.getElementById('overlay-klik-luar-k').classList.remove('hidden');
    }
}

// EKSEKUSI CANCEL KELUAR VIA POP-UP
async function eksekusiCancelHold() {
    const areaCancel = document.getElementById('cancel-area').value;
    const ketCancel = document.getElementById('cancel-ket').value.trim();

    if(!areaCancel) return alert("Pilih Area Pengembalian terlebih dahulu!");
    if(!ketCancel) return alert("Keterangan retur wajib diisi!");

    const btn = document.getElementById('btn-submit-cancel'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> RETUR STOK...'; btn.disabled = true;

    const dataReturn = holdDataRaw.filter(r => globalCheckedCancel.includes(r.qrcode));
    let insertsStokQr = [];
    let aktualUpdates = {};

    dataReturn.forEach(item => {
        let parts = item.id_sku.split('_');
        let po = '-';
        if(parts.length >= 8) {
            parts[0] = areaCancel; // Timpa Area di SKU dengan pilihan dari Pop Up
            item.id_sku = parts.join('_');
            po = parts[7];
            
            let [a, jenis, nama, pjg, grade, dus, shading] = parts;
            let key = `${nama}_${pjg}_${grade}_${dus}_${shading}_${po}`;
            if(!aktualUpdates[key]) aktualUpdates[key] = { nama_item: nama, pjg: pjg, grade: grade, dus: dus, shading: shading, po_aktual: po, qty: 0 };
            aktualUpdates[key].qty++;
        }

        // Kembalikan ke fisik stok_qr
        insertsStokQr.push({
            qrcode: item.qrcode,
            id_sku: item.id_sku,
            area: areaCancel, 
            keterangan: ketCancel // Keterangan ini akan tampil cantik di Kartu Stok
        });
    });

    try {
        // 1. Masukkan fisik ke stok_qr
        const { error: e1 } = await db.from('stok_qr').insert(insertsStokQr);
        if(e1) throw e1;

        // 2. Kembalikan tabungan di stok_aktual
        for(let key in aktualUpdates) {
            let u = aktualUpdates[key];
            const {data: curData} = await db.from('stok_aktual').select('id, qty').eq('nama_item', u.nama_item).eq('pjg', u.pjg).eq('grade', u.grade).eq('dus', u.dus).eq('shading', u.shading).eq('po_aktual', u.po_aktual).single();
            if(curData) {
                await db.from('stok_aktual').update({qty: curData.qty + u.qty}).eq('id', curData.id);
            } else {
                await db.from('stok_aktual').insert([{...u}]); 
            }
        }

        // 3. Bersihkan dari tabel hold_keluar (karena sudah sukses diretur)
        const { error: e3 } = await db.from('hold_keluar').delete().in('qrcode', globalCheckedCancel);
        if(e3) throw e3;

        alert(`✅ SUKSES CANCEL KELUAR!\n${globalCheckedCancel.length} item telah dikembalikan ke Kartu Stok pada Area "${areaCancel}".`);
        muatDataDariSupabase();
        tutupPopups();
    } catch(e) { alert("GAGAL RETUR: " + e.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}
