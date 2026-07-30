// ============================================================================
// WMS SUNPEVECE - CETAK LABEL ENGINE (REFACTORED & SUPABASE INTEGRATED)
// ============================================================================

let currentMode = 'plafon'; // plafon (Plafon & Lis), khusus
let masterData = { mesin: [], shift: [], item: [], grade: [], dus: [], customer: [] };

// State Global untuk Canvas (Posisi, Font, Visibilitas)
const createBasePos = () => ({ x: 0, y: 0 });
const baseVis = { qr: true, barcode: true, nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };
const baseVisBack = { nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };

let stateGlobal = {};
const modes = ['plafon', 'khusus'];
modes.forEach(m => {
    stateGlobal[m] = { zoom: 4.0, pos: { qr: { x: 0, y: 0, s: 1 }, barcode: createBasePos(), nama: createBasePos(), shading: createBasePos(), ukuran: createBasePos(), mesin: createBasePos(), shift: createBasePos(), tanggal: createBasePos(), po: createBasePos(), dus: createBasePos(), isi: createBasePos() }, font: { barcode: 5, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: 'custom', w: 85, h: 50 }, wrap: { nama: 33, barcode: 45, nama_cb: true, barcode_cb: true }, barcodeData: "", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) };
    // REVISI 2: Wrap text dipisah untuk back
    stateGlobal[m + '_back'] = { pos: { nama: createBasePos(), shading: createBasePos(), ukuran: createBasePos(), mesin: createBasePos(), shift: createBasePos(), tanggal: createBasePos(), po: createBasePos(), dus: createBasePos(), isi: createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 45, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) };
});

let historyStack = {};
modes.forEach(m => historyStack[m] = { undo: [], redo: [] });

let activeSelection = { m: null, elements: [] };
let isDragging = false, dragStartX = 0, dragStartY = 0, dragInitialPos = {};
let pendingAction = null;

// State Modal Search
let currentSearchType = ''; 
let selectedSearchData = { nama: '', kode: '' };

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', password: ''};

// ==========================================
// 1. INISIALISASI & SUPABASE FETCH
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await initModernLayout({ id: 'cetak_label', title: 'CETAK LABEL BARCODE', url: 'cetak_label.html' });
    initKeyboardGlobal();
    await loadMasterData();
    switchMode('plafon'); 
});

async function loadMasterData() {
    try {
        const { data, error } = await db.from('master_2').select('*');
        if (error) throw error;

        const getUnique = (keyName, keyCode) => {
            let map = new Map();
            data.forEach(r => {
                if (r[keyName] && r[keyName].trim() !== '') {
                    map.set(r[keyName].trim().toUpperCase(), { nama: r[keyName].trim(), kode: r[keyCode] || '' });
                }
            });
            return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama));
        };

        masterData.mesin = getUnique('mesin', 'kode_mesin');
        masterData.shift = getUnique('shift', 'kode_shift');
        masterData.item = getUnique('nama_item', 'kode_nama_item');
        masterData.grade = getUnique('grade', 'kode_grade');
        masterData.dus = getUnique('dus', 'kode_dus');
        masterData.customer = getUnique('customer', 'kode_customer');

    } catch (e) {
        console.error("Gagal memuat master data:", e);
        alert("Gagal terhubung ke database master!");
    }
}

// ==========================================
// 2. UI RENDERER (DRY PRINCIPLE)
// ==========================================
function switchMode(mode) {
    if (mode === 'khusus' && currentMode !== mode) {
        mintaPin("Akses Print Khusus", () => executeSwitchMode(mode));
    } else {
        executeSwitchMode(mode);
    }
}

function executeSwitchMode(mode) {
    currentMode = mode;
    modes.forEach(m => {
        const tab = document.getElementById('tab-' + m);
        if (tab) tab.className = (m === mode) ? 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase' : 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    });

    renderForm();
    renderSettings();
    renderCanvas();
    loadSetDefault(mode);
    toggleLeftPanel('form');
    document.getElementById('btn-cetak-label').classList.add('hidden');
}

function toggleLeftPanel(target) {
    const pForm = document.getElementById('panel-form');
    const pSet = document.getElementById('panel-setting');
    const bForm = document.getElementById('btn-view-form');
    const bSet = document.getElementById('btn-view-setting');

    if (target === 'form') {
        pForm.classList.remove('hidden'); pSet.classList.add('hidden');
        bForm.className = 'flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-sm transition';
        bSet.className = 'flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded transition';
    } else {
        pForm.classList.add('hidden'); pSet.classList.remove('hidden');
        bSet.className = 'flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded shadow-sm transition';
        bForm.className = 'flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded transition';
        switchSideSettings(); 
    }
}

function renderForm() {
    const container = document.getElementById('panel-form');
    const today = new Date().toISOString().split('T')[0];
    
    const buildSelect = (id, label, options, isKode = true) => `
        <div>
            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">${label}</label>
            <select id="${id}" class="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 font-bold bg-slate-50 cursor-pointer">
                <option value="">-- Pilih --</option>
                ${options.map(o => `<option value="${o.nama}" data-kode="${isKode ? o.kode : ''}">${o.nama}</option>`).join('')}
            </select>
        </div>`;

    // REVISI 4: Tombol CARI menyatu di dalam kotak input
    const buildSearchInput = (id, label, type) => `
        <div>
            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">${label}</label>
            <div class="flex border border-slate-300 rounded overflow-hidden shadow-sm">
                <input type="text" id="${id}" readonly class="flex-1 p-2 text-sm outline-none font-bold bg-slate-50 text-slate-600 cursor-not-allowed" placeholder="Pilih ${label}...">
                <button onclick="bukaModalSearch('${type}')" class="px-4 bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition">CARI</button>
            </div>
        </div>`;

    if (currentMode === 'khusus') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Jenis Item</label>
                <select id="k-jenis" class="w-full p-2 text-sm border border-slate-300 rounded outline-none font-bold bg-slate-50"><option value="p">Plafon</option><option value="l">Lis</option></select>
            </div>
            <div>
                <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">String QR Code</label>
                <textarea id="k-qr-string" rows="4" class="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 font-mono font-bold bg-slate-50" placeholder="Contoh: P103/WT-1/61D4/16662C2S1P3/0001"></textarea>
            </div>
            <div>
                <label class="block text-[10px] font-black uppercase text-blue-600 mb-1">Jumlah Print (Qty)</label>
                <input type="number" id="k-qty" value="1" min="1" class="w-full p-3 text-lg border-2 border-blue-200 rounded outline-none focus:border-blue-600 font-black text-center bg-blue-50 text-blue-800">
            </div>
        `;
        return;
    }

    let m = currentMode;
    container.innerHTML = `
        <div><label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Tgl Produksi</label><input type="date" id="${m}-tgl" value="${today}" class="w-full p-2 text-sm border border-slate-300 rounded outline-none font-bold bg-slate-50"></div>
        ${buildSearchInput(`${m}-mesin`, 'Mesin', 'mesin')}
        ${buildSelect(`${m}-shift`, 'Shift', masterData.shift)}
        ${buildSearchInput(`${m}-item`, 'Nama Item', 'item')}
        
        <div>
            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Jenis Item</label>
            <select id="${m}-jenis" class="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 font-bold bg-slate-50 cursor-pointer">
                <option value="Plafon">Plafon</option>
                <option value="Lis">Lis</option>
            </select>
        </div>

        <div><label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Panjang (M)</label><input type="text" id="${m}-panjang" class="w-full p-2 text-sm border border-slate-300 rounded outline-none font-bold bg-slate-50 uppercase" placeholder="Cth: 4 atau 5.95"></div>
        ${buildSelect(`${m}-grade`, 'Grade', masterData.grade)}
        ${buildSelect(`${m}-dus`, 'Dus / Merk', masterData.dus)}
        
        <div>
            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Shading</label>
            <div class="flex items-center gap-2">
                <input type="text" id="${m}-shading-1" class="w-full p-2 text-sm border border-slate-300 rounded text-center font-bold uppercase" placeholder="Huruf" oninput="updateShading()">
                <span class="font-black">-</span>
                <input type="text" id="${m}-shading-2" class="w-full p-2 text-sm border border-slate-300 rounded text-center font-bold uppercase" placeholder="Angka" oninput="this.value=this.value.replace(/^0+(.)/, '$1'); updateShading()">
                <span class="font-black">-</span>
                <input type="text" id="${m}-shading-3" class="w-full p-2 text-sm border border-slate-300 rounded text-center font-bold uppercase" placeholder="Ext" oninput="updateShading()">
            </div>
            <input type="hidden" id="${m}-shading">
        </div>
        
        ${buildSearchInput(`${m}-po`, 'Customer (PO)', 'customer')}
        
        <label class="flex items-center gap-2 cursor-pointer mt-2 p-2 bg-slate-50 border border-slate-200 rounded">
            <input type="checkbox" id="${m}-cb-revisi" class="w-4 h-4 accent-blue-600">
            <span class="text-xs font-bold text-slate-700">Revisian Shift Lain</span>
        </label>

        <div>
            <label class="block text-[10px] font-black uppercase text-blue-600 mb-1">Jumlah Box (Qty)</label>
            <input type="number" id="${m}-qty" value="1" min="1" class="w-full p-3 text-lg border-2 border-blue-200 rounded outline-none focus:border-blue-600 font-black text-center bg-blue-50 text-blue-800">
        </div>
    `;
    lucide.createIcons();
}

function updateShading() {
    let m = currentMode;
    let v1 = document.getElementById(`${m}-shading-1`)?.value.trim().toUpperCase() || '';
    let v2 = document.getElementById(`${m}-shading-2`)?.value.trim().toUpperCase() || '';
    let v3 = document.getElementById(`${m}-shading-3`)?.value.trim().toUpperCase() || '';
    
    let arr = [];
    if(v1) arr.push(v1); if(v2) arr.push(v2); if(v3) arr.push(v3);
    
    let hidden = document.getElementById(`${m}-shading`);
    if(hidden) hidden.value = arr.join('-');
}

function renderSettings() {
    const container = document.getElementById('panel-setting');
    
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
                <button onclick="resetDefaultVisibility()" class="text-[10px] font-bold text-blue-600 hover:underline">Reset Default</button>
            </div>
            <div class="grid grid-cols-2 gap-2" id="vis-checkboxes">
                <!-- Checkboxes injected here -->
            </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg">
            <h4 class="text-xs font-black text-slate-700 mb-2">Wrap Text (Bungkus)</h4>
            <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer" id="row-wrap-barcode"><input type="checkbox" id="cb-wrap-barcode" onchange="handleWrapChange('barcode', this.checked)" class="w-4 h-4 accent-blue-600"> Kode Barcode</label>
                <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer"><input type="checkbox" id="cb-wrap-nama" onchange="handleWrapChange('nama', this.checked)" class="w-4 h-4 accent-blue-600"> Nama Item</label>
            </div>
        </div>
    `;
    switchSideSettings();
}

function renderCanvas() {
    const wrapper = document.getElementById('labels-wrapper');
    const buildCanvas = (side) => {
        const isBack = side === 'back';
        const idSfx = isBack ? '-back' : '';
        
        let w = stateGlobal[currentMode].kertas.w + 'mm';
        let h = stateGlobal[currentMode].kertas.h + 'mm';

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
                        <div id="el-nama${idSfx}" class="click-edit font-black leading-none text-center text-black" style="font-size: 16px; max-width: ${isBack ? '45mm' : '33mm'};" onmousedown="startDrag('nama', event, ${isBack})">NAMA ITEM</div>
                        <div id="el-shading${idSfx}" class="click-edit font-bold text-center whitespace-nowrap text-black" style="font-size: 14px;" onmousedown="startDrag('shading', event, ${isBack})">SHADING</div>
                    </div>
                    <div id="el-info-group${idSfx}" class="flex-[1] flex justify-center items-end font-bold gap-[5px] text-black" style="font-size: 6px;">
                        <div id="el-ukuran${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('ukuran', event, ${isBack})">Uk 20 x 400</div>
                        <div id="el-mesin${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('mesin', event, ${isBack})">M1</div>
                        <div id="el-shift${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('shift', event, ${isBack})">S1</div>
                        <div id="el-tanggal${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('tanggal', event, ${isBack})">01/01/2024</div>
                        <div id="el-po${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('po', event, ${isBack})">CUST</div>
                        <div id="el-dus${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('dus', event, ${isBack})">MERK</div>
                        <div id="el-isi${idSfx}" class="click-edit whitespace-nowrap" onmousedown="startDrag('isi', event, ${isBack})">Qty: 15</div>
                    </div>
                </div>
            </div>
        </div>`;
    };

    wrapper.innerHTML = buildCanvas('front') + buildCanvas('back');
    
    let qrEl = document.getElementById('qrcode');
    if(qrEl) {
        qrEl.innerHTML = "";
        new QRCode(qrEl, { text: "DUMMY/QR/CODE", width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L });
        setTimeout(() => { let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); }, 50);
    }
}

// ==========================================
// 3. LOGIKA SETTINGS & CANVAS ENGINE
// ==========================================
function switchSideSettings() {
    const side = document.getElementById('side-select').value;
    const isBack = side === 'back';
    const m = currentMode + (isBack ? '_back' : '');
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
    if(rowWrapBc) rowWrapBc.style.display = isBack ? 'none' : 'flex';

    document.getElementById('cb-wrap-nama').checked = state.wrap.nama_cb;
    if(!isBack) document.getElementById('cb-wrap-barcode').checked = state.wrap.barcode_cb;
}

function handleVisChange(key, isChecked) {
    const isBack = document.getElementById('side-select').value === 'back';
    const m = currentMode + (isBack ? '_back' : '');
    stateGlobal[m].vis[key] = isChecked;

    const idSfx = isBack ? '-back' : '';
    let elId = key === 'qr' ? 'qr-wrapper' : `el-${key}${idSfx}`;
    let el = document.getElementById(elId);
    
    if(el) {
        if(isChecked) el.classList.remove('hidden-element');
        else el.classList.add('hidden-element');
    }
}

function handleWrapChange(key, isChecked) {
    const isBack = document.getElementById('side-select').value === 'back';
    const m = currentMode + (isBack ? '_back' : '');
    const idSfx = isBack ? '-back' : '';
    
    stateGlobal[m].wrap[`${key}_cb`] = isChecked;
    let val = stateGlobal[m].wrap[key];
    
    let el = document.getElementById(`el-${key}${idSfx}`);
    if(el) {
        if(isChecked) { 
            el.style.whiteSpace = 'normal'; el.style.wordWrap = 'break-word'; 
            el.style.maxWidth = val + (key==='nama'?'mm':'px'); 
        } else { 
            el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none'; 
        }
    }
}

function ubahTipeKertas() {
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

    stateGlobal[currentMode].kertas = { tipe: val, w: w, h: h };
    document.getElementById('canvas').style.width = w + 'mm'; document.getElementById('canvas').style.height = h + 'mm';
    document.getElementById('canvas-back').style.width = w + 'mm'; document.getElementById('canvas-back').style.height = h + 'mm';
}

function updateKertasCustom() { ubahTipeKertas(); }

function resetDefaultVisibility() {
    const m = currentMode;
    stateGlobal[m].vis = JSON.parse(JSON.stringify(baseVis));
    stateGlobal[m+'_back'].vis = JSON.parse(JSON.stringify(baseVisBack));
    
    Object.keys(baseVis).forEach(k => {
        let el = document.getElementById(k === 'qr' ? 'qr-wrapper' : `el-${k}`);
        if(el) { if(baseVis[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
    });
    Object.keys(baseVisBack).forEach(k => {
        let el = document.getElementById(`el-${k}-back`);
        if(el) { if(baseVisBack[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
    });
    switchSideSettings();
}

function ubahZoom(step) {
    let m = currentMode;
    stateGlobal[m].zoom += step;
    if(stateGlobal[m].zoom < 0.5) stateGlobal[m].zoom = 0.5;
    if(stateGlobal[m].zoom > 6.0) stateGlobal[m].zoom = 6.0;
    
    document.getElementById('labels-wrapper').style.transform = `scale(${stateGlobal[m].zoom})`;
    document.getElementById('zoom-text').innerText = Math.round(stateGlobal[m].zoom * 100) + "%";
}

// ==========================================
// 4. DRAG & DROP ENGINE
// ==========================================
window.startDrag = function(elementKey, event, isBack = false) {
    event.preventDefault();
    let m = currentMode + (isBack ? '_back' : '');
    let idSfx = isBack ? '-back' : '';
    let elId = elementKey === 'qr' ? 'qr-wrapper' : `el-${elementKey}${idSfx}`;
    let el = document.getElementById(elId);
    
    if(!event.ctrlKey) {
        document.querySelectorAll('.click-edit').forEach(e => e.classList.remove('active-edit'));
        activeSelection.elements = [elementKey];
    } else {
        if(activeSelection.elements.includes(elementKey)) {
            activeSelection.elements = activeSelection.elements.filter(e => e !== elementKey);
            el.classList.remove('active-edit');
        } else {
            activeSelection.elements.push(elementKey);
        }
    }
    
    activeSelection.m = m;
    activeSelection.isBack = isBack;
    if(activeSelection.elements.includes(elementKey)) el.classList.add('active-edit');

    document.getElementById('side-select').value = isBack ? 'back' : 'front';
    switchSideSettings();

    showContextPanel();
    simpanSnapshotHistory();

    isDragging = true; dragStartX = event.clientX; dragStartY = event.clientY; dragInitialPos = {};
    activeSelection.elements.forEach(k => { dragInitialPos[k] = { x: stateGlobal[m].pos[k].x, y: stateGlobal[m].pos[k].y }; });
    event.stopPropagation();
};

document.addEventListener('mousemove', function(e) {
    if(!isDragging || activeSelection.elements.length === 0) return;
    let m = activeSelection.m;
    let zoom = stateGlobal[currentMode].zoom;
    let dx = (e.clientX - dragStartX) / zoom;
    let dy = (e.clientY - dragStartY) / zoom;
    
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    
    activeSelection.elements.forEach(k => {
        if(stateGlobal[m].pos[k]) {
            stateGlobal[m].pos[k].x = dragInitialPos[k].x + dx;
            stateGlobal[m].pos[k].y = dragInitialPos[k].y + dy;
            updateTransform(k, activeSelection.isBack);
        }
    });
});

document.addEventListener('mouseup', () => isDragging = false);

document.addEventListener('mousedown', function(e) {
    if(e.target.closest('.click-edit') || e.target.closest('#context-panel') || e.target.closest('.zoom-controls') || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
    activeSelection = { m: null, elements: [], isBack: false };
    document.getElementById('context-panel').classList.add('hidden');
});

function updateTransform(key, isBack) {
    let m = currentMode + (isBack ? '_back' : '');
    let idSfx = isBack ? '-back' : '';
    let elId = key === 'qr' ? 'qr-wrapper' : `el-${key}${idSfx}`;
    let el = document.getElementById(elId);
    if(!el) return;

    if(key === 'qr') {
        el.style.transform = `translate(${stateGlobal[m].pos.qr.x}px, ${stateGlobal[m].pos.qr.y}px) scale(${stateGlobal[m].pos.qr.s})`;
    } else {
        el.style.transform = `translate(${stateGlobal[m].pos[key].x}px, ${stateGlobal[m].pos[key].y}px)`;
    }
}

// ==========================================
// 5. CONTEXT MENU (FONT, GAP, WRAP, SCALE)
// ==========================================
function showContextPanel() {
    const panel = document.getElementById('context-panel');
    if(activeSelection.elements.length === 0) { panel.classList.add('hidden'); return; }
    
    let key = activeSelection.elements[activeSelection.elements.length - 1];
    let m = activeSelection.m;
    
    let html = '';
    // REVISI 5: Desain Slider Vertical yang lebih rapi
    const buildSlider = (type, min, max, val) => `
        <div class="flex flex-col items-center w-16 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
            <span class="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-wider">${type}</span>
            <input type="number" value="${val}" class="w-full bg-slate-950 text-blue-400 border border-slate-600 rounded text-center font-bold text-sm py-1 mb-3 outline-none focus:border-blue-500" onchange="syncContext('${type}', this.value)">
            <button onclick="stepContext('${type}', 1)" class="w-full bg-slate-700 hover:bg-blue-600 text-white rounded py-1.5 font-bold text-sm mb-2 transition">+</button>
            <input type="range" orient="vertical" min="${min}" max="${max}" value="${val}" class="h-28 w-full cursor-pointer my-2" oninput="syncContext('${type}', this.value)">
            <button onclick="stepContext('${type}', -1)" class="w-full bg-slate-700 hover:bg-rose-600 text-white rounded py-1.5 font-bold text-sm mt-2 transition">-</button>
        </div>`;

    if (key === 'qr') html += buildSlider('skala', 50, 250, Math.round(stateGlobal[m].pos.qr.s * 100));
    else if (key === 'barcode') { html += buildSlider('font', 3, 80, stateGlobal[m].font.barcode); html += buildSlider('wrap', 10, 150, stateGlobal[m].wrap.barcode); }
    else if (['nama', 'shading'].includes(key)) { html += buildSlider('font', 8, 80, stateGlobal[m].font[key]); if(key==='nama') html += buildSlider('wrap', 10, 150, stateGlobal[m].wrap.nama); }
    else { html += buildSlider('font', 3, 80, stateGlobal[m].font.info); html += buildSlider('gap', 0, 20, stateGlobal[m].gap.info); }

    panel.innerHTML = html;
    panel.classList.remove('hidden');
    panel.classList.add('flex');
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
            if(el && el.style.whiteSpace === 'normal') el.style.maxWidth = v + (k==='nama'?'mm':'px');
        }
    });
    
    let inputs = document.querySelectorAll('#context-panel input[type="number"]');
    inputs.forEach(inp => { if(inp.getAttribute('onchange').includes(type)) inp.value = v; });
};

window.stepContext = function(type, step) {
    let inputs = document.querySelectorAll('#context-panel input[type="number"]');
    inputs.forEach(inp => {
        if(inp.getAttribute('onchange').includes(type)) {
            let nVal = parseInt(inp.value) + (step * (type==='skala'?5:1));
            inp.value = nVal; syncContext(type, nVal);
        }
    });
};

// ==========================================
// 6. UNDO, REDO, SAVE DEFAULT
// ==========================================
function simpanSnapshotHistory() {
    let m = currentMode;
    let snap = {
        front: { pos: JSON.parse(JSON.stringify(stateGlobal[m].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m].gap)) },
        back: { pos: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].pos)), gap: JSON.parse(JSON.stringify(stateGlobal[m+'_back'].gap)) }
    };
    historyStack[m].undo.push(snap);
    historyStack[m].redo = [];
}

window.eksekusiUndo = function() {
    let m = currentMode;
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
    let m = currentMode;
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
    let m = currentMode;
    let config = {
        front: { pos: stateGlobal[m].pos, font: stateGlobal[m].font, gap: stateGlobal[m].gap, zoom: stateGlobal[m].zoom, vis: stateGlobal[m].vis, kertas: stateGlobal[m].kertas, wrap: stateGlobal[m].wrap },
        back: { pos: stateGlobal[m+'_back'].pos, font: stateGlobal[m+'_back'].font, gap: stateGlobal[m+'_back'].gap, vis: stateGlobal[m+'_back'].vis, wrap: stateGlobal[m+'_back'].wrap }
    };
    localStorage.setItem('defaultLabel_' + m, JSON.stringify(config));
    alert("✅ Pengaturan berhasil disimpan sebagai Default Baru!");
};

// REVISI 1: Load Default Back Diperbaiki
function loadSetDefault(m) {
    let saved = localStorage.getItem('defaultLabel_' + m);
    if(saved) {
        try {
            let p = JSON.parse(saved);
            stateGlobal[m].pos = p.front.pos; stateGlobal[m].font = p.front.font; stateGlobal[m].gap = p.front.gap; stateGlobal[m].vis = p.front.vis; stateGlobal[m].kertas = p.front.kertas; stateGlobal[m].wrap = p.front.wrap;
            
            // Terapkan ke stateGlobal Back
            if(p.back) {
                stateGlobal[m+'_back'].pos = p.back.pos; stateGlobal[m+'_back'].font = p.back.font; stateGlobal[m+'_back'].gap = p.back.gap; stateGlobal[m+'_back'].vis = p.back.vis; stateGlobal[m+'_back'].wrap = p.back.wrap;
            }
            
            if(p.front.zoom) { stateGlobal[m].zoom = p.front.zoom; document.getElementById('labels-wrapper').style.transform = `scale(${p.front.zoom})`; document.getElementById('zoom-text').innerText = Math.round(p.front.zoom * 100) + "%"; }
            
            Object.keys(stateGlobal[m].pos).forEach(k => updateTransform(k, false));
            Object.keys(stateGlobal[m+'_back'].pos).forEach(k => updateTransform(k, true));
            
            ['barcode', 'nama', 'shading'].forEach(k => {
                let el = document.getElementById(k==='barcode'?'el-barcode':`el-${k}`); if(el) el.style.fontSize = stateGlobal[m].font[k] + 'px';
                let elB = document.getElementById(k==='barcode'?'el-barcode-back':`el-${k}-back`); if(elB) elB.style.fontSize = stateGlobal[m+'_back'].font[k] + 'px';
            });
            document.getElementById('el-info-group').style.fontSize = stateGlobal[m].font.info + 'px'; document.getElementById('el-info-group').style.gap = stateGlobal[m].gap.info + 'px';
            document.getElementById('el-info-group-back').style.fontSize = stateGlobal[m+'_back'].font.info + 'px'; document.getElementById('el-info-group-back').style.gap = stateGlobal[m+'_back'].gap.info + 'px';
            
            document.getElementById('kertas-select').value = p.front.kertas.tipe;
            ubahTipeKertas();
            if(p.front.kertas.tipe === 'custom') {
                document.getElementById('custom-w').value = p.front.kertas.w;
                document.getElementById('custom-h').value = p.front.kertas.h;
                updateKertasCustom();
            }

            // Terapkan Wrap Text
            handleWrapChange('nama', p.front.wrap.nama_cb);
            handleWrapChange('barcode', p.front.wrap.barcode_cb);
            
            // REVISI 1: Terapkan Wrap Text untuk Back
            if(p.back && p.back.wrap) {
                let elNamaBack = document.getElementById('el-nama-back');
                if(elNamaBack) {
                    if(p.back.wrap.nama_cb) {
                        elNamaBack.style.whiteSpace = 'normal'; elNamaBack.style.wordWrap = 'break-word'; elNamaBack.style.maxWidth = p.back.wrap.nama + 'mm';
                    } else {
                        elNamaBack.style.whiteSpace = 'nowrap'; elNamaBack.style.maxWidth = 'none';
                    }
                }
            }

            // Terapkan Visibilitas (Front & Back)
            Object.keys(stateGlobal[m].vis).forEach(k => {
                let el = document.getElementById(k === 'qr' ? 'qr-wrapper' : `el-${k}`);
                if(el) { if(stateGlobal[m].vis[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
            });
            if(p.back && p.back.vis) {
                Object.keys(stateGlobal[m+'_back'].vis).forEach(k => {
                    let el = document.getElementById(`el-${k}-back`);
                    if(el) { if(stateGlobal[m+'_back'].vis[k]) el.classList.remove('hidden-element'); else el.classList.add('hidden-element'); }
                });
            }
            
            switchSideSettings();
        } catch(e) { console.error("Gagal load default:", e); }
    } else {
        document.getElementById('kertas-select').value = 'custom';
        ubahTipeKertas();
    }
}

// ==========================================
// 7. MODAL SEARCH (PILIH ITEM/MESIN/CUST)
// ==========================================
window.bukaModalSearch = function(type) {
    currentSearchType = type;
    const titleMap = { 'item': 'Nama Item', 'mesin': 'Mesin', 'customer': 'Customer' };
    document.getElementById('title-modal-search').innerText = `Cari ${titleMap[type]}`;
    document.getElementById('title-tambah-master').innerText = titleMap[type];
    
    document.getElementById('input-search-list').value = '';
    renderSearchList();

    document.getElementById('modal-search').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-search-list').focus(), 100);
};

window.tutupModalSearch = function() {
    document.getElementById('modal-search').classList.add('hidden');
    if(document.getElementById('modal-tambah-master').classList.contains('hidden')) {
        document.getElementById('overlay-klik-luar').classList.add('hidden');
    }
};

function renderSearchList() {
    const ul = document.getElementById('list-search-result');
    const dataArr = masterData[currentSearchType] || [];
    
    if(dataArr.length === 0) {
        ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold">Data kosong.</li>';
        return;
    }

    ul.innerHTML = dataArr.map(d => `
        <li onclick="selectSearchItem('${d.nama}', '${d.kode}')" class="search-item p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition flex justify-between items-center group">
            <span class="font-bold text-slate-700 group-hover:text-blue-700">${d.nama}</span>
            <span class="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded group-hover:bg-blue-200 group-hover:text-blue-800">${d.kode || '-'}</span>
        </li>
    `).join('');
}

window.filterSearchList = function() {
    const q = document.getElementById('input-search-list').value.toLowerCase();
    document.querySelectorAll('.search-item').forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.selectSearchItem = function(nama, kode) {
    document.querySelectorAll('.search-item').forEach(li => li.classList.remove('bg-blue-100', 'border-blue-400'));
    event.currentTarget.classList.add('bg-blue-100', 'border-blue-400');
    selectedSearchData = { nama, kode };
};

window.pilihDataSearch = function() {
    if(!selectedSearchData.nama) return alert("Pilih data dari daftar terlebih dahulu!");
    
    let m = currentMode;
    let inputId = `${m}-${currentSearchType === 'customer' ? 'po' : currentSearchType}`;
    let el = document.getElementById(inputId);
    
    if(el) {
        el.value = selectedSearchData.nama;
        el.setAttribute('data-kode', selectedSearchData.kode);
    }
    
    tutupModalSearch();
};

window.bukaModalTambahMaster = function() {
    document.getElementById('input-tambah-nama').value = '';
    document.getElementById('input-tambah-kode').value = '';
    document.getElementById('input-tambah-pin').value = '';
    document.getElementById('modal-tambah-master').classList.remove('hidden');
};

window.simpanDataMasterBaru = async function() {
    const nama = document.getElementById('input-tambah-nama').value.trim().toUpperCase();
    const kode = document.getElementById('input-tambah-kode').value.trim().toUpperCase();
    const pin = document.getElementById('input-tambah-pin').value;

    if(!nama || !kode || !pin) return alert("Semua kolom wajib diisi!");
    
    if(pin !== currentUser.password) return alert("⛔ PIN SALAH! Masukkan password akun Anda.");

    const btn = document.getElementById('btn-simpan-master'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...'; btn.disabled = true;

    try {
        let colNama = currentSearchType === 'item' ? 'nama_item' : currentSearchType;
        let colKode = currentSearchType === 'item' ? 'kode_nama_item' : `kode_${currentSearchType}`;

        const payload = { [colNama]: nama, [colKode]: kode };
        const { error } = await db.from('master_2').insert([payload]);
        if(error) throw error;

        masterData[currentSearchType].push({ nama, kode });
        masterData[currentSearchType].sort((a,b) => a.nama.localeCompare(b.nama));
        
        alert("Data berhasil ditambahkan!");
        document.getElementById('modal-tambah-master').classList.add('hidden');
        renderSearchList();

    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    } finally {
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons();
    }
};

window.hapusDataMaster = async function() {
    if(!selectedSearchData.nama) return alert("Pilih data yang ingin dihapus dari daftar!");
    
    mintaPin(`Hapus '${selectedSearchData.nama}'`, async () => {
        try {
            let colNama = currentSearchType === 'item' ? 'nama_item' : currentSearchType;
            const { error } = await db.from('master_2').delete().eq(colNama, selectedSearchData.nama);
            if(error) throw error;

            masterData[currentSearchType] = masterData[currentSearchType].filter(d => d.nama !== selectedSearchData.nama);
            alert("Data berhasil dihapus!");
            selectedSearchData = { nama: '', kode: '' };
            renderSearchList();
        } catch(e) {
            alert("Gagal menghapus: " + e.message);
        }
    });
};

// ==========================================
// 8. GENERATE BARCODE & PRINT (HTML2CANVAS)
// ==========================================
const findKode = (type, name) => {
    if (!name) return "";
    const arr = masterData[type];
    if (!arr) return "";
    const found = arr.find(x => x.nama.toUpperCase() === name.toUpperCase());
    return found && found.kode ? found.kode : ""; 
};

window.generateLabel = function() {
    let m = currentMode;
    if (m === 'khusus') {
        let str = document.getElementById('k-qr-string').value.trim();
        let jenis = document.getElementById('k-jenis').value;
        if(!str) return alert("Masukkan String QR Code!");
        
        let parts = str.split('/');
        if(parts.length < 4) return alert("Format QR tidak valid! Pastikan ada minimal 3 garis miring (/).");
        
        let kItem = parts[0]; let kShading = parts[1]; let p3 = parts[2]; let p4 = parts[3];
        
        let findName = (type, code) => {
            if(!code) return "";
            let found = masterData[type].find(x => x.kode === code.toUpperCase());
            return found ? found.nama : code;
        };
        
        let namaItem = findName('item', kItem);
        
        let dusCode = ""; let gradeCode = "";
        for(let d of masterData.dus) { if(d.kode && p3.endsWith(d.kode)) { dusCode = d.kode; p3 = p3.slice(0, -dusCode.length); break; } }
        for(let g of masterData.grade) { if(g.kode && p3.endsWith(g.kode)) { gradeCode = g.kode; p3 = p3.slice(0, -gradeCode.length); break; } }
        let panjangCode = p3;
        
        let namaDus = findName('dus', dusCode);
        let namaGrade = findName('grade', gradeCode);
        
        let panjangAsli = 0;
        if(panjangCode) {
            if(panjangCode.length === 2) panjangAsli = parseInt(panjangCode) * 10;
            else if (panjangCode.length === 1) panjangAsli = parseInt(panjangCode) * 100;
            else panjangAsli = parseInt(panjangCode);
        }
        
        let dateCode = p4.substring(0,5); p4 = p4.substring(5);
        
        let poCode = ""; let shiftCode = ""; let mesinCode = "";
        if(jenis === 'p') {
            for(let p of masterData.customer) { if(p.kode && p4.endsWith(p.kode)) { poCode = p.kode; p4 = p4.slice(0, -poCode.length); break; } }
        }
        for(let s of masterData.shift) { if(s.kode && p4.endsWith(s.kode)) { shiftCode = s.kode; p4 = p4.slice(0, -shiftCode.length); break; } }
        mesinCode = p4;
        
        let namaPo = findName('customer', poCode);
        let namaShift = findName('shift', shiftCode);
        let namaMesin = findName('mesin', mesinCode);
        
        let yr = "20" + dateCode.substring(3).split('').reverse().join('');
        let dayOfYear = parseInt(dateCode.substring(0,3));
        let d = new Date(yr, 0); if(!isNaN(dayOfYear)) d.setDate(dayOfYear);
        
        let tglStr = isNaN(d.getTime()) ? dateCode : (`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
        let shiftStr = namaShift.replace(/\D/g, '') ? "S" + namaShift.replace(/\D/g, '') : "";
        let poStr = jenis === 'p' ? namaPo : "";
        let isiStr = "Qty: " + (jenis === 'p' ? "15" : "-");
        let namaStr = namaItem + (namaGrade === 'A' ? ' A' : '');

        const setTxt = (id, txt) => { let el = document.getElementById(id); if(el) el.innerText = txt; };
        
        document.getElementById('el-nama').innerHTML = namaStr;
        setTxt('el-shading', kShading); setTxt('el-mesin', namaMesin); setTxt('el-po', poStr); setTxt('el-dus', namaDus);
        setTxt('el-ukuran', `Uk 20 x ${panjangAsli}`); setTxt('el-isi', isiStr); setTxt('el-shift', shiftStr); setTxt('el-tanggal', tglStr);
        
        document.getElementById('el-nama-back').innerHTML = namaStr;
        setTxt('el-shading-back', kShading); setTxt('el-mesin-back', namaMesin); setTxt('el-po-back', poStr); setTxt('el-dus-back', namaDus);
        setTxt('el-ukuran-back', `Uk 20 x ${panjangAsli}`); setTxt('el-isi-back', isiStr); setTxt('el-shift-back', shiftStr); setTxt('el-tanggal-back', tglStr);

        stateGlobal[m].barcodeData = str;
        setTxt('el-barcode', str);
        
        let qrEl = document.getElementById('qrcode');
        if(qrEl) { 
            qrEl.innerHTML = ""; 
            new QRCode(qrEl, { text: str, width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L }); 
            setTimeout(() => { let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); }, 50);
        }

        document.getElementById('btn-cetak-label').classList.remove('hidden');
        document.getElementById('btn-cetak-label').classList.add('flex');
        return true;
    }

    // Mode Plafon & Lis
    let tgl = document.getElementById(`${m}-tgl`).value;
    let mesin = document.getElementById(`${m}-mesin`).value.trim();
    let shift = document.getElementById(`${m}-shift`).value.trim();
    let item = document.getElementById(`${m}-item`).value.trim();
    let jenis = document.getElementById(`${m}-jenis`).value;
    let panjang = document.getElementById(`${m}-panjang`).value.trim();
    let grade = document.getElementById(`${m}-grade`) ? document.getElementById(`${m}-grade`).value.trim() : '';
    let dus = document.getElementById(`${m}-dus`).value.trim();
    let shading = document.getElementById(`${m}-shading`).value.trim();
    let po = document.getElementById(`${m}-po`) ? document.getElementById(`${m}-po`).value.trim() : '';
    let qty = parseInt(document.getElementById(`${m}-qty`).value);

    if(!item || !panjang || isNaN(qty) || qty < 1) return alert("Nama Item, Panjang, dan Qty wajib diisi dengan benar!");

    let kItem = findKode('item', item);
    let kMesin = findKode('mesin', mesin);
    let kShift = findKode('shift', shift);
    let kDus = findKode('dus', dus);
    
    let kGrade = jenis === 'Lis' ? '1' : findKode('grade', grade);
    let kPo = jenis === 'Lis' ? 'P49' : findKode('customer', po);

    let pAngka = panjang.replace(/\D/g, ''); 
    
    let dObj = new Date(tgl);
    let start = new Date(dObj.getFullYear(), 0, 0);
    let diff = (dObj - start) + ((start.getTimezoneOffset() - dObj.getTimezoneOffset()) * 60 * 1000);
    let dayStr = String(Math.floor(diff / 86400000)).padStart(3, '0');
    let yrRev = String(dObj.getFullYear()).slice(-2).split('').reverse().join('');
    let dateCode = dayStr + yrRev;
    
    let bText = `${kItem}/${shading}/${pAngka}${kGrade}${kDus}/${dateCode}${kMesin}${kShift}${kPo}`;
    stateGlobal[m].barcodeData = bText;

    let hasilPanjang = Math.round(parseFloat(panjang.replace(',', '.')) * 100) || 0;
    let shiftAngka = shift.replace(/\D/g, '');
    let tglStr = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
    let isiStr = jenis === 'Plafon' ? "Qty: 15" : "Qty: -"; 
    let shiftStr = shiftAngka ? "S" + shiftAngka : "";
    let poStr = jenis === 'Lis' ? "P49" : po;

    const setTxt = (id, txt) => { let el = document.getElementById(id); if(el) el.innerText = txt; };
    
    document.getElementById('el-nama').innerHTML = item;
    setTxt('el-shading', shading); setTxt('el-mesin', mesin); setTxt('el-po', poStr); setTxt('el-dus', dus);
    setTxt('el-ukuran', `Uk 20 x ${hasilPanjang}`); setTxt('el-isi', isiStr); setTxt('el-shift', shiftStr); setTxt('el-tanggal', tglStr);
    
    document.getElementById('el-nama-back').innerHTML = item;
    setTxt('el-shading-back', shading); setTxt('el-mesin-back', mesin); setTxt('el-po-back', poStr); setTxt('el-dus-back', dus);
    setTxt('el-ukuran-back', `Uk 20 x ${hasilPanjang}`); setTxt('el-isi-back', isiStr); setTxt('el-shift-back', shiftStr); setTxt('el-tanggal-back', tglStr);

    let isRevisi = document.getElementById(`${m}-cb-revisi`)?.checked;
    let suffixRevisi = isRevisi ? " N" : "";

    setTxt('el-barcode', bText + "/0001" + suffixRevisi);
    
    let qrEl = document.getElementById('qrcode');
    if(qrEl) { 
        qrEl.innerHTML = ""; 
        new QRCode(qrEl, { text: bText + "/0001", width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L }); 
        setTimeout(() => { let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); }, 50);
    }

    document.getElementById('btn-cetak-label').classList.remove('hidden');
    document.getElementById('btn-cetak-label').classList.add('flex');
    return true;
};

window.cetakLabel = async function() {
    let m = currentMode;
    let qty = parseInt(document.getElementById(`${m}-qty`).value) || 1;
    let btnCetak = document.getElementById('btn-cetak-label'); 
    btnCetak.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btnCetak.disabled = true;

    document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
    document.getElementById('context-panel').classList.add('hidden');

    let item = m === 'khusus' ? document.getElementById('el-nama').innerText : document.getElementById(`${m}-item`).value;
    let panjang = m === 'khusus' ? document.getElementById('el-ukuran').innerText.split('x')[1].trim() : document.getElementById(`${m}-panjang`).value.trim().toUpperCase();
    if(m !== 'khusus' && !panjang.endsWith('M')) panjang += 'M';
    let grade = m === 'khusus' ? '' : (document.getElementById(`${m}-grade`) ? document.getElementById(`${m}-grade`).value : (document.getElementById(`${m}-jenis`).value==='Lis'?'1':''));
    
    let idKombinasi = `${item}_${panjang}_${grade}`.toUpperCase().replace(/\s/g, "");

    try {
        const { data: unikData, error: errUnik } = await db.from('database_kode_unik').select('id, last_serial').eq('id_kombinasi', idKombinasi).single();
        
        let startSerial = 1;
        let endSerial = qty;
        
        if (unikData) {
            startSerial = (unikData.last_serial || 0) + 1;
            endSerial = startSerial + qty - 1;
            await db.from('database_kode_unik').update({ last_serial: endSerial }).eq('id', unikData.id);
        } else {
            await db.from('database_kode_unik').insert([{ id_kombinasi: idKombinasi, nama_item: item, panjang: panjang, grade: grade, last_serial: endSerial }]);
        }

        let nodeFront = document.getElementById('canvas'); 
        let nodeBack = document.getElementById('canvas-back'); 
        let wrapper = document.getElementById('labels-wrapper');
        let oldWrapTransform = wrapper.style.transform;
        wrapper.style.transform = 'none';
        
        let oldTransformFront = nodeFront.style.transform; let oldTransformBack = nodeBack.style.transform;
        nodeFront.style.transform = 'none'; nodeFront.style.border = 'none';
        nodeBack.style.transform = 'none'; nodeBack.style.border = 'none';
        
        let container = document.getElementById('preview-container');
        let oldOverflow = container.style.overflowY; container.style.overflowY = 'visible';
        
        let sequenceImages = [];
        let payloadDB = [];
        let isRevisi = document.getElementById(`${m}-cb-revisi`)?.checked;
        let suffixRevisi = isRevisi ? " N" : "";

        for(let i = startSerial; i <= endSerial; i++) {
            let serialStr = "/" + ("0000" + i).slice(-4);
            let fullBarcode = stateGlobal[m].barcodeData + serialStr;
            
            document.getElementById('el-barcode').innerText = fullBarcode + suffixRevisi;
            let qrEl = document.getElementById('qrcode'); qrEl.innerHTML = "";
            new QRCode(qrEl, { text: fullBarcode, width: 400, height: 400, correctLevel : QRCode.CorrectLevel.L });
            let qs = qrEl.querySelectorAll('img, canvas'); qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; });
            
            await new Promise(r => setTimeout(r, 40)); 
            
            let canvasFront = await html2canvas(nodeFront, { scale: 6, backgroundColor: "#ffffff", useCORS: true, logging: false, scrollY: 0 });
            sequenceImages.push(canvasFront.toDataURL("image/png", 1.0));
            
            let canvasBack = await html2canvas(nodeBack, { scale: 6, backgroundColor: "#ffffff", useCORS: true, logging: false, scrollY: 0 });
            sequenceImages.push(canvasBack.toDataURL("image/png", 1.0));
            
            btnCetak.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Render: ${i - startSerial + 1}/${qty}`;
            
            if (m !== 'khusus') {
                payloadDB.push({
                    kode_barcode: fullBarcode,
                    tgl_produksi: document.getElementById(`${m}-tgl`).value,
                    mesin: document.getElementById(`${m}-mesin`).value,
                    shift: document.getElementById(`${m}-shift`).value,
                    nama_item: item,
                    panjang: panjang,
                    grade: grade,
                    dus: document.getElementById(`${m}-dus`).value,
                    shading: document.getElementById(`${m}-shading`).value,
                    qty_dus: 1
                });
            }
        }
        
        nodeFront.style.transform = oldTransformFront; nodeFront.style.border = '1px solid black';
        nodeBack.style.transform = oldTransformBack; nodeBack.style.border = '1px solid black';
        wrapper.style.transform = oldWrapTransform; container.style.overflowY = oldOverflow;
        
        if (m !== 'khusus' && payloadDB.length > 0) {
            const { error: errInsert } = await db.from('database_plafon_lis').insert(payloadDB);
            if(errInsert) console.error("Gagal simpan ke DB Plafon/Lis:", errInsert);
        }

        let w = stateGlobal[m].kertas.w + "mm"; let h = stateGlobal[m].kertas.h + "mm";
        let pWin = window.open('', '_blank');
        pWin.document.write(`<html><head><title>Print Label</title><style>
            @page { size: ${w} ${h}; margin: 0; }
            body { margin: 0; padding: 20px; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; }
            .label-page { page-break-after: always; width: ${w}; height: ${h}; background: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; }
            img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; filter: grayscale(100%) contrast(1000%); }
            @media print { body { background: #fff; padding: 0; display: block; } .label-page { box-shadow: none; margin: 0; } }
        </style></head><body>`);
        sequenceImages.forEach(img => { pWin.document.write(`<div class="label-page"><img src="${img}"></div>`); });
        pWin.document.write(`</body></html>`); pWin.document.close(); 
        
        setTimeout(() => { pWin.focus(); pWin.print(); }, 200);

    } catch(e) {
        alert("Terjadi kesalahan: " + e.message);
    } finally {
        btnCetak.innerHTML = '<i data-lucide="printer" class="w-4 h-4"></i> 2. Cetak Label'; btnCetak.disabled = false; lucide.createIcons();
    }
};

// ==========================================
// 9. SECURITY (PIN)
// ==========================================
function mintaPin(title, callback) {
    document.getElementById('pin-global-title').innerText = title;
    document.getElementById('input-pin-global').value = '';
    pendingAction = callback;
    document.getElementById('modal-pin-global').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
}

window.eksekusiPinGlobal = function() {
    let pin = document.getElementById('input-pin-global').value;
    if(pin === currentUser.password) {
        document.getElementById('modal-pin-global').classList.add('hidden');
        document.getElementById('overlay-klik-luar').classList.add('hidden');
        if(pendingAction) pendingAction();
    } else {
        alert("⛔ PIN SALAH! Masukkan password akun Anda.");
    }
};

function initKeyboardGlobal() { 
    document.removeEventListener('keydown', penangananKeyboardEvent); 
    document.addEventListener('keydown', penangananKeyboardEvent); 
}

function penangananKeyboardEvent(e) { 
    let m = activeSelection.m || currentMode; 
    if(e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); eksekusiUndo(); return; } 
    if(e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); eksekusiRedo(); return; } 
    if(activeSelection.elements.length === 0) return; 
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName.toUpperCase())) return; 
    
    let x=0, y=0, s=(e.shiftKey)?5:1; 
    switch(e.key){ case 'ArrowUp': y=-s; break; case 'ArrowDown': y=s; break; case 'ArrowLeft': x=-s; break; case 'ArrowRight': x=s; break; default: return; } 
    
    e.preventDefault(); simpanSnapshotHistory(); 
    activeSelection.elements.forEach(k => { 
        if(stateGlobal[m].pos[k]) { stateGlobal[m].pos[k].x += x; stateGlobal[m].pos[k].y += y; updateTransform(k, activeSelection.isBack); } 
    }); 
}
