// db.js - IndexedDB initialization and operations
const DB_NAME = "SalesDB";
const DB_VERSION = 3;
const STORES = {
  clients: "clients",
  products: "products",
  transactions: "transactions",
};

// Initialize database
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open database"));
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.clients)) {
        db.createObjectStore(STORES.clients, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.products)) {
        db.createObjectStore(STORES.products, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        db.createObjectStore(STORES.transactions, { keyPath: "id" });
      }

      // Add the transactionCounters object store
      if (!db.objectStoreNames.contains("transactionCounters")) {
        db.createObjectStore("transactionCounters", { keyPath: "id" });
      }
    };
  });
}

// Generic CRUD operations
async function addItem(storeName, item) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(new Error("Failed to add item"));
  });
}

async function getAllItems(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Failed to get items"));
  });
}

async function getItem(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Failed to get item"));
  });
}

async function updateItem(storeName, item) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(new Error("Failed to update item"));
  });
}

async function deleteItem(storeName, id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(new Error("Failed to delete item"));
  });
}

async function clearStore(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(new Error("Failed to clear store"));
  });
}

// Specific operations for each store
const dbOperations = {
  initDB, // Add this line to include the initDB function
  clearStore, // Add this line to include the clearStore function
  getAllItems, // Add this line to include the getAllItems function
  addItem, // Add this line to include the addItem function
  updateItem, // Add this line to include the updateItem function
  deleteItem, // Add this line to include the deleteItem function
  clearStore,

  // Client operations
  async addClient(client) {
    if (!client.id) {
      client.id = Date.now();
    }
    await addItem(STORES.clients, client);
    return client;
  },

  async getAllClients() {
    return await getAllItems(STORES.clients);
  },

  async updateClient(client) {
    return await updateItem(STORES.clients, client);
  },

  async deleteClient(id) {
    return await deleteItem(STORES.clients, id);
  },

  async getItem(storeName, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Failed to get item"));
    });
  },

  async updateItem(storeName, item) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(new Error("Failed to update item"));
    });
  },

  // Product operations
  async addProduct(product) {
    if (!product.id) {
      product.id = Date.now();
    }
    await addItem(STORES.products, product);
    return product;
  },

  async getAllProducts() {
    return await getAllItems(STORES.products);
  },

  async updateProduct(product) {
    return await updateItem(STORES.products, product);
  },

  async deleteProduct(id) {
    return await deleteItem(STORES.products, id);
  },

  // Transaction operations
  async addTransaction(transaction) {
    if (!transaction.id) {
      transaction.id = generateTransactionNumber(transaction.date);
    }
    await addItem(STORES.transactions, transaction);
    return transaction;
  },

  async getAllTransactions() {
    return await getAllItems(STORES.transactions);
  },

  // Backup and restore operations
  async exportDatabase() {
    const clients = await getAllItems(STORES.clients);
    const products = await getAllItems(STORES.products);
    const transactions = await getAllItems(STORES.transactions);

    return {
      clients,
      products,
      transactions,
    };
  },

  async importDatabase(data) {
    await clearStore(STORES.clients);
    await clearStore(STORES.products);
    await clearStore(STORES.transactions);

    for (const client of data.clients) {
      await addItem(STORES.clients, client);
    }
    for (const product of data.products) {
      await addItem(STORES.products, product);
    }
    for (const transaction of data.transactions) {
      await addItem(STORES.transactions, transaction);
    }
  },
};

// Modified main functions to use IndexedDB
async function populateClients() {
  try {
    const clients = await dbOperations.getAllClients();

    $("#client, #clientSelectReport").empty();
    $("#client, #clientSelectReport").append(
      `<option value="" disabled selected>اختر العميل</option>`
    );

    clients.forEach((client) => {
      $("#client, #clientSelectReport").append(
        `<option value="${client.id}">${client.name}</option>`
      );
    });

    $("#clientTable").empty();
    const start = (currentPageMap.clientTable - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedClients = clients.slice(start, end);

    paginatedClients.forEach((client) => {
      const formattedDate = client.lastPaymentDate;
      $("#clientTable").append(`
        <tr>
          <td>${client.name}</td>
          <td>${client.mobile}</td>
          <td>${formattedDate}</td>
          <td>
            <button class="btn btn-danger" onclick="deleteClient(${client.id})">حذف</button>
            <button class="btn btn-warning" onclick="editClient(${client.id})">تعديل</button>
          </td>
        </tr>
      `);
    });

    addPagination("clientTable", "clientPagination", clients.length);
  } catch (error) {
    console.error("Error populating clients:", error);
    showErrorMessage("حدث خطأ أثناء تحميل بيانات العملاء");
  }
}

async function populateProducts() {
  try {
    const products = await dbOperations.getAllProducts();

    $("#productSelect").empty();
    $("#productSelect").append(
      `<option value="" disabled selected>اختر المنتج</option>`
    );

    products.forEach((product) => {
      $("#productSelect").append(
        `<option value="${product.id}">${product.name}</option>`
      );
    });

    $("#productTable").empty();
    const start = (currentPageMap.productTable - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedProducts = products.slice(start, end);

    paginatedProducts.forEach((product) => {
      $("#productTable").append(`
        <tr>
          <td>${product.name}</td>
          <td>
            <button class="btn btn-danger" onclick="deleteProduct(${product.id})">حذف</button>
            <button class="btn btn-warning" onclick="editProduct(${product.id})">تعديل</button>
          </td>
        </tr>
      `);
    });

    addPagination("productTable", "productPagination", products.length);
  } catch (error) {
    console.error("Error populating products:", error);
    showErrorMessage("حدث خطأ أثناء تحميل بيانات المنتجات");
  }
}

async function populateTransactions() {
  try {
    const [transactions, clients] = await Promise.all([
      dbOperations.getAllTransactions(),
      dbOperations.getAllClients(),
    ]);

    $("#transactionTable").empty();

    transactions.sort((a, b) => b.id - a.id);

    const start = (currentPageMap.transactionTable - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedTransactions = transactions.slice(start, end);

    paginatedTransactions.forEach((transaction) => {
      const client = clients.find((c) => c.id == transaction.clientId);
      const clientName = client ? client.name : "غير معروف";
      $("#transactionTable").append(`
        <tr class="transaction-row" data-transaction='${JSON.stringify(
          transaction
        )}'>
          <td>${clientName}</td>
          <td>${transaction.id}</td>
          <td>${transaction.date}</td>
          <td>${transaction.total}</td>
        </tr>
      `);
    });

    addPagination(
      "transactionTable",
      "transactionPagination",
      transactions.length
    );

    $(".transaction-row").click(function () {
      const transaction = $(this).data("transaction");
      showTransactionDetails(transaction);
    });
  } catch (error) {
    console.error("Error populating transactions:", error);
    showErrorMessage("حدث خطأ أثناء تحميل بيانات المعاملات");
  }
}

// Modified event handlers
async function addClient() {
  const clientName = $("#clientName").val().trim();
  const clientMobile = $("#clientMobile").val().trim();
  const lastPaymentDate = $("#lastPaymentDate").val();

  if (!clientName || !clientMobile || !lastPaymentDate) {
    showErrorMessage("يرجى إدخال جميع البيانات المطلوبة");
    return;
  }

  if (!isValidEgyptianMobileNumber(clientMobile)) {
    showErrorMessage("يرجى إدخال رقم هاتف محمول صحيح");
    return;
  }

  const parsedDate = parseDate(lastPaymentDate);
  if (!parsedDate) {
    showErrorMessage(
      "تاريخ آخر دفعة غير صحيح. يرجى إدخال تاريخ صحيح (DD-MM-YYYY)."
    );
    return;
  }

  try {
    const newClient = {
      id: Date.now(),
      name: clientName,
      mobile: clientMobile,
      lastPaymentDate: formatDate(parsedDate),
    };

    await dbOperations.addClient(newClient);
    showSuccessMessage("تمت إضافة العميل بنجاح");
    clearClientForm();
    await populateClients();
  } catch (error) {
    console.error("Error adding client:", error);
    showErrorMessage("حدث خطأ أثناء إضافة العميل");
  }
}

async function addProduct() {
  const productName = $("#productName").val().trim();

  if (!productName) {
    showErrorMessage("يرجى إدخال اسم المنتج");
    return;
  }

  try {
    const products = await dbOperations.getAllProducts();
    const isDuplicate = products.some(
      (product) => product.name === productName
    );

    if (isDuplicate) {
      showErrorMessage("اسم المنتج موجود بالفعل. يرجى إدخال اسم مختلف.");
      return;
    }

    const newProduct = { id: Date.now(), name: productName };
    await dbOperations.addProduct(newProduct);
    await populateProducts();
    showSuccessMessage("تمت إضافة المنتج بنجاح");
    clearProductForm();
  } catch (error) {
    console.error("Error adding product:", error);
    showErrorMessage("حدث خطأ أثناء إضافة المنتج");
  }
}

// Export the database operations
window.dbOperations = dbOperations;

// Initialize the database when the page loads
$(document).ready(async function () {
  try {
    await initDB();
    // Migrate existing data from localStorage if needed
    const existingClients = JSON.parse(localStorage.getItem("clients") || "[]");
    const existingProducts = JSON.parse(
      localStorage.getItem("products") || "[]"
    );
    const existingTransactions = JSON.parse(
      localStorage.getItem("transactions") || "[]"
    );

    if (
      existingClients.length > 0 ||
      existingProducts.length > 0 ||
      existingTransactions.length > 0
    ) {
      for (const client of existingClients) {
        await dbOperations.addClient(client);
      }
      for (const product of existingProducts) {
        await dbOperations.addProduct(product);
      }
      for (const transaction of existingTransactions) {
        await dbOperations.addTransaction(transaction);
      }

      // Clear localStorage after migration
      localStorage.clear();
    }

    // Initialize the UI
    await populateClients();
    await populateProducts();
    await populateTransactions();
    await generateStatistics();
    await renderTopClientsChart();
  } catch (error) {
    console.error("Error initializing database:", error);
    showErrorMessage("حدث خطأ أثناء تهيئة قاعدة البيانات");
  }
});
