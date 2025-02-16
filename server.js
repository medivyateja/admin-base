const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

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

// Routes
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    try {
        res.render('pages/dashboard', {
            title: 'Dashboard',
            currentPage: 'dashboard',
            layout: 'layout'
        });
    } catch (error) {
        next(error);
    }
});

app.get('/knowledge-base', (req, res, next) => {
    try {
        res.render('pages/knowledge-base', {
            title: 'Knowledge Base',
            currentPage: 'knowledge-base',
            layout: 'layout'
        });
    } catch (error) {
        next(error);
    }
});

app.get('/push-message', (req, res, next) => {
    try {
        res.render('pages/push-message', {
            title: 'Push Message',
            currentPage: 'push-message',
            layout: 'layout'
        });
    } catch (error) {
        next(error);
    }
});

app.get('/chat', (req, res, next) => {
    try {
        res.render('pages/chat', {
            title: 'Chat',
            currentPage: 'chat',
            layout: 'layout'
        });
    } catch (error) {
        next(error);
    }
});

app.get('/categories', (req, res, next) => {
    try {
        res.render('pages/categories', {
            title: 'Categories',
            currentPage: 'categories',
            layout: 'layout'
        });
    } catch (error) {
        next(error);
    }
});

app.get('/settings', (req, res, next) => {
    try {
        res.render('pages/settings', {
            title: 'Settings',
            currentPage: 'settings',
            layout: 'layout'
        });
    } catch (error) {
        next(error);
    }
});

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