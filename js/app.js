/**
 * Main Application Module
 * Handles event binding, real-time preview, and app initialization
 */

const App = (function() {
    // DOM Elements
    let editor = null;
    let preview = null;
    let downloadBtn = null;
    
    // Debounce timer
    let debounceTimer = null;
    const DEBOUNCE_DELAY = 300; // 300ms for preview update
    
    // Default sample markdown
    const sampleMarkdown = `# Markdown to PDF Converter

Convert your documents to PDF. Supports **bold text** and *italics*.

## Key Features

1. Real-time preview
2. Code syntax highlighting
3. Mathematical expressions
4. Mermaid diagrams

### Code Blocks

\`\`\`javascript
function greet(name) {
    console.log(\`Hello, \${name}!\`);
    return true;
}
\`\`\`

### Mathematical Expressions

Inline math: $E = mc^2$

Block math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Mermaid Diagrams

\`\`\`mermaid
flowchart LR
    A[Start] --> B{Condition}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D
\`\`\`

### Tables

| Feature | Supported |
|---------|-----------|
| Text | ✅ |
| Code | ✅ |
| Math | ✅ |
| Diagrams | ✅ |

### Blockquotes

> This is a blockquote.
> It can span multiple lines.

---

© 2024 Markdown to PDF
`;
    
    /**
     * Initialize DOM element references
     */
    function initElements() {
        editor = document.getElementById('editor');
        preview = document.getElementById('preview');
        downloadBtn = document.getElementById('download-btn');
        
        if (!editor || !preview || !downloadBtn) {
            console.error('Required DOM elements not found');
            return false;
        }
        return true;
    }
    
    /**
     * Update preview with current editor content
     */
    async function updatePreview() {
        const content = editor.value;
        
        try {
            await MarkdownParser.parse(content, preview);
        } catch (error) {
            console.error('Preview update error:', error);
            preview.innerHTML = '<p class="error">Preview error occurred.</p>';
        }
    }
    
    /**
     * Debounced preview update
     */
    function debouncedUpdatePreview() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(async () => {
            await updatePreview();
            debounceTimer = null;
        }, DEBOUNCE_DELAY);
    }
    
    /**
     * Handle editor input
     */
    function handleEditorInput() {
        // Update preview with debounce
        debouncedUpdatePreview();
        
        // Save to LocalStorage with debounce
        Storage.debouncedSave(editor.value);
    }
    
    /**
     * Handle PDF download
     */
    async function handleDownload() {
        // Disable button during generation
        downloadBtn.disabled = true;
        
        try {
            // Generate filename from first heading or default
            const firstHeading = preview.querySelector('h1, h2, h3');
            const filename = firstHeading 
                ? firstHeading.textContent.trim().substring(0, 50) 
                : 'document';
            
            await PDFGenerator.generate(preview, filename);
        } catch (error) {
            console.error('Download error:', error);
            alert('An error occurred while generating PDF.');
        } finally {
            downloadBtn.disabled = false;
        }
    }
    
    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Editor input event
        editor.addEventListener('input', handleEditorInput);
        
        // Download button click
        downloadBtn.addEventListener('click', handleDownload);
        
        // Tab key support in editor
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                
                // Insert tab character
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                
                // Move cursor
                editor.selectionStart = editor.selectionEnd = start + 4;
                
                // Trigger update
                handleEditorInput();
            }
        });
    }
    
    /**
     * Load saved content or use sample
     */
    function loadContent() {
        const savedContent = Storage.load();
        
        if (savedContent) {
            editor.value = savedContent;
        } else {
            editor.value = sampleMarkdown;
        }
    }
    
    /**
     * Initialize the application
     */
    async function init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Initialize elements
        if (!initElements()) {
            return;
        }
        
        // Bind events
        bindEvents();
        
        // Load content
        loadContent();
        
        // Initial preview render
        await updatePreview();
        
        console.log('Markdown to PDF initialized');
    }
    
    // Public API
    return {
        init
    };
})();

// Start the app
App.init();
