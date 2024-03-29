import { egret, svn, walkDirs, checkGitDist, copyFileSync, executeCmd, makeZip, webp, copy, sshForRemote, webhookNotifer, scpForRemote, git, postDataUseJSON } from "./Helper";
import * as fs from "fs-extra";
import * as path from "path";
import { Buffer } from "buffer";
import * as  archiver from "archiver";
import * as wxgame from "./WXGame";
import * as qhgame from "./QHGame";
import { clearCode } from "./ClearCode";
import * as uglify from "uglify-js";
import * as crypto from "crypto";

function doSSH(cmd: string, $: BuildOption, hideData?: boolean) {
    let param = $.opSSHParam;
    if (param) {
        return sshForRemote(cmd, param, hideData);
    }
}

const plugins: { [buildType: string]: BuildPlugin } = {
    "wxgame": wxgame,
    "qhgame": qhgame
};

export class PublishBase {
    serverCfgPath = "/data/server_cfgs/cfgs";
    serverCfgGitUrl = "git@gitlab.tpulse.cn:tpulse/cfgs.git";
    /**
     * 配置文件名
     */
    cfgFileName = "cfgs.json";
    svn_project_trunk: string;
    gitPwd = "H5Builder";
    gitUser = "H5Builder";
    /**
     * 项目的git路径
     */
    gitPath: string;
    /**
     * 项目svn地址
     */
    svnPath = "svn://192.168.9.26:3333";

    /**
     * 默认语言
     */
    defaultLan = "cn";

    /**
     * 对应的web路径
     */
    webDir = "www";

    /**
     * 用于构件的临时目录
     */
    baseDir = "/data/projects";

    /**
     * 项目名称
     */
    project = "hqgrpg";

    /**
     * 白鹭版本号
     */
    egretVersion = "5.0.13";

    /**
     * 配置文件路径
     */
    cfgPath = "";

    /**
     * 将原始的资源文件名，通过内容的md5值，进行改名
     * 这类文件的根目录
     */
    md5ResDir = "";
    /**
     * 将原始的资源文件名，通过内容的md5值，进行改名 的`数据文件`
     * 形式如下  
     * ```
     * pvp/4.png        24/cdeae237dab886f1f93587ed0ea469.png
     * pvp/3.png        31/3822929c59c583a247e5af35d45880.png
     * pvp/2.png        9d/501faf821de98c31390a32eab2d1a5.png
     * ```
     */
    resVerFileName = "resVer{v}.txt";

    /**
     * 发布时要拷贝的文件或文件夹
     */
    buildFiles = ["src", "scripts", "index.html", "libs", "egretProperties.json", "tsconfig.json", "typings", "template", "h5core", "tools.json", "wxgame_tsd"];

    /**
     * gameCfg的输出路径
     */
    gameCfgOutput = "resource/game.json";

    releaseMergedFiles = ["libs/modules/egret/egret.min.js", "libs/modules/egret/egret.web.min.js", "../../../h5core/bin/h5core/h5core.min.js", "main.min.js"];
    /**
     * git的release版本文件路径  
     * 如果配置了此文件，发布release版时，会尝试到指定地址加载文件
     */
    git_branchRCFile: string;

    /**
     * 客户端主版本
     */
    clientDevBranch = "master";

    /**
     * 服务器主版本
     */
    serverDevBranch: string;

    funcs: { [index: string]: { func?(...args); desc: string } } = {
        buildApp: {
            func: this.buildApp,
            desc: `buildApp(opt:{pakApp,pakCfg,pakRes,createBranch,...})
编译发行版程序
pakApp Boolean 是否打包上传程序,默认false
pakCfg Boolean 是否打包上传配置,默认false
pakRes Boolean 是否打包上传资源,默认false
createBranch Boolean 是否创建分支,默认true            
cfgs Object 附加配置,要替换的配置内容
            `
        },
        buildLang: {
            func: this.buildLang,
            desc: `buildLang(opt:BuildOption)
编译语言文件
            `
        },
        rebuildResPath: {
            func: this.rebuildResPath,
            desc: `rebuildResPath(opt:BuildOption) 重新构建一份完整的资源版本文件`
        },
        updateRes: {
            func: this.updateRes,
            desc: `更新指定语言的资源文件`
        },
        scp: {
            func: this.scp,
            desc: `执行scp操作，scp({host:"192.168.0.1",path:"/data/upload/xxx",file:"//192.168.0.202/xx_version/xxx"})`
        },
        createBranch: {
            func: this.createBranch,
            desc: `创建一个分支`
        }
    }
    init() {
        /**
         * 用于外部调用
         */
        process.on("message", async (m) => {
            let funcs = this.funcs;
            let func = m.func;
            let params = m.params;
            let $: BuildOption;
            console.log("buildRC onmessage", m);
            if (func == "help") {
                let handle = funcs[String(params)];
                if (handle) {
                    console.log(handle.desc);
                }
            }
            else if (func in funcs) {
                let handle = funcs[func];
                if (params == null || params instanceof Array) {
                    try {
                        $ = await handle.func.apply(this, params);
                    } catch (e) {
                        console.error(e.message);
                        console.log(e.stack);
                        return process.send("error");
                    }
                }
            } else {
                console.log("非法的函数调用", func, params);
            }
            if ($) {
                let dingding = $.webhook;
                if (dingding) {
                    webhookNotifer(dingding);
                }
            }
            process.send("done");
        });
    }

    /**
     * 初始化属性和参数
     * @return 返回参数的域
     */
    initOpt($?: BuildOption) {
        if (typeof $ !== "object") {
            $ = {};
        }

        if (!$.inited) {
            $.webDir ||= this.webDir;
            //当前路径
            $.jsDir ||= __dirname;

            //基础路径
            $.baseDir ||= this.baseDir;//0.5的基础路径

            //项目名称
            $.project ||= this.project;
            //语言 可外部设置
            $.lan ||= this.defaultLan;
            //用于切换分支 可外部设置
            $.buildVersion ||= "nor";

            //创建时间用于创建版本号和zip目录名称
            $.buildTime ||= new Date().format("yyyyMMdd_HHmmss");

            $.git_branchRCFile ||= this.git_branchRCFile;

            let git_branchRCFile = $.git_branchRCFile;
            let RCVer = "";
            if ($.isRelease && git_branchRCFile) {
                if (fs.existsSync(git_branchRCFile)) {
                    let ver = fs.readFileSync(git_branchRCFile, "utf8").trim();
                    if (ver) {
                        RCVer = `${ver}.`
                        $.version ||= ver;
                    }
                }
            }

            //主版本号
            $.mainversion ||= $.lan + "." + $.buildVersion + "." + RCVer + $.buildTime;


            //原始语言版(一般为中文版)的路径
            $.dir_defConfig ||= this.getCfgPath($, this.defaultLan, $.version);

            $.dir_rawConfig ||= this.getCfgPath($, $.lan, $.version, "raw")

            //发布版配置路径
            $.dir_pubConfig ||= ($.lan == this.defaultLan ? $.dir_defConfig/*原始语言使用原始配置路径*/ : this.getCfgPath($, $.lan));

            //配置的原始路径
            $.dir_srcConfig ||= this.getCfgPath($, $.lan, $.version);

            $.svn_project_trunk ||= this.svn_project_trunk || `${this.svnPath}/${$.project}/trunk`;

            $.svn_res ||= `${$.svn_project_trunk}/res/${$.lan}`;

            $.dir_resRaw ||= this.getResPath($, this.defaultLan);

            $.dir_res_base ||= this.getResPath($, "");

            $.dir_res ||= this.getResPath($, $.lan);

            $.git_path ||= this.gitPath;

            //设置临时文件夹路径
            $.dir_tmp ||= path.join($.baseDir, $.project, "temp", $.lan, $.buildVersion);

            //设置发布目录
            $.dir_tmp_publish ||= path.join($.dir_tmp, "publish");

            $.resCfgPath ||= path.join($.dir_tmp, "resCfg");

            //调试版路径
            $.dir_tmp_nightly ||= path.join($.dir_tmp, "nightly");

            $.resVersionFile ||= path.join($.dir_tmp, "resVersion.json");

            $.dir_mapRaw ||= "m";

            $.dir_mapRelease ||= "m2";

            $.egretVersion ||= this.egretVersion;

            $.git_user ||= this.gitUser;

            $.git_pwd ||= this.gitPwd;

            $.cfgFileName ||= this.cfgFileName;

            $.cfgPath ||= this.cfgPath || path.join($.dir_srcConfig, $.cfgFileName);

            $.dir_tmp_source ||= path.join($.dir_tmp, "source");

            $.buildFiles ||= this.buildFiles;

            $.dir_before_coverd ||= path.join($.dir_tmp_source, "client", "rc", "before_coverd");

            $.dir_after_coverd ||= path.join($.dir_tmp_source, "client", "rc", "after_coverd");

            //游戏配置文件的路径
            $.gameCfgPath ||= this.gameCfgOutput;

            $.uglifyOptions ||= { compress: true } as uglify.MinifyOptions;

            //调整代理
            $.wsProxy ||= "";

            //页面标题
            $.title ||= "";

            $.zmGateUrl ||= "";

            $.mergedFiles ||= this.releaseMergedFiles;

            $.md5ResDir ||= this.md5ResDir;


            $.inited = true;
        }
        return $;
    }

    /**
      * 获取配置路径
      * @param $ 
      * @param lan 
      * @param dir 
      */
    getCfgPath($: BuildOption, lan: string, version = "", cfgsDir = "output", dir = "client") {
        return path.join(this.getWebDir($), "cfgs", lan, version, cfgsDir, dir);
    }

    /**
     * 获取res路径
     * @param $ 
     * @param lan 
     */
    getResPath($: BuildOption, lan: string) {
        return path.join(this.getWebDir($), "res", lan);
    }

    /**
     * 获取web目录的路径
     * @param $ 
     */
    getWebDir($: BuildOption) {
        return path.join($.baseDir, $.project, $.webDir);
    }

    /**
    * 生成版本号文件
    */
    makeVersionFile($: BuildOption = {}) {
        let { resCfgPath } = this.initOpt($);
        let dict = this.getResVersionDict($);
        let buffers = [] as Buffer[];
        let tmpDict: { [index: number]: string[] } = {};
        //遍历
        for (let uri in dict) {
            let info = dict[uri];
            if (!info.isDel && info.version) {//版本号不为0，并且没有删除文件
                let buffer = Buffer.alloc(6);
                let hash = uri.hash();
                let arr = tmpDict[hash];
                if (!arr) {
                    tmpDict[hash] = arr = [];
                }
                arr.push(uri);
                buffer.writeUInt32BE(uri.hash() >>> 0, 0);
                buffer.writeUInt16BE(info.version, 4);
                buffers.push(buffer);
            }
        }
        let buf = Buffer.concat(buffers);

        //检查重复的hash值
        for (let hash in tmpDict) {
            let c = tmpDict[hash];
            if (c.length > 1) {
                console.log(`${c.join("，")}的hash值重复`);
            }
        }
        if (buf.length) {
            //写入文件
            fs.writeFileSync(resCfgPath, buf);
        } else {
            if (fs.existsSync(resCfgPath)) {
                fs.unlinkSync(resCfgPath);
            }
        }
    }

    getClientBranchName(version: string) {
        return `client_${version}`;
    }


    async buildApp($: BuildOption = {}) {
        let { egretVersion, git_path, git_user, git_pwd, dir_tmp, dir_tmp_source, git_branch, version, dir_tmp_publish, dir_tmp_nightly, useRaws, resVersionFile, buildFiles, cfgPath, dir_after_coverd, dir_before_coverd, other_srcFiles, mainversion, isRelease, pingtaihtmls, buildType, gameCfgPath, wsProxy, zmGateUrl, title } = this.initOpt($);
        let result = /^(http[s]?):\/\/(.*?)$/.exec(git_path);
        if (result) {
            git_path = `${result[1]}://${git_user}:${git_pwd}@${result[2]}`;
        }
        if (isRelease) {
            if (version) {
                git_branch = this.getClientBranchName(version);
            }
        }

        let changelog = checkGitDist(dir_tmp_source, git_path, git_branch);
        let buildPlugin: BuildPlugin;
        if (buildType) {
            buildPlugin = plugins[buildType];
            if (!buildPlugin) {
                return console.log(`没有找到指定的编译插件${buildType}`);
            }
        }

        let pub = buildPlugin ? path.join(dir_tmp, buildType) : isRelease ? dir_tmp_publish : dir_tmp_nightly;
        console.log(pub);
        //清理发布用目录
        fs.removeSync(pub);

        //处理编译需要拷贝的目录
        if (!buildPlugin && pingtaihtmls) {
            buildFiles = buildFiles.concat(pingtaihtmls);
        }
        buildFiles.forEach(uri => {
            let src = path.join(dir_tmp_source, "client", uri);
            if (fs.existsSync(src)) {
                copy(src, path.join(pub, uri));
            } else {
                console.log(`没有路径：`, src);
            }
        });

        {
            let src = path.join(dir_tmp_source, "client", gameCfgPath);
            if (fs.existsSync(src)) {
                copy(src, path.join(pub, this.gameCfgOutput));
            } else {
                console.log(`没有路径：`, src);
            }
        }


        // 拷贝skin，中的文件
        let clientSrc = path.join(dir_tmp_source, "client");
        let relativeRes = path.join(clientSrc, "resource");
        let srcResource = path.join(relativeRes, "skin");
        let dict = this.getResVersionDict($);
        walkDirs(srcResource, (chk) => {
            let ret = path.parse(chk);
            let ext = ret.ext;
            let uri: string;
            if (ext == ".raw") {// 只拷贝原始png数据
                if (useRaws && useRaws.indexOf(path.basename(ret.dir)) > -1) {//如果在原始图片列表中的，也进行拷贝，并将 .raw 去掉
                    uri = path.relative(relativeRes, chk.substr(0, chk.length - 4));
                }
            } else {
                if (!useRaws || ext != ".png" || ext == ".png" && useRaws.indexOf(path.basename(ret.dir)) == -1) {
                    uri = path.relative(relativeRes, chk);
                }
            }
            if (uri) {
                uri = this.normalizeUri(uri);
                let fullPath = path.join(pub, "resource", uri);
                copyFileSync(chk, fullPath);
            }
        })
        //存储资源版本文件
        fs.writeJSONSync(resVersionFile, dict);
        let webFolder: string;
        if (buildPlugin) {
            await buildPlugin.onCompile($);
        } else if (isRelease) {

            //拷贝配置
            copyFileSync(cfgPath, path.join(dir_tmp_publish, "resource", $.cfgFileName));

            if (fs.pathExistsSync(dir_before_coverd)) {
                copy(dir_before_coverd, dir_tmp_publish);
            }
            let code = await executeCmd(egret, ["copylib"], { cwd: dir_tmp_publish });
            if (code) {
                return console.log(`egret 发生错误，退出处理`);
            }
            code = await executeCmd(egret, ["publish", "--version", "out"], { cwd: dir_tmp_publish });
            if (code) {
                return console.log(`egret 发生错误，退出处理`);
            }
            console.log(`egret 编译完成`);
            webFolder = path.join(dir_tmp_publish, "bin-release", "web", "out");
            if (fs.pathExistsSync(dir_after_coverd)) {
                copy(dir_after_coverd, webFolder);
            }
            if (other_srcFiles) {
                other_srcFiles.forEach(uri => {
                    let src = path.join(clientSrc, uri);
                    if (fs.existsSync(src)) {
                        copy(src, path.join(webFolder, uri));
                    } else {
                        console.log(`没有路径：`, src);
                    }
                })
            }
            if (pingtaihtmls) {
                pingtaihtmls.forEach(uri => {
                    let src = path.join(clientSrc, uri);
                    if (fs.existsSync(src)) {
                        copy(src, path.join(webFolder, uri));
                    } else {
                        console.log(`没有路径：`, src);
                    }
                })
            }
            //生成版本文件
            this.makeVersionFile($);
        } else {
            webFolder = dir_tmp_nightly;
            // 检查是否有Version.ts文件
            let verFile = path.join(dir_tmp_nightly, "src", "Version.ts");
            if (fs.existsSync(verFile)) {
                let cnt = fs.readFileSync(verFile, "utf8");
                cnt = cnt.replace(/@ver@/g, mainversion);
                fs.writeFileSync(verFile, cnt, "utf8");
            }
            await executeCmd(egret, ["build", "--egretversion", egretVersion], { cwd: dir_tmp_nightly });
        }

        if (buildPlugin) {
            buildPlugin.onBuildApp($);
        } else if (isRelease) {
            //处理js文件 main.min.js
            let file = path.join(webFolder, "main.min.js");
            let cnt = fs.readFileSync(file, "utf8");
            cnt = cnt.replace(/@ver@/g, mainversion);
            //处理hash文件
            //@hash@
            let hash = "";
            let resCfgPath = $.resCfgPath;
            if (fs.existsSync(resCfgPath)) {
                hash = fs.readFileSync($.resCfgPath).toString("base64");
            }
            cnt = cnt.replace(/@hash@/, hash);

            fs.writeFileSync(file, cnt, "utf8");
            console.log(`尝试合并js文件`);
            //合并js文件

            let jsname = this.getJsName($);
            this.mergeJS(webFolder, jsname + ".js", $);
            console.log(`尝试复制 lang 文件`);
            //将lang.js复制到项目文件夹中
            let useJsonLangs = $.useJsonLang;
            if (useJsonLangs) {
                if (!Array.isArray(useJsonLangs)) {
                    useJsonLangs = [useJsonLangs];
                }
                for (let i = 0; i < useJsonLangs.length; i++) {
                    const useJsonLang = useJsonLangs[i];
                    copy(useJsonLang, path.join(webFolder, "resource", path.basename(useJsonLang)), $.showFileSolveLog);
                }
            } else {
                copy(path.join($.dir_rawConfig, "lang.js"), path.join(webFolder, "lang.js"), $.showFileSolveLog);
            }
            //替换index.html中的脚本名称
            let htmls = ["index.html"];
            if (pingtaihtmls) {
                htmls = htmls.concat(pingtaihtmls);
            }
            htmls.forEach(tmp => {
                file = path.join(webFolder, tmp);
                cnt = fs.readFileSync(file, "utf8");
                cnt = cnt.replace(/@ver@/g, jsname);
                cnt = cnt.replace(/@wsProxy@/g, wsProxy);
                cnt = cnt.replace(/@title@/g, title);
                cnt = cnt.replace(/@zmGateUrl@/g, zmGateUrl);
                fs.writeFileSync(file, cnt, "utf8");
            });

            if ($.md5ResDir) {
                await this.md5Res($, webFolder);
            }
        }

        const endAction = $.buildEndAction;
        if (endAction) {
            try {
                await postDataUseJSON(endAction, $);
            } catch (e) {
                console.error(e.message);
            }
        }

        const log = `发布项目[${this.project}]${isRelease ? `正式版` : `nightly版`}${mainversion}${changelog ? `，变更内容：\n${changelog}` : ``}`
        let dingding = $.webhook;
        if (dingding) {
            dingding.msg = log;
        }
        console.log(log);
        await this.onBuildEnd($);
        console.log("处理完成");
        return $;
    }

    protected onBuildEnd(_: BuildOption) {

    }

    getJsName($: BuildOption) {
        if ($.versionByDate) {
            return $.buildTime;
        }
        return "main";
    }

    async pakApp(webFolder: string, $: BuildOption, zipOpt?: any) {
        let type = "web";
        let dist = path.join($.yunweiPath, type, this.getZipName($, type));
        $.zipPathApp = dist;
        await makeZip(webFolder, dist, zipOpt);
        return $;
    }

    getZipName($: BuildOption, type: string) {
        return `${type}_${$.buildTime}.zip`;
    }

    /**
     * 合并js文件
     * @param webFolder 
     */
    mergeJS(webFolder: string, dist: string, $: BuildOption) {
        let files = $.mergedFiles;
        let content = "";
        files.forEach(file => {
            let uri = path.join(webFolder, file);
            if (fs.existsSync(uri)) {
                let code = fs.readFileSync(uri, "utf8");
                content += code;
            }
            else {
                console.log(`合并脚本时，没有找到：`, uri);
            }
        });
        content = clearCode(content);
        let out = uglify.minify(content, $.uglifyOptions);
        const code = out.code || content;
        fs.writeFileSync(path.join(webFolder, dist), code);
    }

    buildLang($: BuildOption) {
        // TODO 创建语言包文件
        return $;
    }

    /**
     * 重新根据资源路径，生成初始的资源配置文件
     * @param $ 
     */
    async rebuildResPath($: BuildOption = {}) {
        let { dir_res, dir_resRaw, resVersionFile, lan, clearVer } = this.initOpt($);
        let count = 0;
        let dict = clearVer ? {} : this.getResVersionDict($);
        let lanDict = {};
        //遍历所有文件，生成配置文件
        if (lan != this.defaultLan) {
            //先读取当前语言版本的路径
            count += await this.solveLanFile(dir_res, lanDict, dict, $);
        }
        //处理默认语言
        count += await this.solveLanFile(dir_resRaw, lanDict, dict, $);
        console.log("遍历总文件数量为：", count);
        //得到一份完整字典，将数据写入文件
        fs.writeJSONSync(resVersionFile, dict);
        console.log("writeTo", resVersionFile);
        return $;
    }
    async solveLanFile(resPath: string, lanDict: object, dict: { [index: string]: ResInfo }, $: BuildOption) {
        let count = 0;
        let needsolved = [];
        walkDirs(resPath, file => {
            count++;
            let uri = this.normalizeUri(file.replace(resPath, ""));
            if (!lanDict[uri]) {
                lanDict[uri] = true;
                needsolved.push(uri);
                // dict[uri] = this.solveVersion(file, uri, dict, $.showFileSolveLog, solved);
            }
        }, file => !file.startsWith(path.join(resPath, ".svn")));
        await this.checkSolve($, needsolved, dict);
        return count;
    }
    async pakRes($: BuildOption = {}) {
        this.initOpt($);
        //打包res
        //获取远程资源配置字典
        let remote = await this.getRemoteResHash($);
        remote = remote || {};
        let dict = this.getResVersionDict($);
        let list: ResInfo[] = [];
        let rawMapPath = $.dir_mapRaw + "/";
        //对比文件
        for (let uri in dict) {
            let local = dict[uri];
            if (!local.isDel) {
                let { md5, fullPath } = local;
                if (fs.existsSync(fullPath)) {
                    let remoteMd5 = remote[uri];
                    if (remoteMd5 != md5 && !uri.startsWith(rawMapPath)) {
                        list.push(local);
                    }
                }
            }
        }
        let type = "res";
        let dist = path.join($.yunweiPath, type, this.getZipName($, type));
        $.zipPathRes = dist;
        await this.makeZip(list, dist, $.showFileSolveLog);
        return $;
    }



    makeZip(list: ResInfo[], dist: string, showLog?: boolean) {
        return new Promise<void>((resolve, reject) => {
            let output = fs.createWriteStream(dist);
            //打包
            let arch = archiver("zip", { zlib: { level: 9 } });
            try {
                arch.pipe(output);
            } catch (e) {
                reject(e);
            }

            for (let i = 0; i < list.length; i++) {
                let { fullPath, uri } = list[i];
                if (fs.existsSync(fullPath)) {
                    arch.append(fs.readFileSync(fullPath), { name: uri });
                    if (showLog) {
                        console.log(fullPath, "zip------>", uri);
                    }
                } else {
                    if (showLog) {
                        console.log("无法找到文件：", fullPath);
                    }
                }
            }
            arch.finalize();
            output.on('close', function () {
                console.log("创建zip" + dist + "完成");
                resolve()
            });
            arch.on('error', function (err) {
                console.error(err);
                reject(err);
            })
        });
    }



    /**
     * svn更新资源
     * @param $ 
     */
    async updateRes($: BuildOption = {}) {
        console.log("更新res资源");
        let { svn_res, dir_res, resVersionFile } = this.initOpt($);

        svn.cleanup(dir_res);
        let out = svn.switch(svn_res, dir_res);
        let output = out.stdout.toString();
        let dict = this.getResVersionDict($);
        //解析svn信息
        //U 更新
        //A 新增
        //D 删除
        let lines = output.split(/\n|\r\n/);
        const reg = /^(U|A|D)\s+(.*?)$/;
        let needsolved = [];
        a: for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (reg.test(line)) {
                let op = RegExp.$1;
                let uri = RegExp.$2;
                let fullUri;
                if (uri.startsWith(dir_res)) {//linux下，svn会显示完整目录
                    fullUri = uri;
                } else {
                    uri = this.normalizeUri(RegExp.$2);
                    fullUri = path.join(dir_res, uri);
                }
                let isDir = fs.statSync(fullUri).isDirectory();
                //先将uri格式化
                switch (op) {
                    case "U":
                    case "A":
                        if (isDir) {
                            continue a;
                        }
                        //获取资源hash值
                        needsolved.push(uri);
                        // dict[uri] = this.solveVersion(fullUri, uri, dict, showFileSolveLog, solved);
                        break;
                    case "D":
                        //将资源标记为删除
                        //检查是否有资源
                        if (isDir) {
                            for (let cUri in dict) {//将所有资源标记为删除
                                if (cUri.startsWith(uri)) {
                                    let old = dict[cUri];
                                    if (old) {
                                        old.isDel = true;
                                        delete old.md5;
                                    }
                                }
                            }
                        } else {
                            let old = dict[uri];
                            if (old) {
                                old.isDel = true;
                                delete old.md5;
                            }
                        }
                        break;
                }
            }
        }

        await this.checkSolve($, needsolved, dict);
        let dir = path.dirname(resVersionFile);
        if (!fs.existsSync(dir)) {
            return console.error(`没有${dir}，无法进行写入`)
        }
        //将数据写入文件
        fs.writeJSONSync(resVersionFile, dict);
        return $;
    }

    async checkSolve($: BuildOption, needsolved: string[], dict: { [uri: string]: ResInfo }) {
        let { dir_res, showFileSolveLog } = $;
        let lists = [];
        while (needsolved.length) {
            const uri = needsolved.pop();
            let fullUri = path.join(dir_res, uri);
            let flag = this.solveVersion(fullUri, uri, dict, showFileSolveLog, needsolved);
            if (!flag) {
                await Promise.race(lists);
            } else {
                lists.push(flag);
            }
        }
        await Promise.all(lists);
        console.log("done");
    }

    /**
     * 处理文件，或者资源信息  
     * @param fullPath  文件的完整物理路径 
     * @param uri 资源标识
     * @param dict 资源字典
     */
    solveVersion(fullPath: string, uri: string, dict: { [url: string]: ResInfo }, showLog: boolean, _needsolved: string[]) {
        if (showLog) {
            console.log("solveVersion", uri);
        }
        let info = dict[uri];
        if (!fs.existsSync(fullPath)) {//已经不存在文件了，极有可能是走了svn的删除
            if (info && !info.isDel) {//文件未标记删除，输出警告
                console.log(`${fullPath}未标记为删除，但是无法找到文件`);
            }
            return;
        }
        let stream = fs.createReadStream(fullPath);
        let md5util = crypto.createHash('md5');
        let md5: string;//getMD5(buffer);        
        try {
            stream.read();
        } catch (e) {
            streamFail(info);
            console.log(`${fullPath}流读取失败，${e.message}`);
            return;
        }
        return new Promise<void>((resolve, _) => {
            stream.on("end", () => {
                md5 = md5util.digest("hex");
                //检查是否已经有m2中的hash值
                let version = 0;
                if (info) {//已经有新文件，并且文件的hash相同
                    delete info.isDel;
                    let imd5 = info.md5;
                    if (imd5 == md5) {
                        return resolve();
                    } else {
                        version = ~~info.version + 1;
                    }
                } else {
                    dict[uri] = info = { fullPath, uri } as ResInfo;
                }
                info.version = version;
                info.md5 = md5;
                resolve();
            })
            stream.on("data", (data: Buffer) => {
                md5util.update(data);
            });
            stream.on("error", err => {
                console.log(uri, "发生错误", err.message)
                streamFail(info);
                md5util.end();
                resolve();//还是当resolve处理
            })
        });
        function streamFail(info: ResInfo) {
            if (info) {
                info.version = ~~info.version + 1;
                info.md5 = undefined;//将md5设为 undefined
            }
        }
    }

    /**
     * 统一uri写法
     * @param uri 
     */
    normalizeUri(uri: string) {
        return uri.replace(/\\/g, "/").replace(/^\.?\//, "");
    }

    getResVersionDict($: BuildOption) {
        let { resVersionFile, resVersionDict: dict } = $;
        if (!dict) {
            if (fs.existsSync(resVersionFile)) {//读取版本文件
                dict = fs.readJSONSync(resVersionFile);
            } else {
                dict = {};
            }
        }
        return dict;
    }

    /**
     * 处理由地图编辑器生成的地图
     * @param baseDir 输入路径
     * @deprecated 目前h5直接使用 x_y.jpg 这种方式，不再由此脚本处理
     */
    async parseMapRes($: BuildOption = {}) {
        let { dir_res, resVersionFile, dir_mapRaw, dir_mapRelease, showFileSolveLog } = this.initOpt($);

        if (!fs.existsSync(dir_res) || !fs.statSync(dir_res).isDirectory()) {
            console.log(`parseMapRes 输入路径有误`, dir_res);
            return;
        }
        let dict = this.getResVersionDict($);
        //输入路径为
        const inpReg = /(\d{3})(\d{3})\.(jpg|png)/, miniReg = /mini\d*\.(jpg|png)/;
        let inp = path.join(dir_res, dir_mapRaw);
        let needsolved = [];
        //遍历子目录
        fs.readdirSync(inp).forEach(p => {
            let mapP = path.join(inp, p);
            if (!fs.statSync(mapP).isDirectory()) {
                return;
            }
            let isLib = p == "lib";//lib特殊处理           
            fs.readdirSync(mapP).forEach(async img => {
                let outp: string;
                if (isLib) {
                    if (path.extname(img) == ".jpg") {
                        outp = path.join(dir_mapRelease, p, img);
                    }
                } else {
                    if (inpReg.test(img)) {
                        let x = RegExp.$1;
                        let y = RegExp.$2;
                        let ext = RegExp.$3;
                        outp = path.join(dir_mapRelease, p, `${+x}_${+y}.${ext}`);
                    }
                    if (miniReg.test(img)) {
                        outp = path.join(dir_mapRelease, p, img);
                    }
                }
                if (outp) {
                    //复制地图文件
                    let src = path.join(mapP, img);
                    outp = this.normalizeUri(outp);
                    needsolved.push(outp);
                    // let info = this.solveVersion(src, outp, dict, showFileSolveLog, solved);
                    let dest = path.join(dir_res, outp);
                    try {
                        //验证资源hash值
                        copy(src, dest, showFileSolveLog);
                    } catch (e) {
                        return console.log(`${src} copy to  ${dest}  Faaaaaaaaaaaaaaaaaaaaaaailed!!!!!!!!!!!!`);
                    }
                    //执行完才修改dict
                    // dict[outp] = info;
                    //生成webpwebp
                    let webpDest = `${dest}.webp`;
                    await webp(dest, webpDest);
                    let webpUri = this.normalizeUri(`${outp}.webp`);
                    needsolved.push(webpUri);
                    // dict[webpUri] = this.solveVersion(webpDest, webpUri, dict, showFileSolveLog, solved);
                }
            });
        });
        await this.checkSolve($, needsolved, dict);
        //将数据写入文件
        fs.writeJSONSync(resVersionFile, dict);
        console.log("parseMapRes处理完成");
    }


    /**
     * 获取远程资源的hash
     */
    async getRemoteResHash($: BuildOption, result = { retry: 0 }): Promise<{ [uri: string]: string }> {

        let obj = await doSSH($.get_res_md5, $, true);

        //获取到流
        //流数据的结构是和运维协商的，如下所示
        //a043f6d64b582d16a9deb137bfd4b5f2  ./qd/qiri1.ani
        //e3f3fa33f178a4d1325ed7769ec4b1da  ./qd/qdname6.png
        //06c546dde9a47914cd1d970089fca71e  ./qd/qiri6.ani
        //c37faa7971fc2cdaee61d8097c258c5e  ./qd/qiri5.ani
        //xuke success
        //
        //32位文件的md5值 空格 res下的路径
        //
        //最终以 xuke success作为脚本执行完成的标识符
        let remoteString = obj.output;
        let lines = remoteString.split("\n");
        let len = lines.length - 1;
        let remoteDict: { [uri: string]: string };
        const remoteHashFile = path.join($.dir_tmp, "remoteHash.txt");
        console.log("远程路径", remoteHashFile);
        if (lines[len] == "xuke success") {
            lines.pop();
            remoteDict = {};
            for (let line of lines) {
                let dat = line.split("  ");
                if (dat.length == 2) {
                    let path = this.normalizeUri(dat[1]);
                    remoteDict[path] = dat[0];
                }
            }
            fs.writeJSONSync(remoteHashFile, remoteDict);
            return remoteDict;
        }
        else {
            //没有得到结尾标识符，认为此脚本获取失败
            result.retry++;
            if (result.retry < 3) {
                console.log("获取远程res的hash失败，重数次数：", result.retry);
                return this.getRemoteResHash($, result);
            }
            else {
                console.log("获取远程hash文件失败次数超过3次");
                //读取hash文件
                //尝试读取文件
                if (fs.existsSync(remoteHashFile)) {
                    try {
                        remoteDict = fs.readJSONSync(remoteHashFile);
                    } catch (e) {
                        console.log(`解析${remoteHashFile}的JSON失败,err:${e.message}`);
                    }
                }
                return remoteDict
            }
        }
    }

    async scp(params: ScpDefine) {
        await scpForRemote(params);
    }

    async createBranch($: BuildOption) {
        //创建一个分支
        //1. 策划填写版本号，并点击生成
        //2. 程序基于当前master版本打个Tag
        //3. 创建策划配置版本分支
        //3.1. 写入配置路径下对应globalCfg.json并调整路径到对应配置的指向
        //4. 将当前策划配置的生成文件创建一个对应目录的配置文件夹
        //4.1. 将刚刚创建的配置文件夹，制作一个副本，调度服务端一个配置git  
        let { git_user, dir_tmp, buildTime, git_pwd, version, project, git_path, dir_tmp_source, lan,
            globalCfgTemplate = `{
        "origin":"//h5.tpulse.cn/{project}/cfgs/{lan}/cfgs.json",
        "version":"{version}/",
        "endAction":"http://action.build.h5.tpulse.cn//data/projects/{project}/pakData.js?{version}"
    }`, git_branchRCFile } = this.initOpt($);

        if (!version) {
            version = `V${buildTime}`;
        }

        //2. 创建程序版本分支
        let result = /^(http[s]?):\/\/(.*?)$/.exec(git_path);
        if (result) {
            git_path = `${result[1]}://${git_user}:${git_pwd}@${result[2]}`;
        }

        //处理客户端版本
        let branch = this.clientDevBranch;
        const clientBranchName = this.getClientBranchName(version);
        if (branch) {
            checkGitDist(dir_tmp_source, git_path, branch);
            //基于master创建 `version` 版本的 tag，并提交
            // git("push", dir_tmp_source, "origin", `master:refs/tags/${version}`);
            git("push", dir_tmp_source, "origin", `${branch}:${clientBranchName}`);
        }

        //处理服务器版本
        branch = this.serverDevBranch;
        const serverBranchName = `server_${version}`
        if (branch) {
            checkGitDist(dir_tmp_source, git_path, branch);
            //基于master创建 `version` 版本的 tag，并提交
            // git("push", dir_tmp_source, "origin", `master:refs/tags/${version}`);
            git("push", dir_tmp_source, "origin", `${branch}:${serverBranchName}`);
        }

        if (git_branchRCFile) {
            try {
                fs.writeFileSync(git_branchRCFile, version);
            } catch {
                console.log(`将版本号[${version}]写入到[${git_branchRCFile}]失败，请手动处理`);
            }
        }

        //创建配置svn版本分支
        const svnCommitMSG = `"创建分支：${version}"`;
        const svnPath = this.svnPath;
        let cfgSVNSource = `${svnPath}/${project}/trunk/cfgs/${lan}/`;
        let cfgSVNDist = `${svnPath}/${project}/branch/${version}`;
        //检查svn分支是否已经存在
        let exists = false;
        try {
            svn.ls(cfgSVNDist);
            exists = true;
        } catch { }
        if (exists) {
            console.log("已经存在", cfgSVNDist)
        } else {
            svn.cp(cfgSVNSource, cfgSVNDist, svnCommitMSG);
            //将文件globalCfg.json附带版本号，提交至cfgs
            let template = globalCfgTemplate
                .replace(/\{project\}/g, project)
                .replace(/\{lan\}/g, lan)
                .replace(/\{version\}/g, version);

            //先将模板写入临时路径
            let cfgPath = path.join(dir_tmp, "globalCfg", version);
            fs.outputFileSync(cfgPath, template);
            //将分支中globalCfg.json删除
            let svnGlobalCfgPath = `${cfgSVNDist}/globalConfig.json`;
            try {
                svn.delete(svnGlobalCfgPath, svnCommitMSG);
            } catch { }//无视错误
            svn.import(cfgPath, svnGlobalCfgPath, svnCommitMSG);
        }

        //创建ui分支
        let uiSVNSource = `${svnPath}/${project}/trunk/ui/${lan}/`;
        let uiSVNDist = `${svnPath}/${project}/branch/${version}_ui`;
        //检查svn分支是否已经存在
        exists = false;
        try {
            svn.ls(uiSVNDist);
            exists = true;
        } catch { }
        if (exists) {
            console.log("已经存在", uiSVNDist)
        } else {
            svn.cp(uiSVNSource, uiSVNDist, svnCommitMSG);
        }

        //将已经提交的配置，创建副本
        let masterCfgOutput = this.getCfgPath($, lan, "", "output", "");
        let masterRaw = this.getCfgPath($, lan, "", "raw", "");
        let versionCfgOutput = this.getCfgPath($, lan, version, "output", "");
        let versionRaw = this.getCfgPath($, lan, version, "raw", "");
        console.log("try copy", masterCfgOutput, versionCfgOutput)
        fs.copySync(masterCfgOutput, versionCfgOutput);
        console.log("try copy", masterRaw, versionRaw)
        fs.copySync(masterRaw, versionRaw);

        let versionCfgRoot = this.getCfgPath($, lan, version, "", "");
        //对文件夹给与执行权限
        //chmod -R 777
        try {
            await executeCmd("chmod", ["-R", "777", versionCfgRoot]);
        } catch (e) {
            console.log(e);
        }

        let log = `分支[${version}]创建完成：\n配置分支路径：[${cfgSVNDist}]\nUI分支路径：[${uiSVNDist}]\n客户端分支名称：[${clientBranchName}]\n服务端分支名称：[${serverBranchName}]`;
        let dingding = $.webhook;
        if (dingding) {
            dingding.msg = log;
        }
        console.log(log);

        // //将文件提交到git
        // let serverCfgGitRoot = this.serverCfgPath;
        // checkGitDist(serverCfgGitRoot, this.serverCfgGitUrl);

        // const distPath = path.join(serverCfgGitRoot, "src", project, lan, version);
        // console.log("try copy", versionCfgRoot, distPath)
        // fs.copySync(versionCfgRoot, distPath);
        // git("add", serverCfgGitRoot, ".");
        // git("commit", serverCfgGitRoot, "-m", `配置更新，version:${version}`);
        // git("push", serverCfgGitRoot, "origin");
        return $;
    }


    async md5Res($: BuildOption, webFolder: string) {
        //1. 找到资源目录，将资源目录或者resVersionConfig.json 生成一个 原路径 和 md5后路径的数组
        //2. 尝试生成md5名字的文件到指定目录
        //3. 将生成的版本文件复制为--> resource/ver.txt
        const { checkFileResource, copyResToFile } = await import("./ResMd5Solver");
        const outPath = path.join($.dir_tmp, `res_${$.mainversion}.txt`);
        console.log(`开始检查资源文件[${$.dir_res}]中所有文件的hash值`)
        const { dir_res_base } = $;
        const { defaultLan, resVerFileName } = this;
        const dirs = fs.readdirSync(dir_res_base);
        for (let i = 0; i < dirs.length; i++) {
            const dir = dirs[i];
            if (dir != ".svn") {
                const inputDir = path.join(dir_res_base, dir);
                let arr = await checkFileResource(inputDir, outPath);
                copyResToFile(arr, $.md5ResDir);
                let v = "";
                if (dir !== defaultLan) {
                    v = "_" + dir;
                }
                copyFileSync(outPath, path.join(webFolder, "resource", resVerFileName.replace("{v}", v)));
            }
        }
        // let arr = await checkFileResource($.dir_res, outPath);
        // copyResToFile(arr, $.md5ResDir);
        // copyFileSync(outPath, path.join(webFolder, "resource", this.resVerFileName));
        console.log(`完成资源文件的检查和拷贝`);
    }
}

export * as fs from "fs-extra";
export * as Helper from "./Helper";