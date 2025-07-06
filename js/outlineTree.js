import { CONFIG } from './config.js';
import { appState } from './state.js';

// Outline Tree management using FancyTree
export class OutlineTree {
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

    // Setup the FancyTree component
    setupTree() {
        // Clear the container
        this.outlineContainer.innerHTML = '';
        
        // Create the tree container
        const treeContainer = document.createElement('div');
        treeContainer.id = 'outline-tree';
        treeContainer.className = 'outline-tree-container';
        this.outlineContainer.appendChild(treeContainer);

        // Initialize FancyTree
        this.tree = $(treeContainer).fancytree({
            source: [],
            activate: (event, data) => {
                this.handleNodeClick(data.node);
            },
            click: (event, data) => {
                // Prevent default to handle custom click
                return false;
            },
            renderNode: (event, data) => {
                // Custom rendering for better visual hierarchy
                const node = data.node;
                const $span = $(node.span);
                
                // Add custom classes based on heading level
                $span.find('.fancytree-title').addClass(`heading-level-${node.data.level || 1}`);
                
                // Add line number indicator
                if (node.data.line) {
                    $span.find('.fancytree-title').append(
                        `<span class=\"line-number\">:${node.data.line}</span>`
                    );
                }
            },
            // Tree options
            autoScroll: true,
            clickFolderMode: 2, // Single click to expand/collapse
            debugLevel: 0,
            // Styling
            icon: (event, data) => 'fa fa-file-text', // Always use file icon
            titlesTabbable: true,
            // Performance
            lazyLoad: false
        });
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
        
        // Reload the tree with new data
        this.tree.fancytree('getTree').reload(treeData);
        // Force all nodes with children to be expanded
        this.tree.fancytree('getTree').visit(function(node){
            if(node.hasChildren()) node.setExpanded(true);
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
                    title: title,
                    key: `heading-${lineNumber}`,
                    data: {
                        level: level,
                        line: lineNumber,
                        type: 'heading'
                    },
                    children: []
                };

                // Pop the stack to the correct parent level
                while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                // Add to parent
                stack[stack.length - 1].children.push(node);
                // Push this node to the stack
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
            this.tree.fancytree('getTree').expandAll();
        }
    }

    // Collapse all nodes
    collapseAll() {
        if (this.tree) {
            this.tree.fancytree('getTree').collapseAll();
        }
    }

    // Get current tree instance
    getTree() {
        return this.tree;
    }

    // Destroy the tree (for cleanup)
    destroy() {
        if (this.tree) {
            this.tree.fancytree('destroy');
            this.tree = null;
        }
        this.initialized = false;
    }
}

// Create and export a singleton instance
export const outlineTree = new OutlineTree(); 