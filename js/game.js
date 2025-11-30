const API_URL = `${window.location.protocol}//${window.location.hostname}/storypath-api`;
const urlParams = new URLSearchParams(window.location.search);
const storyId = urlParams.get('story');

let currentStory = null;
let currentScene = null;
let currentChoices = null;
let imageCheckInterval = null;

// Initialize Audio Manager
const audio = window.audioManager;

// Parse Claude's furigana format: 漢字《かんじ》 -> <ruby>漢字<rt>かんじ</rt></ruby>
function parseFurigana(text) {
    if (!text) return text;

    // If text already contains HTML ruby tags, Claude generated them directly
    if (text.includes('<ruby>') || text.includes('<rt>')) {
        let result = text;

        // When both ruby tag AND bracket exist for same kanji, use bracket reading (it's usually correct)
        // Pattern: <ruby>漢字<rt>wrong</rt></ruby>《correct》 -> <ruby>漢字<rt>correct</rt></ruby>
        result = result.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');

        // Strip any remaining bracket notation
        result = result.replace(/《[^》]+》/g, '');

        // Fix nested ruby tags: <ruby><ruby>X<rt>WRONG</rt></ruby><rt>CORRECT</rt></ruby> -> <ruby>X<rt>CORRECT</rt></ruby>
        result = result.replace(/<ruby><ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby><rt>([^<]+)<\/rt><\/ruby>/g, '<ruby>$1<rt>$2</rt></ruby>');

        return result;
    }

    // Convert 漢字《かんじ》 format to HTML ruby tags (legacy format)
    return text.replace(/([一-龯々]+)《([ぁ-ん]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
}

function normalizeJapaneseTypography(text) {
    if (!text) return text;

    const jpChar = '[ぁ-ゖァ-ヺ一-龯々〆ヵヶ]';
    let normalized = text;

    // Collapse multiple spaces into single space
    normalized = normalized.replace(/\s+/g, ' ');

    // Remove spaces between Japanese characters
    normalized = normalized.replace(new RegExp(`(${jpChar})\\s+(${jpChar})`, 'g'), '$1$2');

    // Fix gaps around dashes/hyphens: remove spaces around them
    normalized = normalized.replace(/\s*[-‐‑‒–—―]\s*/g, '—'); // Use em dash, no spaces
    
    // Fix 一 (kanji one) used as dash in vertical text - remove spaces around it
    normalized = normalized.replace(/([一-龯ぁ-ゖ])\s+一\s+([一-龯ぁ-ゖ])/g, '$1—$2');
    normalized = normalized.replace(/([一-龯ぁ-ゖ])\s+一([一-龯ぁ-ゖ])/g, '$1—$2');
    normalized = normalized.replace(/([一-龯ぁ-ゖ])一\s+([一-龯ぁ-ゖ])/g, '$1—$2');

    // Fix gaps after commas/punctuation
    normalized = normalized.replace(/([、。，．])\s+/g, '$1');

    // Fix gaps before numbers
    normalized = normalized.replace(new RegExp(`(${jpChar})\\s*([0-9])`, 'g'), '$1\u200b$2');

    // Remove accidental slashes between kana/kanji
    normalized = normalized.replace(new RegExp(`(${jpChar})\\/(${jpChar})`, 'g'), '$1$2');

    // Prevent bad line breaks in verbs
    normalized = normalized.replace(/([一-龯]+[すする])/g, '$1\u2060');
    normalized = normalized.replace(/([一-龯]+来る)/g, '$1\u2060');

    return normalized;
}

function transformNarrativeText(text) {
    if (!text) return '';
    let transformed = text;

    if (currentStory?.language === 'ja') {
        transformed = normalizeJapaneseTypography(transformed);
        transformed = parseFurigana(transformed);
    }

    return transformed;
}

function cleanTextForSpeech(text) {
    if (!text) return '';
    let textToSpeak = text;
    
    // Remove ruby tags AND their content (furigana) to avoid double reading
    // <ruby>漢字<rt>かんじ</rt></ruby> -> 漢字
    textToSpeak = textToSpeak.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '');
    textToSpeak = textToSpeak.replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, '');
    
    // Also remove bracket notation furigana: 漢字《かんじ》 -> 漢字
    textToSpeak = textToSpeak.replace(/《[^》]*》/g, '');
    
    // Finally strip any remaining tags
    textToSpeak = textToSpeak.replace(/<[^>]*>/g, '');
    
    return textToSpeak;
}

// Load story on page load
async function loadStory() {
    if (!storyId) {
        Toast.error('No story ID provided', 'Error');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/story/${storyId}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        currentStory = data.story;
        currentScene = data.current_scene;
        currentChoices = data.choices;

        // Initialize Audio Language
        if (audio) {
            audio.setLanguage(currentStory.language || 'en');
        }

        // Apply genre/maturity theme
        if (currentStory && currentStory.genre && currentStory.maturity_level) {
            const themeClass = `theme-${currentStory.genre}-${currentStory.maturity_level}`;
            document.body.classList.add(themeClass);
            console.log('🎨 Applied theme:', themeClass);
            
            // Play ambient sound if audio enabled
            if (audio && audio.enabled) audio.playAmbient(currentStory.genre);
        }

        // Set language based on story
        if (currentStory && currentStory.language) {
            setLanguage(currentStory.language);

            // Apply vertical text for Japanese
            if (currentStory.language === 'ja') {
                document.getElementById('storyView').classList.add('ja-vertical');
                document.body.classList.add('ja-vertical-mode');
            }
        }

        // Validate data
        if (!currentScene) {
            throw new Error('No scene data received');
        }

        // Update UI - pass true for shouldSpeak because this is initial load (not streaming)
        updateStoryView(true);

    } catch (error) {
        console.error('Failed to load story:', error);
        Toast.error('Failed to load story: ' + error.message, 'Error');
        setTimeout(() => window.location.href = '/', 3000);
    }
}

function updateStoryView(shouldSpeak = false) {
    // Store scroll position to restore after update
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Update title (with furigana support)
    document.getElementById('storyTitleText').innerHTML = parseFurigana(currentStory.title);

    // Update narrative
    const narrativeHtml = formatNarrative(currentScene.narrative_text);
    document.getElementById('narrativeText').innerHTML = narrativeHtml;
    
    // Speak narrative if enabled and requested
    if (shouldSpeak && audio && audio.enabled) {
        const textToSpeak = cleanTextForSpeech(currentScene.narrative_text);
        // Clear queue for new scene
        audio.speak(textToSpeak, true);
    }

    // Update image only if URL changed (prevents collapse/flicker on same scene)
    const imageUrl = currentScene.image_url || '/storypath/images/placeholder-scene.png';
    const sceneImage = document.getElementById('sceneImage');
    if (sceneImage.src !== imageUrl) {
        sceneImage.src = imageUrl;
    }

    // Show loading overlay if using placeholder
    if (imageUrl && imageUrl.includes('placeholder')) {
        document.getElementById('imageLoadingOverlay').style.display = 'flex';
        // Start polling for real image
        startImagePolling();
    } else {
        document.getElementById('imageLoadingOverlay').style.display = 'none';
    }

    // Update choices
    updateChoices(currentChoices);

    // Wrap narrative and choices for vertical layout
    if (currentStory.language === 'ja') {
        const narrativePanel = document.querySelector('.narrative-panel');
        const choicesPanel = document.querySelector('.choices-panel');

        // Only wrap if not already wrapped
        if (!narrativePanel.parentElement.classList.contains('vertical-content-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'vertical-content-wrapper';
            narrativePanel.parentNode.insertBefore(wrapper, narrativePanel);
            wrapper.appendChild(choicesPanel);
            wrapper.appendChild(narrativePanel);
        }
    }

    // Update stats
    updateStats();

    // Hide loading, show content
    document.getElementById('initialLoading').classList.add('hidden');
    document.getElementById('sceneContent').classList.remove('hidden');
    document.getElementById('statsBar').style.display = 'flex';

    // Restore scroll position (prevents jumping to top on updates)
    setTimeout(() => {
        window.scrollTo(scrollX, scrollY);
    }, 0);
}

function formatNarrative(text) {
    if (!text) return '';
    // Split into paragraphs and wrap in <p> tags
    return text.split(/\n\s*\n/)
        .map(p => {
            const content = transformNarrativeText(p.trim());
            return content ? `<p>${content}</p>` : '';
        })
        .join('');
}

function updateChoices(choices) {
    const panel = document.getElementById('choicesPanel');
    panel.innerHTML = '';

    if (!choices || !Array.isArray(choices)) {
        console.error('Invalid choices:', choices);
        return;
    }

    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.setAttribute('data-choice-index', index);
        button.onclick = () => makeChoice(index);
        button.onmouseenter = () => {
            if (audio) audio.playSfx('hover');
        };

        // Support both database format (choice_text/choice_type) and AI format (text/type)
        const choiceText = choice.choice_text || choice.text || '';
        const choiceType = choice.choice_type || choice.type;
        const emoji = choice.emoji || getDefaultEmoji(choiceType);
        const displayText = transformNarrativeText(choiceText);

        // Check if this is an ending path choice (SQLite returns 1/0, JSON returns true/false)
        const isEndingPath = choice.ending_path === true || choice.ending_path === 1 || choice.is_final_choice === true;
        if (isEndingPath) {
            button.classList.add('ending-path');
        }

        // Use 🏁 emoji for ending path choices
        const displayEmoji = isEndingPath ? '🏁' : emoji;

        button.innerHTML = `
            <span class="choice-emoji">${displayEmoji}</span>
            <span>${displayText}</span>
            ${isEndingPath ? '<span class="ending-indicator" title="This choice advances the main story toward its conclusion">→</span>' : ''}
        `;

        panel.appendChild(button);
    });
}

function getDefaultEmoji(type) {
    const emojis = {
        action: '⚔️',
        dialogue: '💬',
        investigate: '🔍'
    };
    return emojis[type] || '✨';
}

async function makeChoice(choiceIndex) {
    if (audio) audio.playSfx('click');

    // Store scroll position before any changes
    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;

    // Disable all choices
    document.querySelectorAll('.choice-button').forEach(btn => {
        btn.classList.add('disabled');
    });

    // Hide choices, clear narrative, add skeleton placeholders
    document.getElementById('choicesPanel').style.display = 'none';
    const narrativeText = document.getElementById('narrativeText');
    narrativeText.innerHTML = '';

    // Add 3 skeleton paragraph placeholders
    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-paragraph';
        skeleton.dataset.index = i;
        narrativeText.appendChild(skeleton);
    }

    document.querySelector('.narrative-panel').style.display = 'block';
    
    // Clear audio queue for new response
    if (audio && audio.enabled) {
        audio.stop();
    }

    try {
        const eventSource = new EventSource(`${API_URL}/story/${storyId}/choice?choice_index=${choiceIndex}`);

        let fullNarrative = '';
        let sceneMetadata = null;
        let paragraphIndex = 0;
        let currentParagraphP = null;

        eventSource.addEventListener('message', (e) => {
            console.log('Received SSE:', e.data);
            const event = JSON.parse(e.data);

            if (event.type === 'text_fragment' || event.type === 'paragraph') {
                // Handle both new fragment type and legacy paragraph type
                const text = event.text || '';
                const isNewParagraph = event.is_new_paragraph || event.type === 'paragraph';
                
                // Audio: Speak immediately
                if (audio && audio.enabled) {
                    const textToSpeak = cleanTextForSpeech(text);
                    audio.speak(textToSpeak, false);
                }
                
                // Visual:
                if (!currentParagraphP || isNewParagraph) {
                     // Find skeleton for this paragraph index
                     let skeleton = narrativeText.querySelector(`.skeleton-paragraph[data-index="${paragraphIndex}"]`);

                     // If no skeleton exists for this index, try to create one or just append
                     if (!skeleton) {
                         skeleton = document.createElement('div');
                         skeleton.className = 'skeleton-paragraph';
                         skeleton.dataset.index = paragraphIndex;
                         narrativeText.appendChild(skeleton);
                     }
                     
                     // Create new P
                     const p = document.createElement('p');
                     p.style.opacity = '0';
                     const isJapanese = currentStory.language === 'ja';
                     p.style.animation = isJapanese
                        ? 'inkBrushReveal 0.6s ease-out forwards'
                        : 'typewriterReveal 0.3s ease-out forwards';
                     
                     skeleton.replaceWith(p);
                     currentParagraphP = p;
                     
                     // Increment index for next time we need a NEW paragraph
                     paragraphIndex++;
                     
                     // Add next skeleton ahead of time
                     if (!narrativeText.querySelector(`.skeleton-paragraph[data-index="${paragraphIndex}"]`)) {
                         const nextSkeleton = document.createElement('div');
                         nextSkeleton.className = 'skeleton-paragraph';
                         nextSkeleton.dataset.index = paragraphIndex;
                         narrativeText.appendChild(nextSkeleton);
                     }
                }
                
                // Append text to current paragraph
                // We use a span to animate the new chunk if we wanted, but simple append is fine
                // transformNarrativeText handles furigana etc.
                // Note: transformNarrativeText expects full text usually for normalization, but chunks should be okay
                const htmlContent = transformNarrativeText(text.trim());
                if (htmlContent) {
                    const span = document.createElement('span');
                    span.innerHTML = htmlContent + ' '; // Add space for safety
                    currentParagraphP.appendChild(span);
                }
                
                fullNarrative += text + (isNewParagraph ? '\n\n' : ' ');

            } else if (event.type === 'metadata') {
                sceneMetadata = event.data;

                // Remove any remaining skeletons
                narrativeText.querySelectorAll('.skeleton-paragraph').forEach(s => s.remove());

                // Close connection
                eventSource.close();

                // Update current scene
                currentScene = {
                    scene_number: sceneMetadata.scene_number,
                    narrative_text: fullNarrative.trim(),
                    image_url: sceneMetadata.image_url
                };

                // Store choices
                currentChoices = sceneMetadata.choices;

                // Update story state
                if (sceneMetadata.state_changes) {
                    if (sceneMetadata.state_changes.hp_delta) {
                        currentStory.hp += sceneMetadata.state_changes.hp_delta;
                    }
                }

                currentStory.current_scene_number = sceneMetadata.scene_number;

                // Remove min-height
                narrativeText.style.minHeight = '';

                // Check if story is complete
                if (sceneMetadata.story_complete) {
                    // Story ended! Show ending screen instead of choices
                    document.getElementById('choicesPanel').style.display = 'none';
                    updateStoryView(false);
                    setTimeout(() => {
                        showEndingScreen(sceneMetadata.ending_type);
                    }, 2000); // Brief delay to let final narrative sink in
                    return;
                }

                // Show choices and update full view
                document.getElementById('choicesPanel').style.display = 'flex';
                // Pass false to skip speaking because we already streamed it
                updateStoryView(false);

                // Restore scroll position after scene loads
                setTimeout(() => {
                    window.scrollTo(savedScrollX, savedScrollY);
                }, 50);
            }
        });

        eventSource.addEventListener('error', (e) => {
            console.error('SSE error:', e);
            eventSource.close();
            Toast.error('Failed to process choice. Please try again.', 'Connection Error');

            // Re-enable choices
            document.querySelectorAll('.choice-button').forEach(btn => {
                btn.classList.remove('disabled');
            });
        });

    } catch (error) {
        console.error('Failed to process choice:', error);
        Toast.error('Failed to process choice: ' + error.message, 'Error');

        // Re-enable choices
        document.querySelectorAll('.choice-button').forEach(btn => {
            btn.classList.remove('disabled');
        });

        document.getElementById('choicesPanel').style.display = 'flex';
    }
}

function updateStats() {
    document.getElementById('statHP').textContent = `${currentStory.hp}/${currentStory.max_hp}`;
    document.getElementById('statScene').textContent = currentStory.current_scene_number;

    // Parse stats
    const stats = currentStory.stats ? JSON.parse(currentStory.stats) : {};
    const inventory = currentStory.inventory ? JSON.parse(currentStory.inventory) : [];

    document.getElementById('statItems').textContent = `${inventory.length} ${inventory.length === 1 ? 'item' : 'items'}`;

    // Karma
    const karma = stats.karma || 0;
    let karmaText = 'Neutral';
    if (karma > 30) karmaText = 'Good';
    else if (karma > 60) karmaText = 'Heroic';
    else if (karma < -30) karmaText = 'Dark';
    else if (karma < -60) karmaText = 'Villainous';

    document.getElementById('statKarma').textContent = karmaText;
}

function startImagePolling() {
    if (imageCheckInterval) {
        clearTimeout(imageCheckInterval);
    }

    let delay = 2000;
    const maxDelay = 10000;

    const checkImage = async () => {
        try {
            const response = await fetch(`${API_URL}/story/${storyId}/image/${currentStory.current_scene_number}`);
            const data = await response.json();

            if (data.ready && data.url) {
                document.getElementById('sceneImage').src = data.url;
                // Success! No next call.
            } else {
                // Not ready, try again with backoff
                delay = Math.min(delay + 1000, maxDelay);
                imageCheckInterval = setTimeout(checkImage, delay);
            }
        } catch (error) {
            console.error('Image check failed:', error);
            // Retry on error too
            delay = Math.min(delay + 1000, maxDelay);
            imageCheckInterval = setTimeout(checkImage, delay);
        }
    };

    // Initial call
    imageCheckInterval = setTimeout(checkImage, delay);
}

function imageLoaded() {
    const img = document.getElementById('sceneImage');
    if (!img.src.includes('placeholder')) {
        document.getElementById('imageLoadingOverlay').style.display = 'none';
        if (imageCheckInterval) {
            clearTimeout(imageCheckInterval);
        }
    }
}

function showMenu() {
    Toast.info('Menu feature coming soon!', 'Coming Soon');
}

function showHistory() {
    window.open(`history.html?story=${storyId}`, '_blank');
}

function goHome() {
    if (confirm('Are you sure you want to leave this story?')) {
        window.location.href = 'index.html';
    }
}

function showEndingScreen(endingType) {
    // Create confetti canvas
    const confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confetti-canvas';
    document.body.appendChild(confettiCanvas);
    
    // Start confetti animation
    launchConfetti(confettiCanvas);
    
    // Determine ending emoji based on type
    const endingEmojis = {
        'happy': '🎉',
        'tragic': '💔',
        'mysterious': '🌙',
        'heroic': '⚔️',
        'bittersweet': '🌸',
        'triumphant': '👑',
        'peaceful': '🕊️',
        'dark': '🖤',
        'romantic': '💕',
        'adventure': '🗺️'
    };
    const emoji = endingEmojis[endingType?.toLowerCase()] || '✨';
    
    // Create ending overlay
    const overlay = document.createElement('div');
    overlay.className = 'ending-overlay';
    overlay.innerHTML = `
        <div class="ending-content">
            <div class="ending-emoji">${emoji}</div>
            <h1 class="ending-title">The End</h1>
            <p class="ending-subtitle">${currentStory.title}</p>
            ${endingType ? `<div class="ending-type">${endingType} Ending</div>` : ''}
            <div class="ending-actions">
                <button class="ending-btn btn-book" onclick="window.location.href='compile-book.html?story=${storyId}'">
                    📖 Create Storybook
                </button>
                <button class="ending-btn btn-home" onclick="window.location.href='index.html'">
                    🏠 Return Home
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Stop ambient audio, play triumphant sound
    if (audio) {
        audio.stopAmbient();
    }
}

function launchConfetti(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confetti = [];
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff8c00', '#9b59b6'];
    
    // Create confetti particles
    for (let i = 0; i < 150; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confetti.forEach((p, i) => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;
            
            // Reset if off screen
            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2);
            ctx.restore();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Stop confetti after 10 seconds
    setTimeout(() => {
        canvas.remove();
    }, 10000);
}

function toggleAudio() {
    if (audio) {
        const isEnabled = audio.toggle();
        const btn = document.getElementById('audioToggle');
        btn.textContent = isEnabled ? '🔊' : '🔇';
        btn.classList.toggle('active', isEnabled);
        
        if (isEnabled && currentStory) {
             audio.playAmbient(currentStory.genre);
        }
    }
}

// Check for curtain reveal on load
function checkCurtainReveal() {
    console.log('🎭 Checking for curtain data...');
    const curtainData = sessionStorage.getItem('showCurtain');
    console.log('🎭 Curtain data found:', curtainData);
    if (curtainData) {
        sessionStorage.removeItem('showCurtain');
        const { genre, maturity } = JSON.parse(curtainData);
        console.log('🎭 Showing curtain for:', genre, maturity);
        showGameCurtain(genre, maturity);
    } else {
        console.log('🎭 No curtain data, removing black screen immediately');
        const blackScreen = document.getElementById('theatricalBlack');
        if (blackScreen) blackScreen.remove();
    }
}

function showGameCurtain(genre, maturity) {
    // Get genre-appropriate curtain colors
    const curtainColors = {
        fantasy: { kids: ['#ff69b4', '#9c27b0', '#e1bee7'], adult: ['#8b0000', '#ff4500', '#ffd700'] },
        scifi: { kids: ['#00ffff', '#00aaff', '#0088cc'], adult: ['#00ff00', '#00aa00', '#006600'] },
        mystery: { kids: ['#ff9800', '#ffc107', '#ffeb3b'], adult: ['#6c757d', '#495057', '#343a40'] },
        horror: { kids: ['#4a148c', '#6a1b9a', '#8e24aa'], adult: ['#8b0000', '#ff0000', '#4d0000'] },
        adventure: { kids: ['#ffc107', '#ff9800', '#f57c00'], adult: ['#795548', '#6d4c41', '#5d4037'] }
    };

    const colors = curtainColors[genre]?.[maturity] || ['#667eea', '#764ba2', '#f093fb'];

    // Stage lights gradient
    const stageLightsHTML = `
        <div id="stageLights" class="stage-lights"></div>
    `;

    // Create curtain overlay
    const curtainHTML = `
        <div class="curtain-container" data-genre="${genre}" data-maturity="${maturity}">
        <div class="curtain-inner">
            ${[...Array(10)].map(() => '<div class="curtain-strip"></div>').join('')}
        </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', stageLightsHTML);
    document.body.insertAdjacentHTML('beforeend', curtainHTML);

    const stageLights = document.getElementById('stageLights');
    const curtainContainer = document.querySelector('.curtain-container:last-of-type');
    const strips = curtainContainer.querySelectorAll('.curtain-strip');
    const blackScreen = document.getElementById('theatricalBlack');

    // Apply genre colors to strips via inline style (dynamic colors)
    strips.forEach((strip, i) => {
        const colorIndex = i % colors.length;
        strip.style.background = `repeating-linear-gradient(to left,
            ${colors[colorIndex]} 4vw,
            ${colors[(colorIndex + 1) % colors.length]} 8vw,
            ${colors[(colorIndex + 2) % colors.length]} 10vw)`;
    });

    // Theatrical sequence
    setTimeout(() => {
        // 1. Fade in stage lights
        stageLights.classList.add('active');

        // 2. Quickly fade in curtain
        setTimeout(() => {
            curtainContainer.classList.add('visible');

            // Remove black screen once curtain is visible
            setTimeout(() => {
                if (blackScreen) blackScreen.remove();
            }, 500);
        }, 400);

        // 3. Open curtain
        setTimeout(() => {
            curtainContainer.classList.add('opening');

            // 4. Fade out stage lights as curtain opens
            stageLights.classList.remove('active');

            // Remove curtain and lights after animation completes
            setTimeout(() => {
                curtainContainer.remove();
                stageLights.remove();

                // Auto-enable audio and speak scene 1 narrative after curtain opens
                if (audio && !audio.enabled) {
                    console.log('🔊 Auto-enabling TTS for scene 1');
                    audio.toggle(); // Enable audio
                }

                // Speak the current scene narrative
                if (audio && audio.enabled && currentScene && currentScene.narrative_text) {
                    console.log('🎙️ Auto-playing scene 1 TTS');
                    const textToSpeak = cleanTextForSpeech(currentScene.narrative_text);
                    audio.speak(textToSpeak, true);
                }
            }, 2500);
        }, 1200);
    }, 100);
}

// Load story on page load
window.addEventListener('load', () => {
    // Restore audio button state from localStorage
    if (audio && audio.enabled) {
        const btn = document.getElementById('audioToggle');
        if (btn) {
            btn.textContent = '🔊';
            btn.classList.add('active');
        }
    }
    // Check and create curtain FIRST (synchronously) before loading story
    checkCurtainReveal();
    // Then load story content
    loadStory();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (imageCheckInterval) {
        clearTimeout(imageCheckInterval);
    }
});
