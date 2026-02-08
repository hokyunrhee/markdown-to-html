/**
 * Main Application Module
 * Handles event binding, real-time preview, document management, and app initialization
 */

const App = (function() {
    // DOM Elements
    let editor = null;
    let preview = null;
    let downloadButton = null;

    // Tab Elements
    let tabEdit = null;
    let tabPreview = null;
    let editorPanel = null;
    let previewPanel = null;

    // Header buttons
    let documentsBtn = null;
    let saveBtn = null;

    // Sidebar elements
    let sidebar = null;
    let sidebarOverlay = null;
    let sidebarClose = null;
    let docSearch = null;
    let newDocBtn = null;
    let docList = null;
    let docListEmpty = null;

    // Save modal elements
    let saveModal = null;
    let saveModalClose = null;
    let saveModalCancel = null;
    let saveModalConfirm = null;
    let docTitleInput = null;

    // Confirm modal elements
    let confirmModal = null;
    let confirmSave = null;
    let confirmDiscard = null;
    let confirmCancel = null;

    // Debounce timer
    let debounceTimer = null;
    const DEBOUNCE_DELAY = 300;

    // Generation counter to discard stale renders
    let previewGeneration = 0;

    // Document state
    let currentDocId = null;       // id of loaded saved document (null = new/unsaved)
    let lastSavedContent = '';     // content at last save/load point for change detection
    let pendingOpenDoc = null;     // document waiting to open after confirm dialog
    let saveBusy = false;          // guard against double-click on save modal buttons
    let confirmBusy = false;       // guard against double-click on confirm modal buttons

    // Default sample markdown
    const sampleMarkdown = `# Markdown to HTML Converter

Convert your documents to HTML. Supports **bold text** and *italics*.

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
`;

    /**
     * Initialize DOM element references
     */
    function initElements() {
        editor = document.getElementById('editor');
        preview = document.getElementById('preview');
        downloadButton = document.getElementById('download-btn');

        tabEdit = document.getElementById('tab-edit');
        tabPreview = document.getElementById('tab-preview');
        editorPanel = document.querySelector('.editor-panel');
        previewPanel = document.querySelector('.preview-panel');

        documentsBtn = document.getElementById('documents-btn');
        saveBtn = document.getElementById('save-btn');

        sidebar = document.getElementById('sidebar');
        sidebarOverlay = document.getElementById('sidebar-overlay');
        sidebarClose = document.getElementById('sidebar-close');
        docSearch = document.getElementById('doc-search');
        newDocBtn = document.getElementById('new-doc-btn');
        docList = document.getElementById('doc-list');
        docListEmpty = document.getElementById('doc-list-empty');

        saveModal = document.getElementById('save-modal');
        saveModalClose = document.getElementById('save-modal-close');
        saveModalCancel = document.getElementById('save-modal-cancel');
        saveModalConfirm = document.getElementById('save-modal-confirm');
        docTitleInput = document.getElementById('doc-title-input');

        confirmModal = document.getElementById('confirm-modal');
        confirmSave = document.getElementById('confirm-save');
        confirmDiscard = document.getElementById('confirm-discard');
        confirmCancel = document.getElementById('confirm-cancel');

        const required = [
            editor, preview, downloadButton, tabEdit, tabPreview,
            editorPanel, previewPanel, documentsBtn, saveBtn, sidebar,
            sidebarOverlay, sidebarClose, docSearch, newDocBtn, docList,
            docListEmpty, saveModal, saveModalClose, saveModalCancel,
            saveModalConfirm, docTitleInput, confirmModal, confirmSave,
            confirmDiscard, confirmCancel
        ];

        if (required.some(el => !el)) {
            console.error('Required DOM elements not found');
            return false;
        }
        return true;
    }

    // ─── Preview ───

    async function updatePreview() {
        const generation = ++previewGeneration;
        const content = editor.value;
        try {
            await MarkdownParser.parse(content, preview);
            // If a newer render started while we were awaiting, the DOM is already
            // overwritten by the newer call's synchronous innerHTML assignment,
            // so no additional cleanup needed here.
        } catch (error) {
            if (generation !== previewGeneration) return;
            console.error('Preview update error:', error);
            preview.innerHTML = '<p class="error">Preview error occurred.</p>';
        }
    }

    function debouncedUpdatePreview() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
            await updatePreview();
            debounceTimer = null;
        }, DEBOUNCE_DELAY);
    }

    // ─── Change Detection ───

    function hasUnsavedChanges() {
        return editor.value !== lastSavedContent;
    }

    // ─── Editor Input ───

    function handleEditorInput() {
        debouncedUpdatePreview();
        Storage.debouncedSave(editor.value);
    }

    // ─── Tab Switching ───

    function switchTab(mode) {
        if (mode === 'edit') {
            tabEdit.classList.add('active');
            tabPreview.classList.remove('active');
            editorPanel.classList.add('active');
            previewPanel.classList.remove('active');
        } else {
            tabEdit.classList.remove('active');
            tabPreview.classList.add('active');
            editorPanel.classList.remove('active');
            previewPanel.classList.add('active');
            updatePreview();
        }
    }

    // ─── Download ───

    async function handleDownload() {
        downloadButton.disabled = true;
        try {
            const firstHeading = preview.querySelector('h1, h2, h3');
            const filename = firstHeading
                ? firstHeading.textContent.trim().substring(0, 50)
                : 'document';
            await HTMLGenerator.generate(preview, filename);
        } catch (error) {
            console.error('Download error:', error);
            alert('An error occurred while generating HTML.');
        } finally {
            downloadButton.disabled = false;
        }
    }

    // ─── Sidebar ───

    function openSidebar() {
        sidebar.classList.remove('hidden');
        sidebarOverlay.classList.remove('hidden');
        docSearch.value = '';
        renderDocumentList();
    }

    function closeSidebar() {
        sidebar.classList.add('hidden');
        sidebarOverlay.classList.add('hidden');
    }

    async function renderDocumentList(query) {
        try {
            const docs = query
                ? await Storage.searchDocuments(query)
                : await Storage.getAllDocuments();

            docList.innerHTML = '';

            if (docs.length === 0) {
                docList.classList.add('hidden');
                docListEmpty.classList.remove('hidden');
                docListEmpty.querySelector('p').textContent = query
                    ? 'No matching documents.'
                    : 'No saved documents yet.';
                return;
            }

            docList.classList.remove('hidden');
            docListEmpty.classList.add('hidden');

            docs.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'doc-list-item';
                li.dataset.id = doc.id;

                const date = new Date(doc.updatedAt);
                const dateStr = formatDate(date);

                li.innerHTML = `
                    <div class="doc-list-item-info">
                        <div class="doc-list-item-title">${escapeHtml(doc.title)}</div>
                        <div class="doc-list-item-date">${escapeHtml(dateStr)}</div>
                    </div>
                    <div class="doc-list-item-actions">
                        <button class="doc-action-btn rename" aria-label="Rename" data-id="${escapeHtml(String(doc.id))}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            </svg>
                        </button>
                        <button class="doc-action-btn delete" aria-label="Delete" data-id="${escapeHtml(String(doc.id))}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;

                docList.appendChild(li);
            });
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    }

    function formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Open Document (with unsaved changes protection) ───

    function requestOpenDocument(doc) {
        if (hasUnsavedChanges()) {
            pendingOpenDoc = doc;
            openConfirmModal();
        } else {
            loadDocument(doc);
        }
    }

    function requestNewDocument() {
        if (hasUnsavedChanges()) {
            pendingOpenDoc = 'new';
            openConfirmModal();
        } else {
            resetToNewDocument();
        }
    }

    function loadDocument(doc) {
        Storage.cancelPendingAutosave();
        editor.value = doc.content;
        currentDocId = doc.id;
        lastSavedContent = doc.content;
        closeSidebar();
        updatePreview();
    }

    function resetToNewDocument() {
        Storage.cancelPendingAutosave();
        editor.value = '';
        currentDocId = null;
        lastSavedContent = '';
        closeSidebar();
        updatePreview();
    }

    // ─── Save Modal ───

    function openSaveModal() {
        // Suggest title from first heading or current doc name
        let suggestedTitle = '';
        const firstHeading = preview.querySelector('h1, h2, h3');
        if (firstHeading) {
            suggestedTitle = firstHeading.textContent.trim().substring(0, 100);
        }
        docTitleInput.value = suggestedTitle;
        saveModal.classList.remove('hidden');
        docTitleInput.focus();
        docTitleInput.select();
    }

    function closeSaveModal() {
        saveModal.classList.add('hidden');
        docTitleInput.value = '';
    }

    async function handleSaveConfirm() {
        if (saveBusy) return;
        const title = docTitleInput.value.trim();
        if (!title) {
            docTitleInput.focus();
            return;
        }

        saveBusy = true;
        saveModalConfirm.disabled = true;
        saveModalCancel.disabled = true;
        try {
            const content = editor.value;
            if (currentDocId) {
                await Storage.updateDocument(currentDocId, title, content);
            } else {
                const newId = await Storage.saveDocument(title, content);
                currentDocId = newId;
            }
            lastSavedContent = content;
            closeSaveModal();
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save document.');
        } finally {
            saveBusy = false;
            saveModalConfirm.disabled = false;
            saveModalCancel.disabled = false;
        }
    }

    // ─── Confirm Modal (unsaved changes) ───

    function openConfirmModal() {
        confirmModal.classList.remove('hidden');
    }

    function closeConfirmModal() {
        confirmModal.classList.add('hidden');
    }

    async function handleConfirmSave() {
        if (confirmBusy) return;
        confirmBusy = true;
        confirmSave.disabled = true;
        confirmDiscard.disabled = true;
        confirmCancel.disabled = true;
        // Save current work first, then open pending doc
        const title = getAutoTitle();
        try {
            const content = editor.value;
            if (currentDocId) {
                // Fetch current doc to get its title
                const existingDoc = await Storage.getDocument(currentDocId);
                await Storage.updateDocument(currentDocId, existingDoc ? existingDoc.title : title, content);
            } else {
                const newId = await Storage.saveDocument(title, content);
                currentDocId = newId;
            }
            lastSavedContent = content;
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save document.');
            closeConfirmModal();
            return;
        } finally {
            confirmBusy = false;
            confirmSave.disabled = false;
            confirmDiscard.disabled = false;
            confirmCancel.disabled = false;
        }

        closeConfirmModal();
        openPendingDoc();
    }

    function handleConfirmDiscard() {
        closeConfirmModal();
        openPendingDoc();
    }

    function handleConfirmCancel() {
        closeConfirmModal();
        pendingOpenDoc = null;
    }

    function openPendingDoc() {
        if (pendingOpenDoc === 'new') {
            resetToNewDocument();
        } else if (pendingOpenDoc) {
            loadDocument(pendingOpenDoc);
        }
        pendingOpenDoc = null;
    }

    function getAutoTitle() {
        const firstHeading = preview.querySelector('h1, h2, h3');
        if (firstHeading) {
            return firstHeading.textContent.trim().substring(0, 100);
        }
        const firstLine = editor.value.split('\n').find(l => l.trim());
        if (firstLine) {
            return firstLine.replace(/^#+\s*/, '').trim().substring(0, 100);
        }
        return 'Untitled';
    }

    // ─── Rename ───

    function startRename(li, doc) {
        const titleEl = li.querySelector('.doc-list-item-title');
        const originalTitle = doc.title;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'doc-rename-input';
        input.value = originalTitle;

        titleEl.replaceWith(input);
        input.focus();
        input.select();

        async function finishRename() {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== originalTitle) {
                try {
                    await Storage.renameDocument(doc.id, newTitle);
                } catch (error) {
                    console.error('Rename failed:', error);
                }
            }
            renderDocumentList(docSearch.value);
        }

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = originalTitle;
                input.blur();
            }
        });
    }

    // ─── Delete ───

    async function handleDeleteDocument(id) {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            await Storage.deleteDocument(id);
            if (currentDocId === id) {
                currentDocId = null;
                lastSavedContent = '';
            }
            renderDocumentList(docSearch.value);
        } catch (error) {
            console.error('Delete failed:', error);
        }
    }

    // ─── Search debounce ───

    let searchTimer = null;
    function handleDocSearch() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            renderDocumentList(docSearch.value.trim());
        }, 200);
    }

    // ─── Event Binding ───

    function bindEvents() {
        // Editor
        editor.addEventListener('input', handleEditorInput);

        // Download
        downloadButton.addEventListener('click', handleDownload);

        // Tabs
        tabEdit.addEventListener('click', () => switchTab('edit'));
        tabPreview.addEventListener('click', () => switchTab('preview'));

        // Tab key support
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
                handleEditorInput();
            }
        });

        // Header buttons
        documentsBtn.addEventListener('click', openSidebar);
        saveBtn.addEventListener('click', openSaveModal);

        // Sidebar
        sidebarClose.addEventListener('click', closeSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);
        docSearch.addEventListener('input', handleDocSearch);
        newDocBtn.addEventListener('click', requestNewDocument);

        // Document list event delegation
        docList.addEventListener('click', async (e) => {
            const renameBtn = e.target.closest('.doc-action-btn.rename');
            if (renameBtn) {
                e.stopPropagation();
                const id = Number(renameBtn.dataset.id);
                const li = renameBtn.closest('.doc-list-item');
                const docs = await Storage.getAllDocuments();
                const doc = docs.find(d => d.id === id);
                if (doc && li) startRename(li, doc);
                return;
            }

            const deleteBtn = e.target.closest('.doc-action-btn.delete');
            if (deleteBtn) {
                e.stopPropagation();
                const id = Number(deleteBtn.dataset.id);
                handleDeleteDocument(id);
                return;
            }

            const itemInfo = e.target.closest('.doc-list-item-info');
            if (itemInfo) {
                const li = itemInfo.closest('.doc-list-item');
                const id = Number(li.dataset.id);
                const docs = await Storage.getAllDocuments();
                const doc = docs.find(d => d.id === id);
                if (doc) requestOpenDocument(doc);
                return;
            }
        });

        // Save modal
        saveModalClose.addEventListener('click', closeSaveModal);
        saveModalCancel.addEventListener('click', closeSaveModal);
        saveModalConfirm.addEventListener('click', handleSaveConfirm);
        docTitleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSaveConfirm();
            if (e.key === 'Escape') closeSaveModal();
        });

        // Confirm modal
        confirmSave.addEventListener('click', handleConfirmSave);
        confirmDiscard.addEventListener('click', handleConfirmDiscard);
        confirmCancel.addEventListener('click', handleConfirmCancel);

        // Keyboard shortcut: Ctrl/Cmd+S to save
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                openSaveModal();
            }
        });
    }

    // ─── Load Content ───

    async function loadContent() {
        const savedContent = await Storage.load();

        if (savedContent) {
            editor.value = savedContent;
        } else {
            editor.value = sampleMarkdown;
        }
        lastSavedContent = editor.value;
    }

    // ─── Init ───

    async function init() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        if (!initElements()) return;

        // Initialize IndexedDB
        await Storage.init();

        bindEvents();
        await loadContent();
        await updatePreview();

        console.info('Markdown to HTML initialized');
    }

    return { init };
})();

App.init();
