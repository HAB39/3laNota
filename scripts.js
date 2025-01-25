let currentPageMap = {
  clientTable: 1,
  productTable: 1,
  transactionTable: 1,
  salesReportTable: 1,
  clientReportTable: 1,
  dueAmountsTable: 1,
};

let rowsPerPage = 10;

$(document).ready(async function () {
  // Initialize the database when the page loads
  try {
    await dbOperations.initDB();
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
    await populateDueClientsTable();
    await generateSalesAccumulationChart();
    await renderTopClientsChart();
    await generateStatistics();
  } catch (error) {
    console.error("Error initializing database:", error);
    showErrorMessage("حدث خطأ أثناء تهيئة قاعدة البيانات");
  }

  // initialize success and error messages hidden
  $("#errorMessage").hide();
  $("#successMessage").hide();

  // Event listeners
  $(document).click(function (event) {
    const clickover = $(event.target);
    const _opened = $(".navbar-collapse").hasClass("show");
    if (_opened === true && !clickover.hasClass("navbar-toggler")) {
      $(".navbar-toggler").click();
    }
  });

  // Add an event listener for the client search input field
  $("#clientSearch").on("input", function () {
    filterClients();
  });

  // Add an event listener for the client search input field in the Clients Report section
  $("#clientSearchReport").on("input", function () {
    filterClientsReport();
  });

  $("#reviewCart").click(function () {
    const navbarHeight = $(".navbar").outerHeight();
    const offset = navbarHeight + 50; // Add additional offset if needed
    $("html, body").animate(
      {
        scrollTop: $("#cartTable").offset().top - offset,
      },
      500
    );
  });

  $(".nav-link").click(function (event) {
    event.preventDefault(); // Prevent default anchor click behavior
    const targetId = $(this).attr("href"); // Get the target section ID

    // Get the height of the navbar
    const navbarHeight = $(".navbar").outerHeight();
    const isMobile = window.innerWidth <= 768; // Adjust this breakpoint as needed
    const offset = 55; // Add additional offset if needed
    $("html, body").animate(
      {
        scrollTop: $(targetId).offset().top - offset,
      },
      500
    );

    // Collapse the navbar after clicking on a link
    $(".navbar-collapse").collapse("hide");
  });

  $("#addClient").click(addClient);
  $("#addProduct").click(addProduct);
  $("#addProductToCart").click(addProductToCart);
  $("#confirmSale").click(confirmSale);
  $("#backupDatabase").click(backupDatabase);
  $("#restoreDatabase").click(restoreDatabase);
  $("#generateSalesReport").click(generateSalesReport);
  $("#generateClientReport").click(generateClientReport);
  $("#saleDate").val(toHTMLDate(new Date()));
});

function isValidEgyptianMobileNumber(mobile) {
  const regex = /^(010|011|012|015)\d{8}$/; // Regex to match the mobile number format
  return regex.test(mobile);
}

// Functions for adding clients, products, and transactions
async function addClient() {
  const clientName = $("#clientName").val().trim();
  const clientMobile = $("#clientMobile").val().trim();
  const lastPaymentDate = $("#lastPaymentDate").val();

  // Validate inputs
  if (!clientName || !clientMobile || !lastPaymentDate) {
    showErrorMessage("يرجى إدخال جميع البيانات المطلوبة");
    return;
  }

  // Validate mobile number format
  if (!isValidEgyptianMobileNumber(clientMobile)) {
    showErrorMessage("يرجى إدخال رقم هاتف محمول صحيح");
    return;
  }

  // Check for duplicate client name or mobile number
  const isDuplicate = await isClientDuplicate(clientName, clientMobile);
  if (isDuplicate) {
    showErrorMessage(
      "اسم العميل أو رقم التليفون موجود بالفعل. يرجى إدخال بيانات مختلفة."
    );
    return;
  }

  // Parse and validate the lastPaymentDate
  const parsedDate = parseDate(lastPaymentDate);
  if (!parsedDate) {
    showErrorMessage(
      "تاريخ آخر دفعة غير صحيح. يرجى إدخال تاريخ صحيح (DD-MM-YYYY)."
    );
    return;
  }

  // Format the date before storing it
  const formattedDate = formatDate(parsedDate);

  try {
    const newClient = {
      id: Date.now(), // Unique ID
      name: clientName,
      mobile: clientMobile,
      lastPaymentDate: formattedDate,
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

async function populateDueClientsTable() {
  const clientDebts = await calculateClientDebts();
  const tableBody = $("#dueAmountsReport tbody");
  tableBody.empty();
  // Calculate the start and end indices for the current page
  const start = (currentPageMap.dueAmountsTable - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const paginatedClients = clientDebts.slice(start, end);

  // Populate the table with the paginated data
  paginatedClients.forEach((client) => {
    const row = `
    <tr>
      <td>${client.name}</td>
      <td>${client.dueAmount.toFixed(2)}</td>
      <td>${client.lastPaymentDate}</td>
    </tr>
  `;
    tableBody.append(row);
  });

  addPagination("dueAmountsTable", "dueAmountsPagination", clientDebts.length);
}

async function calculateClientDebts() {
  const clients = await dbOperations.getAllClients();
  const transactions = await dbOperations.getAllTransactions();

  const clientDebts = clients.map((client) => {
    const lastPaymentDate = new Date(parseDate(client.lastPaymentDate));
    const clientTransactions = transactions.filter(
      (transaction) => transaction.clientId === String(client.id)
    );

    const dueAmount = clientTransactions.reduce((total, transaction) => {
      const transactionDate = new Date(parseDate(transaction.date));
      if (
        transactionDate instanceof Date &&
        lastPaymentDate instanceof Date &&
        transactionDate > lastPaymentDate
      ) {
        return total + parseFloat(transaction.total); // Convert transaction total to a number
      }
      return total;
    }, 0);

    return {
      ...client,
      dueAmount: dueAmount > 0 ? dueAmount : 0,
    };
  });

  return clientDebts.filter((client) => client.dueAmount > 0);
}

async function addProductToCart() {
  const clientId = $("#client").val();
  const productId = $("#productSelect").val();
  const productName = $("#productSelect option:selected").text();
  const productPrice = parseFloat($("#productPrice").val());

  if (clientId && productId && productName && productPrice >= 0) {
    let existingRow = null;
    $("#cartBody tr").each(function () {
      if ($(this).find("td:first").text() === productName) {
        existingRow = $(this);
        return false;
      }
    });

    if (existingRow) {
      const currentPrice = parseFloat(
        existingRow.find("td:nth-child(2)").text()
      );
      existingRow
        .find("td:nth-child(2)")
        .text((currentPrice + productPrice).toFixed(2));
    } else {
      $("#cartBody").append(`
          <tr>
              <td>${productName}</td>
              <td>${productPrice.toFixed(2)}</td>
              <td><button class="btn btn-danger" onclick="removeFromCart(this)"><i class="fas fa-trash"></i></button></td>
          </tr>
      `);
    }

    updateCartTotal();
    showSuccessMessage("تمت إضافة المنتج إلى السلة");
    clearSalesFields();
    $("#client").prop("disabled", true);
  } else {
    showErrorMessage("يرجى إدخال بيانات صحيحة");
  }
}

function isValidDateFormat(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD format
  return regex.test(dateString);
}

function isValidDate(dateString) {
  const date = parseDate(dateString);
  if (!date || isNaN(date.getTime())) {
    return false; // Invalid date
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set time to midnight for accurate comparison

  return date <= today; // Ensure the date is not in the future
}

async function confirmSale() {
  const clientId = $("#client").val();
  const saleDate = $("#saleDate").val();
  const cartItems = [];

  $("#successMessage").hide();
  $("#errorMessage").hide();

  // Validate that the sale date is not in the future
  const today = new Date();
  const selectedDate = parseDate(saleDate); // Use your parseDate function

  if (selectedDate > today) {
    showErrorMessage(
      "لا يمكن إجراء عملية بيع بتاريخ مستقبلي. يرجى اختيار تاريخ اليوم أو تاريخ سابق."
    );
    return false;
  }
  if (!isValidDateFormat(saleDate) || !isValidDate(saleDate)) {
    showErrorMessage("تاريخ غير صحيح. يرجى إدخال تاريخ صحيح).");
    return false;
  }

  // Proceed with the sale if the date is valid
  $("#cartBody tr").each(function () {
    cartItems.push({
      name: $(this).find("td:nth-child(1)").text(),
      price: parseFloat($(this).find("td:nth-child(2)").text()),
    });
  });

  if (!clientId || cartItems.length === 0) {
    showErrorMessage("يرجى إضافة منتجات إلى السلة وتحديد العميل");
    return false;
  }

  try {
    const newTransaction = {
      id: await generateTransactionNumber(saleDate), // Use the generated transaction number
      clientId,
      date: formatDate(selectedDate), // Use the parsed and validated date
      items: cartItems,
      total: cartItems.reduce((sum, item) => sum + item.price, 0),
    };

    await dbOperations.addTransaction(newTransaction);

    $("#cartBody").empty();
    updateCartTotal();

    $("#client").prop("disabled", false).val("");
    $("#saleDate").val(toHTMLDate(new Date())); // Reset the date input to today's date

    await populateTransactions();
    await generateStatistics();
    await populateDueClientsTable(); // Refresh the due amounts report
    await generateSalesAccumulationChart();

    setTimeout(() => {
      showSuccessMessage("تمت عملية البيع بنجاح");
    }, 100);

    const navbarHeight = $(".navbar").outerHeight();
    const offset = navbarHeight + 80; // Add additional offset if needed
    $("html, body").animate(
      {
        scrollTop: $("#sales").offset().top - offset,
      },
      500
    );

    return true;
  } catch (error) {
    console.error("Error in confirmSale:", error);
    showErrorMessage("حدث خطأ أثناء حفظ المعاملة");
    return false;
  }
}

async function backupDatabase() {
  showLoading("جاري إنشاء نسخة احتياطية...");

  try {
    // Fetch all data from IndexedDB
    const clients = await dbOperations.getAllClients();
    const products = await dbOperations.getAllProducts();
    const transactions = await dbOperations.getAllTransactions();
    const transactionCounters = await dbOperations.getAllItems(
      "transactionCounters"
    );

    // Validate the data
    if (!clients || !products || !transactions || !transactionCounters) {
      throw new Error("فشل في جلب البيانات من قاعدة البيانات.");
    }

    // Format the data for backup
    const backupData = {
      clients: clients.map((client) => ({
        ...client,
        lastPaymentDate: formatDate(parseDate(client.lastPaymentDate)),
      })),
      products,
      transactions: transactions.map(normalizeTransaction),
      transactionCounters,
    };

    // Create and download the backup file
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;
    a.href = url;
    a.download = `backup_${timestamp}.json`;

    hideLoading();
    showSuccessMessage("تم إنشاء نسخة احتياطية بنجاح");

    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error creating backup:", error);
    hideLoading();
    showErrorMessage("حدث خطأ أثناء إنشاء النسخة الاحتياطية");
  }
}

async function restoreDatabase() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async function (e) {
    if (
      confirm(
        "هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيتم دمج البيانات الحالية مع النسخة الاحتياطية."
      )
    ) {
      const file = e.target.files[0];
      const reader = new FileReader();

      showLoading("جاري استعادة النسخة الاحتياطية...");

      reader.onload = async function (event) {
        try {
          const data = JSON.parse(event.target.result);

          // Validate the backup file structure
          if (
            !data.clients ||
            !data.products ||
            !data.transactions ||
            !data.transactionCounters
          ) {
            throw new Error("ملف النسخة الاحتياطية غير صالح: بيانات ناقصة.");
          }

          // Fetch existing data from IndexedDB
          const existingClients = await dbOperations.getAllClients();
          const existingProducts = await dbOperations.getAllProducts();
          const existingTransactions = await dbOperations.getAllTransactions();
          const existingCounters = await dbOperations.getAllItems(
            "transactionCounters"
          );

          // Merge clients
          const mergedClients = mergeData(existingClients, data.clients, "id");
          for (const client of mergedClients) {
            await dbOperations.addItem(STORES.clients, client);
          }

          // Merge products
          const mergedProducts = mergeData(
            existingProducts,
            data.products,
            "id"
          );
          for (const product of mergedProducts) {
            await dbOperations.addItem(STORES.products, product);
          }

          // Merge transactions
          const mergedTransactions = mergeData(
            existingTransactions,
            data.transactions,
            "id"
          );
          for (const transaction of mergedTransactions) {
            await dbOperations.addItem(STORES.transactions, transaction);
          }

          // Merge transaction counters
          const mergedCounters = mergeCounters(
            existingCounters,
            data.transactionCounters
          );
          for (const counter of mergedCounters) {
            await dbOperations.addItem("transactionCounters", counter);
          }

          hideLoading();
          showSuccessMessage(
            "تم استعادة النسخة الاحتياطية بنجاح مع دمج البيانات الحالية."
          );

          // Refresh the UI
          await populateClients();
          await populateProducts();
          await populateTransactions();
          await populateDueClientsTable();
          await generateStatistics();
          await renderTopClientsChart();
          await generateSalesAccumulationChart();
        } catch (error) {
          console.error("Error restoring database:", error);
          hideLoading();
          showErrorMessage("خطأ في تنسيق البيانات. يرجى التحقق من الملف.");
        }
      };

      reader.readAsText(file);
    }
  };

  input.click();
}

// Helper function to merge two arrays of data based on a unique key
function mergeData(existingData, backupData, key) {
  const mergedData = [...existingData];

  backupData.forEach((backupItem) => {
    const existingItem = existingData.find(
      (item) => item[key] === backupItem[key]
    );
    if (!existingItem) {
      // If the item doesn't exist in the existing data, add it
      mergedData.push(backupItem);
    } else {
      // If the item exists, update it with the backup data
      Object.assign(existingItem, backupItem);
    }
  });

  return mergedData;
}

// Helper function to merge transaction counters
function mergeCounters(existingCounters, backupCounters) {
  const mergedCounters = [...existingCounters];

  backupCounters.forEach((backupCounter) => {
    const existingCounter = existingCounters.find(
      (counter) => counter.id === backupCounter.id
    );
    if (!existingCounter) {
      // If the counter doesn't exist in the existing data, add it
      mergedCounters.push(backupCounter);
    } else {
      // If the counter exists, update it with the higher value
      existingCounter.value = Math.max(
        existingCounter.value,
        backupCounter.value
      );
    }
  });

  return mergedCounters;
}

async function populateClients() {
  try {
    const clients = await dbOperations.getAllClients();

    // Clear the dropdowns
    $("#client, #clientSelectReport").empty();
    $("#client, #clientSelectReport").append(
      `<option value="" disabled selected>اختر العميل</option>`
    );

    // Populate the dropdowns with client data
    clients.forEach((client) => {
      $("#client, #clientSelectReport").append(
        `<option value="${client.id}">${client.name}</option>`
      );
    });

    // Populate the clients table
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
            <button class="btn btn-danger" onclick="deleteClient(${client.id})"><i class="fas fa-trash"></i></button>
            <button class="btn btn-warning" onclick="editClient(${client.id})"><i class="fas fa-edit"></i></button>
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
          <td class="product-name">${product.name}</td>
          <td>
            <button class="btn btn-danger" onclick="deleteProduct(${product.id})"><i class="fas fa-trash"></i></button>
            <button class="btn btn-warning" onclick="editProduct(${product.id})"><i class="fas fa-edit"></i></button>
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

    // Sort transactions by Transaction id in descending order (latest first)
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

async function deleteClient(id) {
  if (confirm("هل أنت متأكد أنك تريد حذف هذا العميل؟")) {
    try {
      await dbOperations.deleteClient(id);
      showSuccessMessage("تم حذف العميل بنجاح");
      await populateClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      showErrorMessage("حدث خطأ أثناء حذف العميل");
    }
  }
}

async function deleteProduct(id) {
  if (confirm("هل أنت متأكد أنك تريد حذف هذا المنتج؟")) {
    try {
      await dbOperations.deleteProduct(id);
      showSuccessMessage("تم حذف المنتج بنجاح");
      await populateProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      showErrorMessage("حدث خطأ أثناء حذف المنتج");
    }
  }
}

async function generateStatistics() {
  try {
    const [clients, transactions] = await Promise.all([
      dbOperations.getAllClients(),
      dbOperations.getAllTransactions(),
    ]);

    const clientDebts = {};

    // Calculate client debts since their last payment date
    clients.forEach((client) => {
      const lastPaymentDate = parseDate(client.lastPaymentDate);

      if (!lastPaymentDate || isNaN(lastPaymentDate.getTime())) {
        clientDebts[client.id] = 0;
        return;
      }

      // Filter transactions for this client that occurred after the last payment date
      const clientTransactions = transactions.filter((transaction) => {
        const transactionDate = parseDate(transaction.date);
        return (
          transaction.clientId == client.id && // Use loose equality (==) to handle string vs. number
          transactionDate > lastPaymentDate
        );
      });

      // Calculate the total due amount for these transactions
      clientDebts[client.id] = clientTransactions.reduce(
        (sum, transaction) => sum + transaction.total,
        0
      );
    });

    // Sort clients by debt (descending) and take the top 10
    const sortedClients = Object.entries(clientDebts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = [];
    const data = [];
    const tableRows = [];

    sortedClients.forEach(([clientId, debt]) => {
      const client = clients.find((c) => c.id == clientId);
      if (client && debt > 0) {
        labels.push(client.name);
        data.push(debt);

        tableRows.push(`
          <tr>
            <td>${client.name}</td>
            <td>${debt.toFixed(2)}</td>
          </tr>
        `);
      }
    });

    // Update the table
    $("#topClientsTable tbody").html(tableRows.join(""));

    // Render the chart
    renderTopClientsChart(labels, data);
  } catch (error) {
    console.error("Error generating statistics:", error);
    showErrorMessage("حدث خطأ أثناء توليد الإحصائيات");
  }
}

// Other helper functions remain unchanged...

function parseDate(dateString) {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;

  // Handle "DD-MM-YYYY" format
  if (dateString.includes("-") && dateString.split("-")[0].length === 2) {
    const [day, month, year] = dateString.split("-").map(Number);
    if (month < 1 || month > 12) {
      console.error(`Invalid month in date: ${dateString}`);
      return null;
    }
    return new Date(year, month - 1, day);
  }

  // Handle "YYYY-MM-DD" format
  if (dateString.includes("-") && dateString.split("-")[0].length === 4) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  // Fallback to default Date parsing
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.error(`Invalid date format: ${dateString}`);
    return null;
  }
  return date;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${date.getFullYear()}`;
}

function toHTMLDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return ""; // Return empty string for invalid dates

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0"); // Ensure 2 digits for month
  const day = String(d.getDate()).padStart(2, "0"); // Ensure 2 digits for day

  return `${year}-${month}-${day}`; // Return date in YYYY-MM-DD format
}

async function isClientDuplicate(name, mobile, excludeId = null) {
  try {
    const clients = await dbOperations.getAllClients();

    // Check if a client with the same name or mobile number already exists
    return clients.some(
      (client) =>
        (client.name.toLowerCase() === name.toLowerCase() ||
          client.mobile === mobile) &&
        client.id !== excludeId // Exclude the current client during update
    );
  } catch (error) {
    console.error("Error checking for duplicate client:", error);
    return false; // Assume no duplicate in case of an error
  }
}

async function showTransactionDetails(transaction) {
  try {
    // Fetch clients from IndexedDB
    const clients = await dbOperations.getAllClients();

    // Find the client associated with the transaction
    const client = clients.find(
      (c) =>
        c.id === parseInt(transaction.clientId) || c.id === transaction.clientId
    );
    const clientName = client ? client.name : "غير معروف";

    // Build the transaction details HTML
    let detailsHtml = `
        <div class="mb-3">
            <strong>رقم المعاملة:</strong> ${transaction.id}<br>
            <strong>العميل:</strong> ${clientName}<br>
            <strong>التاريخ:</strong> ${transaction.date}<br>
            <strong>الإجمالي:</strong> ${transaction.total}
        </div>
        <h6>المنتجات:</h6>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>المنتج</th>
                    <th>السعر</th>
                </tr>
            </thead>
            <tbody>
      `;

    // Add each item in the transaction to the HTML
    transaction.items.forEach((item) => {
      detailsHtml += `
          <tr>
              <td>${item.name}</td>
              <td>${item.price}</td>
          </tr>
        `;
    });

    detailsHtml += "</tbody></table>";

    // Display the details in the modal
    $("#transactionDetails").html(detailsHtml);
    $("#transactionModal").modal("show");
  } catch (error) {
    console.error("Error showing transaction details:", error);
    showErrorMessage("حدث خطأ أثناء تحميل تفاصيل المعاملة");
  }
}

function showSuccessMessage(message) {
  $("#errorMessage").hide();
  $("#successMessage")
    .text(message)
    .css({
      display: "block",
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      "z-index": "9999",
      "background-color": "rgba(40, 167, 69, 0.9)",
      color: "white",
      padding: "15px 25px",
      "border-radius": "10px",
      "font-weight": "700",
      "text-align": "center",
      "min-width": "300px",
      "max-width": "80%",
    })
    .fadeIn(300)
    .delay(2400)
    .fadeOut(300);
}

function showErrorMessage(message) {
  $("#successMessage").hide();
  $("#errorMessage")
    .text(message)
    .css({
      display: "block",
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      "z-index": "9999",
      "background-color": "rgba(220, 53, 69, 0.9)",
      color: "white",
      padding: "15px 25px",
      "border-radius": "10px",
      "font-weight": "700",
      "text-align": "center",
      "min-width": "300px",
      "max-width": "80%",
    })
    .fadeIn(300)
    .delay(2400)
    .fadeOut(300);
}

function showLoading(message) {
  $(".loading-text").text(message);
  $(".loading-overlay").css("display", "flex");
}

function hideLoading() {
  $(".loading-overlay").css("display", "none");
}

function updateCartTotal() {
  let total = 0;
  $("#cartBody tr").each(function () {
    total += parseFloat($(this).find("td:nth-child(2)").text());
  });
  $("#cartTotal").text(`الإجمالي: ${total.toFixed(2)} جنيه`);
}

function removeFromCart(button) {
  $(button).closest("tr").remove();
  updateCartTotal();
  if ($("#cartBody tr").length === 0) {
    $("#client").prop("disabled", false);
  }
}

function clearSalesFields() {
  $("#productSelect").val("");
  $("#productPrice").val("");
}

function addPagination(tableId, paginationContainerId, totalItems) {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  let paginationHtml = `
      <nav aria-label="Page navigation">
        <ul class="pagination justify-content-center my-auto">
            <li class="page-item ${currentPageMap[tableId] === 1 ? "disabled" : ""
    }">
                <a class="page-link" href="#" onclick="changePage(${currentPageMap[tableId] - 1
    }, '${tableId}')" tabindex="-1">السابق</a>
            </li>
            ${(() => {
      const maxVisiblePages = 4;
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(
        1,
        currentPageMap[tableId] - halfVisible
      );
      let endPage = Math.min(
        totalPages,
        currentPageMap[tableId] + halfVisible
      );

      if (endPage - startPage < maxVisiblePages - 1) {
        if (startPage === 1) {
          endPage = Math.min(
            totalPages,
            startPage + maxVisiblePages - 1
          );
        } else if (endPage === totalPages) {
          startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
      }

      return Array.from(
        { length: endPage - startPage + 1 },
        (_, i) => `
                    <li class="page-item ${currentPageMap[tableId] === startPage + i ? "active" : ""
          }">
                        <a class="page-link" href="#" onclick="changePage(${startPage + i
          }, '${tableId}')">${startPage + i}</a>
                    </li>
                `
      ).join("");
    })()}
            <li class="page-item ${currentPageMap[tableId] === totalPages ? "disabled" : ""
    }">
                <a class="page-link" href="#" onclick="changePage(${currentPageMap[tableId] + 1
    }, '${tableId}')">التالي</a>
            </li>
        </ul>
      </nav>
    `;
  $(`#${paginationContainerId}`).html(paginationHtml);
}

function renderTopClientsChart(labels, data) {
  const ctx = document.getElementById("topClientsChart").getContext("2d");

  // Destroy the existing chart if it exists
  if (
    window.topClientsChart &&
    typeof window.topClientsChart.destroy === "function"
  ) {
    window.topClientsChart.destroy();
  }

  // Create a new chart
  window.topClientsChart = new Chart(ctx, {
    type: "bar", // Use a bar chart
    data: {
      labels: labels, // Client names on the X-axis
      datasets: [
        {
          label: "المبلغ المستحق (جنيه)",
          data: data, // Total due on the Y-axis
          backgroundColor: "rgba(0, 47, 255, 0.8)",
          borderColor: "rgb(0, 47 , 255)",
          borderWidth: 1,
          borderRadius: 3, // Rounded corners for bars
          barThickness: 10, // Adjust bar thickness
        },
      ],
    },
    options: {
      indexAxis: "x", // Make the chart vertical (default is "y" for horizontal)
      responsive: true,
      maintainAspectRatio: true, // Allow custom aspect ratio
      plugins: {
        legend: {
          display: false, // Hide the legend
        },
        tooltip: {
          callbacks: {
            label: (context) => `المبلغ: ${context.raw.toFixed(2)} جنيه`, // Tooltip format
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: {
              size: 14,
            },
            color: "#2c3e50", // Dark gray color for X-axis labels
            maxRotation: 90, // Rotate labels by 90 degrees
            minRotation: 90, // Ensure labels are always rotated
          },
          title: {
            display: false, // Hide X-axis title
            text: "العملاء", // X-axis title
            font: {
              size: 16,
              weight: "bold",
            },
            color: "#2c3e50", // Dark gray color for X-axis title
          },
          grid: {
            display: false, // Hide grid lines on X-axis
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              size: 14,
            },
            color: "#2c3e50", // Dark gray color for Y-axis labels
          },
          title: {
            display: false, // Hide Y-axis title
            text: "المبلغ المستحق (جنيه)", // Y-axis title
            font: {
              size: 16,
              weight: "bold",
            },
            color: "#2c3e50", // Dark gray color for Y-axis title
          },
          grid: {
            color: "#eee", // Light gray grid lines for Y-axis
          },
        },
      },
      // Add 3D effect using the "chartjs-plugin-3d" plugin
      plugins: {
        "3d": {
          enabled: true, // Enable 3D effect
          depth: 10, // Depth of the bars
          alpha: 15, // Rotation angle
          beta: 15, // Tilt angle
        },
      },
    },
  });
}

function addNumber(number) {
  const priceInput = $("#productPrice");
  const currentValue = priceInput.val();
  if (number === "." && currentValue.includes(".")) return;
  priceInput.val(currentValue + number);
}

function clearPrice() {
  $("#productPrice").val("");
}

window.changePage = function (page, tableId) {
  currentPageMap[tableId] = page;
  if (tableId === "dueAmountsTable") {
    populateDueClientsTable();
  } else if (tableId === "clientTable") {
    populateClients();
  } else if (tableId === "productTable") {
    populateProducts();
  } else if (tableId === "transactionTable") {
    populateTransactions();
  } else if (tableId === "salesReportTable") {
    generateSalesReport();
  } else if (tableId === "clientReportTable") {
    generateClientReport();
  }

  ////
  const navbarHeight = $(".navbar").outerHeight();
  const offset = navbarHeight + 80; // Add additional offset if needed
  $("html, body").animate(
    {
      scrollTop: $(`#${tableId}`).offset().top - offset,
    },
    500
  );
  ////
};

async function generateTransactionNumber(transactionDate = null) {
  try {
    // If no date is provided, use current date
    const date = transactionDate ? new Date(transactionDate) : new Date();

    // Extract date components from the provided/current date
    const year = String(date.getFullYear()).slice(-2); // YY
    const month = String(date.getMonth() + 1).padStart(2, "0"); // MM
    const day = String(date.getDate()).padStart(2, "0"); // DD

    // Create a unique key for this date to track counters separately for each date
    const dateKey = `${year}${month}${day}`;

    // Fetch counters from IndexedDB
    let counters = await dbOperations.getItem("transactionCounters", dateKey);
    if (!counters) {
      counters = { id: dateKey, value: 0 }; // Initialize if not found
    }

    // Increment the counter for this specific date
    counters.value++;

    // Save updated counters back to IndexedDB
    await dbOperations.updateItem("transactionCounters", counters);

    // Format the counter to 3 digits
    const counterStr = String(counters.value).padStart(3, "0");

    // Combine all parts to form the transaction number
    return `${year}${month}${day}${counterStr}`;
  } catch (error) {
    console.error("Error generating transaction number:", error);
    return "000000000"; // Fallback transaction number
  }
}

// Helper function to ensure transaction structure
function normalizeTransaction(transaction) {
  return {
    id: transaction.id,
    clientId: transaction.clientId,
    date: formatDate(parseDate(transaction.date)),
    items: Array.isArray(transaction.items) ? transaction.items : [],
    total: parseFloat(transaction.total) || 0,
  };
}

async function editClient(id) {
  try {
    const clients = await dbOperations.getAllClients();
    const client = clients.find((c) => c.id === id);

    if (client) {
      // Populate the form with the client's data
      $("#clientName").val(client.name);
      $("#clientMobile").val(client.mobile);
      $("#lastPaymentDate").val(toHTMLDate(parseDate(client.lastPaymentDate)));

      // Change the button text and behavior
      $("#addClient")
        .text("تحديث العميل")
        .off("click")
        .on("click", function () {
          updateClient(id);
        });

      // Show the cancel button
      $("#cancelUpdate").show();

      // Scroll to the top of the clients section
      $("html, body").animate(
        {
          scrollTop: $("#clients").offset().top,
        },
        500
      );
    } else {
      showErrorMessage("العميل غير موجود");
    }
  } catch (error) {
    console.error("Error editing client:", error);
    showErrorMessage("حدث خطأ أثناء تحميل بيانات العميل");
  }
}

async function updateClient(id) {
  const clientName = $("#clientName").val().trim();
  const clientMobile = $("#clientMobile").val().trim();
  const lastPaymentDate = $("#lastPaymentDate").val();

  // Validate inputs
  if (!clientName || !clientMobile || !lastPaymentDate) {
    showErrorMessage("يرجى إدخال جميع البيانات المطلوبة");
    return;
  }

  // Validate mobile number format
  if (!isValidEgyptianMobileNumber(clientMobile)) {
    showErrorMessage("يرجى إدخال رقم هاتف محمول صحيح");
    return;
  }

  // Check for duplicate client name or mobile number, excluding the current client
  const isDuplicate = await isClientDuplicate(clientName, clientMobile, id);
  if (isDuplicate) {
    showErrorMessage(
      "اسم العميل أو رقم التليفون موجود بالفعل. يرجى إدخال بيانات مختلفة."
    );
    return;
  }

  try {
    const updatedClient = {
      id: id,
      name: clientName,
      mobile: clientMobile,
      lastPaymentDate: formatDate(parseDate(lastPaymentDate)),
    };

    await dbOperations.updateClient(updatedClient);
    showSuccessMessage("تم تحديث العميل بنجاح");
    clearClientForm();
    await populateClients();
  } catch (error) {
    console.error("Error updating client:", error);
    showErrorMessage("حدث خطأ أثناء تحديث العميل");
  }
}

async function editProduct(id) {
  try {
    const products = await dbOperations.getAllProducts();
    const product = products.find((p) => p.id === id);

    if (product) {
      // Populate the form with the product's data
      $("#productName").val(product.name);

      // Change the button text and behavior
      $("#addProduct")
        .text("تحديث المنتج")
        .off("click")
        .on("click", function () {
          updateProduct(id);
        });
      // Scroll to the top of the clients section
      $("html, body").animate(
        {
          scrollTop: $("#products").offset().top,
        },
        500
      );
    } else {
      showErrorMessage("المنتج غير موجود");
    }
  } catch (error) {
    console.error("Error editing product:", error);
    showErrorMessage("حدث خطأ أثناء تحميل بيانات المنتج");
  }
}

async function updateProduct(id) {
  const productName = $("#productName").val().trim();

  if (!productName) {
    showErrorMessage("يرجى إدخال اسم المنتج");
    return;
  }

  try {
    const updatedProduct = {
      id: id,
      name: productName,
    };

    await dbOperations.updateProduct(updatedProduct);
    showSuccessMessage("تم تحديث المنتج بنجاح");
    clearProductForm();
    await populateProducts();
  } catch (error) {
    console.error("Error updating product:", error);
    showErrorMessage("حدث خطأ أثناء تحديث المنتج");
  }
}

function clearClientForm() {
  $("#clientName").val("");
  $("#clientMobile").val("");
  $("#lastPaymentDate").val("");
  $("#addClient").text("إضافة عميل").off("click").on("click", addClient);
  $("#cancelUpdate").hide();
}

function clearProductForm() {
  $("#productName").val("");
  $("#addProduct").text("إضافة منتج").off("click").on("click", addProduct);
}

$("#cancelUpdate").click(function () {
  clearClientForm();
});

async function generateSalesReport() {
  const startDateInput = $("#reportStartDate").val();
  const endDateInput = $("#reportEndDate").val();

  // Parse dates
  const startDate = parseDate(startDateInput);
  const endDate = parseDate(endDateInput);

  // Validate dates
  if (!startDate || !endDate) {
    showErrorMessage("يرجى تحديد تاريخ البداية والنهاية");
    return;
  }

  // Ensure end date is not in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set time to midnight for accurate comparison
  if (endDate > today) {
    showErrorMessage("تاريخ النهاية لا يمكن أن يكون في المستقبل");
    return;
  }

  // Ensure start date is before end date
  if (startDate > endDate) {
    showErrorMessage("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    return;
  }

  try {
    // Fetch all transactions from IndexedDB
    const transactions = await dbOperations.getAllTransactions();

    // Filter transactions based on the date range
    const filteredTransactions = transactions.filter((transaction) => {
      const transactionDate = parseDate(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Sort transactions by date in descending order (newest first)
    filteredTransactions.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateB - dateA; // Sort in descending order
    });

    // Calculate total sales, number of transactions, and average sale amount
    const totalSales = filteredTransactions.reduce(
      (sum, transaction) => sum + transaction.total,
      0
    );
    const numberOfTransactions = filteredTransactions.length;
    const averageSaleAmount =
      numberOfTransactions > 0 ? totalSales / numberOfTransactions : 0;

    // Display the summary
    $("#salesReportSummary").html(`
      <div class="alert alert-info">
        <strong>إجمالي المبيعات:</strong> ${totalSales.toFixed(2)} جنيه<br>
        <strong>عدد المعاملات:</strong> ${numberOfTransactions}<br>
        <strong>متوسط قيمة المعاملة:</strong> ${averageSaleAmount.toFixed(
      2
    )} جنيه
      </div>
    `);

    // Populate the report table with filtered transactions
    populateReportTable(filteredTransactions);

    // Add pagination for the report table
    addPagination(
      "salesReportTable",
      "salesReportPagination",
      filteredTransactions.length
    );
  } catch (error) {
    console.error("Error generating sales report:", error);
    showErrorMessage("حدث خطأ أثناء توليد التقرير");
  }
}
async function populateReportTable(transactions) {
  try {
    const clients = await dbOperations.getAllClients(); // Fetch clients from IndexedDB
    $("#salesReportTable tbody").empty();

    const start = (currentPageMap.salesReportTable - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedTransactions = transactions.slice(start, end);

    if (paginatedTransactions.length > 0) {
      paginatedTransactions.forEach((transaction) => {
        const client = clients.find(
          (c) =>
            c.id === parseInt(transaction.clientId) ||
            c.id === transaction.clientId
        );
        const clientName = client ? client.name : "غير معروف";
        $("#salesReportTable tbody").append(`
            <tr>
              <td>${transaction.id}</td>
              <td>${clientName}</td>
              <td>${transaction.date}</td>
              <td>${transaction.total}</td>
            </tr>
          `);
      });
    } else {
      $("#salesReportTable tbody").append(`
          <tr>
            <td colspan="4">لا توجد معاملات في هذه الفترة</td>
          </tr>
        `);
    }

    addPagination(
      "salesReportTable",
      "salesReportPagination",
      transactions.length
    );
  } catch (error) {
    console.error("Error populating report table:", error);
    showErrorMessage("حدث خطأ أثناء تحميل بيانات التقرير");
  }
}

async function generateClientReport() {
  try {
    const clientId = $("#clientSelectReport").val();
    if (!clientId) {
      showErrorMessage("يرجى اختيار العميل");
      return;
    }

    const clients = await dbOperations.getAllClients();
    const client = clients.find((c) => c.id == clientId);
    if (!client || !client.lastPaymentDate) {
      showErrorMessage("بيانات العميل غير مكتملة");
      return;
    }

    const lastPaymentDate = parseDate(client.lastPaymentDate);
    const transactions = await dbOperations.getAllTransactions();
    const filteredTransactions = transactions.filter((transaction) => {
      const transactionDate = parseDate(transaction.date);
      return (
        transaction.clientId == clientId && transactionDate > lastPaymentDate
      );
    });

    $("#clientReportTable tbody").empty();
    let totalOwed = 0;

    const start = (currentPageMap.clientReportTable - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedTransactions = filteredTransactions.slice(start, end);

    paginatedTransactions.forEach((transaction) => {
      const formattedDate = formatDate(parseDate(transaction.date));
      const rowCount = transaction.items.length;

      // Add a row for the transaction header
      $("#clientReportTable tbody").append(`
        <tr>
          <td rowspan="${rowCount}">${transaction.id}</td>
          <td rowspan="${rowCount}">${formattedDate}</td>
          <td>${transaction.items[0].name}</td>
          <td>${transaction.items[0].price.toFixed(2)}</td>          
        </tr>
      `);

      // Add rows for the remaining items in the transaction
      for (let i = 1; i < transaction.items.length; i++) {
        $("#clientReportTable tbody").append(`
          <tr>
            <td>${transaction.items[i].name}</td>
            <td>${transaction.items[i].price.toFixed(2)}</td>
          </tr>
        `);
      }

      // Calculate total owed for this transaction
      totalOwed += transaction.items.reduce((sum, item) => sum + item.price, 0);
    });

    // Add a summary row for total owed
    $("#clientReportTable tbody").append(`
        <tr class="table-info">
          <td colspan="2">إجمالي المستحق بعد آخر دفعة</td>
          <td colspan="2">${totalOwed.toFixed(2)}</td>
        </tr>
      `);

    // Add pagination for the client report table
    addPagination(
      "clientReportTable",
      "clientReportPagination",
      filteredTransactions.length
    );
  } catch (error) {
    console.error("Error generating client report:", error);
    showErrorMessage("حدث خطأ أثناء توليد التقرير");
  }
}

async function filterClients() {
  try {
    const searchValue = $("#clientSearch").val().toLowerCase(); // Get the search input value
    const clients = await dbOperations.getAllClients(); // Fetch all clients from IndexedDB

    // Clear the dropdown
    $("#client").empty();
    $("#client").append(
      `<option value="" disabled selected>اختر العميل</option>`
    );

    // Filter clients based on the search input
    clients.forEach((client) => {
      if (client.name.toLowerCase().includes(searchValue)) {
        $("#client").append(
          `<option value="${client.id}">${client.name}</option>`
        );
      }
    });
  } catch (error) {
    console.error("Error filtering clients:", error);
    showErrorMessage("حدث خطأ أثناء تصفية العملاء");
  }
}

async function filterClientsReport() {
  try {
    const searchValue = $("#clientSearchReport").val().toLowerCase();
    const clients = await dbOperations.getAllClients();

    // Clear the dropdown
    $("#clientSelectReport").empty();
    $("#clientSelectReport").append(
      `<option value="" disabled selected>اختر العميل</option>`
    );

    // Filter clients based on the search input
    clients.forEach((client) => {
      if (client.name.toLowerCase().includes(searchValue)) {
        $("#clientSelectReport").append(
          `<option value="${client.id}">${client.name}</option>`
        );
      }
    });
  } catch (error) {
    console.error("Error filtering clients report:", error);
    showErrorMessage("حدث خطأ أثناء تصفية العملاء");
  }
}

async function isClientDuplicate(name, mobile, excludeId = null) {
  try {
    const clients = await dbOperations.getAllClients();

    // Check if a client with the same name or mobile number already exists
    return clients.some(
      (client) =>
        (client.name.toLowerCase() === name.toLowerCase() ||
          client.mobile === mobile) &&
        client.id !== excludeId // Exclude the current client during update
    );
  } catch (error) {
    console.error("Error checking for duplicate client:", error);
    return false; // Assume no duplicate in case of an error
  }
}

function validateTransactions(transactions) {
  if (!Array.isArray(transactions)) {
    return false; // Transactions must be an array
  }

  for (const transaction of transactions) {
    // Check if required fields exist
    if (
      !transaction.id ||
      !transaction.clientId ||
      !transaction.date ||
      !transaction.items ||
      !Array.isArray(transaction.items) ||
      transaction.items.length === 0 || // At least 1 item per transaction
      typeof transaction.total !== "number"
    ) {
      return false; // Invalid transaction structure
    }

    // Validate items in the transaction
    for (const item of transaction.items) {
      if (!item.name || typeof item.price !== "number" || item.price <= 0) {
        return false; // Invalid item structure
      }
    }

    // Validate total matches the sum of item prices
    const calculatedTotal = transaction.items.reduce(
      (sum, item) => sum + item.price,
      0
    );
    if (calculatedTotal !== transaction.total) {
      return false; // Total does not match the sum of item prices
    }
  }

  return true; // All transactions are valid
}

async function filterTransactions() {
  try {
    const searchValue = $("#transactionSearch").val().toLowerCase(); // Get the search input value
    const transactions = await dbOperations.getAllTransactions(); // Fetch all transactions from IndexedDB
    const clients = await dbOperations.getAllClients(); // Fetch all clients for client name lookup

    // Clear the transaction table
    $("#transactionTable").empty();

    // Filter transactions based on the search input
    const filteredTransactions = transactions.filter((transaction) => {
      const client = clients.find((c) => c.id == transaction.clientId);
      const clientName = client ? client.name.toLowerCase() : "غير معروف";
      return (
        transaction.id.toString().includes(searchValue) || // Search by transaction ID
        clientName.includes(searchValue) || // Search by client name
        transaction.date.includes(searchValue) || // Search by transaction date
        transaction.total.toString().includes(searchValue) // Search by total amount
      );
    });

    // Sort transactions by ID in descending order (newest first)
    filteredTransactions.sort((a, b) => b.id - a.id);

    // Populate the transaction table with filtered transactions
    const start = (currentPageMap.transactionTable - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedTransactions = filteredTransactions.slice(start, end);

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

    // Add pagination for the transaction table
    addPagination(
      "transactionTable",
      "transactionPagination",
      filteredTransactions.length
    );

    // Add click event listeners to transaction rows
    $(".transaction-row").click(function () {
      const transaction = $(this).data("transaction");
      showTransactionDetails(transaction);
    });
  } catch (error) {
    console.error("Error filtering transactions:", error);
    showErrorMessage("حدث خطأ أثناء تصفية المعاملات");
  }
}

// Function to generate the sales accumulation chart
async function generateSalesAccumulationChart() {
  const period = $("#salesPeriod").val(); // Get the selected period (day, week, month)
  const transactions = await dbOperations.getAllTransactions(); // Fetch all transactions

  // Group transactions by the selected period
  const groupedData = groupTransactionsByPeriod(transactions, period);

  // Prepare data for the chart
  const labels = Object.keys(groupedData);
  const revenueData = Object.values(groupedData).map((group) => group.revenue);
  const transactionCountData = Object.values(groupedData).map(
    (group) => group.count
  );

  // Get the canvas element
  const ctx = document
    .getElementById("salesAccumulationChart")
    .getContext("2d");

  // Destroy the existing chart if it exists
  if (
    window.salesAccumulationChart &&
    typeof window.salesAccumulationChart.destroy === "function"
  ) {
    window.salesAccumulationChart.destroy();
  }

  // Create a new chart
  window.salesAccumulationChart = new Chart(ctx, {
    type: "bar", // Use a bar chart
    data: {
      labels: labels, // Period labels (days, weeks, months)
      datasets: [
        {
          label: "الإيرادات (جنيه)", // Revenue dataset
          data: revenueData,
          backgroundColor: "rgba(54, 162, 235, 0.6)", // Blue color for revenue
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
        {
          label: "عدد المعاملات", // Transaction count dataset
          data: transactionCountData,
          backgroundColor: "rgba(75, 192, 192, 0.6)", // Green color for transactions
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true, // Make the chart responsive
      maintainAspectRatio: false, // Allow the chart to adjust its aspect ratio
      plugins: {
        legend: {
          display: true, // Show legend
          position: "top", // Position legend at the top
          labels: {
            font: {
              size: window.innerWidth <= 768 ? 12 : 14, // Smaller font for mobile
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const value = context.raw || 0;
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "الفترة", // X-axis title
            font: {
              size: window.innerWidth <= 768 ? 12 : 14, // Smaller font for mobile
            },
          },
          ticks: {
            font: {
              size: window.innerWidth <= 768 ? 10 : 12, // Smaller font for mobile
            },
            color: "#2c3e50", // Dark gray color for X-axis labels
            maxRotation: 90, // Rotate labels for better readability
            minRotation: 90, // Ensure labels are always rotated
          },
          grid: {
            display: false, // Hide grid lines on X-axis
          },
        },
        y: {
          title: {
            display: true,
            text: "القيمة", // Y-axis title
            font: {
              size: window.innerWidth <= 768 ? 12 : 14, // Smaller font for mobile
            },
          },
          ticks: {
            font: {
              size: window.innerWidth <= 768 ? 10 : 12, // Smaller font for mobile
            },
            color: "#2c3e50", // Dark gray color for Y-axis labels
          },
          grid: {
            color: "#eee", // Light gray grid lines for Y-axis
          },
        },
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
        },
      },
    },
  });
}

// Function to group transactions by period (day, week, month)
function groupTransactionsByPeriod(transactions, period) {
  const groupedData = {};

  // Get the current date
  const currentDate = new Date();

  // Calculate the start date for the last 10 periods
  let startDate;
  if (period === "day") {
    startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 9); // Last 10 days
  } else if (period === "week") {
    startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 9 * 7); // Last 10 weeks
  } else if (period === "month") {
    startDate = new Date(currentDate);
    startDate.setMonth(currentDate.getMonth() - 9); // Last 10 months
  }

  // Filter transactions within the last 10 periods
  transactions.forEach((transaction) => {
    const transactionDate = parseDate(transaction.date);

    // Skip transactions outside the last 10 periods
    if (transactionDate < startDate) return;

    let key;

    if (period === "day") {
      // Group by day
      key = formatDate(transactionDate); // Format as DD-MM-YYYY
    } else if (period === "week") {
      // Group by week (starting from Saturday)
      const weekStart = getWeekStartDate(transactionDate);
      key = formatDate(weekStart); // Format as DD-MM-YYYY (start of the week)
    } else if (period === "month") {
      // Group by month
      key = `${transactionDate.getFullYear()}-${String(
        transactionDate.getMonth() + 1
      ).padStart(2, "0")}`; // Format as YYYY-MM
    }

    if (!groupedData[key]) {
      groupedData[key] = { revenue: 0, count: 0 };
    }

    groupedData[key].revenue += transaction.total;
    groupedData[key].count += 1;
  });

  // Sort the grouped data by date (ascending)
  const sortedKeys = Object.keys(groupedData).sort((a, b) => {
    const dateA = period === "month" ? new Date(a) : parseDate(a);
    const dateB = period === "month" ? new Date(b) : parseDate(b);
    return dateA - dateB;
  });

  // Limit the result to the last 10 periods
  const last10Keys = sortedKeys.slice(-10);
  const result = {};

  last10Keys.forEach((key) => {
    result[key] = groupedData[key];
  });

  return result;
}

// Function to get the start of the week (Saturday)
function getWeekStartDate(date) {
  const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - ((dayOfWeek + 1) % 7)); // Adjust to start from Saturday
  return startOfWeek;
}

// Event listener for the period dropdown
$("#salesPeriod").change(function () {
  generateSalesAccumulationChart();
});

// Initialize the sales accumulation chart when the page loads
$(document).ready(function () {
  generateSalesAccumulationChart();
});
// Add event listener for the export button
$("#exportClientReportPDF").click(exportClientReportPDF);
$("#SharetClientReportWhatsApp").click(SharetClientReportWhatsApp);
//$("#ShareBackupWhatsApp").click(ShareBackupWhatsApp);
// Initialize statistics generation

document
  .getElementById("ShareBackupWhatsApp")
  .addEventListener("click", async () => {
    try {
      await ShareBackupWhatsApp();
    } catch (error) {
      console.error("Error sharing backup:", error);
      showErrorMessage("حدث خطأ أثناء مشاركة النسخة الاحتياطية");
    }
  });

// Handle window resize to redraw the chart
$(window).resize(function () {
  if (window.salesAccumulationChart) {
    window.salesAccumulationChart.resize(); // Resize the chart
  }
});

async function ShareBackupWhatsApp() {
  try {
    // Fetch all data from IndexedDB
    const clients = await dbOperations.getAllClients();
    const products = await dbOperations.getAllProducts();
    const transactions = await dbOperations.getAllTransactions();
    const transactionCounters = await dbOperations.getAllItems(
      "transactionCounters"
    );

    // Validate the data
    if (!clients || !products || !transactions || !transactionCounters) {
      throw new Error("فشل في جلب البيانات من قاعدة البيانات.");
    }

    // Format the data for backup
    const backupData = {
      clients: clients.map((client) => ({
        ...client,
        lastPaymentDate: formatDate(parseDate(client.lastPaymentDate)),
      })),
      products,
      transactions: transactions.map(normalizeTransaction),
      transactionCounters,
    };

    // Convert the backup data to a JSON string
    const jsonString = JSON.stringify(backupData, null, 2);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: "text/plain" });

    // Create a File object from the Blob
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;
    const file = new File([blob], `backup_${timestamp}.txt`, {
      type: "text/plain",
    });

    // Check if the Web Share API is supported
    if (navigator.share) {
      // Use the Web Share API to share the file
      await navigator.share({
        title: "Backup File",
        files: [file],
      });

      showSuccessMessage("تم مشاركة النسخة الاحتياطية بنجاح");
    } else {
      // Fallback: Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      showErrorMessage(
        "المشاركة عبر واتساب غير مدعومة في هذا المتصفح. تم تنزيل النسخة الاحتياطية بدلاً من ذلك."
      );
    }
  } catch (error) {
    console.error("Error sharing backup:", error);
    showErrorMessage("حدث خطأ أثناء مشاركة النسخة الاحتياطية");
  }
}

async function backupDatabase() {
  showLoading("جاري إنشاء نسخة احتياطية...");
  try {
    // Fetch data (previous logic remains the same)
    const clients = await dbOperations.getAllClients();
    const products = await dbOperations.getAllProducts();
    const transactions = await dbOperations.getAllTransactions();
    const transactionCounters = await dbOperations.getAllItems(
      "transactionCounters"
    );

    if (!clients || !products || !transactions || !transactionCounters) {
      throw new Error("فشل في جلب البيانات من قاعدة البيانات.");
    }

    const backupData = {
      clients: clients.map((client) => ({
        ...client,
        lastPaymentDate: formatDate(parseDate(client.lastPaymentDate)),
      })),
      products,
      transactions: transactions.map(normalizeTransaction),
      transactionCounters,
    };

    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;
    const fileName = `backup_${timestamp}.json`;

    // Create blob
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });

    // Directly check and share
    if (navigator.canShare && navigator.share) {
      const shareData = {
        title: "Database Backup",
        text: "Backup JSON file",
        files: [new File([blob], fileName, { type: "application/json" })],
      };

      try {
        await navigator.share(shareData);
        hideLoading();
        showSuccessMessage("تم مشاركة النسخة الاحتياطية بنجاح");
      } catch (error) {
        console.error("Share error:", error);
        downloadBackup(blob, fileName);
      }
    } else {
      downloadBackup(blob, fileName);
    }
  } catch (error) {
    console.error("Backup error:", error);
    hideLoading();
    showErrorMessage("حدث خطأ أثناء إنشاء النسخة الاحتياطية");
  }
}

function downloadBackup(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  hideLoading();
  showSuccessMessage("تم إنشاء نسخة احتياطية بنجاح");
}
// Function to clear the entire database
async function clearDatabase() {
  if (
    confirm(
      "هل أنت متأكد أنك تريد مسح قاعدة البيانات بالكامل؟ هذه العملية لا يمكن التراجع عنها!"
    )
  ) {
    showLoading("جاري مسح قاعدة البيانات...");

    try {
      // Clear all stores
      await dbOperations.clearStore(STORES.clients);
      await dbOperations.clearStore(STORES.products);
      await dbOperations.clearStore(STORES.transactions);
      await dbOperations.clearStore("transactionCounters");

      // Refresh the UI
      await populateClients();
      await populateProducts();
      await populateTransactions();
      await populateDueClientsTable();
      await generateStatistics();
      await generateSalesAccumulationChart();

      hideLoading();
      showSuccessMessage("تم مسح قاعدة البيانات بالكامل بنجاح");
    } catch (error) {
      console.error("Error clearing database:", error);
      hideLoading();
      showErrorMessage("حدث خطأ أثناء مسح قاعدة البيانات");
    }
  }
}

// Add an event listener for the Clear Database button
$("#clearDatabase").click(clearDatabase);
