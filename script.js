// Öğelerimizin referanslarını alıyoruz
const baslatBtn = document.getElementById("baslat-btn");
const videoElement = document.getElementById("video");
const barkodSonucDiv = document.getElementById("barkod-sonuc");

// Taramayı başlat butonuna tıklanınca çalışacak kod
baslatBtn.addEventListener("click", () => {
  // QuaggaJS'yi başlatıyoruz
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: videoElement,  // Kamera akışını göstereceğimiz element
      constraints: {
        width: 300,
        height: 200,
        facingMode: "environment"  // Arka kamera kullanımı
      },
    },
    decoder: {
      readers: ["code_128_reader", "ean_reader", "ean_8_reader"]  // Desteklenen barkod türleri
    },
  }, (err) => {
    if (err) {
      console.error(err);
      barkodSonucDiv.textContent = "Tarama başlatılamadı: " + err;
      return;
    }
    // Başarılı başlatıldığında taramaya başlıyoruz
    Quagga.start();
    barkodSonucDiv.textContent = "Tarama başladı, lütfen barkodu okutun...";
  });
});

// Barkod tespit edildiğinde çalışacak kısım
Quagga.onDetected((data) => {
  const barkod = data.codeResult.code;
  barkodSonucDiv.textContent = "Okunan Barkod: " + barkod;
  // Barkod okunduğunda taramayı durduruyoruz
  Quagga.stop();
});
