const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *         firstname:
 *           type: string
 *         lastname:
 *           type: string
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *     UnblockRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: Utilisateur créé
 */
router.post('/register', ctrl.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authentification utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authentification réussie
 */
router.post('/login', ctrl.login);

/**
 * @swagger
 * /api/auth/unblock:
 *   post:
 *     summary: Débloquer un compte
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UnblockRequest'
 *     responses:
 *       200:
 *         description: Compte débloqué
 */
router.post('/unblock', ctrl.unblock);

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: Vérifier le statut de connectivité et le mode d'authentification
 *     responses:
 *       200:
 *         description: Statut actuel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 online:
 *                   type: boolean
 *                   description: True si Firebase est accessible
 *                 authMode:
 *                   type: string
 *                   enum: [firebase, local]
 *                   description: Mode d'authentification actuel
 *                 useFirebase:
 *                   type: boolean
 *                   description: Configuration USE_FIREBASE
 *                 configuredMode:
 *                   type: string
 *                   description: Mode configuré (auto, firebase, local)
 */
router.get('/status', ctrl.status);

/**
 * @swagger
 * /api/auth/refresh-connectivity:
 *   post:
 *     summary: Forcer le rafraîchissement du cache de connectivité
 *     responses:
 *       200:
 *         description: Cache rafraîchi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 online:
 *                   type: boolean
 *                 authMode:
 *                   type: string
 */
router.post('/refresh-connectivity', ctrl.refreshConnectivity);

/**
 * @swagger
 * /api/auth/blocked-users:
 *   get:
 *     summary: Récupérer la liste des utilisateurs bloqués
 *     responses:
 *       200:
 *         description: Liste des utilisateurs bloqués
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_user:
 *                     type: string
 *                   email:
 *                     type: string
 *                   firstname:
 *                     type: string
 *                   lastname:
 *                     type: string
 *                   attempts:
 *                     type: integer
 *                   created_at:
 *                     type: string
 */
router.get('/blocked-users', ctrl.getBlockedUsers);

/**
 * @swagger
 * /api/auth/unblock/{id}:
 *   post:
 *     summary: Débloquer un utilisateur par son ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'utilisateur à débloquer
 *     responses:
 *       200:
 *         description: Utilisateur débloqué
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                 mode:
 *                   type: string
 *       400:
 *         description: Erreur lors du déblocage
 */
router.post('/unblock/:id', ctrl.unblockById);

module.exports = router;
