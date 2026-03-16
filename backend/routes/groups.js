const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/groupsController');

router.get('/',      ctrl.getAll);
router.post('/',     ctrl.create);
router.put('/:id',   ctrl.rename);
router.delete('/:id', ctrl.remove);

module.exports = router;
