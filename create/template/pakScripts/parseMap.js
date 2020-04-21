const cp = require("child_process");
let argv = process.argv;
let version = argv[2] || "";
if (version) {
    version += "/"
}
const project = "@name@";
const lan = "cn";
const defaultLan = "cn";
const baseDir = "/data/projects";
const scriptsRoot = `${baseDir}/h5build/scripts`;
const pakDataPath = `${scriptsRoot}/PakData.js`;
const parseMapPath = `${scriptsRoot}/ParseMap`;
const ParseMap = require(parseMapPath);
const webPath = `${baseDir}/${project}/www`;
const cfgDir = `${webPath}/cfgs/${lan}/raw/client/`;
const mapPath = `${webPath}/res/${defaultLan}/m`;

const javaPath = `${webPath}/cfgs/${lan}/output/${version}server/maplist.dat`;
ParseMap.parseMap(cfgDir, mapPath, javaPath);
cp.fork(pakDataPath, [JSON.stringify({ project, version })]);