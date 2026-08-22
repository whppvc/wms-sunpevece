let dataOpname = []; 
let deletedOpnameStack = []; 
let masterData = { area: [], kamus: [] };
let globalRowId = 0;

let currentSearchType = ''; 
let selectedSearchData = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

// Helper Format Panjang
function formatPanjang(pjg) {
    if (!pjg || pjg === '-') return '-';
    let str = String(pjg).trim().toUpperCase();
    if (!str.endsWith('M')) str += 'M';
    return str;
}

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'input_opname', title: 'INPUT STOK OPNAME', url: 'input_opname.html' }); 
    
    document.body.style.overflow = 'hidden';
    const wmsMain = document.querySelector('main');
    if(wmsMain) {
        wmsMain.style.overflow = 'hidden';
        wmsMain.style.padding = '0'; 
    }

    document.addEventListener('click', function(e) {
        const dropupMore = document.getElementById('dropup-more');
        if (dropupMore && !dropupMore.classList.contains('hidden') && !e.target.closest('.relative')) {
            dropupMore.classList.add('hidden');
        }
    });

    await loadMasterData();
});

window.toggleMoreMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropup-more');
    if(menu) menu.classList.toggle('hidden');
};

window.bukaModalAdd = function() {
    document.getElementById('input-qrcode').value = '';
    document.getElementById('modal-add-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qrcode').focus(), 100);
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
};

window.tutupPopups = function() {
    document.getElementById('modal-search').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
};

async function loadMasterData() {
    try {
        const [resM2, resArea] = await Promise.all([
            db.from('master_2').select('*'),
            db.from('master_area').select('*')
        ]);

        if(resM2.data) {
            masterData.kamus = resM2.data;
            if(!window.masterData) window.masterData = {};
            window.masterData.kamus = resM2.data; 
        }

        if(resArea.data) {
            masterData.area = [...new Set(resArea.data.map(r => r.nama_area || r.area).filter(x => x))].sort();
        }
    } catch (err) { console.error("Gagal muat referensi:", err); }
}

// ==========================================
// MODAL SEARCH AREA
// ==========================================
window.bukaModalSearch = function(type) {
    currentSearchType = type;
    document.getElementById('input-search-list').value = '';
    renderSearchList();
    document.getElementById('modal-search').classList.remove('hidden');
    document.getElementById('overlay-klik-luar').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-search-list').focus(), 100);
};

function renderSearchList() {
    const ul = document.getElementById('list-search-result');
    const dataArr = masterData[currentSearchType] || [];
    
    if(dataArr.length === 0) {
        ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold">Data kosong.</li>';
        return;
    }

    ul.innerHTML = dataArr.map(d => `
        <li onclick="selectSearchItem('${d}')" class="search-item p-3 border border-slate-200 rounded-lg cursor-pointer transition flex justify-between items-center active:bg-slate-200 active:border-slate-400">
            <span class="font-bold text-slate-700">${d}</span>
        </li>
    `).join('');
}

window.filterSearchList = function() {
    const q = document.getElementById('input-search-list').value.toLowerCase();
    document.querySelectorAll('.search-item').forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};

window.selectSearchItem = function(nama) {
    document.querySelectorAll('.search-item').forEach(li => li.classList.remove('bg-emerald-100', 'border-emerald-400'));
    event.currentTarget.classList.add('bg-emerald-100', 'border-emerald-400');
    selectedSearchData = nama;
};

window.pilihDataSearch = function() {
    if(!selectedSearchData) return alert("Pilih area dari daftar terlebih dahulu!");
    
    // REVISI: Update tombol text dan hidden input value
    document.getElementById('btn-pilih-area').innerText = selectedSearchData;
    document.getElementById('btn-pilih-area').classList.remove('text-slate-400');
    document.getElementById('btn-pilih-area').classList.add('text-slate-800');
    document.getElementById('input-area').value = selectedSearchData;
    
    document.getElementById('modal-search').classList.add('hidden');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    selectedSearchData = '';
};

// ==========================================
// LOGIKA SCAN & RENDER CARD
// ==========================================
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-scan') {
        e.preventDefault();
        const area = document.getElementById('input-area').value.trim();
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        
        if(!area) return alert("Pilih Area Penyimpanan terlebih dahulu!");
        if(!rawInput) return;

        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
        
        codes.forEach(code => {
            const isLocalDuplicate = dataOpname.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);
            
            dataOpname.unshift({ 
                id: ++globalRowId, 
                qrcode: code, 
                area: area, 
                status: 'BELUM CEK', 
                keterangan: isLocalDuplicate ? 'DUPLIKAT SCAN' : '-', 
                pic: currentUser.username, 
                isLocalDuplicate: isLocalDuplicate,
                ...trans 
            });
        });
        
        renderTable();
        
        inputEl.value = ''; 
        inputEl.focus();
        
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = 0; 
    }
});

function renderTable() {
    const tbody = document.getElementById('tbody-opname');
    if(dataOpname.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400 h-full flex flex-col items-center justify-center"><i data-lucide="box" class="w-12 h-12 mx-auto mb-3 opacity-30"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-tampil-baris').innerText = '0';
        lucide.createIcons(); return;
    }
    
    let html = '';
    let count = dataOpname.length;

    dataOpname.forEach((d) => {
        let badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
        let displayStatus = d.status;

        if(d.status === 'VALID') {
            badgeClass = "bg-emerald-600 text-white border-emerald-700"; 
        } 
        else if(['DUPLIKAT GUDANG', 'DUPLIKAT SCAN', 'FORMAT SALAH'].includes(d.status)) {
            badgeClass = "bg-red-600 text-white border-red-800"; 
        }

        if(d.status === 'BELUM CEK' && d.isLocalDuplicate) {
            badgeClass = "bg-red-600 text-white border-red-800";
            displayStatus = "DUPLIKAT SCAN";
        }

        const isRedHighlight = ['DUPLIKAT GUDANG', 'DUPLIKAT SCAN', 'FORMAT SALAH'].includes(d.status) || d.isLocalDuplicate;
        const rowClass = isRedHighlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-300';

        // REVISI: Font size spesifikasi item diperbesar (text-base)
        html += `
            <div class="row-opname ${rowClass} border rounded-xl p-4 mb-3 relative transition w-full flex flex-col shadow-sm">
                
                <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow-inner">${count--}</div>
                        <div class="flex flex-col">
                            <span class="font-black text-xl text-emerald-700 leading-none uppercase">${d.area}</span>
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Area Penyimpanan</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="checkbox" value="${d.id}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-5 h-5 accent-blue-600 rounded bg-white border-slate-400">
                        <button onclick="hapusBaris(${d.id})" class="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-rose-600 hover:text-white transition active:scale-95 shrink-0 border border-slate-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
                
                <div class="flex flex-col gap-1 mb-3">
                    <div class="font-mono font-black text-slate-900 text-base break-all leading-tight bg-slate-100 p-2 rounded-lg border border-slate-200 text-center">${d.qrcode}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-x-2 gap-y-3 mb-3">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Produksi</span>
                        <span class="text-sm font-bold text-slate-700">${d.tglProduksi} - ${d.mesin} - ${d.shift}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 uppercase">Customer Bawaan</span>
                        <span class="text-sm font-bold text-orange-600 uppercase">${d.customer}</span>
                    </div>
                    <div class="flex flex-col col-span-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span class="text-[10px] font-black text-blue-500 uppercase mb-0.5">Spesifikasi Item</span>
                        <span class="text-base font-black text-slate-900 leading-snug">
                            ${d.namaItem} - ${d.panjang} - ${d.grade} - ${d.dus}
                        </span>
                        <span class="text-xs font-bold text-blue-700 mt-0.5">Shading: ${d.shading}</span>
                    </div>
                </div>
                
                <div class="flex flex-row justify-between items-center mt-auto pt-2 border-t border-slate-100">
                    <span class="font-bold px-3 py-1.5 text-xs rounded-md border ${badgeClass} shadow-sm">${displayStatus}</span>
                    <span class="text-[10px] font-bold text-slate-400 uppercase">PIC: ${d.pic}</span>
                </div>
            </div>
        `;
    });
    tbody.innerHTML = html; 
    document.getElementById('lbl-tampil-baris').innerText = dataOpname.length;
    
    lucide.createIcons(); 
}

function highlightRow(cb) {
    const div = cb.closest('.row-opname');
    if (div) {
        if (cb.checked) div.classList.add('border-blue-500', 'bg-blue-50');
        else div.classList.remove('border-blue-500', 'bg-blue-50');
    }
}

function toggleAll(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('.row-opname');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    }); 
}

function hapusBaris(id) {
    const removed = dataOpname.find(d => d.id === id);
    if(removed) {
        deletedOpnameStack.push([removed]);
        dataOpname = dataOpname.filter(d => d.id !== id);
        renderTable();
    }
}

window.undoHapusOpname = function() {
    if(deletedOpnameStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedOpnameStack.pop();
    dataOpname = [...last, ...dataOpname]; 
    renderTable();
}

// ==========================================
// VERIFIKASI & SIMPAN
// ==========================================
window.verifikasiOpname = async function() {
    if(dataOpname.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-verifikasi'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Cek...'; btn.disabled = true;

    const allQRs = dataOpname.map(d => d.qrcode);
    try {
        const { data: resGlobal, error } = await db.from('stok_global').select('qrcode').in('qrcode', allQRs);
        if(error) throw error;

        const globalSet = new Set((resGlobal || []).map(d => d.qrcode));

        let infoDuplikat = 0;
        let infoFormatSalah = 0; 

        dataOpname.forEach(d => {
            let isFormatBad = (!d.mesin || d.mesin === '-' || !d.shift || d.shift === '-' || !d.customer || d.customer === '-' || !d.namaItem || d.namaItem === '-' || !d.panjang || d.panjang === '-' || !d.grade || d.grade === '-' || !d.dus || d.dus === '-');

            if (isFormatBad) {
                d.status = 'FORMAT SALAH';
                d.keterangan = 'Format QR Code tidak terbaca sempurna';
                infoFormatSalah++;
            } else if (globalSet.has(d.qrcode)) {
                d.status = 'DUPLIKAT GUDANG';
                d.keterangan = 'BARANG SUDAH ADA DI GUDANG (STOK GLOBAL)';
                infoDuplikat++;
            } else if (d.isLocalDuplicate) {
                // REVISI: Duplikat scan tetap merah dan tidak valid
                d.status = 'DUPLIKAT SCAN';
                d.keterangan = 'BARCODE DI-SCAN LEBIH DARI SEKALI DI LAYAR';
            } else {
                d.status = 'VALID';
            }
        });

        renderTable();

        let alertMsg = "Verifikasi Selesai!\n";
        if (infoFormatSalah > 0) alertMsg += `\n⚠️ Ditemukan ${infoFormatSalah} label dengan FORMAT SALAH (Rusak).`;
        if (infoDuplikat > 0) alertMsg += `\n⚠️ Ditemukan ${infoDuplikat} data DUPLIKAT di Gudang.`;
        if (infoFormatSalah === 0 && infoDuplikat === 0) alertMsg += "\n✅ Semua data UNIK dan VALID untuk disimpan.";
        
        alert(alertMsg);

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

window.simpanOpnameKeGudang = async function() {
    if(dataOpname.length === 0) return alert('Data kosong!');
    
    const validItems = dataOpname.filter(d => d.status === 'VALID');
    const invalidItems = dataOpname.filter(d => d.status !== 'VALID');

    if(validItems.length === 0) return alert('Tidak ada item berstatus VALID (Hijau) untuk disimpan. Pastikan Anda sudah melakukan Verifikasi.');

    const btn = document.getElementById('btn-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Proses...'; btn.disabled = true;

    try {
        let insertsGlobal = [];
        let mapAktual = {};

        validItems.forEach(d => {
            let pjgFormatted = formatPanjang(d.panjang);
            let id_sku = `${d.area}_${d.namaItem}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_-_${d.customer}_Aman`;

            insertsGlobal.push({
                qrcode: d.qrcode,
                area: d.area,
                id_sku: id_sku,
                tgl_produksi: d.tglProduksi,
                mesin: d.mesin,
                shift: d.shift,
                jenis_item: d.jenisItem,
                nama_item: d.namaItem,
                panjang: pjgFormatted,
                grade: d.grade,
                dus: d.dus,
                shading: d.shading,
                customer_aktual: d.customer,
                keterangan: '-',
                kondisi: 'Aman',
                pic_input: currentUser.username,
                jalur_masuk: 'opname'
            });

            let keyAkt = `${d.namaItem}_${pjgFormatted}_${d.grade}_${d.dus}_${d.shading}_${d.area}_${d.customer}`;
            if(!mapAktual[keyAkt]) {
                mapAktual[keyAkt] = {
                    id_sku: id_sku,
                    jenis_item: d.jenisItem, nama_item: d.namaItem, panjang: pjgFormatted,
                    grade: d.grade, dus: d.dus, shading: d.shading, area: d.area,
                    customer_aktual: d.customer, customer_estimasi: d.customer,
                    keterangan: '-', kondisi: 'Aman', qty: 0
                };
            }
            mapAktual[keyAkt].qty++;
        });

        // 1. Insert ke stok_global
        const { error: errGlobal } = await db.from('stok_global').insert(insertsGlobal);
        if(errGlobal) throw errGlobal;

        // 2. Insert ke stok_qr (sebagai backup fisik)
        const insertsStokQr = insertsGlobal.map(g => ({
            qrcode: g.qrcode, id_sku: g.id_sku, area: g.area, keterangan: g.keterangan
        }));
        await db.from('stok_qr').insert(insertsStokQr);

        // 3. Incremental Update ke stok_aktual
        for(let key in mapAktual) {
            let item = mapAktual[key];
            const { data: existing } = await db.from('stok_aktual').select('id, qty')
                .eq('nama_item', item.nama_item).eq('panjang', item.panjang).eq('grade', item.grade)
                .eq('dus', item.dus).eq('shading', item.shading).eq('area', item.area)
                .eq('customer_aktual', item.customer_aktual).eq('keterangan', item.keterangan)
                .is('konversi', null)
                .limit(1);
            
            if(existing && existing.length > 0) {
                await db.from('stok_aktual').update({ qty: existing[0].qty + item.qty }).eq('id', existing[0].id);
            } else {
                await db.from('stok_aktual').insert([item]);
            }
        }

        alert(`BERHASIL DISIMPAN!\n${validItems.length} Barang telah masuk ke Kartu Stok Gudang.`);
        
        // Sisakan item yang invalid di layar
        dataOpname = invalidItems; 
        renderTable();
        document.getElementById('cb-all').checked = false;
        
    } catch (err) { 
        alert('GAGAL MENYIMPAN: ' + err.message); 
    } finally { 
        btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); 
    }
        }
