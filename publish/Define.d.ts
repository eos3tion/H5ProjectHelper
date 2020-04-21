/**
 * 资源数据
 */
interface ResInfo {
    /**
     * 资源路径
     */
    uri: string;
    /**
     * md5的hash值
     */
    md5?: string;

    /**
     * 当前版本号
     */
    version: number;

    /**
     * 是否已经删除
     */
    isDel?: boolean;

    /**
     * 完整物理路径
     */
    fullPath?: string;
}

interface BuildOption {
    /**
     * 策划定义的版本
     */
    version?: string;
    /**
     * 嵌入的脚本，合并到所有脚本之前
     */
    beforeEmbedJs?: string[];
    /**
     * 嵌入的脚本，合并到所有脚本之后
     */
    afterEmbedJs?: string[];
    /**
     * 对应的web路径
     */
    webDir?: string;
    /**
     * 对应脚本路径  
     * 默认当前脚本路径 `__dirname`
     */
    jsDir?: string;
    /**
     * 基础路径  
     * 默认 `f:/Builder/`
     */
    baseDir?: string;

    /**
     * 项目名称
     */
    project?: string;
    /**
     * 发布语言  
     * 默认 `cn`
     */
    lan?: string;

    /**
     * 发布的版本类型  
     * 用于区分 `版署版`(bs) `变态版`(bt) `常规版`
     * 默认 `nor`(常规版)
     */
    buildVersion?: string;

    /**
     * 主版本号  
     * 默认 ```$.lan + "." + $.buildVersion + "." + $.buildTime```
     */
    mainversion?: string;

    /**
     * 发布版配置路径  
     * 默认 ```$.webDir + "/" + $.project + "/cfgs/" + $.lan + "/publish"```
     */
    dir_pubConfig?: string;
    /**
     * 原始语言版(一般为中文版)的路径
     * 默认 ```$.webDir + "/" + $.project + "/cfgs/cn/client"```
     */
    dir_defConfig?: string;
    /**
     * 当前语言配置的原始目录
     * 默认 ```$.webDir + "/" + $.project + "/cfgs/cn/raw"```
     */
    dir_rawConfig?: string;
    /**
     * 配置的原始路径  
     * 默认 ```$.webDir + "/" + $.project + "/cfgs/" + $.lan + "/client"```
     */
    dir_srcConfig?: string;

    /**
     * 项目svn根目录
     * 默认 ```this.svnPath + "/" + $.project + "/trunk"```
     */
    svn_project_trunk?: string;
    /**
     * 项目svn的res目录  
     * 默认 ```$.svn_project_trunk + "/res/" + $.lan ```
     */
    svn_res?: string;

    /**
     * 创建时间用于创建版本号和zip目录名称  
     * 格式： `yyyyMMdd_HHmmss`
     */
    buildTime?: string;

    /**
     * 项目资源svn对应的物理目录
     * 默认 ```this.webDir + "/" + $.project + "/res/" + $.lan + "/"```
     */
    dir_res?: string;
    /**
     * 项目资源原始语言版本的svn对应的物理目录
     * 默认 ```this.webDir + "/" + $.project + "/res/" + this.defaultLan + "/"```
     */
    dir_resRaw?: string;

    /**
     * 临时文件夹路径  
     * 默认 ```$.baseDir + "/temp/" + $.project + "/" + $.lan + "/" + $.buildVersion```
     */
    dir_tmp?: string;

    /**
     * 资源的版本文件路径
     * 默认 ```$.dir_temp + "/resVersion.json"```
     */
    resVersionFile?: string;

    /**
     * git的远程路径  
     * 默认 this.gitPath
     */
    git_path?: string;

    /**
     * git用户名  
     * 默认 `H5Builder`
     */
    git_user?: string;

    /**
     * git用户名
     * 默认 `H5Builder`
     */
    git_pwd?: string;

    /**
     * 默认为"m"
     */
    dir_mapRaw?: string;

    /**
     * 默认为"m2"
     */
    dir_mapRelease?: string;

    /**
     * 是否显示文件处理的日志
     */
    showFileSolveLog?: boolean;

    /**
     * 资源版本字典
     */
    resVersionDict?: { [index: string]: ResInfo };

    /**
     * 资源配置路径
     */
    resCfgPath?: string;

    /**
     * 白鹭版本号
     * 默认 5.0.11
     */
    egretVersion?: string;

    /**
     * 配置的打包路径
     */
    cfgPath?: string;

    /**
     * 打包配置文件名称  
     * 默认 `cfgs.bin`
     */
    cfgFileName?: string;

    /**
     * 是否已经初始化完毕
     */
    inited?: boolean;

    /**
     * 源码路径  
     * 默认 ```$.dir_temp + "/source"```
     */
    dir_tmp_source?: string;

    /**
     * 版本分支  
     * 默认```master```
     */
    git_branch?: string;

    /**
     * 用于文件编译的目录
     */
    dir_tmp_publish?: string;

    /**
     * 内网用
     */
    dir_tmp_nightly?: string;

    /**
     * 是否发布正式版
     */
    isRelease?: boolean;

    /***
     * 是否发布微信
     */
    isWeiXin?: boolean;

    /**
     * 发布的类型，用于处理不同的发布方式  
     * `wxgame` 微信小游戏  
     * `yiapp` 易应用  
     */
    buildType?: string;

    /**
     * 是否拷贝原始的.raw文件夹
     */
    useRaws?: string[];

    /**
     * 发布需要用的文件和文件夹
     */
    buildFiles?: string[];

    /**
     * 编译完成前用于覆盖的文件  
     * ```$.dir_tmp_source +  "/rc/before_coverd" ```
     */
    dir_before_coverd?: string;

    /**
     * 编译完成后用于覆盖的文件  
     * 默认 ```$.dir_tmp_source +  "/rc/after_coverd" ```
     */
    dir_after_coverd?: string;

    /**
     * 其他source下需要拷贝的文件
     */
    other_srcFiles?: string[];

    /**
     * 获取远程res的脚本命令
     */
    get_res_md5?: string;

    /**
     * 运维用的语言版本
     */
    yunweiLan?: string;

    /**
     * 运维用的项目编号
     */
    yunweiProject?: string;

    /**
     * 运维给的远程路径  
     * 
     */
    yunweiPath?: string;

    /**
     * 是否打包程序
     */
    pakApp?: boolean;

    /**
     * 是否打包资源
     */
    pakRes?: boolean;

    /**
     * 运维指令
     * ```source /etc/profile;bash /data/script/version_update/{yunweiLan}{yunweiProject}_update.sh {cmd} {yunweiLan}{yunweiProject}```
     */
    yunweiCmd?: string;

    /**
     * 上传app
     */
    upload_app?: string;

    /**
     * 上传资源
     */
    upload_res?: string;

    /**
     * 要使用的WEB版本
     */
    versionByDate?: boolean;

    /**
     * 要处理的平台的html
     */
    pingtaihtmls?: string[];

    /**
     * 是否清理版本信息
     */
    clearVer?: boolean;

    /**
     * game.json的路径
     */
    gameCfgPath?: string;

    /**
     * 远程运维机器的ip
     */
    opSSHIp?: string;

    /**
     * scp资源包的远程路径
     */
    scpRes?: string;
    /**
     * scp程序包的远程路径
     */
    scpApp?: string;

    /**
     * 目标web的zip的路径
     */
    zipPathApp?: string;
    /**
     * 目标res的zip的路径
     */
    zipPathRes?: string;

    /**
     * 操作结束后的webhook回调
     */
    webhook?: WebhookMsg;

    /**
     * 是否处于wx小游戏的调试状态
     */
    wxappDebug?: boolean;

    /**
     * uglify参数
     */
    uglifyOptions?: import("uglify-js").MinifyOptions;

    /**
     * WebSocket代理地址
     */
    wsProxy?: string;

    /**
     * 游戏标题
     */
    title?: string;

    /**
     * 掌盟登录入口地址
     */
    zmGateUrl?: string;

    /**
     * 使用json的语言包文件路径  
     * 如果不配置，则表示使用的js的语言包文件
     */
    useJsonLang?: string;

    /**
     * 要合并的文件列表
     */
    mergedFiles?: string[];

    /**
     * 如果配置了pstPath，则回去打包pstPath中的pst数据
     */
    pstPath?: string;

    /**
     * 拖表配置文件的模板  
     * 默认为
     * ```json
     * {
     * 	"origin":"//h5.tpulse.cn/{project}/cfgs/{lan}/cfgs.json",
     * 	"version":"{version}"
     * }
     * ```
     */
    globalCfgTemplate?: string;
}

/**
 * SCP的相关配置
 */
interface ScpDefine {
    /**
     * 远程地址
     */
    host: string,
    /**
     * 远程文件路径
     */
    path: string,
    /**
     * 本地文件路径
     */
    file: string
}

interface WebhookMsg {
    /**
     * 钉钉消息内容
     */
    msg: string;
    /**
     * 钉钉的回调地址
     */
    url: string;
}

interface BuildPlugin {

    onCompile($: BuildOption);

    onBuildApp($: BuildOption);
}

interface ServerBuildOption {
    /**
     * 如 "server"
     */
    key: string;
    /**
     * 远程服务器sshIp
     */
    host: string;
    /**
     * 本地文件/文件夹路径
     */
    localPath: string;
    /**
     * 远程文件夹路径
     */
    remotePath: string;

    /**
     * 运维提供的更新脚本指令
     */
    cmd?: string;

    /**
     * 指令列表
     */
    buildCmds: string;
}