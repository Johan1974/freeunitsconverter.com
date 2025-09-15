const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const psi = require('psi');
const { SiteChecker } = require('broken-link-checker');

const siteUrl = 'https://freeunitsconverter.com';
const reportDir = path.join(__dirname, 'reports');
const completedFile = path.join(__dirname, 'completedTasks.json');
const staticFolder = path.join(__dirname, 'static-pages');


// Ensure directories/files exist
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
if (!fs.existsSync(completedFile)) fs.writeFileSync(completedFile, JSON.stringify({ tasks: [] }, null, 2));

async function runSEOAudit() {
  let report = `SEO Audit Report for ${siteUrl}\nGenerated: ${new Date().toString()}\n\n`;

  // Timestamp & report file
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  const reportFile = path.join(reportDir, `seo_report_${timestamp}.txt`);

  let completedTasks = JSON.parse(fs.readFileSync(completedFile, 'utf-8'));
  const tasks = [];

  let html;
  try {
    const res = await axios.get(siteUrl);
    html = res.data;

    report += `✅ Page loaded successfully: ${res.status}\n`;
    report += `⏱ Page size: ${(html.length / 1024).toFixed(2)} KB\n`;
    report += `🔍 Title tag present: ${/<title>.*<\/title>/i.test(html) ? 'Yes' : 'No'}\n`;

    const allImgs = html.match(/<img /gi) || [];
    const imgsWithAlt = html.match(/<img [^>]*alt=["'][^"']*["']/gi) || [];
    report += allImgs.length === 0
      ? `🖼 Images with alt tags: N/A (no images found)\n`
      : `🖼 Images with alt tags: ${imgsWithAlt.length} of ${allImgs.length}\n`;

    const h1Count = (html.match(/<h1/gi) || []).length;
    report += `📄 Number of H1 tags: ${h1Count}\n`;

    // --- SEO Task Suggestions ---
    if (!/<title>.*<\/title>/i.test(html)) tasks.push({ level: "HIGH", msg: "Add a <title> tag with your primary keyword." });
    if (h1Count === 0) tasks.push({ level: "HIGH", msg: "Add at least one <h1> with your main keyword." });
    else if (h1Count > 1) tasks.push({ level: "MEDIUM", msg: "Use only one <h1>; change others to <h2>/<h3>." });
    if (allImgs.length > 0 && imgsWithAlt.length < allImgs.length) tasks.push({ level: "HIGH", msg: "Add descriptive alt text to all images." });
    else if (allImgs.length === 0) tasks.push({ level: "LOW", msg: "Consider adding at least one branded logo image with alt text for SEO." });
    if (!html.includes('meta name="description"')) tasks.push({ level: "HIGH", msg: "Add a meta description (~155 chars) with keywords." });
    if (!html.includes('schema.org')) tasks.push({ level: "MEDIUM", msg: "Add structured data (JSON-LD schema) for better search visibility." });
    if (!html.includes('<a')) tasks.push({ level: "MEDIUM", msg: "Add internal links with keyword-rich anchor text." });
    if (!html.includes('sitemap.xml')) tasks.push({ level: "LOW", msg: "Submit a sitemap to Google Search Console." });

    // --- Check static pages for index.html & conversionguide.html ---
    const missingFiles = [];

    function scanStaticPages(folderPath) {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      entries.filter(e => e.isDirectory()).forEach(dir => {
        const dirPath = path.join(folderPath, dir.name);
        const indexPath = path.join(dirPath, 'index.html');
        const guidePath = path.join(dirPath, 'conversionguide.html');

        if (!fs.existsSync(indexPath)) missingFiles.push({ type: 'index.html', path: path.relative(staticFolder, dirPath) });
        if (!fs.existsSync(guidePath)) missingFiles.push({ type: 'conversionguide.html', path: path.relative(staticFolder, dirPath) });

        // Recursive scan
        scanStaticPages(dirPath);
      });
    }

    if (!fs.existsSync(staticFolder)) {
      report += `❌ Static pages folder not found at ${staticFolder}\n`;
    } else {
      scanStaticPages(staticFolder);
    }

    missingFiles.forEach(f => {
      tasks.push({ level: "MEDIUM", msg: `Missing ${f.type} in folder: ${f.path}` });
    });

    // --- Group tasks by priority & mark completed ---
    const groupedTasks = { HIGH: [], MEDIUM: [], LOW: [] };
    tasks.forEach(t => {
      const existsBefore = completedTasks.tasks.find(ct => ct.msg === t.msg);
      const status = existsBefore ? '✅ Completed' : '❌ Pending';
      groupedTasks[t.level].push({ msg: t.msg, status });
    });

    report += `\n📌 Daily SEO Task List (Grouped by Priority):\n`;
    ['HIGH','MEDIUM','LOW'].forEach(level => {
      if (groupedTasks[level].length > 0) {
        report += `\n=== ${level} Priority ===\n`;
        groupedTasks[level].forEach(t => {
          report += `- [${t.status}] ${t.msg}\n`;
        });
      }
    });

    // Save completed tasks
    const newCompleted = tasks.filter(t => !completedTasks.tasks.find(ct => ct.msg === t.msg));
    completedTasks.tasks.push(...newCompleted);
    fs.writeFileSync(completedFile, JSON.stringify(completedTasks, null, 2));

  } catch (err) {
    report += `❌ Error fetching page: ${err.message}\n`;
  }

  // --- PageSpeed Insights ---
  try {
    const mobile = await psi(siteUrl, { strategy: 'mobile' });
    const desktop = await psi(siteUrl, { strategy: 'desktop' });
    report += `\n📱 Mobile performance score: ${mobile.lighthouseResult.categories.performance.score * 100}\n`;
    report += `💻 Desktop performance score: ${desktop.lighthouseResult.categories.performance.score * 100}\n`;
  } catch (err) {
    report += `❌ Error running PageSpeed Insights: ${err.message}\n`;
  }

  // --- Broken links ---
  report += `\n🔗 Checking for broken links...\n`;
  await new Promise(resolve => {
    const sitechecker = new SiteChecker({}, {
      link: (result) => {
        if (result.broken) report += `❌ Broken link: ${result.url.original} (Status: ${result.brokenReason})\n`;
      },
      end: resolve
    });
    sitechecker.enqueue(siteUrl);
  });
  report += `✅ Broken link scan complete.\n`;

  // --- Sitemap / robots.txt ---
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

// --- Send report via email ---
async function sendReport(filePath) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.privateemail.com',
      port: 587,
      secure: false,
      auth: { user: 'numbersneverlie@freeunitsconverter.com', pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: 'numbersneverlie@freeunitsconverter.com',
      to: 'numbersneverlie@freeunitsconverter.com,johanlijffijt@gmail.com',
      subject: 'Daily SEO Audit Report',
      text: fs.readFileSync(filePath, 'utf-8')
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Report emailed successfully');
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
  }
}

// --- Run the audit ---
(async () => {
  const file = await runSEOAudit();
  await sendReport(file);

  // Schedule daily run
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    const newFile = await runSEOAudit();
    await sendReport(newFile);
  }, ONE_DAY_MS);
})();
