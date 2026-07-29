// ==========================================
// 0. ROUTE GUARD (PENJAGA KEAMANAN HALAMAN)
// ==========================================
(function checkSecurity() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('index.html') || path === '/';
    const isSettingPage = path.endsWith('setting.html');
    const sessionString = localStorage.getItem('user_session');

    if (!sessionString && !isLoginPage) {
        window.location.replace('index.html');
    } 
    else if (sessionString && isLoginPage) {
        window.location.replace('menu.html');
    }

    if (sessionString && isSettingPage) {
        try {
            const user = JSON.parse(sessionString);
            if (!user.role || user.role.toLowerCase() !== 'creator') {
                window.location.replace('menu.html'); 
            }
        } catch(e) {
            localStorage.removeItem('user_session');
            window.location.replace('index.html');
        }
    }
})();

// ==========================================
// KREDENSIAL SUPABASE
// ==========================================
const SUPABASE_URL = 'https://mjpqzftwbyrbvbvmarol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcHF6ZnR3YnlyYnZidm1hcm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODA0MTgsImV4cCI6MjA5NDE1NjQxOH0.0VT56HA-cGB4CP3u89PShcddt9jARh85KKMgnwCkse4';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// MENU LENGKAP WMS
// ==========================================
const APP_MENUS = [
    { id: 'dashboard', title: 'Dashboard Utama', icon: 'layout-dashboard', url: 'menu.html' },
    { isDivider: true, title: 'INBOUND' },
    { id: 'stbj', title: 'Scan STBJ', icon: 'shield-check', url: 'stbj.html' },
    { id: 'hasil_stbj', title: 'Hasil STBJ', icon: 'clipboard-list', url: 'hasil_stbj.html' },
    { id: 'langsir', title: 'Langsir Gudang', icon: 'log-in', url: 'langsir.html' },
    { id: 'riwayat_langsir', title: 'Riwayat Langsir', icon: 'history', url: 'riwayat_langsir.html' },
    { isDivider: true, title: 'INVENTORY' },
    { id: 'kartu_stok', title: 'Kartu Stok', icon: 'layers', url: 'kartu_stok.html' },
    { id: 'ganti_customer', title: 'Table Ganti Customer', icon: 'user-cog', url: 'ganti_customer.html' },
    { id: 'req_konversi', title: 'Tabel Request Konversi', icon: 'replace', url: 'req_konversi.html' },
    { isDivider: true, title: 'MUTASI' },
    { id: 'stok_nonaktif', title: 'Stok Nonaktif', icon: 'package-x', url: 'stok_nonaktif.html' },
    { id: 'scan_pic', title: 'Scan PIC Area', icon: 'user-check', url: 'scan_pic.html' },
    { id: 'riwayat_mutasi', title: 'Riwayat Konversi', icon: 'arrow-right-left', url: 'riwayat_konversi.html' },
    { isDivider: true, title: 'OUTBOUND' },
    { id: 'po', title: 'PO & Estimasi', icon: 'clipboard-check', url: 'po.html' },
    { id: 'picking_list', title: 'Picking List', icon: 'clipboard-pen', url: 'picking_list.html' },
    { id: 'keluar', title: 'Kirim / Keluar', icon: 'truck', url: 'keluar.html' },
    { id: 'riwayat_keluar', title: 'Riwayat Keluar', icon: 'history', url: 'riwayat_keluar.html' },
    { isDivider: true, title: 'REPORTS' },
    { id: 'reports', title: 'Laporan & Rekap', icon: 'bar-chart-3', url: 'reports.html' },
    { isDivider: true, title: 'PRINT & OPNAME' },
    { id: 'input_opname', title: 'Input Stok Opname', icon: 'clipboard-check', url: 'input_opname.html' },
    { id: 'cetak_label', title: 'Cetak Label Barcode', icon: 'printer', url: 'cetak_label.html' },
    { isDivider: true, title: 'CONFIG' },
    { id: 'master_data', title: 'Master Data', icon: 'database', url: 'master_data.html' }
];

// ... (Sisa kode global.js seperti style, applyTableDesign, initModernLayout, dll tetap sama) ...
// (Untuk menghemat ruang, saya tidak menulis ulang bagian style dan layout builder karena tidak ada yang berubah di sana)
