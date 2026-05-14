// ==========================================
// FILE: js_plafon.js
// ==========================================
let dataPlafon = {}; 
let selectedPlafonItem = ""; 
let selectedPlafonPO = ""; 

// VARIABEL UNTUK D-PAD & ZOOM (Default 300% = 3.0)
let globalZoom = 3.0;
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
}

function isiDropdownPlafon(data) {
    const selMesin = document.getElementById('p-mesin');
    if(selMesin) selMesin.innerHTML = '<option value="">Pilih Mesin</option>' + data.mesin.map(m => `<option value="${m}">${m}</option>`).join('');
    
    const selShift = document.getElementById('p-shift');
    if(selShift) selShift.innerHTML = '<option value="">Pilih Shift</option>' + data.shift.map(s => `<option value="${s}">${s}</option>`).join('');
}

// ==========================================
// FUNGSI ZOOM (300% Default)
// ==========================================
function ubahZoom(prefix, delta) {
    globalZoom += delta;

    // Batasi Zoom (Min 50%, Max 600%)
    if (globalZoom < 0.5) globalZoom = 0.5;
    if (globalZoom > 6.0) globalZoom = 6.0;

    // Update Teks Persentase
    const zoomText = document.getElementById(prefix + '-zoom-text');
    if (zoomText) {
        zoomText.innerText = Math.round(globalZoom * 100) + "%";
    }

    applyTransform(prefix);
}

// ==========================================
// FITUR GESER (D-PAD)
// ==========================================
function movePos(dir) {
    let step = 2; // Geser 2px
    if(dir === 'up') globalY -= step;
    if(dir === 'down') globalY += step;
    if(dir === 'left') globalX -= step;
    if(dir === 'right') globalX += step;
    applyTransform('p');
}

function applyTransform(prefix) {
    const canvas = document.getElementById(prefix + '-label-canvas');
    const inner = document.getElementById(prefix + '-inner-label'); // Bagian teks di dalam
    
    if(canvas) {
        // Zoom diterapkan pada kotak putih
        canvas.style.transform = `scale(${globalZoom})`;
    }
    
    if(inner) {
        // Geser diterapkan pada konten di dalamnya
        inner.style.transform = `translate(${globalX}px, ${globalY}px)`;
    }
}

// Fungsi dummy untuk tombol (akan kita isi di tahap berikutnya)
async function prosesGenerate(p) { alert("Data tersimpan di Supabase! QRCode akan muncul di kotak putih."); }
function renderPreview(p) { window.print(); }
function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
function bukaModal(id) { document.getElementById(id).style.display = 'block'; }
