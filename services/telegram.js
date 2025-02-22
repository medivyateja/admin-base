// services/telegram.js
const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class TelegramService {
    constructor() {
        const savedSession = process.env.TELEGRAM_SESSION || '';
        this.client = null;
        this.session = new StringSession(savedSession);
        this.processedMessages = new Set();
        this.userEntities = new Map(); // Cache for user entities
    }

    async initialize() {
        try {
            this.client = new TelegramClient(
                this.session,
                parseInt(process.env.TELEGRAM_API_ID),
                process.env.TELEGRAM_API_HASH,
                { 
                    connectionRetries: 5,
                    useWSS: true,
                    deviceModel: "Desktop",
                    systemVersion: "Windows 10",
                    appVersion: "1.0.0"
                }
            );

            console.log('Connecting to Telegram...');
            await this.client.connect();
            
            if (!await this.client.checkAuthorization()) {
                console.log('Authorization needed...');
                await this.client.start({
                    phoneNumber: async () => process.env.TELEGRAM_PHONE,
                    password: async () => process.env.TELEGRAM_PASSWORD,
                    phoneCode: async () => await input.text('Please enter the code you received: '),
                    onError: (err) => console.error('Auth Error:', err),
                });
            }

            // Initialize directories
            await this.initializeDirectories();

            console.log('Connected successfully!');
            const sessionString = this.client.session.save();
            console.log('Session string (save this in .env as TELEGRAM_SESSION):', sessionString);
            
            await this.startListening();
            return true;
        } catch (error) {
            console.error('Failed to initialize Telegram client:', error);
            throw error;
        }
    }

    async initializeDirectories() {
        // Create media and users directories
        const mediaDir = path.join(__dirname, '../public/data/others');
        const usersDir = path.join(__dirname, '../public/data/users');
        await fs.mkdir(mediaDir, { recursive: true });
        await fs.mkdir(usersDir, { recursive: true });
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
        await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
    }

    async updateUserProfile(message) {
        try {
            // First try getting user from message
            const userId = message.peerId.userId.toString();
            let userEntity;

            if (this.userEntities.has(userId)) {
                userEntity = this.userEntities.get(userId);
            } else {
                try {
                    // Try getting full user info
                    const sender = await message.getSender();
                    if (sender) {
                        this.userEntities.set(userId, sender);
                        userEntity = sender;
                    }
                } catch (error) {
                    console.error('Error getting sender:', error);
                    
                    try {
                        // Fallback to getting user through client
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

            // If all attempts fail, return basic profile
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

            // Download the media
            const buffer = await this.client.downloadMedia(message.media);
            await fs.writeFile(filePath, buffer);

            // Return relative path for storage in JSON
            return `/data/others/${fileName}`;
        } catch (error) {
            console.error('Error downloading media:', error);
            return null;
        }
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

            // Always try to update profile if it's incomplete
            if (!userData.profile.firstName || !userData.profile.username) {
                console.log('Updating user profile...');
                userData.profile = await this.updateUserProfile(message);
            }

            // Check for duplicate message
            if (userData.messages.some(m => m.id === message.id)) {
                console.log(`Message ${message.id} already exists for user ${senderId}`);
                return;
            }

            // Handle media if present
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
}

module.exports = new TelegramService();