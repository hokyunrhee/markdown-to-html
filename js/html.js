/**
 * HTML Generator Module
 * Generates a standalone HTML file with embedded CSS
 */

const HTMLGenerator = (function() {
    // CDN URLs for external CSS
    const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css';
    const PRISM_CSS_URL = 'https://cdn.jsdelivr.net/npm/prismjs@1.30.0/themes/prism-tomorrow.min.css';
    
    // CSS cache to avoid re-fetching
    const cssCache = {};
    
    /**
     * Remove @font-face rules from CSS to prevent font loading errors in offline
     * @param {string} css - The CSS content
     * @returns {string} CSS without @font-face rules
     */
    function removeFontFaceRules(css) {
        return css.replace(/@font-face\s*\{[^}]*\}/g, '');
    }
    
    /**
     * Fetch CSS from a URL with caching
     * @param {string} url - The CSS URL to fetch
     * @returns {Promise<string>} The CSS content
     */
    async function fetchCSS(url) {
        if (cssCache[url]) {
            return cssCache[url];
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch CSS: ${response.status}`);
            }
            const css = await response.text();
            cssCache[url] = css;
            return css;
        } catch (error) {
            console.warn(`Failed to fetch CSS from ${url}:`, error);
            return '';
        }
    }
    
    /**
     * Get the local preview.css content
     * @returns {Promise<string>} The CSS content
     */
    async function getPreviewCSS() {
        try {
            const response = await fetch('css/preview.css');
            if (!response.ok) {
                throw new Error(`Failed to fetch preview.css: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.warn('Failed to fetch preview.css:', error);
            return '';
        }
    }
    
    /**
     * Collect all required CSS for the HTML output
     * @returns {Promise<string>} Combined CSS content
     */
    async function collectCSS() {
        // Fetch all CSS in parallel
        const [katexCSS, prismCSS, previewCSS] = await Promise.all([
            fetchCSS(KATEX_CSS_URL),
            fetchCSS(PRISM_CSS_URL),
            getPreviewCSS()
        ]);
        
        // Remove @font-face rules from KaTeX CSS to prevent font loading errors
        const katexCSSWithoutFonts = removeFontFaceRules(katexCSS);
        
        // Combine all CSS with comments for clarity
        return `
/* Google Fonts - Inter */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* KaTeX CSS (fonts removed) */
${katexCSSWithoutFonts}

/* KaTeX System Font Fallback */
.katex {
    font-family: "Times New Roman", Times, Georgia, Cambria, serif;
}
.katex .mathnormal,
.katex .mathit {
    font-family: "Times New Roman", Times, Georgia, Cambria, serif;
    font-style: italic;
}
.katex .mathbf {
    font-family: "Times New Roman", Times, Georgia, Cambria, serif;
    font-weight: bold;
}
.katex .mathbb,
.katex .mathcal,
.katex .mathfrak,
.katex .mathsf,
.katex .mathtt {
    font-family: "Times New Roman", Times, Georgia, Cambria, serif;
}

/* Prism.js Theme (Tomorrow Night) */
${prismCSS}

/* Preview Styles */
${previewCSS}

/* HTML Export Specific Styles */
body {
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
    min-height: 100vh;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.preview {
    margin: 0 auto;
}
`;
    }
    
    /**
     * Clone the preview element and prepare it for export
     * @param {HTMLElement} previewElement - The preview element to clone
     * @returns {string} The HTML content
     */
    function getPreviewHTML(previewElement) {
        // Clone the preview element to avoid modifying the original
        const clone = previewElement.cloneNode(true);
        
        // Remove any loading="lazy" attributes for immediate rendering
        clone.querySelectorAll('img[loading="lazy"]').forEach(img => {
            img.removeAttribute('loading');
        });
        
        return clone.outerHTML;
    }
    
    /**
     * Generate the complete HTML document
     * @param {string} title - Document title
     * @param {string} css - Embedded CSS
     * @param {string} content - HTML content
     * @returns {string} Complete HTML document
     */
    function generateHTMLDocument(title, css, content) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
${css}
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
    }
    
    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Trigger a file download
     * @param {string} content - File content
     * @param {string} filename - Filename for download
     * @param {string} mimeType - MIME type of the file
     */
    function downloadFile(content, filename, mimeType = 'text/html') {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        URL.revokeObjectURL(url);
    }
    
    /**
     * Generate and download HTML from the preview element
     * @param {HTMLElement} previewElement - The preview element
     * @param {string} filename - Base filename (without extension)
     * @returns {Promise<boolean>} Success status
     */
    async function generate(previewElement, filename = 'document') {
        // Show loading indicator
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');
        
        try {
            // Get document title from first heading or use filename
            const firstHeading = previewElement.querySelector('h1, h2, h3');
            const title = firstHeading 
                ? firstHeading.textContent.trim() 
                : filename;
            
            // Collect all CSS
            const css = await collectCSS();
            
            // Get the preview HTML content
            const content = getPreviewHTML(previewElement);
            
            // Generate complete HTML document
            const htmlDocument = generateHTMLDocument(title, css, content);
            
            // Ensure filename has .html extension
            const finalFilename = filename.endsWith('.html') 
                ? filename 
                : `${filename}.html`;
            
            // Trigger download
            downloadFile(htmlDocument, finalFilename);
            
            return true;
        } catch (error) {
            console.error('HTML generation error:', error);
            throw error;
        } finally {
            // Hide loading indicator
            if (loading) loading.classList.add('hidden');
        }
    }
    
    // Public API
    return {
        generate
    };
})();
