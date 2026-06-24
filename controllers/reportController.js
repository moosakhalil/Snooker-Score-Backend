const asyncHandler = require('express-async-handler');
const Match = require('../models/Match');
const generateMatchReport = require('../utils/pdfReport');

// @route GET /api/reports/match/:id  -> streams a PDF
const matchReport = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate('participants.player', 'name nickname')
    .populate('teams.team', 'name');
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }

  const safeName = (match.name || 'match').replace(/[^a-z0-9]/gi, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_report.pdf"`);
  generateMatchReport(match, res);
});

module.exports = { matchReport };
