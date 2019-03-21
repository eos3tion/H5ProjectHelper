import * as fs from "fs-extra";
import * as path from "path";
import { AMF3Bytes } from "./structure/AMF3Bytes";
import { svn } from "./Helper";

const enum Const {
    MapCfgPath = "map.json",

    JavaMapPath = "path.mm",

    ClientMapDataPath = "maps.bin",
}

const enum GameLayerID {
    /**
     * 顶部场景特效
     * 用于放云朵等特效
     * 无鼠标事件
     * 不排序
     */
    CeilEffect = 1790,
    /**
     * 底部场景特效层
     */
    BottomEffect = 1740,
    /**
     * 地图之下的一层
     */
    UnderMap = 1705,

}

interface MapJSONData {
    path: string;
    columns: number;
    rows: number;
    ext: string;
    /**
     * 扩展名类型
     */
    extType: number;
    type: number;
    gridWidth: number;
    gridHeight: number;
    pWidth: number;
    pHeight: number;
    maxPicX: number;
    maxPicY: number;
    pathdataB64: string;

    /**
     * 透明点数据的 base64字符串
     */
    adataB64?: string;
    effs: Eff[];

    /**
     * 特效数据
     */
    effsData: number[][];

    width?: number;
    height?: number;
}

interface Eff {
    uri: string;
    layerID: number;
    sX: number;
    sY: number;
    rotation: number;
    x: number;
    y: number;
    eid: string;
    sx: number;
    sy: number;
    r: number;
    l: number;
    duration?: number;
    speedX?: number;
    speedY?: number;
    seed?: number;
    spX?: number;
    spY?: number;
    ct?: number;
    dur?: number;
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
    const effects = [];
    const cfgs: { [dir: string]: MapJSONData } = {};
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
            cfgs[dir] = cfg;
            cfg.width = cfg.width || cfg.pWidth * (cfg.maxPicX + 1) || cfg.columns * cfg.gridWidth;
            cfg.height = cfg.height || cfg.pHeight * (cfg.maxPicY + 1) || cfg.rows * cfg.gridHeight;
            cfg.extType = cfg.ext == ".png" ? 1 : 0;
            let effs = cfg.effs;
            let len = effs && effs.length || 0;
            if (len) {
                let datas = [];
                for (let i = 0; i < len; i++) {
                    //制作全局的字符串字典
                    const eff = effs[i];
                    let eid = eff.uri;
                    let idx = effects.indexOf(eid);
                    if (idx == -1) {
                        idx = effects.length;
                        effects[idx] = eid;
                    }
                    let layerID = [GameLayerID.BottomEffect, GameLayerID.CeilEffect, GameLayerID.UnderMap].indexOf(eff.layerID);
                    let data = [idx, eff.x, eff.y, layerID, (eff.sX || 1) * 100 >> 0, (eff.sY || 1) * 100 >> 0, eff.rotation || 0];
                    if (eff.dur) {//有duration即可
                        data.push(eff.dur, eff.speedX >> 0, eff.speedY >> 0, eff.seed);
                    }
                    datas.push(data);
                }
                cfg.effsData = datas;
            }
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

    //存储文件
    let temp = new Buffer(1024 * 1024 * 10);
    let elen = effects.length;
    let pos = 0;
    pos = writeVarint(elen, temp, pos);
    for (let i = 0; i < elen; i++) {
        let uri = effects[i];
        let len = Buffer.byteLength(uri);
        temp.writeUInt8(len, pos++);
        temp.write(uri, pos, len);
        pos += len;
    }
    const KEYS = ["path", "columns", "rows", "width", "height", "gridWidth", "gridHeight", "extType"];
    for (let dir in cfgs) {
        const cfg = cfgs[dir];
        for (let i = 0; i < KEYS.length; i++) {
            const key = KEYS[i];
            pos = writeVarint(+cfg[key] || 0, temp, pos);
        }
        pos = writeB64(cfg.pathdataB64, temp, pos);
        pos = writeB64(cfg.adataB64, temp, pos);
        let effs = cfg.effsData;
        let len = effs && effs.length || 0;
        pos = writeVarint(len, temp, pos);//长度 0 代表没特效 , 7 表示普通特效  10 表示移动的特效
        for (let i = 0; i < len; i++) {
            pos = writeEff(effs[i], temp, pos);
        }
    }

    let cfgfile = path.join(cfgDir, Const.ClientMapDataPath);
    fs.outputFileSync(cfgfile, temp.slice(0, pos));
    console.log(`写入${cfgfile}`);
    //存储服务端文件
    if (javaCfgPath) {
        const ba = new AMF3Bytes();
        ba.writeObject(javaDatas);
        fs.outputFileSync(javaCfgPath, ba.usedBuffer);
        console.log(`写入${javaCfgPath}`);
    }
}

function writeEff(eff: number[], buffer: Buffer, pos: number) {
    let len = eff.length;
    pos = writeVarint(len, buffer, pos);
    for (let i = 0; i < len; i++) {
        pos = writeVarint(zigzag32(eff[i]), buffer, pos);
    }
    return pos;
}
function zigzag32(n: number) {
    return (n << 1) ^ (n >> 31);
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