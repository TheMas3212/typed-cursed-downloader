import * as jsonfile from 'jsonfile';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { IncomingMessage } from 'http';

function followRedirects(url, callback: (res: IncomingMessage) => any): void {
  https.get(url, (res) => {
    if (res.statusCode === 302) {
      followRedirects(res.headers.location, callback);
    } else {
      callback(res);
    }
  }).end();
}

class ModInfo {
  projectID: number;
  fileID: number;
  required: boolean;
  constructor(data) {
    this.projectID = data.projectID;
    this.fileID = data.fileID;
    this.required = data.required || false;
  }
  download(location: string, name: string = ""): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const url = `https://addons-ecs.forgesvc.net/api/v2/addon/${this.projectID}/file/${this.fileID}`;
      followRedirects(url, (res) => {
        if (res.statusCode !== 200) {
          console.error(`Failed to fetch metadata for ${this.projectID}, ${this.fileID}`);
          reject(false);
        } else {
          const jdata = [];
          res.on("data", (chunk) => {
            jdata.push(chunk);
          });
          res.on("end", () => {
            const data = JSON.parse(jdata.join());
            followRedirects(data.downloadUrl, (res2) => {
              if (res2.statusCode !== 200) {
                console.error(`Failed to fetch ${this.projectID}, ${this.fileID}`);
                reject(false);
              } else {
                if (name === "") {
                  name = data.fileName;
                }
                fs.open(path.join(location, name), "w", (err, fd) => {
                  if (err) {
                    console.error(err);
                    reject(false);
                  } else {
                    res2.on("data", (chunk) => {
                      fs.writeSync(fd, chunk);
                    });
                    res2.on("end", () => {
                      fs.closeSync(fd);
                    });
                  }
                }); 
              }
            });
          });
        }
      });
    });
  }
}

class Manifest {
  manifestVersion: 1;
  minecraftVersion: string;
  name: string;
  version: string;
  author: string;
  projectID: string;
  overridesFolder: string;
  modloaderType: "forge" | "fabric";
  modloaderVersion: string;
  files: Array<ModInfo>;
  constructor(data) {
    if (!data.hasOwnProperty("manifestVersion")) {
      throw new Error("Invalid Manifest File");
    } else if (data.manifestVersion !== 1) {
      throw new Error("Invalid Manifest Version");
    }

    this.minecraftVersion = data.minecraft.version;
    this.name = data.name;
    this.version = data.version;
    this.author = data.author;
    this.projectID = data.projectID || "unknown";
    this.overridesFolder = data.overrides;
    const modloaderinfo = data.minecraft.modLoaders[0];
    this.modloaderType = modloaderinfo.id.split("-")[0];
    this.modloaderVersion = modloaderinfo.id;

    this.files = [];
    for (const mod of data.files) {
      this.files.push(new ModInfo(mod));
    }
  }
}

// const data = jsonfile.readFileSync(process.argv[2]);
// const manifest = new Manifest(data);
// manifest.files[0].download("/tmp");
// console.log(manifest);
