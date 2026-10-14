import { Product } from '../types/product';
import { ProductMatchMethod, ProductMatchSuggestion } from '../types/invoice';

export interface MatchEvaluationResult {
  suggestedProduct: Product | null;
  matchMethod: ProductMatchMethod;
  matchConfidence: number; // 0 - 100
  isLowConfidence: boolean; // < 75 or NO_MATCH
  manualSelectionRequired: boolean;
  matchReason: string;
  tierNumber: 1 | 2 | 3 | 4 | 0;
  tierLabel: string;
}

/**
 * Normalizes product name by lowercasing, replacing punctuation with spaces,
 * and collapsing extra whitespace.
 */
export function normalizeProductName(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function computeLevenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  return d[m][n];
}

/**
 * Computes hybrid fuzzy similarity between two product names
 * based on token overlap (Dice coefficient) and Levenshtein edit distance.
 */
export function computeFuzzySimilarity(a: string, b: string): number {
  const normA = normalizeProductName(a);
  const normB = normalizeProductName(b);
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  // Substring containment check
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    return Math.max(0.70, (minLen / maxLen) * 0.90);
  }

  // Token overlap Dice coefficient
  const tokensA = new Set(normA.split(' ').filter((t) => t.length > 1));
  const tokensB = new Set(normB.split(' ').filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let matches = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      matches += 1.0;
    } else {
      for (const bToken of tokensB) {
        if (bToken.startsWith(token) || token.startsWith(bToken)) {
          matches += 0.5;
          break;
        }
      }
    }
  });

  const dice = (2 * matches) / (tokensA.size + tokensB.size);

  // Edit distance similarity
  const maxLen = Math.max(normA.length, normB.length);
  const levDist = computeLevenshteinDistance(normA, normB);
  const levSim = Math.max(0, 1 - levDist / maxLen);

  return Math.min(1.0, Math.max(dice * 0.85, levSim * 0.85));
}

/**
 * 4-TIER PRODUCT MATCHING ENGINE
 * Evaluates candidate items strictly in order:
 * 1. Barcode
 * 2. SKU
 * 3. Exact normalized name
 * 4. Fuzzy name matching
 *
 * Rules:
 * - If confidence is low (< 75%), requires manual selection.
 * - Does NOT automatically create a new product without user confirmation.
 */
export function evaluateProductMatchOrder(
  item: { productName?: string; sku?: string; barcode?: string },
  catalog: Product[]
): MatchEvaluationResult {
  const rawBarcode = item.barcode?.trim() || '';
  const rawSku = item.sku?.trim() || '';
  const rawName = item.productName?.trim() || '';

  // 1. TIER 1: BARCODE
  if (
    rawBarcode &&
    rawBarcode !== 'Not detected' &&
    rawBarcode !== 'Missing / Illegible' &&
    rawBarcode !== 'None' &&
    rawBarcode.length >= 3
  ) {
    const cleanBarcode = rawBarcode.replace(/\s+/g, '');
    const barcodeMatch = catalog.find(
      (p) => p.barcode && p.barcode.replace(/\s+/g, '') === cleanBarcode
    );
    if (barcodeMatch) {
      return {
        suggestedProduct: barcodeMatch,
        matchMethod: 'BARCODE',
        matchConfidence: 100,
        isLowConfidence: false,
        manualSelectionRequired: false,
        matchReason: `Exact Barcode match (${barcodeMatch.barcode})`,
        tierNumber: 1,
        tierLabel: 'Tier 1: Barcode',
      };
    }
  }

  // 2. TIER 2: SKU
  if (
    rawSku &&
    rawSku !== 'Missing' &&
    rawSku !== 'SKU-UNRESOLVED' &&
    rawSku !== 'None' &&
    rawSku.length >= 2
  ) {
    const cleanInputSku = rawSku.toLowerCase().replace(/[^a-z0-9]/g, '');
    const skuMatch = catalog.find(
      (p) => p.sku && p.sku.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanInputSku
    );
    if (skuMatch) {
      return {
        suggestedProduct: skuMatch,
        matchMethod: 'SKU',
        matchConfidence: 95,
        isLowConfidence: false,
        manualSelectionRequired: false,
        matchReason: `Exact SKU match (${skuMatch.sku})`,
        tierNumber: 2,
        tierLabel: 'Tier 2: SKU',
      };
    }
  }

  // 3. TIER 3: EXACT NORMALIZED NAME
  if (rawName) {
    const normInputName = normalizeProductName(rawName);
    if (normInputName.length > 0) {
      const exactNameMatch = catalog.find(
        (p) => normalizeProductName(p.name) === normInputName
      );
      if (exactNameMatch) {
        return {
          suggestedProduct: exactNameMatch,
          matchMethod: 'EXACT_NAME',
          matchConfidence: 90,
          isLowConfidence: false,
          manualSelectionRequired: false,
          matchReason: `Exact normalized name match ("${exactNameMatch.name}")`,
          tierNumber: 3,
          tierLabel: 'Tier 3: Exact Normalized Name',
        };
      }
    }
  }

  // 4. TIER 4: FUZZY NAME MATCHING
  if (rawName && catalog.length > 0) {
    let bestProduct: Product | null = null;
    let highestSimilarity = 0;

    for (const prod of catalog) {
      const similarity = computeFuzzySimilarity(rawName, prod.name);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestProduct = prod;
      }
    }

    if (bestProduct && highestSimilarity >= 0.40) {
      const confPercent = Math.min(84, Math.round(highestSimilarity * 100));
      const isLow = confPercent < 75; // Low confidence threshold
      return {
        suggestedProduct: bestProduct,
        matchMethod: 'FUZZY_NAME',
        matchConfidence: confPercent,
        isLowConfidence: isLow,
        manualSelectionRequired: isLow,
        matchReason: isLow
          ? `Low confidence fuzzy match (${confPercent}%) with "${bestProduct.name}". Manual selection required.`
          : `Fuzzy name resemblance (${confPercent}%) with "${bestProduct.name}"`,
        tierNumber: 4,
        tierLabel: 'Tier 4: Fuzzy Name Matching',
      };
    }
  }

  // NO MATCH FOUND (Tier 0)
  return {
    suggestedProduct: null,
    matchMethod: 'NO_MATCH',
    matchConfidence: 0,
    isLowConfidence: true,
    manualSelectionRequired: true,
    matchReason:
      'No matching catalog product. Manual selection or explicit new product confirmation required.',
    tierNumber: 0,
    tierLabel: 'No Match (0%)',
  };
}
