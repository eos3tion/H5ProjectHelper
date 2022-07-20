const PORT = 1212;
const http = require("http");
const url = require("url");
const cp = require("child_process");
http.createServer((req,res)=>{
    let u = decodeURIComponent(req.url);
	let location = url.parse(u);
	let script = location.pathname.substring(1);
	let paramstr = location.query;
	console.log(location,script,paramstr)
	let param = paramstr?paramstr.split("|"):undefined;
	res.write(`开始执行脚本${script}`);
	if(param){
		res.write(param.join(`<br/>`));
	}
	res.flushHeaders();
	let child;
	try{
		child=param?cp.fork(script,param,{silent:true}):cp.fork(script,{silent:true});
	}catch(err){
		child.stdout.unpipe(res);
		res.write(err.message);
		res.end();
		return;
	}
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stdout.pipe(res);
	child.stderr.pipe(res);
}).listen(PORT)
