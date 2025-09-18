import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import axios from 'axios';
import psi from 'psi';
import pkg from 'broken-link-checker';
const { SiteChecker } = pkg;
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';
import cron from 'node-cron';
import moment from 'moment-timezone';

dotenv.config();

// --- Config ---
const siteUrl = process.env.SITE_URL || 'https://freeunitsconverter.com';
const reportDir = path.join(process.cwd(), 'reports');
const staticFolder = path.join(process.cwd(), 'static-pages');

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
const GA_KEY_FILE = process.env.GA_KEY_FILE || path.join(process.cwd(), 'ga-key.json');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO || EMAIL_USER;
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.privateemail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const TIMEZONE = process.env.TIMEZONE || 'Europe/Amsterdam';
const PSI_API_KEY = process.env.PSI_API_KEY;

// --- Nodemailer ---
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// Ensure report directory exists
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

// --- GA Insights ---
async function getGAInsights() {
  if (!GA_PROPERTY_ID) return { top5: [], suggestions: ['GA_PROPERTY_ID not set'] };
  const client = new BetaAnalyticsDataClient({ keyFile: GA_KEY_FILE });
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
      limit: 50
    });

    const pages = response.rows.map(row => ({
      path: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value),
      bounce: parseFloat(row.metricValues[1].value),
      session: parseFloat(row.metricValues[2].value)
    }));

    const top5 = pages
    .filter(p => !['/', '/length', '/weight', '/volume', '/temperature'].includes(p.path))
    .sort((a, b) => a.session - b.session)
    .slice(0, 5);


    const suggestions = [];
    top5.forEach(p => {
      if (p.session < 30) suggestions.push(`Page ${p.path} has low session duration (${p.session.toFixed(1)}s). Add engaging content.`);
      if (p.views < 50) suggestions.push(`Page ${p.path} has low pageviews (${p.views}). Consider internal linking or promotion.`);
      if (p.bounce > 70) suggestions.push(`Page ${p.path} has high bounce rate (${p.bounce.toFixed(1)}%). Review content/UX.`);
    });

    return { top5, suggestions: suggestions.length ? suggestions : ['No significant GA insights at this time.'] };
  } catch (err) {
    console.error('❌ Failed to fetch GA4 data:', err.message);
    return { top5: [], suggestions: ['GA insights unavailable.'] };
  }
}

// --- Static pages scan ---
function scanStaticPagesFolder() {
  const missingFiles = [];

  function scan(folderPath) {
    if (!fs.existsSync(folderPath)) return;

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    entries.forEach(e => {
      if (e.isDirectory()) {
        const dirPath = path.join(folderPath, e.name);

        // If this is a category folder, scan inside but don't check for files here
        if (['length', 'weight', 'volume', 'temperature'].includes(e.name)) {
          scan(dirPath);
          return;
        }

        // Only check subfolders (unit combination folders)
        const indexPath = path.join(dirPath, 'index.html');
        const guidePath = path.join(dirPath, 'conversionguide.html');

        if (!fs.existsSync(indexPath)) missingFiles.push(`Missing index.html in folder: ${path.relative(staticFolder, dirPath)}`);
        if (!fs.existsSync(guidePath)) missingFiles.push(`Missing conversionguide.html in folder: ${path.relative(staticFolder, dirPath)}`);

        // Continue scanning deeper, in case of nested subfolders
        scan(dirPath);
      }
    });
  }

  scan(staticFolder);
  return [...new Set(missingFiles)];
}



// --- Ghost URLs from GA (not in sitemap) ---
async function getGhostUrls(sitemapUrls) {
  if (!GA_PROPERTY_ID) return [];
  const client = new BetaAnalyticsDataClient({ keyFile: GA_KEY_FILE });
  try {
    const [response] = await client.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      limit: 1000
    });

    const indexedUrls = response.rows.map(r => r.dimensionValues[0].value);
    const ghostUrls = indexedUrls.filter(u => !sitemapUrls.includes(u) && !u.match(/^\/(length|weight|volume|temperature)\//));
    return ghostUrls.map(u => siteUrl.replace(/\/$/, '') + u);
  } catch (err) {
    console.error('❌ Failed to fetch Google-indexed URLs:', err.message);
    return [];
  }
}


// --- Main SEO Audit ---
async function runSEOAudit() {
  const timestamp = moment().tz(TIMEZONE).format('YYYY-MM-DD_HH-mm-ss');
  const reportFile = path.join(reportDir, `seo_report_${timestamp}.txt`);
  let report = `SEO Audit Report for ${siteUrl}\nGenerated: ${moment().tz(TIMEZONE).format('dddd, MMMM Do YYYY, HH:mm:ss z')}\n\n`;

  // --- Fetch site HTML ---
  try {
    const res = await axios.get(siteUrl);
    const html = res.data;
    report += `✅ Page loaded successfully: ${res.status}\n`;
    report += `⏱ Page size: ${(html.length / 1024).toFixed(2)} KB\n`;
    report += `🔍 Title tag present: ${/<title>.*<\/title>/i.test(html) ? 'Yes' : 'No'}\n`;
    const allImgs = html.match(/<img /gi) || [];
    const imgsWithAlt = html.match(/<img [^>]*alt=["'][^"']*["']/gi) || [];
    report += allImgs.length === 0 ? `🖼 Images with alt tags: N/A (no images found)\n` : `🖼 Images with alt tags: ${imgsWithAlt.length} of ${allImgs.length}\n`;
    report += `📄 Number of H1 tags: ${(html.match(/<h1/gi) || []).length}\n`;
  } catch (err) {
    report += `❌ Error fetching page: ${err.message}\n`;
  }

  // --- Static pages ---
  const missingFiles = scanStaticPagesFolder();
  if (missingFiles.length) {
    report += `\n❌ Missing static files:\n`;
    missingFiles.forEach(f => report += `- ${f}\n`);
  }

  // --- PageSpeed Insights ---
try {
  const mobile = await psi(siteUrl, { strategy: 'mobile', key: process.env.PSI_API_KEY });
  const desktop = await psi(siteUrl, { strategy: 'desktop', key: process.env.PSI_API_KEY });

  const mobileScore = mobile.data?.lighthouseResult?.categories?.performance?.score;
  const desktopScore = desktop.data?.lighthouseResult?.categories?.performance?.score;

  report += `\n📱 Mobile performance score: ${mobileScore !== undefined ? mobileScore * 100 : 'N/A'}\n`;
  report += `💻 Desktop performance score: ${desktopScore !== undefined ? desktopScore * 100 : 'N/A'}\n`;

  // --- AI suggestions for low PSI scores ---
  if (mobileScore !== undefined && mobileScore < 0.8) {
    report += `💡 Mobile performance is low (${(mobileScore*100).toFixed(0)}). Optimize images, reduce render-blocking scripts.\n`;
  }
  if (desktopScore !== undefined && desktopScore < 0.9) {
    report += `💡 Desktop performance is below ideal (${(desktopScore*100).toFixed(0)}). Consider caching, compression, speed optimizations.\n`;
  }

} catch (err) {
  report += `❌ Error running PageSpeed Insights: ${err.message}\n`;
}

  

  // --- Broken links ---
  report += `\n🔗 Checking for broken links...\n`;
  await new Promise(resolve => {
    const sitechecker = new SiteChecker({}, {
      link: result => { if (result.broken) report += `❌ Broken link: ${result.url.original} (Status: ${result.brokenReason})\n`; },
      end: resolve
    });
    sitechecker.enqueue(siteUrl);
  });
  report += `✅ Broken link scan complete.\n`;

  // --- Sitemap & robots ---
  let sitemapUrls = [];
  try {
    const sitemap = await axios.get(`${siteUrl}/sitemap.xml`);
    report += `\n✅ Sitemap accessible: ${sitemap.status}\n`;
    sitemapUrls = (sitemap.data.match(/<loc>(.*?)<\/loc>/gi) || []).map(m => m.replace(/<\/?loc>/g, ''));
  } catch { report += `❌ Sitemap not accessible at /sitemap.xml\n`; }

  try { const robots = await axios.get(`${siteUrl}/robots.txt`); report += `✅ robots.txt accessible: ${robots.status}\n`; } 
  catch { report += `❌ robots.txt not accessible\n`; }

  // --- GA Top 5 & Suggestions ---
  const { top5, suggestions } = await getGAInsights();
  if (top5.length) {
    report += `\n=== Top 5 Pages Needing Attention ===\n`;
    top5.forEach(p => report += `- ${p.path}: Bounce ${p.bounce}%, Session ${p.session.toFixed(1)}s, Engagement ${p.views}\n`);
  }
  report += `\n💡 AI SEO Suggestions:\n`;
  suggestions.forEach(s => report += `- ${s}\n`);

  // --- Ghost URLs ---
  const ghostUrls = await getGhostUrls(sitemapUrls);
  const filteredGhostUrls = ghostUrls.filter(u => !['/', '/length', '/weight', '/volume', '/temperature'].includes(u.replace(siteUrl, '')));
  if (filteredGhostUrls.length) {
    report += `\n⚠ Google thinks these URLs exist but are missing locally:\n`;
    filteredGhostUrls.forEach(u => report += `- ${u}\n`);
  }

  fs.writeFileSync(reportFile, report);
  console.log('✅ Report generated:', reportFile);
  return reportFile;
}

// --- Send report ---
async function sendReport(filePath) {
  try {
    const mailOptions = {
      from: EMAIL_USER,
      to: EMAIL_TO,
      subject: 'Daily SEO Audit Report',
      text: fs.readFileSync(filePath, 'utf-8')
    };
    await transporter.sendMail(mailOptions);
    console.log('✅ Report emailed successfully');
  } catch (err) { console.error('❌ Failed to send email:', err.message); }
}

// --- Run immediately and schedule daily ---
(async () => {
  const file = await runSEOAudit();
  await sendReport(file);

  cron.schedule('0 9 * * *', async () => {
    const dailyFile = await runSEOAudit();
    await sendReport(dailyFile);
  }, { timezone: TIMEZONE });
})();
