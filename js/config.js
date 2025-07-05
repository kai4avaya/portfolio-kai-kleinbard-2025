// Configuration constants for the AI Textbook Editor
export const CONFIG = {
    // Editor settings
    EDITOR: {
        INITIAL_VALUE: '# Welcome to the AI Textbook Editor!\n\nStart typing here, or open a folder to begin editing your files.',
        OUTLINE_UPDATE_DELAY: 300, // milliseconds
        QUICK_START_FILE: 'quick-start.md',
    },
    
    // File system settings
    FILE_SYSTEM: {
        SUPPORTED_EXTENSIONS: ['.md', '.markdown'],
    },
    
    // AI Chat settings
    AI_CHAT: {
        API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        API_KEY: '', // Add your API key here
        PROMPT_PREFIX: 'You are a helpful writing assistant for someone building a textbook. Be concise and helpful. The user\'s request is: "',
    },
    
    // UI settings
    UI: {
        TOAST_DURATION: 3000, // milliseconds
    },
    
    // Panel types
    PANELS: {
        FILES: 'files',
        OUTLINE: 'outline',
        AI: 'ai',
    },
    
    // Message types
    MESSAGE_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
    },
    
    // Chat message types
    CHAT_TYPES: {
        USER: 'user',
        AI: 'ai',
    },
    
    // Outline tree settings
    OUTLINE: {
        USE_FANCYTREE: true, // Set to false to use jsTree instead
        AUTO_EXPAND_LEVELS: 2, // Auto-expand first N levels
        UPDATE_DELAY: 300, // milliseconds
    }
}; 