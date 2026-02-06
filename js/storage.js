/**
 * Storage Module
 * IndexedDB-based storage for autosave and document management
 */

const Storage = (function() {
    const DB_NAME = 'markdown-editor-db';
    const DB_VERSION = 1;
    const STORE_AUTOSAVE = 'autosave';
    const STORE_DOCUMENTS = 'documents';
    const AUTOSAVE_KEY = 'current';
    const DEBOUNCE_DELAY = 1000;

    let db = null;
    let saveTimeout = null;

    /**
     * Open IndexedDB connection and create stores if needed
     */
    function open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_AUTOSAVE)) {
                    database.createObjectStore(STORE_AUTOSAVE, { keyPath: 'id' });
                }

                if (!database.objectStoreNames.contains(STORE_DOCUMENTS)) {
                    const store = database.createObjectStore(STORE_DOCUMENTS, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Migrate existing localStorage data to IndexedDB autosave
     */
    async function migrateFromLocalStorage() {
        try {
            const oldKey = 'markdown-to-pdf-content';
            const oldContent = localStorage.getItem(oldKey);
            if (oldContent) {
                await autosaveSave(oldContent);
                localStorage.removeItem(oldKey);
            }
        } catch (e) {
            // localStorage may not be available, ignore
        }
    }

    // ─── Autosave ───

    /**
     * Save content to autosave store
     */
    function autosaveSave(content) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_AUTOSAVE, 'readwrite');
            const store = tx.objectStore(STORE_AUTOSAVE);
            store.put({
                id: AUTOSAVE_KEY,
                content: content,
                updatedAt: Date.now()
            });
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Load content from autosave store
     */
    function autosaveLoad() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_AUTOSAVE, 'readonly');
            const store = tx.objectStore(STORE_AUTOSAVE);
            const request = store.get(AUTOSAVE_KEY);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.content : '');
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Debounced autosave
     */
    function debouncedSave(content) {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            autosaveSave(content).catch((e) => {
                console.warn('Autosave failed:', e);
            });
            saveTimeout = null;
        }, DEBOUNCE_DELAY);
    }

    // ─── Documents CRUD ───

    /**
     * Save a new document
     */
    function saveDocument(title, content) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
            const store = tx.objectStore(STORE_DOCUMENTS);
            const now = Date.now();
            const request = store.add({
                title: title,
                content: content,
                createdAt: now,
                updatedAt: now
            });
            request.onsuccess = () => resolve(request.result); // returns id
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Update an existing document
     */
    function updateDocument(id, title, content) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
            const store = tx.objectStore(STORE_DOCUMENTS);
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const doc = getRequest.result;
                if (!doc) {
                    reject(new Error('Document not found'));
                    return;
                }
                doc.title = title;
                doc.content = content;
                doc.updatedAt = Date.now();
                store.put(doc);
            };
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Get a single document by id
     */
    function getDocument(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
            const store = tx.objectStore(STORE_DOCUMENTS);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Get all documents sorted by updatedAt descending
     */
    function getAllDocuments() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
            const store = tx.objectStore(STORE_DOCUMENTS);
            const request = store.getAll();
            request.onsuccess = () => {
                const docs = request.result || [];
                docs.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(docs);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Delete a document by id
     */
    function deleteDocument(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
            const store = tx.objectStore(STORE_DOCUMENTS);
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Rename a document
     */
    function renameDocument(id, newTitle) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
            const store = tx.objectStore(STORE_DOCUMENTS);
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const doc = getRequest.result;
                if (!doc) {
                    reject(new Error('Document not found'));
                    return;
                }
                doc.title = newTitle;
                doc.updatedAt = Date.now();
                store.put(doc);
            };
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Search documents by title (case-insensitive partial match)
     */
    function searchDocuments(query) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
            const store = tx.objectStore(STORE_DOCUMENTS);
            const request = store.getAll();
            request.onsuccess = () => {
                const docs = request.result || [];
                const lowerQuery = query.toLowerCase();
                const filtered = docs.filter(
                    (doc) => doc.title.toLowerCase().includes(lowerQuery)
                );
                filtered.sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(filtered);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Initialize storage: open DB and migrate old data
     */
    async function init() {
        await open();
        await migrateFromLocalStorage();
    }

    // Public API
    return {
        init,
        // Autosave
        load: autosaveLoad,
        debouncedSave,
        // Documents
        saveDocument,
        updateDocument,
        getDocument,
        getAllDocuments,
        deleteDocument,
        renameDocument,
        searchDocuments
    };
})();
