let currentPIC = "";
let currentTab = "pic"; // 'pic' atau 'all'

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'input_opname', title: 'INPUT STOK OPNAME', url: 'input_opname.html' });
    document.getElementById('o-tgl').valueAsDate = new Date();
    lucide.createIcons();
    
    // Tampilkan modal login saat pertama kali buka
    document.getElementById('modal-login-opname').classList.remove('hidden');
});

window.loginOpname = async function() {
    let pic = document.getElementById('input-opname-pic').value.trim().toUpperCase();
    let pass = document.getElementById('input-opname-pass').value;

    if(!pic) return alert("Nama PIC wajib diisi!");
    if(pass !== "1111") return alert("Password/PIN Salah!");

    currentPIC = pic;
    document.getElementById('lbl-pic-aktif').innerText = "PIC: " + currentPIC;
    document.getElementById('modal-login-opname').classList.add('hidden');

    await loadMasterData();
    loadDataOpname();
};

window.logoutOpname = function() {
    currentPIC = "";
    document.getElementById('input-opname-pic').value = "";
    document.getElementById('input-opname-pass').value = "";
    document.getElementById('modal-login-opname').classList.remove('hidden');
};

window.switchTab = function(tab) {
    currentTab = tab;
    const activeClass = 'px-6 py-3.5 tab-active transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    const inactiveClass = 'px-6 py-3.5 tab-inactive hover:bg-slate-50 transition whitespace-nowrap flex items-center gap-2 text-xs uppercase';
    
    document.getElementById('tab-pic').className = tab === 'pic' ? activeClass : inactiveClass;
    document.getElementById('tab-all').className = tab === 'all' ? activeClass : inactiveClass;
    
    loadDataOpname();
};

async function loadMasterData() {
    try {
        const { data: mData2 } = await db.from('master_2').select('*');
        const { data: mArea } = await db.from('master_area').select('*');

        const fillDatalist = (id, arr) => {
            let dl = document.getElementById(id);
            if(!dl) return;
            dl.innerHTML = '';
            arr.forEach(val => { dl.innerHTML += `<option value="${val}">`; });
        };

        if(mData2) {
            let getUnique = (key) => [...new Set(mData2.map(r => r[key]).filter(x => x))].sort();
            fillDatalist('dl-mesin', getUnique('mesin'));
            fillDatalist('dl-shift', getUnique('shift'));
            fillDatalist('dl-item', getUnique('nama_item'));
            fillDatalist('dl-grade', getUnique('grade'));
            fillDatalist('dl-dus', getUnique('dus'));
            fillDatalist('dl-po', getUnique('customer'));
        }

        if(mArea) {
            let areas = [...new Set(mArea.map(r => r.nama_area || r.area).filter(x => x))].sort();
            fillDatalist('dl-area', areas);
        }
    } catch(e) { console.error("Gagal load master:", e); }
}

window.loadDataOpname = async function() {
    const tbody = document.getElementById('tbody-opname');
    tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-slate-400"></i><p class="font-bold text-slate-400 text-sm">Memuat data...</p></td></tr>';
    lucide.createIcons();

    try {
        let query = db.from('database_gudang').select('*').order('created_at', { ascending: false }).limit(200);
        if (currentTab === 'pic') query = query.eq('pic', currentPIC);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center font-bold text-slate-400">Belum ada data.</td></tr>';
            return;
        }

        let html = '';
        data.forEach((r, i) => {
            html += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 transition bg-white even:bg-slate-50">
                    <td class="p-3 font-bold text-slate-400">${i+1}</td>
                    <td class="p-3 font-medium text-slate-600">${r.tgl_produksii || '-'}</td>
                    <td class="p-3 font-bold text-emerald-700">${r.area || '-'}</td>
                    <td class="p-3 font-medium text-slate-600">${r.mesin || '-'}</td>
                    <td class="p-3 font-medium text-slate-600">${r.shift || '-'}</td>
                    <td class="p-3 font-medium text-slate-700">${r.jenis_item || '-'}</td>
                    <td class="p-3 font-bold text-slate-800">${r.nama_item || '-'}</td>
                    <td class="p-3 font-medium text-slate-700">${r.panjang || '-'}</td>
                    <td class="p-3 font-medium text-slate-700">${r.grade || '-'}</td>
                    <td class="p-3 font-medium text-slate-700">${r.dus || '-'}</td>
                    <td class="p-3 font-medium text-slate-700">${r.shading || '-'}</td>
                    <td class="p-3 font-semibold text-orange-600">${r.customer || '-'}</td>
                    <td class="p-3 font-black text-amber-600 bg-amber-50">${r.qty_print || 0}</td>
                    <td class="p-3 font-bold text-slate-400 text-xs uppercase">${r.pic || '-'}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="14" class="p-5 text-center text-red-500 font-bold">Gagal: ${e.message}</td></tr>`;
    }
};

window.simpanOpname = async function() {
    let tgl = document.getElementById('o-tgl').value;
    let area = document.getElementById('o-area').value.trim().toUpperCase();
    let mesin = document.getElementById('o-mesin').value.trim().toUpperCase();
    let shift = document.getElementById('o-shift').value.trim().toUpperCase();
    let jenis = document.getElementById('o-jenis').value;
    let item = document.getElementById('o-item').value.trim().toUpperCase();
    let panjangRaw = document.getElementById('o-panjang').value.trim().toUpperCase();
    let grade = document.getElementById('o-grade').value.trim().toUpperCase();
    let dus = document.getElementById('o-dus').value.trim().toUpperCase();
    let shading = document.getElementById('o-shading').value.trim().toUpperCase();
    let po = document.getElementById('o-po').value.trim().toUpperCase();
    let qty = parseInt(document.getElementById('o-qty').value);

    if(!tgl || !area || !jenis || !item || !panjangRaw || isNaN(qty) || qty < 1) {
        return alert("Tanggal, Area, Jenis, Nama Item, Panjang, dan Qty wajib diisi dengan benar!");
    }

    let panjangFinal = panjangRaw.endsWith('M') ? panjangRaw : panjangRaw + "M";

    const btn = document.getElementById('btn-simpan-opname');
    const ori = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const payload = {
            tgl_produksii: tgl,
            mesin: mesin || '-',
            shift: shift || '-',
            area: area,
            jenis_item: jenis,
            nama_item: item,
            panjang: panjangFinal,
            grade: grade || '-',
            dus: dus || '-',
            shading: shading || '-',
            customer: po || '-',
            qty_print: qty,
            pic: currentPIC,
            kode_barcode: `OPNAME_${new Date().getTime()}` // Fake barcode for opname
        };

        const { error } = await db.from('database_gudang').insert([payload]);
        if(error) throw error;

        // Reset form parsial
        document.getElementById('o-item').value = "";
        document.getElementById('o-panjang').value = "";
        document.getElementById('o-shading').value = "";
        document.getElementById('o-qty').value = "1";
        
        document.getElementById('o-item').focus();

        loadDataOpname();
    } catch(e) {
        alert("Gagal menyimpan: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
};
