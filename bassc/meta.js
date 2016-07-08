"use strict";
define(['bassc/core'], function(BC) {

var bcMeta = {}
var bcProcCount = 0;

function bcFillParams(res, ps) {
	var params = [];
	var opts = {};
	var i = 0;
	for (let p of (ps || [])) {
		let n = p.n;
		if (n) opts[n] = p.v;
		else {
			if ($.isArray(p.v)) {
				params.push.apply(params, p.v);
			} else params.push(p.v);
		}
	}
	res.params = params;
	res.opts = opts;
	return res;
}


class Meta {
	constructor(name) {
		bcMeta[name] = this;
		this.name = name;
	}
	setOpt(name, val) {
		if (val === undefined) val = true;
		this[name] = val;
		return this;
	}
	getBase() {
		return 'BC.Unit';
	}
	compileToSource() {
		var res = [`class ${this.name} extends ${this.getBase()} {`];
		res.push('\tconstructor(parent, params) {');
		res.push('\t\tsuper(...arguments);');
		res.push('\t\tthis.init(...arguments);');
		// this.compileCons(res);
		res.push('\t}');
		res.push('\tinit(params) {');
		this.compileCons(res);
		res.push('\t}');

		res.push('\tgetHTML(styles) {');
		this.compileGetHTML(res);
		res.push('\t}');

		res.push('\tonStartUI() {');
		this.compileOnStartUI(res);
		res.push('\t}');
		
		this.compileAdditional(res);

		res.push('}');
		//res.push(`BC.${this.name} = ${this.name};`)
		return res.join('\n');
	}
	compile() {
		var src = this.compileToSource();
		var cc = BC[this.name];
		if (!cc) cc = eval(src);
		this.cc = cc;
		BC[this.name] = cc;
		cc.meta = this;
	}
	compileCons(res) {
		return;
	}
	compileGetHTML(res) {
		return;
	}
	compileOnStartUI(res) {
		return;
	}
	compileAdditional(res) {
		return;
	}
}

class MetaUnit extends Meta {
	constructor(name) {
		super(name);
		this.links = {};
		this.uses = {};
		this.nodes = {};
		this.initList = [];
		this.inpList = [];
		this.outList = [];
		this.outByType = {P: [], A: [], MIDI: []};
		this.layouts = [];
		this.melodies = [];
		this.uiStyles = {};
	}
	compileCons(res) {
		if (this.initList.length > 0) {
			res.push('\t\tvar [' + this.initList.map(nn => `a_${nn}`).join(', ') + '] = params;');
		}
		for (var nn in this.nodes) {
			var node = this.nodes[nn];
			var ps = node.params || [];
			if (node.opts.global) {
				res.push(`\t\tthis.${nn} = _nodes.${nn};`);
			}
			else if (node.opts.init) {
				res.push(`\t\tthis.${nn} = (typeof a_${nn} === 'undefined') ? new BC.${node.type.name}(this, [${ps.join(', ')}]) : a_${nn};`);
			}
			else {
				res.push(`\t\tthis.${nn} = new _cls.${node.type.name}(this, [${ps.join(', ')}]);`);
				if (node.name && !node.name.match(/^_/)) {
					res.push(`\t\tthis.${nn}.name = '${node.name}';`);
				}
				if (node.title) {
					res.push(`\t\tthis.${nn}.title = "${node.title}";`);
				}
			}
		}
		for (var ln in this.links) {
			var li = this.links[ln];
			res.push(`\t\tthis.${li.n0}.${li.p0}.connectTo(this.${li.n1}.${li.p1});`);
		}
	}
	compileGetHTML(res) {
		res.push(`\t\tvar html = [];`);
		res.push('\t\thtml.push(`<div class="UI ${this.id} ${this.constructor.name} ${styles}" id="${this.getUIId()}" data-title="${this.title || this.name || this.id}">`);');
		res.push(`\t\tvar s;`);
		var self = this;
		function compileLayout(ly, isVert) {
			var lyId = BC._getObjId(ly);
			var ss = (self.uiStyles[lyId] || []).join(' ');
			res.push(`\t\thtml.push('<div class="layout${isVert ? 'V' : 'H'} ${ss}">');`)
			for (var ln of ly) {
				if ($.isArray(ln)) {
					compileLayout(ln, !isVert);
				} else {
					res.push(`\t\tif (s = this.${ln}.getHTML('${(self.uiStyles[ln] || []).join(' ')}')) html.push(s);`);
				}
			}
			res.push(`\t\thtml.push('</div>');`)
		}
		for (var ly of this.layouts) {
			res.push(`\t\thtml.push('<div class="layoutV">');`)
			compileLayout(ly);
			res.push(`\t\thtml.push('</div>');`)
		}
		res.push(`\t\thtml.push('</div>');`)
		res.push(`\t\treturn html.join('');`);
	}
	compileOnStartUI(res) {
		function compileLayout(ly, isVert) {
			for (var ln of ly) {
				if ($.isArray(ln)) {
					compileLayout(ln, !isVert);
				} else {
					res.push(`\t\tthis.${ln}.onStartUI();`);
				}
			}
		}
		for (var ly of this.layouts) {
			compileLayout(ly);
		}
	}
	fixId(tp, id, onError) {
		var type = tp.type;
		var opts = tp.opts || {};
		if (opts.global) {
			var mn = BC.meta.main.nodes[id];
			if (!mn) {
				return onError(`Global id not found: ${id}`);
			}
		}
		var tn = type.name;
		var ci = this.uses[tn] || 0;
		if (!id) id = '_' + tn + '_' + (++ci);
		if (id.toString().match(/^_\d+$/)) {
			++ci;
			id = '_' + tn + id + '_' + ci;
		}
		this.uses[tn] = ci;
		return id;
	}
	addNode(tp, id, title) {
		var type = tp.type;
		var params = tp.params;
		var opts = tp.opts || {};
		if (opts.global) {
			var mn = BC.meta.main.nodes[id];
			if (mn) {
				type = mn.type;
				params = mn.params;
			}
		}
		var node = {
			type, id, title, params, opts, name: id
		}
		this.nodes[id] = node;
		if (type.inpType) this.addInp(node);
		if (type.outType) this.addOut(node);
		if (opts.init) {
			this.initList.push(node.id);
		}
		return id;
	}
	addInp(inp) {
		inp.inpIdx = this.inpList.push(inp.id) - 1;
		inp.inpType = inp.type.inpType;
	}
	addOut(out) {
		out.outIdx = this.outList.push(out.id) - 1;
		out.outType = out.type.outType;
		this.outByType[out.outType].push(out.id);
	}
	getDefOutId(type) {
		return (this.outByType[type || 'P'] || [])[0];
	}
	addLayout(l) {
		this.layouts.push(l);
	}
	addMelody(m) {
		this.melodies.push(m);
	}
	getPlant() {
		var res = ['@startuml'];
		var links = [];
		var used = {};
		for (var ln in this.links) {
			var li = this.links[ln];
			//res.push(`${li.n0} "${li.e0}" --> "${li.e1}" ${li.n1}`);
			var from = `${li.n0}.${li.e0}`;
			var to = `${li.n1}.${li.e1}`;
			// used[from] = 1;
			// used[to] = 1;
			if (li.e0 == this.nodes[li.n0].type.outList[0]) from = '[' + li.n0 + ']';
			else {
				used[from] = 1;
				from = `(${from})`;
			}
			if (li.e1 == this.nodes[li.n1].type.inpList[0]) to = '[' + li.n1 + ']';
			else {
				used[to] = 1;
				to = `(${to})`;
			}
			res.push(`${from} ---> ${to}`);
		}
		for (let nn in this.nodes) {
			var n = this.nodes[nn];
			var nc = n.type;
			var label = n.title;
			if (!label) {
				if (n.type == 'Const') {
					label = n.params.join(', ');
				} else {
					label = n.type;
					if (n.params && n.params.length) {
						label += '(' + n.params.join(', ') + ')';
					}
				}
				if (n.name) label += ' ' + n.name;
				if (n.inpType) label += ' <<' + n.inpType + '>>';
				if (n.outType) label += ' <<' + n.outType + '>>';
			}
			res.push(`[${label}] as ${nn}`);
			let e0 = nc.inpList[0];
			for (let e of nc.inpList) {
				//if (e == e0) continue;
				if (!used[`${nn}.${e}`]) continue;
				res.push(`(${e}) as (${nn}.${e})`);
				res.push(`(${nn}.${e}) --* ${nn}`)
			}
			e0 = nc.outList[0];
			for (let e of nc.outList) {
				//if (e == e0) continue;
				if (!used[`${nn}.${e}`]) continue;
				res.push(`(${e}) as (${nn}.${e})`);
				res.push(`${nn} --* (${nn}.${e})`)
			}
			// res.push(`}`);
		}
		return res.join('\n');
	}
	getDot() {
		function dotName(nn) {
			return 'n_' + nn.replace('$', '__');
		}
		
		var res = [`digraph ${this.name} {`, 'node [width=0.1,height=0.1];', 'rankdir=LR;', 'size="10,10"'];
		for (let nn in this.nodes) {
			var n = this.nodes[nn];
			var nc = n.type;
			var label = n.title;
			if (!label) {
				if (n.type.name == 'Const') {
					label = n.params.join(', ');
				}
				else if (n.type.name == 'Gain') {
					label = '*' + n.params.join(', ');
				} else {
					var t = n.type.name;
					label = n.type.typeLabel || t;
					if (n.params && n.params.length) {
						label += '(' + n.params.join(', ') + ')';
					}
				}
				if (n.name && !n.name.match(/^_/)) label += ' ' + n.name;
				// if (n.inpType) label += ' <<' + n.inpType + '>>';
				// if (n.outType) label += ' <<' + n.outType + '>>';
			}
			var s = '{{';
			s += nc.inpList.map(e => `<${dotName(e)}> ${e}`).join('|');
			s += '}|' + label + '|{';
			s += nc.outList.map(e => `<${dotName(e)}> ${e}`).join('|');
			s += '}}';
			res.push(`${dotName(nn)}[id="${nn}",shape=record,label="${s}"];`);
		}
		res.push('{ rank = source; ');
		res.push(this.inpList.map(e => dotName(e)).join(';'));
		res.push('};');
		res.push('{ rank = sink; ');
		res.push(this.outList.map(e => dotName(e)).join(';'));
		res.push('};');
		for (var ln in this.links) {
			var li = this.links[ln];
			res.push(`${dotName(li.n0)}:${dotName(li.p0)} -> ${dotName(li.n1)}:${dotName(li.p1)};`);
		}
		res.push('}');
		return res.join('\n');
	}
}

class MetaProc extends MetaUnit {
	constructor(proc) {
		var name = `Proc_${++bcProcCount}`;
		super(name);
		this.typeLabel = '\\{' + (proc.body || '') + '\\}';
		this.proc = proc;
		var i = 0;
		for (var p of proc.params) {
			if (!p.name) p.name = '$' + ++i;
			this.addNode({type: bcMeta.PIN}, p.name);
		}
		if (proc.init) {
			for (var nn of proc.init) {
				this.addNode({type: bcMeta.PIN}, nn);
			}
		}
		if (proc.outs) {
			for (var out of proc.outs) {
				this.addNode({type: bcMeta.POUT}, out);
			}
		} else {
			this.addNode({type: bcMeta.POUT}, 'out');
		}
	}
	getBase() {
		return 'BC.Proc';
	}
	compileCons(res) {
		var proc = this.proc;
		var body = proc.body || '';
		if (body.match(/return/)) body = `{ ${body} }`;
		for (var n of Object.getOwnPropertyNames(Math)) {
			if (body.indexOf(n) < 0) continue;
			res.push(`\t\tvar ${n} = Math.${n};`);
		}
		var initList = proc.init || [];
		res.push(`\t\tthis._procAgr = {};`);
		var pars = initList.map((nn, i) => {
			res.push(`\t\tthis.${nn} = new BC.PIN(this, [params[${i}]]);`);
			return nn;
		});
		for (var p of proc.params) {
			var agr = p.agr || '+';
			var af = {
				'+': ['a + b', 0],
				'*': ['a * b', 1],
				'_': ['Math.min(a, b)', 100000],
				'^': ['Math.max(a, b)', -100000],
				// '<': ['a === "0" ? b : a', "0"],
				'$': ['b', 0],
			}[agr];
			var def = p.def || af[1];
			res.push(`\t\tthis.${p.name} = new BC.PIN(this, [${def}], (a, b) => ${af[0]}, ${af[1]});`);
			res.push(`\t\tthis._procAgr.${p.name} = [(a, b) => ${af[0]}, ${af[1]}, ${def}];`);
			pars.push(p.name);
		}
		if (!body) body = pars.join(' + ');
		res.push(`\t\tthis._procFunc = ({${pars.join(', ')}}) => ${body};`);
		res.push(`\t\tthis._procParams = [${pars.map(p => `'${p}'`).join(', ')}];`);

		res.push(`\t\tthis._pinStream = Kefir.zip([${pars.map(p => `this.${p}.stream`).join(', ')}], (${pars.join(', ')}) => { return {${pars.join(', ')}}});`);
		res.push(`\t\tvar stream = this._pinStream.map(args => {
				var _res = this._procFunc(args);
				return $.isArray(_res) ? _res : [_res];
			});`)
		for (var i = 0; i < this.outByType.P.length; i++) {
			var out = this.outByType.P[i];
			res.push(`\t\tthis.${out} = new BC.POUT(this, []);`)
			res.push(`\t\tthis.${out}.plugStream(stream.map(v => v[${i}] || 0));`);
		}
	}
}

const mainName = 'Main';

class MainMeta extends MetaUnit {
	constructor() {
		super(mainName);
	}
}

class MetaModule extends MetaUnit {
	constructor(name) {
		super(name);
		this.includes = [];
		this.units = {};
	}
	unitByName(name) {
		return this.units[name];
	}
	newUnit(name) {
		var u = newUnit(name);
		this.addUnit(u);
		return u;
	}
	addUnit(u) {
		this.units[u.name] = u;
	}
	compileToSource() {
		var incs = ['bassc/core', 'bassc/meta'].concat(this.includes.map(i => `load/bc!bc/${i.name}`));
		
		var res = [`define(['${incs.join("','")}'], function(BC, meta) {`];
		res.push('var _cls = {};');
		
		for (var name in this.units) {
			var u = this.unitByName(name);
			var us = u.compileToSource();
			res.push('_cls.' + name + '=' + us);
		}
		
		
		res.push('return class {');
		res.push('\tconstructor(parent, params) {');
		res.push('\t\tsuper(...arguments);');
		res.push('\t\tthis.init(...arguments);');
		// this.compileCons(res);
		res.push('\t}');
		res.push('\tinit(params) {');
		this.compileCons(res);
		res.push('\t}');

		res.push('\tgetHTML(styles) {');
		this.compileGetHTML(res);
		res.push('\t}');

		res.push('\tonStartUI() {');
		this.compileOnStartUI(res);
		res.push('\t}');
		
		this.compileAdditional(res);

		res.push('};');
		
		res.push('})');
		//res.push(`BC.${this.name} = ${this.name};`)
		return res.join('\n');
	}
}

class MetaError extends Meta {
	constructor(error) {
		super();
		this.error = error;
	}
}

var newUnit = function newCls(name) {
	return new MetaUnit(name);
};

var newProc = function newProc(proc) {
	return new MetaProc(proc);
};

var newModule = function newModule(name) {
	return new MetaModule(name);
};

(function (types){
	for (let t of types) {
		newUnit(t + 'IN').setOpt('inpType', t);
		newUnit(t + 'OUT').setOpt('outType', t);
	}
	for (let t of types) {
		bcMeta[t + 'IN'].addNode({type: bcMeta[t + 'IN']}, 'inp');
		bcMeta[t + 'IN'].addNode({type: bcMeta[t + 'OUT']}, 'out');
		bcMeta[t + 'OUT'].addNode({type: bcMeta[t + 'IN']}, 'inp');
		bcMeta[t + 'OUT'].addNode({type: bcMeta[t + 'OUT']}, 'out');
	}
})(['A', 'P', 'MIDI']);

const mainMeta = new MainMeta();

class MetaError {
	constructor(message, location) {
		this.message = message;
		this.location = location;
	}
}

function error(message, location) {
	throw new MetaError(message, location);
}

return BC.meta = {
	Meta,
	MetaUnit,
	MetaProc,
	MetaError,

	mainName,
	main: mainMeta,
	data: bcMeta,

	newUnit,
	newProc,
	newModule,
	error,
	
	byName(name) {
		return this.data[name];
	},
	getMain() {
		return this.byName(mainName);
	},
	compileAll() {
		for (var c in bcMeta) {
			var cls = bcMeta[c];
			var cc = cls.compile();
		}
	},
};

});
