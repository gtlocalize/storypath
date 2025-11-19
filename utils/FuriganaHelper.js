const kuromoji = require('kuromoji');
const path = require('path');

class FuriganaHelper {
    constructor() {
        this.tokenizer = null;
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            return new Promise((resolve, reject) => {
                const dicPath = path.join(require.resolve('kuromoji'), '../../dict');

                kuromoji.builder({ dicPath }).build((err, tokenizer) => {
                    if (err) {
                        console.error('Failed to init kuromoji:', err);
                        reject(err);
                        return;
                    }

                    this.tokenizer = tokenizer;
                    this.initialized = true;
                    console.log('✨ Furigana helper initialized with kuromoji');
                    resolve();
                });
            });
        }
    }

    async addFurigana(text) {
        if (!this.initialized) {
            await this.init();
        }

        if (!this.tokenizer) {
            return text; // Fallback if tokenizer failed to init
        }

        try {
            const tokens = this.tokenizer.tokenize(text);
            let result = '';

            for (const token of tokens) {
                // token.surface_form = the actual text
                // token.reading = the katakana reading
                // token.pos = part of speech

                const surface = token.surface_form;
                const reading = token.reading;

                // Check if this token needs furigana (has kanji)
                const hasKanji = /[\u4e00-\u9faf]/.test(surface);

                if (hasKanji && reading && reading !== surface) {
                    // Convert katakana reading to hiragana
                    const hiragana = this.katakanaToHiragana(reading);
                    // Create ruby tag
                    result += `<ruby>${surface}<rt>${hiragana}</rt></ruby>`;
                } else {
                    // No furigana needed
                    result += surface;
                }
            }

            return result;
        } catch (error) {
            console.error('Furigana conversion error:', error);
            return text;
        }
    }

    katakanaToHiragana(str) {
        return str.replace(/[\u30a1-\u30f6]/g, (match) => {
            const chr = match.charCodeAt(0) - 0x60;
            return String.fromCharCode(chr);
        });
    }
}

// Singleton instance
const furiganaHelper = new FuriganaHelper();

module.exports = furiganaHelper;
