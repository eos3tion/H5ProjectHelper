import * as fs from "fs-extra";
import * as path from "path";
import { AMF3Bytes } from "./structure/AMF3Bytes";
import { svn } from "./Helper";

const enum Const {
    MapCfgPath = "map.json",

    JavaMapPath = "path.mm",

    ClientMapDataPath = "maps.bin",
}

interface MapJSONData {
    path: string;
    /**
     * 地图数据
     */
    mapBytesB64: string;
}

/**
 * 
 * @param cfgDir 配置路径
 * @param mapPath 地图路径
 */
export function parseMap(cfgDir: string, mapPath: string, javaCfgPath?: string) {
    svn.cleanup(mapPath);
    svn.update(mapPath);
    const dirs = fs.readdirSync(mapPath);
    const javaDatas = [];
    //存储文件
    let temp = Buffer.alloc(1024 * 1024 * 10);
    let pos = 2;
    let len = 0;
    //预处理
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const dirpath = path.join(mapPath, dir);
        //检查客户端数据
        const cfgpath = path.join(dirpath, Const.MapCfgPath);
        console.log(`正在处理:${dirpath}`);
        if (fs.existsSync(cfgpath)) {//检查客户端文件
            let cfg: MapJSONData
            try {
                cfg = fs.readJsonSync(cfgpath);
            } catch (e) {
                console.log(`[${cfgpath}]配置有误，不符合JSON格式`, e);
                continue;
            }
            let mapBytesB64 = cfg.mapBytesB64;
            if (mapBytesB64) {
                pos = writeB64(mapBytesB64, temp, pos);
                len++;
                const javapath = path.join(dirpath, Const.JavaMapPath);
                if (fs.existsSync(javapath)) {
                    //添加配置
                    const javaData = {
                        collect: "item.dat",
                        id: cfg.path,
                        mapid: cfg.path,
                        monster: "",
                        path: Const.JavaMapPath
                    }
                    javaDatas.push(javaData);
                }
            }
        }
    }
    //回写地图总长度
    temp.writeUInt16BE(len, 0);
    let cfgfile = path.join(cfgDir, Const.ClientMapDataPath);
    fs.outputFileSync(cfgfile, temp.subarray(0, pos));
    console.log(`写入${cfgfile}`);
    //存储服务端文件
    if (javaCfgPath) {
        const ba = new AMF3Bytes();
        ba.writeObject(javaDatas);
        fs.outputFileSync(javaCfgPath, ba.usedBuffer);
        console.log(`写入${javaCfgPath}`);
    }
}



function writeB64(b64: string, buffer: Buffer, pos: number) {
    let b = b64 && Buffer.from(b64, "base64");
    let len = b ? b.length : 0;
    pos = writeVarint(len, buffer, pos);
    if (b) {
        b.copy(buffer, pos);
    }
    return pos + len;
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
            value >>>= 7;
        }
    }
}