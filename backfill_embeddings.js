const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const EmbeddingHelper = require('./ai/EmbeddingHelper');
require('dotenv').config();

const storiesToBackfill = [
    '02a89e74-dff6-4f6f-8c39-7f643859ff60', // Mystery Kids - The Boiler Room
    '0d9d1977-9873-4be1-8dbd-97bedb0eddea', // Horror Kids - The Keeper's Whisper
    '1322ba91-275a-4954-b4b6-db590cc5238e', // Fantasy Kids - The Singing Stone
    '2631ac8e-5da5-41ea-b469-f40d7102433b', // Adventure Adult - The Cartographer's Inheritance
    '3835f039-230e-438d-8feb-2291a39f0d24', // Adventure Kids - The Lighthouse Keeper's Fear
    '420da76d-9c59-49ae-94f3-48dfb15ef5e7', // Horror Adult - The Keeper
    '4cd043d7-58fd-433d-aec6-7f9ada3f69d6', // Sci-Fi Kids - The Flickering Sky
    '62149e44-03d3-42a4-836a-34e0c9c96a1e', // Sci-Fi Adult - The Coherence Test
    '8cc598e6-0ce8-4f9b-a7ce-b1ab6b50b1fb', // Mystery Adult - The Forged Inheritance
    '971c579f-8ddc-4bc8-a6c9-eff8c5424277'  // Fantasy Adult - The Cartographer's Wound
];

async function backfillEmbeddings() {
    const embeddingHelper = new EmbeddingHelper(process.env.OPENAI_API_KEY);
    await embeddingHelper.initialize();

    console.log('📊 Starting embedding backfill for existing stories...\n');

    for (const storyId of storiesToBackfill) {
        try {
            const dbPath = `/opt/vodbase/storypath/stories/${storyId}.db`;
            const db = new sqlite3.Database(dbPath);
            const dbGet = promisify(db.get.bind(db));

            const story = await dbGet('SELECT * FROM stories WHERE id = ?', [storyId]);

            if (!story) {
                console.log(`⚠️  Story not found: ${storyId}`);
                db.close();
                continue;
            }

            console.log(`📖 Processing: ${story.title}`);
            console.log(`   Genre: ${story.genre}, Maturity: ${story.maturity_level}`);

            await embeddingHelper.addStory(
                storyId,
                story.genre,
                story.maturity_level,
                story.title,
                story.story_seed || '',
                story.story_arc || ''
            );

            console.log(`✅ Embedding stored for: ${story.title}\n`);
            db.close();

        } catch (error) {
            console.error(`❌ Failed to process ${storyId}:`, error.message, '\n');
        }
    }

    console.log('🎉 Embedding backfill complete!');
}

backfillEmbeddings().catch(console.error);
