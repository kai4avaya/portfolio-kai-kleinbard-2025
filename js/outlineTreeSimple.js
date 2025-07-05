import { CONFIG } from './config.js';
import { appState } from './state.js';

// Simple Outline Tree management using jsTree
export class OutlineTreeSimple {
    constructor() {
        this.tree = null;
        this.outlineContainer = null;
        this.initialized = false;
    }

    // Initialize the tree component
    initialize() {
        if (this.initialized) return;
        
        this.outlineContainer = document.getElementById('outline-list');
        this.setupTree();
        this.initialized = true;
    }

    // Setup the jsTree component
    setupTree() {
        // Clear the container
        this.outlineContainer.innerHTML = '';
        
        // Create the tree container
        const treeContainer = document.createElement('div');
        treeContainer.id = 'outline-tree-simple';
        treeContainer.className = 'outline-tree-simple-container';
        this.outlineContainer.appendChild(treeContainer);

        // Initialize jsTree
        $(treeContainer).jstree({
            core: {
                data: [],
                themes: {
                    name: 'proton',
                    responsive: true
                },
                check_callback: true
            },
            plugins: ['themes', 'html_data'],
            html_data: {
                ajax: false
            }
        }).on('select_node.jstree', (e, data) => {
            this.handleNodeClick(data.node);
        });

        this.tree = $(treeContainer);
    }

    // Update the outline tree with new markdown content
    updateOutline() {
        const editor = appState.getEditor();
        if (!editor || !this.tree) {
            this.showMessage('Editor not ready.');
            return;
        }
        
        const markdown = editor.getMarkdown();
        const treeData = this.parseMarkdownToTree(markdown);
        
        if (treeData.length === 0) {
            this.showMessage(markdown.trim() === '' ? 
                'Start typing headings to see an outline.' : 
                'No headings found.'
            );
            return;
        }
        
        // Update the tree with new data
        this.tree.jstree('destroy');
        this.tree.jstree({
            core: {
                data: treeData,
                themes: {
                    name: 'proton',
                    responsive: true
                },
                check_callback: true
            },
            plugins: ['themes', 'html_data'],
            html_data: {
                ajax: false
            }
        }).on('select_node.jstree', (e, data) => {
            this.handleNodeClick(data.node);
        });
    }

    // Parse markdown content into tree structure
    parseMarkdownToTree(markdown) {
        const lines = markdown.split('\n');
        const headingRegex = /^(#+)\s+(.*)/;
        const treeData = [];
        const stack = [{ level: 0, children: treeData }];

        lines.forEach((line, index) => {
            const match = line.match(headingRegex);
            if (match) {
                const level = match[1].length;
                const title = match[2].trim();
                const lineNumber = index + 1;
                
                const node = {
                    text: `${title} <span class="line-number">:${lineNumber}</span>`,
                    id: `heading-${lineNumber}`,
                    data: {
                        level: level,
                        line: lineNumber,
                        type: 'heading'
                    },
                    children: [],
                    state: {
                        opened: level <= 2 // Auto-expand first two levels
                    }
                };

                // Find the correct parent level
                while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }
                
                // Add to parent
                stack[stack.length - 1].children.push(node);
                stack.push({ level: level, children: node.children });
            }
        });

        return treeData;
    }

    // Handle node click - jump to line in editor
    handleNodeClick(node) {
        if (node.data && node.data.line) {
            const editor = appState.getEditor();
            if (editor) {
                editor.setSelection([node.data.line, 1], [node.data.line, 1]);
                editor.focus();
            }
        }
    }

    // Show message when no outline is available
    showMessage(message) {
        this.outlineContainer.innerHTML = `<div class="outline-message">${message}</div>`;
    }

    // Expand all nodes
    expandAll() {
        if (this.tree) {
            this.tree.jstree('open_all');
        }
    }

    // Collapse all nodes
    collapseAll() {
        if (this.tree) {
            this.tree.jstree('close_all');
        }
    }

    // Get current tree instance
    getTree() {
        return this.tree;
    }

    // Destroy the tree (for cleanup)
    destroy() {
        if (this.tree) {
            this.tree.jstree('destroy');
            this.tree = null;
        }
        this.initialized = false;
    }
}

// Create and export a singleton instance
export const outlineTreeSimple = new OutlineTreeSimple(); 