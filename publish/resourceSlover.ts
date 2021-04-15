import * as fs from "fs-extra";
import * as paths from "path";
import * as crypto from "crypto";

interface ResMd5Data {
    fullPath: string,
    md5File: string
}

export function solveResourceWithDict(inputDir: string, outputDir: string, dict: { [url: string]: ResInfo }, version: number) {
    if (dict) {
        let resArr = [];
        if (dict) {
            for (let key in dict) {
                let info = dict[key];
                if (!info || info.isDel) {
                    continue;
                }
                let { fullPath, md5 } = info;
                let extname = paths.extname(fullPath);
                let md5Name = md5.substring(0, 2);
                let md5TfName = paths.join(md5Name, (md5.substring(2, md5.length) + extname))
                let vo = {} as ResMd5Data;
                vo.fullPath = paths.join(inputDir, fullPath);
                vo.md5File = md5TfName;
                resArr.push(vo);
            }
            writeFile(resArr, inputDir, outputDir, version);
            copyResToFile(resArr, outputDir);
        }
    }
}
export async function checkFileResource(inputDir: string, outputDir: string, version: number, resArr?: ResMd5Data[]) {
    if (!resArr) {
        resArr = [];
    }
    var pathsArr: string[] = [];
    let willChecked = [inputDir];
    while (willChecked.length) {
        let chk = willChecked.pop();
        let stat = fs.statSync(chk);
        if (stat.isDirectory()) {
            if (paths.extname(chk) == ".svn") {
                continue;
            }
            let files = fs.readdirSync(chk);
            files.forEach(file => {
                willChecked.push(paths.join(chk, file));
            });
        }
        else {
            pathsArr.push(chk);
        }
    }
    await checkResPath(pathsArr, resArr);
    copyResToFile(resArr, outputDir);
    writeFile(resArr, inputDir, outputDir, version);
    return resArr;
}

async function checkResPath(arr: string[], resArr: ResMd5Data[]) {
    for (var i = 0; i < arr.length; i++) {
        let pathStr = arr[i];
        await solveSinFile(pathStr, resArr);
    }
}

function solveSinFile(pathStr: string, resArr: ResMd5Data[]) {
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
    return new Promise((resolve, _) => {
        stream.on("end", () => {
            md5 = md5util.digest("hex");
            let extname = paths.extname(pathStr);
            let md5Name = md5.substring(0, 2);
            let md5TfName = paths.join(md5Name, (md5.substring(2, md5.length) + extname));
            let vo = {} as ResMd5Data;
            vo.fullPath = pathStr;
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

function doFileHandle(pathStr: string, md5File: string, filePath: string) {
    var cStr = pathStr.replace(/\\/g, "/");
    var str = cStr.replace(filePath, "") + "\t" + md5File + "\n";
    var str1 = str.replace(/\\/g, "/")
    return str1;
}

function writeFile(resArr: ResMd5Data[], inputDir: string, outputDir: string, version: number) {
    if (resArr && resArr.length > 0) {
        let writeStr = "";
        for (let i = 0; i < resArr.length; i++) {
            let info = resArr[i];
            if (info) {
                let { fullPath, md5File } = info;
                writeStr += doFileHandle(fullPath, md5File, inputDir)
            }
        }
        var versionTxtName = version + ".txt";
        var outtxt = paths.join(outputDir, versionTxtName);
        fs.writeFile(outtxt, writeStr, function (err) {
            if (err) {
                return console.error(err);
            }
            console.log(`写入完成！`)
        });
    }
}

async function copyResToFile(resArr: ResMd5Data[], outputDir: string) {
    if (resArr) {
        while (resArr.length > 0) {
            let info = resArr.pop();
            await copyRes(outputDir, info)
        }
    }
}

async function copyRes(outputDir: string, info: ResMd5Data) {
    if (info) {
        let { fullPath, md5File } = info;
        if (fs.existsSync(fullPath)) {
            let fliename = paths.join(outputDir, md5File.substring(0, 2));
            let dirPath = paths.join(outputDir, md5File);
            if (!fs.existsSync(fliename)) {
                fs.mkdir(fliename, { recursive: true }, (err) => {
                    if (err) {
                        throw err;
                    } else {
                        if (!fs.existsSync(dirPath)) {
                            fs.copyFileSync(fullPath, dirPath);
                            console.log("拷贝" + fullPath + "成功！");
                        }
                    }
                });
            } else {
                if (!fs.existsSync(dirPath)) {
                    fs.copyFileSync(fullPath, dirPath);
                    console.log("拷贝" + fullPath + "成功！");
                }
            }
        }
    }
}