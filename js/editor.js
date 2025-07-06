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
        return new Promise(async (resolve) => {
            // We wrap the editor initialization in requestAnimationFrame to ensure the DOM
            // is fully painted and stable. This can help prevent the benign 'ResizeObserver'
            // warning from the Toast UI library in some complex layouts.
            requestAnimationFrame(async () => {
                const Editor = toastui.Editor;
                
                // Check if this is the user's first visit
                const hasVisitedBefore = localStorage.getItem('aiTextbookEditor_hasVisited');
                const isFirstTimeUser = !hasVisitedBefore;
                
                // For testing: uncomment the next line to force first-time user experience
                // localStorage.removeItem('aiTextbookEditor_hasVisited');
                
                console.log('Editor initialization:', { isFirstTimeUser, hasVisitedBefore });
                
                // Check for URL query parameters
                const urlParams = new URLSearchParams(window.location.search);
                const requestedFile = urlParams.get('file');
                
                // Determine initial content and edit type
                let initialContent = CONFIG.EDITOR.INITIAL_VALUE;
                let initialEditType = 'markdown'; // Default for returning users
                
                try {
                                    if (requestedFile) {
                    // User specified a file via URL parameter
                    console.log('Loading requested file:', requestedFile);
                    initialEditType = 'wysiwyg'; // Always use WYSIWYG for specific files
                    initialContent = await this.loadFileContent(requestedFile);
                    
                    // Ensure both bundled documents are available in IndexedDB
                    try {
                        const { KAI_PROFILE_MARKDOWN, QUICK_START_MARKDOWN } = await import('./kaiProfile.js');
                        
                        // Save Kai profile if it doesn't exist
                        const kaiProfileFile = await indexedDBService.getFile(CONFIG.EDITOR.KAI_PROFILE_FILE);
                        if (!kaiProfileFile) {
                            await indexedDBService.saveFile(CONFIG.EDITOR.KAI_PROFILE_FILE, KAI_PROFILE_MARKDOWN, 'welcome');
                            console.log('Kai profile saved to IndexedDB for URL parameter access');
                        }
                        
                        // Save quick start guide if it doesn't exist
                        const quickStartFile = await indexedDBService.getFile(CONFIG.EDITOR.QUICK_START_FILE);
                        if (!quickStartFile) {
                            await indexedDBService.saveFile(CONFIG.EDITOR.QUICK_START_FILE, QUICK_START_MARKDOWN, 'quick-start');
                            console.log('Quick start guide saved to IndexedDB for URL parameter access');
                        }
                    } catch (error) {
                        console.error('Error ensuring bundled documents are available:', error);
                    }
                } else if (isFirstTimeUser) {
                    // First-time user - show quick start guide
                    console.log('Loading quick start guide for first-time user');
                    initialEditType = 'wysiwyg';
                    initialContent = await this.loadQuickStartGuide();
                    localStorage.setItem('aiTextbookEditor_hasVisited', 'true');
                    
                    // Save both documents to IndexedDB for file system
                    try {
                        await indexedDBService.saveFile('quick-start.md', initialContent, 'quick-start');
                        console.log('Quick start guide saved to IndexedDB for file system');
                        
                        // Also save Kai profile
                        const { KAI_PROFILE_MARKDOWN } = await import('./kaiProfile.js');
                        await indexedDBService.saveFile(CONFIG.EDITOR.KAI_PROFILE_FILE, KAI_PROFILE_MARKDOWN, 'welcome');
                        console.log('Kai profile saved to IndexedDB for file system');
                    } catch (error) {
                        console.error('Error saving documents to IndexedDB:', error);
                    }
                }
                    
                    console.log('Initial content loaded, length:', initialContent.length);
                } catch (error) {
                    console.error('Error loading initial content:', error);
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
                
                // Make test method globally accessible for debugging
                window.testQuickStartGuide = () => this.testQuickStartGuide();

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
            
            // Check if it's one of our bundled documents
            if (fileName === CONFIG.EDITOR.KAI_PROFILE_FILE || fileName === CONFIG.EDITOR.QUICK_START_FILE) {
                console.log(`Loading bundled document: ${fileName}`);
                const { KAI_PROFILE_MARKDOWN, QUICK_START_MARKDOWN } = await import('./kaiProfile.js');
                
                if (fileName === CONFIG.EDITOR.KAI_PROFILE_FILE) {
                    const content = KAI_PROFILE_MARKDOWN;
                    await indexedDBService.saveFile(fileName, content, 'welcome');
                    return content;
                } else if (fileName === CONFIG.EDITOR.QUICK_START_FILE) {
                    const content = QUICK_START_MARKDOWN;
                    await indexedDBService.saveFile(fileName, content, 'quick-start');
                    return content;
                }
            }
            
            // If not a bundled document, try to fetch from server
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
            console.log('Loading quick start guide from kaiProfile.js');
            // Import the quick start guide from kaiProfile.js
            const { QUICK_START_MARKDOWN } = await import('./kaiProfile.js');
            console.log('Quick start guide content loaded, length:', QUICK_START_MARKDOWN.length);
            // Save to IndexedDB for future use
            await indexedDBService.saveFile(CONFIG.EDITOR.QUICK_START_FILE, QUICK_START_MARKDOWN, 'quick-start');
            console.log('Quick start guide saved to IndexedDB');
            return QUICK_START_MARKDOWN;
        } catch (error) {
            console.error('Error loading quick start guide:', error);
            console.log('Returning fallback content due to error');
            return CONFIG.EDITOR.INITIAL_VALUE;
        }
    }

    // Test method to manually load quick start guide
    async testQuickStartGuide() {
        console.log('Testing quick start guide loading...');
        const content = await this.loadQuickStartGuide();
        console.log('Quick start guide test result:', content.substring(0, 100) + '...');
        return content;
    }
}

// Create and export a singleton instance
export const editor = new Editor(); 