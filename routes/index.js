const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

router.get('/dashboard', (req, res, next) => {
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

router.get('/knowledge-base', (req, res, next) => {
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

router.get('/push-message', (req, res, next) => {
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

router.get('/chat', (req, res, next) => {
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

router.get('/settings', (req, res, next) => {
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

module.exports = router;