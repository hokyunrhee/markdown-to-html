/**
 * Markdown Parser Module
 * Integrates marked.js with KaTeX, Mermaid, and Prism.js
 */

const MarkdownParser = (function() {
    // Unique ID counter for mermaid diagrams
    let mermaidIdCounter = 0;
    
    /**
     * Initialize marked.js with custom settings
     */
    function initMarked() {
        // Configure marked for GFM
        marked.setOptions({
            gfm: true,
            breaks: true,
            pedantic: false
        });
        
        // Custom renderer with wrapper classes for page break control
        const renderer = new marked.Renderer();
        
        // Code blocks - wrap in .code-block for page break control
        renderer.code = function(code, language) {
            // Handle mermaid diagrams - wrap in .mermaid-wrapper
            if (language === 'mermaid') {
                const id = `mermaid-${mermaidIdCounter++}`;
                return `<div class="mermaid-wrapper"><div class="mermaid" id="${id}">${escapeHtml(code)}</div></div>`;
            }
            
            // Handle regular code with Prism highlighting - wrap in .code-block
            if (language && Prism.languages[language]) {
                const highlighted = Prism.highlight(code, Prism.languages[language], language);
                return `<div class="code-block"><pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre></div>`;
            }
            
            // Fallback for unknown languages - wrap in .code-block
            return `<div class="code-block"><pre><code class="language-${language || 'text'}">${escapeHtml(code)}</code></pre></div>`;
        };
        
        // Tables - wrap in .table-wrapper for page break control
        renderer.table = function(header, body) {
            return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
        };
        
        // Images - wrap in .image-wrapper for page break control
        renderer.image = function(href, title, text) {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const altAttr = text ? ` alt="${escapeHtml(text)}"` : '';
            return `<div class="image-wrapper"><img src="${href}"${altAttr}${titleAttr} loading="lazy"></div>`;
        };
        
        // Blockquotes - wrap in .blockquote-wrapper for page break control
        renderer.blockquote = function(quote) {
            return `<div class="blockquote-wrapper"><blockquote>${quote}</blockquote></div>`;
        };
        
        marked.use({ renderer });
    }
    
    /**
     * Initialize Mermaid
     */
    function initMermaid() {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });
    }
    
    /**
     * Escape HTML special characters
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Pre-process markdown to handle KaTeX delimiters
     * Protects math expressions from being parsed by marked
     */
    function preprocessMath(markdown) {
        const mathBlocks = [];
        let counter = 0;
        
        // Protect block math ($$...$$)
        markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            const placeholder = `%%MATH_BLOCK_${counter}%%`;
            mathBlocks.push({ placeholder, math: math.trim(), display: true });
            counter++;
            return placeholder;
        });
        
        // Protect inline math ($...$) - but not escaped \$
        markdown = markdown.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (match, math) => {
            const placeholder = `%%MATH_INLINE_${counter}%%`;
            mathBlocks.push({ placeholder, math: math.trim(), display: false });
            counter++;
            return placeholder;
        });
        
        return { markdown, mathBlocks };
    }
    
    /**
     * Post-process HTML to render KaTeX
     */
    function postprocessMath(html, mathBlocks) {
        mathBlocks.forEach(({ placeholder, math, display }) => {
            try {
                const rendered = katex.renderToString(math, {
                    displayMode: display,
                    throwOnError: false,
                    output: 'html'
                });

                // Note: Don't wrap in <div> as display math may appear inside <p> tags
                // Page break control is applied directly to .katex-display via CSS
                html = html.replace(placeholder, rendered);
            } catch (e) {
                console.warn('KaTeX error:', e);
                html = html.replace(placeholder, `<span class="katex-error">${escapeHtml(math)}</span>`);
            }
        });
        return html;
    }
    
    /**
     * Render mermaid diagrams in the preview
     */
    async function renderMermaid(container) {
        const mermaidElements = container.querySelectorAll('.mermaid');

        // A4 page height minus margins (in pixels, assuming 96 DPI: 240mm ≈ 907px)
        const maxHeightPx = 907;

        for (const element of mermaidElements) {
            const id = element.id || `mermaid-${Date.now()}`;
            const code = element.textContent;

            try {
                const { svg } = await mermaid.render(id + '-svg', code);
                element.innerHTML = svg;

                // Scale down SVG if it exceeds page height
                const svgElement = element.querySelector('svg');
                if (svgElement) {
                    const svgHeight = svgElement.getBoundingClientRect().height;
                    if (svgHeight > maxHeightPx) {
                        // Remove fixed width/height attributes and let CSS handle scaling
                        svgElement.removeAttribute('height');
                        svgElement.removeAttribute('width');
                        svgElement.style.maxHeight = maxHeightPx + 'px';
                        svgElement.style.width = 'auto';
                        svgElement.style.height = 'auto';
                        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    }
                }
            } catch (e) {
                console.warn('Mermaid error:', e);
                element.innerHTML = `<pre class="mermaid-error">Diagram Error: ${escapeHtml(e.message)}</pre>`;
            }
        }
    }
    
    /**
     * Apply Prism highlighting to any unhighlighted code blocks
     */
    function highlightCode(container) {
        Prism.highlightAllUnder(container);
    }
    
    /**
     * Main parse function
     * Converts markdown to HTML with all extensions
     */
    async function parse(markdown, container) {
        // Reset mermaid counter for consistent IDs
        mermaidIdCounter = 0;

        // Pre-process math expressions
        const { markdown: processedMarkdown, mathBlocks } = preprocessMath(markdown);

        // Parse markdown to HTML
        let html = marked.parse(processedMarkdown);

        // Post-process math expressions
        html = postprocessMath(html, mathBlocks);

        // Set HTML content
        container.innerHTML = html;

        // Render mermaid diagrams (async)
        await renderMermaid(container);

        // Apply syntax highlighting
        highlightCode(container);

        return container.innerHTML;
    }
    
    /**
     * Initialize the parser
     */
    function init() {
        initMarked();
        initMermaid();
    }
    
    // Public API
    return {
        init,
        parse
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MarkdownParser.init();
});
