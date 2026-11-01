import 'dotenv/config';
import assert from 'node:assert';
import { validateXPayUrl, formatUSDPrice, isAllowedImageUrl, getYouTubeEmbedUrl } from '../src/lib/utils';
import { fetchProducts, fetchCategories } from '../src/lib/data-store';

async function runSmokeTests() {
  console.log('🧪 Starting Enginity Smoke Tests...');

  // Test 1: Categories & Products Fetch
  const categories = await fetchCategories();
  const products = await fetchProducts({ publishedOnly: true });

  assert.ok(categories.length > 0, 'Categories should not be empty');
  assert.ok(products.length > 0, 'Published products should not be empty');
  assert.ok(
    products.every(p => p.status === 'published' || p.status === 'coming_soon'),
    'All returned public products must be published or coming_soon'
  );
  console.log('  ✓ Test 1 Passed: Categories & Published products loaded');

  // Test 2: Currency Conversion Calculation
  const egpPrice = 1850;
  const usdRate = 50;
  const usdFormatted = formatUSDPrice(egpPrice, usdRate);

  assert.strictEqual(usdFormatted, '≈ $37', 'USD price calculation mismatch');
  console.log('  ✓ Test 2 Passed: Currency conversion format correct');

  // Test 3: XPay / Payment URL Validation
  const oldEnv = process.env.XPAY_ALLOWED_HOSTS;
  delete process.env.XPAY_ALLOWED_HOSTS;
  assert.strictEqual(validateXPayUrl('https://custom-gateway.com/pay'), true, 'Should accept any valid https URL when allowlist is empty');

  process.env.XPAY_ALLOWED_HOSTS = 'xpay.app,checkout.xpay.app';
  assert.strictEqual(validateXPayUrl('https://xpay.app/p/enginity-whatsapp-ai'), true);
  assert.strictEqual(validateXPayUrl('https://checkout.xpay.app/pay'), true);
  assert.strictEqual(validateXPayUrl('https://unauthorized-gateway.com/pay'), false, 'Should reject domain not in allowlist');
  assert.strictEqual(validateXPayUrl('http://insecure-site.com/pay'), false, 'Should reject non-https URLs');
  process.env.XPAY_ALLOWED_HOSTS = oldEnv;
  console.log('  ✓ Test 3 Passed: Payment https security validation working');

  // Test 4: Image URL Allowlist Validation (isAllowedImageUrl)
  assert.strictEqual(isAllowedImageUrl('https://i.ibb.co/abc1234/cover.png'), true, 'Should accept direct ImgBB i.ibb.co URLs');
  assert.strictEqual(isAllowedImageUrl('https://zqiieksqbbvlfzejbetq.supabase.co/storage/v1/object/public/products/diagram.png'), true, 'Should accept legacy Supabase storage URLs');
  assert.strictEqual(isAllowedImageUrl('https://ibb.co/viewer123'), false, 'Should reject viewer page links (ibb.co)');
  assert.strictEqual(isAllowedImageUrl('https://drive.google.com/file/d/12345/view'), false, 'Should reject Google Drive links');
  assert.strictEqual(isAllowedImageUrl('http://i.ibb.co/insecure.jpg'), false, 'Should reject http links');
  console.log('  ✓ Test 4 Passed: Direct image URL allowlist validation (isAllowedImageUrl) working');

  // Test 5: YouTube Privacy Embed Conversion
  const ytWatch = getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=tracking123');
  assert.strictEqual(ytWatch, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'Should extract clean video ID and use youtube-nocookie');
  const ytShorts = getYouTubeEmbedUrl('https://www.youtube.com/shorts/abcd5678');
  assert.strictEqual(ytShorts, 'https://www.youtube-nocookie.com/embed/abcd5678', 'Should handle YouTube Shorts format');
  console.log('  ✓ Test 5 Passed: Privacy-friendly YouTube embed conversion working');

  console.log('✅ All Enginity Smoke Tests Passed!');
}

runSmokeTests().catch(err => {
  console.error('❌ Smoke Test Failed:', err);
  process.exit(1);
});
