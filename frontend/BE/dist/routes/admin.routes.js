"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const admin_controller_1 = require("../controllers/admin.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.use((0, auth_middleware_1.requireRole)("superadmin"));
// Users
router.get("/users", admin_controller_1.getAllUsers);
router.post("/users", admin_controller_1.createUser);
router.get("/users/:id", admin_controller_1.getUserById);
router.put("/users/:id", admin_controller_1.updateUser);
router.delete("/users/:id", admin_controller_1.deleteUser);
// Coaches
router.get("/coaches", admin_controller_1.getAllCoaches);
router.post("/coaches", admin_controller_1.createCoach);
router.put("/coaches/:id", admin_controller_1.updateCoach);
router.delete("/coaches/:id", admin_controller_1.removeCoach);
// Groups
router.get("/groups", admin_controller_1.adminGetGroups);
router.post("/groups", admin_controller_1.adminCreateGroup);
router.put("/groups/:id", admin_controller_1.adminUpdateGroup);
router.patch("/groups/:id/archive", admin_controller_1.adminArchiveGroup);
exports.default = router;
