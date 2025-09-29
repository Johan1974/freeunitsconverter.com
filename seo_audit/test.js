// test_seo.js
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getGAInsights, checkBrokenLinks } from './seo_helpers.js';

dotenv.config();

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
// const GA_KEY_FILE = process.env.GA_KEY_FILE || path.join(process.cwd(), 'ga-key.json');
const GA_KEY_FILE = '/home/johan/freeunitsconverter.com/seo_audit/ga-key.json';

const SITE_URL = process.env.SITE_URL_PRD || 'https://freeunitsconverter.com';

async function runTest() {
  console.log('🔹 Testing GA4 integration...');
  try {
    const gaData = await getGAInsights(GA_PROPERTY_ID, GA_KEY_FILE);
    if (!gaData || !gaData.length) {
      console.log('❌ No GA4 data returned');
    } else {
      console.log('✅ GA4 data fetched successfully:');
      console.log(gaData.slice(0, 5));
    }
  } catch (err) {
    console.error('❌ Error querying GA4:', err.message);
  }

  console.log('\n🔹 Testing broken link checker...');
  try {
    const brokenReport = await checkBrokenLinks(SITE_URL);
    console.log('✅ Broken link checker ran successfully:');
    console.log(brokenReport.slice(0, 500), '...'); // print first 500 chars
  } catch (err) {
    console.error('❌ Error checking broken links:', err.message);
  }
}

runTest();
