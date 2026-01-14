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
    const sampleMarkdown = `# Markdown to PDF 변환기

한글 문서를 PDF로 변환할 수 있습니다. **굵은 글씨**와 *기울임체*도 지원합니다.

## 주요 기능

1. 실시간 미리보기
2. 코드 하이라이팅
3. 수학 수식 지원
4. Mermaid 다이어그램

### 코드 블록

\`\`\`javascript
function greet(name) {
    console.log(\`안녕하세요, \${name}님!\`);
    return true;
}
\`\`\`

### 수학 수식

인라인 수식: $E = mc^2$

블록 수식:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Mermaid 다이어그램

\`\`\`mermaid
flowchart LR
    A[시작] --> B{조건}
    B -->|예| C[처리]
    B -->|아니오| D[종료]
    C --> D
\`\`\`

### 표

| 기능 | 지원 여부 |
|------|----------|
| 한글 | ✅ |
| 코드 | ✅ |
| 수식 | ✅ |
| 다이어그램 | ✅ |

### 인용문

> 이것은 인용문입니다.
> 여러 줄로 작성할 수 있습니다.

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
            preview.innerHTML = '<p class="error">미리보기 오류가 발생했습니다.</p>';
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
            alert('PDF 생성 중 오류가 발생했습니다.');
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
