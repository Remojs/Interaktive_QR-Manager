const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/qrsController');

// Specific sub-routes must be declared before generic /:id
router.get('/:id/image',   ctrl.getImage);
router.patch('/:id/group', ctrl.assignGroup);
router.patch('/:id/lock',  ctrl.toggleLock);

router.get('/',       ctrl.getAll);
router.get('/:id',    ctrl.getOne);
router.post('/',      ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
