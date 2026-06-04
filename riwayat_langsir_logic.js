let modeRiwayat = 'qr'; 
let logLangsirRaw = []; let holdLangsirRaw = [];
let kamusData = []; let areaData = []; 
let sortState = {}; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'riwayat_langsir', title: 'RIWAYAT LANGSIR', url: 'riwayat_langsir.html' });
    setTimeout(async () => {
        const { data: mk } = await db.from('master_2').select('*'); if(mk) kamusData = mk;
        const { data: ma } = await db.from('master_area').select('nama_area'); 
        if(ma) {
            areaData = ma.map(m => m.nama_area);
            const selArea = document.getElementById('select-new-area');
            selArea.innerHTML = '<option value="">-- PILIH AREA --</option>';
            areaData.forEach(a => selArea.innerHTML += `<option value="${a}">${a}</option>`);
        }
        await ambilSemuaData();
        gantiModeRiwayat('qr');
    }, 200);
});

function sortTable(colIndex, headerEl) {
    const tbody = document.getElementById('tbody-riwayat');
    const rows = Array.from(tbody.querySelectorAll('tr.r-row'));
    
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

async function ambilSemuaData() {
    document.getElementById('tbody-riwayat').innerHTML = `<tr><td colspan="19" class="p-10"><i data-lucide="loader-2" class="animate-spin w-8 h-8 mx-auto mb-2 text-slate-500"></i><p class="font-bold text-slate-500">Menarik Data...</p></td></tr>`;
    try {
        const [resRiwayat, resHold] = await Promise.all([
            db.from('stok_qr').select('*').order('created_at', {ascending: false}).limit(1000),
            db.from('hold_langsir').select('*').order('created_at', {ascending: false})
        ]);
        if(resRiwayat.data) logLangsirRaw = resRiwayat.data;
        if(resHold.data) holdLangsirRaw = resHold.data;
        renderTabelRiwayat();
    } catch(e) { document.getElementById('tbody-riwayat').innerHTML = `<tr><td colspan="19" class="p-10 text-red-500 font-bold">Error: ${e.message}</td></tr>`; }
}

function translateBarcode(barcode) {
    let data = { tglProduksi: '-', mesin: '-', shift: '-', jenis: '-', nama: '-', pjg: '-', grade: '-', dus: '-', shading: '-', po: '-' };
    if(!barcode) return data;
    const parts = barcode.split('/'); if (parts.length < 1) return data;
    const h = barcode.charAt(0).toUpperCase();
    if (h === 'P') data.jenis = 'Plafon'; else if (h === 'L') data.jenis = 'List'; else if (h === 'W') data.jenis = 'WPC'; else data.jenis = h;

    let rawItem = parts[0]; let cariItem = kamusData.find(m => m.kode_nama_item === rawItem);
    data.nama = cariItem && cariItem.nama_item ? cariItem.nama_item : rawItem; data.shading = parts[1] || '-';

    const p2 = parts[2];
    if(p2 && p2.length >= 4) {
        let digitPjg = (p2.length === 5) ? 2 : 1; let rawPjg = p2.substring(0, digitPjg);
        data.pjg = (digitPjg === 1) ? rawPjg + "M" : rawPjg[0] + "." + rawPjg[1] + "M";
        let rawGrade = p2.substring(digitPjg, digitPjg + 1); data.grade = rawGrade === '1' ? 'BAGUS' : (rawGrade === '2' ? 'A' : rawGrade);
        let rawDus = p2.substring(p2.length - 2); let cariDus = kamusData.find(m => m.kode_dus === rawDus); data.dus = cariDus ? cariDus.dus : rawDus;
    }

    const p3 = parts[3];
    if(p3 && p3.length >= 5) {
        const dayOfYear = parseInt(p3.substring(0, 3)); const realYear = parseInt('20' + p3.substring(3, 5).split('').reverse().join(''));
        const dateObj = new Date(realYear, 0); dateObj.setDate(dayOfYear);
        data.tglProduksi = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
        
        let sisaString = p3.substring(5); let match = sisaString.match(/(C.*?)(S.*?)(P.*)/);
        if(match) {
            let cMesin = kamusData.find(m => m.kode_mesin === match[1]); data.mesin = cMesin ? cMesin.mesin : match[1];
            let cShift = kamusData.find(m => m.kode_shift === match[2]); data.shift = cShift ? cShift.shift : match[2];
            let cPO = kamusData.find(m => m.kode_po === match[3]); data.po = cPO ? cPO.po : match[3];
        }
    }
    return data;
}

function gantiModeRiwayat(m) {
    modeRiwayat = m;
    ['qr', 'agregasi', 'hold'].forEach(tab => {
        const el = document.getElementById('tab-r-' + tab);
        if(el) {
            if(m === tab) el.className = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
            else el.className = 'px-6 py-3.5 tab-inactive hover:text-slate-800 hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        }
    });
    
    document.getElementById('btn-ganti-area').classList.toggle('hidden', m !== 'qr');
    document.getElementById('btn-cancel-langsir').classList.toggle('hidden', m !== 'qr');
    
    const userRole = (currentUser.role || '').toLowerCase();
    const canDeleteHold = ['creator', 'admin', 'pic area'].includes(userRole);
    const btnHapusHold = document.getElementById('btn-hapus-hold');
    
    if(m === 'hold' && canDeleteHold) {
        btnHapusHold.classList.remove('hidden');
    } else {
        btnHapusHold.classList.add('hidden');
    }

    renderTabelRiwayat();
}

function toggleSemuaCentang(checked) { document.querySelectorAll('.cb-row').forEach(cb => cb.checked = checked); }

function renderTabelRiwayat() {
    try {
        const thead = document.getElementById('thead-riwayat');
        const tbody = document.getElementById('tbody-riwayat');
        sortState = {}; 

        if(modeRiwayat === 'qr' || modeRiwayat === 'hold') {
            const isHold = modeRiwayat === 'hold';
            const dataset = isHold ? holdLangsirRaw : logLangsirRaw;
            
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded"></th>
                    <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(1, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 col-waktu cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">Waktu Masuk <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    ${isHold ? `<th class="hdr-std col-troli text-amber-300 cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">Troli <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>` : `<th class="hdr-std col-troli hidden">Troli</th>`}
                    <th class="hdr-std border-r border-slate-500 col-area cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Area <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 col-qr cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(5, this)"><div class="flex items-center justify-center gap-1">QRCode <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-tgl cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Tgl Produksi <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-mesin cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(7, this)"><div class="flex items-center justify-center gap-1">Mesin <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 col-shift cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Shift <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std text-blue-300 col-jenis cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(9, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-nama cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(10, this)"><div class="flex items-center justify-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(11, this)"><div class="flex items-center justify-center gap-1">Pjg <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(12, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 col-dus cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(13, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-shading cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(14, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 text-orange-400 col-po cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(15, this)"><div class="flex items-center justify-center gap-1">PO Awal <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    ${isHold ? `<th class="hdr-std col-ket text-amber-300 cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(16, this)"><div class="flex items-center justify-center gap-1">Keterangan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>` : `<th class="hdr-std col-ket hidden">Keterangan</th>`}
                    <th class="hdr-std col-pic cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(17, this)"><div class="flex items-center justify-center gap-1">User / PIC <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                </tr>`;
            
            if(dataset.length === 0) { tbody.innerHTML = `<tr><td colspan="18" class="p-6 text-slate-400 font-bold">Belum ada data ${isHold ? 'Hold' : 'Riwayat'}.</td></tr>`; return; }
            
            let h = '';
            dataset.forEach((r, i) => {
                const trans = translateBarcode(r.qrcode);
                const dt = new Date(r.created_at);
                const dd = String(dt.getDate()).padStart(2, '0');
                const mm = String(dt.getMonth() + 1).padStart(2, '0');
                const yy = String(dt.getFullYear()).slice(-2);
                const hh = String(dt.getHours()).padStart(2, '0');
                const min = String(dt.getMinutes()).padStart(2, '0');
                const tgl = `${dd}/${mm}/${yy}, ${hh}:${min}`;

                h += `
                    <tr class="border-b border-slate-200 hover:bg-slate-100 transition r-row text-xs">
                        <td class="p-3 col-cb"><input type="checkbox" value="${r.qrcode}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                        <td class="p-3 font-bold text-slate-400 col-no">${i+1}</td>
                        <td class="p-3 text-slate-600 border-r border-slate-200 font-semibold col-waktu">${tgl}</td>
                        ${isHold ? `<td class="p-3 font-bold text-slate-700 col-troli">${r.troli || '-'}</td>` : `<td class="p-3 hidden col-troli">-</td>`}
                        <td class="p-3 font-black text-emerald-600 border-r border-slate-200 col-area">${r.area || '-'}</td>
                        <td class="p-3 font-mono font-bold text-slate-900 text-left bg-slate-50 tracking-wider border-r border-slate-200 col-qr">${r.qrcode}</td>
                        <td class="p-3 font-bold text-slate-600 col-tgl">${trans.tglProduksi}</td>
                        <td class="p-3 font-bold text-slate-600 col-mesin">${trans.mesin}</td>
                        <td class="p-3 font-bold text-slate-600 border-r border-slate-200 col-shift">${trans.shift}</td>
                        <td class="p-3 font-black text-blue-700 col-jenis">${trans.jenis}</td>
                        <td class="p-3 font-bold text-slate-800 text-center col-nama">${trans.nama}</td>
                        <td class="p-3 font-bold text-slate-600 col-pjg">${trans.pjg}</td>
                        <td class="p-3 font-bold text-slate-800 col-grade">${trans.grade}</td>
                        <td class="p-3 font-bold text-slate-800 border-r border-slate-200 col-dus">${trans.dus}</td>
                        <td class="p-3 font-bold text-slate-600 col-shading">${trans.shading}</td>
                        <td class="p-3 font-black text-orange-600 bg-orange-50/50 border-r border-slate-200 col-po">${trans.po}</td>
                        ${isHold ? `<td class="p-3 font-bold text-slate-700 text-left col-ket">${r.keterangan || '-'}</td>` : `<td class="p-3 hidden col-ket">-</td>`}
                        <td class="p-3 font-bold text-[10px] uppercase text-slate-400 col-pic">${r.pic_input || '-'}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        } 
        else if(modeRiwayat === 'agregasi') {
            thead.innerHTML = `
                <tr>
                    <th class="hdr-std w-10 col-cb"><input type="checkbox" onchange="toggleSemuaCentang(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded"></th>
                    <th class="hdr-std w-12 col-no cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(1, this)"><div class="flex items-center justify-center gap-1">No <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 col-area cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(2, this)"><div class="flex items-center justify-center gap-1">Area <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std text-blue-300 col-jenis cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(3, this)"><div class="flex items-center justify-center gap-1">Jenis Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-nama cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(4, this)"><div class="flex items-center justify-center gap-1">Nama Item <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-pjg cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(5, this)"><div class="flex items-center justify-center gap-1">Panjang <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-grade cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(6, this)"><div class="flex items-center justify-center gap-1">Grade <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-dus cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(7, this)"><div class="flex items-center justify-center gap-1">Dus <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-shading cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(8, this)"><div class="flex items-center justify-center gap-1">Shading <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std border-r border-slate-500 col-po cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(9, this)"><div class="flex items-center justify-center gap-1">PO Bawaan <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std col-pic cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(10, this)"><div class="flex items-center justify-center gap-1">PIC Input <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                    <th class="hdr-std text-emerald-300 col-qty cursor-pointer hover:bg-slate-700 transition select-none" onclick="sortTable(11, this)"><div class="flex items-center justify-center gap-1">QTY TOTAL (DUS) <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-50"></i></div></th>
                </tr>`;

            let groups = {};
            logLangsirRaw.forEach(r => {
                const trans = translateBarcode(r.qrcode);
                let key = `${r.area}_${trans.jenis}_${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${trans.po}_${r.pic_input}`;
                if(!groups[key]) groups[key] = { area: r.area, jenis: trans.jenis, nama: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, po: trans.po, pic: r.pic_input, qty: 0 };
                groups[key].qty++;
            });

            let arr = Object.values(groups);
            if(arr.length === 0) { tbody.innerHTML = '<tr><td colspan="12" class="p-6 text-slate-400 font-bold">Kosong.</td></tr>'; return; }

            let h = '';
            arr.forEach((r, i) => {
                h += `
                    <tr class="border-b border-slate-200 hover:bg-slate-50 transition r-row text-xs">
                        <td class="p-3 col-cb"><input type="checkbox" value="agg_${i}" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded"></td>
                        <td class="p-3 font-bold text-slate-400 col-no">${i+1}</td>
                        <td class="p-3 font-black text-emerald-700 bg-emerald-50 border-r border-slate-200 col-area">${r.area}</td>
                        <td class="p-3 font-black text-blue-700 col-jenis">${r.jenis}</td>
                        <td class="p-3 font-bold text-slate-800 text-center col-nama">${r.nama}</td>
                        <td class="p-3 font-bold text-slate-600 col-pjg">${r.pjg}</td>
                        <td class="p-3 font-bold text-slate-800 col-grade">${r.grade}</td>
                        <td class="p-3 font-bold text-slate-800 col-dus">${r.dus}</td>
                        <td class="p-3 font-bold text-slate-600 col-shading">${r.shading}</td>
                        <td class="p-3 font-black text-orange-600 bg-orange-50/40 border-r border-slate-200 col-po">${r.po}</td>
                        <td class="p-3 font-bold uppercase text-[10px] text-slate-500 col-pic">${r.pic || '-'}</td>
                        <td class="p-3 font-black text-xl text-slate-900 bg-slate-100 col-qty">${r.qty}</td>
                    </tr>`;
            });
            tbody.innerHTML = h;
        }
        lucide.createIcons(); saringTabelRiwayat();
    } catch(err) { console.error("Gagal Render Tabel:", err); }
}

async function cancelLangsir() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if(checkedBoxes.length === 0) return alert("Pilih minimal 1 baris yang ingin di-cancel Langsirnya!");
    
    if(!confirm(`Apakah Anda yakin ingin MEMBATALKAN LANGSIR untuk ${checkedBoxes.length} kardus ini?\nSistem akan memotong Kartu Stok Aktual & memindahkan fisik kembali ke Tabel Hold.`)) return;

    const btn = document.getElementById('btn-cancel-langsir');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> PROSES...';
    btn.disabled = true;

    let arrFisik = [];
    let mapAktual = {};
    let mapGlobal = {};
    let payloadHold = [];

    checkedBoxes.forEach(cb => {
        const qr = cb.value;
        const r = logLangsirRaw.find(x => x.qrcode === qr);
        if(r) {
            const trans = translateBarcode(qr);
            
            let keyAkt = `${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${r.area}_${trans.po}_-`;
            if(!mapAktual[keyAkt]) mapAktual[keyAkt] = { jenis_item: trans.jenis, nama_item: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, area: r.area, po_aktual: trans.po, ket: '-', qty: 0 };
            mapAktual[keyAkt].qty++;

            let keyGlb = `${trans.nama}_${trans.pjg}_${trans.grade}_${trans.dus}_${trans.shading}_${trans.po}_-`;
            if(!mapGlobal[keyGlb]) mapGlobal[keyGlb] = { jenis_item: trans.jenis, nama_item: trans.nama, pjg: trans.pjg, grade: trans.grade, dus: trans.dus, shading: trans.shading, po_bawaan: trans.po, ket: '-', qty: 0 };
            mapGlobal[keyGlb].qty++;

            arrFisik.push(qr);
            
            payloadHold.push({
                qrcode: qr,
                troli: r.troli || '-',
                area: r.area || '-',
                keterangan: 'Cancel Langsir (Stok telah dipotong ulang)',
                pic_input: currentUser.username
            });
        }
    });

    try {
        const payloadData = { qrs: arrFisik, aktuals: Object.values(mapAktual), globals: Object.values(mapGlobal) };
        const { error: rpcErr } = await db.rpc('eksekusi_keluar_aman', { payload: payloadData });
        if(rpcErr) throw rpcErr;

        const { error: holdErr } = await db.from('hold_langsir').insert(payloadHold);
        if(holdErr) throw holdErr;

        alert(`✅ SUKSES DIBATALKAN!\n${arrFisik.length} kardus telah ditarik dari Kartu Stok (dikurangi) and dipindahkan ke Tabel Hold untuk dikarantina.`);
        document.querySelector('input[onchange="toggleSemuaCentang(this.checked)"]').checked = false;
        await ambilSemuaData();
    } catch (e) {
        alert("Gagal melakukan Cancel Langsir: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
}

async function hapusBarisHold() {
    if(modeRiwayat !== 'hold') return;
    const checked = document.querySelectorAll('.cb-row:checked');
    if(checked.length === 0) return alert("Pilih baris yang ingin dihapus terlebih dahulu!");
    if(!confirm(`Apakah Anda yakin ingin MENGHAPUS PERMANEN ${checked.length} data HOLD ini dari sistem?`)) return;

    const qrsToDel = Array.from(checked).map(cb => cb.value);
    try {
        const { error } = await db.from('hold_langsir').delete().in('qrcode', qrsToDel);
        if(error) throw error;
        alert("Berhasil dihapus permanen dari Hold!"); 
        document.querySelector('input[onchange="toggleSemuaCentang(this.checked)"]').checked = false;
        await ambilSemuaData();
    } catch(e) { alert("Gagal Menghapus: " + e.message); }
}

function toggleSidebarFilter() { document.getElementById('sidebar-filter').classList.toggle('translate-x-full'); document.getElementById('overlay-klik-luar').classList.toggle('hidden'); }
function tutupPopups() { document.getElementById('sidebar-filter').classList.add('translate-x-full'); document.getElementById('overlay-klik-luar').classList.add('hidden'); tutupModalSTBJ(); }

function resetFilter() {
    const inputs = ['f-waktu','f-troli','f-area','f-qr','f-tgl','f-mesin','f-shift','f-jenis','f-nama','f-pjg','f-grade','f-dus','f-shading','f-po','f-ket','f-pic'];
    inputs.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    saringTabelRiwayat(); toggleSidebarFilter();
}

function saringTabelRiwayat() {
    const f = {
        waktu: document.getElementById('f-waktu').value.toLowerCase(), troli: document.getElementById('f-troli').value.toLowerCase(),
        area: document.getElementById('f-area').value.toLowerCase(), qr: document.getElementById('f-qr').value.toLowerCase(),
        tgl: document.getElementById('f-tgl').value.toLowerCase(), mesin: document.getElementById('f-mesin').value.toLowerCase(),
        shift: document.getElementById('f-shift').value.toLowerCase(), jenis: document.getElementById('f-jenis').value.toLowerCase(),
        nama: document.getElementById('f-nama').value.toLowerCase(), pjg: document.getElementById('f-pjg').value.toLowerCase(),
        grade: document.getElementById('f-grade').value.toLowerCase(), dus: document.getElementById('f-dus').value.toLowerCase(),
        shading: document.getElementById('f-shading').value.toLowerCase(), po: document.getElementById('f-po').value.toLowerCase(),
        ket: document.getElementById('f-ket').value.toLowerCase(), pic: document.getElementById('f-pic').value.toLowerCase()
    };

    document.querySelectorAll('.r-row').forEach(row => {
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

function bukaModalGantiArea() {
    if(modeRiwayat !== 'qr') return alert("Ganti Area hanya bisa dilakukan di mode DETAIL QRCODE.");
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih minimal 1 baris yang ingin diganti areanya!");
    
    document.getElementById('teks-info-area').innerText = `Anda akan memindahkan ${cek.length} kardus ke lokasi baru.`;
    document.getElementById('select-new-area').value = '';
    document.getElementById('modal-ganti-area').classList.remove('hidden');
}

function tutupModalArea() { document.getElementById('modal-ganti-area').classList.add('hidden'); }

async function eksekusiGantiArea() {
    const newArea = document.getElementById('select-new-area').value;
    if(!newArea) return alert("Pilih Area Tujuan!");

    const btn = document.getElementById('btn-eks-area'); const original = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...'; btn.disabled = true;

    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    const qrsToUpdate = Array.from(checkedBoxes).map(cb => cb.value);

    let updates = [];
    for(let qr of qrsToUpdate) {
        let dbRow = logLangsirRaw.find(r => r.qrcode === qr);
        if(dbRow) {
            let newObj = { ...dbRow };
            let parts = newObj.id_sku.split('_'); parts[0] = newArea; 
            newObj.id_sku = parts.join('_'); newObj.area = newArea;
            updates.push(newObj);
        }
    }

    try {
        const { error } = await db.from('stok_qr').upsert(updates, { onConflict: 'qrcode' });
        if(error) throw error;
        
        alert("Area berhasil dipindahkan!"); tutupModalArea();
        document.querySelector('input[onchange="toggleSemuaCentang(this.checked)"]').checked = false;
        await ambilSemuaData();
    } catch (error) { alert("Gagal merubah Area: " + error.message); } 
    finally { btn.innerHTML = original; btn.disabled = false; lucide.createIcons(); }
}

function salinDataTabel() {
    const cek = document.querySelectorAll('.cb-row:checked');
    if(cek.length === 0) return alert("Pilih baris yang ingin disalin dengan mencentang kotak di kiri tabel!");

    let copyString = "";
    const headers = Array.from(document.querySelectorAll('#thead-riwayat th')).filter(th => window.getComputedStyle(th).display !== 'none' && !th.classList.contains('col-cb')).map(th => th.innerText.trim().replace(/\n/g, ' '));
    copyString += headers.join('\t') + '\n';

    cek.forEach(cb => {
        const tr = cb.closest('tr'); const rowData = [];
        Array.from(tr.children).forEach(td => {
            if(td.classList.contains('col-cb')) return;
            if(window.getComputedStyle(td).display !== 'none') { rowData.push(td.innerText.trim().replace(/\n/g, ' ')); }
        });
        copyString += rowData.join('\t') + '\n';
    });

    navigator.clipboard.writeText(copyString).then(() => {
        alert(`Berhasil menyalin ${cek.length} baris!\nBuka Excel lalu tekan CTRL+V / Paste.`);
    }).catch(err => { alert("Browser menolak akses Clipboard. Silakan salin manual."); });
}

async function bukaModalSTBJ() {
    document.getElementById('modal-stbj-langsir').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    
    const tbody = document.getElementById('tbody-stbj-modal');
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</td></tr>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj').select('*').order('created_at', {ascending: false});
        if(error) throw error;
        
        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-6 font-bold text-slate-400">Tabel STBJ Kosong.</td></tr>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            const td = translateBarcode(r.qrcode);
            
            let statusGudang = r.posisi || 'STBJ';
            let colGudang = '';
            
            if(statusGudang === 'IN GUDANG') {
                colGudang = '<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">IN GUDANG</span>';
            } else if (statusGudang === 'KELUAR') {
                colGudang = '<span class="bg-red-100 text-red-800 border border-red-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">KELUAR</span>';
            } else {
                colGudang = '<span class="bg-blue-100 text-blue-800 border border-blue-300 font-bold px-2 py-1 rounded text-[10px] shadow-sm">STBJ</span>';
            }
            
            h += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition row-modal-stbj">
                    <td class="p-3 font-bold text-slate-400">${i+1}</td>
                    <td class="p-3 text-slate-600 font-semibold">${tgl}</td>
                    <td class="p-3 font-bold text-slate-700">${r.troli || '-'}</td>
                    <td class="p-3 font-mono font-bold text-slate-900 border-r border-slate-200 tracking-wider">${r.qrcode}</td>
                    <td class="p-3 font-bold text-blue-700 text-left">${td.nama}</td>
                    <td class="p-3 font-bold text-slate-600">${td.pjg}</td>
                    <td class="p-3 font-black text-orange-600 bg-orange-50/50 border-r border-slate-200">${td.po}</td>
                    <td class="p-3">${colGudang}</td>
                </tr>`;
        });
        tbody.innerHTML = h;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 font-bold text-red-500">Gagal: ${e.message}</td></tr>`;
    }
}

function tutupModalSTBJ() { 
    document.getElementById('modal-stbj-langsir').classList.add('hidden'); 
    if(document.getElementById('sidebar-filter').classList.contains('translate-x-full') && document.getElementById('modal-ganti-area').classList.contains('hidden')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    }
}

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}
