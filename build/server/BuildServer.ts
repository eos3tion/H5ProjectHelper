import * as ws from "ws";
import * as repl from "repl";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";

interface WebSocket extends ws {
    /**
     * 客户端标识
     * 
     * @type {number}
     * @memberof WebSocket
     */
    id: number;
    /**
     * 客户端ip
     * 
     * @type {string}
     * @memberof WebSocket
     */
    ip: string | string[];
    /**
     * 项目名称
     * 
     * @type {string}
     * @memberof WebSocket
     */
    project: string;
}

/****************************************扩展Date****************************************/
/**
 * 对数字进行补0操作
 * @param value 要补0的数值
 * @param length 要补的总长度
 * @return 补0之后的字符串
 */
function zeroize(value: number | string, length = 2): string {
    let str = "" + value;
    let zeros = "";
    for (let i = 0, len = length - str.length; i < len; i++) {
        zeros += "0";
    }
    return zeros + str;
}

Date.prototype.format = function (mask, local?: boolean) {
    let d: Date = this;
    return mask.replace(/"[^"]*"|'[^']*'|(?:d{1,2}|m{1,2}|yy(?:yy)?|([hHMs])\1?)/g, function ($0): any {
        switch ($0) {
            case "d": return gd();
            case "dd": return zeroize(gd());
            case "M": return gM() + 1;
            case "MM": return zeroize(gM() + 1);
            case "yy": return (gy() + "").substr(2);
            case "yyyy": return gy();
            case "h": return gH() % 12 || 12;
            case "hh": return zeroize(gH() % 12 || 12);
            case "H": return gH();
            case "HH": return zeroize(gH());
            case "m": return gm();
            case "mm": return zeroize(gm());
            case "s": return gs();
            case "ss": return zeroize(gs());
            default: return $0.substr(1, $0.length - 2);
        }
    });
    function gd() { return local ? d.getDate() : d.getUTCDate() }
    function gM() { return local ? d.getMonth() : d.getUTCMonth() }
    function gy() { return local ? d.getFullYear() : d.getUTCFullYear() }
    function gH() { return local ? d.getHours() : d.getUTCHours() }
    function gm() { return local ? d.getMinutes() : d.getUTCMinutes() }
    function gs() { return local ? d.getSeconds() : d.getUTCSeconds() }
}


const enum Constant {
    /**
     * 默认端口号
     */
    DefaultPort = 3721,

    /**
     * 每个项目，最大保存的输出数
     */
    MaxOutputsPerProjects = 2,
    /**
     * 最多历史项目
     */
    MaxHistory = 20,

    /**
     * 全局项目名称
     */
    GodProjectName = "$",

    /**
     * 子项目主文件，文件名
     */
    Main = "build.js",
    /**
     * 历史数据的分隔符
     */
    HistorySplitor = "\n================================================================================\n",
}


const enum ReplCmdType {
    /**
     * 显示所有客户端
     */
    Status = "status",

    /**
     * 列出所有项目名称
     */
    ListProjects = "listProjects",

    /**
     * 显示说明
     */
    Help = "help",

    /**
     * 退出
     */
    Exit = "exit",

    /**
     * 重新加载指定项目
     */
    Reset = "reset",
    /**
     * 存储一个项目的执行历史数据
     */
    History = "history",
}

interface Cmd {

    help?: string;

    execute(...args): string | void;
}
const cmds: { [index: string]: Cmd } = {
    [ReplCmdType.Help]: {
        execute(type: ReplCmdType) {
            let tip = "";
            let cmd = cmds[type];
            if (cmd) {
                tip = cmd.help;
            } else {
                tip = this.help;
            }
            return tip;
        }
    },
    [ReplCmdType.Exit]: {
        help: "退出服务",
        execute() {
            process.exit();
        }
    },
    [ReplCmdType.Reset]: {
        help: "重置指定项目，当项目脚本发生改变，使用此指令进行重置，示例：\nreset chuanqi2",
        execute: resetProject
    },
    [ReplCmdType.ListProjects]: {
        help: "列出当前运行的项目",
        execute() {
            for (let projectName in projects) {
                let project = projects[projectName];
                console.log(project);
            }
        }
    },
    [ReplCmdType.Status]: {
        help: "列出所有连接的客户端",
        execute() {
            if (wss) {
                let clients = wss.clients;
                console.log(`当前连接客户端：${clients.size}个`);
                clients.forEach((client: WebSocket) => {
                    console.log(client.ip, client.project);
                });
            }
        }
    },
    [ReplCmdType.History]: {
        help: "打印并存储历史数据",
        execute(projectName: string, path: string) {
            let project = projects[projectName];
            if (project) {
                let content = project.history.join(Constant.HistorySplitor);
                console.log(content);
                if (path) {
                    try {
                        fs.writeFileSync(path, content);
                    } catch (e) {
                        console.log(`无法将历史数据写入[${path}]:`, e.message);
                    }
                }

            } else {
                console.log(`没有找到指定的项目[${projectName}]`);
            }

        }
    }
}

/**
 * 重置项目
 * @param projectName 项目名称
 */
function resetProject(projectName: string) {
    let project = projects[projectName];
    if (project) {
        project.shutdownProcess();
    } else {
        console.log(`没有找到指定的项目[${projectName}]`);
    }
}

function send(client: WebSocket, message: String | Message) {
    if (typeof message === "string") {
        message = { type: MessageType.Message, data: message };
    }
    client.send(JSON.stringify(message));
}

/**
 * 项目
 * 
 * @interface Project
 */
class Project {
    modulePath: string;
    tryExecute(client: WebSocket, rpc: RPC) {
        if (this.currentRPC) {
            send(client, `正在执行指令，请稍后执行!!!\n`)
            return;
        }
        if (rpc) {
            let process = this.process;
            this.currentRPC = rpc;
            this.outputs = "";
            let { func, params } = rpc;
            process.send({
                func,
                params
            });
            this.broadcast(`${this.getPrefix()}尝试执行：${func},参数:${JSON.stringify(params)}`)
        }
    }
    add(client: WebSocket) {
        let cid = client.id;
        client.project = this.name;
        let clientIDs = this.clientIDs;
        if (!clientIDs.has(cid)) {//还没加入到项目中
            console.log(`${client.ip} connect to project "${this.name}"`);
            clientIDs.add(cid);
            let output = this.outputs + "\n" + this.history.slice(-Constant.MaxOutputsPerProjects).join(Constant.HistorySplitor);
            if (output) {
                send(client, output + "\n");
            }
        }
    }
    /**
     * 项目名称
     * 
     * @type {string}
     * @memberof Project
     */
    name: string;

    /**
     * 当前发来的指令
     * 
     * @type {RPC}
     * @memberof Project
     */
    currentRPC?: RPC;

    /**
     * 当前输出
     * 
     * @type {string}
     * @memberof Project
     */
    outputs = "";
    /**
     * 历史数据
     * 
     * @type {string[]}
     */
    history: string[] = [];

    process?: cp.ChildProcess;

    clientIDs = new Set<number>()



    dispose(message?: string) {
        this.history.length = 0;
        this.broadcast(`${this.getPrefix()}${message || "销毁"}\n`);
        this.clientIDs.clear();
    }

    getPrefix() {
        return `${new Date().format("yyyy-MM-dd HH:mm:ss")},【${this.name}】`;
    }

    broadcast(message: Message | string) {
        console.log(message);
        if (typeof message === "string") {
            message = { type: MessageType.Message, data: message };
        }
        if (wss) {
            let clientIDs = this.clientIDs;
            const data = JSON.stringify(message);
            wss.clients.forEach((client: WebSocket) => {
                if (clientIDs.has(client.id)) {
                    client.send(data);
                }
            });
        }
    }

    checkProcess(projectsRoot: string) {
        let subProcess = this.process;
        if (!subProcess || !subProcess.connected) {
            let modulePath = path.join(projectsRoot, this.name, Constant.Main);
            this.modulePath = modulePath;
            //检查是否有模块文件
            if (!fs.existsSync(modulePath)) {
                return `无法找到项目对应模块，${modulePath}`;
            }
            try {
                subProcess = cp.fork(modulePath, null, { silent: true });
            } catch (e) {
                return `创建项目模块出错，${modulePath}`;
            }
            console.log(`成功创建项目模块，${modulePath}`)
            this.process = subProcess;
            subProcess.on("error", this.childProcessError);
            // let rl1
            let { stderr, stdout } = subProcess;
            stderr.on("data", this.onStdOut)
            stdout.on("data", this.onStdOut);
            subProcess.on("message", msg => {
                let type: string;
                if (typeof msg === "string") {
                    type = msg;
                } else {
                    ({ type } = msg);
                }
                switch (type) {
                    case MessageType.Done:
                    case MessageType.Error:
                        const history = this.history;
                        history.push(this.outputs);
                        if (history.length > Constant.MaxHistory) {
                            history.shift();
                        }
                        this.outputs = "";//清空数据
                        this.currentRPC = null;
                        break;
                    case MessageType.DialogShow:
                    case MessageType.DialogHide:
                        this.broadcast(msg);//直接广播
                        break;
                }
            })
        }
    }

    /**
     * 重新加载子进程
     * 
     */
    shutdownProcess() {
        let subProcess = this.process;
        if (subProcess) {
            if (subProcess.connected) {
                subProcess.kill();
            }
            this.process = null;
        }
        this.currentRPC = null;
    }

    onStdOut = (chunk: Buffer | string) => {
        if (Buffer.isBuffer(chunk)) {
            chunk = chunk.toString("utf8");
        }
        this.outputs += chunk;
        this.broadcast(chunk);
    }

    /**
     * 
     * 子进程发生错误
     */
    childProcessError = (err: Error) => {
        this.broadcast(`${this.getPrefix()}发生错误\nError:${err.message}\nstack:${err.stack}`);
        this.currentRPC = null;
    }

    toString() {
        return this.name + `\t` + this.modulePath;
    }
}

/**
 * 客户端发送过来的指令
 * 
 * @interface RPC
 */
interface RPC {
    /**
     * 项目名称
     * 
     * @type {string}
     * @memberof RPC
     */
    project: string;

    /**
     * 要执行的函数名称
     * 
     * @type {string}
     * @memberof RPC
     */
    func: string;

    /**
     * 参数列表
     * 
     * @type {any[]}
     * @memberof RPC
     */
    params?: any[];

    /**
     * 当前发送指令的客户端IP
     * 
     * @type {string}
     * @memberof RPC
     */
    clientIp: string;
}



let wss: ws.Server;

/**
 * 客户端标识的自增值
 */
let clientIDSeed = 1;

/**
 * 项目集
 */
const projects: { [index: string]: Project } = {};



const godHandler: { [index: string]: { (client: WebSocket, ...args): void } } = {
    /**
     * 连接指定项目
     * 
     * @param {string} projectName 
     */
    connect: addClientToProject,

    /**
     * 重置项目
     * @param _ 
     * @param projectName 
     */
    reset: function (_: WebSocket, projectName: string) {
        resetProject(projectName);
    }
}

function onEnter(expression: string) {
    let args = expression.split(/\s/);
    let type = args.shift();
    let cmd = cmds[type];
    if (cmd) {
        try {
            let tip = cmd.execute.apply(null, args);
            if (tip) {
                console.log(tip);
            }
        } catch (e) {
            let help = cmd.help;
            if (help) {
                console.log(`执行指令出错，请查看帮助：\n${help}`);
            }
        }
    }
}

function onTab(expression: string, callback) {
    let keys = Object.keys(cmds)
    const hits = keys.filter((c) => c.startsWith(expression));
    callback(null, [hits.length ? hits : keys, expression]);
}

/**
 * 
 * 
 * @param {number} [port=Constant.DefaultPort] 服务器监听端口号
 * @param {string} [projectsRoot] 项目根目录，默认为当前目录
 */
function start(port: number = Constant.DefaultPort, projectsRoot?: string) {
    projectsRoot = projectsRoot || __dirname;
    let opt = {} as ws.ServerOptions;
    opt.port = port;
    //建立WebSocket服务
    wss = new ws.Server(opt);
    //建立控制台服务
    repl.start({
        prompt: `buildServer>`,
        eval: onEnter,
        completer: onTab,
    });
    wss.on("connection", (client: WebSocket, req) => {
        let headers = req.headers;
        let rawIp = headers["x-forwarded-for"];
        if (!rawIp) {//有此数据一定是由代理服务器代理的结果
            let connection = req.connection;
            rawIp = connection.remoteAddress;
        }
        client.ip = rawIp;
        client.id = clientIDSeed++;
        console.log(`${rawIp}连接成功，分配id${client.id}`);
        client.on("close", (_code, _message) => {
            //处理发送的指令
            let { project, id } = client;
            let p = projects[project];
            if (p) {
                p.clientIDs.delete(id);
            }
            console.log(`id为${id}的客户端断开连接`);
        });
        client.on("message", (message: string) => {
            console.log(`接受到[${client.ip}]消息:\n${message}`);
            let rpc: RPC;
            try {
                rpc = JSON.parse(message);
            } catch (e) {
                return send(client, "执行指令发生错误!!")
            }
            let projectName = rpc.project;
            if (projectName == Constant.GodProjectName) {
                let handler = godHandler[rpc.func];
                if (handler) {
                    handler(client, ...rpc.params);
                }
            } else {

                //检查是否有子项目
                let project = addClientToProject(client, projectName);
                let error = project.checkProcess(projectsRoot);
                if (error) {
                    console.log(error);
                    project.dispose(error);
                    delete projects[projectName];
                    return;
                }
                project.tryExecute(client, rpc);
            }
        });
    })
}

function getProject(projectName: string) {
    let project = projects[projectName];
    if (!project) {
        project = new Project();
        project.name = projectName;
        projects[projectName] = project;
    }
    return project;
}

function addClientToProject(client: WebSocket, projectName: string) {
    let project = getProject(projectName);
    project.add(client);
    return project;
}

let argv = process.argv;
let port = +argv[2] || undefined;
let projectsRoot = argv[3];


start(port, projectsRoot);