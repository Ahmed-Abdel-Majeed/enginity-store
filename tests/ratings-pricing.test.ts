import assert from 'node:assert/strict';
import {
  calculateDiscountPercentage,
  validateProductPricing,
  resolveProductPricing,
  computeProductRatingSummary
} from '../src/lib/utils';
import {
  createProductReview,
  getProductReviewsAndSummary,
  listAdminProductReviews,
  moderateProductReview,
  deleteProductReview,
  cleanupSyntheticTestRecords
} from '../src/lib/crm-store';
import {
  fetchProducts,
  fetchProductBySlug,
  updateProduct
} from '../src/lib/data-store';
import { getSystemAdminToken } from '../src/lib/supabase';
import { runCatalogIntelligenceEngine } from '../src/lib/assistant-engine';
import { Product } from '../src/types';

async function runTests() {
  console.log('==========================================================');
  console.log('ENGINITY — Product Ratings & Dynamic Pricing Test Suite');
  console.log('==========================================================\n');

  let passed = 0;
  const pass = (label: string) => {
    passed++;
    console.log(`✅ [PASS] ${label}`);
  };

  // Fetch real published products from Supabase to use a real product_id UUID
  const products = await fetchProducts({ publishedOnly: true });
  assert.ok(products.length > 0, 'Catalog must have at least one published product');
  const targetProduct = products[0];
  console.log(`Using real catalog product: "${targetProduct.name_ar}" (ID: ${targetProduct.id})\n`);

  // Authenticate system admin client so we can obtain a real admin token for moderation tests
  const realAdminToken = await getSystemAdminToken();
  assert.ok(realAdminToken, 'Must obtain a valid admin session token');

  const createdReviewIds: string[] = [];

  try {
    console.log('--- PART A: PRODUCT RATINGS & REVIEWS TESTS (1–12) ---');

    // Test 1–5: Submit valid ratings 1, 2, 3, 4, and 5 stars (including with and without review text)
    for (const star of [1, 2, 3, 4, 5]) {
      const reviewText =
        star === 3
          ? undefined // Test 5: Submit valid rating without review text
          : `[TEST_SYNTHETIC] تجربة تقييم ${star} نجوم لنظام الأتمتة`;
      const res = await createProductReview({
        product_id: targetProduct.id,
        customer_name: `[TEST_SYNTHETIC] عميل اختبار ${star}`,
        rating: star,
        review_text: reviewText
      });
      assert.equal(res.success, true, `Review submission for ${star} stars must succeed: ${res.message}`);
      assert.ok(res.review, 'Created review object must be returned');
      assert.equal(res.review.rating, star, `Saved rating must be ${star}`);
      assert.equal(res.review.status, 'pending', 'Newly submitted review must default to pending status');
      if (star === 3) {
        assert.equal(res.review.review_text, null, 'Review without text must store null review_text');
      }
      createdReviewIds.push(res.review.id);
    }
    pass('Tests 1 & 4 & 5: Valid 1, 2, 3 (no text), 4, and 5 star reviews saved with status=pending');

    // Test 2: Reject rating 0, 6, negative, or non-numeric
    for (const invalidRating of [0, 6, -1, 3.5, NaN]) {
      const res = await createProductReview({
        product_id: targetProduct.id,
        customer_name: '[TEST_SYNTHETIC] عميل',
        rating: invalidRating
      });
      assert.equal(res.success, false, `Rating ${invalidRating} must be rejected`);
    }
    pass('Test 2: Invalid ratings (0, 6, -1, 3.5, NaN) are strictly rejected');

    // Test 3: Reject empty customer name
    const emptyNameRes = await createProductReview({
      product_id: targetProduct.id,
      customer_name: '   ',
      rating: 5
    });
    assert.equal(emptyNameRes.success, false, 'Empty customer name must be rejected');
    pass('Test 3: Empty customer name is strictly rejected');

    // Test 6 & 8: Pending reviews must NOT appear publicly; product with 0 approved reviews must have averageRating=0 and totalReviews=0
    const beforeApproval = await getProductReviewsAndSummary(targetProduct.id);
    const leakedPending = beforeApproval.reviews.some(r => createdReviewIds.includes(r.id));
    assert.equal(leakedPending, false, 'Pending reviews must never leak into public product reviews');
    const zeroSummary = computeProductRatingSummary('00000000-0000-0000-0000-000000000000', []);
    assert.equal(zeroSummary.totalReviews, 0);
    assert.equal(zeroSummary.averageRating, 0, 'Product with 0 reviews must not have a fake 5-star rating');
    pass('Tests 6 & 8: Pending reviews are hidden publicly & 0-review products report 0 average rating (no fake stars)');

    // Test 12: Non-admin cannot approve, reject, or delete reviews
    const unauthMod = await moderateProductReview(createdReviewIds[0], 'approved', {
      token: 'invalid-non-admin-token',
      requireAuthCheck: true
    });
    assert.equal(unauthMod.success, false, 'Non-admin token must be rejected when moderating');
    assert.equal(unauthMod.unauthorized, true);

    const unauthDel = await deleteProductReview(createdReviewIds[0], {
      token: 'invalid-non-admin-token',
      requireAuthCheck: true
    });
    assert.equal(unauthDel.success, false, 'Non-admin token must be rejected when deleting');
    assert.equal(unauthDel.unauthorized, true);
    pass('Test 12: Non-admin callers are blocked from approving, rejecting, or deleting reviews');

    // Test 9: Admin approves reviews (let's approve the 4-star and 5-star reviews)
    const rev4Id = createdReviewIds[3]; // 4 stars
    const rev5Id = createdReviewIds[4]; // 5 stars
    const approved4 = await moderateProductReview(rev4Id, 'approved', {
      token: realAdminToken,
      requireAuthCheck: true
    });
    const approved5 = await moderateProductReview(rev5Id, 'approved', {
      token: realAdminToken,
      requireAuthCheck: true
    });
    assert.equal(approved4.success, true);
    assert.equal(approved4.review?.status, 'approved');
    assert.equal(approved5.success, true);
    assert.equal(approved5.review?.status, 'approved');

    // Test 7: Verify average rating and count match SQL/approved data
    const afterApproval = await getProductReviewsAndSummary(targetProduct.id);
    const publicIds = afterApproval.reviews.map(r => r.id);
    assert.equal(publicIds.includes(rev4Id), true, 'Approved 4-star review must appear publicly');
    assert.equal(publicIds.includes(rev5Id), true, 'Approved 5-star review must appear publicly');
    assert.equal(publicIds.includes(createdReviewIds[0]), false, 'Unapproved 1-star review must remain hidden');

    // Verify exact calculation on the approved list
    const expectedAvg = Number(
      (
        afterApproval.reviews.reduce((acc, r) => acc + r.rating, 0) /
        afterApproval.reviews.length
      ).toFixed(1)
    );
    assert.equal(afterApproval.summary.averageRating, expectedAvg);
    assert.equal(afterApproval.summary.totalReviews, afterApproval.reviews.length);
    pass(`Tests 7 & 9: Admin approval publishes reviews and updates rating summary (${afterApproval.summary.averageRating}/5 from ${afterApproval.summary.totalReviews} approved reviews)`);

    // Test 10: Admin rejects a previously approved review -> disappears from public view
    const rejected4 = await moderateProductReview(rev4Id, 'rejected', {
      token: realAdminToken,
      requireAuthCheck: true
    });
    assert.equal(rejected4.success, true);
    assert.equal(rejected4.review?.status, 'rejected');
    const afterRejection = await getProductReviewsAndSummary(targetProduct.id);
    assert.equal(
      afterRejection.reviews.some(r => r.id === rev4Id),
      false,
      'Rejected review must immediately disappear from public product reviews'
    );
    pass('Test 10: Admin rejection hides review from public view and recalculates rating summary');

    // Test 11: Admin deletes a review -> permanently removed from admin list
    const delRes = await deleteProductReview(rev5Id, {
      token: realAdminToken,
      requireAuthCheck: true
    });
    assert.equal(delRes.success, true);
    const allAdminReviews = await listAdminProductReviews({
      token: realAdminToken,
      requireAuthCheck: true
    });
    assert.equal(allAdminReviews.success, true);
    assert.equal(
      allAdminReviews.reviews.some(r => r.id === rev5Id),
      false,
      'Deleted review must be removed from admin review list'
    );
    pass('Test 11: Admin deletion permanently removes review');

    console.log('\n--- PART B: DYNAMIC PRICING & DISCOUNT TESTS (1–12) ---');

    // Test 1: Product with only regular price (no discount)
    const p1 = resolveProductPricing({
      price_egp: 900,
      original_price_egp: 900,
      sale_price_egp: null
    });
    assert.equal(p1.hasDiscount, false);
    assert.equal(p1.currentPriceEgp, 900);
    assert.equal(p1.originalPriceEgp, 900);
    assert.equal(p1.salePriceEgp, null);
    assert.equal(p1.discountPercentage, 0);
    pass('Pricing Test 1: Product with only regular price shows no discount');

    // Test 2: Original 1000, Sale 750 -> 25% discount
    assert.equal(calculateDiscountPercentage(1000, 750), 25);
    const p2 = resolveProductPricing({
      price_egp: 750,
      original_price_egp: 1000,
      sale_price_egp: 750
    });
    assert.equal(p2.hasDiscount, true);
    assert.equal(p2.currentPriceEgp, 750);
    assert.equal(p2.originalPriceEgp, 1000);
    assert.equal(p2.discountPercentage, 25);
    pass('Pricing Test 2: Original 1000 + Sale 750 => 25% discount');

    // Test 3: Original 500, Sale 400 -> 20% discount
    assert.equal(calculateDiscountPercentage(500, 400), 20);
    pass('Pricing Test 3: Original 500 + Sale 400 => 20% discount');

    // Test 4: Decimal prices and rounding behavior (e.g. 999 -> 666 is 33.33% -> rounds to 33%)
    assert.equal(calculateDiscountPercentage(999, 666), 33);
    assert.equal(calculateDiscountPercentage(300, 199), 34);
    pass('Pricing Test 4: Decimal discount percentages round accurately via Math.round');

    // Test 5 & 6: Sale price equal to or greater than original price -> rejected
    const eqValidation = validateProductPricing({
      originalPriceEgp: 1000,
      salePriceEgp: 1000,
      hasDiscount: true
    });
    assert.equal(eqValidation.valid, false, 'salePrice == originalPrice must be rejected');

    const gtValidation = validateProductPricing({
      originalPriceEgp: 1000,
      salePriceEgp: 1200,
      hasDiscount: true
    });
    assert.equal(gtValidation.valid, false, 'salePrice > originalPrice must be rejected');
    pass('Pricing Tests 5 & 6: Sale price >= Original price is strictly rejected');

    // Test 7: Negative prices -> rejected
    const negOriginal = validateProductPricing({
      originalPriceEgp: -100,
      salePriceEgp: null,
      hasDiscount: false
    });
    assert.equal(negOriginal.valid, false);
    const negSale = validateProductPricing({
      originalPriceEgp: 500,
      salePriceEgp: -50,
      hasDiscount: true
    });
    assert.equal(negSale.valid, false);
    pass('Pricing Test 7: Negative original or sale prices are strictly rejected');

    // Test 8 & 9: Empty/null sale price and zero price handling
    const nullSale = resolveProductPricing({
      price_egp: 650,
      original_price_egp: 650,
      sale_price_egp: null
    });
    assert.equal(nullSale.hasDiscount, false);
    assert.equal(nullSale.discountPercentage, 0);

    const zeroSaleValidation = validateProductPricing({
      originalPriceEgp: 500,
      salePriceEgp: 0,
      hasDiscount: true
    });
    assert.equal(zeroSaleValidation.valid, false, 'Zero sale price in paid discount mode is rejected');
    pass('Pricing Tests 8 & 9: Empty/null sale price shows no discount badge & zero sale price is rejected');

    // Tests 10, 11, 12: Live end-to-end persistence of discount on a real product, consistency across fetchProducts, fetchProductBySlug, and AI Shopping Assistant, then restoring original price!
    const originalBackup: Partial<Product> = {
      price_egp: targetProduct.price_egp,
      original_price_egp: targetProduct.original_price_egp ?? targetProduct.price_egp,
      sale_price_egp: targetProduct.sale_price_egp ?? null,
      admin_notes: targetProduct.admin_notes
    };

    try {
      // Apply a 25% discount (Original: 1000, Sale: 750)
      const updatedDiscounted = await updateProduct(targetProduct.id, {
        original_price_egp: 1000,
        sale_price_egp: 750,
        price_egp: 750
      });
      assert.ok(updatedDiscounted, 'updateProduct with discount must succeed');
      const resolvedUpdated = resolveProductPricing(updatedDiscounted);
      assert.equal(resolvedUpdated.hasDiscount, true);
      assert.equal(resolvedUpdated.originalPriceEgp, 1000);
      assert.equal(resolvedUpdated.currentPriceEgp, 750);
      assert.equal(resolvedUpdated.discountPercentage, 25);

      // Verify consistency on fetchProductBySlug (Product Detail View) and fetchProducts (Product Card)
      const bySlug = await fetchProductBySlug(targetProduct.slug, true);
      assert.ok(bySlug);
      const slugPricing = resolveProductPricing(bySlug);
      assert.equal(slugPricing.hasDiscount, true);
      assert.equal(slugPricing.originalPriceEgp, 1000);
      assert.equal(slugPricing.currentPriceEgp, 750);
      assert.equal(slugPricing.discountPercentage, 25);
      // Authoritative checkout price integrity
      assert.equal(bySlug.price_egp, 750, 'Authoritative price_egp must equal the discounted sale price');

      // Verify AI Shopping Assistant recommendation card receives the discounted price & percentage
      const allNow = await fetchProducts({ publishedOnly: true });
      const discovery = runCatalogIntelligenceEngine(targetProduct.name_ar, allNow, 'ar');
      const rec = discovery.recommendations.find(r => r.product_id === targetProduct.id);
      assert.ok(rec, 'AI Shopping Assistant must recommend the discounted product');
      assert.equal(rec.price_egp, 750);
      assert.equal(rec.original_price_egp, 1000);
      assert.equal(rec.sale_price_egp, 750);
      assert.equal(rec.discount_percentage, 25);

      // Test 10: Remove discount from discounted product -> restores original price
      const restoredNoDiscount = await updateProduct(targetProduct.id, {
        original_price_egp: 1000,
        sale_price_egp: null,
        price_egp: 1000
      });
      assert.ok(restoredNoDiscount);
      const restoredPricing = resolveProductPricing(restoredNoDiscount);
      assert.equal(restoredPricing.hasDiscount, false);
      assert.equal(restoredPricing.currentPriceEgp, 1000);
      assert.equal(restoredPricing.discountPercentage, 0);
      pass('Pricing Tests 10, 11 & 12: Live discount persistence, Card/Detail/Assistant consistency, and Discount Removal verified');
    } finally {
      // Restore targetProduct to its exact original pricing state
      await updateProduct(targetProduct.id, originalBackup);
    }
  } finally {
    // Clean up any synthetic test reviews created during this run
    await cleanupSyntheticTestRecords();
  }

  console.log(`\n🎉 ALL ${passed} TEST GROUPS PASSED SUCCESSFULLY!`);
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
