import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import axios from 'axios';
import psi from 'psi';
import pkg from 'broken-link-checker';
const { SiteChecker } = pkg;
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const siteUrl = 'https://freeunitsconverter.com';
const reportDir = path.join(process.cwd(), 'reports');
const completedFile = path.join(process.cwd(), 'completedTasks.json');
const staticFolder = path.join(process.cwd(), 'static-pages');
const GA_PROPERTY_ID = '504208659';

// Ensure directories/files exist
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
if (!fs.existsSync(completedFile)) fs.writeFileSync(completedFile, JSON.stringify({ tasks: [] }, null, 2));

async function getGAInsights() {
  const client = new BetaAnalyticsDataClient({ keyFile: path.join(process.cwd(), 'ga-key.json') });

  try {
    const [response] = await client.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' }
      ],
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      limit: 20
    });

    const suggestions = [];
    response.rows.forEach(row => {
      const page = row.dimensionValues[0].value;
      const pageviews = parseInt(row.metricValues[0].value);
      const bounceRate = parseFloat(row.metricValues[1].value);
      const sessionDuration = parseFloat(row.metricValues[2].value);

      if (bounceRate > 70) {
        suggestions.push(`Page ${page} has high bounce rate (${bounceRate.toFixed(1)}%). Review content/UX.`);
      } else if (sessionDuration < 30) {
        suggestions.push(`Page ${page} has low session duration (${sessionDuration.toFixed(1)}s). Add engaging content.`);
      } else if (pageviews > 500) {
        suggestions.push(`Page ${page} performs well (${pageviews} views). Consider adding internal links.`);
      }
    });
    return suggestions;
  } catch (err) {
    console.error('❌ Failed to fetch GA4 data:', err.message);
    return ['GA insights unavailable.'];
  }
}

async function runSEOAudit() {
  let report = `SEO Audit Report for ${siteUrl}\nGenerated: ${new Date().toString()}\n\n`;
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
  const reportFile = path.join(reportDir, `seo_report_${timestamp}.txt`);
  let completedTasks = JSON.parse(fs.readFileSync(completedFile, 'utf-8'));
  const tasks = [];

  // --- Fetch site HTML ---
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

    // --- Static pages check ---
    const missingFiles = [];
    function scanStaticPages(folderPath) {
      if (!fs.existsSync(folderPath)) return;
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      entries.filter(e => e.isDirectory()).forEach(dir => {
        const dirPath = path.join(folderPath, dir.name);
        const indexPath = path.join(dirPath, 'index.html');
        const guidePath = path.join(dirPath, 'conversionguide.html');
        if (!fs.existsSync(indexPath)) missingFiles.push({ type: 'index.html', path: path.relative(staticFolder, dirPath) });
        if (!fs.existsSync(guidePath)) missingFiles.push({ type: 'conversionguide.html', path: path.relative(staticFolder, dirPath) });
        scanStaticPages(dirPath);
      });
    }
    scanStaticPages(staticFolder);
    missingFiles.forEach(f => tasks.push({ level: "MEDIUM", msg: `Missing ${f.type} in folder: ${f.path}` }));

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
      link: (result) => { if (result.broken) report += `❌ Broken link: ${result.url.original} (Status: ${result.brokenReason})\n`; },
      end: resolve
    });
    sitechecker.enqueue(siteUrl);
  });
  report += `✅ Broken link scan complete.\n`;

  // --- Sitemap / robots.txt ---
  try { const sitemap = await axios.get(`${siteUrl}/sitemap.xml`); report += `\n✅ Sitemap accessible: ${sitemap.status}\n`; } 
  catch { report += `❌ Sitemap not accessible at /sitemap.xml\n`; }
  try { const robots = await axios.get(`${siteUrl}/robots.txt`); report += `✅ robots.txt accessible: ${robots.status}\n`; } 
  catch { report += `❌ robots.txt not accessible\n`; }

  // --- GA-driven AI Suggestions ---
  const gaSuggestions = await getGAInsights();
  report += `\n💡 AI SEO Suggestions (from Google Analytics):\n`;
  gaSuggestions.forEach(s => report += `- ${s}\n`);

  fs.writeFileSync(reportFile, report);
  console.log('✅ Report generated:', reportFile);
  return reportFile;
}

// --- Email report ---
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

// --- Run and schedule daily ---
(async () => {
  const file = await runSEOAudit();
  await sendReport(file);

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    const newFile = await runSEOAudit();
    await sendReport(newFile);
  }, ONE_DAY_MS);
})();
