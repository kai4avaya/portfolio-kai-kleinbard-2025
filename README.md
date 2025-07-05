# AI Textbook Editor

A modern, modular AI-powered textbook editor built with vanilla JavaScript, featuring a markdown editor, file management, document outline, and AI assistance.

## Features

- **Markdown Editor**: Powered by Toast UI Editor with live preview
- **File Management**: Open and edit markdown files from your local file system
- **Document Outline**: Interactive tree-based outline with expand/collapse functionality
- **AI Assistant**: Chat with AI to help with textbook writing
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Project Structure

The application has been modularized for better maintainability and code organization:

```
ownCourse2/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # Custom CSS styles
├── js/
│   ├── config.js           # Configuration constants
│   ├── state.js            # Global state management
│   ├── ui.js               # UI utilities and panel management
│   ├── fileSystem.js       # File system operations
│   ├── aiChat.js           # AI chat functionality
│   ├── editor.js           # Toast UI Editor management
│   ├── outlineTree.js      # FancyTree outline implementation
│   ├── outlineTreeSimple.js # jsTree outline implementation (alternative)
│   └── app.js              # Main application initialization
└── README.md               # This file
```

## Module Descriptions

### `config.js`
Contains all configuration constants including:
- Editor settings
- File system settings
- AI API configuration
- UI settings
- Panel and message types

### `state.js`
Global state management using a singleton pattern:
- Editor instance
- Directory and file handles
- Active file element
- Outline update timeouts

### `ui.js`
UI utilities and management:
- Panel switching logic
- Toast notifications
- Status updates
- Outline generation and management

### `fileSystem.js`
File system operations:
- Opening folders using File System Access API
- Reading and writing markdown files
- File list population
- Save button state management

### `aiChat.js`
AI chat functionality:
- Chat message handling
- API communication with Gemini
- Message display and updates

### `editor.js`
Toast UI Editor management:
- Editor initialization
- Event listener setup
- Editor state management

### `outlineTree.js`
FancyTree outline implementation:
- Hierarchical document outline
- Interactive tree navigation
- Real-time outline updates
- Expand/collapse functionality
- Line number indicators

### `outlineTreeSimple.js`
jsTree outline implementation (alternative):
- Lighter tree component
- Simple hierarchical display
- Basic navigation features

### `app.js`
Main application coordination:
- Module initialization
- Event listener setup
- Application lifecycle management

## Setup

1. **Clone or download** the project files
2. **Add your AI API key** in `js/config.js`:
   ```javascript
   AI_CHAT: {
       API_KEY: 'your-gemini-api-key-here',
       // ... other settings
   }
   ```
3. **Open `index.html`** in a modern browser (Chrome, Firefox, Safari, Edge)

## Usage

1. **Open a folder** containing markdown files using the folder button
2. **Select a file** from the files panel to start editing
3. **Use the outline panel** to navigate through document headings
4. **Chat with AI** in the AI panel for writing assistance
5. **Save your changes** using the save button

## Browser Compatibility

This application uses modern web APIs:
- **File System Access API**: For file operations (Chrome 86+, Edge 86+)
- **ES6 Modules**: For JavaScript modularity
- **Toast UI Editor**: For markdown editing

## Development

The modular structure makes it easy to:
- **Add new features** by creating new modules
- **Modify existing functionality** by updating specific modules
- **Test individual components** in isolation
- **Maintain clean separation** of concerns

## Notes

- The application requires a modern browser with File System Access API support
- AI functionality requires a valid Gemini API key
- All file operations are performed locally in the browser
- The editor automatically saves changes to the original files

## Troubleshooting

- **"showDirectoryPicker" errors**: This is expected in sandboxed environments and doesn't affect functionality
- **"ResizeObserver loop" warnings**: These are benign warnings from the Toast UI library
- **AI not responding**: Check your API key configuration in `config.js` 