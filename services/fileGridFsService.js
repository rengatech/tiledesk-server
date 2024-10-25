const mongoose = require("mongoose");
const multer = require("multer");
const Grid = require("gridfs-stream");
const uuidv4 = require('uuid/v4');
var config = require('../config/database');
var winston = require('../config/winston');
var pathlib = require('path');
const FileService = require("./fileService");

class FileGridFsService extends FileService {

    constructor(bucketName) {
        super();
        this.mongoURI = process.env.DATABASE_URI || process.env.MONGODB_URI || config.database;

        // connection
        this.conn = mongoose.createConnection(this.mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        this.conn.once("open", () => {
            this.gfs = Grid(this.conn.db, mongoose.mongo);
            this.gfs.collection(bucketName);
        });
    }

    async createFile(filename, data, path, contentType, options) {
        const stream = await this.gfs.createWriteStream({
            filename: filename,
            content_type: contentType,
            metadata: options.metadata
        });
        
        await stream.write(data);
        stream.end();
        return new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }

    async find(filename) {
        return new Promise(async (resolve, reject) => {
            let files = await this.gfs.files.find({ filename }).toArray();
            winston.debug("files", files);
            if (files.length > 0) {
                return resolve(files[0]);
            } else {
                return reject({ code: "ENOENT", msg: "File not found" });
            }
        });
    }

    async deleteFile(filename) {
        return new Promise(async (resolve, reject) => {
            let files = await this.gfs.files.find({ filename }).toArray();
            winston.debug("files", files);
            if (files.length > 0) {
                this.gfs.remove({ _id: files[0]._id }, function(error) {
                    if (error) {
                        winston.error("Error deleting gfs file", error);
                        return reject(error);
                    }
                    return resolve(files[0]);
                });
            } else {
                return reject({ msg: "File not found" });
            }
        });
    }

    getFileDataAsStream(filename) {
        return this.gfs.createReadStream({ filename });
    }

    getFileDataAsBuffer(filename) {
        return new Promise((resolve, reject) => {
            const stream = this.getFileDataAsStream(filename);
            const bufs = [];
            stream.on('data', (data) => bufs.push(data));
            stream.on('end', () => resolve(Buffer.concat(bufs)));
            stream.on('error', reject);
        });
    }

    getStorage(folderName) {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const folder = uuidv4();
                const subfolder = req.user && req.user.id ? `/users/${req.user.id}` : "/public";
                const path = `uploads${subfolder}/${folderName}/${folder}`;
                req.folder = folder;
                cb(null, pathlib.join(__dirname, path));
            },
            filename: (req, file, cb) => {
                cb(null, file.originalname);
            }
        });
        return multer({ storage });
    }

    getStorageFixFolder(folderName) {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const subfolder = req.user && req.user.id ? `/users/${req.user.id}` : "/public";
                const path = `uploads${subfolder}/${folderName}`;
                cb(null, pathlib.join(__dirname, path));
            },
            filename: async (req, file, cb) => {
                const pathExists = `uploads/public/${folderName}/${file.originalname}`;
                let fileExists = await this.gfs.files.find({ filename: pathExists }).toArray();
                if (fileExists.length > 0) {
                    req.upload_file_already_exists = true;
                    winston.debug("file already exists", pathExists);
                    return;
                }
                cb(null, file.originalname);
            }
        });
        return multer({ storage });
    }

    getStorageAvatar(folderName) {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const subfolder = req.user && req.user.id ? `/users/${req.user.id}` : "/public";
                const path = `uploads${subfolder}/${folderName}`;
                cb(null, pathlib.join(__dirname, path));
            },
            filename: async (req, file, cb) => {
                const filename = "photo.jpg";
                const pathExists = `uploads/public/${folderName}/${filename}`;
                let fileExists = await this.gfs.files.find({ filename: pathExists }).toArray();
                if (fileExists.length > 0) {
                    if (req.query.force) {
                        await this.deleteFile(pathExists);
                    } else {
                        req.upload_file_already_exists = true;
                        winston.debug("file already exists", pathExists);
                        return;
                    }
                }
                cb(null, filename);
            }
        });
        return multer({ storage });
    }
}

module.exports = FileGridFsService;
