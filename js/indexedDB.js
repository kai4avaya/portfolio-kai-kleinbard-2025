// IndexedDB service for storing and retrieving markdown files
export class IndexedDBService {
    constructor() {
        this.dbName = 'AI_Textbook_Editor';
        this.dbVersion = 3;
        this.storeName = 'markdown_files';
        this.db = null;
    }

    // Initialize the database
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'fileName' });
                    store.createIndex('fileName', 'fileName', { unique: true });
                }
                
                // Create chats store
                if (!db.objectStoreNames.contains('chats')) {
                    const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
                }
            };
        });
    }

    // Save a markdown file to IndexedDB
    async saveFile(fileName, content, directoryName = '') {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const fileData = {
                fileName: fileName,
                content: content,
                directoryName: directoryName,
                lastModified: new Date().toISOString(),
                size: content.length
            };

            const request = store.put(fileData);

            request.onsuccess = () => {
                resolve(fileData);
            };

            request.onerror = () => {
                console.error('Error saving file to IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Get a markdown file from IndexedDB
    async getFile(fileName) {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(fileName);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('Error retrieving file from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Get all files for a specific directory
    async getFilesByDirectory(directoryName) {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const files = request.result.filter(file => file.directoryName === directoryName);
                resolve(files);
            };

            request.onerror = () => {
                console.error('Error retrieving files from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Delete a file from IndexedDB
    async deleteFile(fileName) {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(fileName);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Error deleting file from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Clear all files for a directory
    async clearDirectory(directoryName) {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const files = request.result.filter(file => file.directoryName === directoryName);
                const deletePromises = files.map(file => store.delete(file.fileName));
                
                Promise.all(deletePromises)
                    .then(() => {
                        resolve(files.length);
                    })
                    .catch(reject);
            };

            request.onerror = () => {
                console.error('Error clearing directory from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Clear all files from IndexedDB
    async clearAllFiles() {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing all files from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Get all stored files
    async getAllFiles() {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error retrieving all files from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    // Check if this is the first time the user has opened the app
    async isFirstTimeUser() {
        try {
            if (!this.db) {
                await this.initialize();
            }

            // Ensure the database is ready
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                return true;
            }

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    const isFirstTime = request.result.length === 0;
                    resolve(isFirstTime);
                };

                request.onerror = () => {
                    console.error('Error checking first time user status:', request.error);
                    // If there's an error accessing the store, treat as first time user
                    resolve(true);
                };
            });
        } catch (error) {
            console.error('Error in isFirstTimeUser:', error);
            // If there's any error, treat as first time user
            return true;
        }
    }

    // Get the most recently modified file
    async getLastEditedFile() {
        try {
            if (!this.db) {
                await this.initialize();
            }

            // Ensure the database is ready
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                return null;
            }

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    if (request.result.length === 0) {
                        resolve(null);
                        return;
                    }

                    // Sort by lastModified date, most recent first
                    const sortedFiles = request.result.sort((a, b) => 
                        new Date(b.lastModified) - new Date(a.lastModified)
                    );

                    resolve(sortedFiles[0]);
                };

                request.onerror = () => {
                    console.error('Error retrieving last edited file:', request.error);
                    // If there's an error accessing the store, return null
                    resolve(null);
                };
            });
        } catch (error) {
            console.error('Error in getLastEditedFile:', error);
            // If there's any error, return null
            return null;
        }
    }
}

// Create and export a singleton instance
export const indexedDBService = new IndexedDBService(); 