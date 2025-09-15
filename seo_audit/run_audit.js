const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const psi = require('psi');
const { SiteChecker } = require('broken-link-checker');

const siteUrl = 'https://freeunitsconverter.com';
const reportDir = path.join(__dirname, 'reports');
const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
const reportFile = path.join(reportDir, `seo_report_${timestamp}.txt`);

// Ensure reports directory exists
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

async function runSEOAudit() {
  let report = `SEO Audit Report for ${siteUrl}\nGenerated: ${new Date().toString()}\n\n`;

  // --- 1️⃣ Basic HTML checks ---
  try {
    const res = await axios.get(siteUrl);
    const html = res.data;

    report += `✅ Page loaded successfully: ${res.status}\n`;
    report += `⏱ Page size: ${(html.length / 1024).toFixed(2)} KB\n`;
    report += `🔍 Title tag present: ${/<title>.*<\/title>/i.test(html) ? 'Yes' : 'No'}\n`;
    report += `🖼 Images with alt tags: ${(html.match(/<img [^>]*alt=["'][^"']*["']/gi) || []).length}\n`;
    report += `📄 Number of H1 tags: ${(html.match(/<h1>/gi) || []).length}\n`;
  } catch (err) {
    report += `❌ Error fetching page: ${err.message}\n`;
  }

  // --- 2️⃣ Google PageSpeed Insights ---
  try {
    const mobile = await psi(siteUrl, { strategy: 'mobile' });
    const desktop = await psi(siteUrl, { strategy: 'desktop' });

    report += `\n📱 Mobile performance score: ${mobile.lighthouseResult.categories.performance.score * 100}\n`;
    report += `💻 Desktop performance score: ${desktop.lighthouseResult.categories.performance.score * 100}\n`;

    // Add Core Web Vitals
    report += `LCP (Largest Contentful Paint) Mobile: ${mobile.lighthouseResult.audits["largest-contentful-paint"].displayValue}\n`;
    report += `CLS (Cumulative Layout Shift) Mobile: ${mobile.lighthouseResult.audits["cumulative-layout-shift"].displayValue}\n`;
    report += `FID (First Input Delay) Mobile: ${mobile.lighthouseResult.audits["max-potential-fid"].displayValue}\n`;

    report += `LCP Desktop: ${desktop.lighthouseResult.audits["largest-contentful-paint"].displayValue}\n`;
    report += `CLS Desktop: ${desktop.lighthouseResult.audits["cumulative-layout-shift"].displayValue}\n`;
    report += `FID Desktop: ${desktop.lighthouseResult.audits["max-potential-fid"].displayValue}\n`;
  } catch (err) {
    report += `❌ Error running PageSpeed Insights: ${err.message}\n`;
  }

  // --- 3️⃣ Broken links check ---
  report += `\n🔗 Checking for broken links...\n`;
  await new Promise((resolve) => {
    const sitechecker = new SiteChecker({}, {
      link: (result) => {
        if (result.broken) {
          report += `❌ Broken link: ${result.url.original} (Status: ${result.brokenReason})\n`;
        }
      },
      end: resolve
    });
    sitechecker.enqueue(siteUrl);
  });
  report += `✅ Broken link scan complete.\n`;

  // --- 4️⃣ Sitemap and robots.txt ---
  try {
    const sitemap = await axios.get(`${siteUrl}/sitemap.xml`);
    report += `\n✅ Sitemap accessible: ${sitemap.status}\n`;
  } catch {
    report += `❌ Sitemap not accessible at /sitemap.xml\n`;
  }

  try {
    const robots = await axios.get(`${siteUrl}/robots.txt`);
    report += `✅ robots.txt accessible: ${robots.status}\n`;
  } catch {
    report += `❌ robots.txt not accessible\n`;
  }

  // Save report
  fs.writeFileSync(reportFile, report);
  console.log('✅ Report generated:', reportFile);
  return reportFile;
}

// --- 5️⃣ Send report via email ---
async function sendReport(filePath) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.privateemail.com', // your Namecheap Private Email SMTP
    port: 587,
    secure: false,
    auth: {
      user: 'numbersneverlie@freeunitsconverter.com',
      pass: process.env.EMAIL_PASS // store password in env variable
    }
  });

  const mailOptions = {
    from: 'numbersneverlie@freeunitsconverter.com',
    to: 'numbersneverlie@freeunitsconverter.com,johanlijffijt@gmail.com',
    subject: 'Daily SEO Audit Report',
    text: fs.readFileSync(filePath, 'utf-8')
  };

  await transporter.sendMail(mailOptions);
  console.log('✅ Report emailed successfully');
}

// --- Run ---
(async () => {
    const file = await runSEOAudit();    // Run immediately
    await sendReport(file);              // Send report immediately
  
    // Optional: schedule daily audit
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    setInterval(async () => {
      const newFile = await runSEOAudit();
      await sendReport(newFile);
    }, ONE_DAY_MS);
  })();
  
