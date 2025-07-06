import { CONFIG } from './config.js';
import { appState } from './state.js';
import { ui } from './ui.js';
import { fileSystem } from './fileSystem.js';
import { indexedDBService } from './indexedDB.js';
import { exportToPDF } from './pdfExport.js';
import { exportToHTML } from './htmlExport.js';

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
                
                
                // Check for URL query parameters
                const urlParams = new URLSearchParams(window.location.search);
                const requestedFile = urlParams.get('file');
                
                // Determine initial content and edit type
                let initialContent = CONFIG.EDITOR.INITIAL_VALUE;
                let initialEditType = 'markdown'; // Default for returning users
                
                try {
                                    if (requestedFile) {
                    // User specified a file via URL parameter
                    initialEditType = 'wysiwyg'; // Always use WYSIWYG for specific files
                    initialContent = await this.loadFileContent(requestedFile);
                    
                    // Ensure both bundled documents are available in IndexedDB
                    try {
                        const { KAI_PROFILE_MARKDOWN, QUICK_START_MARKDOWN } = await import('./kaiProfile.js');
                        
                        // Save Kai profile if it doesn't exist
                        const kaiProfileFile = await indexedDBService.getFile(CONFIG.EDITOR.KAI_PROFILE_FILE);
                        if (!kaiProfileFile) {
                            await indexedDBService.saveFile(CONFIG.EDITOR.KAI_PROFILE_FILE, KAI_PROFILE_MARKDOWN, 'welcome');
                        }
                        
                        // Save quick start guide if it doesn't exist
                        const quickStartFile = await indexedDBService.getFile(CONFIG.EDITOR.QUICK_START_FILE);
                        if (!quickStartFile) {
                            await indexedDBService.saveFile(CONFIG.EDITOR.QUICK_START_FILE, QUICK_START_MARKDOWN, 'quick-start');
                        }
                    } catch (error) {
                        console.error('Error ensuring bundled documents are available:', error);
                    }
                } else if (isFirstTimeUser) {
                    // First-time user - show quick start guide
                    initialEditType = 'wysiwyg';
                    initialContent = await this.loadQuickStartGuide();
                    localStorage.setItem('aiTextbookEditor_hasVisited', 'true');
                    
                    // Save both documents to IndexedDB for file system
                    try {
                        await indexedDBService.saveFile('quick-start.md', initialContent, 'quick-start');
                        
                        // Also save Kai profile
                        const { KAI_PROFILE_MARKDOWN } = await import('./kaiProfile.js');
                        await indexedDBService.saveFile(CONFIG.EDITOR.KAI_PROFILE_FILE, KAI_PROFILE_MARKDOWN, 'welcome');
                    } catch (error) {
                        console.error('Error saving documents to IndexedDB:', error);
                    }
                }
                    
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
                            el: this.createDownloadDropdown()
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

    createDownloadDropdown() {
        const container = document.createElement('div');
        container.className = 'download-dropdown-container relative';
        
        // Create the main download button
        const button = document.createElement('button');
        button.className = 'tui-toolbar-icons download-file custom-small';
        button.title = 'Download File';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        
        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'download-dropdown bg-white border border-gray-300 rounded-md shadow-lg hidden';
        dropdown.innerHTML = `
            <div class="download-options-list py-1">
                <button class="download-option w-full text-left px-4 py-2 text-sm hover:bg-gray-100" data-format="md">
                    <i class="fas fa-file-code mr-2"></i>Download as .md
                </button>
                <button class="download-option w-full text-left px-4 py-2 text-sm hover:bg-gray-100" data-format="txt">
                    <i class="fas fa-file-alt mr-2"></i>Download as .txt
                </button>
                <button class="download-option w-full text-left px-4 py-2 text-sm hover:bg-gray-100" data-format="pdf">
                    <i class="fas fa-file-pdf mr-2"></i>Download as .pdf
                </button>
                <button class="download-option w-full text-left px-4 py-2 text-sm hover:bg-gray-100" data-format="html">
                    <i class="fas fa-file-code mr-2"></i>Download as .html
                </button>
            </div>
        `;
        
        // Add click handler to toggle dropdown
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        
        // Add click handlers for download options
        dropdown.addEventListener('click', async (e) => {
            const option = e.target.closest('.download-option');
            if (option && !option.disabled) {
                const format = option.dataset.format;
                if (format === 'pdf') {
                    // PDF export
                    if (window.jsPDF) {
                        const editor = appState.getEditor();
                        const content = editor ? editor.getMarkdown() : '';
                        const currentFileHandle = appState.getCurrentFileHandle();
                        let fileName = 'document';
                        if (currentFileHandle && currentFileHandle.name) {
                            fileName = currentFileHandle.name.replace(/\.[^/.]+$/, '');
                        }
                        await exportToPDF(content, fileName);
                        ui.showToast(`Downloaded: ${fileName}.pdf`);
                    } else {
                        ui.showToast('PDF export requires jsPDF. Please check your internet connection.', CONFIG.MESSAGE_TYPES.ERROR);
                    }
                } else if (format === 'html') {
                    // HTML export
                    const editor = appState.getEditor();
                    const content = editor ? editor.getMarkdown() : '';
                    const currentFileHandle = appState.getCurrentFileHandle();
                    let fileName = 'document';
                    if (currentFileHandle && currentFileHandle.name) {
                        fileName = currentFileHandle.name.replace(/\.[^/.]+$/, '');
                    }
                    await exportToHTML(content, fileName);
                    ui.showToast(`Downloaded: ${fileName}.html`);
                } else {
                    this.downloadFile(format);
                }
                dropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        container.appendChild(button);
        container.appendChild(dropdown);
        return container;
    }

    downloadFile(format) {
        const editor = appState.getEditor();
        if (!editor) return;
        
        const content = editor.getMarkdown();
        const currentFileHandle = appState.getCurrentFileHandle();
        let fileName = 'document';
        
        // Use current file name if available, otherwise use default
        if (currentFileHandle && currentFileHandle.name) {
            fileName = currentFileHandle.name.replace(/\.[^/.]+$/, ''); // Remove extension
        }
        
        // Add appropriate extension
        fileName += format === 'md' ? '.md' : '.txt';
        
        // Create blob and download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        ui.showToast(`Downloaded: ${fileName}`);
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
            // Import the quick start guide from kaiProfile.js
            const { QUICK_START_MARKDOWN } = await import('./kaiProfile.js');
            // Save to IndexedDB for future use
            await indexedDBService.saveFile(CONFIG.EDITOR.QUICK_START_FILE, QUICK_START_MARKDOWN, 'quick-start');
            return QUICK_START_MARKDOWN;
        } catch (error) {
            console.error('Error loading quick start guide:', error);
            console.log('Returning fallback content due to error');
            return CONFIG.EDITOR.INITIAL_VALUE;
        }
    }

    // Test method to manually load quick start guide
    async testQuickStartGuide() {
        const content = await this.loadQuickStartGuide();
        return content;
    }
}

// Create and export a singleton instance
export const editor = new Editor(); 