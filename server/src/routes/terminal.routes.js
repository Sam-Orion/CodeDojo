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
