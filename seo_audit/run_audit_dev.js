// run_audit_dev.js
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cron from 'node-cron';
import moment from 'moment-timezone';
import axios from 'axios';

import {
  flagMetric,
  formatMetric,
  getGAInsights,
  scanStaticPagesFolder,
  getGhostUrls,
  runPSI,
  checkBrokenLinks
} from './seo_helpers.js';

dotenv.config();

// --- Config ---
// Internal Docker URL (used for axios, curl-style checks, broken links)
const siteUrl = process.env.SITE_URL_INT;

// External/public URL (used for PageSpeed Insights only)
const psiSiteUrl = process.env.SITE_URL_EXT;

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
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// --- Main SEO Audit ---
async function runSEOAudit() {
  const timestamp = moment().tz(TIMEZONE).format('YYYY-MM-DD_HH-mm-ss');
  const reportFile = path.join(reportDir, `seo_report_${timestamp}.txt`);

  let report = `SEO Audit Report (Development Environment)\nGenerated: ${moment()
    .tz(TIMEZONE)
    .format('dddd, MMMM Do YYYY, HH:mm:ss z')}\n\n`;

  // --- Fetch site HTML (internal) ---
  try {
    const { data: html } = await axios.get(siteUrl);

    const allImgs = html.match(/<img /gi) || [];
    const imgsWithAlt = html.match(/<img [^>]*alt=["'][^"']*["']/gi) || [];

    report += `✅ Page loaded successfully (internal: ${siteUrl})\n`;
    report += `🖼 Images with alt tags: ${imgsWithAlt.length} of ${allImgs.length}\n`;
    report += `📄 Number of H1 tags: ${(html.match(/<h1/gi) || []).length}\n`;
  } catch (err) {
    report += `❌ Error fetching page internally: ${err.message}\n`;
  }

  // --- Static pages ---
  const missingFiles = scanStaticPagesFolder(staticFolder);
  if (missingFiles.length) {
    report += `\n❌ Missing static files:\n`;
    missingFiles.forEach(f => (report += `- ${f}\n`));
  }

  // --- PageSpeed Insights (external) ---
  const psiData = await runPSI(psiSiteUrl, PSI_API_KEY);
  if (psiData) {
    const metrics = [
      'first-contentful-paint',
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
      'speed-index'
    ];
    report += `\n📱 Mobile performance score (${psiSiteUrl}): ${psiData.mobileScore}\n`;
    metrics.forEach(
      m =>
        (report += `${flagMetric(m, psiData.mobile[m]?.numericValue)} ${m.toUpperCase()}: ${formatMetric(
          m,
          psiData.mobile[m]?.numericValue
        )}\n`)
    );

    report += `\n💻 Desktop performance score (${psiSiteUrl}): ${psiData.desktopScore}\n`;
    metrics.forEach(
      m =>
        (report += `${flagMetric(m, psiData.desktop[m]?.numericValue)} ${m.toUpperCase()}: ${formatMetric(
          m,
          psiData.desktop[m]?.numericValue
        )}\n`)
    );
  }

  // --- Broken links (internal) ---
  report += `\n🔗 Checking for broken links (internal)...\n`;
  report += await checkBrokenLinks(siteUrl);

  // --- Sitemap & robots (internal) ---
  let sitemapUrls = [];
  try {
    const { data: sitemapData, status } = await axios.get(`${siteUrl}/sitemap.xml`);
    report += `✅ Sitemap accessible: ${status}\n`;
    sitemapUrls = (sitemapData.match(/<loc>(.*?)<\/loc>/gi) || []).map(m => m.replace(/<\/?loc>/g, ''));
  } catch {
    report += `❌ Sitemap not accessible\n`;
  }

  try {
    const { status } = await axios.get(`${siteUrl}/robots.txt`);
    report += `✅ robots.txt accessible: ${status}\n`;
  } catch {
    report += `❌ robots.txt not accessible\n`;
  }

  // --- GA Top 5 & Suggestions ---
  const { top5, suggestions } = await getGAInsights(GA_PROPERTY_ID, GA_KEY_FILE);
  if (top5.length) {
    report += `\n=== Top 5 Pages Needing Attention ===\n`;
    top5.forEach(
      p =>
        (report += `- ${p.path}: Bounce ${p.bounce}%, Session ${p.session.toFixed(1)}s, Engagement ${p.views}\n`)
    );
  }

  report += `\n💡 AI SEO Suggestions:\n`;
  suggestions.forEach(s => (report += `- ${s}\n`));

  // --- Ghost URLs ---
  const ghostUrls = await getGhostUrls(GA_PROPERTY_ID, GA_KEY_FILE, siteUrl, sitemapUrls);
  if (ghostUrls.length) {
    report += `\n⚠ Google thinks these URLs exist but are missing locally:\n`;
    ghostUrls.forEach(u => (report += `- ${u}\n`));
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
      subject: 'Daily SEO Audit Report (Development Environment)',
      text: fs.readFileSync(filePath, 'utf-8')
    };
    await transporter.sendMail(mailOptions);
    console.log('✅ Report emailed successfully');
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
  }
}

// --- Run immediately and schedule daily ---
(async () => {
  const file = await runSEOAudit();
  await sendReport(file);

  cron.schedule(
    '0 9 * * *',
    async () => {
      const dailyFile = await runSEOAudit();
      await sendReport(dailyFile);
    },
    { timezone: TIMEZONE }
  );
})();
