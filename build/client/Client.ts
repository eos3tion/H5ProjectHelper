/// <reference path="../Define.d.ts" />
declare let settings: any;
declare let yunweiProject: string;
declare let initView: Function;

function $g(id) {
    return document.getElementById(id)
}
function $c(content) {
    return document.createElement(content)
}
let ws: WebSocket;
let projectName: string;
let dialog: HTMLDialogElement;

function connect(project?: string) {
    ws = new WebSocket("ws://build.h5/websocket");
    ws.onerror = function (event: ErrorEvent) {
        log("发生错误：" + event.message);
    };
    ws.onmessage = function (event) {
        let data = event.data;
        if (typeof data === "string") {
            data = JSON.parse(data);
            let dat = data.data;
            switch (data.type) {
                case MessageType.Message:
                    log(dat);
                    break;
                case MessageType.DialogShow:
                    dialog.innerHTML = dat;
                    dialog.showModal();
                    break;
                case MessageType.DialogHide:
                    break;
            }
        } else if (data instanceof Blob) {
            let a = new FileReader();
            a.onload = function (e) {
                log((e.target as FileReader).result.toString())
            };
            a.readAsText(data);
        }
    };
    ws.onclose = function (event) {
        log("连接断开:" + event.code + ', ' + event.reason);
    };
    if (project) {
        connectAndDo("$", "connect", [project]);
    }
}
function log(msg: string) {
    let output = $g("output");
    let node = document.createTextNode(msg);
    output.appendChild(node);
    let hid = $g("loghid");
    hid.scrollIntoView(false);

}

function connectAndDo(project: string, func: string, params: any[]) {
    return (function () {
        if (!ws) {
            connect();
        }
        switch (ws.readyState) {
            case WebSocketState.CONNECTING:
                ws.addEventListener('open', arguments.callee as any);
                break;
            case WebSocketState.OPEN: //已经连接上
                callback(project, func, params);
                break;
            default:
                connect();
                ws.addEventListener('open', arguments.callee as any);
                break;
        }
    })()
}

function callback(project: string, func: string, params: any[]) {
    ws.send(JSON.stringify({
        project: project,
        func: func,
        params: params
    }))
}

function clearLog() {
    let log = $g("output");
    log.innerHTML = "";
}

window.onscroll = function () {
    let header = $g("header");
    let t = document.body.scrollTop;
    if (t > 0) {
        header.className = "headScroll";
    } else {
        header.className = null;
    }
};

function createCheckBox(parent: HTMLElement, label: string, value: string) {
    let lab = $c("label");
    let cb = $c("input");
    cb.type = "checkbox";
    cb.value = value;
    let node = document.createTextNode(label);
    lab.appendChild(cb);
    lab.appendChild(node);
    parent.appendChild(lab);
}

function getPlugins(lan: string, pluginsData?: { [key: string]: any }) {
    let $plugins = {};
    let plugins = $g("plugins-" + lan);
    if (plugins) {
        let cbs = plugins.getElementsByTagName("input");
        let len = cbs.length;
        if (pluginsData) {
            for (let i = 0; i < len; i++) {
                let cb = cbs[i];
                if (cb.type == "checkbox" && cb.checked) {
                    let pdata = pluginsData[cb.value];
                    $plugins[pdata[0]] = pdata[1];
                }
            }
        }
    }
    return $plugins;
}

/**
 * 创建语言发布区
 */
function createLanArea(lan: string) {
    let area = $g("lan-" + lan);
    let setting = settings[lan];
    if (!setting) {
        alert("没有配置[" + lan + "]版本的配置");
        return;
    }
    let lanDiv = $g("lan");
    if (!lanDiv) {
        alert("没有放置多版本信息，id为'lan'的div");
        return;
    }
    if (!area) {
        area = $c("div");
        area.id = "lan-" + lan;
        lanDiv.appendChild(area);
        let title = $c("div");
        title.innerHTML = "▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇" + (setting.name || lan) + "版本▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇";
        area.appendChild(title);
    }
    let plugins = setting.plugins;
    if (plugins) {
        let pluginDiv = $g("plugins-" + lan);
        if (!pluginDiv) {
            pluginDiv = $c("div");
            pluginDiv.id = "plugins-" + lan;
            area.appendChild(pluginDiv);
        }
        for (let label in plugins) {
            createCheckBox(pluginDiv, label, label);
        }
    }
    let input = $g("build-" + lan);
    if (!input) {
        input = createBtn("发布正式版" + (setting.name || lan), setting.rcHandler || getDefaultBuildHandler(lan), area);
        input.id = "build-" + lan;
    }
    if (setting.hasNightly) {
        let input_1 = $g("build-nightly-" + lan);
        if (!input_1) {
            input_1 = createBtn("发布Nightly版" + (setting.name || lan), setting.nightlyHandler || getDefaultNightlyHandler(lan), area);
            input_1.id = "build-nightly-" + lan;
        }
    }
    let br = $c("br");
    lanDiv.appendChild(br);
    br = $c("br");
    lanDiv.appendChild(br);
}

function getDefaultNightlyHandler(lan: string) {
    return function () {
        let setting = settings[lan];
        let language = setting.lan || lan;
        let opt = {
            project: projectName,
            useRaws: ["lib"],
            isRelease: false,
            lan: language
        }
        let options = setting.options;
        if (options) {
            for (let k in options) {
                opt[k] = options[k];
            }
        }
        connectAndDo(projectName, 'buildApp', [opt]);
    }
}

function getDefaultBuildHandler(lan: string, other?) {
    return function () {
        let pubApp = $g("pubApp") as HTMLInputElement;
        let pubRes = $g("pubRes") as HTMLInputElement;
        let setting = settings[lan];
        let chx = $g("mkver") as HTMLInputElement;
        let versionByDate = false;
        if (chx) {
            versionByDate = chx.checked;
        }
        if (!setting) {
            alert("没有配置[" + lan + "]版本的配置");
            return;
        }
        let yunweiKey = setting.yunweiKey;
        if (!yunweiKey) {
            alert("没有配置[" + lan + "]的运维标识(yunweiKey)");
            return;
        }
        let ywProject = setting.yunweiProject || yunweiProject;
        let remoteKey = setting.remoteKey || yunweiKey;
        let upload_app = setting.upload_app

        //上传资源
        let upload_res = setting.upload_res;
        let dir_remote = setting.dir_remote || "//192.168.0.202/" + yunweiProject + "_version/" + remoteKey + "/";
        //获取资源md5的指令
        let get_res_md5 = setting.get_res_md5 || "source /etc/profile;bash /data/script/get_client_md5.sh " + yunweiKey + " res";
        let language = setting.lan || lan;
        let opt = {
            project: projectName,
            upload_app: upload_app,
            upload_res: upload_res,
            get_res_md5: get_res_md5,
            lan: language,
            dir_remote: dir_remote,
            isRelease: true,
            pakApp: pubApp.checked,
            pakRes: pubRes.checked,
            isWeiXin: other ? other.isWeiXin : false,
            yunweiProject: ywProject,
            useRaws: ["lib"],
            versionByDate: versionByDate,
            pingtaihtmls: setting["htmls"]
        };
        let options = setting.options;
        if (options) {
            for (let k in options) {
                opt[k] = options[k];
            }
        }
        connectAndDo(projectName, 'buildApp', [opt]);
    }
}

function rebuildResPath(clearVer = true, showFileSolveLog = false) {
    connectAndDo(projectName, 'rebuildResPath', [{ project: projectName, showFileSolveLog, clearVer }]);
}

function createAllBySettings() {
    for (let lan in settings) {
        createLanArea(lan);
    }
}

function reset() {
    connectAndDo("$", "reset", [projectName]);
}

function addBtnToArea(lan: string, label: string, handler: Function) {
    let area = $g("lan-" + lan);
    if (area) {
        createBtn(label, handler, area);
    }
}

function createBtn(label: string, handler: Function, area: HTMLElement) {
    let input = $c("input");
    input.style.marginRight = "30px";
    input.type = "button";
    input.value = label;
    input.onclick = handler;
    if (area) {
        area.appendChild(input);
    }
    return input;
}

window.onload = function () {
    if (typeof initView == "function") {
        initView();
    }
    let header = $g("header");
    let log = $g("log");
    log.style.paddingTop = header.offsetHeight + "px";
    connect(projectName);
    //创建dialog
    dialog = $c("dialog");
}