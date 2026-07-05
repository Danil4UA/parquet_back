const express = require("express");
const { photoController, upload, uploadMultiple } = require("../controllers/photoController.js");
const { authenticateToken } = require("../middleware/authMiddleware");
const router = express.Router();

// All photo operations are admin-only — uploads/deletes go straight to S3
router.post("/upload", authenticateToken, upload.single("photo"), photoController.uploadPhoto);
router.delete("/:fileName", authenticateToken, photoController.deletePhoto);
router.get("/signed-url/:fileName", authenticateToken, photoController.getSignedPhotoUrl);
router.post("/upload-multiple", authenticateToken, uploadMultiple, photoController.uploadMultiplePhotos);

module.exports =  router;
