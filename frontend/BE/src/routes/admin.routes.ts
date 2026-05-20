import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import {
  getAllUsers, getUserById, createUser, updateUser, deleteUser,
  getAllCoaches, createCoach, updateCoach, removeCoach,
  adminGetGroups, adminCreateGroup, adminUpdateGroup, adminArchiveGroup,
  adminGetOrgStats, adminGetOrgs, adminCreateOrg, adminUpdateOrg, adminGetOrgOverview,
  adminGetActivity, adminGetMoodDistribution,
} from "../controllers/admin.controller";
import {
  getPlatformSettings,
  updatePlatformSettings,
  uploadLogo,
  uploadLoader,
} from "../controllers/platformSettings.controller";

const router = Router();

router.use(authMiddleware);
router.use(requireRole("superadmin"));

router.get("/activity", adminGetActivity);
router.get("/mood-distribution", adminGetMoodDistribution);

// Users
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Coaches
router.get("/coaches", getAllCoaches);
router.post("/coaches", createCoach);
router.put("/coaches/:id", updateCoach);
router.delete("/coaches/:id", removeCoach);

// Groups
router.get("/groups", adminGetGroups);
router.post("/groups", adminCreateGroup);
router.put("/groups/:id", adminUpdateGroup);
router.patch("/groups/:id/archive", adminArchiveGroup);

// Organizations — /orgs/stats MUST come before /orgs/:id
router.get("/orgs/stats", adminGetOrgStats);
router.get("/orgs", adminGetOrgs);
router.post("/orgs", adminCreateOrg);
router.get("/orgs/:id/overview", adminGetOrgOverview);
router.put("/orgs/:id", adminUpdateOrg);

// Platform settings
router.get("/settings", getPlatformSettings);
router.patch("/settings", updatePlatformSettings);
router.post("/settings/upload-logo", uploadLogo);
router.post("/settings/upload-loader", uploadLoader);

export default router;
