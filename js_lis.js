<script>
  let dataLis = {}; let selectedLisItem = "";

  function initLis() {
    google.script.run.withSuccessHandler(function(data) { 
      dataLis = data; 
      isiDropdown('l', data); 
    }).getInitialData('LIS');
    
    document.getElementById('l-tgl').valueAsDate = new Date();
    document.getElementById('l-shading').addEventListener('input', function() { this.value = this.value.toUpperCase(); });
    document.getElementById('l-mesin').addEventListener('change', function() { if(this.value === 'ADD_NEW') { bukaModal('l-modal-tambah-mesin'); this.value = ''; } });
    
    // Jangan lupa panggil init Keyboard, cukup dijalankan 1 kali tapi aman dipanggil lagi karena sudah universal
    initKeyboardGlobal(); 
  }
</script>
