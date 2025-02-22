// routes/telegram.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const telegramService = require('../services/telegram');

// Ensure directories exist
async function ensureDirectories() {
    const dirs = [
        path.join(__dirname, '../public/data/users'),
        path.join(__dirname, '../public/data/others')
    ];
    
    for (const dir of dirs) {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }
}

// Initialize directories
ensureDirectories().catch(console.error);

// Get all users
router.get('/users', async (req, res) => {
    try {
        const usersDir = path.join(__dirname, '../public/data/users');
        
        // Check if directory exists
        try {
            await fs.access(usersDir);
        } catch {
            await fs.mkdir(usersDir, { recursive: true });
            return res.json([]);
        }

        const files = await fs.readdir(usersDir);
        
        // Read and parse all user files
        const users = await Promise.all(
            files.filter(file => file.endsWith('.json'))
                .map(async (file) => {
                    try {
                        const content = await fs.readFile(
                            path.join(usersDir, file), 
                            'utf8'
                        );
                        return JSON.parse(content);
                    } catch (error) {
                        console.error(`Error reading user file ${file}:`, error);
                        return null;
                    }
                })
        );

        // Filter valid users and sort by latest message
        const validUsers = users
            .filter(user => user !== null)
            .sort((a, b) => {
                const aDate = a.messages.length ? 
                    new Date(a.messages[a.messages.length - 1].date) : new Date(0);
                const bDate = b.messages.length ? 
                    new Date(b.messages[b.messages.length - 1].date) : new Date(0);
                return bDate - aDate;
            });

        res.json(validUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get messages for a specific user
router.get('/messages/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userFile = path.join(__dirname, '../public/data/users', `${userId}.json`);

        // Check if user file exists
        try {
            await fs.access(userFile);
        } catch {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = JSON.parse(await fs.readFile(userFile, 'utf8'));
        res.json({
            user: {
                userId: userData.userId,
                profile: userData.profile
            },
            messages: userData.messages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send message to a user
router.post('/send', async (req, res) => {
    try {
        const { userId, message } = req.body;

        // Validate input
        if (!userId || !message?.trim()) {
            return res.status(400).json({ error: 'UserId and message are required' });
        }

        // Send message through Telegram service
        const result = await telegramService.sendMessage(userId, message.trim());
        res.json({ success: true, messageId: result.id });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Get user profile
router.get('/users/:userId/profile', async (req, res) => {
    try {
        const { userId } = req.params;
        const userFile = path.join(__dirname, '../public/data/users', `${userId}.json`);

        // Check if user file exists
        try {
            await fs.access(userFile);
        } catch {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userData = JSON.parse(await fs.readFile(userFile, 'utf8'));
        res.json({
            userId: userData.userId,
            profile: userData.profile
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Search users
router.get('/users/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const usersDir = path.join(__dirname, '../public/data/users');
        const files = await fs.readdir(usersDir);
        
        const users = await Promise.all(
            files.filter(file => file.endsWith('.json'))
                .map(async (file) => {
                    try {
                        const content = await fs.readFile(
                            path.join(usersDir, file), 
                            'utf8'
                        );
                        return JSON.parse(content);
                    } catch {
                        return null;
                    }
                })
        );

        const searchResults = users
            .filter(user => {
                if (!user) return false;
                const searchString = `
                    ${user.profile.firstName || ''} 
                    ${user.profile.lastName || ''} 
                    ${user.profile.username || ''}
                `.toLowerCase();
                return searchString.includes(query.toLowerCase());
            })
            .sort((a, b) => {
                const aDate = a.messages.length ? 
                    new Date(a.messages[a.messages.length - 1].date) : new Date(0);
                const bDate = b.messages.length ? 
                    new Date(b.messages[b.messages.length - 1].date) : new Date(0);
                return bDate - aDate;
            });

        res.json(searchResults);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Serve media files
router.get('/media/:fileName', async (req, res) => {
    try {
        const { fileName } = req.params;
        const mediaPath = path.join(__dirname, '../public/data/others', fileName);

        // Check if file exists
        try {
            await fs.access(mediaPath);
        } catch {
            return res.status(404).json({ error: 'Media not found' });
        }

        res.sendFile(mediaPath);
    } catch (error) {
        console.error('Error serving media:', error);
        res.status(500).json({ error: 'Failed to serve media' });
    }
});

module.exports = router;