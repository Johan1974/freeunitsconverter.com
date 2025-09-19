// seo_helpers.js
import fs from 'fs';
import path from 'path';
import psi from 'psi';
import axios from 'axios';
import pkg from 'broken-link-checker';
const { SiteChecker } = pkg;
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export function flagMetric(name, value) {
  switch (name) {
    case 'first-contentful-paint': return value > 3 ? '⚠' : '✅';
    case 'largest-contentful-paint': return value > 2.5 ? '⚠' : '✅';
    case 'cumulative-layout-shift': return value > 0.1 ? '⚠' : '✅';
    case 'total-blocking-time': return value > 300 ? '⚠' : '✅';
    case 'speed-index': return value > 4 ? '⚠' : '✅';
    default: return '';
  }
}

export function formatMetric(key, value) {
  if (value === null || value === undefined) return 'N/A';
  if (key === 'cumulative-layout-shift') return value.toFixed(3);
  if (key === 'total-blocking-time') return `${(value / 1000).toFixed(1)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export async function getGAInsights(GA_PROPERTY_ID, GA_KEY_FILE) {
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

export function scanStaticPagesFolder(staticFolder) {
  const missingFiles = [];

  function scan(folderPath) {
    if (!fs.existsSync(folderPath)) return;
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    entries.forEach(e => {
      if (e.isDirectory()) {
        const dirPath = path.join(folderPath, e.name);
        if (['length','weight','volume','temperature'].includes(e.name)) { scan(dirPath); return; }

        const indexPath = path.join(dirPath, 'index.html');
        const guidePath = path.join(dirPath, 'conversionguide.html');

        if (!fs.existsSync(indexPath)) missingFiles.push(`Missing index.html in folder: ${path.relative(staticFolder, dirPath)}`);
        if (!fs.existsSync(guidePath)) missingFiles.push(`Missing conversionguide.html in folder: ${path.relative(staticFolder, dirPath)}`);

        scan(dirPath);
      }
    });
  }

  scan(staticFolder);
  return [...new Set(missingFiles)];
}

export async function getGhostUrls(GA_PROPERTY_ID, GA_KEY_FILE, siteUrl, sitemapUrls) {
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

export async function runPSI(siteUrl, PSI_API_KEY) {
  try {
    const mobile = await psi(siteUrl, { strategy: 'mobile', key: PSI_API_KEY });
    const desktop = await psi(siteUrl, { strategy: 'desktop', key: PSI_API_KEY });
    return { mobile: mobile.data.lighthouseResult.audits, desktop: desktop.data.lighthouseResult.audits, mobileScore: mobile.data.lighthouseResult.categories.performance.score * 100, desktopScore: desktop.data.lighthouseResult.categories.performance.score * 100 };
  } catch (err) {
    console.error('❌ PSI failed:', err.message);
    return null;
  }
}

export async function checkBrokenLinks(siteUrl) {
  let report = '';
  await new Promise(resolve => {
    const sitechecker = new SiteChecker({}, {
      link: result => { if (result.broken) report += `❌ Broken link: ${result.url.original} (Status: ${result.brokenReason})\n`; },
      end: resolve
    });
    sitechecker.enqueue(siteUrl);
  });
  return report;
}
