import { CONFIG } from './config.js';
import { appState } from './state.js';
import { ui } from './ui.js';
import { indexedDBService } from './indexedDB.js';

// File system operations for the AI Textbook Editor
export class FileSystem {
    constructor() {
        this.fileList = document.getElementById('file-list');
    }

    // Open folder using File System Access API
    async openFolder() {
        try {
            const directoryHandle = await window.showDirectoryPicker();
            appState.setDirectoryHandle(directoryHandle);
            appState.setCurrentDirectoryName(directoryHandle.name);
            ui.updateStatus(`Folder: ${directoryHandle.name}`);
            
            // Initialize IndexedDB and load saved files
            await indexedDBService.initialize();
            await this.loadSavedFiles(directoryHandle.name);
            await this.populateFileList();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error opening directory:', err);
                ui.showToast('Could not open directory due to security restrictions.', CONFIG.MESSAGE_TYPES.ERROR);
            }
        }
    }

    // Populate the file list with markdown files
    async populateFileList() {
        const directoryHandle = appState.getDirectoryHandle();
        const directoryName = appState.getCurrentDirectoryName();
        
        // Always try to load from IndexedDB, even if no directory is open
        if (!directoryHandle && !directoryName) {
            // Try to load from default unsaved directory
            await this.loadUnsavedFiles();
            return;
        }
        
        this.fileList.innerHTML = ''; 
        let foundFiles = false;
        const fileSet = new Set(); // To avoid duplicates
        
        // Add files from file system
        if (directoryHandle) {
            for await (const entry of directoryHandle.values()) {
                if (entry.kind === 'file' && this.isMarkdownFile(entry.name)) {
                    foundFiles = true;
                    fileSet.add(entry.name);
                    const li = this.createFileListItem(entry.name, 'filesystem', false);
                    this.fileList.appendChild(li);
                }
            }
        }
        
        // Add files from IndexedDB
        if (directoryName) {
            try {
                const savedFiles = await indexedDBService.getFilesByDirectory(directoryName);
                for (const savedFile of savedFiles) {
                    if (!fileSet.has(savedFile.fileName)) {
                        foundFiles = true;
                        fileSet.add(savedFile.fileName);
                        const li = this.createFileListItem(savedFile.fileName, 'indexeddb', true);
                        this.fileList.appendChild(li);
                    }
                }
            } catch (err) {
                console.error('Error loading saved files:', err);
            }
        }
        
        if (!foundFiles) {
            this.fileList.innerHTML = '<li class="text-gray-400 text-sm p-2">No Markdown files found.</li>';
        }
    }

    // Check if file is a markdown file
    isMarkdownFile(fileName) {
        return CONFIG.FILE_SYSTEM.SUPPORTED_EXTENSIONS.some(ext => 
            fileName.toLowerCase().endsWith(ext)
        );
    }

    // Open a specific file
    async openFile(fileName, fileElement) {
        try {
            // First try to get the file from IndexedDB
            const savedFile = await indexedDBService.getFile(fileName);
            let content;
            
            if (savedFile) {
                // Use saved content from IndexedDB
                content = savedFile.content;
                console.log(`Loaded file from IndexedDB: ${fileName}`);
            } else {
                // Fall back to reading from file system if directory handle exists
                const directoryHandle = appState.getDirectoryHandle();
                if (directoryHandle) {
                    const fileHandle = await directoryHandle.getFileHandle(fileName);
                    const file = await fileHandle.getFile();
                    content = await file.text();
                    
                    // Save to IndexedDB for future use
                    const directoryName = appState.getCurrentDirectoryName();
                    await indexedDBService.saveFile(fileName, content, directoryName);
                } else {
                    ui.showToast(`Could not open file: ${fileName}`, CONFIG.MESSAGE_TYPES.ERROR);
                    return;
                }
            }
            
            const editor = appState.getEditor();
            editor.setMarkdown(content);
            ui.updateStatus(`Editing: ${fileName}`);
            
            // Update active file element
            const activeFileElement = appState.getActiveFileElement();
            if (activeFileElement) activeFileElement.classList.remove('active');
            appState.setActiveFileElement(fileElement);
            fileElement.classList.add('active');

            // Update file state - always create virtual file handle for IndexedDB files
            appState.setCurrentFileHandle({ name: fileName });
            this.updateSaveButtonState(false, false);
            
            // Update outline for the new file
            ui.updateOutline();
            
        } catch (err) {
            console.error('Error opening file:', err);
            ui.showToast(`Could not open file: ${fileName}`, CONFIG.MESSAGE_TYPES.ERROR);
            appState.clearFileState();
            this.updateSaveButtonState(true, false);
        }
    }

    // Save the current file
    async saveFile() {
        const currentFileHandle = appState.getCurrentFileHandle();
        if (!currentFileHandle) return;
        
        try {
            const editor = appState.getEditor();
            const content = editor.getMarkdown();
            const fileName = currentFileHandle.name;
            const directoryName = appState.getCurrentDirectoryName();
            
            // Save to file system if we have a real file handle
            if (currentFileHandle.createWritable) {
                const writable = await currentFileHandle.createWritable();
                await writable.write(content);
                await writable.close();
            }
            
            // Always save to IndexedDB
            await indexedDBService.saveFile(fileName, content, directoryName);
            
            this.updateSaveButtonState(false, false);
            ui.showToast(`Saved: ${fileName}`);
            
        } catch (err) {
            console.error('Error saving file:', err);
            ui.showToast(`Error saving file: ${currentFileHandle.name}`, CONFIG.MESSAGE_TYPES.ERROR);
        }
    }

    // Update save button state
    updateSaveButtonState(disabled, hasChanges = false) {
        const editor = appState.getEditor();
        if (!editor) return;
        // Find the save button in the toolbar
        const elements = editor.getEditorElements();
        if (!elements || !elements.toolbar) return;
        const toolbar = elements.toolbar;
        const saveButton = toolbar.querySelector('.tui-toolbar-icons.save-file');
        if (!saveButton) return;
        if (disabled) {
            saveButton.style.opacity = '0.3';
            saveButton.style.cursor = 'not-allowed';
        } else {
            saveButton.style.opacity = '0.85';
            saveButton.style.cursor = 'pointer';
        }
        if (hasChanges) {
            saveButton.classList.add('has-changes');
        } else {
            saveButton.classList.remove('has-changes');
        }
    }

    // Mark file as changed (called from editor change event)
    markFileAsChanged() {
        if (appState.hasCurrentFile()) {
            this.updateSaveButtonState(false, true);
            // Also save current content to IndexedDB
            this.saveCurrentContentToIndexedDB();
        }
    }

    // Save current editor content to IndexedDB
    async saveCurrentContentToIndexedDB() {
        const currentFileHandle = appState.getCurrentFileHandle();
        if (!currentFileHandle) return;
        
        try {
            const editor = appState.getEditor();
            const content = editor.getMarkdown();
            const fileName = currentFileHandle.name;
            const directoryName = appState.getCurrentDirectoryName();
            
            await indexedDBService.saveFile(fileName, content, directoryName);
            console.log(`Auto-saved to IndexedDB: ${fileName}`);
        } catch (err) {
            console.error('Error auto-saving to IndexedDB:', err);
        }
    }

    // Load saved files from IndexedDB for a directory
    async loadSavedFiles(directoryName) {
        try {
            const savedFiles = await indexedDBService.getFilesByDirectory(directoryName);
            console.log(`Loaded ${savedFiles.length} saved files for directory: ${directoryName}`);
            return savedFiles;
        } catch (err) {
            console.error('Error loading saved files from IndexedDB:', err);
            return [];
        }
    }

    // Load unsaved files from IndexedDB
    async loadUnsavedFiles() {
        try {
            const savedFiles = await indexedDBService.getFilesByDirectory('unsaved_documents');
            this.fileList.innerHTML = '';
            
            if (savedFiles.length === 0) {
                this.fileList.innerHTML = '<li class="text-gray-400 text-sm p-2">No saved files found. Create a new file to get started.</li>';
                return;
            }
            
            for (const savedFile of savedFiles) {
                const li = this.createFileListItem(savedFile.fileName, 'indexeddb', true);
                this.fileList.appendChild(li);
            }
            
            console.log(`Loaded ${savedFiles.length} unsaved files from IndexedDB`);
        } catch (err) {
            console.error('Error loading unsaved files:', err);
            this.fileList.innerHTML = '<li class="text-gray-400 text-sm p-2">Error loading saved files.</li>';
        }
    }

    // Create a new file and save to IndexedDB
    async createNewFile(fileName, content = '') {
        let directoryName = appState.getCurrentDirectoryName();
        
        // If no directory is open, use a default "unsaved" directory
        if (!directoryName) {
            directoryName = 'unsaved_documents';
            appState.setCurrentDirectoryName(directoryName);
        }

        try {
            // Save to IndexedDB
            await indexedDBService.saveFile(fileName, content, directoryName);
            
            // Create virtual file handle
            const virtualFileHandle = { name: fileName };
            appState.setCurrentFileHandle(virtualFileHandle);
            
            // Set content in editor
            const editor = appState.getEditor();
            editor.setMarkdown(content);
            
            // Update UI
            ui.updateStatus(`Editing: ${fileName}`);
            this.updateSaveButtonState(false, false);
            ui.updateOutline();
            
            // Add to file list immediately
            await this.populateFileList();
            
            ui.showToast(`Created new file: ${fileName}`);
            
        } catch (err) {
            console.error('Error creating new file:', err);
            ui.showToast(`Error creating file: ${fileName}`, CONFIG.MESSAGE_TYPES.ERROR);
        }
    }

    // Show dialog to create a new file
    createNewFileDialog() {
        const fileName = prompt('Enter file name (with .md extension):');
        if (fileName) {
            if (!fileName.toLowerCase().endsWith('.md')) {
                ui.showToast('File name must end with .md', CONFIG.MESSAGE_TYPES.ERROR);
                return;
            }
            
            // Check if file already exists
            const existingFiles = Array.from(this.fileList.children).map(li => li.dataset.fileName);
            if (existingFiles.includes(fileName)) {
                ui.showToast('File already exists', CONFIG.MESSAGE_TYPES.ERROR);
                return;
            }
            
            this.createNewFile(fileName, `# ${fileName.replace('.md', '')}\n\nStart writing here...`);
        }
    }

    // Handle first-time user experience
    async handleFirstTimeUser() {
        try {
            console.log('Starting first-time user experience...');
            
            // Import the Kai profile markdown
            const { KAI_PROFILE_MARKDOWN } = await import('./kaiProfile.js');
            console.log('Kai profile markdown imported successfully');
            
            // Save the Kai profile as the initial file
            const fileName = 'about-kai-kleinbard.md';
            const directoryName = 'welcome';
            
            await indexedDBService.saveFile(fileName, KAI_PROFILE_MARKDOWN, directoryName);
            console.log('Kai profile saved to IndexedDB');
            
            // Set the current directory name for the welcome files
            appState.setCurrentDirectoryName(directoryName);
            
            // Load the file into the editor
            const editor = appState.getEditor();
            editor.setMarkdown(KAI_PROFILE_MARKDOWN);
            console.log('Kai profile loaded into editor');
            
            // Update UI
            ui.updateStatus(`Welcome! Editing: ${fileName}`);
            ui.showToast('Welcome to the AI Textbook Editor! Here\'s a bit about me, Kai Kleinbard.', CONFIG.MESSAGE_TYPES.SUCCESS);
            
            // Update file list to show the new file
            await this.populateFileList();
            
            // Set up the file as the current file (virtual file handle)
            appState.setCurrentFileHandle({ name: fileName });
            this.updateSaveButtonState(false, false);
            
            console.log('First-time user experience completed');
            
        } catch (error) {
            console.error('Error handling first-time user:', error);
            ui.showToast('Error setting up welcome file', CONFIG.MESSAGE_TYPES.ERROR);
        }
    }

    // Load the last edited file or handle first-time user
    async loadLastEditedFile() {
        try {
            const isFirstTime = await indexedDBService.isFirstTimeUser();
            
            if (isFirstTime) {
                // Handle first-time user
                await this.handleFirstTimeUser();
            } else {
                // Load the most recently edited file
                const lastFile = await indexedDBService.getLastEditedFile();
                
                if (lastFile) {
                    // Set the directory name
                    appState.setCurrentDirectoryName(lastFile.directoryName);
                    
                    // Load the file into the editor
                    const editor = appState.getEditor();
                    editor.setMarkdown(lastFile.content);
                    
                    // Update UI
                    ui.updateStatus(`Editing: ${lastFile.fileName}`);
                    
                    // Update file list
                    await this.populateFileList();
                    
                    // Set up the file as the current file
                    appState.setCurrentFileHandle({ name: lastFile.fileName });
                    this.updateSaveButtonState(false, false);
                    
                    console.log(`Loaded last edited file: ${lastFile.fileName}`);
                } else {
                    // No files found, show empty editor
                    ui.updateStatus('No files found. Create a new file or open a folder.');
                }
            }
        } catch (error) {
            console.error('Error loading last edited file:', error);
            ui.showToast('Error loading last edited file', CONFIG.MESSAGE_TYPES.ERROR);
        }
    }

    // Create file list item with hover controls
    createFileListItem(fileName, source, isSaved) {
        const li = document.createElement('li');
        li.className = 'list-item p-2 rounded-md text-sm relative group cursor-pointer';
        li.dataset.fileName = fileName;
        li.dataset.source = source;
        
        // File name container
        const nameContainer = document.createElement('div');
        nameContainer.className = 'flex items-center justify-between';
        
        // File name span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = isSaved ? `${fileName} (saved)` : fileName;
        nameSpan.className = isSaved ? 'text-blue-600' : '';
        nameContainer.appendChild(nameSpan);
        
        // Controls container (hidden by default)
        const controls = document.createElement('div');
        controls.className = 'hidden group-hover:flex items-center space-x-1';
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit text-gray-500 hover:text-blue-600"></i>';
        editBtn.className = 'p-1 hover:bg-gray-100 rounded';
        editBtn.title = 'Rename file';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startRename(li, nameSpan, fileName);
        });
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-times text-gray-500 hover:text-red-600"></i>';
        deleteBtn.className = 'p-1 hover:bg-gray-100 rounded';
        deleteBtn.title = 'Delete file';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFile(fileName, li);
        });
        
        controls.appendChild(editBtn);
        controls.appendChild(deleteBtn);
        nameContainer.appendChild(controls);
        li.appendChild(nameContainer);
        
        // Click handler for opening file
        li.addEventListener('click', () => this.openFile(fileName, li));
        
        return li;
    }
    
    // Start rename process
    startRename(li, nameSpan, currentFileName) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentFileName;
        input.className = 'bg-white border border-blue-500 rounded px-2 py-1 text-sm w-full';
        
        // Replace name span with input
        nameSpan.style.display = 'none';
        li.querySelector('.flex').insertBefore(input, li.querySelector('.hidden'));
        input.focus();
        input.select();
        
        const finishRename = async () => {
            const newFileName = input.value.trim();
            if (newFileName && newFileName !== currentFileName) {
                if (!newFileName.toLowerCase().endsWith('.md')) {
                    ui.showToast('File name must end with .md', CONFIG.MESSAGE_TYPES.ERROR);
                    input.remove();
                    nameSpan.style.display = '';
                    return;
                }
                
                await this.renameFile(currentFileName, newFileName, li);
            }
            
            // Restore original display
            input.remove();
            nameSpan.style.display = '';
        };
        
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishRename();
            } else if (e.key === 'Escape') {
                input.remove();
                nameSpan.style.display = '';
            }
        });
    }
    
    // Rename file in IndexedDB
    async renameFile(oldFileName, newFileName, li) {
        try {
            const directoryName = appState.getCurrentDirectoryName() || 'unsaved_documents';
            
            // Check if new name already exists in current directory (excluding current file)
            const directoryFiles = await indexedDBService.getFilesByDirectory(directoryName);
            const existingFile = directoryFiles.find(file => file.fileName === newFileName && file.fileName !== oldFileName);
            if (existingFile) {
                ui.showToast('File name already exists', CONFIG.MESSAGE_TYPES.ERROR);
                return;
            }
            
            // Get the file content
            const savedFile = await indexedDBService.getFile(oldFileName);
            if (!savedFile) {
                ui.showToast('File not found', CONFIG.MESSAGE_TYPES.ERROR);
                return;
            }
            
            // Save with new name
            await indexedDBService.saveFile(newFileName, savedFile.content, directoryName);
            
            // Delete old file
            await indexedDBService.deleteFile(oldFileName);
            
            // Update UI
            li.dataset.fileName = newFileName;
            const nameSpan = li.querySelector('span');
            nameSpan.textContent = `${newFileName} (saved)`;
            
            // If this is the currently open file, update the file handle
            const currentFileHandle = appState.getCurrentFileHandle();
            if (currentFileHandle && currentFileHandle.name === oldFileName) {
                appState.setCurrentFileHandle({ name: newFileName });
                ui.updateStatus(`Editing: ${newFileName}`);
            }
            
            ui.showToast(`Renamed to: ${newFileName}`);
            
        } catch (err) {
            console.error('Error renaming file:', err);
            ui.showToast('Error renaming file', CONFIG.MESSAGE_TYPES.ERROR);
        }
    }
    
    // Delete file from IndexedDB
    async deleteFile(fileName, li) {
        if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            await indexedDBService.deleteFile(fileName);
            
            // Remove from UI
            li.remove();
            
            // If this was the currently open file, clear the editor
            const currentFileHandle = appState.getCurrentFileHandle();
            if (currentFileHandle && currentFileHandle.name === fileName) {
                const editor = appState.getEditor();
                editor.setMarkdown('');
                appState.clearFileState();
                ui.updateStatus('File deleted');
                this.updateSaveButtonState(true, false);
            }
            
            ui.showToast(`Deleted: ${fileName}`);
            
            // Check if file list is empty
            if (this.fileList.children.length === 0) {
                this.fileList.innerHTML = '<li class="text-gray-400 text-sm p-2">No saved files found.</li>';
            }
            
        } catch (err) {
            console.error('Error deleting file:', err);
            ui.showToast('Error deleting file', CONFIG.MESSAGE_TYPES.ERROR);
        }
    }
    
    // Initialize event listeners
    initializeEventListeners() {
        // Event listeners are now handled by the editor toolbar commands
        // No need for separate button event listeners
    }
}

// Create and export a singleton instance
export const fileSystem = new FileSystem(); 