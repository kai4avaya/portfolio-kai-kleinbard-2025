import { CONFIG } from './config.js';
import { appState } from './state.js';
import { outlineTree } from './outlineTree.js';
import { fileSystem } from './fileSystem.js';

// UI utilities for the AI Textbook Editor
export class UI {
    constructor() {
        this.initializeElements();
    }

    initializeElements() {
        // Tool buttons
        this.filesToolBtn = document.getElementById('files-tool-btn');
        this.outlineToolBtn = document.getElementById('outline-tool-btn');
        this.aiToolBtn = document.getElementById('ai-tool-btn');
        
        // Panels
        this.filesPanel = document.getElementById('files-panel');
        this.outlinePanel = document.getElementById('outline-panel');
        this.aiPanel = document.getElementById('ai-panel');
        
        // Sidebar container
        this.sidebar = document.getElementById('sidebar');
        
        // Other UI elements
        this.outlineList = document.getElementById('outline-list');
        this.toast = document.getElementById('toast');
        
        // Initialize the current active panel based on HTML state
        this.initializeActivePanel();
        
        // Initialize the outline tree
        outlineTree.initialize();
        
        // Initialize outline tree controls
        this.initializeOutlineControls();
        
        // Initialize resize functionality
        this.initializeResizeHandle();
    }

    // Initialize the current active panel based on HTML state
    initializeActivePanel() {
        if (this.filesPanel.classList.contains('active')) {
            this.currentActivePanel = CONFIG.PANELS.FILES;
        } else if (this.outlinePanel.classList.contains('active')) {
            this.currentActivePanel = CONFIG.PANELS.OUTLINE;
        } else if (this.aiPanel.classList.contains('active')) {
            this.currentActivePanel = CONFIG.PANELS.AI;
        } else {
            this.currentActivePanel = null;
        }
    }

    // Panel switching logic with VS Code-style toggling
    switchPanel(panelToShow) {
        // If clicking the same panel that's already active, close the sidebar
        if (this.currentActivePanel === panelToShow) {
            this.closeSidebar();
            return;
        }

        // Otherwise, switch to the new panel
        this.currentActivePanel = panelToShow;
        this.openSidebar();
        
        const panels = [this.filesPanel, this.outlinePanel, this.aiPanel];
        const toolBtns = [this.filesToolBtn, this.outlineToolBtn, this.aiToolBtn];
        
        panels.forEach(p => p.classList.remove('active'));
        toolBtns.forEach(b => b.classList.remove('active'));

        if (panelToShow === CONFIG.PANELS.FILES) {
            this.filesPanel.classList.add('active');
            this.filesToolBtn.classList.add('active');
            // Refresh file list when files panel is shown
            fileSystem.populateFileList();
        } else if (panelToShow === CONFIG.PANELS.OUTLINE) {
            this.outlinePanel.classList.add('active');
            this.outlineToolBtn.classList.add('active');
        } else if (panelToShow === CONFIG.PANELS.AI) {
            this.aiPanel.classList.add('active');
            this.aiToolBtn.classList.add('active');
        }
    }

    // Close the sidebar (VS Code-style)
    closeSidebar() {
        this.sidebar.classList.add('hidden');
        this.currentActivePanel = null;
        
        // Remove active state from all tool buttons
        const toolBtns = [this.filesToolBtn, this.outlineToolBtn, this.aiToolBtn];
        toolBtns.forEach(b => b.classList.remove('active'));
    }

    // Open the sidebar
    openSidebar() {
        this.sidebar.classList.remove('hidden');
    }

    // Check if sidebar is open
    isSidebarOpen() {
        return !this.sidebar.classList.contains('hidden');
    }

    // Get current active panel
    getCurrentActivePanel() {
        return this.currentActivePanel;
    }

    // Toast notification system
    showToast(message, type = CONFIG.MESSAGE_TYPES.SUCCESS) {
        this.toast.textContent = message;
        this.toast.className = 'fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-xl opacity-0 transform translate-y-2 transition-all duration-300';
        
        if (type === CONFIG.MESSAGE_TYPES.ERROR) {
            this.toast.classList.add('bg-red-500');
        } else {
            this.toast.classList.add('bg-green-500');
        }
        
        this.toast.classList.remove('opacity-0', 'translate-y-2');
        this.toast.classList.add('opacity-100', 'translate-y-0');

        setTimeout(() => {
            this.toast.classList.remove('opacity-100', 'translate-y-0');
            this.toast.classList.add('opacity-0', 'translate-y-2');
        }, CONFIG.UI.TOAST_DURATION);
    }

    // Status updates
    updateStatus(message) {
        // Status updates are now handled through toast notifications
        // This method is kept for backward compatibility but doesn't update any UI element
        console.log('Status:', message);
    }

    // Outline generation and management
    updateOutline() {
        outlineTree.updateOutline();
    }

    // Debounced outline update
    debouncedUpdateOutline() {
        clearTimeout(appState.getOutlineUpdateTimeout());
        const timeout = setTimeout(() => this.updateOutline(), CONFIG.EDITOR.OUTLINE_UPDATE_DELAY);
        appState.setOutlineUpdateTimeout(timeout);
    }

    // Initialize outline tree controls
    initializeOutlineControls() {
        const expandAllBtn = document.getElementById('expand-all-btn');
        const collapseAllBtn = document.getElementById('collapse-all-btn');
        
        if (expandAllBtn) {
            expandAllBtn.addEventListener('click', () => {
                outlineTree.expandAll();
            });
        }
        
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', () => {
                outlineTree.collapseAll();
            });
        }
    }

    // Initialize resize handle functionality
    initializeResizeHandle() {
        const resizeHandle = document.getElementById('sidebar-resize-handle');
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX || e.touches[0].clientX;
            startWidth = this.sidebar.offsetWidth;
            
            this.sidebar.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            // Add event listeners for mouse/touch move and end
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchmove', resize);
            document.addEventListener('touchend', stopResize);
        };

        const resize = (e) => {
            if (!isResizing) return;
            
            const currentX = e.clientX || e.touches[0].clientX;
            const deltaX = currentX - startX;
            const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
            
            this.sidebar.style.width = `${newWidth}px`;
        };

        const stopResize = () => {
            if (!isResizing) return;
            
            isResizing = false;
            this.sidebar.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Remove event listeners
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchmove', resize);
            document.removeEventListener('touchend', stopResize);
            
            // Save the width to localStorage for persistence
            const currentWidth = this.sidebar.offsetWidth;
            localStorage.setItem('sidebarWidth', currentWidth);
        };

        // Add event listeners to the resize handle
        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize);
        
        // Load saved width on initialization
        this.loadSavedWidth();
    }

    // Load saved sidebar width from localStorage
    loadSavedWidth() {
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
            const width = parseInt(savedWidth);
            if (width >= 200 && width <= 600) {
                this.sidebar.style.width = `${width}px`;
            }
        }
    }
}

// Create and export a singleton instance
export const ui = new UI(); 