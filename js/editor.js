import { CONFIG } from './config.js';
import { appState } from './state.js';
import { ui } from './ui.js';
import { fileSystem } from './fileSystem.js';

// Make appState globally accessible for AI chat
window.appState = appState;

// Editor management for the AI Textbook Editor
export class Editor {
    constructor() {
        this.editor = null;
    }

    // Initialize the Toast UI Editor
    async initialize() {
        return new Promise((resolve) => {
            // We wrap the editor initialization in requestAnimationFrame to ensure the DOM
            // is fully painted and stable. This can help prevent the benign 'ResizeObserver'
            // warning from the Toast UI library in some complex layouts.
            requestAnimationFrame(() => {
                const Editor = toastui.Editor;
                
                // Check if this is the user's first visit
                const hasVisitedBefore = localStorage.getItem('aiTextbookEditor_hasVisited');
                const isFirstTimeUser = !hasVisitedBefore;
                
                // Set initial edit type: WYSIWYG for first-time users, markdown for returning users
                const initialEditType = isFirstTimeUser ? 'wysiwyg' : 'markdown';
                
                // Mark that the user has now visited
                if (isFirstTimeUser) {
                    localStorage.setItem('aiTextbookEditor_hasVisited', 'true');
                }
                
                this.editor = new Editor({
                    el: document.querySelector('#editor'),
                    height: '100%',
                    initialEditType: initialEditType,
                    previewStyle: 'vertical',
                    initialValue: CONFIG.EDITOR.INITIAL_VALUE,
                    usageStatistics: false,
                    toolbarItems: [
                        ['heading', 'bold', 'italic', 'strike'],
                        ['hr', 'quote'],
                        ['ul', 'ol', 'task', 'indent', 'outdent'],
                        ['table', 'image', 'link'],
                        ['code', 'codeblock'],
                        [{
                            el: this.createButton('open-folder', 'Open Folder', () => fileSystem.openFolder())
                        }, {
                            el: this.createButton('new-file', 'New File', () => fileSystem.createNewFileDialog())
                        }, {
                            el: this.createButton('download-file', 'Save File', () => fileSystem.saveFile())
                        }]
                    ]
                });

                // Store editor in global state and window
                appState.setEditor(this.editor);
                window.editorInstance = this.editor;

                // Add custom toolbar items
                this.addCustomToolbarItems();

                // Set up editor event listeners
                this.setupEventListeners();

                // Initial outline generation after editor is ready
                ui.updateOutline();

                resolve(this.editor);
            });
        });
    }

    createButton(className, tooltip, onClick) {
        const button = document.createElement('button');
        button.className = `tui-toolbar-icons ${className} custom-small`;
        button.title = tooltip;
        button.addEventListener('click', onClick);
        return button;
    }

    addCustomToolbarItems() {
        setTimeout(() => fileSystem.updateSaveButtonState(true, false), 100);
    }

    // Set up editor event listeners
    setupEventListeners() {
        // Debounced outline update on editor change
        this.editor.on('change', () => {
            // Mark file as changed for save button and auto-save to IndexedDB
            fileSystem.markFileAsChanged();
            
            // Debounce the updateOutline function call for performance
            ui.debouncedUpdateOutline();
        });
    }

    // Get the editor instance
    getEditor() {
        return this.editor;
    }

    // Set markdown content
    setMarkdown(content) {
        if (this.editor) {
            this.editor.setMarkdown(content);
        }
    }

    // Get markdown content
    getMarkdown() {
        if (this.editor) {
            return this.editor.getMarkdown();
        }
        return '';
    }

    // Focus the editor
    focus() {
        if (this.editor) {
            this.editor.focus();
        }
    }

    // Set selection in the editor
    setSelection(start, end) {
        if (this.editor) {
            this.editor.setSelection(start, end);
        }
    }
}

// Create and export a singleton instance
export const editor = new Editor(); 