// Generate 6 rotating placeholder covers for the "Create New Story" book
const Replicate = require('replicate');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

const OUTPUT_DIR = '/var/www/html/storypath/images/new-story-covers';

// 6 diverse book cover styles
const coverPrompts = [
    {
        name: 'fantasy',
        prompt: 'Professional book cover design with elegant title text, epic fantasy theme, magical glowing portal, ancient wizard tower, mystical purple and gold colors, dramatic lighting, detailed fantasy illustration, high quality digital art'
    },
    {
        name: 'scifi',
        prompt: 'Professional book cover design with bold title text, sci-fi theme, futuristic spaceship in deep space, distant planets and stars, cyberpunk neon blue and orange colors, cinematic lighting, detailed digital art'
    },
    {
        name: 'mystery',
        prompt: 'Professional book cover design with mysterious title text, noir detective theme, shadowy figure in foggy street, vintage street lamp, dark moody atmosphere, film noir style, detailed illustration'
    },
    {
        name: 'adventure',
        prompt: 'Professional book cover design with adventurous title text, treasure map and compass, ancient ruins in jungle, warm sunset colors, explorer theme, detailed illustration, cinematic'
    },
    {
        name: 'horror',
        prompt: 'Professional book cover design with ominous title text, gothic horror theme, haunted mansion silhouette, full moon and mist, dark purple and black colors, eerie atmosphere, detailed digital art'
    },
    {
        name: 'romance',
        prompt: 'Professional book cover design with elegant script title, romantic theme, dreamy sunset over ocean, soft warm colors, watercolor style, elegant and sophisticated, detailed illustration'
    }
];

async function downloadImage(url, filepath) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filepath, buffer);
}

async function generateCover(coverDef, index) {
    console.log(`\n[${index + 1}/6] Generating ${coverDef.name} cover...`);
    const startTime = Date.now();

    try {
        const output = await replicate.run(
            "black-forest-labs/flux-1.1-pro",
            {
                input: {
                    prompt: coverDef.prompt,
                    aspect_ratio: "2:3",
                    output_format: "png",
                    safety_tolerance: 2
                }
            }
        );

        console.log(`   Output type: ${typeof output}, value:`, output);

        let imageUrl;
        if (typeof output === 'string') {
            imageUrl = output;
        } else if (Array.isArray(output) && output.length > 0) {
            imageUrl = output[0];
        } else if (output && output.url) {
            imageUrl = output.url;
        } else {
            throw new Error(`Unexpected output format: ${JSON.stringify(output)}`);
        }

        const filename = `cover-${index + 1}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        await downloadImage(imageUrl, filepath);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ [${index + 1}/6] ${coverDef.name} cover saved in ${elapsed}s`);

        return filename;
    } catch (error) {
        console.error(`❌ [${index + 1}/6] Failed to generate ${coverDef.name}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('📚 Generating 6 rotating book covers for "Create New Story"...\n');

    // Generate all covers sequentially
    const results = [];
    for (let i = 0; i < coverPrompts.length; i++) {
        const filename = await generateCover(coverPrompts[i], i);
        results.push(filename);
    }

    const successful = results.filter(r => r !== null).length;
    console.log(`\n✅ Complete! Generated ${successful}/6 covers`);
    console.log(`📁 Covers saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
