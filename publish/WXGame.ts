import * as path from "path";
import * as fs from "fs-extra";
import { copy, executeCmd, egret } from "./Helper";
import { clearCode } from "./ClearCode";
import * as uglify from "uglify-js";

let outFolder: string;
let dir_tmp_publish: string;
let assets: string;
let scriptPath: string;

function init($: BuildOption) {
    const { dir_tmp, buildType, dir_tmp_source } = $;
    dir_tmp_publish = path.join(dir_tmp, buildType);
    scriptPath = path.join(dir_tmp_source, "client", "scripts", "wxgame");
    assets = path.join(scriptPath, "assets");
    outFolder = path.join(dir_tmp_publish, "bin-wxgame");
}

export async function onCompile($: BuildOption) {
    init($);

    const dir_before_coverd = path.join(scriptPath, "before_coverd");
    const dir_after_coverd = path.join(scriptPath, "after_coverd");

    if (fs.pathExistsSync(dir_before_coverd)) {
        copy(dir_before_coverd, dir_tmp_publish);
    }
    let code = await executeCmd(egret, ["copylib"], { cwd: dir_tmp_publish });
    if (code) {
        console.log(`egret 发生错误，退出处理`)
        return;
    }
    code = await executeCmd(egret, ["publish", "--version", "bin-wxgame", "--target", "wxgame"], { cwd: dir_tmp_publish });
    if (code) {
        console.log(`egret 发生错误，退出处理`)
        return;
    }
    console.log(`egret 编译完成`);
    if (fs.pathExistsSync(dir_after_coverd)) {
        copy(dir_after_coverd, outFolder);
    }
}

export function onBuildApp($: BuildOption) {
    const { dir_rawConfig, dir_tmp_source, afterEmbedJs, beforeEmbedJs, wxappDebug } = $;
    let egretJson = fs.readJsonSync(path.join(dir_tmp_publish, "egretProperties.json"));
    const main = path.join(outFolder, "main.js");
    let egretModDirBase = path.join(dir_tmp_publish, "libs", "modules");
    let files = [] as string[];
    let min = wxappDebug ? "" : "min."

    egretJson.modules.forEach(mod => {
        let name = mod.name;
        files.push(path.join(egretModDirBase, name, `${name}.${min}js`))
    })

    files.push(
        path.join(assets, "egret.wxgame.js"),
        path.join(dir_tmp_source, "client", `/h5core/bin/h5core/h5core.${min}js`),
        main,
        path.join(assets, "index.js")
    );

    if (beforeEmbedJs) {
        beforeEmbedJs.forEach((v, i, arr) => {
            arr[i] = v.replace("./", dir_tmp_source + "/")
        })
        files = beforeEmbedJs.concat(files);
    }

    if (afterEmbedJs) {
        afterEmbedJs.forEach((v, i, arr) => {
            arr[i] = v.replace("./", dir_tmp_source + "/")
        })
        files = files.concat(afterEmbedJs);
    }

    let content = "window.supportWebp = false;";
    content += getCode(path.join(assets, "weapp-adapter.js")) + "\n";
    if (!$.useJsonLang) {
        content += getCode(path.join(dir_rawConfig, "lang.js")).replace("var $lang", "window.$lang") + "\n";
    }
    let egretCode = "";
    files.forEach(uri => {
        egretCode += getCode(uri) + "\n";
    });

    if (wxappDebug) {
        content += egretCode;
    } else {
        content += clearCode(egretCode);
    }
    content += "window.jy = jy;";

    content = content.replace(/@ver@/g, $.mainversion);
    //处理hash文件
    let settings = wxappDebug ? { compress: false, output: { beautify: true } } as uglify.MinifyOptions : $.uglifyOptions;
    let out = uglify.minify(content, settings);

    const code = out.code;
    if (!code) {
        fs.writeFileSync(path.join(outFolder, "game.js"), content);
        return console.log(out.error);
    }

    fs.writeFileSync(path.join(outFolder, "game.js"), code);

    //删除libs文件夹
    fs.removeSync(path.join(outFolder, "libs"));
    //删除 main.js，只保留game.js
    fs.unlinkSync(main);

    uploadForWX();
}

function getCode(uri: string) {
    if (fs.existsSync(uri)) {
        console.log("合并脚本：", uri);
        return fs.readFileSync(uri, "utf8");
    } else {
        console.log(`合并脚本时，没有找到：`, uri);
    }
    return "";
}

function uploadForWX() {
    //TODO 微信小程序的打包
}