let currentCategory = '';
let tableData = [];
let deletedIds = []; // Menyimpan ID yang dihapus oleh Creator

const currentUser = JSON.parse(localStorage.getItem('user_session')) || {username: 'Admin', role: 'admin'};
const isCreator = (currentUser.role || '').toLowerCase() === 'creator';

// Konfigurasi Kolom untuk masing-masing tabel
const CONFIG = {
    'variabel': {
        table: 'master_2',
        title: 'VARIABEL & KODE',
        icon: 'book-open',
        cols: [
            { key: 'kode_nama_item', label: 'Kode Item' },
            { key: 'nama_item', label: 'Nama Item Asli' },
            { key: 'kode_dus', label: 'Kode Dus' },
            { key: 'dus', label: 'Dus Asli' },
            { key: 'kode_mesin', label: 'Kode Mesin' },
            { key: 'mesin', label: 'Mesin Asli' },
            { key: 'kode_shift', label: 'Kode Shift' },
            { key: 'shift', label: 'Shift Asli' },
            { key: 'kode_po', label: 'Kode PO' },
            { key: 'po', label: 'PO Asli' }
        ]
    },
    'jasper': {
        table: 'nama_jasper',
        title: 'NAMA JASPER',
        icon: 'file-text',
        cols: [
            { key: 'nama_item', label: 'Nama Item (WMS)' },
            { key: 'panjang', label: 'Panjang' },
            { key: 'grade', label: 'Grade' },
            { key: 'nama_jasper', label: 'Nama Output Jasper' }
        ]
    },
    'area': {
        table: 'master_area',
        title: 'MASTER AREA',
        icon: 'map',
        cols: [
            { key: 'nama_area', label: 'Nama Area Gudang' }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initModernLayout({ id: 'master_data', title: 'MASTER DATA', url: 'master_data.html' });
});

function kembaliKeMenu() {
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('view-table').classList.add('hidden');
    document.getElementById('footer-action').classList.add('hidden');
    document.getElementById('btn-back').classList.add('hidden');
    
    document.getElementById('title-bar').innerHTML = `<i data-lucide="layout-grid" class="w-4 h-4"></i> MENU MASTER DATA`;
    lucide.createIcons();
}

async function bukaTabel(kategori) {
    currentCategory = kategori;
    const conf = CONFIG[kategori];
    
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-table').classList.remove('hidden');
    document.getElementById('footer-action').classList.remove('hidden');
    document.getElementById('btn-back').classList.remove('hidden');
    
    document.getElementById('title-bar').innerHTML = `<i data-lucide="${conf.icon}" class="w-4 h-4"></i> TABEL: ${conf.title}`;
    
    deletedIds = []; // Reset antrean hapus
    await fetchTableData();
}

async function fetchTableData() {
    const conf = CONFIG[currentCategory];
    const tbody = document.getElementById('tbody-master');
    const thead = document.getElementById('thead-master');
    
    // Render Header
    let thHtml = `<tr><th class="hdr-std w-12">No</th>`;
    conf.cols.forEach(c => { thHtml += `<th class="hdr-std">${c.label}</th>`; });
    if (isCreator) thHtml += `<th class="hdr-std w-12 bg-rose-900 text-white"><i data-lucide="trash-2" class="w-4 h-4 mx-auto"></i></th>`;
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;

    tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 2}" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500"></i> Memuat Data...</td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from(conf.table).select('*').order('id', { ascending: true });
        if (error) throw error;
        
        tableData = data || [];
        renderTableBody();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 2}" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`;
    }
}

function renderTableBody() {
    const conf = CONFIG[currentCategory];
    const tbody = document.getElementById('tbody-master');
    
    // Filter data yang tidak dihapus secara lokal
    const visibleData = tableData.filter(d => !d._isDeleted);
    document.getElementById('lbl-total-baris').innerText = visibleData.length;

    if (visibleData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 2}" class="p-10 text-center text-slate-400 font-bold">Tabel Kosong. Klik "Tambah Baris Baru" di bawah.</td></tr>`;
        return;
    }

    let html = '';
    visibleData.forEach((row, index) => {
        // Cari index asli di array tableData
        const originalIndex = tableData.findIndex(d => d === row);
        
        html += `<tr class="border-b border-slate-200 hover:bg-slate-50 transition">
            <td class="p-2 font-bold text-slate-400 bg-slate-50 border-r border-slate-200">${index + 1}</td>`;
        
        conf.cols.forEach(c => {
            let val = row[c.key] || '';
            html += `<td class="p-0 border-r border-slate-200">
                <input type="text" value="${val}" onchange="updateCell(${originalIndex}, '${c.key}', this.value)" class="excel-input uppercase" placeholder="-">
            </td>`;
        });

        if (isCreator) {
            html += `<td class="p-2 bg-rose-50/30">
                <button onclick="hapusBaris(${originalIndex})" class="p-1.5 bg-white border border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white rounded shadow-sm transition mx-auto block active:scale-95">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>`;
        }
        html += `</tr>`;
    });

    tbody.innerHTML = html;
    lucide.createIcons();
}

function updateCell(index, key, value) {
    tableData[index][key] = value.trim().toUpperCase();
}

function tambahBarisKosong() {
    let newRow = {};
    CONFIG[currentCategory].cols.forEach(c => newRow[c.key] = '');
    tableData.push(newRow);
    renderTableBody();
    
    // Auto scroll ke bawah
    const container = document.querySelector('.table-container');
    if(container) container.scrollTop = container.scrollHeight;
}

function hapusBaris(index) {
    if(!confirm("Hapus baris ini? (Akan permanen setelah di-Simpan)")) return;
    
    const row = tableData[index];
    if (row.id) {
        // Jika data sudah ada di DB, masukkan ke antrean hapus
        deletedIds.push(row.id);
    }
    
    // Tandai dihapus secara lokal
    tableData[index]._isDeleted = true;
    renderTableBody();
}

async function simpanKeSupabase() {
    const conf = CONFIG[currentCategory];
    const btn = document.getElementById('btn-save');
    const ori = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...';
    btn.disabled = true;

    try {
        // 1. Eksekusi Hapus (Jika ada)
        if (deletedIds.length > 0) {
            const { error: errDel } = await db.from(conf.table).delete().in('id', deletedIds);
            if (errDel) throw new Error("Gagal menghapus data: " + errDel.message);
        }

        // 2. Siapkan data untuk Upsert (Insert/Update)
        let payloadUpsert = [];
        tableData.forEach(row => {
            if (!row._isDeleted) {
                let cleanRow = {};
                if (row.id) cleanRow.id = row.id; // Bawa ID jika update
                
                let isEmpty = true;
                conf.cols.forEach(c => {
                    cleanRow[c.key] = row[c.key] || null;
                    if (cleanRow[c.key]) isEmpty = false;
                });
                
                // Jangan simpan baris yang benar-benar kosong melompong
                if (!isEmpty) payloadUpsert.push(cleanRow);
            }
        });

        // 3. Eksekusi Upsert
        if (payloadUpsert.length > 0) {
            const { error: errUpd } = await db.from(conf.table).upsert(payloadUpsert);
            if (errUpd) throw new Error("Gagal menyimpan data: " + errUpd.message);
        }

        alert("✅ BERHASIL!\nSemua perubahan Master Data telah disinkronkan ke Database.");
        
        // Refresh Data
        await fetchTableData();

    } catch (e) {
        alert("❌ ERROR: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
}
