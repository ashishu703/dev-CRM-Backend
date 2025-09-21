const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let admin = null;
try {
  // Lazy require to avoid crashing if not installed
  admin = require('firebase-admin');
} catch (_e) {
  admin = null;
}

class StorageService {
  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    this.uploadRoot = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true });
    }

    if (this.provider === 'firebase') {
      this.#initFirebase();
    }
  }

  #initFirebase() {
    if (!admin) {
      console.warn('firebase-admin not installed; falling back to local storage');
      this.provider = 'local';
      return;
    }

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_BUCKET) {
      console.warn('Firebase env not fully configured; falling back to local storage');
      this.provider = 'local';
      return;
    }

    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.FIREBASE_BUCKET,
      });
    }

    this.bucket = admin.storage().bucket();
  }

  async uploadBuffer(buffer, options = {}) {
    const { folder = 'misc', filename, mimeType = 'application/octet-stream' } = options;
    const safeFolder = folder.replace(/[^a-zA-Z0-9_\/-]/g, '_');
    const uniqueName = filename || `${uuidv4()}`;

    if (this.provider === 'firebase' && this.bucket) {
      const destination = `${safeFolder}/${uniqueName}`;
      const file = this.bucket.file(destination);
      await file.save(buffer, { contentType: mimeType, public: true, resumable: false });
      await file.makePublic();
      return `https://storage.googleapis.com/${this.bucket.name}/${destination}`;
    }

    // Local storage
    const destFolder = path.join(this.uploadRoot, safeFolder);
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }
    const destPath = path.join(destFolder, uniqueName);
    await fs.promises.writeFile(destPath, buffer);
    // Return URL path that server.js serves from /uploads
    const publicPath = `/uploads/${safeFolder}/${uniqueName}`.replace(/\\/g, '/');
    return publicPath;
  }
}

module.exports = new StorageService();


