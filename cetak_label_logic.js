// ============================================================================
// WMS SUNPEVECE v3.0 - CETAK LABEL ENGINE (FIX ID NOT-NULL & NO AREA)
// ============================================================================

const PIN_CATEGORY = 'Cetak Label'; 

const createBasePos = () => ({ x: 0, y: 0 });
const baseVis = { qr: true, barcode: true, nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };
const baseVisBack = { nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };

let stateGlobal = {};
const modes = ['label'];
modes.forEach(m => {
    stateGlobal[m] = { zoom: 4.0, pos: { qr: { x: 0, y: 0, s: 1 }, barcode: createBasePos(), nama: createBasePos(), shading: createBasePos(), ukuran: createBasePos(), mesin: createBasePos(), shift: createBasePos(), tanggal: createBasePos(), po: createBasePos(), dus: createBasePos(), isi: createBasePos() }, font: { barcode: 5, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: 'custom', w: 85, h: 50 }, wrap: { nama: 33, barcode: 45, nama_cb: true, barcode_cb: true }, barcodeData: "", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) };
    stateGlobal[m + '_back'] = { pos: { nama: createBasePos(), shading: createBasePos(), ukuran: createBasePos(), mesin: createBasePos(), shift: createBasePos(), tanggal: createBasePos(), po: createBasePos(), dus: createBasePos(), isi: createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 75, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) };
});

let historyStack = {};
modes.forEach(m => historyStack[m] = { undo: [], redo: [] });

let activeSelection = { m: null, elements: [] };
let isDragging = false, dragStartX = 0, dragStartY = 0, dragInitialPos = {};
let pendingAction = null;

// Master Data State (Tabel Terpisah v3.0)
let masterData = { pic: [], mesin: [], shift: [], item: [], grade: [], dus: [], customer: [] };

// Sesi WMS & PIC
const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};
let currentPIC = null;

// State Modal Search & Dropdown
let currentSearchType = ''; 
let selectedSearchData = { nama: '', kode: '', jenis: '', qty_isi: '', grade: '' };
let searchTimeout; 

function getColValue(row, ...possibleKeys) {
    if (!row) return '';
    const rowKeys = Object.keys(row);
    for (let targetKey of possibleKeys) {
        const found = rowKeys.find(k => k.toLowerCase() === targetKey.toLowerCase());
        if (found && row[found] !== null && row[found] !== undefined) {
            return String(row[found]).trim();
        }
    }
    for (let k of rowKeys) {
        if (k.toLowerCase() !== 'id' && typeof row[k] === 'string' && row[k].trim() !== '') {
            return String(row[k]).trim();
        }
    }
    return '';
}

// ==========================================
// 1. INISIALISASI
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.initWMSHeader === 'function') {
        window.initWMSHeader('CETAK LABEL BARCODE');
    }
    
    const today = new Date().toISOString().split('T')[0];
    const tglInput = document.getElementById('label-tgl');
    if (tglInput) tglInput.value = today;

    initKeyboardGlobal();
    renderSettings();   
    renderCanvas();     
    loadSetDefault('label'); 
    
    await loadAllMasterDataResilient(false);
});

document.addEventListener('click', function(e) {
    const list = document.getElementById('pic-dropdown-list');
    const input = document.getElementById('pic-petugas-nama');
    if (list && !list.classList.contains('hidden')) {
        if (!list.contains(e.target) && e.target !== input && !e.target.closest('button[onclick="togglePICDropdown()"]')) {
            list.classList.add('hidden');
        }
    }
});

// TOMBOL REFRESH MANUAL PIC & MASTER
window.refreshMasterDataManual = async function(e) {
    if (e) e.stopPropagation();
    const btn = document.getElementById('btn-refresh-pic');
    const icon = btn ? btn.querySelector('i') : null;
    if (icon) icon.classList.add('animate-spin');

    await loadAllMasterDataResilient(true);

    if (icon) icon.classList.remove('animate-spin');
};

async function loadAllMasterDataResilient(isManual = false) {
    let reportCount = { pic: 0, mesin: 0, item: 0 };

    // 1. PIC
    try {
        const { data, error } = await db.from('user_cetak_label').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
            masterData.pic = data.map(p => ({
                id: p.id,
                nama: getColValue(p, 'nama', 'nama_pic', 'username', 'name'),
                pin: getColValue(p, 'pin')
            })).filter(x => x.nama);

            masterData.pic.sort((a, b) => a.nama.localeCompare(b.nama));
            renderPICDropdownList(masterData.pic);
            reportCount.pic = masterData.pic.length;
        } else {
            document.getElementById('pic-dropdown-list').innerHTML = `<div class="p-3 text-xs font-bold text-amber-600 text-center leading-tight">0 Nama di 'user_cetak_label'. Cek database Supabase.</div>`;
        }
    } catch(e) {
        console.error("Gagal load user_cetak_label:", e);
    }

    // 2. Mesin
    try {
        const { data, error } = await db.from('master_mesin').select('*');
        if (error) throw error;
        masterData.mesin = (data || []).map(d => ({
            nama: getColValue(d, 'mesin', 'nama_mesin', 'nama'),
            kode: getColValue(d, 'kode_mesin', 'kode')
        })).filter(x => x.nama);

        masterData.mesin.sort((a, b) => a.nama.localeCompare(b.nama));
        populateSelect('label-mesin', masterData.mesin, '-- Pilih Mesin --');
        reportCount.mesin = masterData.mesin.length;
    } catch(e) {
        console.error("Gagal load master_mesin:", e);
    }

    // 3. Shift
    try {
        const { data, error } = await db.from('master_shift').select('*');
        if (error) throw error;
        masterData.shift = (data || []).map(d => ({
            nama: getColValue(d, 'shift', 'nama_shift', 'nama'),
            kode: getColValue(d, 'kode_shift', 'kode')
        })).filter(x => x.nama);

        masterData.shift.sort((a, b) => a.nama.localeCompare(b.nama));
        populateSelect('label-shift', masterData.shift, '-- Pilih Shift --');
    } catch(e) {
        console.error("Gagal load master_shift:", e);
    }

    // 4. Grade
    try {
        const { data, error } = await db.from('master_grade').select('*');
        if (error) throw error;
        masterData.grade = (data || []).map(d => ({
            nama: getColValue(d, 'grade', 'nama_grade', 'nama'),
            kode: getColValue(d, 'kode_grade', 'kode')
        })).filter(x => x.nama);

        masterData.grade.sort((a, b) => a.nama.localeCompare(b.nama));
        populateSelect('label-grade', masterData.grade, '-- Pilih / Otomatis --');
    } catch(e) {
        console.error("Gagal load master_grade:", e);
    }

    // 5. Item
    try {
        const { data, error } = await db.from('master_nama_item').select('*');
        if (error) throw error;
        masterData.item = (data || []).map(d => ({
            id: d.id,
            nama: getColValue(d, 'nama_item', 'nama', 'item'),
            kode: getColValue(d, 'kode_nama_item', 'kode'),
            jenis: getColValue(d, 'jenis_item', 'jenis') || '-',
            qty_isi: getColValue(d, 'qty_isi') || '-'
        })).filter(x => x.nama);

        masterData.item.sort((a, b) => a.nama.localeCompare(b.nama));
        reportCount.item = masterData.item.length;
    } catch(e) {
        console.error("Gagal load master_nama_item:", e);
    }

    // 6. Dus (Membaca kolom grade)
    try {
        const { data, error } = await db.from('master_dus').select('*');
        if (error) throw error;
        masterData.dus = (data || []).map(d => ({
            id: d.id,
            nama: getColValue(d, 'dus', 'nama_dus', 'nama', 'merk'),
            kode: getColValue(d, 'kode_dus', 'kode'),
            grade: getColValue(d, 'grade', 'kode_grade') 
        })).filter(x => x.nama);

        masterData.dus.sort((a, b) => a.nama.localeCompare(b.nama));
    } catch(e) {
        console.error("Gagal load master_dus:", e);
    }

    // 7. Customer
    try {
        const { data, error } = await db.from('master_customer').select('*');
        if (error) throw error;
        masterData.customer = (data || []).map(d => ({
            id: d.id,
            nama: getColValue(d, 'customer', 'nama_customer', 'nama', 'po'),
            kode: getColValue(d, 'kode_customer', 'kode')
        })).filter(x => x.nama);

        masterData.customer.sort((a, b) => a.nama.localeCompare(b.nama));
    } catch(e) {
        console.error("Gagal load master_customer:", e);
    }

    if (isManual) {
        if (reportCount.pic > 0) {
            alert(`✅ Berhasil menghubungkan ke Supabase!\n\n- ${reportCount.pic} Nama PIC terambil\n- ${reportCount.mesin} Mesin terambil\n- ${reportCount.item} Item terambil`);
            showPICDropdown();
        } else {
            alert(`⚠️ Periksa Database Supabase!\nTabel 'user_cetak_label' mengembalikan 0 baris data.`);
        }
    }
}

function populateSelect(elementId, items, placeholder) {
    const sel = document.getElementById(elementId);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(it => {
        sel.innerHTML += `<option value="${it.nama}" data-kode="${it.kode}">${it.nama}</option>`;
    });
}

// ==========================================
// 2. SEARCHABLE COMBOBOX PIC & LOGIN
// ==========================================
window.showPICDropdown = function() {
    const list = document.getElementById('pic-dropdown-list');
    if (list) {
        renderPICDropdownList(masterData.pic);
        list.classList.remove('hidden');
    }
};

window.togglePICDropdown = function() {
    const list = document.getElementById('pic-dropdown-list');
    if (list) {
        if (list.classList.contains('hidden')) showPICDropdown();
        else list.classList.add('hidden');
    }
};

window.filterPICDropdown = function(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    const list = document.getElementById('pic-dropdown-list');
    if (!list) return;

    list.classList.remove('hidden');
    const filtered = masterData.pic.filter(p => p.nama.toLowerCase().includes(q));
    renderPICDropdownList(filtered);
};

function renderPICDropdownList(picArray) {
    const list = document.getElementById('pic-dropdown-list');
    if (!list) return;

    if (!picArray || picArray.length === 0) {
        list.innerHTML = `<div class="p-3 text-xs font-bold text-slate-400 text-center">Nama tidak ditemukan</div>`;
        return;
    }

    list.innerHTML = picArray.map(p => `
        <div onclick="selectPIC('${p.nama}')" class="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition active:bg-blue-100">
            <span class="font-black text-sm text-slate-800 uppercase">${p.nama}</span>
            <i data-lucide="user" class="w-4 h-4 text-slate-400"></i>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.selectPIC = function(nama) {
    const input = document.getElementById('pic-petugas-nama');
    if (input) input.value = nama;
    const list = document.getElementById('pic-dropdown-list');
    if (list) list.classList.add('hidden');

    const pinInput = document.getElementById('pic-petugas-kode');
    if (pinInput) pinInput.focus();
};

window.bypassLoginDenganUserLogin = function() {
    currentPIC = currentUser.username || 'ADMIN';
    document.getElementById('lbl-active-pic').innerText = currentPIC;
    
    document.getElementById('panel-auth-pic').classList.add('hidden');
    document.getElementById('left-tab-header').classList.remove('hidden');
    document.getElementById('left-tab-header').classList.add('flex');
    document.getElementById('panel-form').classList.remove('hidden');
    
    const btnGen = document.getElementById('btn-generate-qr');
    btnGen.disabled = false;
    btnGen.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs uppercase shadow-sm transition flex items-center gap-2 active:scale-95 cursor-pointer';
};

window.loginPIC = async function() {
    const picName = (document.getElementById('pic-petugas-nama')?.value || '').trim();
    const pin = (document.getElementById('pic-petugas-kode')?.value || '').trim();
    const btn = document.getElementById('btn-login-pic');

    if (!picName || !pin) return alert("Pilih Nama PIC dan masukkan PIN!");

    const oriHtml = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memeriksa...';
    btn.disabled = true;

    try {
        const matchLocal = masterData.pic.find(p => p.nama.toUpperCase() === picName.toUpperCase() && String(p.pin).trim() === String(pin).trim());

        if (matchLocal) {
            currentPIC = matchLocal.nama;
        } else {
            const { data, error } = await db.from('user_cetak_label').select('*');
            if (error) throw error;
            
            const matchDB = (data || []).find(p => {
                const n = getColValue(p, 'nama', 'nama_pic', 'username', 'name');
                const pi = getColValue(p, 'pin');
                return n.toUpperCase() === picName.toUpperCase() && String(pi).trim() === String(pin).trim();
            });

            if (!matchDB) throw new Error("PIN Salah atau Nama PIC tidak sesuai!");
            currentPIC = getColValue(matchDB, 'nama', 'nama_pic', 'username', 'name');
        }

        document.getElementById('lbl-active-pic').innerText = currentPIC;
        
        document.getElementById('panel-auth-pic').classList.add('hidden');
        document.getElementById('left-tab-header').classList.remove('hidden');
        document.getElementById('left-tab-header').classList.add('flex');
        document.getElementById('panel-form').classList.remove('hidden');
        
        const btnGen = document.getElementById('btn-generate-qr');
        btnGen.disabled = false;
        btnGen.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs uppercase shadow-sm transition flex items-center gap-2 active:scale-95 cursor-pointer';

    } catch(e) {
        alert(e.message);
        document.getElementById('pic-petugas-kode').value = '';
    } finally {
        btn.innerHTML = oriHtml;
        btn.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.logoutPIC = function() {
    if (!confirm("Yakin ingin keluar dari sesi PIC ini?")) return;
    currentPIC = null;
    
    document.getElementById('pic-petugas-kode').value = '';
    document.getElementById('pic-petugas-nama').value = '';
    document.getElementById('panel-auth-pic').classList.remove('hidden');
    document.getElementById('left-tab-header').classList.add('hidden');
    document.getElementById('left-tab-header').classList.remove('flex');
    document.getElementById('panel-form').classList.add('hidden');
    document.getElementById('panel-setting').classList.add('hidden');
    
    const btnGen = document.getElementById('btn-generate-qr');
    btnGen.disabled = true;
    btnGen.className = 'px-4 py-2 bg-slate-300 text-slate-500 font-bold rounded-md text-xs uppercase transition flex items-center gap-2 cursor-not-allowed';
    
    document.getElementById('btn-cetak-label').classList.add('hidden');
};

// ==========================================
// 3. UI RENDERER FORM & SETTINGS
// ==========================================
window.toggleLeftPanel = function(target) {
    const pForm = document.getElementById('panel-form');
    const pSet = document.getElementById('panel-setting');
    const bForm = document.getElementById('btn-view-form');
    const bSet = document.getElementById('btn-view-setting');

    if (target === 'form') {
        pForm.classList.remove('hidden'); pSet.classList.add('hidden');
        bForm.className = 'flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-sm transition cursor-pointer';
        bSet.className = 'flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded transition cursor-pointer';
    } else {
        pForm.classList.add('hidden'); pSet.classList.remove('hidden');
        bSet.className = 'flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-sm transition cursor-pointer';
        bForm.className = 'flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded transition cursor-pointer';
        switchSideSettings(); 
    }
};

window.updateShading = function() {
    let v1 = document.getElementById(`label-shading-1`)?.value.trim().toUpperCase() || '';
    let v2 = document.getElementById(`label-shading-2`)?.value.trim().toUpperCase() || '';
    let v3 = document.getElementById(`label-shading-3`)?.value.trim().toUpperCase() || '';
    
    let arr = [];
    if (v1) arr.push(v1); if (v2) arr.push(v2); if (v3) arr.push(v3);
    
    let hidden = document.getElementById(`label-shading`);
    if (hidden) hidden.value = arr.join('-');
};

function renderSettings() {
    const container = document.getElementById('panel-setting');
    if (!container) return;

    container.innerHTML = `
        <div>
            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Pilih Sisi Label</label>
            <select id="side-select" onchange="switchSideSettings()" class="w-full p-2 text-sm border-2 border-slate-300 rounded outline-none focus:border-blue-500 font-bold bg-white cursor-pointer">
                <option value="front">Label Depan (Dengan QR)</option>
                <option value="back">Label Belakang (Tanpa QR)</option>
            </select>
        </div>

        <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg">
            <h4 class="text-xs font-black text-slate-700 mb-3 border-b border-slate-200 pb-1">Kertas Label</h4>
            <select id="kertas-select" onchange="ubahTipeKertas()" class="w-full p-2 text-xs border border-slate-300 rounded outline-none font-bold mb-2">
                <option value="custom">Kustom Ukuran</option>
                <option value="50.8x27.9">50.8 x 27.9 mm (Zebra)</option>
            </select>
            <div id="custom-kertas-form" class="flex gap-2">
                <div><label class="text-[10px] font-bold">Lebar (mm)</label><input type="number" id="custom-w" value="85" step="0.1" class="w-full p-1 border rounded text-xs" oninput="updateKertasCustom()"></div>
                <div><label class="text-[10px] font-bold">Tinggi (mm)</label><input type="number" id="custom-h" value="50" step="0.1" class="w-full p-1 border rounded text-xs" oninput="updateKertasCustom()"></div>
            </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <h4 class="text-xs font-black text-slate-700">Tampilkan Elemen</h4>
                <button onclick="resetDefaultVisibility()" class="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">Reset Default</button>
            </div>
            <div class="grid grid-cols-2 gap-2" id="vis-checkboxes"></div>
        </div>

        <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg">
            <h4 class="text-xs font-black text-slate-700 mb-2">Wrap Text (Bungkus)</h4>
            <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer" id="row-wrap-barcode"><input type="checkbox" id="cb-wrap-barcode" onchange="handleWrapChange('barcode', this.checked)" class="w-4 h-4 accent-blue-600 cursor-pointer"> Kode Barcode</label>
                <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer"><input type="checkbox" id="cb-wrap-nama" onchange="handleWrapChange('nama', this.checked)" class="w-4 h-4 accent-blue-600 cursor-pointer"> Nama Item</label>
            </div>
        </div>
    `;
    switchSideSettings();
}

function renderCanvas() {
    const wrapper = document.getElementById('labels-wrapper');
    if (!wrapper) return;

    const buildCanvas = (side) => {
        const isBack = side === 'back';
        const idSfx = isBack ? '-back' : '';
        
        let w = stateGlobal['label'].kertas.w + 'mm';
        let h = stateGlobal['label'].kertas.h + 'mm';

        return `
        <div class="flex flex-col items-center gap-1">
            <span class="text-[8px] font-black text-white ${isBack ? 'bg-slate-500' : 'bg-blue-700'} px-2 py-0.5 rounded uppercase">Label ${isBack ? 'Belakang' : 'Depan'}</span>
            <div id="canvas${idSfx}" class="label-canvas" style="width: ${w}; height: ${h};">
                ${!isBack ? `
                <div class="w-[30%] h-full flex flex-col justify-center items-center">
                    <div id="qr-wrapper" class="click-edit" onmousedown="startDrag('qr', event, ${isBack})"><div id="qrcode" style="width:45px; height:45px;"></div></div>
                    <div id="el-barcode${idSfx}" class="click-edit mt-[2px] font-bold text-center leading-[1.1] text-black" style="font-size: 5px; max-width: 45px;" onmousedown="startDrag('barcode', event, ${isBack})">BARCODE/0001</div>
                </div>
                ` : ''}
                <div class="${isBack ? 'w-full' : 'w-[70%] pl-1'} h-full flex flex-col">
                    <div class="flex-[3] flex flex-col justify-center items-center">
                        <div id="el-nama${idSfx}" class="click-edit font-black leading-none text-center text-black" style="font-size: 16px; max-width: ${isBack ? '75mm' : '33mm'};" onmousedown="startDrag('nama', event, ${isBack})">NAMA ITEM</div>
                        <div id="el-shading${idSfx}" class="click-edit font-bold text-center whitespace-nowrap text-black" style="font-size: 14px;" onmousedown="startDrag('shading', event, ${isBack})">SHADING</div>
                    </div>
                    <div id="el-info-group${idSfx}" class="flex-[1] flex justify-center items-end font-bold gap-[5px] text-black" style="font-size: 6px;">
                        <div id="el-ukuran${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('ukuran', event, ${isBack})">UK 20 x 400</div>
                        <div id="el-mesin${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('mesin', event, ${isBack})">M1</div>
                        <div id="el-shift${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('shift', event, ${isBack})">S1</div>
                        <div id="el-tanggal${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('tanggal', event, ${isBack})">01/01/2024</div>
                        <div id="el-po${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('po', event, ${isBack})">CUST</div>
                        <div id="el-dus${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('dus', event, ${isBack})">MERK</div>
                        <div id="el-isi${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('isi', event, ${isBack})">QTY: 15</div>
                    </div>
                </div>
            </div>
        </div>`;
    };

    wrapper.innerHTML = buildCanvas('front') + buildCanvas('back');
    
    let qrEl = document.getElementById('qrcode');
    if (qrEl) {
        qrEl.innerHTML = "";
        new QRCode(qrEl, { text: "DUMMY/QR/CODE", width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L });
        setTimeout(() => { let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); }, 50);
    }
}

// ========================================================
// 4. MODAL SEARCH, TAMBAH BARU & HAPUS MASTER V2.3
// ========================================================
window.bukaModalSearch = function(type) {
    currentSearchType = type;
    const titleMap = { 'item': 'Nama Item', 'customer': 'Customer (PO)', 'dus': 'Merk / Dus' };
    document.getElementById('title-modal-search').innerText = `Cari ${titleMap[type] || 'Data'}`;
    
    document.getElementById('input-search-list').value = '';
    renderSearchList();

    document.getElementById('modal-search').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-search-list').focus(), 100);
};

window.tutupModalSearch = function() {
    document.getElementById('modal-search').classList.add('hidden');
};

function renderSearchList() {
    const ul = document.getElementById('list-search-result');
    const dataArr = masterData[currentSearchType] || [];
    
    if (dataArr.length === 0) {
        ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold">Data kosong atau belum terambil.</li>';
        return;
    }

    const limit = 100;
    const displayData = dataArr.slice(0, limit);

    ul.innerHTML = displayData.map(d => {
        let badgeInfo = d.kode || '-';
        if (currentSearchType === 'dus' && d.grade) {
            badgeInfo += ` • ${d.grade}`;
        }
        return `
        <li onclick="selectSearchItem('${d.nama}', '${d.kode}', '${d.jenis || ''}', '${d.qty_isi || ''}', '${d.grade || ''}')" class="search-item p-3 border border-slate-200 rounded-lg cursor-pointer flex justify-between items-center active:bg-slate-200 active:border-slate-400 transition">
            <span class="font-bold text-slate-700 text-sm">${d.nama}</span>
            <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">${badgeInfo}</span>
        </li>`;
    }).join('');
}

window.filterSearchList = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const q = document.getElementById('input-search-list').value.toLowerCase().trim();
        const dataArr = masterData[currentSearchType] || [];
        
        let filteredData = dataArr;
        if (q) {
            filteredData = dataArr.filter(d => (d.nama || '').toLowerCase().includes(q));
        }

        const ul = document.getElementById('list-search-result');
        const limit = 100;
        const displayData = filteredData.slice(0, limit);

        if (displayData.length === 0) {
            ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold">Tidak ditemukan.</li>';
            return;
        }

        ul.innerHTML = displayData.map(d => {
            let badgeInfo = d.kode || '-';
            if (currentSearchType === 'dus' && d.grade) {
                badgeInfo += ` • ${d.grade}`;
            }
            return `
            <li onclick="selectSearchItem('${d.nama}', '${d.kode}', '${d.jenis || ''}', '${d.qty_isi || ''}', '${d.grade || ''}')" class="search-item p-3 border border-slate-200 rounded-lg cursor-pointer flex justify-between items-center active:bg-slate-200 active:border-slate-400 transition">
                <span class="font-bold text-slate-700 text-sm">${d.nama}</span>
                <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">${badgeInfo}</span>
            </li>`;
        }).join('');
        
    }, 150); 
};

window.selectSearchItem = function(nama, kode, jenis, qty_isi, grade) {
    document.querySelectorAll('.search-item').forEach(li => li.classList.remove('bg-blue-100', 'border-blue-400'));
    event.currentTarget.classList.add('bg-blue-100', 'border-blue-400');
    selectedSearchData = { nama, kode, jenis, qty_isi, grade };
};

window.pilihDataSearch = function() {
    if (!selectedSearchData.nama) return alert("Pilih data dari daftar terlebih dahulu!");
    
    let inputId = `label-${currentSearchType === 'customer' ? 'po' : currentSearchType}`;
    let el = document.getElementById(inputId);
    
    if (el) {
        el.value = selectedSearchData.nama;
        el.setAttribute('data-kode', selectedSearchData.kode);
    }

    if (currentSearchType === 'item') {
        const elJenis = document.getElementById('label-jenis');
        const elQtyIsi = document.getElementById('label-qty-isi');
        if (elJenis) elJenis.value = selectedSearchData.jenis || '-';
        if (elQtyIsi) elQtyIsi.value = selectedSearchData.qty_isi || '-';
    }

    if (currentSearchType === 'dus') {
        const gradeVal = selectedSearchData.grade || '';
        if (gradeVal) {
            const gradeSel = document.getElementById('label-grade');
            if (gradeSel) {
                let matched = false;
                for (let opt of gradeSel.options) {
                    if (opt.value.toUpperCase() === gradeVal.toUpperCase() || opt.text.toUpperCase() === gradeVal.toUpperCase()) {
                        opt.selected = true;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    gradeSel.innerHTML += `<option value="${gradeVal}" data-kode="" selected>${gradeVal}</option>`;
                }
            }
        }
    }
    
    tutupModalSearch();
    selectedSearchData = { nama: '', kode: '', jenis: '', qty_isi: '', grade: '' }; 
};

// ========================================================
// AUTO-GENERATE KODE SISTEM (ANTI-DUPLIKAT, MAKS 5-6 DIGIT)
// ========================================================
window.handleAutoGenerateCode = function() {
    const nama = document.getElementById('input-tambah-nama')?.value.trim().toUpperCase() || '';
    const kodeInput = document.getElementById('input-tambah-kode');
    if (!kodeInput) return;

    if (currentSearchType === 'item') {
        const jenis = document.getElementById('input-tambah-jenis')?.value || 'Plafon';
        kodeInput.value = generateItemCode(nama, jenis);
    } else if (currentSearchType === 'customer') {
        kodeInput.value = generateCustomerCode();
    }
};

function generateItemCode(nama, jenis) {
    if (!nama) return '';
    let prefix = 'P';
    if (jenis === 'Lis') prefix = 'L';
    else if (jenis === 'WPC') prefix = 'W';

    const words = nama.split(/[\s_-]+/).filter(w => w.length > 0);
    let initials = '';
    
    if (words.length >= 3) {
        initials = (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).substring(0, 3);
    } else if (words.length === 2) {
        initials = (words[0].charAt(0) + words[1].substring(0, 2)).substring(0, 3);
    } else if (words.length === 1) {
        initials = words[0].substring(0, 3);
    }

    let baseCode = (prefix + initials).replace(/[^A-Z0-9]/g, '');
    if (baseCode.length > 4) baseCode = baseCode.substring(0, 4);

    const existingCodes = (masterData.item || []).map(i => (i.kode || '').toUpperCase());

    if (!existingCodes.includes(baseCode)) {
        return baseCode;
    }

    let counter = 1;
    while (existingCodes.includes(`${baseCode}${counter}`)) {
        counter++;
    }
    return `${baseCode}${counter}`;
}

function generateCustomerCode() {
    const existingCodes = (masterData.customer || []).map(c => (c.kode || '').toUpperCase());
    let maxNum = 0;
    
    existingCodes.forEach(code => {
        const match = code.match(/^P(\d+)$/i);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });

    let nextNum = maxNum + 1;
    while (existingCodes.includes(`P${nextNum}`)) {
        nextNum++;
    }
    return `P${nextNum}`;
}

// --- TAMBAH MASTER BARU ---
window.bukaModalTambahMaster = function() {
    document.getElementById('input-tambah-nama').value = '';
    document.getElementById('input-tambah-kode').value = '';
    document.getElementById('input-tambah-pin').value = '';
    
    const titleMap = { 'item': 'Item', 'customer': 'Customer', 'dus': 'Dus / Merk' };
    document.getElementById('title-tambah-master').innerText = titleMap[currentSearchType] || 'Data';

    const wrapItemExtra = document.getElementById('wrap-tambah-item-extra');
    if (wrapItemExtra) wrapItemExtra.classList.toggle('hidden', currentSearchType !== 'item');

    const wrapDusExtra = document.getElementById('wrap-tambah-dus-extra');
    if (wrapDusExtra) wrapDusExtra.classList.toggle('hidden', currentSearchType !== 'dus');

    const kodeInput = document.getElementById('input-tambah-kode');
    const infoAuto = document.getElementById('lbl-info-auto-kode');

    if (currentSearchType === 'item' || currentSearchType === 'customer') {
        if (kodeInput) kodeInput.readOnly = true;
        if (kodeInput) kodeInput.classList.add('bg-slate-100', 'cursor-not-allowed');
        if (infoAuto) infoAuto.classList.remove('hidden');
        if (currentSearchType === 'customer') {
            if (kodeInput) kodeInput.value = generateCustomerCode();
        }
    } else {
        if (kodeInput) kodeInput.readOnly = false;
        if (kodeInput) kodeInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
        if (infoAuto) infoAuto.classList.add('hidden');
    }

    document.getElementById('modal-tambah-master').classList.remove('hidden');
};

async function validatePin(inputPin) {
    try {
        const { data, error } = await db.from('master_pin')
            .select('pin')
            .ilike('kategori', PIN_CATEGORY) 
            .single();
            
        if (!error && data) {
            return String(data.pin).trim() === String(inputPin).trim();
        }
        return inputPin === '1234' || (currentPIC && masterData.pic.some(p => p.nama === currentPIC && String(p.pin) === String(inputPin)));
    } catch (e) {
        return inputPin === '1234';
    }
}

window.simpanDataMasterBaru = async function() {
    const nama = document.getElementById('input-tambah-nama').value.trim().toUpperCase();
    let kode = document.getElementById('input-tambah-kode').value.trim().toUpperCase();
    const pin = document.getElementById('input-tambah-pin').value;

    if (!nama || !pin) return alert("Nama dan PIN wajib diisi!");
    
    if (currentSearchType === 'item') {
        const jenis = document.getElementById('input-tambah-jenis').value;
        kode = kode || generateItemCode(nama, jenis);
    } else if (currentSearchType === 'customer') {
        kode = kode || generateCustomerCode();
    } else if (!kode) {
        return alert("Kode Unik wajib diisi!");
    }

    const btn = document.getElementById('btn-simpan-master'); 
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; 
    btn.disabled = true;

    try {
        const isPinValid = await validatePin(pin);
        if (!isPinValid) throw new Error("⛔ PIN SALAH! Silakan periksa kembali PIN Anda.");

        let targetTable = '';
        let payload = {};

        if (currentSearchType === 'item') {
            targetTable = 'master_nama_item';
            const jenis = document.getElementById('input-tambah-jenis').value;
            const qtyIsi = document.getElementById('input-tambah-qtyisi').value || '15';
            payload = { nama_item: nama, kode_nama_item: kode, jenis_item: jenis, qty_isi: qtyIsi };
        } else if (currentSearchType === 'dus') {
            targetTable = 'master_dus';
            const gradeBawaan = document.getElementById('input-tambah-dus-grade')?.value.trim().toUpperCase() || 'BAGUS';
            payload = { dus: nama, kode_dus: kode, grade: gradeBawaan };
        } else if (currentSearchType === 'customer') {
            targetTable = 'master_customer';
            payload = { customer: nama, kode_customer: kode };
        }

        const { error } = await db.from(targetTable).insert([payload]);
        if (error) throw error;

        alert(`Data ${nama} dengan Kode ${kode} berhasil ditambahkan!`);
        document.getElementById('modal-tambah-master').classList.add('hidden');
        
        await loadAllMasterDataResilient(false);
        renderSearchList();

    } catch(e) {
        alert(e.message);
    } finally {
        btn.innerHTML = ori; 
        btn.disabled = false; 
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

// --- HAPUS MASTER TERPILIH ---
window.hapusDataMaster = function() {
    if (!selectedSearchData.nama) return alert("Pilih data yang ingin dihapus dari daftar!");
    
    mintaPin(`Hapus '${selectedSearchData.nama}'`, async () => {
        try {
            let targetTable = '';
            let targetCol = '';

            if (currentSearchType === 'item') {
                targetTable = 'master_nama_item';
                targetCol = 'nama_item';
            } else if (currentSearchType === 'dus') {
                targetTable = 'master_dus';
                targetCol = 'dus';
            } else if (currentSearchType === 'customer') {
                targetTable = 'master_customer';
                targetCol = 'customer';
            }

            const { error } = await db.from(targetTable).delete().eq(targetCol, selectedSearchData.nama);
            if (error) throw error;

            alert("Data berhasil dihapus!");
            selectedSearchData = { nama: '', kode: '', jenis: '', qty_isi: '', grade: '' };
            await loadAllMasterDataResilient(false);
            renderSearchList();
        } catch(e) {
            alert("Gagal menghapus: " + e.message);
        }
    });
};

function mintaPin(title, callback) {
    document.getElementById('pin-global-title').innerText = title;
    document.getElementById('input-pin-global').value = '';
    pendingAction = callback;
    document.getElementById('modal-pin-global').classList.remove('hidden');
}

window.tutupModalPinGlobal = function() {
    document.getElementById('modal-pin-global').classList.add('hidden');
    pendingAction = null;
};

window.eksekusiPinGlobal = async function() {
    let pinInput = document.getElementById('input-pin-global');
    let pin = pinInput.value;
    
    if (!pin) return alert("Masukkan PIN!");

    const isPinValid = await validatePin(pin);
    if (isPinValid) {
        document.getElementById('modal-pin-global').classList.add('hidden');
        pinInput.value = '';
        if (pendingAction) pendingAction();
    } else {
        alert("⛔ PIN SALAH! Silakan periksa kembali PIN Anda.");
        pinInput.value = '';
        pinInput.focus();
    }
};

// ==========================================
// 5. GENERATE BARCODE & PRINT
// ==========================================
const findKode = (type, name) => {
    if (!name) return "";
    const arr = masterData[type];
    if (!arr) return "";
    const found = arr.find(x => (x.nama || '').toUpperCase() === name.toUpperCase());
    return found && found.kode ? found.kode : ""; 
};

window.generateLabel = function() {
    let tgl = document.getElementById(`label-tgl`).value;
    let mesin = document.getElementById(`label-mesin`).value.trim();
    let shift = document.getElementById(`label-shift`).value.trim();
    let item = document.getElementById(`label-item`).value.trim();
    let jenis = document.getElementById(`label-jenis`).value.trim(); 
    let qtyIsi = document.getElementById(`label-qty-isi`).value.trim(); 
    let panjang = document.getElementById(`label-panjang`).value.trim();
    let grade = document.getElementById(`label-grade`) ? document.getElementById(`label-grade`).value.trim() : '';
    let dus = document.getElementById(`label-dus`).value.trim();
    let shading = document.getElementById(`label-shading`).value.trim();
    let po = document.getElementById(`label-po`) ? document.getElementById(`label-po`).value.trim() : '';
    let qty = parseInt(document.getElementById(`label-qty`).value);

    if (!tgl || !mesin || !shift || !item || !panjang || !grade || !dus || !shading || !po || isNaN(qty) || qty < 1) {
        return alert("Terdapat variable yg belum diinput, silahkan mengisi semua variable pada daftar input!!");
    }

    let kItem = document.getElementById(`label-item`).getAttribute('data-kode') || findKode('item', item);
    let kMesin = document.getElementById(`label-mesin`).options[document.getElementById(`label-mesin`).selectedIndex]?.getAttribute('data-kode') || findKode('mesin', mesin);
    let kShift = document.getElementById(`label-shift`).options[document.getElementById(`label-shift`).selectedIndex]?.getAttribute('data-kode') || '';
    let kDus = document.getElementById(`label-dus`).getAttribute('data-kode') || findKode('dus', dus);
    
    let isLis = jenis.toUpperCase() === 'LIS' || jenis.toUpperCase() === 'LIST';
    let kGrade = isLis ? '1' : (document.getElementById(`label-grade`).options[document.getElementById(`label-grade`).selectedIndex]?.getAttribute('data-kode') || '');
    let kPo = isLis ? 'P49' : (document.getElementById(`label-po`).getAttribute('data-kode') || findKode('customer', po));

    let pAngka = panjang.replace(/\D/g, ''); 
    
    let dObj = new Date(tgl);
    let start = new Date(dObj.getFullYear(), 0, 0);
    let diff = (dObj - start) + ((start.getTimezoneOffset() - dObj.getTimezoneOffset()) * 60 * 1000);
    let dayStr = String(Math.floor(diff / 86400000)).padStart(3, '0');
    let yrRev = String(dObj.getFullYear()).slice(-2).split('').reverse().join('');
    let dateCode = dayStr + yrRev;
    
    let bText = `${kItem}/${shading}/${pAngka}${kGrade}${kDus}/${dateCode}${kMesin}${kShift}${kPo}`;
    stateGlobal['label'].barcodeData = bText;

    let rawPjgNum = panjang.replace(/[^0-9.,]/g, '').replace(',', '.');
    let ukuranStr = "";
    if (isLis) {
        ukuranStr = `P ${rawPjgNum} meter`;
    } else {
        let hasilPanjang = Math.round(parseFloat(rawPjgNum) * 100) || 0;
        ukuranStr = `UK 20 x ${hasilPanjang}`; 
    }

    let shiftAngka = shift.replace(/\D/g, '');
    let tglStr = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
    
    let isiStr = (qtyIsi && qtyIsi !== '-' && qtyIsi !== '') ? `QTY: ${qtyIsi}` : "QTY: -"; 
    let shiftStr = shiftAngka ? "S" + shiftAngka : "";
    let poStr = isLis ? "P49" : po;

    const setTxt = (id, txt) => { let el = document.getElementById(id); if (el) el.innerText = txt; };
    
    document.getElementById('el-nama').innerHTML = item;
    setTxt('el-shading', shading); setTxt('el-mesin', mesin); setTxt('el-po', poStr); setTxt('el-dus', dus);
    setTxt('el-ukuran', ukuranStr); setTxt('el-isi', isiStr); setTxt('el-shift', shiftStr); setTxt('el-tanggal', tglStr);
    
    document.getElementById('el-nama-back').innerHTML = item;
    setTxt('el-shading-back', shading); setTxt('el-mesin-back', mesin); setTxt('el-po-back', poStr); setTxt('el-dus-back', dus);
    setTxt('el-ukuran-back', ukuranStr); setTxt('el-isi-back', isiStr); setTxt('el-shift-back', shiftStr); setTxt('el-tanggal-back', tglStr);

    let isRevisi = document.getElementById(`label-cb-revisi`)?.checked;
    let suffixRevisi = isRevisi ? " N" : "";

    setTxt('el-barcode', bText + "/0001" + suffixRevisi);
    
    let qrEl = document.getElementById('qrcode');
    if (qrEl) { 
        qrEl.innerHTML = ""; 
        new QRCode(qrEl, { text: bText + "/0001", width: 150, height: 150, correctLevel : QRCode.CorrectLevel.L }); 
        setTimeout(() => { let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); }, 50);
    }

    applyCurrentStateToDOM('label');
    
    // TAMPILKAN TOMBOL CETAK LABEL
    const btnCetak = document.getElementById('btn-cetak-label');
    if (btnCetak) {
        btnCetak.classList.remove('hidden');
        btnCetak.classList.add('flex');
    }
    return true;
};

window.printHTMLData = ""; 

window.bukaTabPrint = function() {
    let pWin = window.open('', '_blank');
    if (!pWin) {
        alert("Popup diblokir oleh browser! Silakan izinkan pop-up di address bar atas, lalu klik tombol lagi.");
        return;
    }
    pWin.document.open();
    pWin.document.write(window.printHTMLData);
    pWin.document.close();
    
    setTimeout(() => { pWin.focus(); pWin.print(); }, 200);
    document.getElementById('modal-progress-print').classList.add('hidden');
};

window.cetakLabel = async function() {
    if (!currentPIC) return alert("Sesi PIC tidak valid. Silakan login PIC terlebih dahulu.");
    if (!stateGlobal['label'].barcodeData) return alert("Silakan klik '1. Buat QR' terlebih dahulu!");

    let qty = parseInt(document.getElementById(`label-qty`).value) || 1;
    
    document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
    document.getElementById('context-panel').classList.add('hidden');

    document.getElementById('modal-progress-print').classList.remove('hidden');
    document.getElementById('print-done-area').classList.add('hidden');
    document.getElementById('print-loading-area').classList.remove('hidden');
    document.getElementById('print-title').innerText = 'Memproses Label...';
    document.getElementById('print-progress-bar').style.width = '0%';
    document.getElementById('print-progress-text').innerText = '0% Selesai';

    let item = document.getElementById(`label-item`).value;
    let panjang = document.getElementById(`label-panjang`).value.trim().toUpperCase();
    if (!panjang.endsWith('M')) panjang += 'M';
    let grade = document.getElementById(`label-grade`) ? document.getElementById(`label-grade`).value : (document.getElementById(`label-jenis`).value === 'Lis' ? '1' : '');
    
    let idKombinasi = `${item}_${panjang}_${grade}`.toUpperCase().replace(/\s/g, "");

    try {
        // 1. UPDATE / INSERT SERIAL KE database_kode_unik
        let startSerial = 1;
        const { data: unikData, error: errUnik } = await db
            .from('database_kode_unik')
            .select('id, last_serial')
            .eq('id_kombinasi', idKombinasi)
            .maybeSingle(); // Menggunakan maybeSingle agar tidak throw exception jika baris belum ada

        if (errUnik) {
            console.warn("Notice database_kode_unik:", errUnik.message);
        }

        if (unikData && unikData.last_serial) {
            startSerial = parseInt(unikData.last_serial) + 1;
        }
        let endSerial = startSerial + qty - 1;
        
        if (unikData && unikData.id) {
            const { error: errUpd } = await db.from('database_kode_unik').update({ last_serial: endSerial }).eq('id', unikData.id);
            if (errUpd) console.error("Gagal update database_kode_unik:", errUpd.message);
        } else {
            const { error: errIns } = await db.from('database_kode_unik').insert([{ 
                id_kombinasi: idKombinasi, 
                nama_item: item, 
                panjang: panjang, 
                grade: grade, 
                last_serial: endSerial 
            }]);
            if (errIns) console.error("Gagal insert database_kode_unik:", errIns.message);
        }

        // 2. PERSIAPKAN RENDER CANVAS & PRINT IMAGE
        let nodeFront = document.getElementById('canvas'); 
        let nodeBack = document.getElementById('canvas-back'); 
        let wrapper = document.getElementById('labels-wrapper');
        
        let oldWrapTransform = wrapper.style.transform;
        wrapper.style.transform = 'none';
        
        let oldTransformFront = nodeFront.style.transform; 
        let oldTransformBack = nodeBack.style.transform;
        nodeFront.style.transform = 'none'; nodeFront.style.border = 'none';
        nodeBack.style.transform = 'none'; nodeBack.style.border = 'none';
        
        let container = document.getElementById('preview-container');
        let oldOverflow = container.style.overflowY; container.style.overflowY = 'visible';
        
        let isRevisi = document.getElementById(`label-cb-revisi`)?.checked;
        let suffixRevisi = isRevisi ? " N" : "";

        nodeFront.style.transition = 'none';
        nodeBack.style.transition = 'none';

        await new Promise(r => setTimeout(r, 50)); 
        
        let canvasBack = await html2canvas(nodeBack, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, imageTimeout: 0 });
        let imgBackBase64 = canvasBack.toDataURL("image/png", 1.0);

        let qrWrapper = document.getElementById('qr-wrapper');
        let bcEl = document.getElementById('el-barcode');
        
        let origQrVis = qrWrapper.style.visibility;
        let origBcVis = bcEl.style.visibility;
        qrWrapper.style.visibility = 'hidden';
        bcEl.style.visibility = 'hidden';

        let baseFrontCanvas = await html2canvas(nodeFront, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, imageTimeout: 0 });

        qrWrapper.style.visibility = origQrVis;
        bcEl.style.visibility = origBcVis;

        let canvasRect = nodeFront.getBoundingClientRect();
        let qrRect = qrWrapper.getBoundingClientRect();
        let bcRect = bcEl.getBoundingClientRect();

        let scale = 2; 
        let qrX = (qrRect.left - canvasRect.left) * scale;
        let qrY = (qrRect.top - canvasRect.top) * scale;
        let qrW = qrRect.width * scale;
        let qrH = qrRect.height * scale;

        let bcX = (bcRect.left - canvasRect.left) * scale;
        let bcY = (bcRect.top - canvasRect.top) * scale;
        let bcW = bcRect.width * scale;
        let bcFontSize = (parseFloat(window.getComputedStyle(bcEl).fontSize) || 5) * scale;

        let offCanvas = document.createElement('canvas');
        offCanvas.width = baseFrontCanvas.width;
        offCanvas.height = baseFrontCanvas.height;
        let ctx = offCanvas.getContext('2d');

        let qrTempDiv = document.createElement('div');
        qrTempDiv.style.position = 'absolute';
        qrTempDiv.style.left = '-9999px';
        document.body.appendChild(qrTempDiv);

        let sequenceImages = [];
        let currentRenderCount = 1;
        let payloadGudangArr = [];

        // 3. AMBIL NEXT ID UNTUK database_gudang AGAR TIDAK VIOLATE NOT-NULL
        let nextGudangId = null;
        try {
            const { data: lastRow } = await db.from('database_gudang').select('id').order('id', { ascending: false }).limit(1);
            if (lastRow && lastRow.length > 0 && lastRow[0].id !== null && !isNaN(lastRow[0].id)) {
                nextGudangId = parseInt(lastRow[0].id) + 1;
            } else {
                nextGudangId = Date.now();
            }
        } catch(e) {
            nextGudangId = Date.now();
        }

        for (let i = startSerial; i <= endSerial; i++) {
            let serialStr = "/" + String(i).padStart(4, '0');
            let fullBarcode = stateGlobal['label'].barcodeData + serialStr + suffixRevisi;
            
            ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            ctx.drawImage(baseFrontCanvas, 0, 0); 

            qrTempDiv.innerHTML = "";
            new QRCode(qrTempDiv, { text: stateGlobal['label'].barcodeData + serialStr, width: 300, height: 300, correctLevel : QRCode.CorrectLevel.L });
            let qrSourceCanvas = qrTempDiv.querySelector('canvas');

            if (qrSourceCanvas) {
                ctx.drawImage(qrSourceCanvas, qrX, qrY, qrW, qrH); 
            }

            ctx.font = `bold ${bcFontSize}px monospace, sans-serif`;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            let isWrapOn = stateGlobal['label'].wrap.barcode_cb;
            
            if (isWrapOn) {
                let maxWidth = bcW; 
                let lineHeight = bcFontSize * 1.2; 
                let lines = [];
                let currentLine = '';

                for (let j = 0; j < fullBarcode.length; j++) {
                    let char = fullBarcode[j];
                    let testLine = currentLine + char;
                    let metrics = ctx.measureText(testLine);
                    
                    if (metrics.width > maxWidth && j > 0) {
                        lines.push(currentLine);
                        currentLine = char;
                    } else {
                        currentLine = testLine;
                    }
                }
                lines.push(currentLine);

                lines.forEach((line, index) => {
                    ctx.fillText(line, bcX + (bcW / 2), bcY + (index * lineHeight));
                });
            } else {
                ctx.fillText(fullBarcode, bcX + (bcW / 2), bcY);
            }

            let imgFrontBase64 = offCanvas.toDataURL("image/png");
            sequenceImages.push(imgFrontBase64);
            sequenceImages.push(imgBackBase64); 
            
            // PAYLOAD DENGAN ID OTOMATIS, pic_print, DAN akun (TANPA AREA & TANPA PIC)
            payloadGudangArr.push({
                id: nextGudangId++, 
                tgl_produksi: document.getElementById(`label-tgl`).value,
                mesin: document.getElementById(`label-mesin`).value || '-',
                shift: document.getElementById(`label-shift`).value || '-',
                jenis_item: document.getElementById(`label-jenis`).value,
                nama_item: item,
                panjang: panjang,
                grade: grade || '-',
                dus: document.getElementById(`label-dus`).value || '-',
                shading: document.getElementById(`label-shading`).value || '-',
                customer: document.getElementById(`label-po`) ? document.getElementById(`label-po`).value : '-',
                qty_print: 1,
                pic_print: currentPIC,             // Mencatat nama PIC
                akun: currentUser.username,        // Mencatat user login WMS
                kode_barcode: fullBarcode
            });

            let pct = Math.round((currentRenderCount / qty) * 100);
            document.getElementById('print-progress-bar').style.width = pct + '%';
            document.getElementById('print-progress-text').innerText = `${pct}% Selesai (${currentRenderCount}/${qty})`;
            
            currentRenderCount++;
            await new Promise(r => requestAnimationFrame(r));
        }
        
        document.body.removeChild(qrTempDiv);

        nodeFront.style.transform = oldTransformFront; nodeFront.style.border = '1px solid black'; nodeFront.style.transition = '';
        nodeBack.style.transform = oldTransformBack; nodeBack.style.border = '1px solid black'; nodeBack.style.transition = '';
        wrapper.style.transform = oldWrapTransform; container.style.overflowY = oldOverflow;
        
        // 4. SIMPAN KE database_gudang
        let { error: errGudang } = await db.from('database_gudang').insert(payloadGudangArr);
        
        // Penanganan jika nama kolom tanggal di database masih ejaan lama (tgl_produksii)
        if (errGudang && errGudang.message && errGudang.message.includes('tgl_produksi')) {
            const fallbackArr = payloadGudangArr.map(p => {
                const c = { ...p, tgl_produksii: p.tgl_produksi };
                delete c.tgl_produksi;
                return c;
            });
            const resFallback = await db.from('database_gudang').insert(fallbackArr);
            errGudang = resFallback.error;
        }

        // Penanganan jika ID auto-increment database menolak ID manual dari JS
        if (errGudang && errGudang.message && (errGudang.message.includes('identity') || errGudang.message.includes('unique'))) {
            const noIdArr = payloadGudangArr.map(p => {
                const c = { ...p };
                delete c.id;
                return c;
            });
            const resNoId = await db.from('database_gudang').insert(noIdArr);
            errGudang = resNoId.error;
        }

        if (errGudang) {
            console.error("Gagal simpan ke database_gudang:", errGudang);
            alert("⚠️ Peringatan: Gagal mencatat riwayat ke database_gudang: " + errGudang.message);
        }

        let w = stateGlobal['label'].kertas.w + "mm"; 
        let h = stateGlobal['label'].kertas.h + "mm";
        
        let htmlContent = `<html><head><title>Print Label</title><style>
            @page { size: ${w} ${h}; margin: 0; }
            body { margin: 0; padding: 20px; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; }
            .label-page { page-break-after: always; width: ${w}; height: ${h}; background: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; }
            img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; filter: grayscale(100%) contrast(1000%); }
            @media print { body { background: #fff; padding: 0; display: block; } .label-page { box-shadow: none; margin: 0; } }
        </style></head><body>`;
        
        sequenceImages.forEach(img => { htmlContent += `<div class="label-page"><img src="${img}"></div>`; });
        htmlContent += `</body></html>`;
        
        window.printHTMLData = htmlContent;

        document.getElementById('print-title').innerText = 'Render Selesai!';
        document.getElementById('print-subtitle').innerText = 'Label siap untuk dicetak.';
        document.getElementById('print-loading-area').classList.add('hidden');
        document.getElementById('print-done-area').classList.remove('hidden');

    } catch(e) {
        document.getElementById('modal-progress-print').classList.add('hidden');
        alert("Terjadi kesalahan saat memproses label: " + e.message);
    }
};

// ========================================================
// 6. ZOOM (+/-), DRAG & DROP CANVAS, SELECTION & CONTEXT
// ========================================================
window.ubahZoom = function(step) {
    let m = 'label';
    stateGlobal[m].zoom += step;
    if (stateGlobal[m].zoom < 0.5) stateGlobal[m].zoom = 0.5;
    if (stateGlobal[m].zoom > 6.0) stateGlobal[m].zoom = 6.0;
    
    document.getElementById('labels-wrapper').style.transform = `scale(${stateGlobal[m].zoom})`;
    document.getElementById('zoom-text').innerText = Math.round(stateGlobal[m].zoom * 100) + "%";
};

window.switchSideSettings = function() {
    const side = document.getElementById('side-select').value;
    const isBack = side === 'back';
    const m = 'label' + (isBack ? '_back' : '');
    const state = stateGlobal[m];

    const visContainer = document.getElementById('vis-checkboxes');
    const keys = ['nama', 'shading', 'ukuran', 'mesin', 'shift', 'tanggal', 'po', 'dus', 'isi'];
    if (!isBack) keys.unshift('qr', 'barcode');

    visContainer.innerHTML = keys.map(k => `
        <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" id="cb-vis-${k}" ${state.vis[k] ? 'checked' : ''} onchange="handleVisChange('${k}', this.checked)" class="w-4 h-4 accent-blue-600"> 
            ${k.toUpperCase()}
        </label>
    `).join('');

    const rowWrapBc = document.getElementById('row-wrap-barcode');
    if (rowWrapBc) rowWrapBc.style.display = isBack ? 'none' : 'flex';

    document.getElementById('cb-wrap-nama').checked = state.wrap.nama_cb;
    if (!isBack) document.getElementById('cb-wrap-barcode').checked = state.wrap.barcode_cb;
};

window.handleVisChange = function(key, isChecked) {
    const isBack = document.getElementById('side-select').value === 'back';
    const m = 'label' + (isBack ? '_back' : '');
    stateGlobal[m].vis[key] = isChecked;

    const idSfx = isBack ? '-back' : '';
    let elId = key === 'qr' ? 'qr-wrapper' : `el-${key}${idSfx}`;
    let el = document.getElementById(elId);
    
    if (el) {
        if (isChecked) el.classList.remove('hidden-element');
        else el.classList.add('hidden-element');
    }
};

window.handleWrapChange = function(key, isChecked, targetSide = null) {
    const sideSelect = document.getElementById('side-select')?.value || 'front';
    const side = targetSide || sideSelect;
    const isBack = side === 'back';
    const m = 'label' + (isBack ? '_back' : '');
    const idSfx = isBack ? '-back' : '';
    
    stateGlobal[m].wrap[`${key}_cb`] = isChecked;
    let val = stateGlobal[m].wrap[key];
    
    let el = document.getElementById(`el-${key}${idSfx}`);
    if (el) {
        if (isChecked) { 
            el.style.whiteSpace = 'normal'; 
            el.style.wordBreak = 'break-all'; 
            el.style.overflowWrap = 'break-word'; 
            el.style.maxWidth = val + (key === 'nama' ? 'mm' : 'px'); 
        } else { 
            el.style.whiteSpace = 'nowrap'; 
            el.style.maxWidth = 'none';
            el.style.wordBreak = 'normal';
            el.style.wordWrap = 'normal';
        }
    }
};

window.ubahTipeKertas = function() {
    const val = document.getElementById('kertas-select').value;
    const customForm = document.getElementById('custom-kertas-form');
    let w = 85, h = 50; 

    if (val === 'custom') {
        customForm.classList.remove('hidden'); customForm.classList.add('flex');
        w = parseFloat(document.getElementById('custom-w').value) || 85;
        h = parseFloat(document.getElementById('custom-h').value) || 50;
    } else {
        customForm.classList.add('hidden'); customForm.classList.remove('flex');
        w = 50.8; h = 27.9;
    }

    stateGlobal['label'].kertas = { tipe: val, w: w, h: h };
    document.getElementById('canvas').style.width = w + 'mm'; document.getElementById('canvas').style.height = h + 'mm';
    document.getElementById('canvas-back').style.width = w + 'mm'; document.getElementById('canvas-back').style.height = h + 'mm';
};

window.updateKertasCustom = function() { ubahTipeKertas(); };

window.resetDefaultVisibility = function() {
    const m = 'label';
    stateGlobal[m].vis = JSON.parse(JSON.stringify(baseVis));
    stateGlobal[m+'_back'].vis = JSON.parse(JSON.stringify(baseVisBack));
    
    Object.keys(baseVis).forEach(k => {
        let el = document.getElementById(k === 'qr' ? 'qr-wrapper' : `el-${k}`);
        if (el) { if (baseVis[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
    });
    Object.keys(baseVisBack).forEach(k => {
        let el = document.getElementById(`el-${k}-back`);
        if (el) { if (baseVisBack[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
    });
    switchSideSettings();
};

window.startDrag = function(elementKey, event, isBack = false) {
    event.preventDefault();
    event.stopPropagation(); 

    let m = 'label' + (isBack ? '_back' : '');
    let idSfx = isBack ? '-back' : '';
    let elId = elementKey === 'qr' ? 'qr-wrapper' : `el-${elementKey}${idSfx}`;
    let el = document.getElementById(elId);
    
    if (event.ctrlKey) {
        if (activeSelection.elements.includes(elementKey)) {
            activeSelection.elements = activeSelection.elements.filter(e => e !== elementKey);
            el.classList.remove('active-edit');
        } else {
            activeSelection.elements.push(elementKey);
            el.classList.add('active-edit');
        }
    } else {
        if (!activeSelection.elements.includes(elementKey)) {
            document.querySelectorAll('.click-edit').forEach(e => e.classList.remove('active-edit'));
            activeSelection.elements = [elementKey];
            el.classList.add('active-edit');
        }
    }
    
    activeSelection.m = m;
    activeSelection.isBack = isBack;

    const sideSel = document.getElementById('side-select');
    if (sideSel) sideSel.value = isBack ? 'back' : 'front';
    switchSideSettings();

    showContextPanel();
    simpanSnapshotHistory();

    isDragging = true; 
    dragStartX = event.clientX; 
    dragStartY = event.clientY; 
    dragInitialPos = {};
    activeSelection.elements.forEach(k => { 
        dragInitialPos[k] = { x: stateGlobal[m].pos[k].x, y: stateGlobal[m].pos[k].y }; 
    });
};

document.addEventListener('mousemove', function(e) {
    if (!isDragging || activeSelection.elements.length === 0) return;
    let m = activeSelection.m;
    let zoom = stateGlobal['label'].zoom;
    let dx = (e.clientX - dragStartX) / zoom;
    let dy = (e.clientY - dragStartY) / zoom;
    
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    
    activeSelection.elements.forEach(k => {
        if (stateGlobal[m].pos[k]) {
            stateGlobal[m].pos[k].x = dragInitialPos[k].x + dx;
            stateGlobal[m].pos[k].y = dragInitialPos[k].y + dy;
            updateTransform(k, activeSelection.isBack);
        }
    });
});

document.addEventListener('mouseup', () => isDragging = false);

document.addEventListener('mousedown', function(e) {
    if (e.target.closest('.click-edit') || e.target.closest('#context-panel') || e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
    document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
    activeSelection = { m: null, elements: [], isBack: false };
    document.getElementById('context-panel')?.classList.add('hidden');
});

function updateTransform(key, isBack) {
    let m = 'label' + (isBack ? '_back' : '');
    let idSfx = isBack ? '-back' : '';
    let elId = key === 'qr' ? 'qr-wrapper' : `el-${key}${idSfx}`;
    let el = document.getElementById(elId);
    if (!el) return;

    if (key === 'qr') {
        el.style.transform = `translate(${stateGlobal[m].pos.qr.x}px, ${stateGlobal[m].pos.qr.y}px) scale(${stateGlobal[m].pos.qr.s})`;
    } else {
        el.style.transform = `translate(${stateGlobal[m].pos[key].x}px, ${stateGlobal[m].pos[key].y}px)`;
    }
}

window.updateSliderFill = function(el) {
    if (!el) return;
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const val = parseFloat(el.value);
    const percentage = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    el.style.background = `linear-gradient(to right, #3b82f6 ${percentage}%, #334155 ${percentage}%)`;
};

function showContextPanel() {
    const panel = document.getElementById('context-panel');
    if (activeSelection.elements.length === 0) { panel.classList.add('hidden'); return; }
    
    let key = activeSelection.elements[activeSelection.elements.length - 1];
    let m = activeSelection.m;
    
    let html = '';
    
    const buildSlider = (type, min, max, val) => `
        <div class="flex flex-col items-center w-16 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
            <span class="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-wider">${type}</span>
            <input type="number" value="${val}" class="w-full bg-slate-950 text-blue-400 border border-slate-600 rounded text-center font-bold text-sm py-1 mb-2 outline-none focus:border-blue-500" onchange="syncContext('${type}', this.value)">
            <button onclick="stepContext('${type}', 1)" class="w-full bg-slate-700 hover:bg-blue-600 text-white rounded py-1 font-bold text-sm transition mb-3 cursor-pointer">+</button>
            <div class="slider-wrapper">
                <input type="range" orient="vertical" min="${min}" max="${max}" value="${val}" class="custom-vertical-slider" oninput="syncContext('${type}', this.value); updateSliderFill(this)">
            </div>
            <button onclick="stepContext('${type}', -1)" class="w-full bg-slate-700 hover:bg-rose-600 text-white rounded py-1 font-bold text-sm transition mt-3 cursor-pointer">-</button>
        </div>`;

    if (key === 'qr') html += buildSlider('skala', 50, 250, Math.round(stateGlobal[m].pos.qr.s * 100));
    else if (key === 'barcode') { html += buildSlider('font', 3, 80, stateGlobal[m].font.barcode); html += buildSlider('wrap', 10, 150, stateGlobal[m].wrap.barcode); }
    else if (['nama', 'shading'].includes(key)) { html += buildSlider('font', 8, 80, stateGlobal[m].font[key]); if (key === 'nama') html += buildSlider('wrap', 10, 85, stateGlobal[m].wrap.nama); }
    else { html += buildSlider('font', 3, 80, stateGlobal[m].font.info); html += buildSlider('gap', 0, 20, stateGlobal[m].gap.info); }

    panel.innerHTML = html;
    panel.classList.remove('hidden');
    panel.classList.add('flex');

    setTimeout(() => {
        document.querySelectorAll('.custom-vertical-slider').forEach(el => updateSliderFill(el));
    }, 10);
}

window.syncContext = function(type, val) {
    let m = activeSelection.m;
    let v = parseInt(val);
    let idSfx = activeSelection.isBack ? '-back' : '';

    activeSelection.elements.forEach(k => {
        if (type === 'skala' && k === 'qr') {
            stateGlobal[m].pos.qr.s = v / 100; updateTransform('qr', activeSelection.isBack);
        } else if (type === 'font') {
            if (k === 'barcode') { stateGlobal[m].font.barcode = v; document.getElementById(`el-barcode${idSfx}`).style.fontSize = v + 'px'; }
            else if (['nama', 'shading'].includes(k)) { stateGlobal[m].font[k] = v; document.getElementById(`el-${k}${idSfx}`).style.fontSize = v + 'px'; }
            else { stateGlobal[m].font.info = v; document.getElementById(`el-${k}${idSfx}`).style.fontSize = v + 'px'; }
        } else if (type === 'gap' && !['qr','barcode','nama','shading'].includes(k)) {
            stateGlobal[m].gap.info = v; document.getElementById(`el-info-group${idSfx}`).style.gap = v + 'px';
        } else if (type === 'wrap') {
            stateGlobal[m].wrap[k] = v;
            let elId = k === 'barcode' ? `el-barcode${idSfx}` : `el-nama${idSfx}`;
            let el = document.getElementById(elId);
            let isWrapOn = stateGlobal[m].wrap[`${k}_cb`];
            if (el) {
                if (isWrapOn) {
                    el.style.whiteSpace = 'normal'; 
                    el.style.wordBreak = 'break-all'; 
                    el.style.overflowWrap = 'break-word'; 
                    el.style.maxWidth = v + (k === 'nama' ? 'mm' : 'px'); 
                } else { 
                    el.style.whiteSpace = 'nowrap'; 
                    el.style.maxWidth = 'none';
                    el.style.wordBreak = 'normal';
                    el.style.wordWrap = 'normal';
                }
            }
        }
    });
    
    let inputs = document.querySelectorAll('#context-panel input[type="number"]');
    inputs.forEach(inp => { 
        if (inp.getAttribute('onchange').includes(type)) {
            inp.value = v; 
            let slider = inp.parentElement.querySelector('.custom-vertical-slider');
            if (slider) {
                slider.value = v;
                updateSliderFill(slider);
            }
        } 
    });
};

window.stepContext = function(type, step) {
    let inputs = document.querySelectorAll('#context-panel input[type="number"]');
    inputs.forEach(inp => {
        if (inp.getAttribute('onchange').includes(type)) {
            let nVal = parseInt(inp.value) + (step * (type === 'skala' ? 5 : 1));
            inp.value = nVal; 
            syncContext(type, nVal);
        }
    });
};

function simpanSnapshotHistory() {
    let m = 'label';
    let snap = {
        front: { pos: JSON.parse(JSON.stringify(stateGlobal[m].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m].gap)) },
        back: { pos: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].gap)) }
    };
    historyStack[m].undo.push(snap);
    historyStack[m].redo = [];
}

window.eksekusiUndo = function() {
    let m = 'label';
    if (historyStack[m].undo.length === 0) return;
    
    let currentSnap = {
        front: { pos: JSON.parse(JSON.stringify(stateGlobal[m].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m].gap)) },
        back: { pos: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].gap)) }
    };
    historyStack[m].redo.push(currentSnap);
    
    let prev = historyStack[m].undo.pop();
    stateGlobal[m].pos = prev.front.pos; stateGlobal[m].gap = prev.front.gap;
    stateGlobal[m+'_back'].pos = prev.back.pos; stateGlobal[m+'_back'].gap = prev.back.gap;
    
    Object.keys(stateGlobal[m].pos).forEach(k => updateTransform(k, false));
    Object.keys(stateGlobal[m+'_back'].pos).forEach(k => updateTransform(k, true));
};

window.eksekusiRedo = function() {
    let m = 'label';
    if (historyStack[m].redo.length === 0) return;
    
    let currentSnap = {
        front: { pos: JSON.parse(JSON.stringify(stateGlobal[m].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m].gap)) },
        back: { pos: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].gap)) }
    };
    historyStack[m].undo.push(currentSnap);
    
    let next = historyStack[m].redo.pop();
    stateGlobal[m].pos = next.front.pos; stateGlobal[m].gap = next.front.gap;
    stateGlobal[m+'_back'].pos = next.back.pos; stateGlobal[m+'_back'].gap = next.back.gap;
    
    Object.keys(stateGlobal[m].pos).forEach(k => updateTransform(k, false));
    Object.keys(stateGlobal[m+'_back'].pos).forEach(k => updateTransform(k, true));
};

window.saveSetDefault = function() {
    let m = 'label';
    let config = {
        front: { pos: stateGlobal[m].pos, font: stateGlobal[m].font, gap: stateGlobal[m].gap, zoom: stateGlobal[m].zoom, vis: stateGlobal[m].vis, kertas: stateGlobal[m].kertas, wrap: stateGlobal[m].wrap },
        back: { pos: stateGlobal[m+'_back'].pos, font: stateGlobal[m+'_back'].font, gap: stateGlobal[m+'_back'].gap, vis: stateGlobal[m+'_back'].vis, wrap: stateGlobal[m+'_back'].wrap }
    };
    localStorage.setItem('defaultLabel_' + m, JSON.stringify(config));
    alert("✅ Pengaturan berhasil disimpan sebagai Default Baru!");
};

function applyCurrentStateToDOM(m) {
    Object.keys(stateGlobal[m].pos).forEach(k => updateTransform(k, false));
    Object.keys(stateGlobal[m+'_back'].pos).forEach(k => updateTransform(k, true));
    
    ['barcode', 'nama', 'shading'].forEach(k => {
        let el = document.getElementById(k === 'barcode' ? 'el-barcode' : `el-${k}`); if (el) el.style.fontSize = stateGlobal[m].font[k] + 'px';
        let elB = document.getElementById(k === 'barcode' ? 'el-barcode-back' : `el-${k}-back`); if (elB) elB.style.fontSize = stateGlobal[m+'_back'].font[k] + 'px';
    });
    document.getElementById('el-info-group').style.fontSize = stateGlobal[m].font.info + 'px'; document.getElementById('el-info-group').style.gap = stateGlobal[m].gap.info + 'px';
    document.getElementById('el-info-group-back').style.fontSize = stateGlobal[m+'_back'].font.info + 'px'; document.getElementById('el-info-group-back').style.gap = stateGlobal[m+'_back'].gap.info + 'px';
    
    handleWrapChange('nama', stateGlobal[m].wrap.nama_cb, 'front');
    handleWrapChange('barcode', stateGlobal[m].wrap.barcode_cb, 'front');
    handleWrapChange('nama', stateGlobal[m+'_back'].wrap.nama_cb, 'back');
}

function loadSetDefault(m) {
    let saved = localStorage.getItem('defaultLabel_' + m);
    if (saved) {
        try {
            let p = JSON.parse(saved);
            stateGlobal[m].pos = p.front.pos; stateGlobal[m].font = p.front.font; stateGlobal[m].gap = p.front.gap; stateGlobal[m].vis = p.front.vis; stateGlobal[m].kertas = p.front.kertas; stateGlobal[m].wrap = p.front.wrap;
            
            if (p.back) {
                stateGlobal[m+'_back'].pos = p.back.pos; stateGlobal[m+'_back'].font = p.back.font; stateGlobal[m+'_back'].gap = p.back.gap; stateGlobal[m+'_back'].vis = p.back.vis; stateGlobal[m+'_back'].wrap = p.back.wrap;
            }
            
            if (p.front.zoom) { 
                stateGlobal[m].zoom = p.front.zoom; 
                document.getElementById('labels-wrapper').style.transform = `scale(${p.front.zoom})`; 
                document.getElementById('zoom-text').innerText = Math.round(p.front.zoom * 100) + "%"; 
            }
            
            applyCurrentStateToDOM(m);
            
            const kertasSelect = document.getElementById('kertas-select');
            if (kertasSelect) kertasSelect.value = p.front.kertas.tipe;
            ubahTipeKertas();
            if (p.front.kertas.tipe === 'custom') {
                document.getElementById('custom-w').value = p.front.kertas.w;
                document.getElementById('custom-h').value = p.front.kertas.h;
                updateKertasCustom();
            }

            Object.keys(stateGlobal[m].vis).forEach(k => {
                let el = document.getElementById(k === 'qr' ? 'qr-wrapper' : `el-${k}`);
                if (el) { if (stateGlobal[m].vis[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
            });
            if (p.back && p.back.vis) {
                Object.keys(stateGlobal[m+'_back'].vis).forEach(k => {
                    let el = document.getElementById(`el-${k}-back`);
                    if (el) { if (stateGlobal[m+'_back'].vis[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
                });
            }
            switchSideSettings();
        } catch(e) { console.error("Gagal load default:", e); }
    } else {
        const kertasSelect = document.getElementById('kertas-select');
        if (kertasSelect) kertasSelect.value = 'custom';
        ubahTipeKertas();
    }
}

function initKeyboardGlobal() { 
    document.removeEventListener('keydown', penangananKeyboardEvent); 
    document.addEventListener('keydown', penangananKeyboardEvent); 
}

function penangananKeyboardEvent(e) { 
    let m = 'label'; 
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); eksekusiUndo(); return; } 
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); eksekusiRedo(); return; } 
    if (activeSelection.elements.length === 0) return; 
    if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName.toUpperCase())) return; 
    
    let x = 0, y = 0, s = (e.shiftKey) ? 5 : 1; 
    switch(e.key) { 
        case 'ArrowUp': y = -s; break; 
        case 'ArrowDown': y = s; break; 
        case 'ArrowLeft': x = -s; break; 
        case 'ArrowRight': x = s; break; 
        default: return; 
    } 
    
    e.preventDefault(); 
    simpanSnapshotHistory(); 
    activeSelection.elements.forEach(k => { 
        if (stateGlobal[m].pos[k]) { 
            stateGlobal[m].pos[k].x += x; 
            stateGlobal[m].pos[k].y += y; 
            updateTransform(k, activeSelection.isBack); 
        } 
    }); 
}
