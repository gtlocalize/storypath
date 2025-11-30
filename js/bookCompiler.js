/**
 * Book Compiler - Computes optimal page layout for a completed story
 * 
 * This runs in the browser (needs DOM for text measurement) but is triggered
 * after story completion. It measures actual text overflow and creates a
 * pre-computed layout that book.js can render instantly.
 */

class BookCompiler {
    constructor() {
        // Page dimensions (matching PageFlip settings)
        this.pageWidth = 450;
        this.pageHeight = 620;
        
        // Layout constants
        this.IMAGE_HEIGHT_RATIO = 0.45; // 45% of page for images
        this.PADDING = { top: 24, right: 32, bottom: 40, left: 32 };
        this.LINE_HEIGHT = 1.75;
        this.FONT_SIZE = 16.8; // 1.05rem in pixels
        
        // Computed text area heights
        this.textAreaWithImage = this.pageHeight * (1 - this.IMAGE_HEIGHT_RATIO) 
            - this.PADDING.top - this.PADDING.bottom - 16; // extra padding for image
        this.textAreaFullPage = this.pageHeight - this.PADDING.top - this.PADDING.bottom;
        
        // Hidden measurement container
        this.measureContainer = null;
    }

    /**
     * Compile a complete story into a book layout
     * @param {Object} storyData - Story metadata
     * @param {Array} scenes - Array of scene objects with text and image_url
     * @param {Function} onProgress - Progress callback (0-100)
     * @returns {Object} Compiled book layout
     */
    async compile(storyData, scenes, onProgress = () => {}) {
        console.log('📚 Starting book compilation...');
        
        // Create hidden measurement container
        this.createMeasureContainer();
        
        const pages = [];
        let pageNumber = 0;
        
        // 1. Front Cover
        pages.push({ type: 'cover', side: 'front' });
        
        // 2. Title Page
        pages.push({ type: 'title', pageNumber: ++pageNumber });
        
        onProgress(5);
        
        // 3. Process each scene
        const imagePositions = ['top', 'top', 'bottom', 'top', 'bottom', 'top'];
        
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
            const scene = scenes[sceneIndex];
            const hasImage = !!scene.image_url;
            const imagePosition = imagePositions[sceneIndex % imagePositions.length];
            const narrativeText = scene.text || '';
            
            // Split text into paragraphs
            const paragraphs = narrativeText.split('\n\n').filter(p => p.trim());
            
            if (paragraphs.length === 0) continue;
            
            // Measure and paginate this scene
            const scenePages = await this.paginateScene(
                paragraphs, 
                hasImage, 
                imagePosition, 
                sceneIndex,
                scene.image_url
            );
            
            // Add scene pages with page numbers
            scenePages.forEach((page, idx) => {
                pages.push({
                    ...page,
                    pageNumber: ++pageNumber,
                    sceneIndex,
                    isFirstPageOfScene: idx === 0,
                    isContinuation: idx > 0
                });
            });
            
            // Update progress
            const progress = 5 + Math.floor((sceneIndex / scenes.length) * 90);
            onProgress(progress);
        }
        
        // 4. Back Cover
        pages.push({ 
            type: 'back', 
            endingType: storyData.ending_type || 'default'
        });
        
        // Cleanup
        this.removeMeasureContainer();
        
        onProgress(100);
        
        const layout = {
            version: 1,
            storyId: storyData.id,
            title: storyData.title,
            language: storyData.language,
            genre: storyData.genre,
            coverUrl: storyData.book_cover_url,
            endingType: storyData.ending_type,
            totalPages: pageNumber + 1, // +1 for back cover
            pages,
            compiledAt: new Date().toISOString()
        };
        
        console.log(`📚 Book compiled: ${layout.totalPages} pages`);
        return layout;
    }

    /**
     * Paginate a single scene's text across one or more pages
     */
    async paginateScene(paragraphs, hasImage, imagePosition, sceneIndex, imageUrl) {
        const pages = [];
        let remainingParagraphs = [...paragraphs];
        let isFirstPage = true;
        
        while (remainingParagraphs.length > 0) {
            const showImage = isFirstPage && hasImage;
            const availableHeight = showImage ? this.textAreaWithImage : this.textAreaFullPage;
            
            // Find how many paragraphs fit on this page
            const { fittingParagraphs, overflow } = await this.measureFit(
                remainingParagraphs,
                availableHeight,
                isFirstPage && !showImage // Apply drop cap only on first page without image crowding
            );
            
            if (fittingParagraphs.length === 0 && remainingParagraphs.length > 0) {
                // Edge case: single paragraph too long, force it and let CSS handle
                fittingParagraphs.push(remainingParagraphs.shift());
            }
            
            // Create page entry
            const page = {
                type: 'content',
                paragraphs: fittingParagraphs,
                hasImage: showImage,
                imagePosition: showImage ? imagePosition : null,
                imageUrl: showImage ? imageUrl : null
            };
            
            pages.push(page);
            
            // Update remaining
            remainingParagraphs = remainingParagraphs.slice(fittingParagraphs.length);
            isFirstPage = false;
        }
        
        return pages;
    }

    /**
     * Measure how many paragraphs fit in the available height
     */
    async measureFit(paragraphs, availableHeight, hasDropCap) {
        const fittingParagraphs = [];
        let currentHeight = 0;
        
        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];
            const isFirst = i === 0;
            
            // Measure paragraph height
            const paraHeight = this.measureParagraph(para, isFirst && hasDropCap);
            
            if (currentHeight + paraHeight <= availableHeight) {
                fittingParagraphs.push(para);
                currentHeight += paraHeight;
            } else {
                // This paragraph doesn't fit
                break;
            }
        }
        
        return {
            fittingParagraphs,
            overflow: paragraphs.length > fittingParagraphs.length
        };
    }

    /**
     * Measure a single paragraph's rendered height
     */
    measureParagraph(text, hasDropCap = false) {
        const p = document.createElement('p');
        p.style.cssText = `
            margin: 0 0 0.85em 0;
            text-indent: ${hasDropCap ? '0' : '1.5em'};
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: ${this.FONT_SIZE}px;
            line-height: ${this.LINE_HEIGHT};
            text-align: justify;
            hyphens: auto;
        `;
        
        // Simulate drop cap effect on height
        if (hasDropCap && text.length > 0) {
            // Drop cap adds roughly 1.5 lines of height
            p.innerHTML = text;
        } else {
            p.textContent = text;
        }
        
        this.measureContainer.appendChild(p);
        const height = p.offsetHeight;
        this.measureContainer.removeChild(p);
        
        // Add drop cap extra height if applicable
        const dropCapExtra = hasDropCap ? this.FONT_SIZE * 1.2 : 0;
        
        return height + dropCapExtra;
    }

    /**
     * Create hidden container for DOM measurements
     */
    createMeasureContainer() {
        this.measureContainer = document.createElement('div');
        this.measureContainer.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: ${this.pageWidth - this.PADDING.left - this.PADDING.right}px;
            visibility: hidden;
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: ${this.FONT_SIZE}px;
            line-height: ${this.LINE_HEIGHT};
        `;
        document.body.appendChild(this.measureContainer);
    }

    /**
     * Remove measurement container
     */
    removeMeasureContainer() {
        if (this.measureContainer && this.measureContainer.parentNode) {
            this.measureContainer.parentNode.removeChild(this.measureContainer);
        }
        this.measureContainer = null;
    }
}

// Export for use
window.BookCompiler = BookCompiler;

