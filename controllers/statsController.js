const asyncHandler = require('express-async-handler');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Match = require('../models/Match');

// @route GET /api/stats/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const [totalMatches, totalPlayers, totalTeams, players, recentMatches] = await Promise.all([
    Match.countDocuments({ status: 'completed' }),
    Player.countDocuments(),
    Team.countDocuments(),
    Player.find().select('name stats'),
    Match.find({ status: 'completed' })
      .sort({ endTime: -1 })
      .limit(5)
      .populate('participants.player', 'name')
      .populate('teams.team', 'name'),
  ]);

  const highestBreak = players.reduce((m, p) => Math.max(m, p.stats.highestBreak), 0);
  const totalCenturies = players.reduce((s, p) => s + p.stats.centuryCount, 0);
  const liveMatches = await Match.countDocuments({ status: 'live' });

  res.json({
    totalMatches,
    totalPlayers,
    totalTeams,
    highestBreak,
    totalCenturies,
    liveMatches,
    recentMatches,
  });
});

const PLAYER_RANK_FIELDS = {
  highestBreak: 'stats.highestBreak',
  totalScore: 'stats.totalScore',
  wins: 'stats.wins',
  centuries: 'stats.centuryCount',
};

// @route GET /api/stats/players/leaderboard?rankBy=highestBreak
const getPlayerLeaderboard = asyncHandler(async (req, res) => {
  const rankBy = PLAYER_RANK_FIELDS[req.query.rankBy] || 'stats.highestBreak';
  const players = await Player.find().sort({ [rankBy]: -1 }).limit(50);
  res.json(players);
});

const TEAM_RANK_FIELDS = {
  wins: 'stats.wins',
  averageScore: 'stats.totalTeamScore', // proxy; average derived client-side
  totalScore: 'stats.totalTeamScore',
};

// @route GET /api/stats/teams/leaderboard?rankBy=wins
const getTeamLeaderboard = asyncHandler(async (req, res) => {
  const rankBy = TEAM_RANK_FIELDS[req.query.rankBy] || 'stats.wins';
  const teams = await Team.find().populate('members', 'name').sort({ [rankBy]: -1 }).limit(50);
  res.json(teams);
});

// @route GET /api/stats/analytics
const getAnalytics = asyncHandler(async (req, res) => {
  const players = await Player.find();
  const teams = await Team.find();

  const topScorers = [...players]
    .sort((a, b) => b.stats.totalScore - a.stats.totalScore)
    .slice(0, 10)
    .map((p) => ({ name: p.name, value: p.stats.totalScore }));

  const highestBreaks = [...players]
    .sort((a, b) => b.stats.highestBreak - a.stats.highestBreak)
    .slice(0, 10)
    .map((p) => ({ name: p.name, value: p.stats.highestBreak }));

  const mostCenturies = [...players]
    .sort((a, b) => b.stats.centuryCount - a.stats.centuryCount)
    .slice(0, 10)
    .map((p) => ({ name: p.name, value: p.stats.centuryCount }));

  const winRates = [...players]
    .filter((p) => p.stats.matchesPlayed > 0)
    .map((p) => ({
      name: p.name,
      value: Math.round((p.stats.wins / p.stats.matchesPlayed) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const teamRankings = [...teams]
    .sort((a, b) => b.stats.wins - a.stats.wins)
    .slice(0, 10)
    .map((t) => ({ name: t.name, value: t.stats.wins }));

  const teamScores = [...teams]
    .sort((a, b) => b.stats.totalTeamScore - a.stats.totalTeamScore)
    .slice(0, 10)
    .map((t) => ({ name: t.name, value: t.stats.totalTeamScore }));

  res.json({ topScorers, highestBreaks, mostCenturies, winRates, teamRankings, teamScores });
});

// @route POST /api/stats/reset
// Clears all rankings & statistics by zeroing every player's and team's career stats.
// Match records themselves are NOT deleted — stats are a derived cache.
const resetStats = asyncHandler(async (req, res) => {
  const zeroPlayer = {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    framesWon: 0,
    totalScore: 0,
    highestBreak: 0,
    centuryCount: 0,
    halfCenturyCount: 0,
    missCount: 0,
    foulCount: 0,
  };
  const zeroTeam = {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    totalTeamScore: 0,
    highestTeamBreak: 0,
  };

  const [p, t] = await Promise.all([
    Player.updateMany({}, { $set: { stats: zeroPlayer } }),
    Team.updateMany({}, { $set: { stats: zeroTeam } }),
  ]);

  res.json({
    message: 'Rankings and statistics cleared',
    playersReset: p.modifiedCount,
    teamsReset: t.modifiedCount,
  });
});

module.exports = {
  getDashboard,
  getPlayerLeaderboard,
  getTeamLeaderboard,
  getAnalytics,
  resetStats,
};
