let dataStbj = []; 
let deletedStbjStack = []; 
let masterKamus = [];
let globalRowId = 0;

// State Modal Search
let currentSearchType = ''; 
let selectedSearchData = '';

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin'};

document.addEventListener('DOMContentLoaded', async () => { 
    initModernLayout({ id: 'stbj', title: 'SCAN STBJ', url: 'stbj.html' }); 
    
    document.body.style.overflow = 'hidden';
    const wmsMain = document.querySelector('main');
    if(wmsMain) {
        wmsMain.style.overflow = 'hidden';
        wmsMain.style.padding = '0'; 
    }

    // Event listener untuk menutup dropup jika klik di luar
    document.addEventListener('click', function(e) {
        const dropupAdd = document.getElementById('dropup-add');
        const dropupMore = document.getElementById('dropup-more');
        
        if (dropupAdd && !dropupAdd.classList.contains('hidden') && !e.target.closest('.relative')) {
            dropupAdd.classList.add('hidden');
        }
        if (dropupMore && !dropupMore.classList.contains('hidden') && !e.target.closest('.relative')) {
            dropupMore.classList.add('hidden');
        }
    });

    await loadInitialSTBJData();
});

// Fungsi Toggle Dropup Add (+)
window.toggleAddMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropup-add');
    const moreMenu = document.getElementById('dropup-more');
    if(moreMenu) moreMenu.classList.add('hidden'); // Tutup menu lain
    if(menu) menu.classList.toggle('hidden');
};

// Fungsi Toggle Dropup Lainnya
window.toggleMoreMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('dropup-more');
    const addMenu = document.getElementById('dropup-add');
    if(addMenu) addMenu.classList.add('hidden'); // Tutup menu lain
    if(menu) menu.classList.toggle('hidden');
};

window.bukaModalAdd = function() {
    document.getElementById('modal-add-scan').classList.remove('hidden');
    setTimeout(() => document.getElementById('input-qrcode').focus(), 100);
};

window.tutupModalAdd = function() {
    document.getElementById('modal-add-scan').classList.add('hidden');
};

// ==========================================
// LOGIKA INPUT MANUAL
// ==========================================
window.bukaModalManual = function() {
    document.getElementById('m-tgl').valueAsDate = new Date();
    document.getElementById('modal-manual').classList.remove('hidden');
};

window.tutupModalManual = function() {
    document.getElementById('modal-manual').classList.add('hidden');
};

window.bukaModalSearch = function(type) {
    currentSearchType = type;
    const titleMap = { 'item': 'Nama Item', 'mesin': 'Mesin', 'customer': 'Customer', 'panjang': 'Panjang', 'dus': 'Dus / Merk' };
    document.getElementById('title-modal-search').innerText = `Cari ${titleMap[type]}`;
    
    document.getElementById('input-search-list').value = '';
    renderSearchList();

    document.getElementById('modal-search').classList.remove('hidden');
};

function renderSearchList() {
    const ul = document.getElementById('list-search-result');
    const dataArr = window.masterData[currentSearchType] || [];
    
    if(dataArr.length === 0) {
        ul.innerHTML = '<li class="p-4 text-center text-slate-400 font-bold">Data kosong.</li>';
        return;
    }

    ul.innerHTML = dataArr.map(d => `
        <li onclick="selectSearchItem('${d}')" class="search-item p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition flex justify-between items-center group">
            <span class="font-bold text-slate-700 group-hover:text-purple-700">${d}</span>
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
    document.querySelectorAll('.search-item').forEach(li => li.classList.remove('bg-purple-100', 'border-purple-400'));
    event.currentTarget.classList.add('bg-purple-100', 'border-purple-400');
    selectedSearchData = nama;
};

window.pilihDataSearch = function() {
    if(!selectedSearchData) return alert("Pilih data dari daftar terlebih dahulu!");
    
    let inputId = `m-${currentSearchType}`;
    let el = document.getElementById(inputId);
    
    if(el) el.value = selectedSearchData;
    
    document.getElementById('modal-search').classList.add('hidden');
    selectedSearchData = '';
};

window.simpanManual = async function() {
    let tgl = document.getElementById('m-tgl').value;
    let mesin = document.getElementById('m-mesin').value.trim().toUpperCase();
    let shift = document.getElementById('m-shift').value;
    let item = document.getElementById('m-item').value.trim().toUpperCase();
    let panjangRaw = document.getElementById('m-panjang').value.trim().toUpperCase();
    let grade = document.getElementById('m-grade').value;
    let dus = document.getElementById('m-dus').value.trim().toUpperCase();
    let shading = document.getElementById('m-shading').value.trim().toUpperCase();
    let customer = document.getElementById('m-customer').value.trim().toUpperCase();
    let ket = document.getElementById('m-ket').value.trim();
    let qty = parseInt(document.getElementById('m-qty').value);

    if(!tgl || !item || !panjangRaw || isNaN(qty) || qty < 1) {
        return alert("Tanggal, Nama Item, Panjang, dan Qty wajib diisi!");
    }

    let panjangFinal = panjangRaw.endsWith('M') ? panjangRaw : panjangRaw + "M";

    const btn = document.getElementById('btn-simpan-manual');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const payload = {
            tgl_produksi: tgl,
            mesin: mesin || '-',
            shift: shift || '-',
            nama_item: item,
            panjang: panjangFinal,
            grade: grade || '-',
            dus: dus || '-',
            shading: shading || '-',
            customer: customer || '-',
            keterangan: ket || '-',
            qty: qty.toString()
        };

        const { error } = await db.from('stbj_manual').insert([payload]);
        if(error) throw error;

        // Reset form parsial
        document.getElementById('m-item').value = "";
        document.getElementById('m-panjang').value = "";
        document.getElementById('m-shading').value = "";
        document.getElementById('m-qty').value = "1";
        
        tutupModalManual();
        alert("Data manual berhasil disimpan ke database!");
    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};

async function loadInitialSTBJData() {
    try {
        // 1. Muat data Kamus Item dari master_2
        const { data: mData2 } = await db.from('master_2').select('*');
        if(mData2) {
            masterKamus = mData2;
            if(!window.masterData) window.masterData = {};
            
            let getUnique = (key) => [...new Set(mData2.map(r => r[key]).filter(x => x))].sort();
            
            window.masterData.mesin = getUnique('mesin');
            window.masterData.shift = getUnique('shift');
            window.masterData.item = getUnique('nama_item');
            window.masterData.panjang = getUnique('panjang');
            window.masterData.grade = getUnique('grade');
            window.masterData.dus = getUnique('dus');
            window.masterData.customer = getUnique('customer');

            // Isi Select Biasa (Shift, Grade)
            const fillSelect = (id, arr) => {
                let sel = document.getElementById(id);
                if(sel) {
                    sel.innerHTML = '<option value="">-- Pilih --</option>';
                    arr.forEach(val => sel.innerHTML += `<option value="${val}">${val}</option>`);
                }
            };
            fillSelect('m-shift', window.masterData.shift);
            fillSelect('m-grade', window.masterData.grade);
        }

        // 2. Muat Katalog Nama Jasper dari Supabase
        const { data: mJasper, error: errJasper } = await db.from('nama_jasper').select('*');
        if(!errJasper && mJasper) {
            if(!window.masterData) window.masterData = {};
            window.masterData.jasper = mJasper;
        }
    } catch (err) { console.error("Gagal muat referensi:", err); }
}

// Menggunakan Event Delegation agar tidak putus saat layout dirender ulang
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'form-scan') {
        e.preventDefault();
        const inputEl = document.getElementById('input-qrcode');
        const rawInput = inputEl.value.trim();
        
        if(!rawInput) return;

        // Mendukung pemisahan dengan spasi, enter, atau titik koma
        const codes = rawInput.split(/[\r\n; ]+/).map(q => q.trim()).filter(q => q);
        
        codes.forEach(code => {
            const isLocalDuplicate = dataStbj.some(d => d.qrcode === code);
            const trans = window.translateBarcode(code);
            
            dataStbj.push({ 
                id: ++globalRowId, 
                qrcode: code, 
                troli: '-', // Default troli karena sudah tidak diinput
                status: 'BELUM CEK', 
                keterangan: isLocalDuplicate ? 'DUPLIKAT SCAN' : '', 
                pic: currentUser.username, 
                isLocalDuplicate: isLocalDuplicate,
                ...trans 
            });
        });
        
        renderTable();
        
        inputEl.value = ''; 
        inputEl.focus();
        
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
});

function renderTable() {
    const tbody = document.getElementById('tbody-stbj');
    if(dataStbj.length === 0) {
        tbody.innerHTML = '<div class="p-10 text-center font-medium text-slate-400"><i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> Belum ada data di-scan.</div>';
        document.getElementById('lbl-tampil-baris').innerText = '0';
        updateFilterDropdowns(); 
        lucide.createIcons(); return;
    }
    
    let html = '';
    let count = 1;

    dataStbj.forEach((d) => {
        let badgeClass = "bg-slate-200 text-slate-700 border-slate-300";
        let displayStatus = d.status;

        if(d.status === 'BELUM STBJ') {
            badgeClass = "bg-emerald-600 text-white border-emerald-700"; 
        } 
        else if(['RETUR', 'STBJ', 'SUDAH STBJ', 'HOLD STBJ', 'IN GUDANG', 'HOLD LANGSIR', 'DUPLIKAT SCAN', 'FORMAT SALAH'].includes(d.status)) {
            badgeClass = "bg-red-600 text-white border-red-800"; 
        }
        else if(d.status === 'HOLD') {
            badgeClass = "bg-amber-500 text-white border-amber-600";
        }

        if(d.status === 'BELUM CEK' && d.isLocalDuplicate) {
            badgeClass = "bg-red-600 text-white border-red-800";
            displayStatus = "DUPLIKAT SCAN";
        }

        const isRedHighlight = ['RETUR', 'STBJ', 'SUDAH STBJ', 'HOLD STBJ', 'IN GUDANG', 'HOLD LANGSIR', 'DUPLIKAT SCAN', 'FORMAT SALAH'].includes(d.status) || d.isLocalDuplicate;
        const rowClass = isRedHighlight ? 'bg-red-50 hover:bg-red-100' : (d.status === 'HOLD' ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-slate-50');

        html += `
            <div class="row-stbj ${rowClass} border-b border-slate-300 p-2.5 relative transition w-full flex shrink-0">
                <div class="flex flex-col items-center justify-start pr-2 mr-2 border-r border-slate-300 w-10 shrink-0 pt-1">
                    <div class="font-black text-slate-800 text-xl mb-3 leading-none no-cell">${count++}</div>
                    <input type="checkbox" value="${d.id}" onchange="highlightRow(this)" class="row-cb cursor-pointer w-4 h-4 accent-blue-600 rounded bg-white border-slate-400">
                </div>
                
                <div class="flex-1 flex flex-col gap-0 w-full min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <div class="font-black text-[22px] text-emerald-700 leading-none col-troli">${d.troli || '-'}</div>
                        <button onclick="hapusBaris(${d.id})" class="bg-slate-700 text-white p-1.5 rounded hover:bg-rose-600 transition active:scale-95 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                    
                    <div class="font-mono font-black text-slate-900 text-[13px] break-all leading-tight col-qr">${d.qrcode}</div>
                    
                    <div class="text-[12px] font-bold text-slate-600 tracking-tight">
                        <span class="col-tgl">${d.tglProduksi}</span> - <span class="col-mesin">${d.mesin}</span> - <span class="col-shift">${d.shift}</span>
                    </div>
                    
                    <div class="text-[13px] font-black text-slate-900 leading-snug my-0.5">
                        <span class="col-nama">${d.namaItem}</span> - <span class="col-pjg">${d.panjang}</span> - <span class="col-grade">${d.grade}</span> - <span class="col-dus">${d.dus}</span>
                        <span class="col-jenis hidden">${d.jenisItem}</span>
                    </div>
                    
                    <div class="text-[12px] font-bold text-blue-600 col-shading">${d.shading}</div>
                    <div class="text-[12px] font-bold text-orange-600 col-customer uppercase">${d.customer}</div>
                    
                    <div class="mt-1.5 mb-1">
                        <input type="text" onchange="updateKet(${d.id}, this.value)" value="${d.keterangan}" class="w-full p-1.5 text-[11px] font-bold border border-slate-300 rounded outline-none focus:border-blue-500 bg-white/80 col-ket" placeholder="Keterangan...">
                    </div>
                    
                    <div class="flex flex-row flex-wrap items-center gap-1.5 mt-0.5">
                        <span class="font-bold px-3 py-1 text-[10px] rounded-sm border col-status ${badgeClass}">${displayStatus}</span>
                    </div>
                </div>
            </div>
        `;
    });
    tbody.innerHTML = html; 
    document.getElementById('lbl-tampil-baris').innerText = dataStbj.length;
    
    updateFilterDropdowns(); 
    lucide.createIcons(); 
}

function updateFilterDropdowns() {
    const fields = {
        'fs-status': 'statusUI', 
        'fs-troli': 'troli',
        'fs-tgl': 'tglProduksi',
        'fs-mesin': 'mesin',
        'fs-shift': 'shift',
        'fs-jenis': 'jenisItem',
        'fs-nama': 'namaItem',
        'fs-pjg': 'panjang',
        'fs-grade': 'grade',
        'fs-dus': 'dus',
        'fs-shading': 'shading',
        'fs-customer': 'customer'
    };

    for (let id in fields) {
        const select = document.getElementById(id);
        if (!select) continue;
        
        const currentVal = select.value; 
        const key = fields[id];
        
        let uniqueVals = [];
        if (key === 'statusUI') {
            uniqueVals = [...new Set(dataStbj.map(d => {
                if(d.status === 'BELUM CEK' && d.isLocalDuplicate) return 'DUPLIKAT SCAN';
                return d.status;
            }))].sort();
        } else {
            uniqueVals = [...new Set(dataStbj.map(item => item[key] || '-'))].sort();
        }
        
        let html = '<option value="">-- Semua --</option>';
        uniqueVals.forEach(val => {
            html += `<option value="${val}">${val}</option>`;
        });
        
        select.innerHTML = html;
        
        if (uniqueVals.includes(currentVal)) {
            select.value = currentVal;
        }
    }
}

function highlightRow(cb) {
    const div = cb.closest('.row-stbj');
    if (div) {
        if (cb.checked) div.classList.add('selected-row');
        else div.classList.remove('selected-row');
    }
}

function toggleAll(checked) { 
    document.querySelectorAll('.row-cb').forEach(cb => {
        const row = cb.closest('.row-stbj');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
            highlightRow(cb);
        }
    }); 
}

function getCheckedIds() {
    const ids = []; document.querySelectorAll('.row-cb:checked').forEach(cb => ids.push(parseInt(cb.value))); return ids;
}

function hapusBaris(id) {
    const removed = dataStbj.find(d => d.id === id);
    if(removed) {
        deletedStbjStack.push([removed]);
        dataStbj = dataStbj.filter(d => d.id !== id);
        renderTable();
    }
}

window.undoHapusSTBJ = function() {
    if(deletedStbjStack.length === 0) return alert("Tidak ada histori penghapusan yang dapat di-undo.");
    const last = deletedStbjStack.pop();
    dataStbj = [...dataStbj, ...last]; 
    renderTable();
}

window.holdManual = function() {
    const ids = getCheckedIds(); if(ids.length === 0) return alert("Centang baris yang ingin di-HOLD manual!");
    dataStbj.forEach(d => { if(ids.includes(d.id)) { d.status = 'HOLD'; d.keterangan = 'Dihold Manual'; } });
    renderTable(); document.querySelector('#cb-all').checked = false;
}

function updateKet(id, val) { const item = dataStbj.find(d => d.id === id); if(item) item.keterangan = val; }

window.toggleSidebarFilter = function() {
    document.getElementById('sidebar-filter').classList.toggle('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.toggle('hidden');
}

window.tutupPopups = function() {
    document.getElementById('sidebar-filter').classList.add('translate-x-full');
    document.getElementById('overlay-klik-luar').classList.add('hidden');
    window.tutupModalAdd();
    window.tutupModalManual();
    document.getElementById('modal-search').classList.add('hidden');
}

window.resetFilterSTBJ = function() {
    const ids = ['fs-status','fs-troli','fs-qr','fs-tgl','fs-mesin','fs-shift','fs-jenis','fs-nama','fs-pjg','fs-grade','fs-dus','fs-shading','fs-customer','fs-ket'];
    ids.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    window.saringTabelSTBJ(); window.toggleSidebarFilter();
}

window.saringTabelSTBJ = function() {
    const f = {
        status: document.getElementById('fs-status')?.value || '',
        troli: document.getElementById('fs-troli')?.value || '',
        qr: document.getElementById('fs-qr')?.value.toLowerCase() || '',
        tgl: document.getElementById('fs-tgl')?.value || '',
        mesin: document.getElementById('fs-mesin')?.value || '',
        shift: document.getElementById('fs-shift')?.value || '',
        jenis: document.getElementById('fs-jenis')?.value || '',
        nama: document.getElementById('fs-nama')?.value || '',
        pjg: document.getElementById('fs-pjg')?.value || '',
        grade: document.getElementById('fs-grade')?.value || '',
        dus: document.getElementById('fs-dus')?.value || '',
        shading: document.getElementById('fs-shading')?.value || '',
        customer: document.getElementById('fs-customer')?.value || '',
        ket: document.getElementById('fs-ket')?.value.toLowerCase() || ''
    };

    let visibleCount = 0;
    document.querySelectorAll('.row-stbj').forEach(row => {
        let show = true;
        
        const exactFields = ['status', 'troli', 'tgl', 'mesin', 'shift', 'jenis', 'nama', 'pjg', 'grade', 'dus', 'shading', 'customer'];
        for(let key of exactFields) {
            if(f[key]) {
                const cell = row.querySelector('.col-' + key);
                if(cell) {
                    let text = cell.innerText.trim();
                    if(text !== f[key]) { show = false; break; }
                }
            }
        }

        if(show && f.qr) {
            const cell = row.querySelector('.col-qr');
            if(cell && !cell.innerText.toLowerCase().includes(f.qr)) show = false;
        }
        if(show && f.ket) {
            const cell = row.querySelector('.col-ket');
            if(cell) {
                let inputEl = cell.querySelector('input');
                let text = inputEl ? inputEl.value.toLowerCase() : cell.innerText.toLowerCase();
                if(!text.includes(f.ket)) show = false;
            }
        }

        row.style.display = show ? 'flex' : 'none';
        if(show) visibleCount++;
    });
    document.getElementById('lbl-tampil-baris').innerText = visibleCount;
}

window.cekGudangSTBJ = async function() {
    if(dataStbj.length === 0) return alert("Belum ada data.");
    const btn = document.getElementById('btn-cek-gudang'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Cek...'; btn.disabled = true;

    const allQRs = dataStbj.map(d => d.qrcode);
    try {
        const [resGlobal, resHasil] = await Promise.all([
            db.from('stok_global').select('qrcode, jalur_masuk').in('qrcode', allQRs),
            db.from('hasil_stbj_langsir').select('qrcode, status').in('qrcode', allQRs)
        ]);

        if(resGlobal.error) throw resGlobal.error;
        if(resHasil.error) throw resHasil.error;

        const globalMap = {}; resGlobal.data.forEach(d => globalMap[d.qrcode] = d);
        const hasilMap = {}; resHasil.data.forEach(d => hasilMap[d.qrcode] = d);

        let infoDuplikat = 0;
        let infoFormatSalah = 0; 

        dataStbj.forEach(d => {
            if(d.status === 'HOLD' && d.keterangan === 'Dihold Manual') return; 
            
            let isFormatBad = (!d.mesin || d.mesin === '-' || !d.shift || d.shift === '-' || !d.customer || d.customer === '-' || !d.namaItem || d.namaItem === '-' || !d.panjang || d.panjang === '-' || !d.grade || d.grade === '-' || !d.dus || d.dus === '-');

            let existsInGlobal = !!globalMap[d.qrcode];
            let isRetur = existsInGlobal && (globalMap[d.qrcode].jalur_masuk || '').toLowerCase() === 'retur';

            if (isFormatBad) {
                d.status = 'FORMAT SALAH';
                d.keterangan = 'Format QR Code tidak terbaca sempurna (Label Rusak)';
                infoFormatSalah++;
            } else if (isRetur) {
                d.status = 'RETUR';
                d.keterangan = 'BARANG RETUR DARI GLOBAL';
                infoDuplikat++;
            } else if (existsInGlobal) {
                d.status = 'IN GUDANG';
                d.keterangan = 'BARANG SUDAH ADA DI GUDANG (STOK GLOBAL)';
                infoDuplikat++;
            } else if (hasilMap[d.qrcode]) {
                let statDB = hasilMap[d.qrcode].status;
                if (statDB === 'STBJ' || statDB === 'SUDAH STBJ') {
                    d.status = 'SUDAH STBJ';
                    d.keterangan = 'SUDAH ADA DI DATABASE (STBJ)';
                } else {
                    d.status = statDB; 
                    d.keterangan = `SUDAH ADA DI DATABASE (${statDB})`;
                }
                infoDuplikat++;
            } else if (d.isLocalDuplicate) {
                d.status = 'DUPLIKAT SCAN';
            } else {
                d.status = 'BELUM STBJ';
            }
        });

        renderTable();

        let alertMsg = "Verifikasi Selesai!\n";
        if (infoFormatSalah > 0) alertMsg += `\n⚠️ Ditemukan ${infoFormatSalah} label dengan FORMAT SALAH (Rusak).`;
        if (infoDuplikat > 0) alertMsg += `\n⚠️ Ditemukan ${infoDuplikat} data DUPLIKAT / RETUR.`;
        if (infoFormatSalah === 0 && infoDuplikat === 0) alertMsg += "\n✅ Semua data UNIK (Belum STBJ) dan aman untuk disimpan.";
        
        alert(alertMsg);

    } catch (err) { alert("Gagal cek database: " + err.message); }
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}

window.saveToDatabaseSTBJ = async function() {
    if(dataStbj.length === 0) return alert('Data kosong!');
    const blmCek = dataStbj.filter(d => d.status === 'BELUM CEK');
    if(blmCek.length > 0) return alert('Tekan tombol Verifikasi Kode terlebih dahulu sebelum menyimpan!');

    const btn = document.getElementById('btn-save'); const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 sm:w-5 sm:h-5"></i> Proses...'; btn.disabled = true;

    const UNIKs = dataStbj.filter(d => d.status === 'BELUM STBJ');
    const dupes = dataStbj.filter(d => d.status !== 'BELUM STBJ' && d.status !== 'BELUM CEK');

    const mapToDB = (d, finalStatus) => {
        let jName = `JAS-${d.namaItem}`;
        if (window.masterData && window.masterData.jasper) {
            const cJasper = window.masterData.jasper.find(j => 
                (j.nama_item || '').trim().toUpperCase() === (d.namaItem || '').trim().toUpperCase() && 
                (j.panjang || '').trim().toUpperCase() === (d.panjang || '').trim().toUpperCase() && 
                (j.grade || '').trim().toUpperCase() === (d.grade || '').trim().toUpperCase()
            );
            if (cJasper) jName = cJasper.nama_jasper;
        }

        return {
            troli: d.troli,
            qrcode: d.qrcode,
            tgl_produksi: d.tglProduksi,
            shift: d.shift,
            mesin: d.mesin,
            jenis_item: d.jenisItem, 
            nama_item: d.namaItem,
            nama_jasper: jName, 
            panjang: d.panjang,
            grade: d.grade,
            dus: d.dus,
            shading: d.shading,
            customer: d.customer, 
            keterangan: d.keterangan || '-',
            status: finalStatus,
            pic_input: d.pic,
            created_at: new Date().toISOString() 
        };
    };

    try {
        let payload = [];
        UNIKs.forEach(d => payload.push(mapToDB(d, 'STBJ')));
        dupes.forEach(d => payload.push(mapToDB(d, 'HOLD STBJ')));

        if(payload.length > 0) {
            const { error } = await db.from('hasil_stbj_langsir').upsert(payload, { onConflict: 'qrcode' });
            if(error) throw error;
        }

        alert(`BERHASIL DISIMPAN!\n- ${UNIKs.length} Barang UNIK (STBJ)\n- ${dupes.length} Barang Hold/Duplikat/Format Salah (HOLD STBJ)`);
        dataStbj = []; renderTable();
        document.getElementById('cb-all').checked = false;
        
        if(typeof window.tutupModalAdd === 'function') window.tutupModalAdd();
        
    } catch (err) { alert('GAGAL MENYIMPAN: ' + err.message); } 
    finally { btn.innerHTML = ori; btn.disabled = false; lucide.createIcons(); }
}
