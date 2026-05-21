// KONEKSI SUPABASE
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentKolom = 'nama_troli';

// INISIALISASI AWAL SAAT HALAMAN DIBUKA
window.onload = () => { 
    lucide.createIcons();
    document.body.setAttribute('data-bg', localStorage.getItem('app_bg') || 'light');
    loadDataKategori(); 
};

// FUNGSI MEMUAT DATA BERDASARKAN KATEGORI (DROPDOWN)
async function loadDataKategori() {
    currentKolom = document.getElementById('kategori-select').value;
    const selectEl = document.getElementById('kategori-select');
    const judul = selectEl.options[selectEl.selectedIndex].text;
    document.getElementById('tabel-judul').innerText = judul;
    
    const tbody = document.getElementById('tbody-master');
    tbody.innerHTML = `<tr><td colspan="3" class="text-center p-6"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto text-blue-500"></i></td></tr>`;
    lucide.createIcons();

    const { data, error } = await db.from('master_1').select(`id, ${currentKolom}`).order('id', { ascending: true });
    
    if (error) { 
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-red-500 font-bold p-4">Error: ${error.message}</td></tr>`; 
        return; 
    }
    
    // Saring hanya data yang tidak kosong
    const filteredData = data.filter(r => r[currentKolom] && r[currentKolom].trim() !== '');
    document.getElementById('data-count').innerText = `${filteredData.length} Baris`;
    
    tbody.innerHTML = '';
    if(filteredData.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="3" class="text-center p-6 opacity-50 font-medium">Tabel kosong. Silakan tambah data baru.</td></tr>`; 
        return; 
    }

    filteredData.forEach((r, index) => {
        tbody.innerHTML += `
            <tr class="border-b border-inherit hover:bg-blue-500/10 transition">
                <td class="p-3 text-center font-bold opacity-50">${index + 1}</td>
                <td class="p-3 font-bold text-lg tracking-wide">${r[currentKolom]}</td>
                <td class="p-3 text-center">
                    <button onclick="hapusData(${r.id})" class="text-red-500 hover:text-red-700 bg-red-100 p-2 rounded-lg cursor-pointer transition active:scale-95 shadow-sm" title="Hapus">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>`;
    });
    lucide.createIcons();
}

// FUNGSI MENAMBAHKAN DATA BARU
async function tambahData() {
    const inputVal = document.getElementById('input-baru').value.trim().toUpperCase();
    if(!inputVal) return;

    // Animasi Loading Tombol
    const btnTambah = document.getElementById('btn-tambah');
    const originalText = btnTambah.innerHTML;
    btnTambah.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i>';
    btnTambah.disabled = true;

    // Cek apakah ada baris kosong (null) di kolom yang dipilih
    const { data: slotKosong } = await db.from('master_1').select('id').is(currentKolom, null).limit(1);

    if(slotKosong && slotKosong.length > 0) {
        // Jika ada, timpa (Update) agar tidak membuang ID baru
        await db.from('master_1').update({ [currentKolom]: inputVal }).eq('id', slotKosong[0].id);
    } else {
        // Jika penuh semua, buat baris baru (Insert)
        await db.from('master_1').insert([{ [currentKolom]: inputVal }]);
    }

    // Kembalikan Tombol ke Semula
    document.getElementById('input-baru').value = '';
    btnTambah.innerHTML = originalText;
    btnTambah.disabled = false;
    lucide.createIcons();
    
    // Muat Ulang Tabel
    loadDataKategori();
}

// FUNGSI MENGHAPUS DATA
window.hapusData = async (id) => {
    if(!confirm("Hapus data ini?")) return;
    
    // Menghapus hanya isi kolom terkait menjadi null, bukan menghapus baris utuh
    await db.from('master_1').update({ [currentKolom]: null }).eq('id', id);
    loadDataKategori();
};
