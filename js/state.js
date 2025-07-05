// Global state management for the AI Textbook Editor
export class AppState {
    constructor() {
        this.editor = null;
        this.directoryHandle = null;
        this.currentDirectoryName = null;
        this.currentFileHandle = null;
        this.activeFileElement = null;
        this.outlineUpdateTimeout = null;
    }

    // Editor state
    setEditor(editor) {
        this.editor = editor;
    }

    getEditor() {
        return this.editor;
    }

    // Directory state
    setDirectoryHandle(handle) {
        this.directoryHandle = handle;
    }

    getDirectoryHandle() {
        return this.directoryHandle;
    }

    setCurrentDirectoryName(name) {
        this.currentDirectoryName = name;
    }

    getCurrentDirectoryName() {
        return this.currentDirectoryName;
    }

    // File state
    setCurrentFileHandle(handle) {
        this.currentFileHandle = handle;
    }

    getCurrentFileHandle() {
        return this.currentFileHandle;
    }

    setActiveFileElement(element) {
        this.activeFileElement = element;
    }

    getActiveFileElement() {
        return this.activeFileElement;
    }

    // Outline state
    setOutlineUpdateTimeout(timeout) {
        this.outlineUpdateTimeout = timeout;
    }

    getOutlineUpdateTimeout() {
        return this.outlineUpdateTimeout;
    }

    // Utility methods
    hasDirectory() {
        return this.directoryHandle !== null;
    }

    hasCurrentFile() {
        return this.currentFileHandle !== null;
    }

    clearFileState() {
        this.currentFileHandle = null;
        this.activeFileElement = null;
    }
}

// Create and export a singleton instance
export const appState = new AppState(); 