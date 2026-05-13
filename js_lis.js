<script>
  let dataLis = {}; let selectedLisItem = "";

  // KODE BARU (VERSI SUPABASE)
async function initLis() {
  document.getElementById('l-tgl').valueAsDate = new Date();

  // Meminta data langsung dari tabel master_lis
  const { data, error } = await _supa.from('master_lis').select('*');
  
  if (error) {
    alert("Gagal memuat data Lis: " + error.message);
    return;
  }

  if (data) {
    const getUniq = (key) => [...new Set(data.map(i => i[key]).filter(Boolean))].sort();
    
    dataLis = {
      mesin: getUniq('mesin'),
      shift: getUniq('shift'),
      item: getUniq('nama_item'),
      shading: getUniq('shading')
    };

    isiDropdown('l', dataLis);
  }
}
</script>
