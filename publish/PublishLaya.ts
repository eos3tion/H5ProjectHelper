import { PublishBase } from "./Publish";
import { pakLayaUnityRes } from "./PakLayaUnity";
import * as path from "path";
import * as fs from "fs-extra";
import { svn, checkGitDist, copy } from "./Helper";
import { cat } from "shelljs";

export class PublishLaya extends PublishBase {

    /**
     * res目录下，场景的相对目录
     */
    layaSceneDir = "scene";

    /**
     * 打包后的文件名称
     */
    layaPakFileName = "scene.json";

    constructor() {
        super();
        this.funcs["zipLayaUnityRes"] = {
            func: this.zipLayaUnityRes,
            desc: `zipLayaUnityRes(opt:BuildOption)
用于将Laya的Unity插件导出的3d资源进行打包，避免加载大量小文件造成过多的加载时长
`
        }
    }

    async zipLayaUnityRes($: BuildOption = {}) {
        //先更新资源文件夹
        this.updateRes($);
        let outFile = this.layaPakFileName;
        let baseDir = path.join($.dir_res, this.layaSceneDir);
        let output = path.join(baseDir, outFile)
        //打包场景资源
        pakLayaUnityRes(baseDir, output);
        //svn提交资源
        try {
            svn.add(outFile, baseDir);
        } catch (e) {
            console.log(e);
        }
        try {
            svn.commit(outFile, baseDir);
        } catch (e) {
            console.log(e);
        }
    }

    async buildApp($: BuildOption = {}) {
        let { isRelease, git_path, git_user, git_pwd, dir_tmp_source, git_branch, buildType, dir_tmp_publish, dir_tmp_nightly, dir_tmp, pingtaihtmls, buildFiles, gameCfgPath, mainversion } = $;
        let result = /^(http[s]?):\/\/(.*?)$/.exec(git_path);
        if (result) {
            git_path = `${result[1]}://${git_user}:${git_pwd}@${result[2]}`;
        }

        let changelog = checkGitDist(dir_tmp_source, git_path, git_branch);
        let buildPlugin: BuildPlugin;
        // if (buildType) {
        //     buildPlugin = plugins[buildType];
        //     if (!buildPlugin) {
        //         return console.log(`没有找到指定的编译插件${buildType}`);
        //     }
        // }

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


        //TODO  使用webpack打包
        //1 需要打包nightly  nightly的`DEBUG=true` `RELEASE=false` `noClientCheck=false`
        //2 需要打包release


        console.log("处理完成");
        const log = `发布${isRelease ? `正式版` : `nightly版`}${mainversion}${changelog ? `，变更内容：\n${changelog}` : ``}`
        let dingding = $.webhook;
        if (dingding) {
            dingding.msg = log;
        }
        console.log(log);
        return $;
    }
}