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
    const { dir_rawConfig, dir_tmp_source, afterEmbedJs, beforeEmbedJs } = $;
    const main = path.join(outFolder, "main.js");
    let files = [
        path.join(outFolder, "libs/modules/egret/egret.min.js"),
        path.join(assets, "egret.wxgame.js"),
        path.join(dir_tmp_source, "client", "/h5core/bin/h5core/h5core.min.js"),
        main,
        path.join(assets, "index.js")
    ];

    if (beforeEmbedJs) {
        files = beforeEmbedJs.concat(files);
    }

    if (afterEmbedJs) {
        files = files.concat(afterEmbedJs);
    }

    let content = "";
    content += getCode(path.join(assets, "weapp-adapter.js")) + "\n";
    content += getCode(path.join(dir_rawConfig, "lang.js")).replace("var $lang", "window.$lang") + "\n";
    let egretCode = "";
    files.forEach(uri => {
        egretCode += getCode(uri) + "\n";
    });

    content += clearCode(egretCode);
    content += "window.jy = jy;";

    content = content.replace(/@ver@/g, $.mainversion);
    //处理hash文件
    // //@hash@
    // let hash = "";
    // let resCfgPath = $.resCfgPath;
    // if (fs.existsSync(resCfgPath)) {
    //     hash = fs.readFileSync($.resCfgPath).toString("base64");
    // }
    // content = content.replace(/@hash@/, hash);

    let out = uglify.minify(content, { compress: true, output: { beautify: true } });

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