const ImageGenerator = require('./ai/ImageGenerator');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const STORY_ID = 'eb33c2d0-1899-46e8-8107-0a2fbd8aaac6';
const TITLE = 'The Persephone Recursion';
const GENRE = 'scifi';
const MATURITY = 'adult';

async function generateCover() {
    console.log('📚 Generating book cover for The Persephone Recursion...');
    console.log('API Key loaded:', process.env.REPLICATE_API_TOKEN ? 'Yes' : 'No');

    const imageGen = new ImageGenerator({
        apiKey: process.env.REPLICATE_API_TOKEN
    });

    try {
        const coverUrl = await imageGen.generateBookCover(TITLE, GENRE, MATURITY, STORY_ID);
        console.log(`✅ Cover generated: ${coverUrl}`);

        // Update database
        const db = new sqlite3.Database(`/opt/vodbase/storypath/stories/${STORY_ID}.db`);

        db.run('UPDATE stories SET book_cover_url = ? WHERE id = ?', [coverUrl, STORY_ID], (err) => {
            if (err) {
                console.error('❌ Failed to update database:', err);
            } else {
                console.log('✅ Database updated with cover URL!');
            }
            db.close();
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

generateCover();
