// seo_helpers.js

import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import axios from 'axios';
import pkg from 'broken-link-checker';
const { SiteChecker } = pkg;
import { BetaAnalyticsDataClient } from '@google-analytics/data';

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
    'length/index.html','length/conversionguide.html',
    'temperature/index.html','temperature/conversionguide.html',
    'volume/index.html','volume/conversionguide.html',
    'weight/index.html','weight/conversionguide.html'
  ];
  pages.forEach(f => { if (!fs.existsSync(path.join(folderPath, f))) missing.push(f); });
  return missing;
}

// --- Ghost URLs ---
export function getGhostUrls(gaData, siteUrl, staticFolder) {
  return gaData
    .map((p,i) => siteUrl + p.path)
    .filter((_, idx) => !fs.existsSync(path.join(staticFolder, gaData[idx].path)));
}

// --- PageSpeed Insights ---
export async function runPSI(siteUrl, apiKey) {
  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${siteUrl}&key=${apiKey}`
    );
    const score = data.lighthouseResult.categories.performance.score * 100;
    return { mobileScore: score, desktopScore: score, audits: data.lighthouseResult.audits };
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
        link: result => { if (result.broken) broken.push(result.url.resolved); },
        end: () => resolve(broken.length ? broken.join('\n') : '✅ No broken links detected')
      }
    );
    siteChecker.enqueue(siteUrl);
  });
}

// --- Keyword analysis ---
export function analyzeKeywords(htmlString, keywords) {
  const $ = cheerio.load(htmlString);
  const text = $('body').text().toLowerCase();
  return keywords.map(k => ({ keyword: k, count: (text.match(new RegExp(k.toLowerCase(), 'g')) || []).length }));
}

export async function crawlPagesForKeywords(pageUrls = [], targetKeywords = []) {
  const results = [];
  for (const url of pageUrls) {
    try {
      const { data: html } = await axios.get(url);
      results.push({ url, keywords: analyzeKeywords(html, targetKeywords) });
    } catch (err) {
      results.push({ url, error: err.message });
    }
  }
  return results;
}

// --- Generate Daily SEO Tasks ---
export async function generateSEODailyToDo(gaData) {
  return gaData.map(p => ({
    path: p.path,
    session: p.session,
    views: p.views,
    notes: ['Check internal links','Improve meta description']
  }));
}

// --- Growth & Monetization ---
export function calculateGrowth(currentGA, previousGA) {
  return currentGA.map(curr => {
    const prev = previousGA.find(p => p.path === curr.path) || { views: 0, session: 0 };
    const viewChange = prev.views ? ((curr.views - prev.views)/prev.views)*100 : 100;
    const sessionChange = prev.session ? ((curr.session - prev.session)/prev.session)*100 : 100;
    return { path: curr.path, views: curr.views, viewChange, sessionChange, session: curr.session };
  });
}

export function estimateMonetization(totalViewsPerMonth) {
  if (totalViewsPerMonth >= 50000) return { ready: true, note: 'Traffic sufficient for monetization.' };
  if (totalViewsPerMonth >= 10000) return { ready: false, note: 'Traffic growing; monetization possible soon.' };
  return { ready: false, note: 'Traffic low; focus on growth.' };
}

export async function generateAISEOTasks(gaData, keywordResults, missingFiles, ghostUrls, sitemapUrls, previousGA = []) {
  const tasks = [];
  missingFiles.forEach(f => tasks.push({ task: `Create missing static file: ${f}`, reason: 'SEO requires it.', priority: 'High' }));
  ghostUrls.forEach(u => {
    if (!sitemapUrls.includes(u)) tasks.push({ task: `Add ghost URL to sitemap or redirect: ${u}`, reason: 'Users visit this URL but it is not indexed.', priority: 'High' });
  });
  keywordResults.forEach(p => {
    p.keywords.forEach(k => { if (k.count === 0) tasks.push({ task: `Add keyword "${k.keyword}" to page ${p.url}`, reason: 'Keyword missing; affects ranking.', priority: 'Medium' }); });
  });
  gaData.forEach(p => { if (p.session > 300 && p.views < 10) tasks.push({ task: `Add internal links to ${p.path}`, reason: 'High session but low pageviews.', priority: 'Medium' }); });
  if (previousGA.length) {
    const trends = calculateGrowth(gaData, previousGA);
    trends.forEach(t => {
      if (t.viewChange < 0) tasks.push({ task: `Investigate drop on ${t.path}`, reason: `Pageviews decreased by ${t.viewChange.toFixed(1)}%`, priority: 'High' });
      if (t.sessionChange > 20) tasks.push({ task: `Promote ${t.path}`, reason: `Session duration increased by ${t.sessionChange.toFixed(1)}%`, priority: 'Medium' });
    });
  }
  const totalViews = gaData.reduce((sum,p)=>sum+(p.views||0),0);
  const monetization = estimateMonetization(totalViews);
  if (!monetization.ready) tasks.push({ task: 'Focus on traffic growth', reason: monetization.note, priority: 'High' });
  return tasks;
}
