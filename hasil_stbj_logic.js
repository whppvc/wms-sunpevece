let modeSekarang = 'qrcode'; 
let tabelSekarang = 'hasil_stbj'; 
let rawDataRaw = [];
let kamusData = [];
let jasperData = [];
let sortState = {}; 
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'hasil_stbj', title: 'HASIL STBJ', url: 'hasil_stbj.html' });
    setTimeout(async () => {
        await loadKamusDanJasper();
        await muatDataDariSupabase();
    }, 200);
});

// FUNGSI SORT TABEL
function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-stbj');
    const rows = Array.from(tbody.querySelectorAll('tr.text-row'));
    
    let isAsc = sortState[colIndex] !== 'asc';
    sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].innerText.trim();
        let valB = b.cells[colIndex].innerText.trim();
        
        let numA = parseFloat(valA);
        let numB = parseFloat(valB);
        
        if(!isNaN(numA) && !isNaN(numB)) {
            return isAsc ? numA - numB : numB - numA;
        } else {
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.setAttribute('data-lucide', 'arrow-up-down'); 
        icon.classList.add('opacity-50');
    });
    
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) {
        icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a');
        icon.classList.remove('opacity-50');
        lucide.createIcons();
    }
}

function toggleSidebarFilter() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar-k').classList.toggle('hidden');
}

function tutupPopups() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar-k').classList.add('hidden');
}

async function loadKamusDanJasper() {
    const { data: d2 } = await db.from('master_2').select('*'); if(d2) kamusData = d2;
    try {
        const { data: dj } = await db.from('nama_jasper').select('*').order('created_at', {ascending: false});
        if(dj) jasperData = dj;
    } catch(e) { console.log("Tabel nama_jasper belum siap."); }
}

async function muatDataDariSupabase() {
    const tbody = document.getElementById('tbody-stbj');
    tbody.innerHTML = `<tr><td colspan="22" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data...</p></td></tr>`;
    lucide.createIcons();
    try {
        const { data, error } = await db.from(tabelSekarang).select('*').order('created_at', {ascending: false});
        if(error) throw error;
        
        if(data && data.length > 0) {
            const qrs = data.map(d => d.qrcode);
            const { data: stokData } = await db.from('stok_qr').select('qrcode').in('qrcode', qrs);
            const stokSet = new Set((stokData || []).map(d => d.qrcode));
            data.forEach(d => { d.is_in_gudang = stokSet.has(d.qrcode); });
        }

        rawDataRaw = data || [];
        renderHeaderDanTabel();
    } catch(err) { tbody.innerHTML = `<tr><td colspan="22" class="p-10 text-red-500 font-bold">Gagal memuat: ${err.message}</td></tr>`; }
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
    ['qrcode', 'item', 'jasper'].forEach(tab => {
        const el = document.getElementById('tab-mode-' + tab);
        if(el) {
            if(m === tab) el.className = 'px-6 py-4 border-b-4 border-blue-800 text-blue-800 font-black text-xs whitespace-nowrap flex items-center gap-2 transition';
            else el.className = 'px-6 py-4 border-b-4 border-transparent text-slate-500 font-bold text-xs whitespace-nowrap flex items-center gap-2 hover:text-slate-800 transition';
        }
    });
    
    const btnCollect = document.getElementById('btn-massal-collect');
    const btnHold = document.getElementById('btn-hold');
    if (m === 'item' || m === 'jasper') {
        btnCollect.classList.remove('hidden');
        btnHold.classList.add('hidden');
    } else {
        btnCollect.classList.add('hidden');
        btnHold.classList.remove('hidden');
    }

    renderHeaderDanTabel();
}

function switchTable(val) { tabelSekarang = val; muatDataDariSupabase(); }

// --- RENDER KATALOG JASPER ---
function bukaDaftarKatalog() {
    renderKatalogList();
    document.getElementById('modal-list-katalog').classList.remove('hidden');
}

function renderKatalogList() {
    const tbody = document.getElementById('tbody-katalog-list');
    if (!jasperData || jasperData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-slate-400 font-bold">Katalog Jasper Kosong di Database.</td></tr>'; 
        return;
    }

    let html = '';
    jasperData.forEach((d, i) => {
        const jData = encodeURIComponent(JSON.stringify(d));
        html += `
        <tr class="border-b border-slate-200 hover:bg-slate-50 transition text-center">
            <td class="p-2">
                <button onclick="bukaModalKatalogForm(true, '${jData}')" class="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded shadow-sm transition active:scale-95" title="Edit Baris Ini">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
            </td>
            <td class="p-3 font-bold text-slate-400">${i+1}</td>
            <td class="p-3 font-bold text-slate-800 text-left">${d.nama_item}</td>
            <td class="p-3 font-bold text-slate-600">${d.panjang || '-'}</td>
            <td class="p-3 font-bold text-slate-600 border-r border-slate-200">${d.grade || '-'}</td>
            <td class="p-3 font-black text-blue-700 bg-blue-50/50">${d.nama_jasper}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    lucide.createIcons(); 
}

function saringKatalogList() {
    const query = document.getElementById('f-kat-search').value.toLowerCase();
    document.querySelectorAll('#tbody-katalog-list tr').forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function bukaModalKatalogForm(isEdit = false, encodedData = null) {
    document.getElementById('modal-katalog').classList.remove('hidden');
    
    const title = document.getElementById('title-modal-jasper');
    title.innerHTML = isEdit 
        ? '<i data-lucide="edit" class="w-4 h-4 text-amber-600"></i> EDIT DATA JASPER' 
        : '<i data-lucide="plus-circle" class="w-4 h-4 text-blue-600"></i> TAMBAH JASPER BARU';
    
    if(isEdit && encodedData) {
        const d = JSON.parse(decodeURIComponent(encodedData));
        document.getElementById('j-id').value = d.id || ''; 
        document.getElementById('j-nama').value = d.nama_item || '';
        document.getElementById('j-pjg').value = d.panjang || '';
        document.getElementById('j-grade').value = d.grade || '';
        document.getElementById('j-output').value = d.nama_jasper || '';
    } else {
        document.getElementById('j-id').value = '';
        document.getElementById('j-nama').value = '';
        document.getElementById('j-pjg').value = '';
        document.getElementById('j-grade').value = '';
        document.getElementById('j-output').value = '';
    }
}

function tutupModalJasperForm() {
    document.getElementById('modal-katalog').classList.add('hidden');
}

async function simpanDataJasper() {
    const id = document.getElementById('j-id').value;
    const nama = document.getElementById('j-nama').value.trim();
    const pjg = document.getElementById('j-pjg').value.trim();
    const grade = document.getElementById('j-grade').value.trim();
    const output = document.getElementById('j-output').value.trim();

    if(!nama || !output) return alert("PERHATIAN: Nama Item Master dan Nama Output Jasper Wajib Diisi!");

    const btn = document.getElementById('btn-save-jasper');
    const oriTxt = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...';
    btn.disabled = true;

    const payload = {
        nama_item: nama,
        panjang: pjg,
        grade: grade,
        nama_jasper: output
    };

    try {
        let errorRes;
        if(id) {
            const { error } = await db.from('nama_jasper').update(payload).eq('id', id);
            errorRes = error;
        } else {
            const { error } = await db.from('nama_jasper').insert([payload]);
            errorRes = error;
        }

        if(errorRes) throw errorRes;
        
        tutupModalJasperForm();
        
        document.getElementById('tbody-katalog-list').innerHTML = '<tr><td colspan="6" class="p-6 text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat ulang tabel...</td></tr>';
        lucide.createIcons();
        
        await loadKamusDanJasper(); 
        renderKatalogList(); 
        alert("Berhasil! Data Katalog Jasper telah tersimpan.");
        
    } catch(e) {
        alert("GAGAL MENYIMPAN: " + e.message);
    } finally {
        btn.innerHTML = oriTxt;
        btn.disabled = false;
        lucide.createIcons();
    }
}

function renderHeaderDanTabel() {
    const thead = document.getElementById('thead-stbj');
    const tbody = document.getElementById('tbody-stbj');
    sortState = {};

    if(modeSekarang === 'qrcode') {
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600"></th>
                <th class="hdr-std w-10 col-btn"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-rose-400"></i></th>
                <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-status-gudang cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">Status Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                ${tabelSekarang === 'hold_stbj' ? '<th class="hdr-std text-amber-400 col-status cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Status Hold <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>' : '<th class="hdr-std hidden col-status">Status Hold</th>'}
                <th class="hdr-std col-status-data text-indigo-300 cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?5:4}, this)"><div class="flex items-center justify-center gap-1">Status Data <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-waktu cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?6:5}, this)"><div class="flex items-center justify-center gap-1">Waktu Scan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-amber-300 col-troli cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?7:6}, this)"><div class="flex items-center justify-center gap-1">Troli <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-qr cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?8:7}, this)"><div class="flex items-center justify-center gap-1">QRCode <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-tgl cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?9:8}, this)"><div class="flex items-center justify-center gap-1">Tgl Produksi <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-mesin cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?10:9}, this)"><div class="flex items-center justify-center gap-1">Mesin <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shift cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?11:10}, this)"><div class="flex items-center justify-center gap-1">Shift <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-blue-300 col-jenis cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?12:11}, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-left pl-4 col-nama cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?13:12}, this)"><div class="flex items-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?14:13}, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?15:14}, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-dus cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?16:15}, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shading cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?17:16}, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-po cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?18:17}, this)"><div class="flex items-center justify-center gap-1">PO Awal <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-ket text-center cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?19:18}, this)"><div class="flex items-center justify-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pic border-l border-slate-500 cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(${tabelSekarang==='hold_stbj'?20:19}, this)"><div class="flex items-center justify-center gap-1">PIC Input <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
            </tr>`;
        
        if(rawDataRaw.length === 0) { tbody.innerHTML = '<tr><td colspan="22" class="p-6 font-bold text-slate-400">Tabel Kosong.</td></tr>'; return; }
        
        let h = '';
        rawDataRaw.forEach((r, i) => {
            const dt = new Date(r.created_at);
            const dd = String(dt.getDate()).padStart(2, '0');
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const yy = String(dt.getFullYear()).slice(-2);
            const hh = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');
            const tgl = `${dd}/${mm}/${yy} ${hh}:${min}`;

            const td = translateBarcode(r.qrcode);
            const htmlStatusGudang = r.is_in_gudang ? '<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">IN GUDANG</span>' : '<span class="bg-blue-100 text-blue-800 border border-blue-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">STBJ</span>';
            
            const statData = r.status_data === 'Collected' 
                ? '<span class="bg-indigo-100 text-indigo-700 font-black px-2 py-1 rounded shadow-sm border border-indigo-200">COLLECTED</span>' 
                : '<span class="text-slate-400 font-bold">-</span>';

            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 text-row transition text-[11px]">
                    <td class="p-3 text-center col-cb"><input type="checkbox" value="${r.qrcode}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-2 text-center col-btn">
                        <button onclick="aksiHapusPerBaris('${r.qrcode}')" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded transition shadow-sm active:scale-95 mx-auto flex">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                    <td class="p-3 font-bold text-slate-400 text-center col-no">${i+1}</td>
                    <td class="p-3 font-black text-center border-r border-slate-200 col-status-gudang">${htmlStatusGudang}</td>
                    ${tabelSekarang === 'hold_stbj' ? `<td class="p-3 font-black text-[10px] text-amber-600 bg-amber-50 text-center col-status">${r.status || 'HOLD'}</td>` : '<td class="p-3 hidden col-status">-</td>'}
                    <td class="p-3 font-black text-center col-status-data text-[10px]">${statData}</td>
                    <td class="p-3 text-slate-600 font-semibold text-center col-waktu">${tgl}</td>
                    <td class="p-3 font-bold text-slate-700 text-center col-troli">${r.troli || '-'}</td>
                    <td class="p-3 font-mono font-bold text-slate-900 text-left s-qr bg-slate-50/50 tracking-wider border-r border-slate-200 col-qr">${r.qrcode}</td>
                    <td class="p-3 font-bold text-slate-600 text-center col-tgl">${td.tglProduksi}</td>
                    <td class="p-3 font-bold text-slate-600 text-center col-mesin">${td.mesin}</td>
                    <td class="p-3 font-bold text-slate-600 text-center border-r border-slate-200 col-shift">${td.shift}</td>
                    <td class="p-3 font-black text-blue-700 s-jenis text-center col-jenis">${td.jenisItem}</td>
                    <td class="p-3 font-bold text-slate-800 text-left s-nama col-nama">${td.namaItem}</td>
                    <td class="p-3 font-bold text-slate-600 text-center col-pjg">${td.panjang}</td>
                    <td class="p-3 font-bold text-slate-800 text-center col-grade">${td.grade}</td>
                    <td class="p-3 font-bold text-slate-800 text-center col-dus">${td.dus}</td>
                    <td class="p-3 font-bold text-slate-600 text-center border-r border-slate-200 col-shading">${td.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 s-po text-center col-po">${td.po}</td>
                    <td class="p-3 text-slate-600 font-semibold text-center col-ket text-[11px]">${r.keterangan || '-'}</td>
                    <td class="p-3 font-bold uppercase text-[10px] text-slate-400 text-center border-l border-slate-200 col-pic">${r.pic_input || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } 
    else if(modeSekarang === 'item' || modeSekarang === 'jasper') {
        const isJasper = modeSekarang === 'jasper';
        thead.innerHTML = `
            <tr>
                <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer rounded text-blue-600"></th>
                <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(1, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-status-gudang hidden">Status Item</th>
                <th class="hdr-std col-status hidden">Status Hold</th>
                <th class="hdr-std col-status-data text-indigo-300 cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Status Data <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-waktu hidden">Waktu Scan</th>
                <th class="hdr-std text-amber-300 col-troli cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Troli Gabungan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-qr hidden">QRCode</th>
                <th class="hdr-std col-tgl cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Tgl Produksi <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-mesin cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(9, this)"><div class="flex items-center justify-center gap-1">Mesin <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shift cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(10, this)"><div class="flex items-center justify-center gap-1">Shift <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-jenis cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(11, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-left pl-4 col-nama cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(12, this)"><div class="flex items-center gap-1">${isJasper ? 'Nama Barang Jasper' : 'Nama Item'} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(13, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(14, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-dus cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(15, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std border-r border-slate-500 col-shading cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(16, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-po cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(17, this)"><div class="flex items-center justify-center gap-1">PO Aktual <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std bg-slate-900 text-blue-300 col-qty border-l border-slate-500 border-r cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(18, this)"><div class="flex items-center justify-center gap-1">QTY (DUS) <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std text-center pl-4 col-ket border-r border-slate-500 cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(19, this)"><div class="flex items-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                <th class="hdr-std col-pic hidden">PIC Input</th>
            </tr>`;
        
        let groups = {};
        rawDataRaw.forEach(r => {
            let t = translateBarcode(r.qrcode); 
            let n = isJasper ? t.jasper : t.namaItem;
            
            let ket = r.keterangan || 'TANPA_KETERANGAN';
            let sData = r.status_data || 'BELUM';
            let key = `${t.jenisItem}_${n}_${t.panjang}_${t.grade}_${t.dus}_${t.shading}_${t.po}_${t.tglProduksi}_${t.mesin}_${t.shift}_${ket}_${sData}`;
            
            if(!groups[key]) {
                groups[key] = { ...t, displayNama: n, qty: 0, qrcodes: [], trolis: new Set(), ket: ket, sData: sData };
            }
            groups[key].qty++; 
            groups[key].qrcodes.push(r.qrcode);
            if(r.troli) groups[key].trolis.add(r.troli);
        });

        let arr = Object.values(groups);
        if(arr.length === 0) { tbody.innerHTML = '<tr><td colspan="20" class="p-6 font-bold text-slate-400">Kosong.</td></tr>'; return; }

        let h = '';
        arr.forEach((r, i) => {
            const gabunganTroli = Array.from(r.trolis).join(', ') || '-';
            const displayKet = (r.ket === 'TANPA_KETERANGAN') ? '-' : r.ket; 
            const statData = r.sData === 'Collected' 
                ? '<span class="bg-indigo-100 text-indigo-700 font-black px-2 py-1 rounded shadow-sm border border-indigo-200">COLLECTED</span>' 
                : '<span class="text-slate-400 font-bold">-</span>';

            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 text-row text-center transition text-[11px]">
                    <td class="p-3 col-cb"><input type="checkbox" value="${r.qrcodes.join(',')}" class="row-cb cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                    <td class="p-3 font-bold text-slate-400 col-no">${i+1}</td>
                    <td class="p-3 hidden col-status-gudang">-</td>
                    <td class="p-3 hidden col-status">-</td>
                    <td class="p-3 font-black text-center col-status-data text-[10px]">${statData}</td>
                    <td class="p-3 hidden col-waktu">-</td>
                    <td class="p-3 font-bold text-slate-700 col-troli text-[11px]">${gabunganTroli}</td>
                    <td class="p-3 hidden col-qr">-</td>
                    <td class="p-3 font-bold text-slate-600 col-tgl">${r.tglProduksi}</td>
                    <td class="p-3 font-bold text-slate-600 col-mesin">${r.mesin}</td>
                    <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shift">${r.shift}</td>
                    <td class="p-3 font-black text-blue-700 s-jenis col-jenis">${r.jenisItem}</td>
                    <td class="p-3 font-bold text-slate-800 text-left s-nama col-nama">${r.displayNama}</td>
                    <td class="p-3 font-bold text-slate-500 col-pjg">${r.panjang}</td>
                    <td class="p-3 font-semibold text-slate-800 col-grade">${r.grade}</td>
                    <td class="p-3 font-bold text-slate-800 col-dus">${r.dus}</td>
                    <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shading">${r.shading}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/40 s-po col-po">${r.po}</td>
                    <td class="p-3 font-black text-base text-blue-700 bg-blue-50 border-l border-r border-slate-200 col-qty">${r.qty}</td>
                    <td class="p-3 font-bold text-slate-600 text-left col-ket text-[11px] border-r border-slate-200">${displayKet}</td>
                    <td class="p-3 hidden col-pic">-</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    }
    lucide.createIcons(); jalankanSaring();
}

function toggleSemuaCentang(checked) { document.querySelectorAll('.row-cb').forEach(cb => cb.checked = checked); }

function bersihkanFilter() { 
    const ids = ['f-sgudang','f-sdata','f-waktu','f-troli','f-qr','f-tgl','f-mesin','f-shift','f-jenis','f-nama','f-pjg','f-grade','f-dus','f-shading','f-po','f-ket','f-pic'];
    ids.forEach(id => document.getElementById(id).value = ''); 
    jalankanSaring(); toggleSidebarFilter();
}

function jalankanSaring() {
    const f = {
        'status-gudang': document.getElementById('f-sgudang').value.toLowerCase(),
        'status-data': document.getElementById('f-sdata').value.toLowerCase(),
        waktu: document.getElementById('f-waktu').value.toLowerCase(),
        troli: document.getElementById('f-troli').value.toLowerCase(),
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

// REVISI: Fungsi Hapus Baris
async function aksiHapusPerBaris(qrcode) {
    if(!confirm(`Hapus permanen QRCode ini dari tabel ${tabelSekarang}?`)) return;
    try {
        const { error } = await db.from(tabelSekarang).delete().eq('qrcode', qrcode);
        if(error) throw error;
        await muatDataDariSupabase();
    } catch(e) { alert("Gagal hapus: " + e.message); }
}

async function aksiMassal(tipe) {
    let checkedValues = [];
    document.querySelectorAll('.row-cb:checked').forEach(cb => { cb.value.split(',').forEach(v => { if(v) checkedValues.push(v); }); });
    if(checkedValues.length === 0) return alert("Centang baris tabel terlebih dahulu!");

    if(tipe === 'salin') {
        let textSalin = "";
        const headers = Array.from(document.querySelectorAll('#thead-stbj th'))
            .filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb') && !th.classList.contains('col-btn'))
            .map(th => th.innerText.trim().replace(/\n/g, ' '));
        textSalin += headers.join('\t') + '\n';

        document.querySelectorAll('.row-cb:checked').forEach(cb => {
            const tr = cb.closest('tr');
            const rowData = [];
            Array.from(tr.children).forEach(td => {
                if(td.classList.contains('col-cb') || td.classList.contains('col-btn')) return;
                if(window.getComputedStyle(td).display !== 'none') {
                    rowData.push(td.innerText.trim().replace(/\n/g, ' '));
                }
            });
            textSalin += rowData.join('\t') + '\n';
        });
        navigator.clipboard.writeText(textSalin);
        alert(`Tersalin baris! Buka Excel dan Paste (Ctrl+V).`);
    } 
    else if(tipe === 'hold') {
        if(tabelSekarang === 'hasil_stbj') {
            if(!confirm(`Pindahkan ${checkedValues.length} data HASIL -> tabel HOLD (Duplikat)?`)) return;
            const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({ qrcode: r.qrcode, troli: r.troli, pic_input: r.pic_input, keterangan: r.keterangan, status: 'HOLD' }));
            const { error: errAdd } = await db.from('hold_stbj').upsert(dataPindah);
            if(!errAdd) { await db.from('hasil_stbj').delete().in('qrcode', checkedValues); alert("Dipindahkan ke HOLD!"); muatDataDariSupabase(); }
        } else {
            if(!confirm(`Unhold ${checkedValues.length} data HOLD -> tabel HASIL (Unique)?`)) return;
            const dataPindah = rawDataRaw.filter(r => checkedValues.includes(r.qrcode)).map(r => ({ qrcode: r.qrcode, troli: r.troli, pic_input: r.pic_input, keterangan: r.keterangan }));
            const { error: errAdd } = await db.from('hasil_stbj').upsert(dataPindah);
            if(!errAdd) { await db.from('hold_stbj').delete().in('qrcode', checkedValues); alert("Di-unhold ke HASIL!"); muatDataDariSupabase(); }
        }
    }
    else if (tipe === 'collect') {
        if(!confirm(`Tandai ${checkedValues.length} QrCode sebagai COLLECTED?`)) return;
        const btn = document.getElementById('btn-massal-collect');
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> PROSES...'; btn.disabled = true;
        
        const { error } = await db.from(tabelSekarang).update({ status_data: 'Collected' }).in('qrcode', checkedValues);
        if(error) alert("Gagal Update: " + error.message); 
        else { alert("Berhasil ditandai sebagai Collected!"); muatDataDariSupabase(); }
        
        btn.innerHTML = '<i data-lucide="check-square" class="w-4 h-4"></i> COLLECT'; btn.disabled = false; lucide.createIcons();
    }
    else if(tipe === 'xlsx') {
        if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
        let ws_data = [["NO", "STATUS_GUDANG", "STATUS_DATA", "TROLI", "QRCODE", "TGL_PRODUKSI", "MESIN", "SHIFT", "JENIS", "NAMA_ITEM", "PANJANG", "GRADE", "DUS", "SHADING", "PO", "KETERANGAN"]];
        
        checkedValues.forEach((qr, idx) => {
            let t = translateBarcode(qr);
            let dbRow = rawDataRaw.find(x => x.qrcode === qr);
            let n = modeSekarang === 'jasper' ? t.jasper : t.namaItem;
            let statGudang = dbRow?.is_in_gudang ? "IN GUDANG" : "STBJ";
            let statData = dbRow?.status_data || "-";
            
            // REVISI 8: Gunakan String.slice() atau localeString untuk format di excel (terserah, karena CSV murni text)
            const dt = new Date(dbRow?.created_at || new Date());
            const formattedTgl = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

            ws_data.push([
                idx + 1, statGudang, statData, dbRow ? dbRow.troli : '', qr, t.tglProduksi, t.mesin, 
                t.shift, t.jenisItem, n, t.panjang, t.grade, t.dus, t.shading, t.po, dbRow?.keterangan || '-'
            ]);
        });

        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "STBJ_Data");
        XLSX.writeFile(wb, `STBJ_${tabelSekarang}.xlsx`);
    }
}
