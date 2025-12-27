// Sound effects using Web Audio API

class SoundManager {
  private audioContext: AudioContext | null = null;
  private soundsEnabled: boolean = true;

  constructor() {
    // Initialize audio context on user interaction
    if (typeof window !== 'undefined') {
      this.initAudioContext();
    }
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  private ensureAudioContext() {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Generate elevator door opening sound - smooth and very low volume
  playElevatorOpen() {
    if (!this.soundsEnabled || !this.audioContext) return;
    this.ensureAudioContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Smooth, low-frequency sound with filter
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.5;
    
    // Use sine wave for smoothness
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
    
    // Very low volume
    gainNode.gain.setValueAtTime(0.015, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.002, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  // Generate elevator door closing sound - smooth and very low volume
  playElevatorClose() {
    if (!this.soundsEnabled || !this.audioContext) return;
    this.ensureAudioContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Smooth, low-frequency sound with filter
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.5;
    
    // Use sine wave for smoothness
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(80, this.audioContext.currentTime + 0.4);
    
    // Very low volume
    gainNode.gain.setValueAtTime(0.015, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.002, this.audioContext.currentTime + 0.4);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.4);
  }

  // Generate footstep sound - very low volume
  playFootstep() {
    if (!this.soundsEnabled || !this.audioContext) return;
    this.ensureAudioContext();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Footstep-like sound
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.1);
    
    // Very low volume for footsteps - extremely subtle
    gainNode.gain.setValueAtTime(0.005, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0005, this.audioContext.currentTime + 0.1);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Generate ambient store sound (subtle background)
  playAmbient() {
    if (!this.soundsEnabled || !this.audioContext) return;
    this.ensureAudioContext();
    
    // Very subtle ambient sound - can be extended for continuous playback
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 200;
    
    gainNode.gain.value = 0.02; // Very quiet
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.5);
  }

  // Generate happy/positive sound for path drawing
  playPathStart() {
    if (!this.soundsEnabled || !this.audioContext) return;
    this.ensureAudioContext();
    
    const now = this.audioContext.currentTime;
    
    // Create a pleasant ascending melody
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 - C major chord
    const duration = 0.15;
    
    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      
      const startTime = now + (index * duration * 0.3);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.03, startTime + 0.05); // Reduced volume
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    });
  }

  setEnabled(enabled: boolean) {
    this.soundsEnabled = enabled;
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

