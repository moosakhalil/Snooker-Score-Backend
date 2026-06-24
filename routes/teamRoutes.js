const express = require('express');
const router = express.Router();
const {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
} = require('../controllers/teamController');
const upload = require('../middleware/upload');

router.route('/').get(getTeams).post(upload.single('logo'), createTeam);

router.route('/:id').get(getTeam).put(upload.single('logo'), updateTeam).delete(deleteTeam);

module.exports = router;
