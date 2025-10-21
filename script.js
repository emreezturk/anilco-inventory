const STORAGE_KEY = "anilcoInventoryProducts";
const SAMPLE_PRODUCTS = [
  {
    name: "USB-C Şarj Kablosu 1m",
    sku: "8690000000012",
    quantity: 24,
    category: "Elektronik",
    location: "Raf A1",
    criticalStock: 8,
    notes: "Hızlı şarj destekli, paket başına 10 adet.",
  },
  {
    name: "Kablosuz Barkod Okuyucu",
    sku: "8690000000456",
    quantity: 6,
    category: "Donanım",
    location: "Raf B3",
    criticalStock: 3,
    notes: "Set olarak gelir, aksesuarları kutusunda saklanmalı.",
  },
  {
    name: "Termal Yazıcı Rulosu",
    sku: "8690000000789",
    quantity: 42,
    category: "Sarf",
    location: "Depo-2",
    criticalStock: 15,
    notes: "Her kutuda 50 adet var. Raf nemini düşük tutun.",
  },
];

const createId = () => `prd-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const productForm = document.getElementById("product-form");
  const productNameInput = document.getElementById("product-name");
  const skuInput = document.getElementById("product-sku");
  const quantityInput = document.getElementById("product-quantity");
  const criticalStockInput = document.getElementById("product-critical");
  const categoryInput = document.getElementById("product-category");
  const locationInput = document.getElementById("product-location");
  const notesInput = document.getElementById("product-notes");
  const submitBtn = document.getElementById("save-btn");
  const cancelEditBtn = document.getElementById("cancel-edit");
  const clearAllBtn = document.getElementById("clear-all");
  const statusMessage = document.getElementById("status-message");

  const totalProductsEl = document.getElementById("total-products");
  const totalQuantityEl = document.getElementById("total-quantity");
  const criticalProductsEl = document.getElementById("critical-products");
  const lastUpdateEl = document.getElementById("last-update");

  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const resetFiltersBtn = document.getElementById("reset-filters");
  const tableCountEl = document.getElementById("table-count");
  const productTableBody = document.querySelector("#product-table tbody");

  const categoryOptions = document.getElementById("category-options");
  const locationOptions = document.getElementById("location-options");

  const videoElement = document.getElementById("video");
  const barkodSonucDiv = document.getElementById("barkod-sonuc");
  const baslatBtn = document.getElementById("baslat-btn");
  const durdurBtn = document.getElementById("durdur-btn");
  const scanFeedback = document.getElementById("scan-feedback");

  const hasQuagga = typeof window.Quagga !== "undefined";

  let products = [];
  let editingId = null;
  let statusTimerId;
  let scanningActive = false;
  let lastDetectedCode = "";
  let lastDetectedAt = 0;

  const showStatus = (message, type = "info") => {
    clearTimeout(statusTimerId);
    if (!message) {
      statusMessage.textContent = "";
      statusMessage.className = "status";
      return;
    }

    statusMessage.textContent = message;
    statusMessage.className = `status status--${type}`;

    statusTimerId = window.setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.className = "status";
    }, 5000);
  };

  const seedProducts = () =>
    SAMPLE_PRODUCTS.map((product) => ({
      ...product,
      id: createId(),
      updatedAt: new Date().toISOString(),
    }));

  const loadProducts = () => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const seeded = seedProducts();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((product) => ({
        id: product.id || createId(),
        name: product.name || "",
        sku: product.sku || "",
        quantity: Number(product.quantity) || 0,
        category: product.category || "",
        location: product.location || "",
        criticalStock: Number(product.criticalStock) || 0,
        notes: product.notes || "",
        updatedAt: product.updatedAt || new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Veriler yüklenirken bir sorun oluştu.", error);
      const seeded = seedProducts();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      showStatus("Kayıtlı veriler okunamadı, örnek ürünler yüklendi.", "warning");
      return seeded;
    }
  };

  const saveProducts = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  };

  const updateSummary = () => {
    const totalQuantity = products.reduce((sum, product) => sum + (Number(product.quantity) || 0), 0);
    const criticalCount = products.filter(
      (product) => product.criticalStock && product.quantity <= product.criticalStock
    ).length;
    const latest = [...products].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    )[0];

    totalProductsEl.textContent = products.length;
    totalQuantityEl.textContent = totalQuantity;
    criticalProductsEl.textContent = criticalCount;
    lastUpdateEl.textContent = latest ? formatDateTime(latest.updatedAt) : "-";
  };

  const refreshCategoryFilter = () => {
    const previousValue = categoryFilter.value;
    const categories = Array.from(
      new Set(products.filter((product) => product.category).map((product) => product.category))
    ).sort((a, b) => a.localeCompare(b, "tr"));

    categoryFilter.innerHTML = "<option value=\"all\">Tüm Kategoriler</option>";
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryFilter.append(option);
    });

    if (categories.includes(previousValue)) {
      categoryFilter.value = previousValue;
    } else {
      categoryFilter.value = "all";
    }
  };

  const refreshDatalists = () => {
    const categories = new Set();
    const locations = new Set();

    products.forEach((product) => {
      if (product.category) {
        categories.add(product.category);
      }
      if (product.location) {
        locations.add(product.location);
      }
    });

    categoryOptions.innerHTML = "";
    Array.from(categories)
      .sort((a, b) => a.localeCompare(b, "tr"))
      .forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        categoryOptions.append(option);
      });

    locationOptions.innerHTML = "";
    Array.from(locations)
      .sort((a, b) => a.localeCompare(b, "tr"))
      .forEach((location) => {
        const option = document.createElement("option");
        option.value = location;
        locationOptions.append(option);
      });
  };

  const getFilteredProducts = () => {
    const term = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;

    return products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      if (!term) {
        return matchesCategory;
      }

      const haystack = [product.name, product.sku, product.category, product.location, product.notes]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      const matchesTerm = haystack.some((value) => value.includes(term));

      return matchesCategory && matchesTerm;
    });
  };

  const renderProducts = () => {
    const filtered = getFilteredProducts();
    productTableBody.innerHTML = "";

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "empty";
      cell.textContent = "Aradığınız kriterlere uygun ürün bulunamadı.";
      row.append(cell);
      productTableBody.append(row);
    } else {
      filtered.forEach((product) => {
        const row = document.createElement("tr");
        row.dataset.id = product.id;

        if (product.criticalStock && product.quantity <= product.criticalStock) {
          row.classList.add("low-stock");
        }

        const nameCell = document.createElement("td");
        const nameTitle = document.createElement("strong");
        nameTitle.textContent = product.name || "İsimsiz Ürün";
        nameCell.append(nameTitle);
        if (product.notes) {
          const note = document.createElement("p");
          note.className = "note";
          note.textContent = product.notes;
          nameCell.append(note);
        }

        const skuCell = document.createElement("td");
        const skuCode = document.createElement("code");
        skuCode.textContent = product.sku || "-";
        skuCell.append(skuCode);

        const categoryCell = document.createElement("td");
        categoryCell.textContent = product.category || "-";

        const locationCell = document.createElement("td");
        locationCell.textContent = product.location || "-";

        const quantityCell = document.createElement("td");
        const quantityBadge = document.createElement("span");
        quantityBadge.className = "quantity-badge";
        quantityBadge.textContent = product.quantity;
        quantityCell.append(quantityBadge);
        if (product.criticalStock) {
          const criticalTag = document.createElement("span");
          criticalTag.className = "tag";
          criticalTag.textContent = `min ${product.criticalStock}`;
          quantityCell.append(criticalTag);
        }

        const updatedCell = document.createElement("td");
        updatedCell.textContent = formatDateTime(product.updatedAt);

        const actionsCell = document.createElement("td");
        actionsCell.className = "actions-col";

        const increaseBtn = document.createElement("button");
        increaseBtn.type = "button";
        increaseBtn.className = "action-btn action-btn--primary";
        increaseBtn.dataset.action = "increase";
        increaseBtn.dataset.id = product.id;
        increaseBtn.textContent = "+1";
        increaseBtn.setAttribute("aria-label", `${product.name} stoğunu artır`);

        const decreaseBtn = document.createElement("button");
        decreaseBtn.type = "button";
        decreaseBtn.className = "action-btn action-btn--ghost";
        decreaseBtn.dataset.action = "decrease";
        decreaseBtn.dataset.id = product.id;
        decreaseBtn.textContent = "-1";
        decreaseBtn.setAttribute("aria-label", `${product.name} stoğunu azalt`);

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "action-btn";
        editBtn.dataset.action = "edit";
        editBtn.dataset.id = product.id;
        editBtn.textContent = "Düzenle";
        editBtn.setAttribute("aria-label", `${product.name} ürününü düzenle`);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "action-btn action-btn--danger";
        deleteBtn.dataset.action = "delete";
        deleteBtn.dataset.id = product.id;
        deleteBtn.textContent = "Sil";
        deleteBtn.setAttribute("aria-label", `${product.name} ürününü sil`);

        actionsCell.append(increaseBtn, decreaseBtn, editBtn, deleteBtn);

        row.append(nameCell, skuCell, categoryCell, locationCell, quantityCell, updatedCell, actionsCell);
        productTableBody.append(row);
      });
    }

    const countText = filtered.length === products.length ? `${filtered.length}` : `${filtered.length} / ${products.length}`;
    tableCountEl.textContent = countText;
  };

  const resetForm = () => {
    productForm.reset();
    editingId = null;
    productForm.classList.remove("is-editing");
    submitBtn.textContent = "Ürünü Kaydet";
    cancelEditBtn.classList.add("hidden");
    quantityInput.value = "1";
  };

  const enterEditMode = (product) => {
    editingId = product.id;
    productNameInput.value = product.name;
    skuInput.value = product.sku;
    quantityInput.value = product.quantity;
    criticalStockInput.value = product.criticalStock || "";
    categoryInput.value = product.category || "";
    locationInput.value = product.location || "";
    notesInput.value = product.notes || "";
    submitBtn.textContent = "Ürünü Güncelle";
    cancelEditBtn.classList.remove("hidden");
    productForm.classList.add("is-editing");
    productNameInput.focus();
    productForm.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const highlightRow = (id) => {
    const row = productTableBody.querySelector(`tr[data-id="${id}"]`);
    if (!row) {
      return;
    }
    row.classList.add("highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      row.classList.remove("highlight");
    }, 1200);
  };

  const syncMetadata = () => {
    refreshCategoryFilter();
    refreshDatalists();
    updateSummary();
  };

  const handleDetection = (data) => {
    if (!scanningActive) {
      return;
    }

    const code = data?.codeResult?.code;
    if (!code) {
      return;
    }

    const normalized = code.trim();
    const now = Date.now();
    if (normalized === lastDetectedCode && now - lastDetectedAt < 1600) {
      return;
    }

    lastDetectedCode = normalized;
    lastDetectedAt = now;

    barkodSonucDiv.textContent = `Okunan Barkod: ${normalized}`;

    const existing = products.find((product) => product.sku === normalized);
    if (existing) {
      existing.quantity += 1;
      existing.updatedAt = new Date().toISOString();
      saveProducts();
      syncMetadata();
      renderProducts();
      showStatus(`"${existing.name}" stoğu otomatik olarak 1 artırıldı.`, "success");
      scanFeedback.textContent = `${existing.name} stok güncellendi.`;
      scanFeedback.className = "scan-feedback success";
      highlightRow(existing.id);
      return;
    }

    skuInput.value = normalized;
    if (!quantityInput.value || Number(quantityInput.value) === 0) {
      quantityInput.value = "1";
    }
    productNameInput.focus();
    showStatus("Yeni barkod algılandı, form otomatik dolduruldu.", "info");
    scanFeedback.textContent = "Yeni barkod bulundu. Ürün bilgilerini doldurup kaydedebilirsiniz.";
    scanFeedback.className = "scan-feedback info";
  };

  const startScanner = () => {
    if (!hasQuagga || scanningActive) {
      return;
    }

    barkodSonucDiv.textContent = "Kamera hazırlanıyor...";
    scanFeedback.textContent = "Lütfen barkodu kameraya yaklaştırın.";
    scanFeedback.className = "scan-feedback info";

    window.Quagga.init(
      {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoElement,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment",
          },
        },
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "code_39_reader",
          ],
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        locate: true,
        numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2,
      },
      (err) => {
        if (err) {
          console.error(err);
          barkodSonucDiv.textContent = `Tarama başlatılamadı: ${err.message || err}`;
          showStatus("Kamera başlatılırken bir hata oluştu.", "error");
          return;
        }

        window.Quagga.start();
        scanningActive = true;
        baslatBtn.disabled = true;
        durdurBtn.disabled = false;
        barkodSonucDiv.textContent = "Tarama aktif. Barkodu kameraya gösterin.";
      }
    );
  };

  const stopScanner = () => {
    if (!hasQuagga || !scanningActive) {
      return;
    }

    window.Quagga.stop();
    scanningActive = false;
    baslatBtn.disabled = false;
    durdurBtn.disabled = true;
    barkodSonucDiv.textContent = "Tarama durduruldu.";
    scanFeedback.className = "scan-feedback muted";
    scanFeedback.textContent = "Tarama kapalı.";
  };

  products = loadProducts();
  syncMetadata();
  renderProducts();

  if (!products.length) {
    showStatus("Henüz ürün eklenmedi. Formu kullanarak ilk kaydınızı oluşturun.", "info");
  }

  productForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = productNameInput.value.trim();
    const sku = skuInput.value.trim();
    const quantity = Number(quantityInput.value);
    const criticalStock = Number(criticalStockInput.value);
    const category = categoryInput.value.trim();
    const location = locationInput.value.trim();
    const notes = notesInput.value.trim();

    if (!name) {
      productNameInput.focus();
      showStatus("Lütfen ürün adını girin.", "error");
      return;
    }

    if (!sku) {
      skuInput.focus();
      showStatus("Barkod/SKU alanı boş bırakılamaz.", "error");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      quantityInput.focus();
      showStatus("Stok adedi 0 veya daha büyük olmalıdır.", "error");
      return;
    }

    const payload = {
      name,
      sku,
      quantity,
      criticalStock: Number.isFinite(criticalStock) && criticalStock >= 0 ? criticalStock : 0,
      category,
      location,
      notes,
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      const index = products.findIndex((product) => product.id === editingId);
      if (index >= 0) {
        products[index] = { ...products[index], ...payload };
        showStatus("Ürün bilgileri güncellendi.", "success");
      }
    } else {
      products.unshift({ id: createId(), ...payload });
      showStatus("Yeni ürün eklendi.", "success");
    }

    saveProducts();
    syncMetadata();
    renderProducts();
    resetForm();
  });

  cancelEditBtn.addEventListener("click", () => {
    resetForm();
    showStatus("Düzenleme iptal edildi.", "info");
  });

  clearAllBtn.addEventListener("click", () => {
    if (!products.length) {
      showStatus("Silinecek ürün bulunmuyor.", "warning");
      return;
    }

    const confirmation = window.confirm(
      "Tüm ürünleri silmek üzeresiniz. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
    );
    if (!confirmation) {
      return;
    }

    products = [];
    window.localStorage.removeItem(STORAGE_KEY);
    syncMetadata();
    renderProducts();
    showStatus("Tüm veriler temizlendi.", "success");
  });

  productTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    const product = products.find((item) => item.id === id);
    if (!product) {
      return;
    }

    switch (action) {
      case "increase":
        product.quantity += 1;
        product.updatedAt = new Date().toISOString();
        saveProducts();
        syncMetadata();
        renderProducts();
        showStatus(`"${product.name}" stoğu 1 artırıldı.`, "success");
        highlightRow(product.id);
        break;
      case "decrease":
        if (product.quantity === 0) {
          showStatus("Stok zaten 0 seviyesinde.", "warning");
          return;
        }
        product.quantity -= 1;
        product.updatedAt = new Date().toISOString();
        saveProducts();
        syncMetadata();
        renderProducts();
        showStatus(`"${product.name}" stoğu 1 azaltıldı.`, "info");
        highlightRow(product.id);
        break;
      case "edit":
        enterEditMode(product);
        break;
      case "delete":
        if (window.confirm(`\"${product.name}\" ürününü silmek istediğinizden emin misiniz?`)) {
          products = products.filter((item) => item.id !== id);
          saveProducts();
          syncMetadata();
          renderProducts();
          showStatus(`"${product.name}" stoktan kaldırıldı.`, "success");
        }
        break;
      default:
        break;
    }
  });

  searchInput.addEventListener("input", () => {
    renderProducts();
  });

  categoryFilter.addEventListener("change", () => {
    renderProducts();
  });

  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "all";
    renderProducts();
    showStatus("Filtreler sıfırlandı.", "info");
  });

  if (hasQuagga) {
    window.Quagga.onDetected(handleDetection);
  } else {
    baslatBtn.disabled = true;
    durdurBtn.disabled = true;
    barkodSonucDiv.textContent = "Tarama kütüphanesi yüklenemedi.";
    scanFeedback.textContent = "QuaggaJS yüklenmediği için barkod tarama devre dışı.";
    scanFeedback.className = "scan-feedback warning";
  }

  baslatBtn.addEventListener("click", startScanner);
  durdurBtn.addEventListener("click", stopScanner);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopScanner();
    }
  });

  window.addEventListener("beforeunload", () => {
    stopScanner();
  });
});
