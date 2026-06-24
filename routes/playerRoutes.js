const express = require('express');
const router = express.Router();
const {
  getPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
} = require('../controllers/playerController');
const upload = require('../middleware/upload');

router.route('/').get(getPlayers).post(upload.single('profilePicture'), createPlayer);

router
  .route('/:id')
  .get(getPlayer)
  .put(upload.single('profilePicture'), updatePlayer)
  .delete(deletePlayer);

module.exports = router;
