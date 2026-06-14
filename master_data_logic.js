let currentCategory = '';
let tableData = [];
let searchQuery = '';

// REVISI: Konfigurasi Kolom disesuaikan dengan urutan yang diminta
const CONFIG = {
    'variabel': {
        table: 'master_2',
        title: 'VARIABEL & KODE',
        icon: 'book-open',
        cols: [
            { key: 'mesin', label: 'Mesin Asli' },
            { key: 'kode_mesin', label: 'Kode Mesin' },
            { key: 'shift', label: 'Shift Asli' },
            { key: 'kode_shift', label: 'Kode Shift' },
            { key: 'nama_item', label: 'Nama Item Asli' },
            { key: 'kode_nama_item', label: 'Kode Item' },
            { key: 'grade', label: 'Grade Asli' },
            { key: 'kode_grade', label: 'Kode Grade' },
            { key: 'po', label: 'PO Asli' },
            { key: 'kode_po', label: 'Kode PO' },
            { key: 'dus', label: 'Dus Asli' },
            { key: 'kode_dus', label: 'Kode Dus' }
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
    document.getElementById('input-search').value = '';
    searchQuery = '';
    
    document.getElementById('title-bar').innerHTML = `<i data-lucide="${conf.icon}" class="w-4 h-4"></i> TABEL: ${conf.title}`;
    
    await fetchTableData();
}

async function fetchTableData() {
    const conf = CONFIG[currentCategory];
    const tbody = document.getElementById('tbody-master');
    const thead = document.getElementById('thead-master');
    
    // Render Header (Tanpa kolom Hapus)
    let thHtml = `<tr><th class="hdr-std w-12">No</th>`;
    conf.cols.forEach(c => { thHtml += `<th class="hdr-std border-l border-slate-600">${c.label}</th>`; });
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;

    tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 1}" class="p-10 text-center"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500"></i> Memuat Data...</td></tr>`;
    lucide.createIcons();

    try {
        const { data, error } = await db.from(conf.table).select('*').order('id', { ascending: true });
        if (error) throw error;
        
        tableData = data || [];
        renderTableBody();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 1}" class="p-10 text-center text-red-500 font-bold">Gagal memuat: ${e.message}</td></tr>`;
    }
}

// REVISI: Fitur Pencarian (Filter)
function searchData(val) {
    searchQuery = val.toLowerCase();
    renderTableBody();
}

function renderTableBody() {
    const conf = CONFIG[currentCategory];
    const tbody = document.getElementById('tbody-master');
    
    // Saring data berdasarkan pencarian
    const visibleData = tableData.filter(row => {
        if (!searchQuery) return true;
        return conf.cols.some(c => String(row[c.key] || '').toLowerCase().includes(searchQuery));
    });

    document.getElementById('lbl-total-baris').innerText = visibleData.length;

    if (visibleData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${conf.cols.length + 1}" class="p-10 text-center text-slate-400 font-bold">Data tidak ditemukan.</td></tr>`;
        return;
    }

    let html = '';
    visibleData.forEach((row, index) => {
        const originalIndex = tableData.findIndex(d => d === row);
        
        html += `<tr class="border-b border-slate-200 hover:bg-slate-50 transition">
            <td class="p-2 font-bold text-slate-400 bg-slate-50 border-r border-slate-200 border-b border-slate-200">${index + 1}</td>`;
        
        conf.cols.forEach(c => {
            let val = row[c.key] || '';
            html += `<td class="p-0 border-r border-slate-200 border-b border-slate-200">
                <input type="text" value="${val}" onchange="updateCell(${originalIndex}, '${c.key}', this.value)" class="excel-input uppercase" placeholder="-">
            </td>`;
        });
        html += `</tr>`;
    });

    tbody.innerHTML = html;
}

function updateCell(index, key, value) {
    tableData[index][key] = value.trim().toUpperCase();
}

function tambahBarisKosong() {
    let newRow = {};
    CONFIG[currentCategory].cols.forEach(c => newRow[c.key] = '');
    tableData.push(newRow);
    
    // Reset pencarian agar baris baru terlihat
    document.getElementById('input-search').value = '';
    searchQuery = '';
    
    renderTableBody();
    
    // Auto scroll ke bawah
    const container = document.querySelector('.table-container');
    if(container) container.scrollTop = container.scrollHeight;
}

// REVISI: Perbaikan Bug Null Value ID
async function simpanKeSupabase() {
    const conf = CONFIG[currentCategory];
    const btn = document.getElementById('btn-save');
    const ori = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i> MENYIMPAN...';
    btn.disabled = true;

    try {
        let payloadUpdate = [];
        let payloadInsert = [];

        tableData.forEach(row => {
            let cleanRow = {};
            let isEmpty = true;
            
            conf.cols.forEach(c => {
                cleanRow[c.key] = row[c.key] || null;
                if (cleanRow[c.key]) isEmpty = false;
            });
            
            // Jangan simpan baris yang benar-benar kosong melompong
            if (!isEmpty) {
                if (row.id) {
                    // Jika punya ID, masuk ke antrean Update
                    cleanRow.id = row.id;
                    payloadUpdate.push(cleanRow);
                } else {
                    // Jika TIDAK punya ID, masuk ke antrean Insert (DB akan generate ID otomatis)
                    payloadInsert.push(cleanRow);
                }
            }
        });

        // Eksekusi Update (Upsert)
        if (payloadUpdate.length > 0) {
            const { error: errUpd } = await db.from(conf.table).upsert(payloadUpdate);
            if (errUpd) throw new Error("Gagal Update data: " + errUpd.message);
        }

        // Eksekusi Insert
        if (payloadInsert.length > 0) {
            const { error: errIns } = await db.from(conf.table).insert(payloadInsert);
            if (errIns) throw new Error("Gagal Insert data baru: " + errIns.message);
        }

        alert("✅ BERHASIL!\nSemua perubahan Master Data telah disinkronkan ke Database.");
        await fetchTableData();

    } catch (e) {
        alert("❌ ERROR: " + e.message);
    } finally {
        btn.innerHTML = ori;
        btn.disabled = false;
        lucide.createIcons();
    }
}

// REVISI: Fitur Download Excel
function downloadExcelMaster() {
    if(typeof XLSX === 'undefined') return alert("Library Excel belum termuat, pastikan ada koneksi internet.");
    
    const conf = CONFIG[currentCategory];
    let ws_data = [];
    
    // Header
    let headers = ['No'];
    conf.cols.forEach(c => headers.push(c.label));
    ws_data.push(headers);

    // Data (Hanya yang tampil di layar / hasil filter)
    const visibleData = tableData.filter(row => {
        if (!searchQuery) return true;
        return conf.cols.some(c => String(row[c.key] || '').toLowerCase().includes(searchQuery));
    });

    if (visibleData.length === 0) return alert("Tidak ada data untuk diekspor!");

    visibleData.forEach((row, idx) => {
        let rowData = [idx + 1];
        conf.cols.forEach(c => rowData.push(row[c.key] || ''));
        ws_data.push(rowData);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, conf.title);
    XLSX.writeFile(wb, `MasterData_${conf.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
