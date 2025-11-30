// Book Reader Logic - Elegant Storybook Edition
const API_URL = `${window.location.protocol}//${window.location.hostname}/storypath-api`;
const urlParams = new URLSearchParams(window.location.search);
const storyId = urlParams.get('story');

let pageFlip;
let storyData = null;
let scenes = [];
let audio = window.audioManager;

// Inspirational quotes for back cover based on ending type
const endingQuotes = {
    triumph: [
        "And so the brave heart found its way home, carrying light for all who would follow.",
        "In the end, courage was not the absence of fear, but the triumph over it.",
        "Some stories end not with a period, but with a door opening to new adventures."
    ],
    bittersweet: [
        "Not all endings are happy, but all endings teach us something precious.",
        "The sweetest victories are those earned through tears.",
        "And though the path was hard, the journey made all the difference."
    ],
    mystery: [
        "Some questions are better left unanswered, for in mystery lies magic.",
        "The end is but another beginning in disguise.",
        "What remains unknown keeps the wonder alive."
    ],
    default: [
        "Every ending is a new beginning waiting to unfold.",
        "And they carried this story in their heart, forever.",
        "Thus concludes one tale, as countless others await."
    ]
};

// Image position patterns for visual variety
const imagePositions = ['top', 'top', 'bottom', 'top', 'bottom', 'top'];

async function loadBook() {
    if (!storyId) {
        Toast.error('No story ID provided', 'Error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/story/${storyId}/complete`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        storyData = data.story;
        scenes = data.pages;

        // Initialize audio language
        if (audio) {
            audio.setLanguage(storyData.language);
        }

        // Set page title
        document.title = `${storyData.title} - StoryPath`;

        renderBook();
        document.getElementById('loadingOverlay').style.display = 'none';

    } catch (error) {
        console.error('Failed to load book:', error);
        Toast.error('Failed to load book: ' + error.message, 'Error');
    }
}

function getRandomQuote(endingType) {
    const quotes = endingQuotes[endingType] || endingQuotes.default;
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function formatEndingType(ending) {
    if (!ending) return 'A Tale Complete';
    const formatted = {
        'triumph': 'A Triumphant Tale',
        'bittersweet': 'A Bittersweet Journey',
        'mystery': 'A Mysterious Conclusion',
        'tragedy': 'A Poignant Story',
        'comedy': 'A Joyful Adventure'
    };
    return formatted[ending.toLowerCase()] || 'A Tale Complete';
}

function renderBook() {
    const bookEl = document.getElementById('book');
    bookEl.innerHTML = '';

    let pageNumber = 0;

    // ===== 1. FRONT COVER - Full bleed image =====
    const coverUrl = storyData.book_cover_url || 'images/placeholder-cover.png';
    const frontCover = document.createElement('div');
    frontCover.className = 'page cover front';
    frontCover.dataset.density = 'hard';
    frontCover.innerHTML = `<img class="cover-image-full" src="${coverUrl}" alt="${storyData.title}">`;
    bookEl.appendChild(frontCover);

    // ===== 2. INNER TITLE PAGE =====
    const titlePage = document.createElement('div');
    titlePage.className = 'page';
    titlePage.innerHTML = `
        <div class="title-page-content">
            <h1>${storyData.title}</h1>
            <div class="title-page-divider"></div>
            <p class="title-page-branding">A StoryPath Original</p>
            <div class="title-page-ornament">❧</div>
        </div>
    `;
    bookEl.appendChild(titlePage);
    pageNumber++;

    // ===== 3. STORY CONTENT PAGES =====
    // Each scene gets pages with image + text, splitting long text across multiple pages
    // NO choices/decisions shown - just the narrative

    // Approximate characters that fit on a page (tuned for readability)
    // Reduced further - page 10 still overflowed at 420
    const CHARS_WITH_IMAGE = 380;
    const CHARS_WITHOUT_IMAGE = 780;

    scenes.forEach((scene, sceneIndex) => {
        const imagePosition = imagePositions[sceneIndex % imagePositions.length];
        const isJapanese = storyData.language === 'ja';
        const isFinale = sceneIndex === scenes.length - 1;

        // Get just the narrative text (no choices)
        const narrativeText = scene.text || '';
        const paragraphsArray = narrativeText.split('\n\n').filter(p => p.trim());

        // For finale or long scenes, split across multiple pages
        const totalChars = narrativeText.length;
        const hasImage = !!scene.image_url;
        const firstPageLimit = hasImage ? CHARS_WITH_IMAGE : CHARS_WITHOUT_IMAGE;

        // Only split if there's SIGNIFICANTLY more text than fits (1.8x threshold)
        // This prevents awkward splits with mostly-empty continuation pages
        const needsSplit = totalChars > firstPageLimit * 1.8;

        if (needsSplit && hasImage) {
            // Long scene with image - split across multiple pages
            // First page: image + beginning of text
            let charCount = 0;
            let firstPageParas = [];
            let remainingParas = [...paragraphsArray];

            // Fill first page up to limit
            while (remainingParas.length > 0 && charCount + remainingParas[0].length <= firstPageLimit) {
                const para = remainingParas.shift();
                firstPageParas.push(para);
                charCount += para.length;
            }

            // Ensure we have at least one paragraph on first page
            if (firstPageParas.length === 0 && remainingParas.length > 0) {
                firstPageParas.push(remainingParas.shift());
            }

            // First page with image
            const firstPage = document.createElement('div');
            firstPage.className = `page ${isJapanese ? 'ja-vertical' : ''}`;
            firstPage.innerHTML = `
                <div class="page-content">
                    <div class="scene-image-container position-${imagePosition}">
                        <img src="${scene.image_url}" alt="Scene ${sceneIndex + 1}" loading="lazy">
                    </div>
                    <div class="scene-text-container with-image-${imagePosition}">
                        <div class="scene-text" data-text="${encodeURIComponent(firstPageParas.join('\n\n'))}">
                            ${firstPageParas.map(p => `<p>${p.trim()}</p>`).join('')}
                        </div>
                    </div>
                    <div class="page-number">${++pageNumber}</div>
                </div>
            `;
            bookEl.appendChild(firstPage);

            // Continuation pages (text only) - only if there's substantial remaining content
            while (remainingParas.length > 0) {
                let pageParas = [];
                let pageChars = 0;

                while (remainingParas.length > 0 && pageChars + remainingParas[0].length <= CHARS_WITHOUT_IMAGE) {
                    const para = remainingParas.shift();
                    pageParas.push(para);
                    pageChars += para.length;
                }

                // If we couldn't fit any paragraph, force at least one
                if (pageParas.length === 0 && remainingParas.length > 0) {
                    pageParas.push(remainingParas.shift());
                }

                const contPage = document.createElement('div');
                contPage.className = `page page-text-only ${isJapanese ? 'ja-vertical' : ''}`;
                contPage.innerHTML = `
                    <div class="page-content">
                        <div class="scene-text-container">
                            <div class="scene-text continuation" data-text="${encodeURIComponent(pageParas.join('\n\n'))}">
                                ${pageParas.map(p => `<p>${p.trim()}</p>`).join('')}
                            </div>
                        </div>
                        <div class="page-number">${++pageNumber}</div>
                    </div>
                `;
                bookEl.appendChild(contPage);
            }

        } else {
            // Short scene - fits on one page
            const paragraphs = paragraphsArray.map(p => `<p>${p.trim()}</p>`).join('');

            const contentPage = document.createElement('div');
            contentPage.className = `page ${isJapanese ? 'ja-vertical' : ''}`;

            if (hasImage) {
                contentPage.innerHTML = `
                    <div class="page-content">
                        <div class="scene-image-container position-${imagePosition}">
                            <img src="${scene.image_url}" alt="Scene ${sceneIndex + 1}" loading="lazy">
                        </div>
                        <div class="scene-text-container with-image-${imagePosition}">
                            <div class="scene-text" data-text="${encodeURIComponent(narrativeText)}">
                                ${paragraphs}
                            </div>
                        </div>
                        <div class="page-number">${++pageNumber}</div>
                    </div>
                `;
            } else {
                contentPage.className += ' page-text-only';
                contentPage.innerHTML = `
                    <div class="page-content">
                        <div class="scene-text-container">
                            <div class="scene-text" data-text="${encodeURIComponent(narrativeText)}">
                                ${paragraphs}
                            </div>
                        </div>
                        <div class="page-number">${++pageNumber}</div>
                    </div>
                `;
            }

            bookEl.appendChild(contentPage);
        }
    });

    // ===== 4. BACK COVER =====
    const endingType = storyData.ending_type || 'default';
    const quote = getRandomQuote(endingType);
    const formattedEnding = formatEndingType(endingType);

    const backCover = document.createElement('div');
    backCover.className = 'page cover back';
    backCover.dataset.density = 'hard';
    backCover.innerHTML = `
        <div class="back-cover-content">
            <h2>The End</h2>
            <p class="ending-type">${formattedEnding}</p>
            <div class="back-ornament"></div>
            <p class="back-quote">"${quote}"</p>
            <button class="btn-return" onclick="window.location.href='index.html'">
                Return Home
            </button>
            <p class="back-branding">StoryPath</p>
        </div>
    `;
    bookEl.appendChild(backCover);

    // Initialize PageFlip
    initPageFlip();
}

function initPageFlip() {
    const isMobile = window.innerWidth < 768;

    // Calculate optimal size based on viewport
    const maxWidth = Math.min(window.innerWidth * 0.45, 500);
    const maxHeight = Math.min(window.innerHeight * 0.75, 680);

    pageFlip = new St.PageFlip(document.getElementById('book'), {
        width: isMobile ? Math.min(window.innerWidth - 40, 380) : maxWidth,
        height: isMobile ? Math.min(window.innerHeight - 120, 540) : maxHeight,
        size: 'stretch',
        minWidth: 280,
        maxWidth: 600,
        minHeight: 400,
        maxHeight: 800,
        maxShadowOpacity: 0.4,
        showCover: true,
        mobileScrollSupport: false,
        useMouseEvents: true,
        flippingTime: 800,
        usePortrait: isMobile,
        startPage: 0
    });

    pageFlip.loadFromHTML(document.querySelectorAll('.page'));

    // Events
    pageFlip.on('flip', (e) => {
        updatePageCounter(e.data);
        playPageAudio(e.data);
    });

    // Initial counter
    updatePageCounter(0);

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Reload to reinitialize with new dimensions
            location.reload();
        }, 500);
    });
}

function updatePageCounter(pageIndex) {
    const total = pageFlip.getPageCount();
    document.getElementById('pageCounter').textContent = `Page ${pageIndex + 1} / ${total}`;
}

function playPageAudio(pageIndex) {
    if (!audio || !audio.enabled) return;

    // Stop previous audio
    audio.stop();

    // Map page index to scene
    // Cover=0, Title=1, Scene pages start at 2
    const sceneIndex = pageIndex - 2;

    if (sceneIndex >= 0 && sceneIndex < scenes.length) {
        const text = scenes[sceneIndex].text;
        if (text) {
            audio.speak(text, true);
        }
    }
}

// ===== Controls =====
document.getElementById('btnPrev').onclick = () => pageFlip?.flipPrev();
document.getElementById('btnNext').onclick = () => pageFlip?.flipNext();
document.getElementById('btnHome').onclick = () => window.location.href = 'index.html';

document.getElementById('btnAudio').onclick = () => {
    if (audio) {
        const enabled = audio.toggle();
        document.getElementById('btnAudio').textContent = enabled ? '🔊' : '🔇';

        if (enabled && pageFlip) {
            const currentPage = pageFlip.getCurrentPageIndex();
            playPageAudio(currentPage);
        } else if (audio) {
            audio.stop();
        }
    }
};

document.getElementById('btnTheme').onclick = () => {
    document.body.classList.toggle('dark-theme');
};

// ===== Initialize =====
window.addEventListener('load', loadBook);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!pageFlip) return;
    if (e.key === 'ArrowLeft') pageFlip.flipPrev();
    if (e.key === 'ArrowRight') pageFlip.flipNext();
    if (e.key === 'Home') pageFlip.flip(0);
    if (e.key === 'End') pageFlip.flip(pageFlip.getPageCount() - 1);
});

// Touch swipe support is handled by PageFlip library
