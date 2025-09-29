// seo_helpers.js

// Node built-ins
import fs from 'fs';
import path from 'path';

// Third-party packages
import * as cheerio from 'cheerio';
import * as fastXmlParser from 'fast-xml-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import pkg from 'broken-link-checker';
const { SiteChecker } = pkg;
import nodemailer from 'nodemailer';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import moment from 'moment-timezone';
import cron from 'node-cron';
import xml2js from 'xml2js';

// Load environment variables
dotenv.config();

// --- GA4 Insights ---
export async function getGAInsights(propertyId, keyFile) {
  const client = new BetaAnalyticsDataClient({ keyFile });
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }]
  });

  return response.rows.map(r => ({
    path: r.dimensionValues[0].value,
    views: parseInt(r.metricValues[0].value, 10),
    session: parseFloat(r.metricValues[1].value)
  }));
}

// --- Scan static pages folder ---
export function scanStaticPagesFolder(folderPath) {
  const missing = [];
  const pages = [
    'length/index.html', 'length/conversionguide.html',
    'temperature/index.html', 'temperature/conversionguide.html',
    'volume/index.html', 'volume/conversionguide.html',
    'weight/index.html', 'weight/conversionguide.html'
  ];

  pages.forEach(f => {
    if (!fs.existsSync(path.join(folderPath, f))) missing.push(f);
  });

  return missing;
}

// --- Get Ghost URLs ---
export function getGhostUrls(gaData, siteUrl, staticFolder) {
  return gaData
    .map(p => siteUrl + p.path)
    .filter((_, idx) => !fs.existsSync(path.join(staticFolder, gaData[idx].path)));
}

// --- PageSpeed Insights ---
export async function runPSI(siteUrl, apiKey) {
  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${siteUrl}&key=${apiKey}`
    );

    const score = data.lighthouseResult.categories.performance.score * 100;

    return {
      mobileScore: score,
      desktopScore: score,
      audits: data.lighthouseResult.audits
    };
  } catch (err) {
    console.error('PSI error', err.message);
    return null;
  }
}

// --- Broken links ---
export function checkBrokenLinks(siteUrl) {
  return new Promise(resolve => {
    const broken = [];
    const siteChecker = new SiteChecker(
      { excludeExternalLinks: true },
      {
        link: result => {
          if (result.broken) broken.push(result.url.resolved);
        },
        end: () => resolve(broken.length ? broken.join('\n') : '✅ No broken links detected')
      }
    );
    siteChecker.enqueue(siteUrl);
  });
}

// --- Generate SEO Daily To-Do ---
export async function generateSEODailyToDo(gaData) {
  return gaData.map(p => ({
    path: p.path,
    session: p.session,
    views: p.views,
    notes: ['Check internal links', 'Improve meta description']
  }));
}

// --- Helpers for metrics formatting ---
export function flagMetric(name, value) {
  if (value == null) return '❓';
  if (value > 3) return '⚠';
  return '✅';
}

export function formatMetric(name, value) {
  if (value == null) return 'N/A';
  return typeof value === 'number' ? value.toFixed(2) : value;
}

// --- Cheerio helper ---
export function loadHTML(htmlString) {
  return cheerio.load(htmlString);
}

// --- Fast XML Parser helper ---
export function parseXML(xmlString, options = { ignoreAttributes: false }) {
  return fastXmlParser.parse(xmlString, options);
}
