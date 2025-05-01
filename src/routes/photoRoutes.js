const express = require("express");
const { photoController, upload, uploadMultiple } = require("../controllers/photoController.js");
const router = express.Router();

router.post("/upload", upload.single("photo"), photoController.uploadPhoto);
router.delete("/:fileName", photoController.deletePhoto);
router.get("/signed-url/:fileName", photoController.getSignedPhotoUrl);
router.post("/upload-multiple", uploadMultiple, photoController.uploadMultiplePhotos);

module.exports =  router;