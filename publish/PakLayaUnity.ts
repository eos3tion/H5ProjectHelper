import * as fs from "fs";
import * as path from "path";

export function pakLayaUnityRes(baseDir: string, output: string) {
    let stacks = [baseDir];
    let bufs = [];
    while (stacks.length) {
        let cur = stacks.pop();
        if (cur) {
            let list = fs.readdirSync(cur);
            for (let i = 0; i < list.length; i++) {
                const sub = list[i];
                let full = path.join(cur, sub);
                let stat = fs.statSync(full);
                if (stat.isFile()) {
                    if (/\.(png|jpg|jpeg|gif|bmp|zip|meta|json)/.test(sub)) {
                        continue;
                    }
                    bufs.push(getFileChunk(path.relative(baseDir, full).replace(/\\/g, "/"), fs.readFileSync(full)))
                } else if (stat.isDirectory()) {
                    stacks.push(full);
                }
            }
        } else {
            break;
        }
    }
    fs.writeFileSync(output, Buffer.concat(bufs));
}

function getFileChunk(filename, buf) {
    let fl = Buffer.byteLength(filename);
    let bl = buf.length;
    let out = Buffer.alloc(getVarintLeng(fl) + fl + getVarintLeng(bl) + bl);
    let pos = 0;
    pos = writeVarint(fl, out, pos);
    out.write(filename, pos, fl);
    pos += fl;
    pos = writeVarint(bl, out, pos);
    buf.copy(out, pos);
    return out;
}

function writeVarint(value, buffer, pos) {
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