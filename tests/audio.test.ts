import { describe, it, expect } from 'vitest';
import { SoundEngine } from '../src/audio/sound-effects';

describe('SoundEngine', () => {
  it('instantiates safely without audio context in headless environment', () => {
    const sound = new SoundEngine();
    expect(() => sound.playFishPickup()).not.toThrow();
    expect(() => sound.playSlideWoosh(0.5)).not.toThrow();
    sound.setMuted(true);
    expect(sound.ensureContext()).toBe(null);
  });
});
