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
import * as https from "https";
import * as http from "http";
import * as scp2 from "scp2";



function webp(input: string, output: string, quality = 75) {
    return executeCmd(cwebp, [input, "-o", output, "-q", quality + ""]);
}


function exec(opt: string | { cmd?: string, cwd?: string, notThrowError?: boolean, stdio?: cp.StdioOptions }, ...args) {
    if (typeof opt === "string") {
        cmd = opt;
    } else {
        var { cmd, cwd, notThrowError, stdio = "inherit" } = opt;
    }
    let option = { stdio, cwd } as cp.SpawnOptions;

    let result = cp.spawnSync(cmd, args, option);
    let cmdstring = `${cmd} ${args.join(" ")}`;
    console.log(`在目录[${cwd}]开始执行：`, cmdstring);
    if (result.status && !notThrowError) {
        console.error(`status:${result.status},${result.stderr ? result.stderr.toString() : `执行失败：\t${cmdstring}`}`);
    }
    console.log("执行完成：", cmdstring);
    return result;
}

function ssh(cmd: string, cfg: ConnectConfig, hideData?: boolean) {
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
                    !hideData && console.log(data.toString("utf8"));
                }).stderr.on('data', function (data: Buffer) {
                    output.push(data);
                    !hideData && console.log(data.toString("utf8"));
                });
            });
        }).on("error", err => {
            con.end();
            reject(err);
        }).connect(cfg);
    });
}

function git(cmd: string, cwd: string, ...args) {
    let result = exec({ cmd: "git", cwd, stdio: "pipe" }, cmd, ...args);
    if (result.stderr) {
        console.error(result.stderr.toString());
    }
    if (result.stdout) {
        console.log(result.stdout.toString());
    }
    return result;
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
    * 
    * * pid Number Pid of the child process
    * * output Array Array of results from stdio output
    * * stdout Buffer|String The contents of output[1]
    * * stderr Buffer|String The contents of output[2]
    * * status Number The exit code of the child process
    * * signal String The signal used to kill the child process
    * * error Error The error object if the child process failed or timed out
    * 
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
    switch(source: string, distDir: string) {
        return svnExec("switch", { stdio: "pipe", cwd: distDir }, source, distDir);
    },
    /**
     * 检查文件夹状态
     * @param distDir 
     */
    status(distDir: string) {
        return svnExec("status", { stdio: "pipe", cwd: distDir }, distDir);
    },
    /**
     * 添加文件到svn
     * @param source 要添加的文件路径
     * @param cwd 工作目录
     */
    add(source: string, cwd: string) {
        return svnExec("add", { stdio: "pipe", cwd: cwd }, source);
    },
    /**
     * svn提交指定文件
     * @param source 要提交的文件
     * @param distDir 
     */
    commit(source: string, distDir: string, msg = "") {
        return svnExec("commit", { stdio: "pipe", cwd: distDir }, source, distDir, "-m", msg);
    },
    cp(source: string, dist: string, msg = "") {
        return svnExec("copy", { stdio: "pipe" }, source, dist, "-m", msg);
    },
    ls(source: string) {
        return svnExec("ls", { stdio: "pipe" }, source);
    },
    delete(source: string, msg = "") {
        return svnExec("rm", { stdio: "pipe" }, source, "-m", msg);
    },
    import(source: string, dist: string, msg = "") {
        return svnExec("import", { stdio: "pipe" }, source, dist, "-m", msg);
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
    let result = git("pull", dist, "origin");
    //得到版本改动信息
    let output = result.stdout;
    let changelog: string;
    if (output) {
        let content = output.toString();
        if (content) {
            let lines = content.split("\n");
            //检查Line0的变更记录
            let line0 = lines[0];
            if (line0 && /(Updating|更新)[ ](.*)/.test(line0)) {//更新记录
                let ver = RegExp.$2;
                let logResult = git("log", dist, ver, `--format=%h %cn %s`);
                if (logResult && logResult.stdout) {
                    changelog = logResult.stdout.toString();
                }
            }
        }
    }

    git("submodule", dist, "init")
    git("submodule", dist, "update");
    console.log("changelog", changelog);
    return changelog;
}

function walkDirs(dir: string, forEach: { (file: string, root: string,) }, filter: { (file: string): boolean } = _file => true) {
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
    return new Promise<void>((resolve, reject) => {
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
function sshForLocal(cmd: string, ip = "192.168.0.202", keyPath = "/data/ssh_keys/local", username = "root", hideData?: boolean) {
    return ssh(cmd, { host: ip, privateKey: require('fs').readFileSync(keyPath), username, port: 22 }, hideData);
}

/**
 * 执行远程运维机指令
 * @param cmd 
 * @param ip 
 * @param keyPath 
 */
function sshForRemote(cmd: string, ip: string, keyPath = "/data/ssh_keys/remote", username = "root", hideData?: boolean) {
    return ssh(cmd, { host: ip, privateKey: require('fs').readFileSync(keyPath), username, port: 22 }, hideData);
}

/**
 * 往远处主机拷贝文件
 * @param src       本地目录
 * @param dest 
 * @param ip 
 * @param keyPath 
 */
function scpForRemote(src: string, dest: string, ip: string, keyPath = "/data/ssh_keys/remote") {
    return new Promise<void>((resolve, reject) => {
        let client = new scp2.Client({
            port: 22,
            host: ip,
            username: "root",
            privateKey: require('fs').readFileSync(keyPath)
        })
        console.log(`开始将文件${src}上传至服务器[${ip}]${dest}`)
        client.upload(src, dest, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
                console.log(`上传完毕，文件${src}上传至服务器[${ip}]${dest}`)
            }
        })
    })
}

/**
 * 发送webhook消息
 */
function webhookNotifer(opt: { msg: string, url: string }) {
    if (!opt.msg) {
        return;
    }
    postDataUseJSON(opt.url, {
        msgtype: "text",
        text: {
            content: opt.msg
        }
    })
}

function postDataUseJSON(url: string, data: any, isHttps?: boolean) {
    return new Promise((resolve, reject) => {
        const buffers = [] as Buffer[];
        const postData = JSON.stringify(data);
        let req = (isHttps ? https : http).request(url, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, res => {
            res.on("data", function (buf) {
                buffers.push(buf);
            })
            res.on("end", function () {
                let resp = Buffer.concat(buffers).toString("utf8");
                let data;
                try {
                    data = JSON.parse(resp)
                } catch (e) {
                    return reject(e);
                }
                resolve(data);
            })
            res.on("error", function (e) {
                reject(e);
            })
        })
        req.write(postData);
        req.end();
    })
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
    egret,
    webhookNotifer,
    scpForRemote,
    postDataUseJSON
}