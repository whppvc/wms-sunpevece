let currentMode = 'tabel';
let stagingData = [];
let dbRecordsRaw = [];
let dbPoAturRaw = []; 
let masterKamus = [];
let stagingRowId = 0;
let sortState = {};

// State Atur Item
let activePO = null;
let dataAturItem = [];
let activePickItem = null;
let tempQtyPick = 0;

// Paginasi & Filter State
let currentPage = 1;
let rowsPerPage = 10; 
let activeFilters = {}; 
let currentFilterCol = ''; 

const currentUser = JSON.parse(localStorage.getItem('user_session')) || { username: 'Admin' };

function formatTglIntl(tglStr) {
    if(!tglStr) return '-';
    try {
        const d = new Date(tglStr);
        if (isNaN(d.getTime())) return tglStr;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch(e) { return tglStr; }
}

document.addEventListener('DOMContentLoaded', async () => {
    initModernLayout({ id: 'po', title: 'PO & ESTIMASI', url: 'po.html' });
    
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('excel-filter-menu');
        if (menu && !menu.classList.contains('hidden')) {
            if (!menu.contains(e.target) && !e.target.closest('button[title^="Filter"]')) {
                closeFilterMenu();
            }
        }
    });

    await ambilReferensiMaster2();
    switchTab('tabel'); 
});

async function ambilReferensiMaster2() {
    try {
        const { data, error } = await db.from('master_2').select('*');
        if (error) throw error; 
        masterKamus = data || [];
        
        const gradeSet = [...new Set(masterKamus.map(x => (x.grade || '').trim()).filter(Boolean))].sort();
        const dusSet = [...new Set(masterKamus.map(x => (x.dus || '').trim()).filter(Boolean))].sort();

        isiDropdown('in-grade', gradeSet, '-- Pilih Grade --');
        isiDropdown('in-dus', dusSet, '-- Pilih Dus --');
    } catch (e) { console.error("Gagal memuat dropdown acuan:", e.message); }
}

function isiDropdown(elId, dataArray, placeholderText) {
    const el = document.getElementById(elId); if (!el) return;
    let html = `<option value="">${placeholderText}</option>`;
    dataArray.forEach(val => html += `<option value="${val}">${val}</option>`); el.innerHTML = html;
}

window.bukaInputPO = function() {
    switchTab('input');
};

window.switchTab = function(mode) {
    currentMode = mode;
    
    document.getElementById('view-input').classList.toggle('hidden', mode !== 'input');
    document.getElementById('view-tabel').classList.toggle('hidden', mode !== 'tabel');
    document.getElementById('view-atur-item').classList.toggle('hidden', mode !== 'atur');
    document.getElementById('view-picking').classList.toggle('hidden', mode !== 'picking');
    
    document.getElementById('header-tabs').classList.toggle('hidden', mode === 'atur' || mode === 'input');
    document.getElementById('header-back').classList.toggle('hidden', mode !== 'atur' && mode !== 'input');
    
    document.getElementById('toolbar-picking').classList.toggle('hidden', mode !== 'picking');

    document.getElementById('footer-input').classList.toggle('hidden', mode !== 'input');
    document.getElementById('footer-tabel').classList.toggle('hidden', mode === 'input');
    
    document.getElementById('btn-tambah-po').classList.toggle('hidden', mode !== 'tabel');
    document.getElementById('btn-hapus-po').classList.toggle('hidden', mode !== 'tabel');
    document.getElementById('btn-hapus-pick').classList.toggle('hidden', mode !== 'picking');
    document.getElementById('dot-hapus').classList.toggle('hidden', mode === 'atur');
    
    document.getElementById('lbl-text-dipilih').classList.toggle('hidden', mode !== 'picking');
    
    if(mode === 'atur') {
        document.getElementById('lbl-back-title').innerText = 'Atur Item Untuk PO:';
        document.getElementById('lbl-text-kodepo').innerHTML = ``; 
    } else if (mode === 'input') {
        document.getElementById('lbl-back-title').innerText = 'Kembali ke Tabel PO';
        document.getElementById('lbl-po-aktif').innerText = 'INPUT PO BARU';
    } else {
        document.getElementById('lbl-text-kodepo').innerHTML = `Jml PO: <span id="lbl-total-kodepo" class="text-emerald-900 font-black ml-1">0</span>`;
    }

    if(mode !== 'atur' && mode !== 'input') {
        document.getElementById('tab-tabel').className = mode === 'tabel' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        document.getElementById('tab-picking').className = mode === 'picking' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    }
    
    activeFilters = {};
    if (mode === 'tabel') {
        muatDataEstimasiDB();
    } else if (mode === 'input') {
        renderHeaderDanTabel();
    } else if (mode === 'picking') {
        muatDataPickingDB();
    }
};

window.addEstimasiLokal = function() {
    const kodePo = document.getElementById('in-kode-po').value.trim().toUpperCase();
    const customerPo = document.getElementById('in-customer-po').value;
    const nama = document.getElementById('in-nama-item').value; 
    let pjg = document.getElementById('in-panjang').value.trim();
    const grade = document.getElementById('in-grade').value; 
    const dus = document.getElementById('in-dus').value; 
    const qtyPo = document.getElementById('in-qty-po').value.trim();
    const note = document.getElementById('in-note').value.trim();

    if (!kodePo || !customerPo || !nama || !pjg || !grade || !dus || !qtyPo) return alert("PERHATIAN: Semua kolom wajib diisi kecuali Note!");
    if (pjg && !pjg.toUpperCase().endsWith('M')) pjg = pjg + "M"; else pjg = pjg.toUpperCase();

    const now = new Date();
    const timeString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    stagingData.unshift({ 
        id: ++stagingRowId, 
        created_at: timeString,
        kode_po: kodePo, 
        customer_po: customerPo, 
        nama_item: nama, 
        panjang: pjg, 
        grade: grade, 
        dus: dus,
        qty_po: qtyPo, 
        note: note || '-' 
    });
    
    renderHeaderDanTabel();
    
    document.getElementById('in-nama-item').value = ''; 
    document.getElementById('in-panjang').value = ''; 
    document.getElementById('in-grade').value = ''; 
    document.getElementById('in-dus').value = ''; 
    document.getElementById('in-qty-po').value = ''; 
    document.getElementById('in-note').value = '';
};

window.hapusBarisStaging = function(id) { 
    stagingData = stagingData.filter(d => d.id !== id); 
    renderHeaderDanTabel(); 
};

window.hapusMassalPO = async function() {
    const checkedBoxes = document.querySelectorAll('.cb-row:checked');
    if (checkedBoxes.length === 0) return alert("Centang minimal 1 baris PO yang ingin dihapus!");
    
    if (!confirm(`Apakah Anda yakin ingin menghapus ${checkedBoxes.length} data PO ini secara permanen?`)) return;

    const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);
    
    const btn = document.getElementById('btn-hapus-po');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menghapus...';
    btn.disabled = true;

    try {
        const { error } = await db.from('po_estimasi').delete().in('id', idsToDelete);
        if (error) throw error;
        
        alert("Data PO berhasil dihapus!");
        muatDataEstimasiDB();
    } catch (e) {
        alert("Gagal menghapus data: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.toggleAllStaging = function(checked) { 
    document.querySelectorAll('.cb-row').forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') cb.checked = checked;
        highlightRow(cb);
    }); 
};

window.simpanMassalKeDatabase = async function() {
    if (stagingData.length === 0) return alert("Tabel penampungan masih kosong!");
    const btn = document.getElementById('btn-submit-db'); const oriText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> MENYIMPAN...'; btn.disabled = true;

    const defaultDate = new Date().toISOString().split('T')[0];

    const payload = stagingData.map(d => ({ 
        tgl_estimasi_kirim: defaultDate,
        id_po: `${d.nama_item}_${d.panjang}_${d.grade}`,
        kode_po: d.kode_po, 
        customer_po: d.customer_po, 
        nama_item: d.nama_item, 
        panjang: d.panjang, 
        grade: d.grade, 
        dus: d.dus,
        qty_po: d.qty_po, 
        qty_terpenuhi: 0,
        note: d.note, 
        pic: currentUser.username 
    }));
    
    try {
        const { error } = await db.from('po_estimasi').insert(payload);
        if (error) throw error; 
        alert(`🚀 BERHASIL! ${payload.length} data PO sukses masuk database server.`);
        stagingData = []; 
        switchTab('tabel'); 
    } catch (e) { 
        alert("GAGAL INSERT: " + e.message); 
    } finally { 
        btn.innerHTML = oriText; btn.disabled = false; lucide.createIcons(); 
    }
};

async function muatDataEstimasiDB() {
    const tbody = document.getElementById('tbody-po');
    tbody.innerHTML = `<tr><td colspan="14" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data PO...</p></td></tr>`;
    lucide.createIcons();
    
    try {
        const { data, error } = await db.from('po_estimasi').select('*').order('created_at', { ascending: false });
        if (error) throw error; 
        dbRecordsRaw = data || [];
        renderHeaderDanTabel();
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`; 
    }
}

async function muatDataPickingDB() {
    const tbody = document.getElementById('tbody-picking');
    tbody.innerHTML = `<tr><td colspan="14" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Menarik Data Picking...</p></td></tr>`;
    lucide.createIcons();
    
    try {
        const { data, error } = await db.from('po_atur').select('*').order('created_at', { ascending: false });
        if (error) throw error; 
        dbPoAturRaw = data || [];
        renderTabelPickingList();
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`; 
    }
}

// ========================================================
// LOGIKA ATUR ITEM (PICKING)
// ========================================================
window.aturItemPO = async function(id) {
    activePO = dbRecordsRaw.find(r => r.id == id);
    if(!activePO) return;

    switchTab('atur');
    document.getElementById('lbl-po-aktif').innerText = activePO.kode_po;
    
    const tbody = document.getElementById('tbody-atur');
    tbody.innerHTML = `<tr><td colspan="14" class="p-10"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500"></i><p class="font-bold text-slate-400 text-sm">Mencari stok di gudang...</p></td></tr>`;
    lucide.createIcons();

    try {
        const { data: stokData, error: errStok } = await db.from('stok_aktual').select('*').eq('id_po', activePO.id_po);
        if(errStok) throw errStok;

        const { data: pickData, error: errPick } = await db.from('po_atur').select('*').eq('kode_po', activePO.kode_po);
        if(errPick) throw errPick;

        dataAturItem = [];

        if(pickData) {
            pickData.forEach(p => {
                dataAturItem.push({
                    isPicked: true,
                    id_picking: p.id,
                    kode_po: p.kode_po,
                    tgl_estimasi: p.tgl_estimasi || '-',
                    customer_po: p.customer_po,
                    area: p.area,
                    jenis_item: p.jenis_item || '-',
                    nama_item: p.nama_item,
                    panjang: p.panjang,
                    grade: p.grade,
                    dus: p.dus,
                    shading: p.shading,
                    customer_aktual: p.customer_aktual,
                    keterangan: p.keterangan || '-',
                    qty: p.qty_pick,
                    id_sku: p.id_sku
                });
            });
        }

        if(stokData) {
            stokData.forEach(s => {
                let pickedQtyForThisStok = 0;
                if(pickData) {
                    pickData.forEach(p => {
                        if(p.id_sku === s.id_sku) {
                            pickedQtyForThisStok += parseInt(p.qty_pick) || 0;
                        }
                    });
                }

                let sisaQty = s.qty - pickedQtyForThisStok;
                
                if(sisaQty > 0) {
                    dataAturItem.push({
                        isPicked: false,
                        id_stok: s.id,
                        id_sku: s.id_sku,
                        kode_po: '-',
                        tgl_estimasi: '-',
                        customer_po: '-',
                        area: s.area,
                        jenis_item: s.jenis_item,
                        nama_item: s.nama_item,
                        panjang: s.panjang,
                        grade: s.grade,
                        dus: s.dus,
                        shading: s.shading,
                        customer_aktual: s.customer_aktual,
                        keterangan: s.keterangan || '-',
                        qty: sisaQty
                    });
                }
            });
        }

        renderTabelAturItem();

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`;
    }
};

function renderTabelAturItem() {
    const thead = document.getElementById('thead-atur');
    const tbody = document.getElementById('tbody-atur');
    sortState = {}; 

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-12 col-pick border-r border-slate-600">Pick</th>
            ${thSort(1, 'Kode PO', 'col-kode_po')}
            ${thSort(2, 'Tgl Estimasi', 'col-tgl_est')}
            ${thSort(3, 'Customer PO', 'col-customer_po')}
            ${thSort(4, 'Area', 'col-area')}
            ${thSort(5, 'Jenis Item', 'col-jenis')}
            ${thSort(6, 'Nama Item', 'col-nama')}
            ${thSort(7, 'Panjang', 'col-pjg')}
            ${thSort(8, 'Grade', 'col-grade')}
            ${thSort(9, 'Dus', 'col-dus')}
            ${thSort(10, 'Shading', 'col-shading')}
            ${thSort(11, 'Customer Aktual', 'col-customer_aktual')}
            ${thSort(12, 'Keterangan', 'col-ket')}
            ${thSort(13, 'QTY', 'col-qty')}
        </tr>`;
    
    if(dataAturItem.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Tidak ada stok tersedia untuk item ini.</td></tr>`; 
        applyPagination(); return; 
    }
    
    let h = '';
    dataAturItem.forEach((r, i) => {
        let btnPick = r.isPicked 
            ? `<button onclick="batalPickItem('${r.id_picking}', ${r.qty})" class="bg-rose-600 text-white font-bold px-3 py-1.5 rounded hover:bg-rose-700 transition mx-auto flex text-[10px] uppercase shadow-sm active:scale-95 whitespace-nowrap"><i data-lucide="x" class="w-3 h-3 mr-1"></i> Cancel</button>`
            : `<button onclick="bukaModalPick(${i})" class="bg-blue-600 text-white font-bold px-3 py-1.5 rounded hover:bg-blue-700 transition mx-auto flex text-[10px] uppercase shadow-sm active:scale-95 whitespace-nowrap">Pick Item</button>`;

        let rowBg = r.isPicked ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-white even:bg-slate-100 hover:bg-slate-50';
        let tglEstStr = r.tgl_estimasi !== '-' ? formatTglIntl(r.tgl_estimasi) : '-';

        h += `
            <tr class="border-b border-slate-200 transition r-row text-sm ${rowBg}">
                <td class="px-4 py-3 text-center col-pick border-r border-slate-200">${btnPick}</td>
                <td class="px-4 py-3 font-black text-slate-800 tracking-wider col-kode_po border-r border-slate-200" data-search="${r.kode_po}">${r.kode_po}</td>
                <td class="px-4 py-3 text-slate-600 font-medium col-tgl_est border-r border-slate-200" data-search="${tglEstStr}">${tglEstStr}</td>
                <td class="px-4 py-3 font-semibold text-slate-700 col-customer_po border-r border-slate-200" data-search="${r.customer_po}">${r.customer_po}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-area border-r border-slate-200" data-search="${r.area}">${r.area}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-jenis border-r border-slate-200" data-search="${r.jenis_item}">${r.jenis_item}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-center col-nama border-r border-slate-200" data-search="${r.nama_item}">${r.nama_item}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg border-r border-slate-200" data-search="${r.panjang}">${r.panjang}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade border-r border-slate-200" data-search="${r.grade}">${r.grade}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus border-r border-slate-200" data-search="${r.dus}">${r.dus}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading border-r border-slate-200" data-search="${r.shading}">${r.shading}</td>
                <td class="px-4 py-3 font-semibold ${r.customer_aktual !== activePO.customer_po && !r.isPicked ? 'text-rose-600' : 'text-slate-700'} col-customer_aktual border-r border-slate-200" data-search="${r.customer_aktual}">${r.customer_aktual}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-center col-ket border-r border-slate-200" data-search="${r.keterangan}">${r.keterangan}</td>
                <td class="px-4 py-3 font-black text-slate-800 col-qty" data-search="${r.qty}">${r.qty}</td>
            </tr>`;
    });
    tbody.innerHTML = h;
    lucide.createIcons(); 
    saringTabelExcel();
    initResizableColumns();
}

function renderTabelPickingList() {
    const thead = document.getElementById('thead-picking');
    const tbody = document.getElementById('tbody-picking');
    sortState = {}; 

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center relative border-r border-slate-600"><input type="checkbox" onchange="toggleAllStaging(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"></th>
            ${thSort(1, 'Kode PO', 'col-kode_po')}
            ${thSort(2, 'Tgl Estimasi', 'col-tgl_est')}
            ${thSort(3, 'Customer PO', 'col-customer_po')}
            ${thSort(4, 'Area', 'col-area')}
            ${thSort(5, 'Jenis Item', 'col-jenis')}
            ${thSort(6, 'Nama Item', 'col-nama')}
            ${thSort(7, 'Panjang', 'col-pjg')}
            ${thSort(8, 'Grade', 'col-grade')}
            ${thSort(9, 'Dus', 'col-dus')}
            ${thSort(10, 'Shading', 'col-shading')}
            ${thSort(11, 'Customer Aktual', 'col-customer_aktual')}
            ${thSort(12, 'Keterangan', 'col-ket')}
            ${thSort(13, 'QTY PICK', 'col-qty')}
        </tr>`;
    
    if(dbPoAturRaw.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data picking.</td></tr>`; 
        applyPagination(); return; 
    }
    
    let h = '';
    dbPoAturRaw.forEach((r, i) => {
        let tglEstStr = formatTglIntl(r.tgl_estimasi);
        h += `
            <tr class="bg-white even:bg-slate-100 transition r-row-pick text-sm border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" value="${r.id}" data-kodepo="${r.kode_po}" data-qty="${r.qty_pick}" onchange="updateSelectedPickCount()" class="pick-row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
                <td class="px-4 py-3 font-black text-slate-800 tracking-wider col-kode_po border-r border-slate-200" data-search="${r.kode_po}">${r.kode_po}</td>
                <td class="px-4 py-3 text-slate-600 font-medium col-tgl_est border-r border-slate-200" data-search="${tglEstStr}">${tglEstStr}</td>
                <td class="px-4 py-3 font-semibold text-slate-700 col-customer_po border-r border-slate-200" data-search="${r.customer_po}">${r.customer_po}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 col-area border-r border-slate-200" data-search="${r.area}">${r.area}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-jenis border-r border-slate-200" data-search="${r.jenis_item}">${r.jenis_item || '-'}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 text-center col-nama border-r border-slate-200" data-search="${r.nama_item}">${r.nama_item}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-pjg border-r border-slate-200" data-search="${r.panjang}">${r.panjang}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-grade border-r border-slate-200" data-search="${r.grade}">${r.grade}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-dus border-r border-slate-200" data-search="${r.dus}">${r.dus}</td>
                <td class="px-4 py-3 font-medium text-slate-700 col-shading border-r border-slate-200" data-search="${r.shading}">${r.shading}</td>
                <td class="px-4 py-3 font-semibold text-slate-700 col-customer_aktual border-r border-slate-200" data-search="${r.customer_aktual}">${r.customer_aktual}</td>
                <td class="px-4 py-3 font-medium text-slate-500 text-center col-ket border-r border-slate-200" data-search="${r.keterangan}">${r.keterangan || '-'}</td>
                <td class="px-4 py-3 font-black text-slate-800 col-qty" data-search="${r.qty_pick}">${r.qty_pick}</td>
            </tr>`;
    });
    tbody.innerHTML = h;
    lucide.createIcons(); 
    saringTabelExcel();
    initResizableColumns();
}

window.renderHeaderDanTabel = function() {
    const thead = document.getElementById('thead-po');
    const tbody = document.getElementById('tbody-po');
    sortState = {}; 

    let dataset = currentMode === 'input' ? stagingData : dbRecordsRaw;

    let thHtml = `<tr>
        <th class="hdr-std w-10 col-cb text-center relative border-r border-slate-600"><input type="checkbox" onchange="toggleAllStaging(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"></th>`;
    
    if (currentMode === 'input') {
        thHtml += `<th class="hdr-std w-10 col-btn text-center relative border-r border-slate-600"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-rose-400"></i></th>
        ${thSort(2, 'No', 'col-no w-12')}
        ${thSort(3, 'Kode PO', 'col-kode_po')}
        ${thSort(4, 'Customer PO', 'col-customer_po')}
        ${thSort(5, 'Nama Item', 'col-nama')}
        ${thSort(6, 'Panjang', 'col-pjg')}
        ${thSort(7, 'Grade', 'col-grade')}
        ${thSort(8, 'Dus', 'col-dus')}
        ${thSort(9, 'QTY PO', 'col-qty')}
        ${thSort(10, 'Status', 'col-status')}
        ${thSort(11, 'Note', 'col-note')}`;
    } else {
        thHtml += `<th class="hdr-std w-12 col-atur text-center relative border-r border-slate-600">Atur Item</th>
        ${thSort(2, 'No', 'col-no w-12')}
        ${thSort(3, 'Waktu Input', 'col-waktu')}
        ${thSort(4, 'Kode PO', 'col-kode_po')}
        ${thSort(5, 'Customer PO', 'col-customer_po')}
        ${thSort(6, 'Nama Item', 'col-nama')}
        ${thSort(7, 'Panjang', 'col-pjg')}
        ${thSort(8, 'Grade', 'col-grade')}
        ${thSort(9, 'Dus', 'col-dus')}
        ${thSort(10, 'QTY PO', 'col-qty')}
        ${thSort(11, 'QTY PICK', 'col-qty_terpenuhi')}
        ${thSort(12, 'Status', 'col-status')}
        ${thSort(13, 'Note', 'col-note')}
        ${thSort(14, 'PIC', 'col-pic')}`;
    }
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;
    
    if(dataset.length === 0) { 
        let msg = currentMode === 'input' ? 'Belum ada data ditambahkan ke tabel sementara.' : 'Tidak ada data PO di database.';
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> ${msg}</td></tr>`; 
        applyPagination(); return; 
    }
    
    let h = '';
    dataset.forEach((r, i) => {
        let tglStr = currentMode === 'input' ? r.created_at : formatTglIntl(r.created_at);
        let noUrut = currentMode === 'input' ? (dataset.length - i) : (i + 1);
        
        let btnHapus = currentMode === 'input' 
            ? `<button onclick="hapusBarisStaging(${r.id})" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded-md transition shadow-sm mx-auto flex"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
            : '';

        let qtyPo = parseInt(r.qty_po) || 0;
        let qtyTerpenuhi = parseInt(r.qty_terpenuhi) || 0;
        let isLengkap = currentMode === 'tabel' && qtyTerpenuhi >= qtyPo && qtyPo > 0;
        
        let statusBadge = isLengkap 
            ? '<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-[10px] border border-emerald-200">DONE</span>' 
            : '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-[10px] border border-amber-200">PROSES</span>';

        if(currentMode === 'input') statusBadge = '<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold text-[10px] border border-slate-200">DRAFT</span>';

        let trClass = "bg-white even:bg-slate-100 transition r-row text-sm border-b border-slate-200";

        h += `<tr class="${trClass}">`;
        
        if (currentMode === 'input') {
            h += `<td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" value="${r.id}" onchange="highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>`;
            h += `<td class="px-4 py-3 text-center col-btn border-r border-slate-200">${btnHapus}</td>`;
        } else {
            h += `<td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" value="${r.id}" onchange="highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>`;
            h += `<td class="px-4 py-3 text-center col-atur border-r border-slate-200"><button onclick="aturItemPO('${r.id}')" class="bg-blue-600 text-white font-bold px-3 py-1.5 rounded hover:bg-blue-700 transition mx-auto flex text-[10px] uppercase shadow-sm active:scale-95 whitespace-nowrap">Atur Item</button></td>`;
        }
        
        h += `<td class="px-4 py-3 font-bold text-slate-500 text-center col-no border-r border-slate-200">${noUrut}</td>`;
        
        if (currentMode === 'tabel') {
            h += `<td class="px-4 py-3 text-slate-600 font-medium col-waktu border-r border-slate-200" data-search="${tglStr}">${tglStr}</td>`;
        }

        h += `<td class="px-4 py-3 font-black text-slate-800 tracking-wider col-kode_po border-r border-slate-200" data-search="${r.kode_po}">${r.kode_po}</td>
              <td class="px-4 py-3 font-semibold text-slate-700 col-customer_po border-r border-slate-200" data-search="${r.customer_po}">${r.customer_po}</td>
              <td class="px-4 py-3 font-semibold text-slate-800 text-center col-nama border-r border-slate-200" data-search="${r.nama_item}">${r.nama_item}</td>
              <td class="px-4 py-3 font-medium text-slate-700 col-pjg border-r border-slate-200" data-search="${r.panjang}">${r.panjang}</td>
              <td class="px-4 py-3 font-medium text-slate-700 col-grade border-r border-slate-200" data-search="${r.grade}">${r.grade}</td>
              <td class="px-4 py-3 font-medium text-slate-700 col-dus border-r border-slate-200" data-search="${r.dus}">${r.dus}</td>
              <td class="px-4 py-3 font-black text-slate-800 col-qty border-r border-slate-200" data-search="${qtyPo}">${qtyPo}</td>`;
              
        if (currentMode === 'tabel') {
            h += `<td class="px-4 py-3 font-black text-slate-800 col-qty_terpenuhi border-r border-slate-200" data-search="${qtyTerpenuhi}">${qtyTerpenuhi}</td>`;
        }
        
        h += `<td class="px-4 py-3 text-center col-status border-r border-slate-200" data-search="${isLengkap ? 'DONE' : 'PROSES'}">${statusBadge}</td>`;
        h += `<td class="px-4 py-3 font-medium text-slate-500 text-center col-ket border-r border-slate-200" data-search="${r.note || '-'}">${r.note || '-'}</td>`;
        
        if (currentMode === 'tabel') {
            h += `<td class="px-4 py-3 font-bold uppercase text-xs text-slate-400 col-pic" data-search="${r.pic || '-'}">${r.pic || '-'}</td>`;
        }
        
        h += `</tr>`;
    });
    tbody.innerHTML = h;
    lucide.createIcons(); 
    saringTabelExcel();
    initResizableColumns();
};
