const express = require('express');
const storageController = require('../controllers/storage.controller');

const router = express.Router();

// Provider management
router.get('/providers', storageController.listProviders);
router.get('/user-providers', storageController.getUserProviders);
router.post('/link', storageController.linkProvider);
router.delete('/unlink/:credentialId', storageController.unlinkProvider);
router.post('/default', storageController.setDefaultProvider);
router.get('/default', storageController.getDefaultProvider);

// File operations
router.get('/list', storageController.listFiles);
router.get('/read', storageController.readFile);
router.post('/write', storageController.writeFile);
router.post('/rename', storageController.renameFile);
router.post('/delete', storageController.deleteFile);
router.get('/search', storageController.searchFiles);
router.get('/metadata', storageController.getFileMetadata);

// Audit logs
router.get('/audit-logs', storageController.getAuditLogs);

module.exports = router;
