const asyncHandler = require('express-async-handler');
const Match = require('../models/Match');
const Config = require('../models/Config');
const applyMatchStats = require('../utils/applyMatchStats');

const BALL_VALUES = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
const BALL_NAMES = Object.keys(BALL_VALUES);

/* ------------------------------ helpers ------------------------------ */

const populateMatch = (q) =>
  q
    .populate('participants.player', 'name nickname profilePicture')
    .populate('teams.team', 'name logo');

const activeParticipant = (match) => {
  const activeId = String(match.turnOrder[match.currentTurnIndex]);
  return match.participants.find((p) => String(p.player) === activeId);
};

// Compact snapshot of mutable state, stored on each action for single-step undo.
const snapshot = (match) => ({
  participants: match.participants.map((p) => ({
    score: p.score,
    highestBreak: p.highestBreak,
    centuryCount: p.centuryCount,
    halfCenturyCount: p.halfCenturyCount,
    missCount: p.missCount,
    foulCount: p.foulCount,
  })),
  currentTurnIndex: match.currentTurnIndex,
  currentBreak: match.currentBreak,
  achievementsLen: match.achievements.length,
});

const restore = (match, snap) => {
  snap.participants.forEach((s, i) => {
    Object.assign(match.participants[i], s);
  });
  match.currentTurnIndex = snap.currentTurnIndex;
  match.currentBreak = snap.currentBreak;
  match.achievements.splice(snap.achievementsLen);
};

// Finalize the active player's break: attribute century/half-century, then reset.
const finalizeBreak = (match) => {
  const p = activeParticipant(match);
  const val = match.currentBreak;
  if (p && match.settings.breakTracking && val > 0) {
    if (val >= 100) {
      p.centuryCount += 1;
      match.achievements.push({ player: p.player, type: 'century', breakValue: val });
    } else if (val >= 50) {
      p.halfCenturyCount += 1;
      match.achievements.push({ player: p.player, type: 'half-century', breakValue: val });
    }
  }
  match.currentBreak = 0;
};

const advanceTurn = (match) => {
  match.currentTurnIndex = (match.currentTurnIndex + 1) % match.turnOrder.length;
};

// Has the target score been reached? (only relevant for limitType 'target')
const targetReached = (match) => {
  if (match.limitType !== 'target' || !match.limitValue) return false;
  if (match.mode === 'team') {
    const t = match.teamScores();
    return t.A >= match.limitValue || t.B >= match.limitValue;
  }
  return match.participants.some((p) => p.score >= match.limitValue);
};

// Finalize a match: decide the winner, mark completed, persist, update career stats.
// Returns the populated match with winner.label resolved. Shared by manual end + target auto-win.
const completeMatch = async (match) => {
  if (match.status === 'live') finalizeBreak(match);

  if (match.mode === 'solo') {
    const sorted = [...match.participants].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const tie = sorted[1] && sorted[1].score === top.score;
    if (tie) {
      match.winner = { kind: 'draw', ref: null, label: 'Draw' };
    } else {
      top.framesWon += 1;
      match.winner = { kind: 'player', ref: top.player, label: '' };
    }
    match.finalScore = sorted.map((s) => s.score).join(' - ');
  } else {
    const totals = match.teamScores();
    let winSide = null;
    if (totals.A > totals.B) winSide = 'A';
    else if (totals.B > totals.A) winSide = 'B';

    if (!winSide) {
      match.winner = { kind: 'draw', ref: null, label: 'Draw' };
    } else {
      const wt = match.teams.find((t) => t.side === winSide);
      match.winner = { kind: 'team', ref: wt.team, label: '' };
      match.participants.filter((p) => p.teamSide === winSide).forEach((p) => (p.framesWon += 1));
    }
    match.finalScore = `${totals.A} - ${totals.B}`;
  }

  match.status = 'completed';
  match.endTime = new Date();
  match.durationSeconds = match.startTime
    ? Math.max(0, Math.round((match.endTime - match.startTime) / 1000))
    : 0;

  await match.save();

  // Resolve winner label from populated refs
  const populated = await populateMatch(Match.findById(match._id));
  if (populated.winner.kind === 'player') {
    const wp = populated.participants.find((p) => String(p.player._id) === String(populated.winner.ref));
    populated.winner.label = wp?.player?.name || 'Winner';
  } else if (populated.winner.kind === 'team') {
    const wt = populated.teams.find((t) => String(t.team._id) === String(populated.winner.ref));
    populated.winner.label = wt?.team?.name || 'Winner';
  }
  await Match.findByIdAndUpdate(match._id, { 'winner.label': populated.winner.label });

  await applyMatchStats(populated, 1);
  return populated;
};

/* ------------------------------ CRUD ------------------------------ */

// @route POST /api/matches  (admin) — create in "setup" status
const createMatch = asyncHandler(async (req, res) => {
  const {
    name,
    date,
    location,
    notes,
    mode,
    limitType,
    limitValue,
    settings,
    players,
    teams,
    turnAllocation,
  } = req.body;

  if (!name || !mode) {
    res.status(400);
    throw new Error('Match name and mode are required');
  }

  let participants = [];
  let teamDocs = [];

  if (mode === 'solo') {
    if (!Array.isArray(players) || players.length < 2) {
      res.status(400);
      throw new Error('Solo mode needs at least 2 players');
    }
    participants = players.map((pid) => ({ player: pid, teamSide: null }));
  } else if (mode === 'team') {
    // teams = [{ team: id, side: 'A', members: [playerId,...] }, {...B}]
    if (!Array.isArray(teams) || teams.length !== 2) {
      res.status(400);
      throw new Error('Team mode needs exactly 2 teams');
    }
    teamDocs = teams.map((t) => ({ team: t.team, side: t.side }));
    teams.forEach((t) => {
      (t.members || []).forEach((pid) => participants.push({ player: pid, teamSide: t.side }));
    });
    if (participants.length < 2) {
      res.status(400);
      throw new Error('Each team needs at least one member');
    }
  } else {
    res.status(400);
    throw new Error('Invalid game mode');
  }

  // Snapshot the current global ball values into the match
  const config = await Config.getSingleton();

  const match = await Match.create({
    name,
    date: date || Date.now(),
    location,
    notes,
    mode,
    limitType: limitType || 'unlimited',
    limitValue: limitValue || 0,
    settings: { ...settings },
    turnAllocation: turnAllocation === 'manual' ? 'manual' : 'auto',
    ballValues: config.ballValues.toObject ? config.ballValues.toObject() : config.ballValues,
    participants,
    teams: teamDocs,
  });

  res.status(201).json(await populateMatch(Match.findById(match._id)));
});

// @route GET /api/matches  (?status=&search=&from=&to=)
const getMatches = asyncHandler(async (req, res) => {
  const { status, search, from, to } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.name = new RegExp(search, 'i');
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const matches = await populateMatch(Match.find(filter)).sort({ date: -1 });
  res.json(matches);
});

// @route GET /api/matches/:id
const getMatch = asyncHandler(async (req, res) => {
  const match = await populateMatch(Match.findById(req.params.id));
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }
  res.json(match);
});

// @route POST /api/matches/:id/start  (admin)
const startMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }
  if (match.status === 'completed') {
    res.status(400);
    throw new Error('Match already completed');
  }

  // Build turn order. Team mode interleaves A,B,A,B...
  if (match.mode === 'team') {
    const a = match.participants.filter((p) => p.teamSide === 'A').map((p) => p.player);
    const b = match.participants.filter((p) => p.teamSide === 'B').map((p) => p.player);
    const order = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (a[i]) order.push(a[i]);
      if (b[i]) order.push(b[i]);
    }
    match.turnOrder = order;
  } else {
    match.turnOrder = match.participants.map((p) => p.player);
  }

  match.status = 'live';
  match.currentTurnIndex = 0;
  match.currentBreak = 0;
  match.startTime = new Date();
  await match.save();
  res.json(await populateMatch(Match.findById(match._id)));
});

/* --------------------------- live scoring --------------------------- */

// @route POST /api/matches/:id/action  (admin)
// body: { type: 'pot'|'miss'|'foul'|'endBreak'|'nextPlayer'|'undo', ball?, foulValue? }
const scoreAction = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }
  if (match.status !== 'live') {
    res.status(400);
    throw new Error('Match is not live');
  }

  const { type } = req.body;

  if (type === 'undo') {
    const last = match.actionLog.pop();
    if (!last) {
      res.status(400);
      throw new Error('Nothing to undo');
    }
    restore(match, last.stateBefore);
    await match.save();
    return res.json(await populateMatch(Match.findById(match._id)));
  }

  const before = snapshot(match);
  const p = activeParticipant(match);
  if (!p) {
    res.status(400);
    throw new Error('No active player');
  }

  let logEntry = { type, stateBefore: before, ts: new Date() };

  switch (type) {
    case 'pot': {
      const ball = req.body.ball;
      if (!BALL_NAMES.includes(ball)) {
        res.status(400);
        throw new Error('Invalid ball');
      }
      // Use this match's snapshotted ball values (fallback to standard values)
      const value =
        match.ballValues && match.ballValues[ball] != null ? match.ballValues[ball] : BALL_VALUES[ball];
      p.score += value;
      match.currentBreak += value;
      p.highestBreak = Math.max(p.highestBreak, match.currentBreak);
      logEntry.ball = ball;
      logEntry.points = value;
      break;
    }
    case 'foul': {
      const foulValue = Number(req.body.foulValue) || 4;
      if (![4, 5, 6, 7].includes(foulValue)) {
        res.status(400);
        throw new Error('Foul value must be 4-7');
      }
      if (match.settings.foulTracking) p.foulCount += 1;
      finalizeBreak(match);
      // Foul points are awarded to the next player in rotation (the opponent).
      advanceTurn(match);
      const beneficiary = activeParticipant(match);
      if (beneficiary) beneficiary.score += foulValue;
      logEntry.foulValue = foulValue;
      break;
    }
    case 'miss': {
      if (match.settings.missTracking) p.missCount += 1;
      finalizeBreak(match);
      advanceTurn(match);
      break;
    }
    case 'endBreak':
    case 'nextPlayer': {
      finalizeBreak(match);
      advanceTurn(match);
      break;
    }
    default:
      res.status(400);
      throw new Error('Unknown action type');
  }

  match.actionLog.push(logEntry);
  await match.save();

  // Target-score mode: first to reach the target wins — auto-complete the match.
  if (targetReached(match)) {
    return res.json(await completeMatch(match));
  }

  res.json(await populateMatch(Match.findById(match._id)));
});

// @route PUT /api/matches/:id/edit-score  (admin) — manual correction
const editScore = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }
  const { playerId, fields } = req.body; // fields: {score, highestBreak, ...}
  const p = match.participants.find((x) => String(x.player) === String(playerId));
  if (!p) {
    res.status(404);
    throw new Error('Participant not found in match');
  }
  ['score', 'highestBreak', 'centuryCount', 'halfCenturyCount', 'missCount', 'foulCount'].forEach(
    (k) => {
      if (fields && fields[k] !== undefined) p[k] = Number(fields[k]);
    }
  );
  await match.save();
  res.json(await populateMatch(Match.findById(match._id)));
});

// @route PUT /api/matches/:id/end  (admin)
const endMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }
  if (match.status === 'completed') {
    res.status(400);
    throw new Error('Match already completed');
  }

  res.json(await completeMatch(match));
});

// @route DELETE /api/matches/:id  (admin)
const deleteMatch = asyncHandler(async (req, res) => {
  const match = await populateMatch(Match.findById(req.params.id));
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }
  // Roll back career stats if this match had been counted
  if (match.status === 'completed') await applyMatchStats(match, -1);
  await Match.deleteOne({ _id: match._id });
  res.json({ message: 'Match removed' });
});

module.exports = {
  createMatch,
  getMatches,
  getMatch,
  startMatch,
  scoreAction,
  editScore,
  endMatch,
  deleteMatch,
};
