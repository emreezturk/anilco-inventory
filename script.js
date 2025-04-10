// Taramayı başlatmak için buton referansı al
const baslatBtn = document.getElementById("baslat-btn");
const videoElement = document.getElementById("video");
const barkodSonucDiv = document.getElementById("barkod-sonuc");

baslatBtn.addEventListener("click", () => {
  // QuaggaJS konfigürasyon ayarları
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: videoElement, // video elementine aktar
      constraints: {
        width: 300,
        height: 200,
        facingMode: "environment" // arka kamera
      },
    },
    decoder: {
      readers: ["code_128_reader", "ean_reader", "ean_8_reader"] // Kullanılacak barkod türleri
    },
  }, (err) => {
    if (err) {
      console.error(err);
      barkodSonucDiv.textContent = "Başlatırken hata oluştu: " + err;
      return;
    }
    Quagga.start();
    barkodSonucDiv.textContent = "Tarama başlatıldı, lütfen barkod okutun...";
  });
});

// Barkod tespit edildiğinde
Quagga.onDetected((data) => {
  const barkod = data.codeResult.code;
  barkodSonucDiv.textContent = "Barkod: " + barkod;
  // Tarama durdurulabilir veya barkod doğrulandığında başka işlemler ekleyebilirsin
  Quagga.stop();
});
