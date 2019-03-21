import "./Extend";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs-extra";
import * as archiver from "archiver";
import { TextDecoder } from "util";
import { Client, ConnectConfig } from "ssh2";
import * as crypto from "crypto";
import * as cwebp from "cwebp-bin";
import { Buffer } from "buffer";



function webp(input: string, output: string, quality = 75) {
    return executeCmd(cwebp, [input, "-o", output, "-q", quality + ""]);
}


function exec(opt: string | { cmd?: string, cwd?: string, notThrowError?: boolean }, ...args) {
    if (typeof opt === "string") {
        cmd = opt;
    } else {
        var { cmd, cwd, notThrowError } = opt;
    }
    let option: cp.SpawnOptions = { stdio: "inherit" };
    if (cwd) {
        option.cwd = cwd;
    }
    let result = cp.spawnSync(cmd, args, option);
    let cmdstring = `${cmd} ${args.join(" ")}`;
    console.log("开始执行：", cmdstring);
    if (result.status && !notThrowError) {
        console.error(`status:${result.status},${result.stderr ? result.stderr.toString() : `执行失败：\t${cmdstring}`}`);
    }
    console.log("执行完成：", cmdstring);
    if (result.stdout) {
        console.log(result.stdout);
    }
    return result;
}

function ssh(cmd: string, cfg: ConnectConfig) {
    let output = [];
    return new Promise<{ code: number | null, signal?: string, output: string }>((resolve, reject) => {
        let con = new Client();
        con.on("ready", () => {
            con.exec(cmd, (err, stream) => {
                if (err) {
                    reject(err);
                }
                stream.on('close', (code, signal) => {
                    con.end();
                    console.log(`ssh ${cmd} 执行完成`);
                    resolve({ code, signal, output: Buffer.concat(output).toString("utf8") });
                }).on('data', function (data) {
                    output.push(data);
                    console.log(data.toString("utf8"));
                }).stderr.on('data', function (data: Buffer) {
                    output.push(data);
                    console.log(data.toString("utf8"));
                });
            });
        }).on("error", err => {
            con.end();
            reject(err);
        }).connect(cfg);
    });
}

function git(cmd: string, cwd: string, ...args) {
    exec({ cmd: "git", cwd }, cmd, ...args);
}
function parseGitUrl(url: string, username: string, password: string) {
    let result = /^(http[s]?):\/\/(.*?)$/.exec(url);
    if (result) {
        return `${result[1]}://${username}:${password}@${result[2]}`;
    }
    return url;
}



/**
 * 执行svn命令
 */
function svnExec(cmd: string, opt: cp.SpawnSyncOptions = { stdio: 'pipe' }, ...arg: string[]) {
    console.log(`开始尝试执行: svn ${cmd} ${arg.join(" ")}`);
    let args = [];
    args[0] = cmd;
    args[1] = "--username";
    args[2] = "builder";
    args[3] = "--password";
    args[4] = "builder";
    for (let i = 0; i < arg.length; i++) {
        args.push(arg[i]);
    }
    let obj = cp.spawnSync("svn", args, opt);
    if (obj.status) {
        throw Error(`执行失败: svn ${cmd} ${arg.join(" ")}，执行结果：\nstatus:${obj.status}\n${obj.stderr.toString()}`);
    }
    console.log(`执行完成: svn ${cmd} ${arg.join(" ")}`);
    return obj;
}

const svn = {
    /**
    * SVN 清理
    * 同步指令，指令执行完毕后才会继续执行后续指令
    * @param   {string} distDir 目标路径
    * @return : {Object}
    * <ul>
    * <li>pid Number Pid of the child process</li>
    * <li>output Array Array of results from stdio output</li>
    * <li>stdout Buffer|String The contents of output[1]</li>
    * <li>stderr Buffer|String The contents of output[2]</li>
    * <li>status Number The exit code of the child process</li>
    * <li>signal String The signal used to kill the child process</li>
    * <li>error Error The error object if the child process failed or timed out</li>
    * </ul>
    */
    cleanup(distDir: string) {
        return svnExec("cleanup", undefined, distDir);
    },

    /**
    * SVN 还原
    * 同步指令，指令执行完毕后才会继续执行后续指令
    * @param   {string} dist 目标路径
    */
    revert(dist: string) {
        return svnExec("revert", undefined, dist);
    },
    /**
    * SVN 更新
    * 同步指令，指令执行完毕后才会继续执行后续指令
    * @param   {string} distDir 目标路径
    * @param   {string}	stdout	输出的方式,默认继承
    * @return : {Object}
    * <ul>
    * <li>pid Number Pid of the child process</li>
    * <li>output Array Array of results from stdio output</li>
    * <li>stdout Buffer|String The contents of output[1]</li>
    * <li>stderr Buffer|String The contents of output[2]</li>
    * <li>status Number The exit code of the child process</li>
    * <li>signal String The signal used to kill the child process</li>
    * <li>error Error The error object if the child process failed or timed out</li>
    * </ul>
    */
    update(distDir: string) {
        return svnExec("update", { stdio: "pipe", cwd: distDir }, distDir);
    },
    checkout(distDir: string, svnSrc: string) {
        return svnExec("checkout", { stdio: "pipe", cwd: distDir }, svnSrc, distDir);
    },
    svnInfo(source: string) {
        let obj = svnExec("info", { stdio: "pipe", cwd: source }, source);
        if (obj.error) {
            console.error(obj.stderr);
            throw obj.error;
        }
        let data = obj.stdout.toString();
        let info = {};
        let lines = data.split("\r\n");
        for (let line of lines) {
            if (line) {
                let lineData = line.split(":");
                if (lineData.length == 2) {
                    info[lineData[0].trim()] = lineData[1].trim();
                }
            }
        }
        return info;
    },
    /**
     * 
     * @param source 创建分支
     * @param dist 
     */
    branch(source: string, dist: string) {
        return svnExec("copy", undefined, source, dist, "-m", "create a branch");
    },
    /**
     * SVN 切换
     * 同步指令
     * @param {string} source   要切换的svn源路径
     * @param {string} distDir  要切换的本地路径
     */
    switch(source, distDir) {
        return svnExec("switch", { stdio: "pipe", cwd: distDir }, source, distDir);
    }
}



function checkGitDist(dist: string, gitUrl: string, version = "master") {
    //检查项目目录，是否已经有.git文件
    let dotGit = path.join(dist, ".git");
    if (fs.existsSync(dotGit) && fs.statSync(dotGit).isDirectory()) {
        git("reset", dist, "--hard");
        git("clean", dist, "-df");
        //同步项目
        git("fetch", dist);
    }
    else {
        //clone项目，并拉项目至指定路径
        git("clone", null, gitUrl, dist);
    }

    //切换到指定的版本
    git("checkout", dist, version);
    git("pull", dist, "origin");

    git("submodule", dist, "init")
    git("submodule", dist, "update");
}

function walkDirs(dir: string, forEach: { (file: string, root: string, ) }, filter: { (file: string): boolean } = _file => true) {
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
            })
        } else {
            forEach(chk, dir);
        }
    }
}


function makeZip(src: string, dist: string, glob?: any) {
    return new Promise((resolve, reject) => {
        let output = fs.createWriteStream(dist);
        let archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });
        archive.pipe(output);
        if (!glob) {
            glob = {};
        }
        glob.cwd = src;
        archive.glob("**", glob);
        archive.finalize();

        output.on('close', function () {
            console.log("创建zip" + dist + "完成");
            resolve()
        });

        // good practice to catch this error explicitly
        archive.on('error', function (err) {
            console.error(err);
            reject(err);
        })
    })
}

function copyFileSync(src: string, dest: string) {
    console.log(src, dest);
    let flag = true;
    if (fs.existsSync(dest)) {
        flag = false;
        let stat = fs.statSync(dest);
        let nstat = fs.statSync(src);
        if (stat.size != nstat.size) {
            flag = true;
        }
        if (!flag) {
            let buffer = fs.readFileSync(dest);
            let nbuffer = fs.readFileSync(src);
            let len = buffer.length;
            for (let i = 0; i < len; i++) {
                if (buffer[i] != nbuffer[i]) {
                    flag = true;
                    break;
                }
            }
        }
    }
    if (flag) {
        fs.copySync(src, dest);
    }
    return flag;

}

async function executeCmd(command: string, args: string[], options: any = {}) {
    return new Promise((resolve, reject) => {
        let encoding = options.encoding || "utf8";
        let exitOnError = !!options.exitOnError;
        let td = new TextDecoder(encoding);
        options.stdio = options.stdio || "pipe";
        let p = cp.spawn(command, args, options);
        p.on("close", onExit);
        p.on("exit", onExit);
        p.on("error", err => reject(err));
        p.stderr.on("data", onError);
        p.stdout.on("data", onData);
        function onData(buffer) {
            console.log(td.decode(buffer));
        }
        function onError(buffer) {
            console.log(td.decode(buffer));
            if (exitOnError) {
                reject();
            }
        }
        function onExit(code) {
            resolve(code);
        }
    });
}

/**
 * 用于处理字符串或者文件的md5
 * @param {string}|{Buffer} 带处理的数据
 * @return {string} md5字符串
 */
function getMD5(data: string | Buffer) {
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * 执行212的指令
 * @param cmd 
 */
function sshForLocal(cmd: string, ip = "192.168.0.202", keyPath = "/data/ssh_keys/local", username = "root") {
    return ssh(cmd, { host: ip, privateKey: require('fs').readFileSync(keyPath), username, port: 22 });
}

/**
 * 执行远程运维机指令
 * @param cmd 
 * @param ip 
 * @param keyPath 
 */
function sshForRemote(cmd: string, ip: string, keyPath = "/data/ssh_keys/remote", username = "root") {
    return ssh(cmd, { host: ip, privateKey: require('fs').readFileSync(keyPath), username, port: 22 });
}


function copy(src: string, dest: string, showLog?: boolean, opt?: fs.CopyOptionsSync) {
    //检查目标文件是否和当前文件相同
    showLog && console.log(`开始拷贝 [${src}] 到 [${dest}] `);
    try {
        fs.copySync(src, dest, opt);
        showLog && console.log(`成功拷贝 [${src}] 到 [${dest}] `);
    } catch (e) {
        showLog && console.error(`拷贝失败 [${src}] 到 [${dest}]`);
        throw e;
    }
}
const egret = process.platform === 'win32' ? "egret.cmd" : "egret";

export {
    git,
    sshForLocal,
    parseGitUrl,
    checkGitDist,
    walkDirs,
    copyFileSync,
    makeZip,
    executeCmd,
    getMD5,
    svn,
    webp,
    copy,
    sshForRemote,
    egret
}