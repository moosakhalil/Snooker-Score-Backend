const mongoose = require('mongoose');

// Per-participant live + final state within a single match
const participantSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    teamSide: { type: String, enum: ['A', 'B', null], default: null }, // team mode only
    score: { type: Number, default: 0 },
    highestBreak: { type: Number, default: 0 },
    centuryCount: { type: Number, default: 0 },
    halfCenturyCount: { type: Number, default: 0 },
    missCount: { type: Number, default: 0 },
    foulCount: { type: Number, default: 0 },
    framesWon: { type: Number, default: 0 },
  },
  { _id: false }
);

const matchTeamSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    side: { type: String, enum: ['A', 'B'], required: true },
  },
  { _id: false }
);

const achievementSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    type: { type: String, enum: ['half-century', 'century'] },
    breakValue: Number,
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Match name is required'], trim: true },
    date: { type: Date, default: Date.now },
    location: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },

    mode: { type: String, enum: ['solo', 'team'], required: true },
    limitType: {
      type: String,
      enum: ['target', 'frames', 'innings', 'unlimited'],
      default: 'unlimited',
    },
    limitValue: { type: Number, default: 0 }, // target score / #frames / #innings

    settings: {
      missTracking: { type: Boolean, default: true },
      foulTracking: { type: Boolean, default: true },
      breakTracking: { type: Boolean, default: true },
      statsTracking: { type: Boolean, default: true },
    },

    status: { type: String, enum: ['setup', 'live', 'completed'], default: 'setup' },

    // How the turn order is built: 'auto' = system alternates A,B,A,B (team) / selection order (solo);
    // 'manual' = the order of participants below is exactly the sequence the admin chose.
    turnAllocation: { type: String, enum: ['auto', 'manual'], default: 'auto' },

    // Ball point values, snapshotted from global Config when the match is created,
    // so changing the defaults later never alters an existing match.
    ballValues: {
      red: { type: Number, default: 1 },
      yellow: { type: Number, default: 2 },
      green: { type: Number, default: 3 },
      brown: { type: Number, default: 4 },
      blue: { type: Number, default: 5 },
      pink: { type: Number, default: 6 },
      black: { type: Number, default: 7 },
    },

    participants: [participantSchema],
    teams: [matchTeamSchema], // team mode only

    turnOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    currentTurnIndex: { type: Number, default: 0 },
    currentBreak: { type: Number, default: 0 },

    // Each entry stores a compact snapshot of mutable state taken BEFORE the action,
    // enabling a clean single-step undo.
    actionLog: [mongoose.Schema.Types.Mixed],

    achievements: [achievementSchema],

    startTime: { type: Date },
    endTime: { type: Date },
    durationSeconds: { type: Number, default: 0 },

    winner: {
      kind: { type: String, enum: ['player', 'team', 'draw', null], default: null },
      ref: { type: mongoose.Schema.Types.ObjectId },
      label: { type: String, default: '' },
    },
    finalScore: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Helper: aggregate team scores (sum of member scores) for team mode
matchSchema.methods.teamScores = function () {
  const totals = { A: 0, B: 0 };
  this.participants.forEach((p) => {
    if (p.teamSide && totals[p.teamSide] !== undefined) totals[p.teamSide] += p.score;
  });
  return totals;
};

module.exports = mongoose.model('Match', matchSchema);
