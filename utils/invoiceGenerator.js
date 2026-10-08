const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Generates an invoice PDF from an HTML template using Puppeteer.
 */
async function generateInvoicePDF(data) {
  // Read logo and signature if they exist
  let logoSrc = '';
  let signatureSrc = '';

  try {
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath).toString('base64');
      logoSrc = `data:image/png;base64,${logoData}`;
    }
  } catch (e) { }

  try {
    const signPath = path.join(__dirname, '../assets/signature.png');
    if (fs.existsSync(signPath)) {
      const signData = fs.readFileSync(signPath).toString('base64');
      signatureSrc = `data:image/png;base64,${signData}`;
    }
  } catch (e) { }

  const formattedOriginal = formatCurrency(data.originalAmount);
  const formattedDiscount = formatCurrency(data.discountAmount);
  const formattedFinal = formatCurrency(data.finalAmount);

  // HTML Template matching the clean, modern Dribbble design
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0f172a;
      --accent: #00b4d8;
      --accent-light: #caf0f8;
      --bg-gray: #f8fafc;
      --bg-green: #ecfdf5;
      --text-main: #334155;
      --text-light: #64748b;
      --border: #e2e8f0;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      color: var(--text-main);
      background: white;
      font-size: 14px;
    }

    .container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 30px 40px;
      box-sizing: border-box;
    }
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-
items: flex-start;
      margin-bottom: 30px;
    }
    .logo-container {
      max-width: 300px;
    }
    .logo-img {
      max-width: 175px;
      height: auto;
    }
    .logo-text {
      font-size: 42px;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -1px;
      margin: 0;
    }
    .logo-text span {
      color: var(--accent);
    }
    .logo-tagline {
      font-size: 10px;
      color: var(--text-light);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 5px;
    }
    
    .invoice-title {
      text-align: right;
    }
    .invoice-title h4 {
      font-size: 14px;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 4px;
      margin: 0 0 5px 0;
      font-weight: 600;
    }
    .invoice-title h1 {
      font-size: 46px;
      color: var(--primary);
      margin: 0 0 5px 0;
      font-weight: 800;
      letter-spacing: -1px;
    }
    .invoice-title p {
      font-size: 16px;
      color: var(--text-light);
      margin: 0;
    }

    /* Info Cards */
    .info-cards {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      flex: 1;
      background: var(--bg-gray);
      border-radius: 8px;
      padding: 20px;
      position: relative;
    }
    .card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20px;
      bottom: 20px;
      width: 4px;
      background: var(--accent);
      border-radius: 0 4px 4px 0;
    }
    .card-title {
      font-size: 12px;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .card-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 16px;
    }
    .card-detail {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-main);
      margin-bottom: 8px;
      font-size: 14px;
    }
    .card-detail svg {
      width: 16px;
      height: 16px;
      color: var(--text-light);
    }

    /* Table */
    .table-container {
      margin-bottom: 24px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: var(--primary);
      color: white;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 16px 20px;
      text-align: left;
    }
    th.right { text-align: right; }
    th.center { text-align: center; }
    
    td {
      padding: 20px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    td.desc { font-weight: 600; color: var(--primary); }
    td.right { text-align: right; font-weight: 500; }
    td.center { text-align: center; font-weight: 500; }

    /* Totals */
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .totals {
      width: 320px;
      background: var(--bg-gray);
      border-radius: 8px;
      padding: 16px 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      color: var(--text-light);
    }
    .total-row.discount {
      color: #059669;
    }
    .total-final {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      padding: 16px 20px;
      background: var(--accent-light);
      border-radius: 8px;
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      margin: 12px -20px -20px -20px;
    }

    /* Payment Details Box */
    .payment-box {
      display: flex;
      align-items: center;
      gap: 20px;
      background: var(--bg-green);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .payment-icon {
      width: 48px;
      height: 48px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .payment-icon svg { width: 24px; height: 24px; }
    
    .payment-info h5 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--text-light);
    }
    .payment-info p {
      margin: 0 0 4px 0;
      font-size: 14px;
      color: var(--text-main);
    }
    .payment-info p span { color: var(--text-light); }
    .status-badge {
      color: #10b981;
      font-weight: 700;
      font-size: 16px;
    }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .notes {
      flex: 1;
    }
    .notes-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--primary);
      margin-bottom: 8px;
    }
    .notes p {
      margin: 0 0 4px 0;
      font-size: 12px;
      color: var(--text-light);
    }
    .signature {
      text-align: center;
      width: 250px;
    }
    .sig-img {
      max-width: 150px;
      height: auto;
      margin-bottom: 10px;
    }
    .sig-text {
      font-family: 'Brush Script MT', cursive;
      font-size: 32px;
      color: var(--primary);
      margin-bottom: 10px;
    }
    .sig-line {
      height: 1px;
      background: var(--border);
      margin-bottom: 8px;
    }
    .sig-name {
      font-size: 12px;
      color: var(--text-light);
    }
    .sig-company {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary);
      margin-top: 4px;
    }

    /* Bottom bar */
    .bottom-bar {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      font-size: 10px;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .tagline {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .tagline::before {
      content: '';
      display: block;
      width: 30px;
      height: 2px;
      background: var(--accent);
    }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Header -->
    <div class="header">
      <div class="logo-container">
        ${logoSrc ? `<img src="${logoSrc}" class="logo-img" alt="FORENSIQ">` : `
          <div class="logo-text">FORENSI<span>Q</span></div>
          <div class="logo-tagline">Science • Technology • Justice</div>
        `}
      </div>
      <div class="invoice-title">
        <h4>Tax</h4>
        <h1>INVOICE</h1>
        <p>${data.invoiceNumber}</p>
      </div>
    </div>

    <!-- Cards -->
    <div class="info-cards">
      <div class="card" style="border-left: 4px solid var(--accent)">
        <div class="card-title">From</div>
        <div class="card-name">FORENSIQ</div>
        <div class="card-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          forensiq.in
        </div>
        <div class="card-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          management@forensiq.in
        </div>
      </div>
      
      <div class="card" style="border-left: 4px solid var(--accent)">
        <div class="card-title">Bill To</div>
        <div class="card-name" style="font-size:16px;">${data.customerName || 'Customer'}</div>
        <div class="card-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          ${data.customerEmail}
        </div>
        <div class="card-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Date: ${data.date}
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="center">Qty</th>
            <th class="right">Price</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="desc">${data.courseName}</td>
            <td class="center">1</td>
            <td class="right">${formattedOriginal}</td>
            <td class="right">${formattedOriginal}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-wrapper">
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formattedOriginal}</span>
        </div>
        ${data.discountAmount > 0 ? `
        <div class="total-row discount">
          <span>Discount${data.couponCode ? ` (${data.couponCode})` : ''}:</span>
          <span>-${formattedDiscount}</span>
        </div>
        ` : ''}
        <div class="total-row">
          <span>Tax (0%):</span>
          <span>₹0.00</span>
        </div>
        
        <div class="total-final">
          <span>Total:</span>
          <span style="color:var(--accent)">${formattedFinal}</span>
        </div>
      </div>
    </div>

    <!-- Payment Details -->
    <div class="payment-box">
      <div class="payment-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <div class="payment-info">
        <h5>Payment Details</h5>
        <p><span>Transaction ID:</span> ${data.paymentId}</p>
        <p><span>Order ID:</span> ${data.orderId}</p>
        <p><span>Status:</span> <span class="status-badge">PAID</span></p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="notes">
        <div class="notes-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          NOTES
        </div>
        <p>Thank you for your purchase.</p>
        <p>For any queries, please contact management@forensiq.in.</p>
      </div>
      
      <div class="signature">
        ${signatureSrc ? `<img src="${signatureSrc}" class="sig-img" alt="Signature">` : `
          <div class="sig-text">ForensiQ</div>
        `}
        <div class="sig-line"></div>
        <div class="sig-name">Authorized Signature</div>
        <div class="sig-company">FORENSIQ</div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="bottom-bar">
      <div class="tagline">Science For A Safer Tomorrow</div>
      <div>This is a computer-generated invoice</div>
    </div>

  </div>
</body>
</html>
  `;

  // Launch Puppeteer and print to PDF
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    await browser.close();
    return pdfBuffer;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

module.exports = { generateInvoicePDF };
