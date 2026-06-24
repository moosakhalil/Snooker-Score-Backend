const asyncHandler = require('express-async-handler');
const Player = require('../models/Player');

// @route GET /api/players  (?search=)
const getPlayers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = search
    ? { $or: [{ name: new RegExp(search, 'i') }, { nickname: new RegExp(search, 'i') }] }
    : {};
  const players = await Player.find(filter).sort({ name: 1 });
  res.json(players);
});

// @route GET /api/players/:id
const getPlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) {
    res.status(404);
    throw new Error('Player not found');
  }
  res.json(player);
});

// @route POST /api/players  (admin)
const createPlayer = asyncHandler(async (req, res) => {
  const { name, nickname, contactNumber } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Player name is required');
  }
  const player = await Player.create({
    name,
    nickname,
    contactNumber,
    profilePicture: req.file ? `/uploads/${req.file.filename}` : '',
  });
  res.status(201).json(player);
});

// @route PUT /api/players/:id  (admin)
const updatePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) {
    res.status(404);
    throw new Error('Player not found');
  }
  const { name, nickname, contactNumber } = req.body;
  if (name !== undefined) player.name = name;
  if (nickname !== undefined) player.nickname = nickname;
  if (contactNumber !== undefined) player.contactNumber = contactNumber;
  if (req.file) player.profilePicture = `/uploads/${req.file.filename}`;
  await player.save();
  res.json(player);
});

// @route DELETE /api/players/:id  (admin)
const deletePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) {
    res.status(404);
    throw new Error('Player not found');
  }
  await player.deleteOne();
  res.json({ message: 'Player removed' });
});

module.exports = { getPlayers, getPlayer, createPlayer, updatePlayer, deletePlayer };
