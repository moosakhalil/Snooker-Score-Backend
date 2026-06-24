const asyncHandler = require('express-async-handler');
const Team = require('../models/Team');

const parseMembers = (members) => {
  if (!members) return [];
  if (Array.isArray(members)) return members;
  try {
    const parsed = JSON.parse(members);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(members).split(',').map((s) => s.trim()).filter(Boolean);
  }
};

// @route GET /api/teams  (?search=)
const getTeams = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = search ? { name: new RegExp(search, 'i') } : {};
  const teams = await Team.find(filter).populate('members', 'name nickname').sort({ name: 1 });
  res.json(teams);
});

// @route GET /api/teams/:id
const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id).populate('members', 'name nickname stats');
  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }
  res.json(team);
});

// @route POST /api/teams  (admin)
const createTeam = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Team name is required');
  }
  const team = await Team.create({
    name,
    members: parseMembers(req.body.members),
    logo: req.file ? `/uploads/${req.file.filename}` : '',
  });
  res.status(201).json(await team.populate('members', 'name nickname'));
});

// @route PUT /api/teams/:id  (admin)
const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }
  if (req.body.name !== undefined) team.name = req.body.name;
  if (req.body.members !== undefined) team.members = parseMembers(req.body.members);
  if (req.file) team.logo = `/uploads/${req.file.filename}`;
  await team.save();
  res.json(await team.populate('members', 'name nickname'));
});

// @route DELETE /api/teams/:id  (admin)
const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }
  await team.deleteOne();
  res.json({ message: 'Team removed' });
});

module.exports = { getTeams, getTeam, createTeam, updateTeam, deleteTeam };
