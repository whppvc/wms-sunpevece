console.log("WMS PO Logic - Unified Version");

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

// State Modal Pencarian
let currentSearchType = ''; 
let masterListCache = [];

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
                window.closeFilterMenu();
            }
        }
    });

    await ambilReferensiMaster2();
    window.switchTab('tabel'); 
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

window.bukaModalPilih = function(type) {
    currentSearchType = type;
    const title = document.getElementById('title-modal-pilih');
    const inputSearch = document.getElementById('input-search-master');
    
    inputSearch.value = '';
    
    if(type === 'item') {
        title.innerHTML = '<i data-lucide="box" class="w-4 h-4 text-blue-600"></i> Pilih Nama Item';
        masterListCache = [...new Set(masterKamus.map(x => (x.nama_item || '').trim()).filter(Boolean))].sort();
    } else {
        title.innerHTML = '<i data-lucide="users" class="w-4 h-4 text-blue-600"></i> Pilih Customer PO';
        masterListCache = [...new Set(masterKamus.map(x => (x.customer || '').trim()).filter(Boolean))].sort();
    }
    
    renderListMaster(masterListCache);
    document.getElementById('modal-pilih-master').classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => inputSearch.focus(), 100);
};

window.saringListMaster = function(val) {
    const query = val.toLowerCase();
    const filtered = masterListCache.filter(item => item.toLowerCase().includes(query));
    renderListMaster(filtered);
};

function renderListMaster(dataArray) {
    const ul = document.getElementById('list-master-data');
    if(dataArray.length === 0) {
        ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold text-xs">Data tidak ditemukan.</li>';
        return;
    }
    
    ul.innerHTML = dataArray.map(item => `
        <li>
            <button type="button" onclick="window.pilihDataMaster('${item.replace(/'/g, "\\'")}')" class="w-full text-left p-3 hover:bg-blue-50 rounded-lg font-bold text-sm text-slate-700 transition border border-transparent hover:border-blue-200">
                ${item}
            </button>
        </li>
    `).join('');
}

window.pilihDataMaster = function(val) {
    if(currentSearchType === 'item') {
        document.getElementById('in-nama-item').value = val;
    } else {
        document.getElementById('in-customer-po').value = val;
    }
    document.getElementById('modal-pilih-master').classList.add('hidden');
};

window.bukaInputPO = function() {
    window.switchTab('input');
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
        document.getElementById('lbl-text-kodepo').innerHTML = `Jml PO: <span id="lbl-total-kodepo" class="text-slate-900 font-medium ml-1">0</span>`;
    }

    if(mode !== 'atur' && mode !== 'input') {
        document.getElementById('tab-tabel').className = mode === 'tabel' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
        document.getElementById('tab-picking').className = mode === 'picking' ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:text-slate-800 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    }
    
    activeFilters = {};
    if (mode === 'tabel') {
        muatDataEstimasiDB();
    } else if (mode === 'input') {
        window.renderHeaderDanTabel();
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
    
    window.renderHeaderDanTabel();
    
    document.getElementById('in-nama-item').value = ''; 
    document.getElementById('in-panjang').value = ''; 
    document.getElementById('in-grade').value = ''; 
    document.getElementById('in-dus').value = ''; 
    document.getElementById('in-qty-po').value = ''; 
    document.getElementById('in-note').value = '';
};

window.hapusBarisStaging = function(id) { 
    stagingData = stagingData.filter(d => d.id !== id); 
    window.renderHeaderDanTabel(); 
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
        window.highlightRow(cb);
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
        window.switchTab('tabel'); 
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
        window.renderHeaderDanTabel();
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
        window.renderTabelPickingList();
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

    window.switchTab('atur');
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

        window.renderTabelAturItem();

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-5 text-red-500 font-bold">Error load: ${e.message}</td></tr>`;
    }
};

window.renderTabelAturItem = function() {
    const thead = document.getElementById('thead-atur');
    const tbody = document.getElementById('tbody-atur');
    sortState = {}; 

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-12 col-pick border-r border-slate-600">Pick</th>
            ${window.thSort(1, 'Kode PO', 'col-kode_po')}
            ${window.thSort(2, 'Tgl Estimasi', 'col-tgl_est')}
            ${window.thSort(3, 'Customer PO', 'col-customer_po')}
            ${window.thSort(4, 'Area', 'col-area')}
            ${window.thSort(5, 'Jenis Item', 'col-jenis')}
            ${window.thSort(6, 'Nama Item', 'col-nama')}
            ${window.thSort(7, 'Panjang', 'col-pjg')}
            ${window.thSort(8, 'Grade', 'col-grade')}
            ${window.thSort(9, 'Dus', 'col-dus')}
            ${window.thSort(10, 'Shading', 'col-shading')}
            ${window.thSort(11, 'Customer Aktual', 'col-customer_aktual')}
            ${window.thSort(12, 'Keterangan', 'col-ket')}
            ${window.thSort(13, 'QTY', 'col-qty')}
        </tr>`;
    
    if(dataAturItem.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Tidak ada stok tersedia untuk item ini.</td></tr>`; 
        window.applyPagination(); return; 
    }
    
    let h = '';
    dataAturItem.forEach((r, i) => {
        let btnPick = r.isPicked 
            ? `<button onclick="window.batalPickItem('${r.id_picking}', ${r.qty})" class="bg-rose-600 text-white font-bold px-3 py-1.5 rounded hover:bg-rose-700 transition mx-auto flex text-[10px] uppercase shadow-sm active:scale-95 whitespace-nowrap"><i data-lucide="x" class="w-3 h-3 mr-1"></i> Cancel</button>`
            : `<button onclick="window.bukaModalPick(${i})" class="bg-blue-600 text-white font-bold px-3 py-1.5 rounded hover:bg-blue-700 transition mx-auto flex text-[10px] uppercase shadow-sm active:scale-95 whitespace-nowrap">Pick Item</button>`;

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
    window.saringTabelExcel();
    window.initResizableColumns();
};

window.batalPickItem = async function(id_picking, qty_pick) {
    if(!confirm("Batalkan pick item ini? Qty terpenuhi pada PO akan dikurangi otomatis.")) return;
    
    try {
        const { error: errDel } = await db.from('po_atur').delete().eq('id', id_picking);
        if(errDel) throw errDel;
        
        const newQty = Math.max(0, (activePO.qty_terpenuhi || 0) - qty_pick);
        const { error: errPo } = await db.from('po_estimasi').update({ qty_terpenuhi: newQty }).eq('id', activePO.id);
        if(errPo) throw errPo;
        
        await muatDataEstimasiDB(); 
        window.aturItemPO(activePO.id); 
    } catch(e) {
        alert("Gagal membatalkan pick: " + e.message);
    }
};

window.bukaModalPick = function(index) {
    activePickItem = dataAturItem[index];
    document.getElementById('lbl-max-pick').innerText = activePickItem.qty;
    document.getElementById('input-qty-pick').value = '';
    document.getElementById('modal-pick-qty').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qty-pick').focus(), 100);
};

window.cekCustomerPick = function() {
    tempQtyPick = parseInt(document.getElementById('input-qty-pick').value);
    if(isNaN(tempQtyPick) || tempQtyPick <= 0) return alert("Jumlah dus tidak valid!");
    if(tempQtyPick > activePickItem.qty) return alert(`Maksimal dus yang bisa diambil adalah ${activePickItem.qty}!`);

    document.getElementById('modal-pick-qty').classList.add('hidden');

    if(activePickItem.customer_aktual !== activePO.customer_po) {
        document.getElementById('lbl-cust-lama').innerText = activePickItem.customer_aktual;
        document.getElementById('lbl-cust-baru').innerText = activePO.customer_po;
        document.getElementById('modal-confirm-customer').classList.remove('hidden');
    } else {
        window.eksekusiPickFinal(false);
    }
};

window.eksekusiPickFinal = async function(isGantiCustomer) {
    let finalIdSku = activePickItem.id_sku;

    if(isGantiCustomer) {
        const btn = document.getElementById('btn-ganti-cust'); const ori = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Proses...'; btn.disabled = true;
        
        try {
            const { error } = await db.rpc('ganti_customer_aktual_ks_v2', { 
                p_id_sku: activePickItem.id_sku,
                p_customer_lama: activePickItem.customer_aktual,
                p_customer_baru: activePO.customer_po,
                p_qty: tempQtyPick
            });
            if(error) throw error;

            let parts = activePickItem.id_sku.split('_');
            if(parts.length >= 8) {
                parts[6] = activePO.customer_po; 
                finalIdSku = parts.join('_');
            }

        } catch(e) {
            alert("Gagal mengganti Customer Aktual: " + e.message);
            btn.innerHTML = ori; btn.disabled = false; return;
        }
        btn.innerHTML = ori; btn.disabled = false;
        document.getElementById('modal-confirm-customer').classList.add('hidden');
    }

    try {
        const payloadPick = {
            kode_po: activePO.kode_po,
            tgl_estimasi: activePO.tgl_estimasi_kirim,
            customer_po: activePO.customer_po,
            area: activePickItem.area,
            jenis_item: activePickItem.jenis_item,
            nama_item: activePickItem.nama_item,
            panjang: activePickItem.panjang,
            grade: activePickItem.grade,
            dus: activePickItem.dus,
            shading: activePickItem.shading,
            keterangan: activePickItem.keterangan,
            qty_pick: tempQtyPick,
            customer_aktual: isGantiCustomer ? activePO.customer_po : activePickItem.customer_aktual,
            id_po: activePO.id_po,
            id_sku: finalIdSku
        };
        const { error: errPick } = await db.from('po_atur').insert([payloadPick]);
        if(errPick) throw errPick;

        const newQtyTerpenuhi = (activePO.qty_terpenuhi || 0) + tempQtyPick;
        const { error: errPo } = await db.from('po_estimasi').update({ qty_terpenuhi: newQtyTerpenuhi }).eq('id', activePO.id);
        if(errPo) throw errPo;

        await muatDataEstimasiDB(); 
        window.aturItemPO(activePO.id); 

    } catch(e) {
        alert("Gagal memproses Pick Item: " + e.message);
    }
};

window.renderTabelPickingList = function() {
    const thead = document.getElementById('thead-picking');
    const tbody = document.getElementById('tbody-picking');
    sortState = {}; 

    thead.innerHTML = `
        <tr>
            <th class="hdr-std w-10 col-cb text-center relative border-r border-slate-600"><input type="checkbox" onchange="window.toggleAllPickingRows(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"></th>
            ${window.thSort(1, 'Kode PO', 'col-kode_po')}
            ${window.thSort(2, 'Tgl Estimasi', 'col-tgl_est')}
            ${window.thSort(3, 'Customer PO', 'col-customer_po')}
            ${window.thSort(4, 'Area', 'col-area')}
            ${window.thSort(5, 'Jenis Item', 'col-jenis')}
            ${window.thSort(6, 'Nama Item', 'col-nama')}
            ${window.thSort(7, 'Panjang', 'col-pjg')}
            ${window.thSort(8, 'Grade', 'col-grade')}
            ${window.thSort(9, 'Dus', 'col-dus')}
            ${window.thSort(10, 'Shading', 'col-shading')}
            ${window.thSort(11, 'Customer Aktual', 'col-customer_aktual')}
            ${window.thSort(12, 'Keterangan', 'col-ket')}
            ${window.thSort(13, 'QTY PICK', 'col-qty')}
        </tr>`;
    
    if(dbPoAturRaw.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data picking.</td></tr>`; 
        window.applyPagination(); return; 
    }
    
    let h = '';
    dbPoAturRaw.forEach((r, i) => {
        let tglEstStr = formatTglIntl(r.tgl_estimasi);
        h += `
            <tr class="bg-white even:bg-slate-100 transition r-row-pick text-sm border-b border-slate-200">
                <td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" value="${r.id}" data-kodepo="${r.kode_po}" data-qty="${r.qty_pick}" onchange="window.updateSelectedPickCount()" class="pick-row-cb cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>
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
    window.saringTabelExcel();
    window.initResizableColumns();
};

window.updateSelectedPickCount = function() {
    const checkedBoxes = document.querySelectorAll('.pick-row-cb:checked');
    let totalQty = 0;
    checkedBoxes.forEach(cb => {
        totalQty += parseInt(cb.getAttribute('data-qty')) || 0;
        const tr = cb.closest('tr');
        if(cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    });
    document.getElementById('lbl-pilih-baris').innerText = totalQty;
};

window.toggleAllPickingRows = function(checked) {
    document.querySelectorAll('#tbody-picking .r-row-pick').forEach(row => {
        if (!row.classList.contains('filtered-out') && row.style.display !== 'none') {
            const cb = row.querySelector('.pick-row-cb');
            if (cb) {
                cb.checked = checked;
                if(checked) row.classList.add('selected-row');
                else row.classList.remove('selected-row');
            }
        }
    });
    window.updateSelectedPickCount();
};

window.bukaModalEditTgl = function() {
    const checkedBoxes = document.querySelectorAll('.pick-row-cb:checked');
    if(checkedBoxes.length === 0) return alert("Centang minimal 1 baris di Picking List yang ingin diubah tanggalnya!");
    
    document.getElementById('input-tgl-baru').value = '';
    document.getElementById('modal-edit-tgl').classList.remove('hidden');
};

window.simpanEditTgl = async function() {
    const tglBaru = document.getElementById('input-tgl-baru').value;
    if(!tglBaru) return alert("Pilih tanggal baru terlebih dahulu!");

    const checkedBoxes = document.querySelectorAll('.pick-row-cb:checked');
    const btn = document.getElementById('btn-simpan-tgl');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> PROSES...';
    btn.disabled = true;

    try {
        let poSet = new Set();
        let pickIds = [];

        checkedBoxes.forEach(cb => {
            poSet.add(cb.getAttribute('data-kodepo'));
            pickIds.push(cb.value);
        });

        const arrPo = Array.from(poSet);

        if(arrPo.length > 0) {
            const { error: errPo } = await db.from('po_estimasi').update({ tgl_estimasi_kirim: tglBaru }).in('kode_po', arrPo);
            if(errPo) throw errPo;
        }

        if(pickIds.length > 0) {
            const { error: errPick } = await db.from('po_atur').update({ tgl_estimasi: tglBaru }).in('id', pickIds);
            if(errPick) throw errPick;
        }

        alert("Berhasil mengubah Tanggal Estimasi!");
        document.getElementById('modal-edit-tgl').classList.add('hidden');
        
        await muatDataPickingDB();
        await muatDataEstimasiDB();

    } catch(e) {
        alert("Gagal mengubah tanggal: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.tutupSemuaModal = function() {
    document.getElementById('modal-pick-qty').classList.add('hidden');
    document.getElementById('modal-confirm-customer').classList.add('hidden');
    document.getElementById('modal-pilih-master').classList.add('hidden');
    document.getElementById('modal-edit-tgl').classList.add('hidden');
};

// ========================================================
// SORTING & FILTER EXCEL PRO
// ========================================================
window.sortTable = function(colIndex, headerEl) {
    let tbodyId = currentMode === 'atur' ? 'tbody-atur' : (currentMode === 'picking' ? 'tbody-picking' : 'tbody-po');
    let rowClass = currentMode === 'picking' ? 'tr.r-row-pick' : 'tr.r-row';
    
    const tbody = document.getElementById(tbodyId);
    const rows = Array.from(tbody.querySelectorAll(rowClass));
    let isAsc = sortState[colIndex] !== 'asc'; sortState[colIndex] = isAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
        let valA = a.cells[colIndex].getAttribute('data-search') || a.cells[colIndex].innerText.trim(); 
        let valB = b.cells[colIndex].getAttribute('data-search') || b.cells[colIndex].innerText.trim();
        let numA = parseFloat(valA); let numB = parseFloat(valB);
        if(!isNaN(numA) && !isNaN(numB)) return isAsc ? numA - numB : numB - numA;
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    rows.forEach(row => tbody.appendChild(row));
    document.querySelectorAll('.sort-icon').forEach(icon => { icon.setAttribute('data-lucide', 'arrow-up-down'); icon.classList.add('opacity-30'); });
    const icon = headerEl.querySelector('.sort-icon');
    if(icon) { icon.setAttribute('data-lucide', isAsc ? 'arrow-up-a-z' : 'arrow-down-z-a'); icon.classList.remove('opacity-30'); lucide.createIcons(); }
    window.applyPagination();
};

window.thSort = function(idx, label, cls = "") {
    const colClass = cls.split(' ').find(c => c.startsWith('col-')) || '';
    const noFilter = ['col-cb', 'col-btn', 'col-no', 'col-atur', 'col-pick'].includes(colClass);
    
    const filterBtn = noFilter ? '' : `
        <button onclick="window.openColumnFilter(event, '${colClass}', '${label}')" class="p-1 hover:bg-slate-600 rounded ml-1 transition" title="Filter ${label}">
            <i data-lucide="filter" class="w-3.5 h-3.5 filter-icon opacity-40 hover:opacity-100 transition-all text-white"></i>
        </button>`;

    return `<th class="hdr-std ${cls} select-none relative border-r border-slate-600">
        <div class="flex items-center justify-center gap-1.5">
            <span class="cursor-pointer flex items-center gap-1 hover:text-blue-300 transition" onclick="window.sortTable(${idx}, this.closest('th'))">${label} <i data-lucide="arrow-up-down" class="w-3 h-3 sort-icon opacity-30"></i></span>
            ${filterBtn}
        </div>
    </th>`;
};

window.openColumnFilter = function(event, colClass, colName) {
    event.stopPropagation(); currentFilterCol = colClass;
    document.getElementById('filter-col-name').innerText = `Filter: ${colName}`;
    let uniqueValues = new Set();
    
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick' : '#tbody-po tr.r-row');

    document.querySelectorAll(tbodyId).forEach(row => {
        let showBasedOnOthers = true;
        for (let otherCol in activeFilters) {
            if (otherCol !== colClass) { 
                const allowed = activeFilters[otherCol]; const c = row.querySelector('.' + otherCol);
                let t = c ? (c.getAttribute('data-search') || c.innerText.trim()) : '';
                if (!allowed.includes(t)) { showBasedOnOthers = false; break; }
            }
        }
        if (showBasedOnOthers) {
            let cell = row.querySelector('.' + colClass);
            if (cell) { let val = cell.getAttribute('data-search') || cell.innerText.trim(); if(val !== '') uniqueValues.add(val); }
        }
    });

    let sortedValues = Array.from(uniqueValues).sort();
    let listHtml = `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition"><input type="checkbox" id="filter-select-all" checked onchange="window.toggleAllFilterValues(this.checked)" class="rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500"> <span class="font-semibold text-slate-800">(Pilih Semua)</span></label>`;
    
    sortedValues.forEach(val => {
        let isChecked = !activeFilters[colClass] || activeFilters[colClass].includes(val);
        listHtml += `<label class="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer rounded-md transition filter-val-item" data-value="${encodeURIComponent(val)}">
            <input type="checkbox" class="filter-val-cb rounded text-blue-600 w-4 h-4 border-slate-300 focus:ring-blue-500" value="${encodeURIComponent(val)}" ${isChecked ? 'checked' : ''}> 
            <span class="truncate text-slate-600">${val}</span>
        </label>`;
    });

    document.getElementById('filter-values-list').innerHTML = listHtml; window.updateSelectAllState();
    document.getElementById('filter-search-input').value = '';
    const rect = event.currentTarget.getBoundingClientRect(); const menu = document.getElementById('excel-filter-menu');
    if(menu) {
        menu.classList.remove('hidden');
        let top = rect.bottom + window.scrollY + 5; let left = rect.left + window.scrollX;
        if (left + 256 > window.innerWidth) { left = window.innerWidth - 266; }
        menu.style.top = top + 'px'; menu.style.left = left + 'px';
    }
    const sInput = document.getElementById('filter-search-input'); if(sInput) sInput.focus();
};

window.toggleAllFilterValues = function(checked) {
    document.querySelectorAll('.filter-val-cb').forEach(cb => { if(cb.closest('label').style.display !== 'none') cb.checked = checked; });
    window.updateSelectAllState();
};
window.updateSelectAllState = function() {
    const allCbs = document.querySelectorAll('.filter-val-cb'); const checkedCbs = document.querySelectorAll('.filter-val-cb:checked');
    const selectAll = document.getElementById('filter-select-all'); if(!selectAll) return;
    if(allCbs.length === checkedCbs.length) { selectAll.checked = true; selectAll.indeterminate = false; }
    else if(checkedCbs.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; }
    else { selectAll.checked = false; selectAll.indeterminate = true; }
};

window.searchFilterList = function(val) {
    const query = val.toLowerCase().split(' ').filter(x => x);
    document.querySelectorAll('.filter-val-item').forEach(label => {
        const text = decodeURIComponent(label.getAttribute('data-value')).toLowerCase();
        label.style.display = query.every(term => text.includes(term)) ? '' : 'none';
    });
};
window.closeFilterMenu = function() { const menu = document.getElementById('excel-filter-menu'); if(menu) menu.classList.add('hidden'); };
window.clearFilterForCurrentCol = function() { delete activeFilters[currentFilterCol]; window.closeFilterMenu(); window.saringTabelExcel(); window.updateFilterIcons(); };
window.applyFilterForCurrentCol = function() {
    const checkedBoxes = document.querySelectorAll('.filter-val-cb:checked'); const totalBoxes = document.querySelectorAll('.filter-val-cb');
    if (checkedBoxes.length === totalBoxes.length && document.getElementById('filter-search-input').value.trim() === '') { delete activeFilters[currentFilterCol]; } 
    else { activeFilters[currentFilterCol] = Array.from(checkedBoxes).map(cb => decodeURIComponent(cb.value)); }
    window.closeFilterMenu(); window.saringTabelExcel(); window.updateFilterIcons();
};
window.saringTabelExcel = function() {
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick' : '#tbody-po tr.r-row');
    document.querySelectorAll(tbodyId).forEach(row => {
        let show = true;
        for (let colClass in activeFilters) {
            const allowed = activeFilters[colClass]; const cell = row.querySelector('.' + colClass);
            if (cell) { if (!allowed.includes(cell.getAttribute('data-search') || cell.innerText.trim())) { show = false; break; } }
        }
        if (show) { row.classList.remove('filtered-out'); } 
        else { row.classList.add('filtered-out'); let cb = row.querySelector('.cb-row') || row.querySelector('.pick-row-cb'); if(cb) { cb.checked = false; window.highlightRow(cb); } }
    });
    currentPage = 1; window.applyPagination();
};
window.updateFilterIcons = function() {
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400', 'opacity-100'); icon.classList.add('opacity-40', 'text-white'); });
    for (let colClass in activeFilters) {
        const th = document.querySelector(`th.${colClass}`);
        if (th) { const icon = th.querySelector('.filter-icon'); if (icon) { icon.classList.remove('opacity-40', 'text-white'); icon.classList.add('text-amber-400', 'opacity-100'); } }
    }
};

// ========================================================
// PAGINASI & RENDER TABEL
// ========================================================
window.changeRowsPerPage = function(val) {
    if (val === 'ALL') { rowsPerPage = 999999; } 
    else { rowsPerPage = parseInt(val); }
    currentPage = 1; window.applyPagination();
};

window.applyPagination = function() {
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick' : '#tbody-po tr.r-row');
    const allRows = Array.from(document.querySelectorAll(tbodyId));
    allRows.forEach(row => { if(row.classList.contains('filtered-out')) row.style.display = 'none'; });
    
    const visibleRows = allRows.filter(r => !r.classList.contains('filtered-out'));
    const totalFiltered = visibleRows.length; const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
    
    if(currentPage > totalPages) currentPage = totalPages; 
    if(currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage; const endIndex = startIndex + rowsPerPage;
    
    let sumQty = 0;
    let uniquePOs = new Set();

    visibleRows.forEach((row, index) => {
        const qtyCell = row.querySelector('.col-qty');
        const poCell = row.querySelector('.col-kode_po');
        
        if (qtyCell) sumQty += parseInt(qtyCell.getAttribute('data-search') || qtyCell.innerText) || 0; 
        if (poCell) uniquePOs.add(poCell.getAttribute('data-search') || poCell.innerText);

        if(index >= startIndex && index < endIndex) { row.style.display = ''; } 
        else { row.style.display = 'none'; }
    });

    if(document.getElementById('lbl-tampil-baris')) document.getElementById('lbl-tampil-baris').innerText = totalFiltered;
    if(document.getElementById('lbl-total-qty')) document.getElementById('lbl-total-qty').innerText = sumQty;
    if(document.getElementById('lbl-total-kodepo')) document.getElementById('lbl-total-kodepo').innerText = uniquePOs.size;
    if(document.getElementById('lbl-halaman')) document.getElementById('lbl-halaman').innerText = currentPage;
    if(document.getElementById('lbl-total-halaman')) document.getElementById('lbl-total-halaman').innerText = totalPages;
    
    if(currentMode === 'picking') window.updateSelectedPickCount();
};

window.prevPage = function() { if(currentPage > 1) { currentPage--; window.applyPagination(); } };
window.nextPage = function() { 
    let tbodyId = currentMode === 'atur' ? '#tbody-atur tr.r-row:not(.filtered-out)' : (currentMode === 'picking' ? '#tbody-picking tr.r-row-pick:not(.filtered-out)' : '#tbody-po tr.r-row:not(.filtered-out)');
    const totalVisible = document.querySelectorAll(tbodyId).length;
    if(currentPage < Math.ceil(totalVisible / rowsPerPage)) { currentPage++; window.applyPagination(); } 
};

window.highlightRow = function(cb) {
    const tr = cb.closest('tr');
    if (tr) {
        if (cb.checked) tr.classList.add('selected-row');
        else tr.classList.remove('selected-row');
    }
};

window.initResizableColumns = function() {
    const cols = document.querySelectorAll('#main-table th, #table-atur th, #table-picking th');
    cols.forEach(col => {
        const existing = col.querySelector('.resizer');
        if(existing) existing.remove();

        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        col.appendChild(resizer);
        
        let x = 0; let w = 0;
        resizer.addEventListener('mousedown', function(e) {
            x = e.clientX;
            w = parseInt(window.getComputedStyle(col).width, 10);
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
        });
        const mouseMoveHandler = function(e) {
            const dx = e.clientX - x;
            col.style.width = `${w + dx}px`;
            col.style.minWidth = `${w + dx}px`;
        };
        const mouseUpHandler = function() {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };
    });
};

window.renderHeaderDanTabel = function() {
    const thead = document.getElementById('thead-po');
    const tbody = document.getElementById('tbody-po');
    sortState = {}; 

    let dataset = currentMode === 'input' ? stagingData : dbRecordsRaw;

    let thHtml = `<tr>
        <th class="hdr-std w-10 col-cb text-center relative border-r border-slate-600"><input type="checkbox" onchange="window.toggleAllStaging(this.checked)" class="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"></th>`;
    
    if (currentMode === 'input') {
        thHtml += `<th class="hdr-std w-10 col-btn text-center relative border-r border-slate-600"><i data-lucide="trash-2" class="w-4 h-4 mx-auto text-rose-400"></i></th>
        ${window.thSort(2, 'No', 'col-no w-12')}
        ${window.thSort(3, 'Kode PO', 'col-kode_po')}
        ${window.thSort(4, 'Customer PO', 'col-customer_po')}
        ${window.thSort(5, 'Nama Item', 'col-nama')}
        ${window.thSort(6, 'Panjang', 'col-pjg')}
        ${window.thSort(7, 'Grade', 'col-grade')}
        ${window.thSort(8, 'Dus', 'col-dus')}
        ${window.thSort(9, 'QTY PO', 'col-qty')}
        ${window.thSort(10, 'Status', 'col-status')}
        ${window.thSort(11, 'Note', 'col-note')}`;
    } else {
        thHtml += `<th class="hdr-std w-12 col-atur text-center relative border-r border-slate-600">Atur Item</th>
        ${window.thSort(2, 'No', 'col-no w-12')}
        ${window.thSort(3, 'Waktu Input', 'col-waktu')}
        ${window.thSort(4, 'Kode PO', 'col-kode_po')}
        ${window.thSort(5, 'Customer PO', 'col-customer_po')}
        ${window.thSort(6, 'Nama Item', 'col-nama')}
        ${window.thSort(7, 'Panjang', 'col-pjg')}
        ${window.thSort(8, 'Grade', 'col-grade')}
        ${window.thSort(9, 'Dus', 'col-dus')}
        ${window.thSort(10, 'QTY PO', 'col-qty')}
        ${window.thSort(11, 'QTY PICK', 'col-qty_terpenuhi')}
        ${window.thSort(12, 'Status', 'col-status')}
        ${window.thSort(13, 'Note', 'col-note')}
        ${window.thSort(14, 'PIC', 'col-pic')}`;
    }
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;
    
    if(dataset.length === 0) { 
        let msg = currentMode === 'input' ? 'Belum ada data ditambahkan ke tabel sementara.' : 'Tidak ada data PO di database.';
        tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center font-medium text-slate-400"><i data-lucide="package-search" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> ${msg}</td></tr>`; 
        window.applyPagination(); return; 
    }
    
    let h = '';
    dataset.forEach((r, i) => {
        let tglStr = currentMode === 'input' ? r.created_at : formatTglIntl(r.created_at);
        let noUrut = currentMode === 'input' ? (dataset.length - i) : (i + 1);
        
        let btnHapus = currentMode === 'input' 
            ? `<button onclick="window.hapusBarisStaging(${r.id})" class="text-rose-500 hover:text-white hover:bg-rose-600 bg-white border border-slate-200 p-1.5 rounded-md transition shadow-sm mx-auto flex"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
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
            h += `<td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>`;
            h += `<td class="px-4 py-3 text-center col-btn border-r border-slate-200">${btnHapus}</td>`;
        } else {
            h += `<td class="px-4 py-3 text-center col-cb border-r border-slate-200"><input type="checkbox" value="${r.id}" onchange="window.highlightRow(this)" class="cb-row cursor-pointer w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"></td>`;
            h += `<td class="px-4 py-3 text-center col-atur border-r border-slate-200"><button onclick="window.aturItemPO('${r.id}')" class="bg-blue-600 text-white font-bold px-3 py-1.5 rounded hover:bg-blue-700 transition mx-auto flex text-[10px] uppercase shadow-sm active:scale-95 whitespace-nowrap">Atur Item</button></td>`;
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
    window.saringTabelExcel();
    window.initResizableColumns();
};
