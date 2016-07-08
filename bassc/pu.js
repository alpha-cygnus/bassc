"use strict";
// Bass C Parsing Utils
define(['bassc/core', 'bassc/meta'], function(BC, meta) {
	
	var BCPU = {
		location: () => '?', // stub, to be filled by parser
		error: () => '!', // stub, to be filled by parser
	}

	function noteToInt(n) {
		var m;
		var n2i = {C: 0, D: 2, E: 4, F: 5, G: 7, H: 9, A: 9, B: 11};
		var a2i = {'#': 1, 'b': -1, '-': 0};
		if (m = n.match(/([A-H])([b#-])?([0-9])?/)) {
			var i = n2i[m[1]];
			i += a2i[m[2] || '-'];
			i += 12*(m[3] || '5');
		}
		return i;
	}
	function makeRange(a, b) {
		var res = [a];
		if (b === null) b = a;
		if (b < a) return res;
		for (var i = a + 1; i <= b; i++) res.push(i);
		return res;
	}
	var _abcState = {};
	
	class SyntaxElem {
		constructor() {
			this.location = BCPU.location();
		}
		toMeta() {}
		error(msg) {
			console.error(msg, this.location);
			debugger;
			meta.error(msg, this.location);
		}
	}
	class Unit extends SyntaxElem {
		constructor(name, items, init) {
			super();
			this.init = init;
			this.name = name;
			this.items = items;
		}
		toMeta(_m) {
			var _cc = _m.unitByName(this.name);
			if (_cc) this.error(`${this.name} is already defined`);
			_cc = _m.newUnit(this.name);
			if (this.init) this.init.toMeta(_cc);
			for (var item of this.items) {
				item.toMeta(_cc);
			}
		}
	}
	class UnitInit extends SyntaxElem {
		constructor(items) {
			super();
			this.items = items;
		}
		toMeta(_cc) {
			for (var item of this.items) {
				item.toMeta(_cc);
			}
		}
	}
	class UnitInitItem extends SyntaxElem {
		constructor(ids, cons) {
			super();
			this.ids = ids;
			this.cons = cons;
		}
		toMeta(_cc) {
			var _ct = this.cons.toMeta(_cc);
			_ct.opts = { init: 1 };
			var ids;
			ids = this.ids.map(id => _cc.fixId(_ct, id, (msg) => this.error(msg)));
			for (var id of ids) {
				if (_cc.nodes[id]) this.error(id + " is already defined");
				_cc.addNode(_ct, id);
			}
			//return {ids, _ct};
		}
	}

	class EnumDef extends SyntaxElem {
		constructor(vals) {
			super();
			this.values = vals;
		}
		toMeta(_cc) {
			var cv = 0;
			_cc.values = {}
			for (var ev of this.values) {
				if (ev.val !== null) cv = ev.val;
				_cc.values[ev.name] = cv++;
			}
		}
	}
	class EnumValDef extends SyntaxElem {
		constructor(name, val) {
			super();
			this.name = name;
			this.val = val;
		}
	}
	class Layout extends SyntaxElem {
		constructor(items) {
			super();
			this.items = items;
		}
		toMeta(_cc) {
			return _cc.addLayout(this.items.map(i => i.toMeta(_cc)).reduce((a, b) => a.concat(b), []));
		}
	}
	class LayoutSub extends SyntaxElem {
		constructor(items, ss) {
			super();
			this.items = items;
			this.styles = ss;
		}
		toMeta(_cc, accum) {
			var res = [this.items.map(i => i.toMeta(_cc)).reduce((a, b) => a.concat(b), [])];
			_cc.uiStyles[BC._getObjId(res)] = this.styles;
			return res;
		}
	}
	class LayoutDecl extends SyntaxElem {
		constructor(decl, ss) {
			super();
			this.decl = decl;
			this.styles = ss;
		}
		toMeta(_cc) {
			var ids = this.decl.toMeta(_cc, {}).ids;
			for (var id of ids) {
				_cc.uiStyles[id] = this.styles;
			}
			return ids;
		}
	}
	class Include extends SyntaxElem {
		constructor(name, type) {
			super();
			this.name = name;
			this.type = type || 'bc';
		}
		toMeta(_m) {
			//processSource(this.name);
			_m.addInclude(name);
		}
	}
	class Chain extends SyntaxElem {
		constructor(head, links) {
			super();
			this.head = head;
			this.links = links;
		}
		toMeta(_cc) {
			var io = this.head.toMeta(_cc);
			for (var lnk of this.links) {
				io = lnk.toMeta(_cc, io);
			}
			return io;
		}
	}
	class ChainLink extends SyntaxElem {
		constructor(arrow, point) {
			super();
			this.arrow = arrow;
			this.point = point;
		}
		toMeta(_cc, io0) {
			var io1 = this.point.toMeta(_cc);
			this.arrow.toMeta(_cc, io0.outs, io1.inps);
			return {inps: io0.inps, outs: io1.outs};
		}
	}
	class ChainArrow extends SyntaxElem {
		constructor(par) {
			super();
			this.par = par;
		}
		toMeta(_cc, outs, inps) {
			var linkOutInp = (out, inp) => {
				let [n1, p1] = inp.split('.');
				let c1 = _cc.nodes[n1].type;
				if (!c1) debugger;
				if (p1.match(/^\d+$/)) p1 = c1.inpList[p1];
				let t1 = c1.nodes[p1] && c1.nodes[p1].inpType;
				if (!t1) debugger;
				if (!t1) this.error(`Input ${a1[1]} is not defined for ${n1}:${c1.name} in ${_cc.name}`);

				let [n0, p0] = out.split('.');
				let c0 = _cc.nodes[n0].type;
				if (!c0) debugger;
				if (p0 === '0') {
					p0 = c0.getDefOutId(t1);
				}
				else if (p0.match(/^\d+$/)) {
					p0 = c0.outList[p0];
				}
				let t0 = c0.nodes[p0] && c0.nodes[p0].outType;
				if (!t0) debugger;
				if (!t0) this.error(`Output ${a0[1]} is not defined for ${n0}:${c0.name} in ${_cc.name}`);
				
				if (t0 != t1) {
					this.error(`Incompatible connection for ${n0}[${p0}](${t0})->[${p1}]${n1}(${t1}) in ${_cc.name}`);
				}


				let lid = [n0, p0, p1, n1];

				_cc.links[lid.join(',')] = { n0, n1, p0, p1, t: t0 };
			}
			if (this.par) {
				var olen = outs.length;
				var ilen = inps.length;
				if (olen != ilen) this.error('Input-output list length mismatch:' + outs.toString() + ',' + JSON.stringify(inps));
				for (var i = 0; i < ilen; i++) {
					linkOutInp(outs[i], inps[i]);
				};
			} else {
				for (let out of outs) {
					for (let inp of inps) {
						linkOutInp(out, inp);
					}
				}
			}
		}
	}
	class Point extends SyntaxElem {
		constructor(items) {
			super();
			this.items = items;
		}
		toMeta(_cc) {
			var state = {};
			var inps = [];
			var outs = [];
			for (var item of this.items) {
				var next = item.toMeta(_cc, state);
				var inps = inps.concat(next.inps);
				var outs = outs.concat(next.outs);
				state = next.state || {};
			}
			return {inps, outs};
		}
	}
	class Node extends SyntaxElem {
		constructor(inps, decl, outs) {
			super();
			this.inps = inps;
			this.decl = decl;
			this.outs = outs;
		}
		toMeta(_cc, state) {
			var _ci = this.inps || state._ci || [0];
			var _co = this.outs || state._co || [0];
			var res = this.decl.toMeta(_cc, state);
			var _ct = res._ct;
			var ids = res.ids;
			var inps = [];
			var outs = [];
			if (!ids) debugger;
			for (var id of ids) {
				for (var ci of _ci) inps.push(id + '.' + ci);
				for (var co of _co) outs.push(id + '.' + co);
			}
			return {
				inps, outs,
				state: {_ci, _co, _ct},
			}
		}
	}
	class Ref extends SyntaxElem {
		constructor(ids, title) {
			super();
			this.ids = ids;
			this.title = title;
		}
		toMeta(_cc, state) {
			var _ct = state._ct;
			var title = this.title;
			var ids = this.ids;
			if (_ct) {
				ids = ids.map(id => _cc.fixId(_ct, id, (msg) => this.error(msg)));
			}
			for (var id of this.ids) {
				if (_ct) {
					if (_cc.nodes[id]) this.error(id + " is already defined");
					_cc.addNode(_ct, id, title);
				}
				if (!_cc.nodes[id]) this.error(id + " is not defined");
			}
			return {ids: this.ids, _ct};
		}
	}
	class Decl extends SyntaxElem {
		constructor(cons, ids, title) {
			super();
			this.cons = cons;
			this.ids = ids;
			this.title = title;
		}
		toMeta(_cc, state) {
			var _ct = this.cons.toMeta(_cc);
			var title = this.title;
			var ids;
			if (this.ids) {
				ids = this.ids.map(id => _cc.fixId(_ct, id, (msg) => this.error(msg)));
			} else {
				ids = [_cc.fixId(_ct, null, (msg) => this.error(msg))];
			}
			for (var id of ids) {
				if (_cc.nodes[id]) this.error(id + " is already defined");
				_cc.addNode(_ct, id, title);
			}
			return {ids, _ct};
		}
	}
	
	class Cons extends SyntaxElem {
	}
	class ConsRef extends Cons {
		constructor(name, params) {
			super();
			this.name = name;
			this.params = params;
		}
		toMeta(_cc) {
			var m = meta.byName(this.name);
			if (!m) this.error(`Type ${this.name} not defined`);
			var _ct = { type: m };
			_ct.params = (this.params || []).map(p => p.toMeta(_cc, _ct)).reduce((a, b) => a.concat(b), []);
			return _ct;
		}
	}
	class ConsConst extends ConsRef {
		constructor(v) {
			super('Const', [new ParamNum(v)]);
		}
	}
	class ConsGain extends ConsRef {
		constructor(v) {
			super('Gain', [new ParamNum(v)]);
		}
	}
	class ConsProc extends Cons {
		constructor(proc) {
			super();
			this.proc = proc;
		}
		toMeta() {
			var m = meta.newProc(this.proc);
			return { type: m, params: [] };
		}
	}
	class ConsVec extends ConsRef {
		constructor(params) {
			super('Vec', params);
		}
	}
	class ConsGlobal extends Cons {
		toMeta(_cc) {
			return {type: '@global', params: [], opts: { global: 1 }};
		}
	}
	class Proc extends Cons {
		constructor(params, body, init, outs) {
			super();
			this.params = params;
			this.body = body;
			this.init = init;
			this.outs = outs;
		}
	}
	class ProcParam extends SyntaxElem {
		constructor(agr, name, def) {
			super();
			this.agr = agr;
			this.name = name;
			this.def = def;
		}
	}
	
	class TypeParam extends SyntaxElem {
		toMeta(_cc, _ct) {
			return this.error('not implemented');
		}
	}
	
	class ParamNum extends TypeParam {
		constructor(v) {
			super();
			this.value = v;
		}
		toMeta(_cc, _ct) {
			return [this.value.toString()];
		}
	}
	class ParamProc extends TypeParam {
		constructor(proc) {
			super();
			this.proc = proc;
		}
		toMeta(_cc, _ct) {
			var decl = new Decl(new ConsProc(this.proc));
			var id = decl.toMeta(_cc).ids[0];
			return [`this.${id}`];
		}
	}
	class ParamRef extends TypeParam {
		constructor(ids) {
			super();
			this.ids = ids;
		}
		toMeta(_cc, _ct) {
			return this.ids.map(id => `this.${id}`);
		}
	}
	class ParamEnum extends TypeParam {
		constructor(name) {
			super();
			this.name = name;
		}
		toMeta(_cc, _ct) {
			if (this.name in _ct.type.values) {
				return [_ct.type.values[this.name].toString()];
			}
			this.error(`this.name is not found in values of ${_ct.type.name}`);
		}
	}
	
	// class Main extends Unit {
	// 	constructor(items) {
	// 		super('Main', items);
	// 	}
	// 	toMeta() {
	// 		var mod = meta.getMain();
	// 		for (var item of this.items) {
	// 			item.toMeta(mod);
	// 		}
	// 	}
	// }

	class Module extends Unit {
		getIncludes() {
			return this.items.filter(i => i instanceof Include);
		}
		toMeta(meta) {
			var _m = meta.newModule(this.name);
			for (var item of this.items) {
				item.toMeta(_m);
			}
			return _m;
		}
	}

	function showError(msg) {
		console.error(msg);
		if (BCPU.onShowError) BCPU.onShowError(msg);
	}
	
	function run(actionName, source, parseFunc) {
		console.log(actionName);
		try {
			var result = parseFunc(source);
			return result;
		}
		catch(e) {
			console.error(e);
			if (e.location && e.message) {
				var msg = `Error ${actionName} at ${e.location.start.line}:${e.location.start.column}: ${e.message}`;
				showError(msg);
				throw msg;
			} else {
				var msg = `Error ${actionName}`;
				if (e.message) msg += ': ' + e.message;
				msg += '<br />See console';
				showError(msg);
				debugger;
				parseFunc(source); // rethrow
			}
		}
	}
	
	// var grammars = {};
	// var parsers = {};
	
	// function addGrammar(t, source) {
	// 	var grammar = source.replace(/\t*"include BCPU";\n?/,
	// 		Object.keys(BCPU.cls)
	// 			.map(k => 
	// 				`\tvar ${k} = function (a, b, c, d, e) { var obj = new BCPU.cls.${k}(a, b, c, d, e); obj.type = '${k}'; return obj; }\n`
	// 			)
	// 			.join('')
	// 		+ Object.keys(BCPU.fun)
	// 			.map(k => 
	// 				`\tvar ${k} = BCPU.fun.${k};\n`
	// 			)
	// 			.join('')
	// 	);
	// 	var parser = run('parsing ' + t + ' grammar ', grammar, s => PEG.buildParser(s));
	// 	grammars[t] = grammar;
	// 	parsers[t] = parser;
	// 	return parser;
	// }
	
	var sources = {};
	
	// function getSourceType(name) {
	// 	var m;
	// 	if (m = name.match(/\.(\w{1,6})$/)) return m[1];
	// 	return '';
	// }
	
	// function putSource(name, data) {
	// 	if (!sources[name]) sources[name] = {
	// 		loaded: true,
	// 	}
	// 	sources[name].data = data;
	// }

	// function processSource(name) {
	// 	if (sources[name].processed) return;
	// 	var t = getSourceType(name);
	// 	var m;
	// 	if (m = name.match(/(\w+)\.pegjs$/)) {
	// 		return addGrammar(m[1], sources[name].data);
	// 	}
	// 	var ast = run('parsing ' + name, sources[name].data, s => parsers[t].parse(s));
	// 	console.log('parsed ' + name, ast);
	// 	run('in ' + name, ast, s => s.toMeta());
	// 	sources[name].processed = true;
	// 	return ast;
	// }
	
	// function sourceLoaded(name, data, from) {
	// 	putSource(name, data);
	// 	sources[name].rq = null;
	// 	sources[name].loaded = true;
	// 	if (from) sources[name].from = from;
	// 	var t = getSourceType(name);
	// 	if (t == 'bc') {
	// 		var re = /^@include\s+([-\w\/\.]+)\s*$/mg;
	// 		var m;
	// 		while (m = re.exec(data)) {
	// 			requestSource(m[1]); //);
	// 		}
	// 	}
	// }
	
	// function compress(s) {
	// 	var zipped = RawDeflate.deflate(s, 9);  
	// 	return Simple64.encode(zipped);
	// }
	// function decompress(s) {
	// 	var zipped = Simple64.decode(s);
	// 	return RawDeflate.inflate(zipped);
	// }

	// function localKey(name) {
	// 	return 'bcsrc:' + name;
	// }
	// function localGet(name) {
	// 	var cd = localStorage[localKey(name)];
	// 	if (cd) {
	// 		return decompress(cd);
	// 	}
	// }
	// function localPut(name) {
	// 	if (!sources[name]) return;
	// 	localStorage[localKey(name)] = compress(sources[name].data);
	// }
	// function localDelete(name) {
	// 	delete localStorage[localKey(name)];
	// }

	// function requestSource(name, params = {}) {
	// 	var rq;
	// 	if (!sources[name]) {
	// 		sources[name] = {
	// 			loaded: false,
	// 		}
	// 	}
	// 	if (sources[name].loaded) {
	// 		return Kefir.constant(sources[name].data);
	// 	}
	// 	if (sources[name].rq) {
	// 		return sources[name].rq;
	// 	}
	// 	var data;
	// 	if (params.from != 'server' && (data = localGet(name))) {
	// 		return sourceLoaded(name, data, 'localStorage');
	// 	}
	// 	rq = Kefir.fromPromise($.get(name));
	// 	sources[name].from = 'server';
	// 	sources[name].rq = rq;
	// 	return rq;
	// }
	
	// function onLoadAll(cb) {
	// 	var ns = [];
	// 	for (var n in sources) if (sources[n].rq) ns.push(n);
	// 	var rqs = ns.map(n => sources[n].rq);
	// 	if (!rqs.length) return cb();
	// 	Kefir.zip(rqs).onValue(ss => {
	// 		for (var i = 0; i < ss.length; i++) {
	// 			sourceLoaded(ns[i], ss[i]);
	// 		}
	// 		onLoadAll(cb);
	// 	});
	// }

	
	return Object.assign(BCPU, {
		cls: {
			SyntaxElem,
			Unit,
			UnitInit,
			UnitInitItem,
			EnumDef,
			EnumValDef,
			Chain,
			ChainLink,
			ChainArrow,
			Layout,
			LayoutDecl,
			LayoutSub,
			Include,
			Point,
			Node,
			Decl,
			Ref,
			ConsRef,
			ConsConst,
			ConsGain,
			ConsProc,
			ConsVec,
			Proc,
			ProcParam,
			ParamNum,
			ParamProc,
			ParamRef,
			ParamEnum,
			//Main,
			Module,
		},
		fun: {
			noteToInt,
			makeRange,
			_abcState,
		},
		run,
		// grammars,
		// parsers,
		sources,
		// getSourceType,
		// requestSource,
		// addGrammar,
		// processSource,
		// putSource,
		// onLoadAll,
		// sourceLoaded,
		// compress,
		// decompress,
		// localKey,
		// localDelete,
		// localPut,
		// localGet,
	});
});