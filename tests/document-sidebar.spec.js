const { test, expect } = require('@playwright/test');

// Helper: save a document via the UI (type content, click Save, enter title, confirm)
async function saveDocumentViaUI(page, title, content) {
  const editor = page.locator('#editor');
  await editor.fill(content);

  // Wait for preview to update so the title suggestion works
  await page.waitForTimeout(400);

  await page.locator('#save-btn').click();
  await expect(page.locator('#save-modal')).not.toHaveClass(/hidden/);

  await page.locator('#doc-title-input').fill(title);
  await page.locator('#save-modal-confirm').click();

  // Wait for modal to close (save complete)
  await expect(page.locator('#save-modal')).toHaveClass(/hidden/);
}

// Helper: start a new document via the sidebar (resets currentDocId)
async function startNewDocument(page) {
  await page.locator('#documents-btn').click();
  await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/);
  await page.locator('#new-doc-btn').click();
  // Sidebar closes after new document is created
  await expect(page.locator('#sidebar')).toHaveClass(/hidden/);
}

test.describe('Document Sidebar — Unsaved Changes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app, then clear IndexedDB stores and reload for clean state
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('markdown-editor-db', 1);
        req.onsuccess = () => {
          const db = req.result;
          const storeNames = Array.from(db.objectStoreNames);
          if (storeNames.length === 0) { db.close(); resolve(); return; }
          const tx = db.transaction(storeNames, 'readwrite');
          storeNames.forEach(name => tx.objectStore(name).clear());
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
    });
    await page.reload();
    await page.waitForFunction(() => {
      const editor = document.getElementById('editor');
      return editor && editor.value.length > 0;
    });
  });

  test('Discard navigates to new empty document', async ({ page }) => {
    // 1. Save a document
    await saveDocumentViaUI(page, 'My Test Doc', '# Hello World\n\nSome content here.');

    // 2. Modify editor to create unsaved changes
    const editor = page.locator('#editor');
    await editor.fill('# Hello World\n\nSome content here.\n\nExtra unsaved line.');

    // 3. Open sidebar and click New Document
    await page.locator('#documents-btn').click();
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/);
    await page.locator('#new-doc-btn').click();

    // 4. Unsaved Changes modal should appear — click Discard
    await expect(page.locator('#confirm-modal')).not.toHaveClass(/hidden/);
    await page.locator('#confirm-discard').click();

    // 5. Verify: editor should be empty
    await expect(editor).toHaveValue('');
  });

  test('Discard switches to another saved document', async ({ page }) => {
    const content1 = '# Document One\n\nContent of document one.';
    const content2 = '# Document Two\n\nContent of document two.';

    // 1. Save two documents (reset to new between saves so each gets its own id)
    await saveDocumentViaUI(page, 'Test Document 1', content1);
    await startNewDocument(page);
    await saveDocumentViaUI(page, 'Test Document 2', content2);

    // 2. Modify current editor (currently has content2) to create unsaved changes
    const editor = page.locator('#editor');
    await editor.fill(content2 + '\n\nUnsaved edit.');

    // 3. Open sidebar and click on Test Document 1
    await page.locator('#documents-btn').click();
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/);
    await page.locator('.doc-list-item-title', { hasText: 'Test Document 1' }).click();

    // 4. Unsaved Changes modal should appear — click Discard
    await expect(page.locator('#confirm-modal')).not.toHaveClass(/hidden/);
    await page.locator('#confirm-discard').click();

    // 5. Verify: editor should have Test Document 1 content
    await expect(editor).toHaveValue(content1);
  });

  test('Save & Open saves current and switches to another document', async ({ page }) => {
    const content1 = '# Document One\n\nContent of document one.';
    const content2 = '# Document Two\n\nContent of document two.';

    // 1. Save two documents (reset to new between saves so each gets its own id)
    await saveDocumentViaUI(page, 'Test Document 1', content1);
    await startNewDocument(page);
    await saveDocumentViaUI(page, 'Test Document 2', content2);

    // 2. Open Test Document 1 first (no unsaved changes since we just saved doc2)
    const editor = page.locator('#editor');
    await page.locator('#documents-btn').click();
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/);
    await page.locator('.doc-list-item-title', { hasText: 'Test Document 1' }).click();
    await expect(editor).toHaveValue(content1);

    // 3. Modify Test Document 1 to create unsaved changes
    const modifiedContent1 = content1 + '\n\nModified content.';
    await editor.fill(modifiedContent1);

    // 4. Open sidebar and click on Test Document 2
    await page.locator('#documents-btn').click();
    await expect(page.locator('#sidebar')).not.toHaveClass(/hidden/);
    await page.locator('.doc-list-item-title', { hasText: 'Test Document 2' }).click();

    // 5. Unsaved Changes modal should appear — click Save & Open
    await expect(page.locator('#confirm-modal')).not.toHaveClass(/hidden/);
    await page.locator('#confirm-save').click();

    // 6. Verify: editor should have Test Document 2 content
    await expect(editor).toHaveValue(content2);
  });
});
