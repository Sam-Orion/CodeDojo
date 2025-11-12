const express = require('express');
const filesController = require('../controllers/files.controller');

const router = express.Router();

// File system operations
router.get('/filesystem', filesController.getFileSystem);
router.get('/read', filesController.readFile);
router.post('/write', filesController.writeFile);
router.post('/create', filesController.createFile);
router.delete('/delete', filesController.deleteFile);
router.post('/rename', filesController.renameFile);
router.post('/copy', filesController.copyFile);
router.get('/download', filesController.downloadFile);

// File upload operations
router.post('/upload', filesController.uploadFile);

module.exports = router;
