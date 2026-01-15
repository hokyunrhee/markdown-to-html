/**
 * Storage Module
 * Handles LocalStorage auto-save and restore functionality
 */

const Storage = (function() {
    const STORAGE_KEY = 'markdown-to-pdf-content';
    const DEBOUNCE_DELAY = 1000; // 1 second
    
    let saveTimeout = null;
    
    /**
     * Save content to LocalStorage
     */
    function save(content) {
        try {
            localStorage.setItem(STORAGE_KEY, content);
            return true;
        } catch (e) {
            console.warn('Failed to save to LocalStorage:', e);
            return false;
        }
    }
    
    /**
     * Load content from LocalStorage
     */
    function load() {
        try {
            return localStorage.getItem(STORAGE_KEY) || '';
        } catch (e) {
            console.warn('Failed to load from LocalStorage:', e);
            return '';
        }
    }
    
    /**
     * Debounced save - saves content after a delay
     * Cancels previous pending save if called again
     */
    function debouncedSave(content) {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        saveTimeout = setTimeout(() => {
            save(content);
            saveTimeout = null;
        }, DEBOUNCE_DELAY);
    }
    
    // Public API
    return {
        save,
        load,
        debouncedSave
    };
})();
