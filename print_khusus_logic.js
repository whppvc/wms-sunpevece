// ============================================================================
// WMS SUNPEVECE - CETAK LABEL KHUSUS ENGINE (STANDALONE)
// ============================================================================

let currentMode = 'khusus'; 
let masterData = { mesin: [], shift: [], item: [], grade: [], dus: [], customer: [], lis: [] };
let isInfoLocked = true; // State Kunci Elemen Informasi Bawah

const createBasePos = () => ({ x: 0, y: 0 });
const baseVis = { qr: true, barcode: true, nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };
const baseVisBack = { nama: true, shading: true, ukuran: true, mesin: false, shift: true, tanggal: true, po: false, dus: true, isi: true };

let stateGlobal = {};
const modes = ['khusus'];
modes.forEach(m => {
    stateGlobal[m] = { zoom: 4.0, pos: { qr: { x: 0, y: 0, s: 1 }, barcode: createBasePos(), nama: createBasePos(), shading: createBasePos(), ukuran: createBasePos(), mesin: createBasePos(), shift: createBasePos(), tanggal: createBasePos(), po: createBasePos(), dus: createBasePos(), isi: createBasePos() }, font: { barcode: 5, nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, kertas: { tipe: 'custom', w: 85, h: 50 }, wrap: { nama: 33, barcode: 45, nama_cb: true, barcode_cb: true }, barcodeData: "", linkFont: true, vis: JSON.parse(JSON.stringify(baseVis)) };
    stateGlobal[m + '_back'] = { pos: { nama: createBasePos(), shading: createBasePos(), ukuran: createBasePos(), mesin: createBasePos(), shift: createBasePos(), tanggal: createBasePos(), po: createBasePos(), dus: createBasePos(), isi: createBasePos() }, font: { nama: 16, shading: 16, info: 6 }, gap: { info: 5 }, wrap: { nama: 75, nama_cb: true }, linkFont: true, vis: JSON.parse(JSON.stringify(baseVisBack)) };
});

let historyStack = {};
modes.forEach(m => historyStack[m] = { undo: [], redo: [] });

let activeSelection = { m: null, elements: [] };
let isDragging = false, dragStartX = 0, dragStartY = 0, dragInitialPos = {};
let pendingAction = null;

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', password: ''};

// REVISI: Fungsi Menutup Modal PIN Global dengan Sempurna
window.tutupModalPinGlobal = function() {
    document.getElementById('modal-pin-global').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    pendingAction = null;
};

window.tutupSemuaPopups = function() {
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    document.getElementById('modal-pin-global').classList.add('hidden');
    pendingAction = null;
};

// ==========================================
// 1. INISIALISASI & SUPABASE FETCH
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initModernLayout({ id: 'print_khusus', title: 'CETAK LABEL KHUSUS', url: 'print_khusus.html' });
    } catch(e) { console.error("Layout init:", e); }

    initKeyboardGlobal();

    // REVISI: LANGSUNG RENDER UI DI AWAL AGAR TIDAK BLANK
    switchMode('khusus'); 

    // LOAD DATA MASTER SEPANJANG DI BACKGROUND DENGAN CRASH-PROOF WRAPPER
    await loadMasterData();
});

async function loadMasterData() {
    try {
        const { data, error } = await db.from('master_2').select('*');
        if (!error && data) {
            const getUnique = (keyName, keyCode) => {
                let map = new Map();
                data.forEach(r => {
                    if (r[keyName] && String(r[keyName]).trim() !== '') {
                        map.set(String(r[keyName]).trim().toUpperCase(), { nama: String(r[keyName]).trim(), kode: r[keyCode] || '' });
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
        }
    } catch (e) {
        console.error("Gagal memuat master_2:", e);
    }

    try {
        const { data: resLis, error: errLis } = await db.from('master_lis').select('*');
        if (!errLis && resLis) {
            masterData.lis = resLis;
        }
    } catch(e) {
        console.error("Gagal memuat master_lis (opsional):", e);
    }
}

// ==========================================
// HELPER LOOKUP QTY DUS / BOX
// ==========================================
function getIsiBoxText(jenisItem, namaItem) {
    let j = (jenisItem || '').trim();
    let n = (namaItem || '').trim().toUpperCase();

    if (j === 'Plafon') return "Qty: 15";

    if (j === 'Lis') {
        if (masterData.lis && masterData.lis.length > 0) {
            let found = masterData.lis.find(l => (l.nama_item_lis || l.nama_item || '').trim().toUpperCase() === n);
            if (found && found.qty_isi) {
                return `Qty: ${found.qty_isi}`;
            }
        }
        if (n.includes('PROFILE IV') || n.includes('PROFILE V')) return "Qty: 60";
        if (n.includes('PROFILE II')) return "Qty: 48";
        if (n.includes('PROFILE I')) return "Qty: 140";
        if (n.includes('CONNECTOR')) return "Qty: 80";
        return "Qty: 24";
    }

    return "Qty: -";
}

function switchMode(mode) {
    currentMode = mode;
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
        bForm.className = 'flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded shadow-sm transition';
        bSet.className = 'flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded transition';
    } else {
        pForm.classList.add('hidden'); pSet.classList.remove('hidden');
        bSet.className = 'flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded shadow-sm transition';
        bForm.className = 'flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded transition';
        switchSideSettings(); 
    }
}

function renderForm() {
    const container = document.getElementById('panel-form');
    container.innerHTML = `
        <div>
            <label class="block text-xs font-bold text-slate-800 mb-1">Jenis Item:</label>
            <select id="k-jenis" class="w-full p-2 text-sm border border-slate-300 rounded outline-none bg-white text-slate-800 cursor-pointer"><option value="Plafon">Plafon</option><option value="Lis">Lis</option></select>
        </div>
        <div>
            <label class="block text-xs font-bold text-slate-800 mb-1">String QR Code:</label>
            <textarea id="k-qr-string" rows="4" class="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-emerald-600 font-mono bg-white text-slate-800" placeholder="Contoh: P103/WT-1/400A1/20262MPL02S1P49/0001"></textarea>
        </div>
        <div class="p-3 border border-emerald-200 bg-emerald-50 rounded-lg mt-2">
            <label class="block text-xs font-bold text-emerald-800 mb-1">Jumlah Box (Qty Print):</label>
            <input type="number" id="k-qty" value="1" min="1" class="w-full p-2 text-base border border-slate-300 rounded outline-none focus:border-emerald-600 font-bold text-center bg-white text-slate-900">
        </div>
    `;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSettings() {
    const container = document.getElementById('panel-setting');
    
    container.innerHTML = `
        <div>
            <label class="block text-[10px] font-black uppercase text-slate-500 mb-1">Pilih Sisi Label</label>
            <select id="side-select" onchange="switchSideSettings()" class="w-full p-2 text-sm border-2 border-slate-300 rounded outline-none focus:border-emerald-500 font-bold bg-white cursor-pointer">
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
                <button onclick="resetDefaultVisibility()" class="text-[10px] font-bold text-emerald-600 hover:underline">Reset Default</button>
            </div>
            <div class="grid grid-cols-2 gap-2" id="vis-checkboxes"></div>
        </div>

        <div class="bg-slate-50 border border-slate-200 p-3 rounded-lg">
            <h4 class="text-xs font-black text-slate-700 mb-2">Wrap Text (Bungkus)</h4>
            <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer" id="row-wrap-barcode"><input type="checkbox" id="cb-wrap-barcode" onchange="handleWrapChange('barcode', this.checked)" class="w-4 h-4 accent-emerald-600"> Kode Barcode</label>
                <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer"><input type="checkbox" id="cb-wrap-nama" onchange="handleWrapChange('nama', this.checked)" class="w-4 h-4 accent-emerald-600"> Nama Item</label>
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
            <span class="text-[8px] font-black text-white ${isBack ? 'bg-slate-500' : 'bg-emerald-700'} px-2 py-0.5 rounded uppercase">Label ${isBack ? 'Belakang' : 'Depan'}</span>
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
            <input type="checkbox" id="cb-vis-${k}" ${state.vis[k] ? 'checked' : ''} onchange="handleVisChange('${k}', this.checked)" class="w-4 h-4 accent-emerald-600"> 
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

function handleWrapChange(key, isChecked, targetSide = null) {
    const sideSelect = document.getElementById('side-select')?.value || 'front';
    const side = targetSide || sideSelect;
    const isBack = side === 'back';
    const m = currentMode + (isBack ? '_back' : '');
    const idSfx = isBack ? '-back' : '';
    
    stateGlobal[m].wrap[`${key}_cb`] = isChecked;
    let val = stateGlobal[m].wrap[key];
    
    let el = document.getElementById(`el-${key}${idSfx}`);
    if(el) {
        if(isChecked) { 
            el.style.whiteSpace = 'normal'; 
            el.style.wordBreak = 'break-word'; 
            el.style.wordWrap = 'break-word'; 
            el.style.maxWidth = val + (key==='nama'?'mm':'px'); 
        } else { 
            el.style.whiteSpace = 'nowrap'; 
            el.style.maxWidth = 'none';
            el.style.wordBreak = 'normal';
            el.style.wordWrap = 'normal';
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
// 4. DRAG & DROP ENGINE (DENGAN SECURITY PIN LOCK)
// ==========================================
window.startDrag = function(elementKey, event, isBack = false) {
    event.preventDefault();

    // REVISI: Penguncian Elemen Informasi Bawah (Ukuran, Tgl, Mesin, Shift, PO, Dus, Isi)
    const infoElements = ['ukuran', 'mesin', 'shift', 'tanggal', 'po', 'dus', 'isi'];
    if (infoElements.includes(elementKey) && isInfoLocked) {
        mintaPin("Buka Kunci Pengaturan Ukuran & Posisi Info", () => {
            isInfoLocked = false;
            alert("🔓 Kunci berhasil dibuka! Anda sekarang dapat mengatur posisi dan font elemen informasi.");
        });
        return;
    }

    let m = currentMode + (isBack ? '_back' : '');
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
window.updateSliderFill = function(el) {
    if (!el) return;
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const val = parseFloat(el.value);
    const percentage = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    el.style.background = `linear-gradient(to right, #059669 ${percentage}%, #334155 ${percentage}%)`;
};

function showContextPanel() {
    const panel = document.getElementById('context-panel');
    if(activeSelection.elements.length === 0) { panel.classList.add('hidden'); return; }
    
    let key = activeSelection.elements[activeSelection.elements.length - 1];
    let m = activeSelection.m;
    
    let html = '';
    
    const buildSlider = (type, min, max, val) => `
        <div class="flex flex-col items-center w-16 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
            <span class="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-wider">${type}</span>
            <input type="number" value="${val}" class="w-full bg-slate-950 text-emerald-400 border border-slate-600 rounded text-center font-bold text-sm py-1 mb-2 outline-none focus:border-emerald-500" onchange="syncContext('${type}', this.value)">
            <button onclick="stepContext('${type}', 1)" class="w-full bg-slate-700 hover:bg-emerald-600 text-white rounded py-1 font-bold text-sm transition mb-3">+</button>
            <div class="slider-wrapper">
                <input type="range" orient="vertical" min="${min}" max="${max}" value="${val}" class="custom-vertical-slider" oninput="syncContext('${type}', this.value); updateSliderFill(this)">
            </div>
            <button onclick="stepContext('${type}', -1)" class="w-full bg-slate-700 hover:bg-rose-600 text-white rounded py-1 font-bold text-sm transition mt-3">-</button>
        </div>`;

    if (key === 'qr') html += buildSlider('skala', 50, 250, Math.round(stateGlobal[m].pos.qr.s * 100));
    else if (key === 'barcode') { html += buildSlider('font', 3, 80, stateGlobal[m].font.barcode); html += buildSlider('wrap', 10, 150, stateGlobal[m].wrap.barcode); }
    else if (['nama', 'shading'].includes(key)) { html += buildSlider('font', 8, 80, stateGlobal[m].font[key]); if(key==='nama') html += buildSlider('wrap', 10, 85, stateGlobal[m].wrap.nama); }
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
            if(el) {
                if(isWrapOn) {
                    el.style.whiteSpace = 'normal';
                    el.style.wordBreak = 'break-word';
                    el.style.wordWrap = 'break-word';
                    el.style.maxWidth = v + (k==='nama'?'mm':'px');
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
        if(inp.getAttribute('onchange').includes(type)) {
            inp.value = v; 
            let slider = inp.parentElement.querySelector('.custom-vertical-slider');
            if(slider) {
                slider.value = v;
                updateSliderFill(slider);
            }
        } 
    });
};

window.stepContext = function(type, step) {
    let inputs = document.querySelectorAll('#context-panel input[type="number"]');
    inputs.forEach(inp => {
        if(inp.getAttribute('onchange').includes(type)) {
            let nVal = parseInt(inp.value) + (step * (type==='skala'?5:1));
            inp.value = nVal; 
            syncContext(type, nVal);
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

function applyCurrentStateToDOM(m) {
    Object.keys(stateGlobal[m].pos).forEach(k => updateTransform(k, false));
    Object.keys(stateGlobal[m+'_back'].pos).forEach(k => updateTransform(k, true));
    
    ['barcode', 'nama', 'shading'].forEach(k => {
        let el = document.getElementById(k==='barcode'?'el-barcode':`el-${k}`); if(el) el.style.fontSize = stateGlobal[m].font[k] + 'px';
        let elB = document.getElementById(k==='barcode'?'el-barcode-back':`el-${k}-back`); if(elB) elB.style.fontSize = stateGlobal[m+'_back'].font[k] + 'px';
    });
    document.getElementById('el-info-group').style.fontSize = stateGlobal[m].font.info + 'px'; document.getElementById('el-info-group').style.gap = stateGlobal[m].gap.info + 'px';
    document.getElementById('el-info-group-back').style.fontSize = stateGlobal[m+'_back'].font.info + 'px'; document.getElementById('el-info-group-back').style.gap = stateGlobal[m+'_back'].gap.info + 'px';
    
    handleWrapChange('nama', stateGlobal[m].wrap.nama_cb, 'front');
    handleWrapChange('barcode', stateGlobal[m].wrap.barcode_cb, 'front');
    handleWrapChange('nama', stateGlobal[m+'_back'].wrap.nama_cb, 'back');
}

function loadSetDefault(m) {
    let saved = localStorage.getItem('defaultLabel_' + m);
    if(saved) {
        try {
            let p = JSON.parse(saved);
            stateGlobal[m].pos = p.front.pos; stateGlobal[m].font = p.front.font; stateGlobal[m].gap = p.front.gap; stateGlobal[m].vis = p.front.vis; stateGlobal[m].kertas = p.front.kertas; stateGlobal[m].wrap = p.front.wrap;
            
            if(p.back) {
                stateGlobal[m+'_back'].pos = p.back.pos; stateGlobal[m+'_back'].font = p.back.font; stateGlobal[m+'_back'].gap = p.back.gap; stateGlobal[m+'_back'].vis = p.back.vis; stateGlobal[m+'_back'].wrap = p.back.wrap;
            }
            
            if(p.front.zoom) { stateGlobal[m].zoom = p.front.zoom; document.getElementById('labels-wrapper').style.transform = `scale(${p.front.zoom})`; document.getElementById('zoom-text').innerText = Math.round(p.front.zoom * 100) + "%"; }
            
            applyCurrentStateToDOM(m);
            
            document.getElementById('kertas-select').value = p.front.kertas.tipe;
            ubahTipeKertas();
            if(p.front.kertas.tipe === 'custom') {
                document.getElementById('custom-w').value = p.front.kertas.w;
                document.getElementById('custom-h').value = p.front.kertas.h;
                updateKertasCustom();
            }

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
// 8. ALGORITMA PARSING KHUSUS & GENERATE LABEL
// ==========================================
function parseJulianDate(dateCode) {
    if (!dateCode || dateCode.length < 5) return dateCode || "-";
    try {
        let dayNum = parseInt(dateCode.substring(0, 3));
        let yrRaw = dateCode.substring(3, 5); 
        let yrRev = yrRaw.split('').reverse().join(''); 
        let fullYear = parseInt("20" + yrRev); 

        if (isNaN(dayNum) || isNaN(fullYear)) return dateCode;

        let dateObj = new Date(fullYear, 0, 1);
        dateObj.setDate(dayNum); 

        let dd = String(dateObj.getDate()).padStart(2, '0');
        let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        let yyyy = dateObj.getFullYear();

        return `${dd}/${mm}/${yyyy}`;
    } catch (e) {
        return dateCode;
    }
}

function parsePanjangNumber(rawPjg) {
    if (!rawPjg) return "0";
    let digits = rawPjg.replace(/\D/g, ''); 
    if (!digits) return "0";
    if (digits.length === 1) return digits + "00"; 
    if (digits.length === 2) return digits + "0";  
    return digits; 
}

window.generateLabel = function() {
    let m = currentMode;
    let str = document.getElementById('k-qr-string').value.trim();
    let jenis = document.getElementById('k-jenis').value; 
    
    if(!str) return alert("Masukkan String QR Code terlebih dahulu!");
    
    let parts = str.split('/');
    if(parts.length < 4) return alert("Format String QR Code tidak valid! Minimal terdiri dari 4 bagian pisahan garis miring (/).");
    
    let part0 = parts[0].trim();
    let part1 = parts[1].trim();
    let part2 = parts[2].trim();
    let part3 = parts[3].trim();

    // A. BAGIAN 0: KODE ITEM
    let namaItemFound = "-";
    let itemObj = masterData.item.find(x => x.kode.toUpperCase() === part0.toUpperCase());
    if (itemObj) {
        namaItemFound = itemObj.nama;
    } else {
        namaItemFound = part0; 
    }

    // B. BAGIAN 1: SHADING
    let shadingFound = part1 || "-";

    // C. BAGIAN 2: PANJANG + KODE GRADE + KODE DUS
    let rem2 = part2;
    let dusFound = "-";
    let gradeFound = "-";

    let dusList = [...masterData.dus].sort((a, b) => (b.kode || '').length - (a.kode || '').length);
    for (let d of dusList) {
        if (d.kode && rem2.toUpperCase().endsWith(d.kode.toUpperCase())) {
            dusFound = d.nama;
            rem2 = rem2.substring(0, rem2.length - d.kode.length);
            break;
        }
    }

    let gradeList = [...masterData.grade].sort((a, b) => (b.kode || '').length - (a.kode || '').length);
    for (let g of gradeList) {
        if (g.kode && rem2.toUpperCase().endsWith(g.kode.toUpperCase())) {
            gradeFound = g.nama;
            rem2 = rem2.substring(0, rem2.length - g.kode.length);
            break;
        }
    }

    let pjgNum = parsePanjangNumber(rem2);

    // D. BAGIAN 3: DATECODE + MESIN + SHIFT + CUSTOMER
    let dateCode = part3.substring(0, 5);
    let tglStr = parseJulianDate(dateCode);

    let rem3 = part3.substring(5);
    let customerFound = "-";
    let shiftFound = "-";

    if (jenis === 'Lis') {
        customerFound = "P49";
        let p49Obj = masterData.customer.find(c => c.kode === 'P49');
        if (p49Obj) customerFound = p49Obj.nama;
    } else {
        let customerList = [...masterData.customer].sort((a, b) => (b.kode || '').length - (a.kode || '').length);
        for (let c of customerList) {
            if (c.kode && rem3.toUpperCase().endsWith(c.kode.toUpperCase())) {
                customerFound = c.nama;
                rem3 = rem3.substring(0, rem3.length - c.kode.length);
                break;
            }
        }
    }

    let shiftList = [...masterData.shift].sort((a, b) => (b.kode || '').length - (a.kode || '').length);
    for (let s of shiftList) {
        if (s.kode && rem3.toUpperCase().endsWith(s.kode.toUpperCase())) {
            shiftFound = s.nama;
            rem3 = rem3.substring(0, rem3.length - s.kode.length);
            break;
        }
    }
    let shiftDisplay = shiftFound.replace(/\D/g, '') ? "S" + shiftFound.replace(/\D/g, '') : shiftFound;

    let mesinCode = rem3;
    let mesinObj = masterData.mesin.find(m => m.kode.toUpperCase() === mesinCode.toUpperCase());
    let mesinFound = mesinObj ? mesinObj.nama : (mesinCode || "-");

    // E. KELENGKAPAN NAMA ITEM & QTY PER BOX (LOOKUP MASTER_LIS ACCURATE)
    let namaStr = namaItemFound + (gradeFound === 'A' ? ' A' : '');
    let isiStr = getIsiBoxText(jenis, namaItemFound);

    const setTxt = (id, txt) => { let el = document.getElementById(id); if(el) el.innerText = txt; };
    
    document.getElementById('el-nama').innerHTML = namaStr;
    setTxt('el-shading', shadingFound); 
    setTxt('el-mesin', mesinFound); 
    setTxt('el-po', customerFound); 
    setTxt('el-dus', dusFound);
    setTxt('el-ukuran', `Uk 20 x ${pjgNum}`); 
    setTxt('el-isi', isiStr); 
    setTxt('el-shift', shiftDisplay); 
    setTxt('el-tanggal', tglStr);
    
    document.getElementById('el-nama-back').innerHTML = namaStr;
    setTxt('el-shading-back', shadingFound); 
    setTxt('el-mesin-back', mesinFound); 
    setTxt('el-po-back', customerFound); 
    setTxt('el-dus-back', dusFound);
    setTxt('el-ukuran-back', `Uk 20 x ${pjgNum}`); 
    setTxt('el-isi-back', isiStr); 
    setTxt('el-shift-back', shiftDisplay); 
    setTxt('el-tanggal-back', tglStr);

    stateGlobal[m].barcodeData = str;
    setTxt('el-barcode', str);
    
    let qrEl = document.getElementById('qrcode');
    if(qrEl) { 
        qrEl.innerHTML = ""; 
        new QRCode(qrEl, { text: str, width: 150, height: 150, correctLevel : QRCode.CorrectLevel.L }); 
        setTimeout(() => { 
            let qs = qrEl.querySelectorAll('img, canvas'); 
            qs.forEach(q => { q.style.width = '100%'; q.style.height = '100%'; }); 
        }, 50);
    }

    applyCurrentStateToDOM(m);
    document.getElementById('btn-cetak-label').classList.remove('hidden');
    document.getElementById('btn-cetak-label').classList.add('flex');
    return true;
};

// CETAK KHUSUS HIGH-SPEED
window.cetakLabel = async function() {
    let m = currentMode;
    let qty = parseInt(document.getElementById('k-qty').value) || 1;
    let btnCetak = document.getElementById('btn-cetak-label'); 
    btnCetak.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Memproses...'; btnCetak.disabled = true;

    document.querySelectorAll('.click-edit').forEach(el => el.classList.remove('active-edit'));
    document.getElementById('context-panel').classList.add('hidden');

    let pWin = window.open('about:blank', '_blank');
    if(!pWin) {
        alert("Popup diblokir oleh browser! Silakan izinkan pop-up (Always allow pop-ups) di address bar atas, lalu coba lagi.");
        btnCetak.innerHTML = '<i data-lucide="printer" class="w-4 h-4"></i> 2. Cetak Label'; btnCetak.disabled = false;
        return;
    }
    
    let w = stateGlobal[m].kertas.w + "mm"; 
    let h = stateGlobal[m].kertas.h + "mm";
    pWin.document.write(`
        <html><head><title>Mencetak Label...</title>
        <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #ffffff; }
            .card { background: #1e293b; padding: 28px 36px; border-radius: 16px; border: 1px solid #334155; text-align: center; width: 320px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            .title { font-size: 13px; font-weight: 800; margin-bottom: 6px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
            .subtitle { font-size: 16px; font-weight: 800; color: #10b981; margin-bottom: 16px; }
            .progress-bg { width: 100%; height: 10px; background: #334155; border-radius: 5px; overflow: hidden; margin-bottom: 10px; }
            .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #059669, #10b981); border-radius: 5px; transition: width 0.05s ease-out; }
            .status-detail { font-size: 12px; font-weight: 700; color: #cbd5e1; }
        </style>
        </head><body>
            <div class="card">
                <div class="title">WMS SUNPEVECE</div>
                <div class="subtitle" id="prog-txt">Menyiapkan Render...</div>
                <div class="progress-bg"><div class="progress-fill" id="prog-bar"></div></div>
                <div class="status-detail" id="prog-detail">0% Selesai</div>
            </div>
        </body></html>
    `);

    try {
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

        nodeFront.style.transition = 'none';
        nodeBack.style.transition = 'none';

        let canvasBack = await html2canvas(nodeBack, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, imageTimeout: 0 });
        let imgBackBase64 = canvasBack.toDataURL("image/png", 1.0);

        let qrEl = document.getElementById('qrcode');
        let imgTag = qrEl.querySelector('img'); if (imgTag) imgTag.remove();
        let canvasTag = qrEl.querySelector('canvas');
        if (canvasTag) { canvasTag.style.width = '100%'; canvasTag.style.height = '100%'; canvasTag.style.display = 'block'; }

        let canvasFront = await html2canvas(nodeFront, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, imageTimeout: 0 });
        let imgFrontBase64 = canvasFront.toDataURL("image/png", 1.0);

        let sequenceImages = [];
        for(let i = 1; i <= qty; i++) {
            sequenceImages.push(imgFrontBase64);
            sequenceImages.push(imgBackBase64);

            let pct = Math.round((i / qty) * 100);
            if (pWin && !pWin.closed && pWin.document) {
                let elTxt = pWin.document.getElementById('prog-txt');
                let elBar = pWin.document.getElementById('prog-bar');
                let elDetail = pWin.document.getElementById('prog-detail');
                if (elTxt) elTxt.innerText = `Menyiapkan Label ${i} dari ${qty}`;
                if (elBar) elBar.style.width = pct + '%';
                if (elDetail) elDetail.innerText = `${pct}% Selesai`;
            }
        }
        
        nodeFront.style.transform = oldTransformFront; nodeFront.style.border = '1px solid black'; nodeFront.style.transition = '';
        nodeBack.style.transform = oldTransformBack; nodeBack.style.border = '1px solid black'; nodeBack.style.transition = '';
        wrapper.style.transform = oldWrapTransform; container.style.overflowY = oldOverflow;

        pWin.document.open();
        pWin.document.write(`<html><head><title>Print Label Khusus</title><style>
            @page { size: ${w} ${h}; margin: 0; }
            body { margin: 0; padding: 20px; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; }
            .label-page { page-break-after: always; width: ${w}; height: ${h}; background: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; flex-shrink: 0; }
            img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; filter: grayscale(100%) contrast(1000%); }
            @media print { body { background: #fff; padding: 0; display: block; } .label-page { box-shadow: none; margin: 0; } }
        </style></head><body>`);
        
        sequenceImages.forEach(img => { pWin.document.write(`<div class="label-page"><img src="${img}"></div>`); });
        
        pWin.document.write(`</body></html>`); 
        pWin.document.close(); 
        
        setTimeout(() => { pWin.focus(); pWin.print(); }, 100);

    } catch(e) {
        if(pWin && !pWin.closed) pWin.close();
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
