import { CONFIG } from './config.js';
import { appState } from './state.js';
import { ui } from './ui.js';
import { fileSystem } from './fileSystem.js';
import { indexedDBService } from './indexedDB.js';

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
            requestAnimationFrame(async () => {
                const Editor = toastui.Editor;
                
                // Check if this is the user's first visit
                const hasVisitedBefore = localStorage.getItem('aiTextbookEditor_hasVisited');
                const isFirstTimeUser = !hasVisitedBefore;
                
                // Check for URL query parameters
                const urlParams = new URLSearchParams(window.location.search);
                const requestedFile = urlParams.get('file');
                
                // Determine initial content and edit type
                let initialContent = CONFIG.EDITOR.INITIAL_VALUE;
                let initialEditType = 'markdown'; // Default for returning users
                
                if (requestedFile) {
                    // User specified a file via URL parameter
                    initialEditType = 'wysiwyg'; // Always use WYSIWYG for specific files
                    initialContent = await this.loadFileContent(requestedFile);
                } else if (isFirstTimeUser) {
                    // First-time user - show quick start guide
                    initialEditType = 'wysiwyg';
                    initialContent = await this.loadQuickStartGuide();
                    localStorage.setItem('aiTextbookEditor_hasVisited', 'true');
                }
                
                this.editor = new Editor({
                    el: document.querySelector('#editor'),
                    height: '100%',
                    initialEditType: initialEditType,
                    previewStyle: 'vertical',
                    initialValue: initialContent,
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

        // Make links clickable in WYSIWYG mode
        this.setupLinkClickHandler();
    }

    // Setup link click handler for WYSIWYG mode
    setupLinkClickHandler() {
        const editorElement = document.querySelector('#editor');
        if (!editorElement) return;

        // Use event delegation to handle link clicks
        editorElement.addEventListener('click', (event) => {
            const target = event.target;
            
            // Check if the clicked element is a link
            if (target.tagName === 'A' && target.href) {
                // Prevent default behavior (which would just select the link)
                event.preventDefault();
                event.stopPropagation();
                
                // Open link in new tab
                window.open(target.href, '_blank', 'noopener,noreferrer');
            }
        });

        // Also handle Ctrl+Click for opening links in new tab
        editorElement.addEventListener('mousedown', (event) => {
            const target = event.target;
            
            if (target.tagName === 'A' && target.href && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                event.stopPropagation();
                
                // Open link in new tab
                window.open(target.href, '_blank', 'noopener,noreferrer');
            }
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

    // Load file content from URL parameter
    async loadFileContent(fileName) {
        try {
            // First try to get from IndexedDB
            const savedFile = await indexedDBService.getFile(fileName);
            if (savedFile) {
                return savedFile.content;
            }
            
            // If not in IndexedDB, try to fetch from server
            const response = await fetch(fileName);
            if (response.ok) {
                const content = await response.text();
                // Save to IndexedDB for future use
                await indexedDBService.saveFile(fileName, content, 'url-param');
                return content;
            }
            
            // Fallback to default content
            return `# ${fileName}\n\nFile not found. Start writing your content here...`;
        } catch (error) {
            console.error('Error loading file:', error);
            return `# ${fileName}\n\nError loading file. Start writing your content here...`;
        }
    }

    // Load quick start guide content
    async loadQuickStartGuide() {
        try {
            // Try to fetch the quick-start.md file
            const response = await fetch(CONFIG.EDITOR.QUICK_START_FILE);
            if (response.ok) {
                const content = await response.text();
                // Save to IndexedDB for future use
                await indexedDBService.saveFile(CONFIG.EDITOR.QUICK_START_FILE, content, 'quick-start');
                return content;
            }
            
            // Fallback content if file not found
            return `# Quick Start Guide - AI Textbook Editor

Welcome to your **AI-First Textbook Editor**! This is a local-first, privacy-focused document editor that runs entirely in your browser.

## 🚀 Getting Started

### First Steps
1. **Start Writing**: Just begin typing in the editor - your content is automatically saved locally
2. **Switch Modes**: Use the tabs at the top to switch between Markdown and WYSIWYG editing
3. **AI Assistant**: Click the chat icon in the sidebar to get AI help with your writing

### Key Features

#### 📁 File Management
- **Open Folder**: Click the folder icon to open a directory of markdown files
- **New File**: Create new documents with the + icon
- **Save File**: Download your work as a markdown file
- **Auto-Save**: Your work is automatically saved locally in your browser

#### 🤖 AI Integration
- **Smart Assistance**: Get help with writing, editing, and formatting
- **Knowledge Base**: The AI can reference your other documents for context
- **Perfect Markdown**: AI responses are formatted in clean markdown

---

**Ready to start writing?** Just begin typing below or use the AI assistant to help you get started!`;
        } catch (error) {
            console.error('Error loading quick start guide:', error);
            return CONFIG.EDITOR.INITIAL_VALUE;
        }
    }
}

// Create and export a singleton instance
export const editor = new Editor(); 