const express = require('express');
const terminalOrchestratorService = require('../services/terminal-orchestrator.service');
const languageRuntimeService = require('../services/language-runtime.service');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/capabilities',
  asyncHandler(async (req, res) => {
    const capabilities = terminalOrchestratorService.getCapabilityMatrix();
    res.json({
      success: true,
      data: capabilities,
    });
  })
);

router.get(
  '/languages',
  asyncHandler(async (req, res) => {
    const languages = languageRuntimeService.getSupportedLanguages();
    const matrix = languageRuntimeService.getCapabilityMatrix();

    res.json({
      success: true,
      data: {
        languages,
        details: matrix,
      },
    });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = terminalOrchestratorService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  })
);

router.post(
  '/sessions',
  asyncHandler(async (req, res) => {
    const { language, file, workspaceDir, mode = 'auto', env = {} } = req.body;

    if (!language) {
      return res.status(400).json({
        success: false,
        error: 'language is required',
      });
    }

    try {
      const result = await terminalOrchestratorService.createTerminalSession({
        language,
        file,
        workspaceDir,
        mode,
        env,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create terminal session',
      });
    }
  })
);

router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const { userId, roomId } = req.query;

    let sessions;
    if (userId) {
      sessions = terminalOrchestratorService.getUserSessions(userId);
    } else if (roomId) {
      sessions = terminalOrchestratorService.getRoomSessions(roomId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'userId or roomId query parameter required',
      });
    }

    res.json({
      success: true,
      data: sessions,
    });
  })
);

router.get(
  '/sessions/:sessionId',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = terminalOrchestratorService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      data: session,
    });
  })
);

router.post(
  '/sessions/:sessionId/input',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'input is required',
      });
    }

    try {
      await terminalOrchestratorService.sendInput(sessionId, input);
      res.json({
        success: true,
        message: 'Input sent successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to send input',
      });
    }
  })
);

router.post(
  '/sessions/:sessionId/abort',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    try {
      await terminalOrchestratorService.sendInput(sessionId, '\u0003');
      res.json({
        success: true,
        message: 'Abort signal sent',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to abort',
      });
    }
  })
);

router.post(
  '/validate-command',
  asyncHandler(async (req, res) => {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'command is required',
      });
    }

    try {
      const sanitized = terminalOrchestratorService.sanitizeInput(command);
      res.json({
        success: true,
        data: {
          valid: true,
          command: sanitized,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message || 'Invalid command',
      });
    }
  })
);

router.delete(
  '/sessions/:sessionId',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    await terminalOrchestratorService.terminateSession(sessionId);

    res.json({
      success: true,
      message: 'Session terminated',
    });
  })
);

module.exports = router;
