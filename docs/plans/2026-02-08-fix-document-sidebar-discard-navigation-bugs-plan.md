---
title: Fix document sidebar discard/navigation bugs
type: fix
date: 2026-02-08
---

# Fix: Document sidebar discard/navigation bugs

## Overview

Documents 버튼을 눌러 이전 저장 데이터를 불러오고, 다른 컨텐츠로 이동한 뒤 Discard하는 플로우에서 여러 버그가 발견되었습니다.

## Bugs Found

### Bug 1: `closeConfirmModal()` sets `pendingOpenDoc = null` before `openPendingDoc()` can use it

**File:** `js/app.js:427-460`

`handleConfirmDiscard()` 호출 시:

```javascript
function handleConfirmDiscard() {
    closeConfirmModal();   // ← pendingOpenDoc = null 로 초기화됨
    openPendingDoc();      // ← pendingOpenDoc이 이미 null이므로 아무 동작 안 함
}
```

`closeConfirmModal()` 내부에서 `pendingOpenDoc = null`을 설정하기 때문에, 바로 뒤에 호출되는 `openPendingDoc()`은 `pendingOpenDoc`이 이미 `null`이 되어 문서를 열지 못합니다.

**동일한 문제가 `handleConfirmSave()`에도 존재합니다** (line 453-454):

```javascript
closeConfirmModal();   // ← pendingOpenDoc = null
openPendingDoc();      // ← 역시 아무 동작 안 함
```

저장은 성공하지만, 저장 후 대기 중인 문서로 전환이 되지 않습니다.

**Fix:** `openPendingDoc()`을 `closeConfirmModal()` 보다 먼저 호출하거나, `closeConfirmModal()`에서 `pendingOpenDoc = null`을 제거하고 `openPendingDoc()` 끝에서만 null 처리해야 합니다. `openPendingDoc()`은 이미 마지막에 `pendingOpenDoc = null`을 하고 있으므로, `closeConfirmModal()`에서 `pendingOpenDoc = null`을 제거하는 것이 가장 깔끔합니다.

### Bug 2: `loadDocument()`와 `resetToNewDocument()`가 `handleEditorInput()`을 호출하여 즉시 autosave를 트리거

**File:** `js/app.js:362-376`

```javascript
function loadDocument(doc) {
    editor.value = doc.content;
    currentDocId = doc.id;
    lastSavedContent = doc.content;
    closeSidebar();
    handleEditorInput();  // ← Storage.debouncedSave() 호출됨
}
```

`handleEditorInput()` 내부에서 `Storage.debouncedSave(editor.value)`가 호출되어, 문서를 불러오자마자 autosave가 트리거됩니다. 이는 의도된 동작일 수 있지만, autosave 슬롯은 단일 키(`current`)이므로 다른 문서를 열 때마다 autosave 내용이 덮어씌워집니다. 만약 사용자가 실수로 discard를 누른 경우, autosave에서 이전 내용을 복구할 수 없습니다.

**Fix:** `loadDocument()`와 `resetToNewDocument()`에서는 `handleEditorInput()` 대신 `debouncedUpdatePreview()`만 호출하여 프리뷰만 갱신하고, autosave는 사용자가 실제로 편집할 때만 트리거되도록 해야 합니다.

### Bug 3: `loadContent()` 초기화 시 `lastSavedContent`가 autosave 내용으로 설정되어, 실제 저장된 문서와 불일치

**File:** `js/app.js:608-617`

```javascript
async function loadContent() {
    const savedContent = await Storage.load();  // autosave에서 로드
    if (savedContent) {
        editor.value = savedContent;
    } else {
        editor.value = sampleMarkdown;
    }
    lastSavedContent = editor.value;  // autosave 내용이 "저장된 상태"로 간주됨
}
```

앱이 시작될 때 autosave 내용을 불러와서 `lastSavedContent`로 설정합니다. 이 경우:
- 사용자가 문서 A를 편집 중 (저장하지 않고) 브라우저를 닫음
- 다시 열면 autosave 내용이 로드됨
- `lastSavedContent = autosave_content`이므로, 변경사항이 없는 것으로 판단
- 다른 문서를 열면 unsaved changes 경고 없이 편집 중이던 내용이 사라짐

이것은 edge case이지만, autosave 복원 후에는 `hasUnsavedChanges()`가 항상 false를 반환하므로 보호되지 않습니다.

> **Status: Deferred** — This bug was identified but not fixed in this PR. Tracked as a known limitation.

### Bug 4 (Minor): `renderDocumentList`에서 `query`가 `undefined`로 전달될 때 falsy 처리

**File:** `js/app.js:244-248`

```javascript
async function renderDocumentList(query) {
    const docs = query
        ? await Storage.searchDocuments(query)
        : await Storage.getAllDocuments();
```

`openSidebar()`에서 `renderDocumentList()`를 인자 없이 호출하므로 `query`는 `undefined`입니다. 이는 동작하지만, `handleDocSearch()`에서 빈 문자열(`''`)을 전달하면 falsy로 처리되어 검색이 아닌 전체 목록을 보여줍니다. 이것은 사실상 올바른 동작이지만, 명시적이지 않습니다.

> **Status: Deferred** — This bug was identified but not fixed in this PR. Tracked as a known limitation.

## Acceptance Criteria

- [ ] Discard 버튼 클릭 시 대기 중인 문서가 정상적으로 열려야 함
- [ ] Save & Open 버튼 클릭 시 저장 후 대기 중인 문서로 전환되어야 함
- [ ] 문서 로드 시 불필요한 autosave 트리거가 발생하지 않아야 함

## MVP

### js/app.js — `closeConfirmModal()`에서 `pendingOpenDoc = null` 제거

```javascript
// Before (buggy)
function closeConfirmModal() {
    confirmModal.classList.add('hidden');
    pendingOpenDoc = null;  // ← 이 줄이 문제
}

// After (fixed)
function closeConfirmModal() {
    confirmModal.classList.add('hidden');
}
```

### js/app.js — `loadDocument()`와 `resetToNewDocument()`에서 preview만 갱신

```javascript
// Before
function loadDocument(doc) {
    editor.value = doc.content;
    currentDocId = doc.id;
    lastSavedContent = doc.content;
    closeSidebar();
    handleEditorInput();  // autosave + preview
}

// After
function loadDocument(doc) {
    editor.value = doc.content;
    currentDocId = doc.id;
    lastSavedContent = doc.content;
    closeSidebar();
    updatePreview();  // preview만 갱신, autosave 안 함
}
```

`resetToNewDocument()`도 동일하게 수정.

## References

- `js/app.js:427-460` — confirm modal / discard / save flow
- `js/app.js:362-376` — loadDocument / resetToNewDocument
- `js/app.js:608-617` — loadContent initialization
- `js/storage.js:107-117` — debouncedSave
