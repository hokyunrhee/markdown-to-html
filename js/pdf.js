/**
 * PDF Generator Module
 * Handles PDF generation using html2pdf.js with pagebreak optimization
 */

const PDFGenerator = (function() {
    /**
     * Convert SVG element to PNG data URL via Canvas
     * @param {SVGElement} svgElement - The SVG element to convert
     * @param {number} scale - Scale factor for higher resolution (default: 2)
     * @returns {Promise<string>} PNG data URL
     */
    async function convertSvgToImage(svgElement, scale = 2) {
        return new Promise((resolve, reject) => {
            // Get SVG dimensions
            const bbox = svgElement.getBoundingClientRect();
            // parseFloat handles strings like "800px" or "800" correctly
            const width = bbox.width || parseFloat(svgElement.getAttribute('width')) || 800;
            const height = bbox.height || parseFloat(svgElement.getAttribute('height')) || 600;

            // Clone SVG to avoid modifying the original
            const svgClone = svgElement.cloneNode(true);

            // Ensure SVG has proper dimensions and namespace
            svgClone.setAttribute('width', width);
            svgClone.setAttribute('height', height);
            if (!svgClone.getAttribute('xmlns')) {
                svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }

            // Serialize SVG to string
            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(svgClone);

            // Encode SVG string to data URL
            const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

            // Create Image and load SVG
            const img = new Image();
            img.onload = function() {
                // Create canvas with scaled dimensions for better quality
                const canvas = document.createElement('canvas');
                canvas.width = width * scale;
                canvas.height = height * scale;

                const ctx = canvas.getContext('2d');
                // Fill with white background (SVGs may have transparent bg)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Scale and draw
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to PNG data URL
                const pngDataUrl = canvas.toDataURL('image/png');
                resolve(pngDataUrl);
            };

            img.onerror = function(e) {
                console.error('Failed to load SVG as image:', e);
                reject(new Error('Failed to convert SVG to image'));
            };

            img.src = svgDataUrl;
        });
    }
    
    /**
     * Convert all Mermaid SVGs to images for PDF generation
     * @param {HTMLElement} container - The container with Mermaid diagrams
     * @returns {Array} Array of objects containing element and original SVG for restoration
     */
    async function convertMermaidToImages(container) {
        const mermaidElements = container.querySelectorAll('.mermaid');
        const originalSvgs = [];
        
        for (const mermaidEl of mermaidElements) {
            const svg = mermaidEl.querySelector('svg');
            if (!svg) continue;
            
            try {
                // Store original SVG HTML for restoration
                originalSvgs.push({
                    element: mermaidEl,
                    originalHtml: mermaidEl.innerHTML
                });
                
                // Convert SVG to PNG
                const pngDataUrl = await convertSvgToImage(svg);
                
                // Get dimensions for the image
                const bbox = svg.getBoundingClientRect();
                
                // Replace SVG with IMG
                const img = document.createElement('img');
                img.src = pngDataUrl;
                img.style.width = bbox.width + 'px';
                img.style.maxWidth = '100%';
                img.style.height = 'auto'; // Maintain aspect ratio
                img.alt = 'Mermaid diagram';
                
                // Clear and append image
                mermaidEl.innerHTML = '';
                mermaidEl.appendChild(img);
            } catch (error) {
                console.warn('Failed to convert Mermaid SVG to image:', error);
                // Keep original SVG if conversion fails
            }
        }
        
        return originalSvgs;
    }
    
    /**
     * Restore original Mermaid SVGs after PDF generation
     * @param {Array} originalSvgs - Array of objects with element and original HTML
     */
    function restoreMermaidSvgs(originalSvgs) {
        for (const { element, originalHtml } of originalSvgs) {
            element.innerHTML = originalHtml;
        }
    }
    
    /**
     * Wait for fonts to be fully loaded
     */
    async function waitForFonts() {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        // Additional delay to ensure fonts are rendered
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    /**
     * Wait for all images to load with timeout
     */
    async function waitForImages(container) {
        const images = container.querySelectorAll('img');

        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('Image load timeout, continuing anyway:', img.src);
                    resolve();
                }, 10000); // 10 second timeout per image

                img.onload = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                img.onerror = () => {
                    clearTimeout(timeout);
                    resolve(); // Don't fail on broken images
                };
            });
        });
        await Promise.all(promises);
    }
    
    /**
     * Wait for Mermaid diagrams to render
     */
    async function waitForMermaid(container) {
        const mermaidElements = container.querySelectorAll('.mermaid');
        if (mermaidElements.length === 0) return;
        
        // Check if all mermaid elements have SVG content
        const allRendered = Array.from(mermaidElements).every(el => 
            el.querySelector('svg') !== null
        );
        
        if (!allRendered) {
            // Wait a bit more for mermaid to finish rendering
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    /**
     * Get html2pdf.js configuration options
     */
    function getOptions(filename) {
        return {
            // Margins: [top, left, bottom, right] in mm
            margin: [15, 10, 15, 10],
            filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
            image: { 
                type: 'jpeg', 
                quality: 0.95 
            },
            html2canvas: {
                scale: 1.5,
                useCORS: true,
                logging: false,
                letterRendering: true
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            },
            pagebreak: {
                // Use css and legacy modes (avoid-all prevents natural table breaks)
                mode: ['css', 'legacy'],
                // Force page break before these selectors
                before: '.page-break-before',
                // Force page break after these selectors
                after: '.page-break-after',
                // Avoid breaking inside these elements
                avoid: [
                    // Code blocks
                    'pre',
                    '.code-block',
                    // Table rows (allow table to break naturally at row boundaries)
                    'thead',
                    'tr',
                    // Blockquotes (use wrapper for margin separation)
                    '.blockquote-wrapper',
                    // Diagrams
                    '.mermaid',
                    '.mermaid-wrapper',
                    // Math expressions
                    '.katex-display',
                    // Headings (should stay with following content)
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'p',
                    // Images
                    'img',
                    '.image-wrapper',
                    // Lists (avoid breaking individual items)
                    'li',
                    // Custom no-break class
                    '.no-break'
                ]
            }
        };
    }
    
    /**
     * Generate PDF from the preview element
     */
    async function generate(previewElement, filename = 'document.pdf') {
        // Show loading indicator
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');

        // Store original padding to restore after PDF generation
        const originalPadding = previewElement.style.padding;

        // Store original SVGs for restoration
        let originalSvgs = [];

        try {
            // Wait for all content to be ready
            await waitForFonts();
            await waitForImages(previewElement);
            await waitForMermaid(previewElement);

            // Convert Mermaid SVGs to images for better PDF rendering
            // html2canvas has issues with complex SVGs, so we convert them to PNG
            originalSvgs = await convertMermaidToImages(previewElement);

            // Wait for converted images to load
            await waitForImages(previewElement);

            // Small additional delay for any final rendering
            await new Promise(resolve => setTimeout(resolve, 200));

            // Remove padding before PDF generation (margin is handled by html2pdf)
            previewElement.style.padding = '0';

            // Get configuration options
            const options = getOptions(filename);

            // Generate PDF directly from the preview element
            // html2pdf.js handles the element rendering internally
            await html2pdf()
                .set(options)
                .from(previewElement)
                .save();

            return true;
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        } finally {
            // Restore original Mermaid SVGs (keep preview interactive/scalable)
            restoreMermaidSvgs(originalSvgs);

            // Restore original padding
            previewElement.style.padding = originalPadding;
            // Hide loading indicator
            if (loading) loading.classList.add('hidden');
        }
    }
    
    // Public API
    return {
        generate
    };
})();
