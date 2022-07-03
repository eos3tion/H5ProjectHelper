import { PublishBase, fs, Helper } from "./Publish";
import * as path from "path";

const project = "sanguo3";
class Build extends PublishBase {

    project = project;
    gitPath = `http://gitlab.tpulse.cn/h5game/${project}.git`;

    svn_project_trunk = `svn://192.168.9.26:3333/${project}/trunk`;
    releaseMergedFiles = ["../../../libs/UZip.js", "libs/modules/egret/egret.min.js", "libs/modules/egret/egret.web.min.js", "libs/modules/dragonBones/dragonBones.min.js", "../../../h5core/bin/h5core/h5core.min.js", "main.min.js"];
    md5ResDir = "/data/projects/sanguo3/www/out/res";

    override async onBuildEnd($: BuildOption) {
        if ($.pakApp) {//要发外网
            const remoteParam = {
                host: "47.117.161.245",
                username: "root",
                password: "Ruixie18cSangu",
            } as SSHDefine;

            await uploadRes($, remoteParam);

            //提交客户端
            await uploadApp($, remoteParam);

            let log = `已发布客户端正式版本[${$.version}]，请登录"https://sanguo2.ruixi-sh.com/sanguo-admin"，使用版本号[${$.buildTime}]更新客户端外网版本`;
            let dingding = $.webhook;
            if (dingding) {
                dingding.msg = log;
            }
            console.log(log);
        }
    }
}

let build = new Build();
build.init();

async function uploadApp($: BuildOption, remoteParam: SSHDefine) {

    const ver = $.buildTime;
    const remotePath = `/data/sanguo2/www/${ver}/`;
    const webFolder = path.join($.dir_tmp_publish, "bin-release", "web", "out");

    //复制文件到远程
    /**
     * 需要排除的文件
     */
    const except = ["main.min.js"];
    //得到需要上传的文件
    const client = getClient(remoteParam);
    const needUploadFiles = [];
    Helper.walkDirs(webFolder, (file) => {
        for (let i = 0; i < except.length; i++) {
            const exp = except[i];
            if (file.indexOf(exp) > -1) {
                return
            }
        }
        needUploadFiles.push(file);
    })
    for (const file of needUploadFiles) {
        await client.upload(file, path.join(remotePath, path.relative(file, webFolder)));
    }
}

async function uploadRes($: BuildOption, remoteParam: SSHDefine) {
    //检查本地资源路径
    const localDir = $.md5ResDir;
    if (!fs.existsSync(localDir)) {
        return
    }

    const remotePath = "/data/sanguo2/www/res/";

    const lines = await getRemoteRes(remoteParam, remotePath);
    if (lines) {
        const remotePathDict = {};
        for (let i = 0; i < lines.length; i++) {
            const path = lines[i];
            remotePathDict[path] = true;
        }

        const needUploadFiles = [];
        const dirs = fs.readdirSync(localDir);
        for (const dir of dirs) {
            const files = fs.readdirSync(dir);
            //检查文件是否在字典中
            for (const file of files) {
                const localPath = `./${dir}/${file}`;
                if (!remotePathDict[localPath]) {
                    needUploadFiles.push(file);
                }
            }
        }

        //得到需要上传的文件
        const client = getClient(remoteParam);

        for (let i = 0; i < needUploadFiles.length; i++) {
            const file = needUploadFiles[i];
            console.log(`尝试上传:${file}`)
            await client.upload(path.join(localDir, file), path.join(remotePath, file));
        }

    }
}

function getClient(remoteParam: SSHDefine) {
    const client = new Helper.scp2.Client(
        remoteParam
    )
    return {
        async upload(file: string, path: string) {
            return new Promise<void>((resolve, reject) => {
                client.upload(file, path, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
            })
        }
    }

}

async function getRemoteRes(remoteParam: SSHDefine, remotePath: string, result = { retry: 0 }) {
    //检查远端资源
    let resResult = await Helper.sshForRemote(`cd ${remotePath} && find -type f && echo -n 'xuke success'`, remoteParam, true);
    let remoteString = resResult.output;
    let lines = remoteString.split("\n");
    let len = lines.length - 1;
    if (lines[len] === "xuke success") {
        lines.pop();
        return lines;
    } else {
        result.retry++;
        if (result.retry < 3) {
            console.log("获取远程res的hash失败，重数次数：", result.retry);
            return getRemoteRes(remoteParam, remotePath, result);
        } else {
            return console.log("获取远程res的hash失败超过3次，本次操作不更新资源");
        }
    }
}