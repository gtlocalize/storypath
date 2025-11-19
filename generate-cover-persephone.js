// Generate book cover for The Persephone Recursion
const ImageGenerator = require('./ai/ImageGenerator');
const sqlite3 = require('sqlite3').verbose();

const STORY_ID = 'eb33c2d0-1899-46e8-8107-0a2fbd8aaac6';
const TITLE = 'The Persephone Recursion';
const GENRE = 'scifi';
const MATURITY = 'adult';

async function generateCover() {
    console.log('📚 Generating book cover for The Persephone Recursion...');

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
                console.log('✅ Database updated!');
            }
            db.close();
        });
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generateCover();
