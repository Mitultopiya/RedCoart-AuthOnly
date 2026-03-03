import express from 'express';
import * as m from '../controllers/mastersController.js';
import { verifyToken, adminOrManager } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(adminOrManager);

router.get('/cities', m.listCities);
router.post('/cities', m.createCity);
router.put('/cities/:id', m.updateCity);
router.delete('/cities/:id', m.removeCity);

router.get('/hotels', m.listHotels);
router.post('/hotels', m.createHotel);
router.put('/hotels/:id', m.updateHotel);
router.delete('/hotels/:id', m.removeHotel);

router.get('/vehicles', m.listVehicles);
router.post('/vehicles', m.createVehicle);
router.put('/vehicles/:id', m.updateVehicle);
router.delete('/vehicles/:id', m.removeVehicle);

router.get('/activities', m.listActivities);
router.post('/activities', m.createActivity);
router.put('/activities/:id', m.updateActivity);
router.delete('/activities/:id', m.removeActivity);

export default router;
