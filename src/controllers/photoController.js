const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../config/s3");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const sharp = require("sharp");

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

const uploadMultiple = upload.array('photos', 10); // 10 - maximum number of files

const optimizeImage = async (buffer, originalFormat) => {
  let sharpImage = sharp(buffer);
  
  // Resize the image to reasonable dimensions while maintaining aspect ratio
  sharpImage = sharpImage.resize({ 
    width: 1200, 
    height: 1200, 
    fit: 'inside', 
    withoutEnlargement: true // Don't enlarge small images
  });
  
  const format = originalFormat.toLowerCase();
  if (format.includes('png')) {
    return sharpImage.png({ compressionLevel: 9, palette: true }).toBuffer();
  } else if (format.includes('webp')) {
    return sharpImage.webp({ quality: 80 }).toBuffer();
  } else {
    return sharpImage.jpeg({ quality: 80 }).toBuffer();
  }
};

const getOptimizedContentType = (originalFormat) => {
  const format = originalFormat.toLowerCase();
  if (format.includes('png')) {
    return 'image/png';
  } else if (format.includes('webp')) {
    return 'image/webp';
  } else {
    return 'image/jpeg';
  }
};

const photoController = {
    uploadPhoto: async (req, res) => {
      try {
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${uuidv4()}${fileExtension}`;
        
        const optimizedBuffer = await optimizeImage(req.file.buffer, req.file.mimetype);
        const optimizedContentType = getOptimizedContentType(req.file.mimetype);
        
        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileName,
          Body: optimizedBuffer, // Use the optimized buffer
          ContentType: optimizedContentType, // Use appropriate content type
        };
  
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
  
        const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  
        const originalSize = req.file.buffer.length;
        const optimizedSize = optimizedBuffer.length;
        const savingsPercent = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
  
        res.status(200).json({
          success: true,
          fileName,
          fileUrl,
          optimization: {
            originalSize: originalSize,
            optimizedSize: optimizedSize,
            saved: originalSize - optimizedSize,
            savingsPercent: `${savingsPercent}%`
          }
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({
          success: false,
          message: "Failed to upload photo",
        });
      }
    },

    deletePhoto: async (req, res) => {
        try {
          const { fileName } = req.params;
    
          const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
          };
    
          const command = new DeleteObjectCommand(params);
          await s3Client.send(command);
    
          res.status(200).json({
            success: true,
            message: "Photo successfully deleted",
          });
        } catch (error) {
          console.error("Error deleting file:", error);
          res.status(500).json({
            success: false,
            message: "Failed to delete photo",
          });
        }
      },
      
      getSignedPhotoUrl: async (req, res) => {
        try {
          const { fileName } = req.params;
    
          const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
          };

          const command = new GetObjectCommand(params);
          
          const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
          res.status(200).json({
            success: true,
            signedUrl,
          });
        } catch (error) {
          console.error("Error getting signed URL:", error);
          res.status(500).json({
            success: false,
            message: "Failed to get photo URL",
          });
        }
      },

      uploadMultiplePhotos: async (req, res) => {
        try {
          if (!req.files || req.files.length === 0) {
            return res.status(400).json({
              success: false,
              message: "No files uploaded"
            });
          }
      
          const uploadResults = [];
          let totalOriginalSize = 0;
          let totalOptimizedSize = 0;
      
          // Process each file in the array
          for (const file of req.files) {
            const fileExtension = path.extname(file.originalname);
            const fileName = `${uuidv4()}${fileExtension}`;
            
            // Optimize the image
            const optimizedBuffer = await optimizeImage(file.buffer, file.mimetype);
            const optimizedContentType = getOptimizedContentType(file.mimetype);
            
            const params = {
              Bucket: process.env.AWS_S3_BUCKET,
              Key: fileName,
              Body: optimizedBuffer, // Use the optimized buffer
              ContentType: optimizedContentType, // Use appropriate content type
            };
      
            const command = new PutObjectCommand(params);
            await s3Client.send(command);
      
            const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
            
            const originalSize = file.buffer.length;
            const optimizedSize = optimizedBuffer.length;
            
            totalOriginalSize += originalSize;
            totalOptimizedSize += optimizedSize;
            
            uploadResults.push({
              originalName: file.originalname,
              fileName,
              fileUrl,
              optimization: {
                originalSize: originalSize,
                optimizedSize: optimizedSize,
                saved: originalSize - optimizedSize,
                savingsPercent: `${((originalSize - optimizedSize) / originalSize * 100).toFixed(2)}%`
              }
            });
          }
      
          const totalSavingsPercent = ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(2);
          
          res.status(200).json({
            success: true,
            files: uploadResults,
            totalOptimization: {
              originalSize: totalOriginalSize,
              optimizedSize: totalOptimizedSize,
              saved: totalOriginalSize - totalOptimizedSize,
              savingsPercent: `${totalSavingsPercent}%`
            }
          });
        } catch (error) {
          console.error("Error uploading files:", error);
          res.status(500).json({
            success: false,
            message: "Failed to upload photos",
          });
        }
      }
};

export { photoController, upload, uploadMultiple };