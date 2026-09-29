import { describe, expect, it } from 'vitest';
import { calculateTargetDimensions, compressProductImage } from '@/lib/client-image-compression';
import { imageUrlSchema } from '@/lib/auth/validation';

describe('client-image-compression', () => {
  describe('calculateTargetDimensions', () => {
    it('scales down landscape camera photo (4000x3000) preserving aspect ratio', () => {
      const result = calculateTargetDimensions(4000, 3000, 1000, 1000);
      expect(result.width).toBe(1000);
      expect(result.height).toBe(750);
    });

    it('scales down portrait mobile photo (3000x4000) preserving aspect ratio', () => {
      const result = calculateTargetDimensions(3000, 4000, 1000, 1000);
      expect(result.width).toBe(750);
      expect(result.height).toBe(1000);
    });

    it('does not upscale images that are already smaller than bounding box', () => {
      const result = calculateTargetDimensions(500, 400, 1000, 1000);
      expect(result.width).toBe(500);
      expect(result.height).toBe(400);
    });

    it('handles square images proportionally', () => {
      const result = calculateTargetDimensions(2400, 2400, 800, 800);
      expect(result.width).toBe(800);
      expect(result.height).toBe(800);
    });

    it('handles fallback for invalid or zero dimensions', () => {
      const result = calculateTargetDimensions(0, 0, 1000, 1000);
      expect(result.width).toBe(1000);
      expect(result.height).toBe(1000);
    });
  });

  describe('compressProductImage fallback behavior in non-browser environments', () => {
    it('returns the original file when window is not defined or on SVG vector files', async () => {
      const fakeSvg = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
      const result = await compressProductImage(fakeSvg);
      expect(result).toBe(fakeSvg);
    });

    it('safely returns the original file for non-image files', async () => {
      const fakeDoc = new File(['hello'], 'document.pdf', { type: 'application/pdf' });
      const result = await compressProductImage(fakeDoc);
      expect(result).toBe(fakeDoc);
    });
  });

  describe('imageUrlSchema validation with local product uploads', () => {
    it('accepts local uploaded product paths under /uploads/products/', () => {
      const validPath = '/uploads/products/shop-main/2026/09/1727645000-photo.webp';
      const parsed = imageUrlSchema.safeParse(validPath);
      expect(parsed.success).toBe(true);
    });

    it('accepts valid data URLs', () => {
      const validDataUrl = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
      const parsed = imageUrlSchema.safeParse(validDataUrl);
      expect(parsed.success).toBe(true);
    });

    it('accepts valid https URLs', () => {
      const validHttpsUrl = 'https://images.unsplash.com/photo-12345?w=500';
      const parsed = imageUrlSchema.safeParse(validHttpsUrl);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid paths or unsafe schemes', () => {
      expect(imageUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
      expect(imageUrlSchema.safeParse('/etc/passwd').success).toBe(false);
      expect(imageUrlSchema.safeParse('').success).toBe(false);
    });
  });
});
