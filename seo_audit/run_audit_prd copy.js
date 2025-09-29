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
  checkBrokenLinks,
  generateSEODailyToDo
} from './seo_helpers.js';

dotenv.config();

// --- Config ---
const siteUrl = process.env.SITE_URL_PRD || 'https://freeunitsconverter.com';
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

// --- Main SEO Audit ---
async function runSEOAudit() {
  const timestamp = moment().tz(TIMEZONE).format('YYYY-MM-DD_HH-mm-ss');
  const reportFile = path.join(reportDir, `seo_report_${timestamp}.txt`);

  let report = `SEO Audit Report for ${siteUrl}\nGenerated: ${moment().tz(TIMEZONE).format('dddd, MMMM Do YYYY, HH:mm:ss z')}\n\n`;

  // --- Fetch site HTML ---
  try {
    const { data: html } = await axios.get(siteUrl);
    const allImgs = html.match(/<img /gi) || [];
    const imgsWithAlt = html.match(/<img [^>]*alt=["'][^"']*["']/gi) || [];
    report += `✅ Page loaded successfully\n🖼 Images with alt tags: ${imgsWithAlt.length} of ${allImgs.length}\n📄 Number of H1 tags: ${(html.match(/<h1/gi) || []).length}\n`;
  } catch (err) {
    report += `❌ Error fetching page: ${err.message}\n`;
  }

  // --- Static pages ---
  const missingFiles = scanStaticPagesFolder(staticFolder);
  if (missingFiles.length) report += `\n❌ Missing static files:\n${missingFiles.map(f => `- ${f}`).join('\n')}\n`;

  // --- PageSpeed ---
  const psiData = await runPSI(siteUrl, PSI_API_KEY);
  if (psiData) {
    report += `\n📱 Mobile performance score: ${psiData.mobileScore}\n💻 Desktop performance score: ${psiData.desktopScore}\n`;
  }

  // --- Broken links ---
  report += `\n🔗 Checking for broken links...\n`;
  report += await checkBrokenLinks(siteUrl);

  // --- Sitemap & robots ---
  let sitemapUrls = [];
  try {
    const { data } = await axios.get(`${siteUrl}/sitemap.xml`);
    report += `✅ Sitemap accessible\n`;
    sitemapUrls = data.match(/<loc>(.*?)<\/loc>/g)?.map(l => l.replace(/<\/?loc>/g, '')) || [];
  } catch (err) {
    report += `❌ Sitemap error: ${err.message}\n`;
  }

  try {
    const { status } = await axios.get(`${siteUrl}/robots.txt`);
    report += `✅ robots.txt accessible: ${status}\n`;
  } catch (err) {
    report += `❌ robots.txt error: ${err.message}\n`;
  }

  // --- GA Insights ---
  const gaData = await getGAInsights(GA_PROPERTY_ID, GA_KEY_FILE);
  if (gaData.length) {
    report += `\n=== Top 5 Pages Needing Attention ===\n`;
    gaData.slice(0, 5).forEach(p => {
      report += `- ${p.path}: ${p.session ? p.session.toFixed(1) + 's' : 'N/A'} session, ${p.views || 'N/A'} pageviews\n`;
    });
  }

  // --- Ghost URLs ---
  const ghostUrls = getGhostUrls(gaData, siteUrl, staticFolder);
  if (ghostUrls.length) {
    report += `\n⚠ Ghost URLs detected:\n`;
    ghostUrls.forEach(url => report += `- ${url}\n`);
  }

  // --- Daily SEO To-Do ---
  const seoToDo = await generateSEODailyToDo(gaData);
  if (seoToDo.length) {
    report += `\n📅 Daily SEO To-Do List:\n`;
    seoToDo.forEach((p, i) => {
      report += `${i + 1}. ${p.path} | Session: ${p.session || 'N/A'} | Pageviews: ${p.views || 0} | Notes: ${p.notes.join('; ')}\n`;
    });
  }

  // --- Write report ---
  fs.writeFileSync(reportFile, report);

  // --- Send email ---
  await transporter.sendMail({
    from: EMAIL_USER,
    to: EMAIL_TO,
    subject: `SEO Audit Report - ${timestamp}`,
    text: report
  });

  console.log(`✅ Report generated: ${reportFile}\n✅ Report emailed successfully`);
}

// --- Run once ---
runSEOAudit();

// --- Cron for daily 9:00 ---
cron.schedule('0 9 * * *', () => {
  console.log('⏳ Running scheduled SEO audit...');
  runSEOAudit();
}, { timezone: TIMEZONE });

