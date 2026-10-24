import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';

// Ensure upload directory exists
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

// Subdirectories
const dirs = ['products', 'avatars', 'labels'];
dirs.forEach(dir => {
  const fullPath = path.join(config.UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = req.uploadSubdir || 'products';
    cb(null, path.join(config.UPLOAD_DIR, subdir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  if (config.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${config.ALLOWED_TYPES.join(', ')}`), false);
  }
};

// Product images upload (up to 10 images)
export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 10,
  }
}).array('images', 10);

// Single avatar upload
export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 1,
  }
}).single('avatar');

// Middleware to set upload subdirectory
export function setUploadDir(subdir) {
  return (req, res, next) => {
    req.uploadSubdir = subdir;
    next();
  };
}
