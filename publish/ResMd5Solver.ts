import * as fs from "fs-extra";
import * as paths from "path";
import * as crypto from "crypto";
import { walkDirs } from "./Helper";

interface ResMd5Data {
    fullPath: string,
    /**
     * 形如
     * 7c/0083aef2dc9d4f791705456fe52aeb.png
     */
    md5File: string,
    uri: string;
}

export function solveResourceWithDict(inputDir: string, dict: { [url: string]: ResInfo }, versionFile: string) {
    if (dict) {
        let resArr = [];
        if (dict) {
            for (let key in dict) {
                let info = dict[key];
                if (!info || info.isDel) {
                    continue;
                }
                let { fullPath, md5, uri } = info;
                let extname = paths.extname(fullPath);
                let md5Name = md5.substring(0, 2);
                let md5TfName = paths.join(md5Name, (md5.substring(2, md5.length) + extname))
                let vo = {} as ResMd5Data;
                vo.fullPath = paths.join(inputDir, fullPath);
                vo.md5File = md5TfName;
                vo.uri = uri;
                resArr.push(vo);
            }
            writeFile(resArr, versionFile);
            // copyResToFile(resArr, outputDir);
        }
        return resArr;
    }
}

export async function checkFileResource(inputDir: string, versionFile: string, resArr?: ResMd5Data[]) {
    if (!resArr) {
        resArr = [];
    }
    var pathsArr: string[] = [];
    walkDirs(inputDir, file => {
        pathsArr.push(file);
    }, file => !(fs.statSync(file).isDirectory() && paths.basename(file) === ".svn"));

    await checkResPath(pathsArr, resArr, inputDir);
    writeFile(resArr, versionFile);
    return resArr;
}

async function checkResPath(arr: string[], resArr: ResMd5Data[], inputDir: string) {
    for (var i = 0; i < arr.length; i++) {
        let pathStr = arr[i];
        await solveSinFile(pathStr, resArr, inputDir);
    }
}

function solveSinFile(pathStr: string, resArr: ResMd5Data[], inputDir: string) {
    let slovedPath = pathStr.slice(2);
    let stream = fs.createReadStream(pathStr);
    let md5util = crypto.createHash('md5');
    let md5: string;//getMD5(buffer);        
    try {
        stream.read();
    } catch (e) {
        console.log(`${slovedPath}流读取失败，${e.message}`);
        return;
    }
    return new Promise<void>((resolve) => {
        stream.on("end", () => {
            md5 = md5util.digest("hex");
            let extname = paths.extname(pathStr);
            let md5Name = md5.substring(0, 2);
            let md5TfName = paths.join(md5Name, (md5.substring(2, md5.length) + extname));
            let vo = {} as ResMd5Data;
            vo.fullPath = pathStr;
            var cStr = pathStr.replace(/\\/g, "/");
            vo.uri = cStr.replace(inputDir + "/", "");
            vo.md5File = md5TfName;
            resArr.push(vo);
            resolve();
        })
        stream.on("data", (data) => {
            md5util.update(data);
        });
        stream.on("error", err => {
            console.log(pathStr, "发生错误", err.message)
            md5util.end();
            resolve();//还是当resolve处理
        })
    });
}

function doFileHandle(uri: string, md5File: string) {
    var str = uri + "\t" + md5File + "\n";
    var str1 = str.replace(/\\/g, "/")
    return str1;
}

function writeFile(resArr: ResMd5Data[], versionFile: string) {
    if (resArr && resArr.length > 0) {
        let writeStr = "";
        for (let i = 0; i < resArr.length; i++) {
            let info = resArr[i];
            if (info) {
                let { uri, md5File } = info;
                writeStr += doFileHandle(uri, md5File)
            }
        }
        fs.writeFileSync(versionFile, writeStr);
        console.log(`写入[${versionFile}]完成！`)
    }
}

export function copyResToFile(resArr: ResMd5Data[], outputDir: string) {
    if (resArr) {
        for (let i = 0; i < resArr.length; i++) {
            const info = resArr[i];
            copyRes(outputDir, info);
        }
    }
}

function copyRes(outputDir: string, info: ResMd5Data) {
    if (info) {
        let { fullPath, md5File } = info;
        if (fs.existsSync(fullPath)) {
            let dirPath = paths.join(outputDir, md5File.substring(0, 2));
            let fliename = paths.join(outputDir, md5File);
            fs.mkdirsSync(dirPath);
            if (!fs.existsSync(fliename)) {
                fs.copyFileSync(fullPath, fliename);
            }
        }
    }
}