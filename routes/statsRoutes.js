const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getPlayerLeaderboard,
  getTeamLeaderboard,
  getAnalytics,
  resetStats,
} = require('../controllers/statsController');

router.get('/dashboard', getDashboard);
router.get('/players/leaderboard', getPlayerLeaderboard);
router.get('/teams/leaderboard', getTeamLeaderboard);
router.get('/analytics', getAnalytics);
router.post('/reset', resetStats);

module.exports = router;
