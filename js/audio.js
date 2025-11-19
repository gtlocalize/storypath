class AudioManager {
    constructor() {
        this.enabled = false;
        this.lang = 'en';
        this.audioContext = null;
        this.currentAudio = null;
        
        // Initialize Howler for SFX
        this.sounds = {
            // Use generated beeps for UI to ensure they work without external assets
            click: null, 
            hover: null,
            ambient: null
        };
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Generate a simple beep using Web Audio API (no external file needed)
    playBeep(frequency = 440, duration = 0.1, type = 'sine', volume = 0.1) {
        if (!this.enabled) return;
        this.initAudioContext();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    setLanguage(lang) {
        this.lang = lang;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.initAudioContext();
        } else {
            this.stop();
        }
        return this.enabled;
    }

    async speak(text) {
        if (!this.enabled || !text) return;

        // Cancel current speech
        this.stop();

        try {
            // Use OpenAI TTS via our backend
            const voice = this.lang === 'ja' ? 'nova' : 'alloy'; // 'nova' is good for Japanese
            
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            });

            if (!response.ok) throw new Error('TTS request failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            this.currentAudio = new Audio(url);
            this.currentAudio.play();
            
            this.currentAudio.onended = () => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
            };

        } catch (error) {
            console.error('TTS Error:', error);
            // Fallback to Web Speech API if backend fails
            this.speakFallback(text);
        }
    }

    speakFallback(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang === 'ja' ? 'ja-JP' : 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        window.speechSynthesis.cancel();
    }

    playSfx(name) {
        if (!this.enabled) return;

        if (name === 'click') {
            this.playBeep(600, 0.05, 'sine', 0.1);
        } else if (name === 'hover') {
            this.playBeep(400, 0.03, 'triangle', 0.05);
        }
    }
    
    playAmbient(genre) {
        if (!this.enabled) return;

        // Stop previous ambient
        if (this.sounds.ambient) {
            this.sounds.ambient.fade(0.5, 0, 1000);
            setTimeout(() => this.sounds.ambient.stop(), 1000);
        }
        
        // Map genre to ambient sound (placeholders for now)
        const ambientUrls = {
            fantasy: 'https://assets.codepen.io/21542/fantasy_ambience.mp3',
            scifi: 'https://assets.codepen.io/21542/scifi_ambience.mp3',
            mystery: 'https://assets.codepen.io/21542/mystery_ambience.mp3',
            horror: 'https://assets.codepen.io/21542/horror_ambience.mp3',
            adventure: 'https://assets.codepen.io/21542/adventure_ambience.mp3'
        };
        
        if (ambientUrls[genre]) {
            this.sounds.ambient = new Howl({
                src: [ambientUrls[genre]],
                html5: true,
                loop: true,
                volume: 0.3
            });
            
            this.sounds.ambient.play();
            this.sounds.ambient.fade(0, 0.3, 2000);
        }
    }
}

// Export instance
window.audioManager = new AudioManager();
