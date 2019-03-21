import { PublishBase } from "./Publish";
class Build extends PublishBase {
    /**
     * 项目的git路径
     */
    gitPath = "http://192.168.0.205:1234/h5arpg/hqg.git";

    svn_project_trunk = "svn://192.168.0.5:3333/hqg/trunk";
    // gitPwd = "H5Builder";
    // gitUser = "H5Builder";
    // /**
    //  * 项目svn地址
    //  */
    // svnPath = "svn://192.168.0.5:3333";

    // /**
    //  * 默认语言
    //  */
    // defaultLan = "cn";

    // /**
    //  * 对应的web路径
    //  */
    // webDir = "f:/web/";

    // /**
    //  * 用于构件的临时目录
    //  */
    // baseDir = "f:/Builder/";

    // /**
    //  * 项目名称
    //  */
    // project = "hqgrpg";

    // /**
    //  * 白鹭版本号
    //  */
    // egretVersion = "5.0.11";

    // /**
    //  * 配置文件路径
    //  */
    // cfgPath = "";

    // /**
    //  * 发布时要拷贝的文件或文件夹
    //  */
    // buildFiles = ["src", "index.html", "libs/modules", "egretProperties.json", "tsconfig.json", "typings", "template", "h5core", "resource/default.res.json", "resource/game.json"];
}

let build = new Build();
build.init();