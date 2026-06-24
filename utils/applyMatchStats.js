const Player = require('../models/Player');
const Team = require('../models/Team');

// Normalize an id whether the ref is a raw ObjectId or a populated document.
const idOf = (x) => (x && x._id ? String(x._id) : String(x));

/**
 * Apply a completed match's results to the career stats of all players and teams.
 * Called exactly once, when a match transitions to "completed".
 * `direction` = 1 to add stats, -1 to roll back (used if an admin deletes a match).
 */
async function applyMatchStats(match, direction = 1) {
  if (!match.settings.statsTracking) return;

  const d = direction;

  // Determine winning side/player for win-loss attribution
  const winnerKind = match.winner?.kind;
  const winnerRef = match.winner?.ref ? String(match.winner.ref) : null;

  // ----- Players -----
  for (const p of match.participants) {
    const player = await Player.findById(p.player);
    if (!player) continue;

    player.stats.matchesPlayed += d * 1;
    player.stats.totalScore += d * p.score;
    player.stats.centuryCount += d * p.centuryCount;
    player.stats.halfCenturyCount += d * p.halfCenturyCount;
    player.stats.missCount += d * p.missCount;
    player.stats.foulCount += d * p.foulCount;
    player.stats.framesWon += d * p.framesWon;

    if (d > 0) {
      player.stats.highestBreak = Math.max(player.stats.highestBreak, p.highestBreak);
    }

    // Wins/losses
    let isWinner = false;
    if (match.mode === 'solo' && winnerKind === 'player') {
      isWinner = winnerRef === idOf(p.player);
    } else if (match.mode === 'team' && winnerKind === 'team') {
      const myTeam = match.teams.find((t) => t.side === p.teamSide);
      isWinner = myTeam && idOf(myTeam.team) === winnerRef;
    }
    if (winnerKind !== 'draw' && winnerKind) {
      if (isWinner) player.stats.wins += d * 1;
      else player.stats.losses += d * 1;
    }

    // Clamp negatives on rollback
    Object.keys(player.stats.toObject ? player.stats.toObject() : player.stats).forEach((k) => {
      if (typeof player.stats[k] === 'number' && player.stats[k] < 0) player.stats[k] = 0;
    });

    await player.save();
  }

  // ----- Teams (team mode) -----
  if (match.mode === 'team') {
    const teamTotals = match.teamScores();
    for (const mt of match.teams) {
      const team = await Team.findById(mt.team);
      if (!team) continue;

      team.stats.totalMatches += d * 1;
      team.stats.totalTeamScore += d * (teamTotals[mt.side] || 0);

      // Highest team break = max break by any member on that side
      const sideBreak = Math.max(
        0,
        ...match.participants.filter((p) => p.teamSide === mt.side).map((p) => p.highestBreak)
      );
      if (d > 0) team.stats.highestTeamBreak = Math.max(team.stats.highestTeamBreak, sideBreak);

      const isWinner = winnerKind === 'team' && winnerRef === idOf(mt.team);
      if (winnerKind !== 'draw' && winnerKind) {
        if (isWinner) team.stats.wins += d * 1;
        else team.stats.losses += d * 1;
      }

      Object.keys(team.stats.toObject ? team.stats.toObject() : team.stats).forEach((k) => {
        if (typeof team.stats[k] === 'number' && team.stats[k] < 0) team.stats[k] = 0;
      });

      await team.save();
    }
  }
}

module.exports = applyMatchStats;
