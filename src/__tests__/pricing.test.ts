import { describe, it, expect } from 'vitest';
import {
  getEffectiveProductPricing,
  validateProductPricing,
  formatPrice,
  calculateDiscountPercentage
} from '../lib/utils';

describe('Product Pricing & Currency Formatting (TASK-004 & TASK-012)', () => {
  it('computes effective price, discount amount, and rounded discount percentage when sale_price_egp < original_price_egp', () => {
    const pricing = getEffectiveProductPricing({
      price_egp: 500,
      original_price_egp: 1000,
      sale_price_egp: 500
    });

    expect(pricing.hasDiscount).toBe(true);
    expect(pricing.effectivePriceEgp).toBe(500);
    expect(pricing.currentPriceEgp).toBe(500);
    expect(pricing.originalPriceEgp).toBe(1000);
    expect(pricing.salePriceEgp).toBe(500);
    expect(pricing.discountAmountEgp).toBe(500);
    expect(pricing.discountPercentage).toBe(50);
  });

  it('returns hasDiscount = false when sale_price_egp is null or equal to original_price_egp', () => {
    const noSale = getEffectiveProductPricing({
      price_egp: 1000,
      original_price_egp: 1000,
      sale_price_egp: null
    });

    expect(noSale.hasDiscount).toBe(false);
    expect(noSale.effectivePriceEgp).toBe(1000);
    expect(noSale.discountPercentage).toBe(0);
    expect(noSale.discountAmountEgp).toBe(0);
  });

  it('validates product pricing constraints in Arabic and English', () => {
    const valid = validateProductPricing(1000, 500);
    expect(valid.valid).toBe(true);
    expect(valid.discountPercentage).toBe(50);
    expect(valid.effectivePriceEgp).toBe(500);

    const invalidZero = validateProductPricing(0, null);
    expect(invalidZero.valid).toBe(false);
    expect(invalidZero.errorEn).toContain('greater than zero');

    const invalidSaleHigher = validateProductPricing(500, 600);
    expect(invalidSaleHigher.valid).toBe(false);
    expect(invalidSaleHigher.errorAr).toContain('أقل من السعر الأصلي');
  });

  it('formats EGP and approximate USD prices consistently via formatPrice', () => {
    expect(formatPrice(500, 'EGP', 'en', 50)).toBe('500 EGP');
    expect(formatPrice(500, 'EGP', 'ar', 50)).toContain('ج.م');
    expect(formatPrice(500, 'USD', 'en', 50)).toBe('~$10 USD');
    expect(formatPrice(500, 'USD', 'ar', 50)).toBe('~$10 USD');
    expect(calculateDiscountPercentage(1000, 500)).toBe(50);
  });
});
