import { describe, expect, it } from 'vitest';
import { ProductImageValidationError, saveProductImageUpload } from '../../lib/product-images';

describe('lib/product-images', () => {
  it('rejects SVG uploads to prevent stored XSS', async () => {
    const svgFile = new File(['<svg><script>alert(1)</script></svg>'], 'bad.svg', {
      type: 'image/svg+xml'
    });

    await expect(saveProductImageUpload('shop-1', svgFile)).rejects.toBeInstanceOf(
      ProductImageValidationError
    );
  });
});
