// File: langsir_modals.js

function toggleMenuUtama() { document.getElementById('dropdown-menu').classList.toggle('hidden'); }
function bukaModalAdd() { document.getElementById('modal-add-scan').classList.remove('hidden'); }
function tutupModalAdd() { document.getElementById('modal-add-scan').classList.add('hidden'); }
function toggleSidebarFilter() { 
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full'); 
    document.getElementById('overlay-klik-luar').classList.toggle('hidden'); 
}

function tutupSemuaPopup() { 
    document.getElementById('sidebar-filter').classList.add('translate-x-full'); 
    document.getElementById('overlay-klik-luar').classList.add('hidden'); 
    tutupModalSTBJ(); tutupModalHold(); 
    const menu = document.getElementById('dropdown-menu');
    if(menu) menu.classList.add('hidden'); 
}

function resetFilter() { 
    const ids = ['f-stbj','f-kode','f-troli','f-area','f-qr']; 
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); 
    if(typeof saringTabelLangsir === 'function') saringTabelLangsir(); 
    toggleSidebarFilter(); 
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('dropdown-menu');
    const btn = document.getElementById('btn-menu-utama');
    if(menu && !menu.classList.contains('hidden') && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const formScan = document.getElementById('form-scan');
        if(formScan) {
            formScan.addEventListener('submit', (e) => {
                e.preventDefault();
                const rawInput = document.getElementById('input-qrcode').value.trim();
                const area = document.getElementById('select-area').value;
                if(!area || !rawInput) return alert("Pilih Area Simpan dan isi QR Code terlebih dahulu!");
                
                const existingQRs = Array.from(document.querySelectorAll('.qr-val')).map(td => td.innerText);
                const codes = rawInput.split(/[\s;]+/).map(q => q.trim()).filter(q => q);
                
                codes.forEach(code => { 
                    const isLocalDuplicate = existingQRs.includes(code);
                    if(typeof addRow === 'function') addRow(area, code, isLocalDuplicate); 
                    existingQRs.push(code); 
                });
                
                if(typeof updateRowNumbers === 'function') updateRowNumbers();
                if(typeof updateTotalBaris === 'function') updateTotalBaris();
                
                document.getElementById('input-qrcode').value = '';
                tutupModalAdd(); 
                
                const scrollContainer = document.getElementById('scroll-container');
                if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
            });
        }
    }, 500);
});

async function bukaModalSTBJ() {
    document.getElementById('modal-stbj-langsir').classList.remove('hidden');
    const tbody = document.getElementById('tbody-stbj-modal');
    tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data STBJ...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hasil_stbj').select('*').order('created_at', {ascending: false});
        if(error) throw error;
        if(!data || data.length === 0) {
            tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Data STBJ Kosong.</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            const td = typeof translateBarcode === 'function' ? translateBarcode(r.qrcode) : { po: '-', namaItem: 'Unknown', panjang: '-' };
            let statusGudang = r.posisi || 'STBJ';
            let colGudang = statusGudang === 'IN GUDANG' ? '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded text-[10px] border border-emerald-200">IN GUDANG</span>' 
                : statusGudang === 'KELUAR' ? '<span class="bg-red-100 text-red-800 font-bold px-2 py-1 rounded text-[10px] border border-red-200">KELUAR</span>' 
                : '<span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-[10px] border border-blue-200">STBJ</span>';
            
            h += `
                <div class="row-modal-stbj bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
                    <div class="flex justify-between items-center mb-1 border-b border-slate-100 pb-2">
                        <span class="font-black text-slate-400 text-xs">#${i+1} - ${tgl}</span>
                        ${colGudang}
                    </div>
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all">${r.qrcode}</div>
                    <div class="text-[13px] font-bold text-slate-600 grid grid-cols-2 gap-1 mt-1">
                        <div>Troli: <span class="text-blue-600">${r.troli || '-'}</span></div>
                        <div>PO: <span class="text-orange-600">${td.po}</span></div>
                        <div class="col-span-2">Item: <span class="text-slate-800">${td.namaItem} (${td.panjang})</span></div>
                    </div>
                </div>`;
        });
        tbody.innerHTML = h;
    } catch (e) { tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
}

function tutupModalSTBJ() { document.getElementById('modal-stbj-langsir').classList.add('hidden'); }

function saringTabelModalSTBJ() {
    const q = document.getElementById('f-stbj-modal').value.toLowerCase();
    document.querySelectorAll('.row-modal-stbj').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

async function bukaModalHold() {
    document.getElementById('modal-hold-langsir').classList.remove('hidden');
    const tbody = document.getElementById('tbody-hold-modal');
    tbody.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2"></i> Memuat Data Hold...</div>';
    lucide.createIcons();

    try {
        const { data, error } = await db.from('hold_langsir').select('*').order('created_at', {ascending: false});
        if(error) throw error;
        if(!data || data.length === 0) {
            tbody.innerHTML = '<div class="p-6 text-center font-bold text-slate-400">Tabel Hold Kosong.</div>';
            return;
        }

        let h = '';
        data.forEach((r, i) => {
            const tgl = new Date(r.created_at).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
            h += `
                <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 text-[13px] font-bold text-slate-600">
                    <div class="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1">
                        <span class="text-slate-400 text-xs">#${i+1} - ${tgl}</span>
                        <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] uppercase">Area: ${r.area}</span>
                    </div>
                    <div class="font-mono text-slate-900 break-all">${r.qrcode}</div>
                    <div class="mt-1">Troli: <span class="text-blue-600">${r.troli || '-'}</span></div>
                    <div class="text-rose-600 leading-tight">Ket: ${r.keterangan || '-'}</div>
                </div>`;
        });
        tbody.innerHTML = h;
    } catch (e) { tbody.innerHTML = `<div class="p-6 text-center font-bold text-red-500">Gagal Memuat: ${e.message}</div>`; }
}

function tutupModalHold() { document.getElementById('modal-hold-langsir').classList.add('hidden'); }
