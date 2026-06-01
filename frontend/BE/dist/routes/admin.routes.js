"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const admin_controller_1 = require("../controllers/admin.controller");
const platformSettings_controller_1 = require("../controllers/platformSettings.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.use((0, auth_middleware_1.requireRole)("superadmin"));
router.get("/activity", admin_controller_1.adminGetActivity);
router.get("/mood-distribution", admin_controller_1.adminGetMoodDistribution);
router.get("/overview-stats", admin_controller_1.adminGetOverviewStats);
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
// Organizations — /orgs/stats MUST come before /orgs/:id
router.get("/orgs/stats", admin_controller_1.adminGetOrgStats);
router.get("/orgs", admin_controller_1.adminGetOrgs);
router.post("/orgs", admin_controller_1.adminCreateOrg);
router.get("/orgs/:id/overview", admin_controller_1.adminGetOrgOverview);
router.put("/orgs/:id", admin_controller_1.adminUpdateOrg);
// Platform settings
router.get("/settings", platformSettings_controller_1.getPlatformSettings);
router.patch("/settings", platformSettings_controller_1.updatePlatformSettings);
router.post("/settings/upload-logo", platformSettings_controller_1.uploadLogo);
exports.default = router;
