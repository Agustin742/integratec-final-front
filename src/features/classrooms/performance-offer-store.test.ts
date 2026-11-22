import { beforeEach, describe, expect, test } from 'vitest';
import {
  beginPerformanceOffer,
  resetPerformanceOfferStore,
  usePerformanceOfferStore,
} from './performance-offer-store';

function status(): string {
  return usePerformanceOfferStore.getState().status;
}

describe('performance-offer-store (#56)', () => {
  beforeEach(() => {
    resetPerformanceOfferStore();
  });

  test('starts idle and never offers by itself', () => {
    expect(status()).toBe('idle');
  });

  test('a sustained low-fps period begins the offer exactly once', () => {
    beginPerformanceOffer();
    expect(status()).toBe('offering');
    // A repeated trigger while the offer is visible changes nothing.
    beginPerformanceOffer();
    expect(status()).toBe('offering');
  });

  test('declining dismisses the offer for the rest of the session (S4/S5)', () => {
    beginPerformanceOffer();
    usePerformanceOfferStore.getState().decline();
    expect(status()).toBe('declined');

    // Later sustained low periods must not re-offer after a decline.
    beginPerformanceOffer();
    expect(status()).toBe('declined');
  });

  test('accepting records the choice and allows a later re-offer after returning to 3D', () => {
    beginPerformanceOffer();
    usePerformanceOfferStore.getState().accept();
    expect(status()).toBe('accepted');

    // Returning to 3D is a conditions change: a new sustained low period
    // may offer again, but only after a fresh trigger.
    beginPerformanceOffer();
    expect(status()).toBe('offering');
  });

  test('accept and decline only act while the offer is visible', () => {
    usePerformanceOfferStore.getState().accept();
    expect(status()).toBe('idle');
    usePerformanceOfferStore.getState().decline();
    expect(status()).toBe('idle');
  });

  test('reset clears the session decision (logout cleanup)', () => {
    beginPerformanceOffer();
    usePerformanceOfferStore.getState().decline();
    resetPerformanceOfferStore();
    expect(status()).toBe('idle');
  });
});
