const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const routes = require('./routes');
const telegramRoutes = require('./routes/telegram');
const telegramService = require('./services/telegram');
require('dotenv').config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up EJS and layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Telegram service
(async () => {
    try {
        await telegramService.initialize();
        await telegramService.startListening();
        console.log('Telegram service initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Telegram service:', error);
        process.exit(1);
    }
})();

// Use routes
app.use('/', routes);
app.use('/api/telegram', telegramRoutes);

// Create data directory for Telegram messages
const dataDir = path.join(__dirname, 'public', 'data', 'users');
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory for Telegram messages');
}

// 404 Error Handler
app.use((req, res) => {
    res.status(404).render('pages/error', {
        title: '404 Not Found',
        message: 'Page not found',
        currentPage: '',
        layout: 'layout'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('pages/error', {
        title: '500 Server Error',
        message: 'Something went wrong!',
        currentPage: '',
        layout: 'layout'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;