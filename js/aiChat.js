import { CONFIG } from './config.js';

// AI Chat functionality for the AI Textbook Editor
export class AIChat {
    constructor() {
        this.chatInput = document.getElementById('chat-input');
        this.chatSendBtn = document.getElementById('chat-send-btn');
        this.chatMessages = document.getElementById('chat-messages');
        this.apiKeyInput = document.getElementById('api-key-input');
        this.saveApiKeyBtn = document.getElementById('save-api-key-btn');
        this.apiKeySection = document.getElementById('api-key-section');
        this.aiSettingsBtn = document.getElementById('ai-settings-btn');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.saveLocallyCheckbox = document.getElementById('save-locally-checkbox');
        this.knowledgeBaseCheckbox = document.getElementById('knowledge-base-checkbox');
        this.promptDropdown = document.getElementById('prompt-dropdown');
        this.customPromptSection = document.getElementById('custom-prompt-section');
        this.customPromptInput = document.getElementById('custom-prompt-input');
        this.defaultPromptSection = document.getElementById('default-prompt-section');
        this.defaultPromptDisplay = document.getElementById('default-prompt-display');
        
        this.apiKey = localStorage.getItem('gemini-api-key') || '';
        this.tempApiKey = '';
        this.defaultPrompt = "You are an AI assistant for a document editor. You help users write and edit textbooks and documents. Always output perfect markdown formatting. Keep image links as markdown image syntax (![alt](url)). Be concise and helpful.";
        this.customPrompt = localStorage.getItem('custom-prompt') || '';
        this.systemPrompt = this.customPrompt || this.defaultPrompt;
        this.useKnowledgeBase = localStorage.getItem('use-knowledge-base') === 'true';
        this.initialized = false;
        
        this.initializeEventListeners();
        this.loadSettings();
        this.checkApiKey();
        
        // Show welcome message only once on page load
        if ((this.apiKey || this.tempApiKey) && this.chatMessages.children.length === 0 && !this.initialized) {
            this.loadChatHistory();
            this.initialized = true;
        }
    }

    // Initialize event listeners for chat functionality
    initializeEventListeners() {
        this.chatSendBtn.addEventListener('click', () => this.handleAIChat());
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleAIChat();
            }
        });
        this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.aiSettingsBtn.addEventListener('click', () => this.toggleSettings());
        this.newChatBtn.addEventListener('click', () => this.newChat());
        this.promptDropdown.addEventListener('change', () => this.handlePromptChange());
        this.customPromptInput.addEventListener('input', () => this.saveCustomPrompt());
        this.knowledgeBaseCheckbox.addEventListener('change', () => this.saveKnowledgeBaseSetting());
        
        // Add resize observer to handle dynamic layout adjustments
        this.setupResizeObserver();
    }

    // Check if API key exists and update UI
    checkApiKey() {
        const hasKey = this.apiKey || this.tempApiKey;
        if (hasKey) {
            this.apiKeySection.style.display = 'none';
            this.aiSettingsBtn.classList.remove('hidden');
            this.newChatBtn.classList.remove('hidden');
            this.chatInput.disabled = false;
            this.chatSendBtn.disabled = false;
        } else {
            this.addChatMessage('Please enter your Gemini API key to start chatting.', 'ai');
        }
    }

    // Save API key
    saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (key) {
            if (this.saveLocallyCheckbox.checked) {
                this.apiKey = key;
                localStorage.setItem('gemini-api-key', key);
            } else {
                this.tempApiKey = key;
            }
            this.apiKeyInput.value = '';
            this.checkApiKey();
            
            // Show welcome message only if not already initialized
            if (!this.initialized) {
                if (!localStorage.getItem('chat-welcomed')) {
                    this.initializeChat();
                    this.addChatMessage('Hello! I\'m your AI assistant for document editing. I can help you write, edit, and improve your textbook content. I\'ll format my responses in perfect markdown. How can I help you today?', 'ai');

                    localStorage.setItem('chat-welcomed', 'true');
                } else {
                    this.loadChatHistory();
                }
                this.initialized = true;
            }
        }
    }
    
    // Toggle settings visibility
    toggleSettings() {
        if (this.apiKeySection.style.display === 'none') {
            this.apiKeySection.style.display = 'block';
        } else {
            this.apiKeySection.style.display = 'none';
        }
    }
    
    // Handle prompt dropdown change
    handlePromptChange() {
        if (this.promptDropdown.value === 'custom') {
            this.customPromptSection.classList.remove('hidden');
            this.defaultPromptSection.classList.add('hidden');
            this.systemPrompt = this.customPrompt || this.defaultPrompt;
        } else {
            this.customPromptSection.classList.add('hidden');
            this.defaultPromptSection.classList.remove('hidden');
            this.systemPrompt = this.defaultPrompt;
        }
    }
    
    // Save custom prompt
    saveCustomPrompt() {
        this.customPrompt = this.customPromptInput.value.trim();
        if (this.customPrompt) {
            localStorage.setItem('custom-prompt', this.customPrompt);
            this.systemPrompt = this.customPrompt;
        }
    }
    
    // Load saved settings
    loadSettings() {
        // Set default prompt display
        this.defaultPromptDisplay.textContent = this.defaultPrompt;
        
        if (this.customPrompt) {
            this.promptDropdown.value = 'custom';
            this.customPromptSection.classList.remove('hidden');
            this.defaultPromptSection.classList.add('hidden');
            this.customPromptInput.value = this.customPrompt;
        } else {
            this.defaultPromptSection.classList.remove('hidden');
        }
        this.knowledgeBaseCheckbox.checked = this.useKnowledgeBase;
    }
    
    // Save knowledge base setting
    saveKnowledgeBaseSetting() {
        this.useKnowledgeBase = this.knowledgeBaseCheckbox.checked;
        localStorage.setItem('use-knowledge-base', this.useKnowledgeBase.toString());
    }
    
    // Get all markdown files from IndexedDB
    async getAllMarkdownFiles() {
        try {
            const request = indexedDB.open('AI_Textbook_Editor', 2);
            return new Promise((resolve) => {
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('markdown_files')) {
                        resolve([]);
                        return;
                    }
                    const transaction = db.transaction(['markdown_files'], 'readonly');
                    const store = transaction.objectStore('markdown_files');
                    const getRequest = store.getAll();
                    getRequest.onsuccess = () => resolve(getRequest.result || []);
                    getRequest.onerror = () => resolve([]);
                };
                request.onerror = () => resolve([]);
            });
        } catch (error) {
            return [];
        }
    }

    // Handle AI chat request
    async handleAIChat() {
        const userMessage = this.chatInput.value.trim();
        if (!userMessage || (!this.apiKey && !this.tempApiKey)) return;

        this.addChatMessage(userMessage, 'user');
        this.chatInput.value = '';
        this.chatSendBtn.disabled = true;
        this.addChatMessage('<span class="loading-dots"><span>●</span><span>●</span><span>●</span></span>', 'ai', true);

        try {
            const response = await this.callAIAPI(userMessage);
            this.updateLastChatMessage(response);
        } catch (error) {
            console.error("AI Chat Error:", error);
            this.updateLastChatMessage(`Error: Could not connect to the AI service. ${error.message}`);
        } finally {
            this.chatSendBtn.disabled = false;
        }
    }

    // Call the AI API with streaming
    async callAIAPI(userMessage) {
        const contents = [
            {
                role: "user",
                parts: [{ text: this.systemPrompt }]
            }
        ];
        
        // Add knowledge base if enabled
        if (this.useKnowledgeBase) {
            const files = await this.getAllMarkdownFiles();
            console.log(`Knowledge base enabled - found ${files.length} files`);
            if (files.length > 0) {
                const knowledgeBase = files.map(file => 
                    `## ${file.fileName}\n${file.content}`
                ).join('\n\n');
                console.log('Adding knowledge base to AI context:', knowledgeBase.substring(0, 200) + '...');
                contents.push({
                    role: "user",
                    parts: [{ text: `Knowledge Base:\n${knowledgeBase}` }]
                });
            }
        }
        
        contents.push({
            role: "user", 
            parts: [{ text: userMessage }]
        });
        
        const payload = {
            contents,
            generationConfig: {
                responseMimeType: "text/plain"
            }
        };
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=${this.apiKey || this.tempApiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let jsonBuffer = '';
        let braceCount = 0;
        let inArray = false;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            for (const char of chunk) {
                jsonBuffer += char;
                
                if (char === '[') {
                    inArray = true;
                    braceCount = 0;
                } else if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    
                    // Complete JSON object found
                    if (braceCount === 0) {
                        try {
                            let jsonData;
                            if (inArray && jsonBuffer.includes(']')) {
                                // Complete array
                                jsonData = JSON.parse(jsonBuffer);
                                for (const item of jsonData) {
                                    if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
                                        const text = item.candidates[0].content.parts[0].text;
                                        console.log('Stream chunk:', text);
                                        fullResponse += text;
                                        this.updateStreamingMessage(fullResponse);
                                    }
                                }
                                jsonBuffer = '';
                                inArray = false;
                            } else if (!inArray) {
                                // Single object
                                jsonData = JSON.parse(jsonBuffer);
                                if (jsonData.candidates?.[0]?.content?.parts?.[0]?.text) {
                                    const text = jsonData.candidates[0].content.parts[0].text;
                                    console.log('Stream chunk:', text);
                                    fullResponse += text;
                                    this.updateStreamingMessage(fullResponse);
                                }
                                jsonBuffer = '';
                            }
                        } catch (e) {
                            // Continue building buffer if parse fails
                        }
                    }
                } else if (char === ']' && inArray) {
                    // End of array - try to parse
                    try {
                        const jsonData = JSON.parse(jsonBuffer);
                        for (const item of jsonData) {
                            if (item.candidates?.[0]?.content?.parts?.[0]?.text) {
                                const text = item.candidates[0].content.parts[0].text;
                                console.log('Stream chunk:', text);
                                fullResponse += text;
                                this.updateStreamingMessage(fullResponse);
                            }
                        }
                        jsonBuffer = '';
                        inArray = false;
                        braceCount = 0;
                    } catch (e) {
                        // Continue if parse fails
                    }
                }
            }
        }
        
        return fullResponse || "Sorry, I couldn't generate a response.";
    }

    // Add a chat message to the chat interface
    addChatMessage(message, sender, isTyping = false) {
        const messageDiv = document.createElement('div');
        let content;
        
        if (sender === 'user') {
            content = `<div class="p-3 bg-gray-200 rounded-lg text-sm text-gray-800">${this.escapeHtml(message)}</div>`;
        } else {
            content = `
                <div class="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 markdown-content">${this.formatMarkdown(message)}</div>
                ${!isTyping ? `<div class="flex space-x-2 mt-2 px-3 pb-2">
                    <button class="insert-btn text-xs text-gray-500 hover:text-indigo-600 flex items-center space-x-1" title="Insert into editor">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14m-7-7h14"/>
                        </svg>
                        <span>Insert</span>
                    </button>
                    <button class="copy-btn text-xs text-gray-500 hover:text-indigo-600 flex items-center space-x-1" title="Copy to clipboard">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Copy</span>
                    </button>
                </div>` : ''}
            `;
        }
        
        messageDiv.innerHTML = content;
        if (isTyping) {
            messageDiv.id = 'streaming-message';
        }
        
        // Add event listeners for buttons
        if (sender === 'ai' && !isTyping) {
            const insertBtn = messageDiv.querySelector('.insert-btn');
            const copyBtn = messageDiv.querySelector('.copy-btn');
            
            insertBtn?.addEventListener('click', () => this.insertIntoEditor(message));
            copyBtn?.addEventListener('click', () => this.copyToClipboard(message));
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        // Save chat after adding message
        if (!isTyping) {
            this.saveChatToDB();
        }
    }
    
    // Update streaming message
    updateStreamingMessage(newMessage) {
        const streamingMessage = document.getElementById('streaming-message');
        if (streamingMessage) {
            streamingMessage.querySelector('div').innerHTML = this.formatMarkdown(newMessage);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    // Update the last chat message (for typing indicator)
    updateLastChatMessage(newMessage) {
        const streamingMessage = document.getElementById('streaming-message');
        if (streamingMessage) {
            streamingMessage.innerHTML = `
                <div class="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 markdown-content">${this.formatMarkdown(newMessage)}</div>
                <div class="flex space-x-2 mt-2 px-3 pb-2">
                    <button class="insert-btn text-xs text-gray-500 hover:text-indigo-600 flex items-center space-x-1" title="Insert into editor">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14m-7-7h14"/>
                        </svg>
                        <span>Insert</span>
                    </button>
                    <button class="copy-btn text-xs text-gray-500 hover:text-indigo-600 flex items-center space-x-1" title="Copy to clipboard">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Copy</span>
                    </button>
                </div>
            `;
            
            // Add event listeners
            const insertBtn = streamingMessage.querySelector('.insert-btn');
            const copyBtn = streamingMessage.querySelector('.copy-btn');
            
            insertBtn?.addEventListener('click', () => this.insertIntoEditor(newMessage));
            copyBtn?.addEventListener('click', () => this.copyToClipboard(newMessage));
            
            streamingMessage.id = '';
        }
    }
    
    // Basic markdown formatting
    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded">');
    }
    
    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Insert message into editor
    insertIntoEditor(message) {
        // Try multiple ways to access the editor
        const editorInstance = window.editorInstance || window.appState?.getEditor() || document.querySelector('#editor')?._editor;
        
        if (editorInstance && editorInstance.getMarkdown) {
            const currentContent = editorInstance.getMarkdown();
            const newContent = currentContent + (currentContent ? '\n\n' : '') + message;
            editorInstance.setMarkdown(newContent);
        }
    }
    
    // Copy message to clipboard
    async copyToClipboard(message) {
        try {
            await navigator.clipboard.writeText(message);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = message;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    // Load chat history or show welcome message
    async loadChatHistory() {
        try {
            const savedChat = await this.getChatFromDB();
            if (savedChat && savedChat.messages.length > 0) {
                savedChat.messages.forEach(msg => {
                    this.addChatMessage(msg.content, msg.sender);
                });
            } else if (!localStorage.getItem('chat-welcomed')) {
                this.initializeChat();
                localStorage.setItem('chat-welcomed', 'true');
            }
        } catch (error) {
            if (!localStorage.getItem('chat-welcomed')) {
                this.initializeChat();
                localStorage.setItem('chat-welcomed', 'true');
            }
        }
    }
    
    // Initialize the chat with a welcome message
    initializeChat() {
        this.saveChatToDB();
    }
    
    // Save chat to IndexedDB
    async saveChatToDB() {
        try {
            const messages = Array.from(this.chatMessages.children).map(msg => {
                const isUser = msg.querySelector('.bg-gray-200');
                const content = isUser ? 
                    msg.querySelector('.bg-gray-200').textContent :
                    msg.querySelector('.markdown-content').textContent;
                return {
                    sender: isUser ? 'user' : 'ai',
                    content: content
                };
            });
            
            const request = indexedDB.open('AI_Textbook_Editor', 2);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                if (db.objectStoreNames.contains('chats')) {
                    const transaction = db.transaction(['chats'], 'readwrite');
                    const store = transaction.objectStore('chats');
                    store.put({ id: 'current', messages, timestamp: Date.now() });
                }
            };
        } catch (error) {
            console.error('Error saving chat:', error);
        }
    }
    
    // Get chat from IndexedDB
    async getChatFromDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('AI_Textbook_Editor', 2);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('chats')) {
                    resolve(null);
                    return;
                }
                const transaction = db.transaction(['chats'], 'readonly');
                const store = transaction.objectStore('chats');
                const getRequest = store.get('current');
                getRequest.onsuccess = () => resolve(getRequest.result);
                getRequest.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    }
    
    // Setup resize observer to handle dynamic layout adjustments
    setupResizeObserver() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                // Force a reflow to ensure proper flex calculations
                this.chatInput.offsetHeight;
                this.chatSendBtn.offsetHeight;
            });
            resizeObserver.observe(sidebar);
        }
    }
    
    // Clear chat and start new
    newChat() {
        this.chatMessages.innerHTML = '';
        this.initializeChat();
    }
}

// Create and export a singleton instance
export const aiChat = new AIChat(); 