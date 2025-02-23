const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class TelegramService {
    constructor() {
        this.client = null;
        this.session = null;
        this.processedMessages = new Set();
        this.userEntities = new Map();
        this.isInitialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('Telegram service already initialized');
                return true;
            }

            // Load and validate session
            const savedSession = process.env.TELEGRAM_SESSION?.trim() || '';
            this.session = new StringSession(savedSession);

            // Initialize client with improved configuration
            this.client = new TelegramClient(
                this.session,
                parseInt(process.env.TELEGRAM_API_ID),
                process.env.TELEGRAM_API_HASH,
                {
                    connectionRetries: 5,
                    useWSS: false, // Changed to false for better stability
                    deviceModel: "Desktop",
                    systemVersion: "Windows 10",
                    appVersion: "1.0.0",
                    timeout: 30000,
                    autoReconnect: true
                }
            );

            console.log('Connecting to Telegram...');

            // Connect with retry logic
            await this.connectWithRetry();

            // Check authorization status
            if (!await this.client.checkAuthorization()) {
                console.log('Authorization needed...');
                await this.performAuthentication();
            } else {
                console.log('Successfully authorized using saved session');
            }

            // Initialize directories
            await this.initializeDirectories();

            // Start message listener
            await this.startListening();

            this.isInitialized = true;
            console.log('Telegram service fully initialized');
            return true;

        } catch (error) {
            console.error('Failed to initialize Telegram client:', error);
            throw error;
        }
    }

    async connectWithRetry() {
        while (this.reconnectAttempts < this.maxReconnectAttempts) {
            try {
                await this.client.connect();
                this.reconnectAttempts = 0; // Reset counter on successful connection
                return;
            } catch (error) {
                this.reconnectAttempts++;
                console.error(`Connection attempt ${this.reconnectAttempts} failed:`, error);
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    throw new Error('Max reconnection attempts reached');
                }
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, this.reconnectAttempts)));
            }
        }
    }

    async performAuthentication() {
        try {
            await this.client.start({
                phoneNumber: async () => process.env.TELEGRAM_PHONE,
                password: async () => process.env.TELEGRAM_PASSWORD,
                phoneCode: async () => await input.text('Please enter the code you received: '),
                onError: (err) => {
                    console.error('Authentication Error:', err);
                    throw err;
                },
            });

            // Save and display new session string
            const newSession = this.client.session.save();
            console.log('\nNEW SESSION STRING (update in .env):\n' + newSession);
        } catch (error) {
            console.error('Authentication failed:', error);
            throw error;
        }
    }

    async initializeDirectories() {
        const dirs = [
            path.join(__dirname, '../public/data/others'),
            path.join(__dirname, '../public/data/users')
        ];

        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        }
    }

    async getUserDataPath(userId) {
        const userDir = path.join(__dirname, '../public/data/users');
        return path.join(userDir, `${userId}.json`);
    }

    async loadUserData(userId) {
        const filePath = await this.getUserDataPath(userId);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {
                userId: userId,
                profile: {
                    id: userId,
                    lastUpdated: new Date().toISOString()
                },
                messages: []
            };
        }
    }

    async saveUserData(userId, userData) {
        const filePath = await this.getUserDataPath(userId);
        try {
            await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
        } catch (error) {
            console.error(`Error saving user data for ${userId}:`, error);
            throw error;
        }
    }

    async updateUserProfile(message) {
        try {
            const userId = message.peerId.userId.toString();
            let userEntity;

            // Try to get from cache first
            if (this.userEntities.has(userId)) {
                userEntity = this.userEntities.get(userId);
            } else {
                // Try different methods to get user info
                try {
                    const sender = await message.getSender();
                    if (sender) {
                        this.userEntities.set(userId, sender);
                        userEntity = sender;
                    }
                } catch (error) {
                    console.error('Error getting sender:', error);
                    try {
                        userEntity = await this.client.getEntity(userId);
                        if (userEntity) {
                            this.userEntities.set(userId, userEntity);
                        }
                    } catch (fallbackError) {
                        console.error('Fallback get entity failed:', fallbackError);
                    }
                }
            }

            if (userEntity) {
                return {
                    id: userId,
                    firstName: userEntity.firstName || '',
                    lastName: userEntity.lastName || '',
                    username: userEntity.username || '',
                    phone: userEntity.phone || '',
                    isBot: userEntity.bot || false,
                    lastUpdated: new Date().toISOString(),
                    status: userEntity.status ? {
                        type: userEntity.status.className,
                        wasOnline: userEntity.status.wasOnline ? 
                            new Date(userEntity.status.wasOnline * 1000).toISOString() : null
                    } : null
                };
            }

            return {
                id: userId,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error in updateUserProfile:', error);
            return {
                id: userId,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    async downloadMedia(message) {
        try {
            if (!message.media) return null;

            const mediaDir = path.join(__dirname, '../public/data/others');
            const fileName = `${Date.now()}_${message.id}${this.getMediaExtension(message.media)}`;
            const filePath = path.join(mediaDir, fileName);

            // Download with timeout and retry
            const buffer = await this.downloadWithRetry(message.media);
            if (buffer) {
                await fs.writeFile(filePath, buffer);
                return `/data/others/${fileName}`;
            }
            return null;
        } catch (error) {
            console.error('Error downloading media:', error);
            return null;
        }
    }

    async downloadWithRetry(media, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.client.downloadMedia(media);
            } catch (error) {
                console.error(`Download attempt ${attempt} failed:`, error);
                if (attempt === maxAttempts) return null;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        return null;
    }

    getMediaExtension(media) {
        const extensions = {
            MessageMediaPhoto: '.jpg',
            MessageMediaDocument: '.doc',
            MessageMediaVideo: '.mp4',
            MessageMediaAudio: '.mp3',
            MessageMediaVoice: '.ogg',
            MessageMediaSticker: '.webp'
        };
        return extensions[media.className] || '.bin';
    }

    async saveMessage(message) {
        try {
            console.log('Processing message for saving...');
            
            const senderId = message.peerId.userId.toString();
            const messageId = message.id.toString();

            if (this.processedMessages.has(messageId)) {
                console.log(`Message ${messageId} already processed, skipping`);
                return;
            }

            let userData = await this.loadUserData(senderId);

            // Update profile if incomplete
            if (!userData.profile.firstName || !userData.profile.username) {
                console.log('Updating user profile...');
                userData.profile = await this.updateUserProfile(message);
            }

            // Check for duplicate message
            if (userData.messages.some(m => m.id === message.id)) {
                console.log(`Message ${message.id} already exists for user ${senderId}`);
                return;
            }

            // Handle media
            let mediaPath = null;
            if (message.media) {
                mediaPath = await this.downloadMedia(message);
                console.log('Media downloaded to:', mediaPath);
            }

            // Add new message
            const newMessage = {
                id: message.id,
                date: new Date(message.date * 1000).toISOString(),
                text: message.message || '',
                mediaType: message.media ? message.media.className : null,
                mediaPath: mediaPath
            };

            userData.messages.push(newMessage);
            userData.messages.sort((a, b) => new Date(a.date) - new Date(b.date));

            await this.saveUserData(senderId, userData);
            this.processedMessages.add(messageId);
            
            console.log(`Updated user data saved for: ${senderId}`);
            console.log('Current profile:', userData.profile);

        } catch (error) {
            console.error('Failed to save message:', error);
            throw error;
        }
    }

    async startListening() {
        try {
            console.log('Setting up message listener...');
            
            this.client.addEventHandler(async (event) => {
                try {
                    const message = event.message;
                    
                    if (!message.out && message.peerId?.className === 'PeerUser') {
                        console.log('New private message received:', {
                            messageId: message.id,
                            fromId: message.fromId?.userId?.toString(),
                            text: message.message,
                            hasMedia: !!message.media
                        });
                        
                        await this.saveMessage(message);
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            }, new NewMessage({}));

            console.log('Message listener setup complete');
        } catch (error) {
            console.error('Error in message listener:', error);
            throw error;
        }
    }

    // Public methods for external use
    async sendMessage(userId, message) {
        try {
            if (!this.client || !this.isInitialized) {
                throw new Error('Telegram client not initialized');
            }
            return await this.client.sendMessage(userId, { message });
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.disconnect();
                this.isInitialized = false;
                console.log('Telegram client disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    }
}

// Create and export a single instance
const telegramService = new TelegramService();
module.exports = telegramService;