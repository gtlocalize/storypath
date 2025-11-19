const Replicate = require('replicate');
const fs = require('fs').promises;
require('dotenv').config();

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const OUTPUT_DIR = '/var/www/html/storypath/images/new-story-covers';

const coverPrompts = [
    "Epic fantasy wizard tower with glowing magical portal, mystical purple and gold atmosphere, dramatic volumetric lighting, purely visual art with no text",
    "Massive sleek futuristic starship cruising through colorful nebula in deep space, glowing engine trails, distant planets, dramatic blue and orange cosmic lighting, purely visual art with no text",
    "Noir detective silhouette in fedora standing in foggy cobblestone street, vintage street lamps glowing, film noir atmosphere, dark moody tones, purely visual art with no text",
    "Ancient Mayan temple ruins overgrown with jungle vines, golden treasure chest open with glowing coins, dramatic orange sunset sky through palm trees, purely visual art with no text",
    "Spooky Victorian mansion on hill silhouetted against giant full moon, swirling purple fog and mist, bare twisted dead tree branches, eerie gothic atmosphere, purely visual art with no text",
    "Dreamy pastel sunset over calm ocean waves, soft warm peach and lavender sky, watercolor aesthetic, peaceful and elegant, purely visual art with no text"
];

async function generateCover(prompt, index) {
    console.log(`\n[${index + 1}/6] Generating with FLUX Pro...`);
    const startTime = Date.now();

    try {
        const output = await replicate.run(
            "black-forest-labs/flux-pro",
            {
                input: {
                    prompt: prompt,
                    aspect_ratio: "2:3",
                    output_format: "png",
                    safety_tolerance: 2,
                    steps: 25
                }
            }
        );

        const imageUrl = output;
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = `cover-${index + 1}.png`;
        const filepath = `${OUTPUT_DIR}/${filename}`;
        await fs.writeFile(filepath, buffer);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ [${index + 1}/6] Saved in ${elapsed}s`);

        return filename;
    } catch (error) {
        console.error(`❌ [${index + 1}/6] Failed:`, error.message);
        return null;
    }
}

async function main() {
    console.log('📚 Generating 6 high-quality covers with FLUX Pro...\n');

    for (let i = 0; i < coverPrompts.length; i++) {
        await generateCover(coverPrompts[i], i);
    }

    console.log('\n✅ Complete!');
}

main().catch(console.error);
