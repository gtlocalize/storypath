#!/usr/bin/env node
/**
 * Complete Story Generator
 * 
 * Generates a full story with ~10 scenes + ending, images, TTS audio, and book cover.
 * Emulates the natural flow of interactive story creation.
 * 
 * Usage:
 *   node generate-complete-story.js [options]
 * 
 * Options:
 *   --genre <genre>       fantasy|scifi|mystery|horror|adventure (default: fantasy)
 *   --maturity <level>    kids|adults (default: kids)
 *   --language <lang>     en|ja (default: en)
 *   --scenes <count>      Number of scenes before ending (default: 10)
 *   --name <name>         Protagonist name (default: random)
 *   --seed <idea>         Story seed/concept (optional)
 *   --skip-images         Skip image generation
 *   --skip-audio          Skip TTS audio generation
 *   --skip-cover          Skip book cover generation
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const crypto = require('crypto');
const fs = require('fs').promises;

const StoryDatabase = require('./database/StoryDatabase');
const ImageGenerator = require('./ai/ImageGenerator');

// ============ CLI ARGUMENT PARSING ============
const args = process.argv.slice(2);

function getArg(name, defaultVal) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') 
        ? args[idx + 1] 
        : defaultVal;
}

function hasFlag(name) {
    return args.includes(`--${name}`);
}

const CONFIG = {
    genre: getArg('genre', 'fantasy'),
    maturity: getArg('maturity', 'kids'),
    language: getArg('language', 'en'),
    sceneCount: parseInt(getArg('scenes', '10')),
    protagonistName: getArg('name', null),
    storySeed: getArg('seed', null),
    skipImages: hasFlag('skip-images'),
    skipAudio: hasFlag('skip-audio'),
    skipCover: hasFlag('skip-cover')
};

// Random protagonist names
const NAMES = {
    en: ['Luna', 'Oliver', 'Maya', 'Finn', 'Aria', 'Leo', 'Zara', 'Max', 'Ivy', 'Jasper'],
    ja: ['ユウキ', 'サクラ', 'ハルト', 'ミオ', 'レン', 'アオイ', 'ヒナタ', 'ソラ']
};

if (!CONFIG.protagonistName) {
    const names = NAMES[CONFIG.language] || NAMES.en;
    CONFIG.protagonistName = names[Math.floor(Math.random() * names.length)];
}

// ============ INITIALIZE SERVICES ============
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const imageGenerator = new ImageGenerator({
    apiKey: process.env.REPLICATE_API_TOKEN,
    outputDir: '/var/www/html/storypath/images/generated'
});

// ============ HELPER FUNCTIONS ============

async function callClaude(system, prompt, maxTokens = 4096) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        temperature: 0.85,
        system,
        messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
}

async function generateTTS(text, voice, storyId, sceneNumber) {
    const cacheDir = path.join(__dirname, 'audio', 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
    
    // Clean text for TTS (remove furigana brackets)
    const cleanText = text
        .replace(/《[^》]+》/g, '')
        .replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1')
        .replace(/<[^>]+>/g, '');
    
    const cacheKey = crypto.createHash('md5').update(`${cleanText}-${voice}`).digest('hex');
    const cachePath = path.join(cacheDir, `${cacheKey}.mp3`);
    
    // Check cache
    try {
        await fs.access(cachePath);
        console.log(`    🔊 TTS cached`);
        return `/storypath/audio/cache/${cacheKey}.mp3`;
    } catch (e) {
        // Generate new
    }
    
    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1-hd",
            voice: voice,
            input: cleanText.substring(0, 4096), // TTS has a limit
        });
        
        const buffer = Buffer.from(await mp3.arrayBuffer());
        await fs.writeFile(cachePath, buffer);
        console.log(`    🔊 TTS generated`);
        return `/storypath/audio/cache/${cacheKey}.mp3`;
    } catch (err) {
        console.error(`    ⚠️ TTS failed: ${err.message}`);
        return null;
    }
}

function parseSceneResponse(response) {
    // Extract JSON from response (Claude sometimes adds commentary)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON found in response');
    }
    
    try {
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        // Try to fix common JSON issues
        let fixed = jsonMatch[0]
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
    }
}

function buildSystemPrompt(genre, language, maturity) {
    const isJapanese = language === 'ja';
    
    const maturityGuidelines = maturity === 'adults'
        ? `# Maturity Level: ADULTS
- Real consequences: bad choices can lead to serious injury or death
- Dark themes, moral dilemmas, and genuine danger are appropriate
- Violence and peril should feel real and consequential`
        : `# Maturity Level: KIDS (Ages 6-8)
- Write like a simple picture book for 2nd graders
- Use VERY simple vocabulary and short sentences
- Keep paragraphs short (2-3 sentences max)
- Never kill the player character
- Scary moments should be silly or very mild
- Focus on wonder, friendship, and helping others`;

    return `# Role
You are a creative storyteller creating an interactive choose-your-own-adventure story in the ${genre} genre.

${maturityGuidelines}

# Your Task
Generate the next scene in JSON format:

{
  "narrative": "2-4 engaging paragraphs of story text",
  "image_prompt": "Detailed scene description for image generation (ALWAYS in English, environment only, NO people)",
  "choices": [
    {"text": "Choice 1", "type": "action", "emoji": "🏃"},
    {"text": "Choice 2", "type": "dialogue", "emoji": "💬"},
    {"text": "Choice 3", "type": "investigate", "emoji": "🔍"}
  ],
  "state_changes": {
    "hp_delta": 0,
    "items_gained": [],
    "items_lost": []
  },
  "important_events": ["Brief summary of major plot points"]
}

# Guidelines
1. Keep narrative concise and exciting (2-4 paragraphs)
2. Provide 2-4 meaningful choices
3. Each choice should include an appropriate emoji
4. Image prompts: Focus ONLY on environment/setting, NEVER include people
5. ${isJapanese ? 'Write narrative and choices in Japanese. Add furigana as 漢字《かんじ》 for difficult kanji.' : 'Write in English.'}
6. image_prompt must ALWAYS be in English regardless of story language`;
}

// ============ MAIN GENERATION FUNCTION ============

async function generateCompleteStory() {
    const storyId = uuidv4();
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(60));
    console.log('📖 COMPLETE STORY GENERATOR');
    console.log('='.repeat(60));
    console.log(`   Story ID: ${storyId}`);
    console.log(`   Genre: ${CONFIG.genre}`);
    console.log(`   Maturity: ${CONFIG.maturity}`);
    console.log(`   Language: ${CONFIG.language}`);
    console.log(`   Protagonist: ${CONFIG.protagonistName}`);
    console.log(`   Target Scenes: ${CONFIG.sceneCount} + ending`);
    if (CONFIG.storySeed) console.log(`   Seed: ${CONFIG.storySeed}`);
    console.log('='.repeat(60) + '\n');

    // Initialize database
    const storiesDir = path.join(__dirname, 'stories');
    await fs.mkdir(storiesDir, { recursive: true });
    const dbPath = path.join(storiesDir, `${storyId}.db`);
    const db = new StoryDatabase(dbPath);
    await db.init();

    try {
        // ============ PHASE 1: STORY ARC ============
        console.log('📝 Phase 1: Generating story arc...');
        
        const arcPrompt = `Create an internal story guide for a ${CONFIG.genre} story.
${CONFIG.maturity === 'kids' ? 'For young children (ages 6-8) - gentle, safe, and fun.' : 'For mature adults (18+) - can have dark moments, real stakes.'}

Protagonist: ${CONFIG.protagonistName}
${CONFIG.storySeed ? `Story concept: ${CONFIG.storySeed}` : ''}

Define:
1. **Core secrets**: The key truths or mysteries (not revealed to player)
2. **Intended ending**: How the story should resolve
3. **Key characters**: 2-3 important NPCs with names and roles
4. **Setting**: The world/location details
5. **Major plot beats**: 3-4 key moments that should happen

Keep it concise - this is internal guidance only. About 300-400 words.`;

        const storyArc = await callClaude(
            'You are a story architect. Create compelling story frameworks.',
            arcPrompt,
            1500
        );
        console.log('   ✅ Story arc generated\n');

        // ============ PHASE 2: TITLE ============
        console.log('📝 Phase 2: Generating title...');
        
        const titlePrompt = `Generate a compelling title for this ${CONFIG.genre} story.

Story arc summary:
${storyArc.substring(0, 800)}

Requirements:
- Sound like a real published novel
- Short and evocative (2-6 words)
- NO imperative verbs ("Find...", "Chase...")
- ${CONFIG.language === 'ja' ? 'Japanese title, no furigana needed' : 'English title'}

Return ONLY the title, nothing else.`;

        let title = await callClaude(
            'You create literary fiction titles.',
            titlePrompt,
            100
        );
        title = title.trim().replace(/^["']|["']$/g, '').replace(/\n/g, '');
        console.log(`   ✅ Title: "${title}"\n`);

        // Create story in database
        await db.createStory({
            id: storyId,
            title,
            genre: CONFIG.genre,
            language: CONFIG.language,
            difficulty: 'balanced',
            maturity_level: CONFIG.maturity,
            protagonist_name: CONFIG.protagonistName,
            protagonist_gender: 'neutral',
            protagonist_archetype: 'hero',
            story_seed: CONFIG.storySeed,
            password_hash: null,
            is_password_protected: false
        });

        // Store arc and mark as generating
        await db.run('ALTER TABLE stories ADD COLUMN story_arc TEXT').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN generation_status TEXT DEFAULT "generating"').catch(() => {});
        await db.run('UPDATE stories SET story_arc = ?, generation_status = ? WHERE id = ?', 
            [storyArc, 'generating', storyId]);

        // ============ PHASE 3: GENERATE SCENES ============
        console.log('🎬 Phase 3: Generating scenes...\n');
        
        const scenes = [];
        const systemPrompt = buildSystemPrompt(CONFIG.genre, CONFIG.language, CONFIG.maturity);
        const voice = CONFIG.language === 'ja' ? 'onyx' : 'fable';
        
        for (let i = 0; i < CONFIG.sceneCount + 1; i++) {
            const sceneNumber = i + 1;
            const isEnding = i === CONFIG.sceneCount;
            const isNearEnd = i >= CONFIG.sceneCount - 2;
            
            console.log(`   Scene ${sceneNumber}/${CONFIG.sceneCount + 1}${isEnding ? ' (FINALE)' : isNearEnd ? ' (approaching ending)' : ''}...`);

            // Build context from previous scenes
            const recentScenes = scenes.slice(-3).map(s => ({
                scene_number: s.sceneNumber,
                narrative: s.narrative.substring(0, 300) + '...',
                choice_made: s.selectedChoice
            }));
            
            const importantEvents = scenes
                .filter(s => s.importantEvents && s.importantEvents.length > 0)
                .flatMap(s => s.importantEvents)
                .slice(-10);

            // Build the scene prompt
            let scenePrompt;
            
            if (i === 0) {
                // Opening scene
                scenePrompt = `Start a new ${CONFIG.genre} story!

# Internal Story Guide (use this to inform your writing, but don't reveal secrets):
${storyArc}

# Protagonist
- Name: ${CONFIG.protagonistName}

${CONFIG.storySeed ? `Story concept: ${CONFIG.storySeed}` : ''}

Generate the OPENING scene. Introduce the protagonist, set the stage for adventure, and present the first meaningful choice. Make it exciting and engaging!

${CONFIG.language === 'ja' ? 'Write narrative and choices in Japanese. Add furigana as 漢字《かんじ》 for difficult kanji.' : ''}`;
            } else if (isEnding) {
                // Final scene
                scenePrompt = `# Internal Story Guide:
${storyArc}

# Story So Far:
${JSON.stringify(recentScenes, null, 2)}

# Important Events:
${importantEvents.join('\n')}

# Player's Last Choice:
"${scenes[scenes.length - 1].selectedChoice}"

This is the FINAL SCENE. The player has chosen to conclude the story.

Generate a LONG, satisfying conclusion (6-10 paragraphs) that:
1. Resolves the main conflict from the story arc
2. Gives closure to key characters
3. Reflects on the journey
4. Ends with a memorable final moment

Include in your JSON response:
- "story_complete": true
- "ending_type": "triumph" or "bittersweet" or "mystery" (choose what fits)
- "choices": [] (empty - story is over)

${CONFIG.language === 'ja' ? 'Write the conclusion in Japanese with furigana.' : ''}`;
            } else {
                // Middle scene
                scenePrompt = `# Internal Story Guide:
${storyArc}

# Current Scene Number: ${sceneNumber}

# Recent Scenes:
${JSON.stringify(recentScenes, null, 2)}

# Important Events So Far:
${importantEvents.length > 0 ? importantEvents.join('\n') : 'None yet'}

# Player's Last Choice:
"${scenes[scenes.length - 1]?.selectedChoice || 'Starting adventure'}"

Generate the next scene based on this choice.

${isNearEnd ? `
**APPROACHING ENDING**: This is scene ${sceneNumber} of ~${CONFIG.sceneCount + 1}. Start building toward the climax.
- Include ONE choice marked with 🏁 emoji and "ending_path": true that moves toward resolution
- Other choices can still explore, but tension should be rising
` : ''}

**CRITICAL**: Avoid repetition. Each scene should advance the plot or explore new aspects.

${CONFIG.language === 'ja' ? 'Write narrative and choices in Japanese with furigana.' : ''}`;
            }

            // Generate the scene
            const response = await callClaude(systemPrompt, scenePrompt, 3000);
            const sceneData = parseSceneResponse(response);
            
            // Select a choice (simulate player choosing)
            let selectedChoice = '';
            if (sceneData.choices && sceneData.choices.length > 0) {
                // Prefer ending_path choices when near the end, otherwise random
                let choiceIndex;
                if (isNearEnd) {
                    const endingPathIdx = sceneData.choices.findIndex(c => c.ending_path);
                    choiceIndex = endingPathIdx !== -1 ? endingPathIdx : 0;
                } else {
                    choiceIndex = Math.floor(Math.random() * sceneData.choices.length);
                }
                selectedChoice = sceneData.choices[choiceIndex].text;
            }

            // Store scene data
            const sceneRecord = {
                sceneNumber,
                narrative: sceneData.narrative,
                imagePrompt: sceneData.image_prompt,
                choices: sceneData.choices || [],
                selectedChoice,
                importantEvents: sceneData.important_events || [],
                stateChanges: sceneData.state_changes || {},
                storyComplete: sceneData.story_complete || false,
                endingType: sceneData.ending_type || null
            };
            scenes.push(sceneRecord);

            // Save to database
            const sceneId = await db.addScene({
                story_id: storyId,
                scene_number: sceneNumber,
                narrative_text: sceneData.narrative,
                image_prompt: sceneData.image_prompt,
                image_url: null
            });

            // Add choices to database
            if (sceneData.choices && sceneData.choices.length > 0) {
                await db.addChoices(sceneId, sceneData.choices);
                
                // Mark the selected choice
                if (!isEnding) {
                    const choiceIdx = sceneData.choices.findIndex(c => c.text === selectedChoice);
                    if (choiceIdx !== -1) {
                        await db.markChoiceSelected(sceneId, choiceIdx);
                    }
                }
            }

            // Update current scene
            await db.updateCurrentScene(storyId, sceneNumber);

            // Add important events
            if (sceneData.important_events) {
                for (const event of sceneData.important_events) {
                    await db.addEvent({
                        story_id: storyId,
                        event_type: 'plot_point',
                        summary: event,
                        entities: [],
                        importance: 7,
                        scene_id: sceneId
                    });
                }
            }

            console.log(`      ✅ Narrative: ${sceneData.narrative.substring(0, 50)}...`);
            if (selectedChoice) {
                console.log(`      🎯 Choice: "${selectedChoice.substring(0, 40)}..."`);
            }

            // Generate image (unless skipped)
            if (!CONFIG.skipImages && sceneData.image_prompt) {
                console.log(`      🎨 Generating image...`);
                try {
                    const imageUrl = await imageGenerator.generateSceneImage(
                        sceneData.image_prompt,
                        storyId,
                        sceneNumber
                    );
                    await db.run('UPDATE scenes SET image_url = ? WHERE id = ?', [imageUrl, sceneId]);
                    sceneRecord.imageUrl = imageUrl;
                    console.log(`      ✅ Image saved`);
                } catch (err) {
                    console.log(`      ⚠️ Image failed: ${err.message}`);
                }
            }

            // Generate TTS audio (unless skipped)
            if (!CONFIG.skipAudio) {
                await generateTTS(sceneData.narrative, voice, storyId, sceneNumber);
            }

            console.log('');

            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 1000));
        }

        // ============ PHASE 4: BOOK COVER ============
        if (!CONFIG.skipCover) {
            console.log('📚 Phase 4: Generating book cover...');
            try {
                const coverUrl = await imageGenerator.generateBookCover(
                    title,
                    CONFIG.genre,
                    CONFIG.maturity,
                    storyId,
                    scenes[0]?.narrative || ''
                );
                await db.run('UPDATE stories SET book_cover_url = ? WHERE id = ?', [coverUrl, storyId]);
                console.log(`   ✅ Book cover saved: ${coverUrl}\n`);
            } catch (err) {
                console.log(`   ⚠️ Book cover failed: ${err.message}\n`);
            }
        }

        // ============ PHASE 5: FINALIZE ============
        console.log('✨ Phase 5: Finalizing story...');
        
        // Mark story as complete
        const lastScene = scenes[scenes.length - 1];
        await db.run(`
            UPDATE stories 
            SET is_complete = 1, 
                ending_reached = ?,
                generation_status = 'complete',
                current_scene_number = ?
            WHERE id = ?
        `, [lastScene.endingType || 'unknown', scenes.length, storyId]);

        db.close();

        // ============ SUMMARY ============
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 STORY GENERATION COMPLETE!');
        console.log('='.repeat(60));
        console.log(`   Title: "${title}"`);
        console.log(`   Story ID: ${storyId}`);
        console.log(`   Scenes: ${scenes.length}`);
        console.log(`   Ending: ${lastScene.endingType || 'unknown'}`);
        console.log(`   Duration: ${duration} minutes`);
        console.log('');
        console.log(`   📖 View story: /storypath/game.html?story=${storyId}`);
        console.log(`   📚 Read book: /storypath/book.html?story=${storyId}`);
        console.log('='.repeat(60) + '\n');

        return storyId;

    } catch (error) {
        console.error('\n❌ Generation failed:', error);
        await db.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['error', storyId]);
        db.close();
        throw error;
    }
}

// ============ RUN ============
generateCompleteStory()
    .then(storyId => {
        console.log(`Done! Story ID: ${storyId}`);
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });

