/**
 * 用于打包全部配置，将配置全部打包成一个文件
 * 服务端版本处理ani.json和pst.json的时候，不会打入帧数据
 */
import * as fs from "fs-extra";
import * as path from "path";
import { PublishBase } from "./Publish";
const PstFileName = "pst.json";
/**
 * 为客户端打包
 *
 * @param {string} inputDir 输入文件夹
 * @param {string} outFile 输出文件
 */
function packageForClient(inputDir: string, outFile: string, aniPath: string, pstPath?: string) {
    let p = fs.statSync(inputDir);
    if (!p.isDirectory()) {
        console.error("文件夹有误");
        return;
    }
    // ani文件夹特殊处理
    let outData = [];
    if (aniPath) {
        outData.push(getChunk("ani", 0, Buffer.from(JSON.stringify(parseAni(aniPath)))));
    }
    if (pstPath) {
        outData.push(getChunk("pst", 0, Buffer.from(JSON.stringify(parsePst(pstPath, path.join(inputDir, PstFileName))))));
    }

    let flist = fs.readdirSync(inputDir);
    flist.forEach(file => {
        if (pstPath && file == PstFileName) {
            return
        }
        let re = path.parse(file);
        let type: number;
        switch (re.ext) {
            case ".json":
                if (fs.existsSync(path.join(inputDir, re.name + ".bin"))) { //检查是否有 同名的 .bin文件，如果有，跳过
                    return;
                }
                type = 0;
                break;
            case ".bin":
                type = 1;
                break;
            default:
                return;
        }
        let p = path.join(inputDir, file);
        let buffer = fs.readFileSync(p);
        outData.push(getChunk(re.name, type, buffer));
    });
    console.log("配置打包到", outFile);
    fs.outputFileSync(outFile, Buffer.concat(outData));
}
function getChunk(name: string, type: number, buffer: Buffer) {
    let len = Buffer.byteLength(name);
    let bl = buffer.length;
    let bufferLen = 1 + len + 1 + getVarintLeng(bl) + bl;
    let out = Buffer.alloc(bufferLen);
    let pos = 0;
    out.writeUInt8(len, pos);
    pos++;
    out.write(name, pos, len);
    pos += len;
    out.writeUInt8(type, pos);
    pos++;
    pos = writeVarint(bl, out, pos);
    buffer.copy(out, pos);
    return out;
}
/**
 * 向字节流中写入32位的可变长度的整数(Protobuf)
 */
function writeVarint(value: number, buffer: Buffer, pos: number) {
    for (; ;) {
        if (value < 0x80) {
            buffer[pos++] = value;
            return pos;
        }
        else {
            buffer[pos++] = (value & 0x7F) | 0x80;
            value >>>= 7
        }
    }
}
function getVarintLeng(value) {
    let pos = 0;
    for (; ;) {
        if (value < 0x80) {
            pos++;
            return pos;
        }
        else {
            pos++;
            value >>>= 7
        }
    }
}

function walkDirs(dir, forEach, filter = (_file) => true) {
    let willChecked = [dir];
    while (willChecked.length) {
        let chk = willChecked.pop();
        if (!filter(chk)) {
            continue;
        }
        let stat = fs.statSync(chk);
        if (stat.isDirectory()) {
            let files = fs.readdirSync(chk);
            files.forEach(file => {
                willChecked.push(path.join(chk, file));
            });
        }
        else {
            forEach(chk, dir);
        }
    }
}

export function parsePst(pstPath: string, rawPstPath: string) {
    console.log(`parsePst:${pstPath},${rawPstPath}`);
    if (!fs.existsSync(pstPath)) {
        console.log(`no pstPath:${pstPath}`);
        return null;
    }
    var data = fs.existsSync(rawPstPath) ? fs.readJSONSync(rawPstPath) : {};
    let p = fs.statSync(pstPath);
    if (!p.isDirectory()) {
        console.error("给的pst路径文件夹有误");
        return null;
    }
    walkDirs(pstPath, file => {
        let p = path.dirname(file);
        let subDir = path.relative(pstPath, p);
        let dp = path.join(p, PstFileName);
        if (fs.existsSync(dp)) {
            //有这两个文件，ani文件夹有效
            let dat;
            try {
                dat = fs.readJSONSync(dp);
            } catch (e) {
                console.error(`解析pst数据，${dp}时出错`, e.message, e.stack);
                return;
            }
            let keys = Object.keys(dat);
            let key = "output";
            if (keys && keys.length == 1) {
                key = keys[0];
            }
            if (dat && dat[key]) {
                data[subDir] = dat[key];
            }
        }
    });
    return data;
}

/**
 * 处理ani文件夹
 *
 * @param {string} aniPath ani文件处理路径
 */
function parseAni(aniPath: string, saveTexture = true) {
    console.log(`parseAni:${aniPath}`);
    if (!fs.existsSync(aniPath)) {
        console.log(`no aniPath:${aniPath}`);
        return null;
    }
    var data = {};
    let p = fs.statSync(aniPath);
    if (!p.isDirectory()) {
        console.error("给的ani路径文件夹有误");
        return null;
    }
    walkDirs(aniPath, file => {
        let p = path.dirname(file);
        let subDir = path.relative(aniPath, p);
        //console.log("aaaaaa",p,subDir);
        let dp = path.join(p, "d.json");
        //检查子文件夹文件
        if (fs.existsSync(path.join(p, "a0.png")) && fs.existsSync(dp)) {
            //有这两个文件，ani文件夹有效
            let aniDat;
            try {
                aniDat = JSON.parse(fs.readFileSync(dp, "utf8"));
            }
            catch (e) {
                console.error(`解析ani数据，${dp}时出错`, e.message, e.stack);
                return;
            }
            if (!aniDat || !Array.isArray(aniDat)) {
                console.error(`解析ani数据，${dp}数据有误，不是数组`);
                return;
            }
            if (!saveTexture) {
                aniDat.length = 1;
            }
            data[subDir] = aniDat;
        }
    });
    return data;
}
let argv = process.argv.slice(2);

let argv0: any = argv[0];
if (argv0) {
    let cfgBinName = argv[1] || "cfgs.json";
    let opt = JSON.parse(argv0) as BuildOption;
    let a = new PublishBase();
    opt = a.initOpt(opt);
    let packageRoot = opt.dir_srcConfig;
    let clientDir = a.getCfgPath(opt, opt.lan, "raw");
    a.updateRes(opt);
    let aniPath = path.join(opt.dir_res, "a");
    let pstPath = opt.pstPath;
    if (pstPath) {
        pstPath = path.join(opt.dir_res, pstPath);
    }
    packageForClient(clientDir, path.join(packageRoot, cfgBinName), aniPath, pstPath);
}
console.log("complete");