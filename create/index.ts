#!/usr/bin/env node

import * as fs from "fs-extra";
import * as path from "path";
import { redBright as clcRed, yellowBright as clcYellow } from "cli-color";
import * as ini from "ini";
import * as shell from "shelljs";
import * as program from "commander";
import * as cp from "child_process";

const defaultBaseDir = "/data/projects";

const defaultSharePath = "www";

const defaultResPath = "res";

const defaultCfgPath = "cfgs";

const defaultSambaCfgPath = "/etc/samba/smb.conf";

const defaultEndShell = `systemctl restart smb;systemctl reload nginx;chmod -R 777 @baseDir@/@name@/${defaultSharePath};chmod -R 755 @baseDir@/@name@/${defaultSharePath}/${defaultResPath};`;

const defaultNgxMainCfgName = "nginx.conf";

const defaultNgxHttpsCfgName = "https.conf";

const defaultTempDirName = "temp";

/**
 * 主干名称
 */
const defaultTrunkName = "trunk";

/**
 * svn基础目录
 */
const defaultSVNReposDir = "/data/svn/repos";

/**
 * svn远程目录
 */
const defaultSVNDir = "svn://192.168.9.187:3333/";

/**
 * svn repo的模板路径
 */
const defaultSVNTempDir = "/data/svn/repos/repo_temp";

const dirStruct = {
    "output": {
        "client": null,
        "server": null
    },
    "raw": {
        "client": {
            "extra": null
        }
    }
}

const defaultTemplatePath = path.join(__dirname, "template");

const defaultVerCfgTemplatePath = path.join(defaultTemplatePath, "cfgs.json");

const defaultWWWTemplateFilesPath = path.join(defaultTemplatePath, defaultSharePath);

const defaultWWWTemplateTextFileExts = [".js", ".html"];

const defaultPakCfgScriptsPath = path.join(defaultTemplatePath, "pakScripts");

/**
 * 获取nginx配置模板
 */
function getNginxMainCfgTemplate(opt: ProjectOption) {
    const { name, baseDir = defaultBaseDir } = opt;
    return `
server {
	server_name ${name}.h5;
	listen 80;
    expires -1s;
        
    autoindex on;
    autoindex_exact_size on;
    autoindex_localtime on;

	location / {
		add_header 'Access-Control-Allow-Origin' $http_origin;
		root ${baseDir}/${name}/${defaultSharePath};
    }
    
    location /cn/nightly {
		add_header 'Access-Control-Allow-Origin' $http_origin;
		alias ${baseDir}/${name}/${defaultTempDirName}/cn/nor/nightly;
	}

    location /cn/rc {
		add_header 'Access-Control-Allow-Origin' $http_origin;
		alias ${baseDir}/${name}/${defaultTempDirName}/cn/nor/publish/bin-release/web/out;
    }
}
`
}

function getNginxHttpsCfgTemplate(opt: ProjectOption) {
    const { name } = opt;
    return `
location /${name}/ {
    proxy_pass http://${name}.h5/;
    proxy_set_header X-Real_IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
}
`
}

/**
 * samba模板
 * @param baseDir 
 * @param name 
 * @param defaultSharePath 
 */
function getSambaTemplate(baseDir: string, name: string, defaultSharePath: string) {
    return {
        path: `${baseDir}/${name}/${defaultSharePath}`,
        comment: name,
        public: "yes",
        writable: "yes",
        "read only": "no",
        "create mask": "1777",
        "directory mask": "1777"
    }
}

interface ProjectOption {
    /**
     * 项目名称
     */
    name: string;

    /**
     * 项目基础路径
     */
    baseDir?: string;

    /**
     * samba的配置路径
     */
    sambaCfgPath?: string;

    /**
     * 结束时，执行的shell脚本  
     * ```bash
     * systemctl restart smb
     * systemctl reload nginx
     * ```
     */
    endShell?: string;

    /**
     * svn的repos路径
     */
    svnReposDir?: string;

    /**
     * svn的Repo模板路径
     */
    svnRepoTempDir?: string;

    /**
     * svn远程目录
     */
    svnDir?: string;
}



/**
 * 创建samba配置
 * @param opt 
 * @param sambaPath 
 */
function createSamba(opt: ProjectOption) {
    const { name, baseDir = defaultBaseDir, sambaCfgPath = defaultSambaCfgPath } = opt;
    if (!fs.existsSync(sambaCfgPath)) {
        return console.log(clcRed(`找不到samba配置文件：`) + clcYellow(sambaCfgPath));
    }
    let cfg = ini.parse(fs.readFileSync(sambaCfgPath, "utf8"));
    if (name in cfg) {
        return console.log(`${clcRed(`[samba]配置中已经存在`)}${clcYellow(`[${name}]`)}的配置:\n${ini.encode(cfg[name])}`);
    }
    //创建 samba  
    cfg[name] = getSambaTemplate(baseDir, name, defaultSharePath);
    fs.writeFileSync(sambaCfgPath, ini.encode(cfg));
}

function createNginxCfg(opt: ProjectOption) {
    const { name, baseDir = defaultBaseDir } = opt;

    let file = path.join(baseDir, name, defaultNgxMainCfgName);
    if (fs.existsSync(file)) {
        return console.log(`${clcRed(`已经存在：`)}${clcYellow(file)}`);
    }
    fs.writeFileSync(file, getNginxMainCfgTemplate(opt), "utf8");

    file = path.join(baseDir, name, defaultNgxHttpsCfgName);
    if (fs.existsSync(file)) {
        return console.log(`${clcRed(`已经存在：`)}${clcYellow(file)}`);
    }
    fs.writeFileSync(file, getNginxHttpsCfgTemplate(opt), "utf8");

}

function createDirectories(opt: ProjectOption) {
    // ----www
    //     |--------cfgs
    //     |		 |----@ver@
    //     |		 |	   |- cfgs.json  配置工具生成
    //     |         |     |- output
    //     |         |     |    |- client
    //     |         |     |    |- server
    //     |         |     |    
    //     |         |     |- raw
    //     |		 |          |-client
    //     |		 |              |-extra
    //     |		 |              |   |-*.json  配置工具生成
    //     |		 |              |
    //     |		 |              |-*.json  配置工具生成
    //     |		 |              |-*.bin  配置工具生成
    //     |		 | 
    //     |		 |----..
    //     |
    //     |---------res
    //      		 |----@ver@
    //      		 |----..
    // ----temp
    //     |
    const { name, baseDir = defaultBaseDir } = opt;
    let basePath = path.join(baseDir, name)
    let sharePath = path.join(basePath, defaultSharePath);
    checkAndMkDir(basePath);
    createVerCfgs("cn", sharePath);
    //创建res目录
    checkAndMkDir(path.join(sharePath, defaultResPath));
    //创建 temp 目录
    checkAndMkDir(path.join(basePath, defaultTempDirName));
}



function createVerCfgs(ver: string, basePath: string) {
    basePath = path.join(basePath, defaultCfgPath);
    checkAndMkDir(basePath);

    const verDir = path.join(basePath, ver);
    checkAndMkDir(verDir);
    //创建目录结构
    createDirStruct(verDir, dirStruct);
    //拷贝配置文件到目录
    //检查是否已经存在`cfgs.json`
    const cfgJsonFile = path.join(verDir, "cfgs.json")
    if (!fs.existsSync(cfgJsonFile)) {
        let data = fs.readFileSync(defaultVerCfgTemplatePath, "utf8");
        data = data.replace(/@ver@/g, ver);
        fs.writeFileSync(cfgJsonFile, data);
    } else {
        return console.log(`${clcRed(`已经存在：`)}${clcYellow(cfgJsonFile)}`);
    }
}

function createDirStruct(base: string, dirStruct: { [dir: string]: {} }) {
    for (let dir in dirStruct) {
        let p = path.join(base, dir);
        checkAndMkDir(p);
        let subStruct = dirStruct[dir];
        if (subStruct) {
            createDirStruct(p, subStruct);
        }
    }
}

function checkAndMkDir(path: string) {
    if (!fs.existsSync(path)) {
        fs.mkdirsSync(path);
    } else {
        console.log(`${clcRed(`已经存在：`)}${clcYellow(path)}`);
    }
}

function createSVN(opt: ProjectOption) {
    const { name, svnReposDir = defaultSVNReposDir, svnRepoTempDir = defaultSVNTempDir } = opt;
    //复制模板 repo_temp
    if (!fs.existsSync(svnReposDir)) {
        return console.log(clcRed(`SVN的repos路径[${svnReposDir}]不存在`));
    }
    if (!fs.existsSync(svnRepoTempDir)) {
        return console.log(clcRed(`SVN的模板[${svnRepoTempDir}]不存在`));
    }
    let repoPath = path.join(svnReposDir, name);
    if (fs.existsSync(repoPath)) {
        return console.log(`${clcRed(`已经存在：`)}${clcYellow(repoPath)}`);
    }
    //尝试创建 repo
    fs.copySync(svnRepoTempDir, repoPath);
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
        throw Error(`执行失败: svn ${cmd} ${arg.join(" ")}`);
    }
    console.log(`执行完成: svn ${cmd} ${arg.join(" ")}`);
    return obj;
}

function checkOutRes(opt: ProjectOption) {
    const { name, baseDir = defaultBaseDir, svnDir = defaultSVNDir } = opt;
    let basePath = path.join(baseDir, name)
    let sharePath = path.join(basePath, defaultSharePath);
    let distDir = path.join(sharePath, defaultResPath);
    let svnSrc = svnDir + path.join(name, defaultTrunkName, defaultResPath);
    svnExec("checkout", { stdio: "pipe", cwd: distDir }, svnSrc, distDir);
}

function copyWWWTemplateFiles(opt: ProjectOption) {
    if (!fs.existsSync(defaultWWWTemplateFilesPath)) {
        return console.log(clcRed(`www的模板文件夹路径[${defaultWWWTemplateFilesPath}]不存在`));
    }
    if (!fs.statSync(defaultWWWTemplateFilesPath).isDirectory()) {
        return console.log(clcRed(`www的模板文件夹路径[${defaultWWWTemplateFilesPath}]被占用，请检查`));
    }
    const { name, baseDir = defaultBaseDir, svnDir = defaultSVNDir } = opt;
    let basePath = path.join(baseDir, name)
    let sharePath = path.join(basePath, defaultSharePath);

    walkFile(defaultWWWTemplateFilesPath, ".", (file, relativePath) => {
        let dest = path.join(sharePath, relativePath);
        if (fs.existsSync(dest)) {
            return console.log(`${clcRed(`已经存在：`)}${clcYellow(dest)}`);
        }
        if (defaultWWWTemplateTextFileExts.includes(path.extname(file))) {
            let cnt = fs.readFileSync(file, "utf8");
            cnt = replaceVars(cnt, opt);
            fs.outputFileSync(dest, cnt);
        } else {
            fs.copySync(file, dest);
        }
    })
}

function walkFile(root: string, cur: string, fileHandler: { (file: string, relativePath: string): void }) {
    let list = fs.readdirSync(path.join(root, cur));
    //开始检查文件
    list.forEach(f => {
        let relativePath = path.join(cur, f);
        let file = path.join(root, relativePath);
        let stat = fs.statSync(file);
        if (stat.isDirectory()) {
            walkFile(root, relativePath, fileHandler);
        } else if (stat.isFile()) {
            fileHandler(file, relativePath);
        }
    })
}

function replaceVars(cnt: string, opt: ProjectOption) {
    const { name, baseDir = defaultBaseDir } = opt;
    return cnt.replace(/@name@/g, name)
        .replace(/@baseDir@/g, baseDir);
}

function copyCfgPakScripts(opt: ProjectOption) {
    const { name, baseDir = defaultBaseDir } = opt;
    let basePath = path.join(baseDir, name)
    walkFile(defaultPakCfgScriptsPath, ".", (file, relativePath) => {
        let dest = path.join(basePath, relativePath);
        if (fs.existsSync(dest)) {
            return console.log(`${clcRed(`已经存在：`)}${clcYellow(dest)}`);
        }
        let cnt = fs.readFileSync(file, "utf8");
        cnt = replaceVars(cnt, opt);
        fs.outputFileSync(dest, cnt);
    })
}

/**
 * 尝试创建项目
 * @param projectname 
 */
function createProject(opt: ProjectOption) {
    //检查项目名称是否已经被占用
    const { name, baseDir = defaultBaseDir, endShell = defaultEndShell } = opt;
    const projectDir = path.join(baseDir, name);

    checkAndMkDir(projectDir);

    createDirectories(opt);

    createSamba(opt);

    createNginxCfg(opt);

    //处理svn
    createSVN(opt);

    checkOutRes(opt);

    copyWWWTemplateFiles(opt);

    copyCfgPakScripts(opt);

    //执行结束脚本
    let script = replaceVars(endShell, opt);


    console.log(`准备执行：`, script);
    shell.exec(script);
}

program
    .version("0.1")

program.command("create <name>")
    .description("创建一个新项目")
    .option("-b, --baseDir <path>", "项目放置的路径")
    .option("-es, --endShell <shell>", "执行完毕时，调用的shell脚本")
    .option("-s, --shareDir <dir>", "共享目录的名称，默认为www")
    .option("-smb, --sambaCfgPath <cfgPath>", "samba配置文件的路径，默认 /etc/samba/smb.conf")
    .action(function (name: string, opt: ProjectOption) {
        opt.name = name;
        createProject(opt);
    })


program.command("ver <name> <ver> [baseDir]")
    .description("为指定项目<name>创建特定的版本")
    .action(function (name: string, ver: string, baseDir?: string) {
        baseDir = baseDir || path.join(defaultBaseDir, defaultSharePath);
        let base = path.join(baseDir, name);
        createVerCfgs(ver, base);
    })

program.parse(process.argv);