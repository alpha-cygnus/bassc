(function(global) {
"use strict";

const _getObjId = (function() {
	var objMap = new WeakMap();
	var last = 0;
	return function(obj) {
		var id = objMap.get(obj);
		if (!id) {
			id = ++last;
			objMap.set(obj, id);
		}
		return id;
	}
})();

function _apply(fn) {
	return function(args) {
		return fn.apply(this, args);
	}
}

class BaseNode {
	constructor(parent, params) {
		this._parent = parent;
		this._params = params || [];
	}
	getAudioBias() {
		return Tone.Signal._constant;
	}
	getHTML() {
		return null;
	}
	onStartUI() {
		return;
	}
	getMeta() {
		return this.constructor.meta;
	}
	getDefOut(t) {
		var meta = this.getMeta();
		if (!meta) return null;
		var id = meta.getDeftOutId(t);
		return this[id];
	}
	getDefPOUT() {
		return this.getDefOut('P');
	}
	error(msg) {
		debugger;
		throw msg;
	}
}

class Port extends BaseNode {
	get inp() {
		return this;
	}
	get out() {
		return this;
	}
	connectTo(inout) {
		throw 'Define connectTo';
	}
}

class MIDIPort extends Port {
	constructor(parent) {
		super(...arguments);
		this.pool = Kefir.pool();
		this.plugged = core.tickStream.map(t => []);
		this.pool.plug(this.plugged);
		this.inStreams = [];
	}
	plugStream(obs) {
		this.pool.unplug(this.plugged);
		this.inStreams.push(obs);
		if (this.inStreams.length > 1) {
			this.plugged = Kefir.zip(this.inStreams).map(vs => {
				return vs.reduce((a, b) => a.concat(b));
			});
		} else {
			this.plugged = obs;
		}
		this.pool.plug(this.plugged);
		return this;
	}
	connectTo(port) {
		port.plugStream(this.stream);
	}
	onValue(onVal) {
		this.stream.onValue(onVal);
	}
	get stream() {
		return this.pool;
	}
}

class MIDIOUT extends MIDIPort {
	produceFromBuffer(obj, field, onBeforeProduce) {
		this.obj = obj;
		var stream = core.tickStream.map(t => {
			if (onBeforeProduce) onBeforeProduce(t);
			var vs = this.obj[field];
			this.obj[field] = [];
			return vs;
		})
		this.plugStream(stream);
		return this;
	}
}

class MIDIIN extends MIDIPort {
	
}

// P(arametric/rocessing) IN/OUT
class PPort extends Port {
	constructor(parent, [def], agrFun, agrInit) {
		super(...arguments);
		this.agrFun = agrFun || ((a, b) => a + b);
		this.agrInit = agrInit || 0;
		this.pool = Kefir.pool();
		//this.value = def || 0;
		var defStream;
		if (def instanceof BaseNode) {
			var pout = def.getDefPOUT();
			if (!pout) this.error("Can't get default stream");
			defStream = pout.stream;
		} else {
			this.value = (def || 0)*1;
			defStream = core.tickStream.map(t => this.value);
		}
		this.plugged = defStream;
		this.pool.plug(this.plugged);
		this.inStreams = [];
		this.outs = this.pool;
	}
	plugStream(obs) {
		this.pool.unplug(this.plugged);
		this.inStreams.push(obs);
		if (this.inStreams.length > 1) {
			this.plugged = Kefir.zip(this.inStreams).map(vs => {
				return vs.reduce(this.agrFun, this.agrInit);
			});
		} else {
			this.plugged = obs;
		}
		this.pool.plug(this.plugged);
		return this;
	}
	connectTo(inout) {
		inout.plugStream(this.stream);
	}
	get stream() {
		return this.outs;
	}
	get triggerStream() {
		return this.outs.scan(
			(state, trig) => {
				if (Math.abs(state.on - trig) >= 0.5) {
					if (Math.abs(trig) > 0.5) {
						state.v = +1;
					} else {
						state.v = -1;
					}
				} else {
					state.v = 0;
				}
				state.on = trig;
				if (this.doLog) console.log('PIN.scan', state, trig);
				return state;
			},
			{on: 0, v: 0}
		).map(state => {
			if (this.doLog) console.log('PIN.scan.map', state);
			return state.v || 0;
		});
	}
}

class POUT extends PPort {
	produceFromField(obj, field, onBeforeProduce) {
		var state = {
			last: undefined
		};
		this[field + 'Stream'];
		var stream = core.tickStream.map(t => {
			if (onBeforeProduce) onBeforeProduce(t);
			if (obj[field] !== state.last) {
				state.last = obj[field];
			}
			return state.last;
		});
		this.plugStream(stream);
		state.stream = stream;
		obj[field + 'State'] = state;
		return this;
	}
	produceFromFunction(fun) {
		var stream = core.tickStream.map(fun);
		this.plugStream(stream);
		state.stream = stream;
		obj[field + 'State'] = state;
		return this;
	}
}

class PIN extends PPort {
	toProp(obj, pn) {
		this.outs.onValue(v => {
			obj[pn] = v;
		});
	}
	onValue(onVal) {
		this.outs.onValue(onVal);
	}
}

// Audio in/out
class APort extends Port {
	constructor(parent, [def]) {
		super(...arguments);
		this.gain = Tone.context.createGain();
		if (typeof def != 'undefined') {
			this.gain.gain.value = def;
		}
	}
	plugAudio(out) {
		out.connect(this.gain);
	}
	connectTo(aport) {
		aport.plugAudio(this.gain);
	}
}

class AOUT extends APort {
	constructor(parent, [def]) {
		super(...arguments);
	}
	bind(node) {
		node.connect(this.gain);
		return this;
	}
	unbind(node) {
		node.disconnect(this.gain);
		return this;
	}
}

class AIN extends APort {
	constructor(parent, [def]) {
		super(parent, [1]);
		if (def) {
			this.cg = Tone.context.createGain();
			this.getAudioBias().connect(this.cg);
			this.cg.gain.value = def;
			this.cg.connect(this.gain);
		}
	}
	plugAudio(out) {
		if (this.cg) {
			this.cg.disconnect();
			this.cg = null;
		}
		out.connect(this.gain);
		return this;
	}
	bind(node) {
		this.gain.connect(node);
		return this;
	}
	unbind(node) {
		this.gain.disconnect(node);
		return this;
	}
}

class Core {
	constructor() {
		this.producers = {};
		this.consumers = {};
		this.intId = null;
		this.bpm = 120;
		this.ppqn = 48;
		this.calcTps();
		this.tickStream = Kefir.stream(emitter => {
			var fun = (t) => {
				emitter.emit(t);
			}
			core.onProduce(fun);
			return () => core.offProduce(fun);
		});
		this.context = Tone.context;
	}
	onProduce(fun) {
		let id = _getObjId(fun);
		this.producers[id] = fun;
	}
	offProduce(fun) {
		let id = _getObjId(fun);
		delete this.producers[id];
	}
	doProduce(t) {
		for (let id in this.producers) {
			this.producers[id](t);
		}
	}
	doTick(t) {
		this.doProduce(t);
	}
	calcTps() {
		this.tps = this.bpm*this.ppqn/60;
		if (this.tps <= 0) this.tps = 1;
		if (this.tps > 200) this.tps = 200;
		return this.tps;
	}
	setBpm(bpm) {
		this.bpm = bpm;
		this.calcTps();
	}
	setPpqn(ppqn) {
		this.ppqn = ppqn;
		this.calcTps();
	}
	start(bpm, ppqn) {
		if (bpm) this.setBpm(bpm);
		if (ppqn) this.setPpqn(ppqn);
		if (this.intId) stop();
		var prevT = 0;
		var cT = 5;
		this.intId = setInterval(() => {
			var dT = 1/this.tps;
			if (window.stopped) return;
			var curT = Tone.context.currentTime;
			var cnt = 0;
			if (curT >= prevT + dT) {
				if (prevT > 0) console.warn('TICKS WERE SKIPPED');
				prevT = curT; // realign
			}
			while (prevT < curT + cT*dT) {
				prevT += dT;
				this.doTick(prevT);
			};
		}, 15);
	}
	stop() {
		if (this.intId) clearInterval(this.intId);
		this.intId = null;
	}
};

const core = new Core();

const P2AModes = ['set', 'linear', 'exp'];

class P2A extends BaseNode {
	constructor(parent, [mode, lag]) {
		super(...arguments);
		this.smode = P2AModes[mode] || 'set';
		this.lag = lag < 0 ? 0 : lag || 0;
		this.inp = new PIN(this, []);
		this.out = new AOUT(this, []);
		this.pgain = this.out.gain.gain;
		this.pgain.value = 0;
		this.constant = this.getAudioBias();
		this.constant.connect(this.out.gain);
		
		this.last = undefined;
		Kefir.zip([core.tickStream, this.inp.stream])
			.onValue(([t, v]) => {
				if (v === undefined) return;
				if (isNaN(v)) return;
				if (this.last != v) {
					switch (this.smode) {
						case 'set':
							this.pgain.setValueAtTime(v, t + this.lag);
							break;
						case 'linear':
							this.pgain.linearRampToValueAtTime(v, t + this.lag);
							break;
						case 'exp':
							this.pgain.exponentialRampToValueAtTime(v, t + this.lag);
							break;
					}
				}
				this.last = v;
			});
	}
}

class ADSR extends BaseNode {
	constructor(parent, [a, d, s, r]) {
		super(...arguments);

		this.inp = new AIN(this, [1]);
		this.out = new AOUT(this, []);
		this.inp.gain.connect(this.out.gain);
		this.pgain = this.out.gain.gain;
		this.pgain.value = 0;

		this.attack = new PIN(this, [a || 0.1]);
		this.decay = new PIN(this, [d || 0.5]);
		this.sustain = new PIN(this, [(s == undefined) ? 0.5 : s]);
		this.release = new PIN(this, [r || 1]);
		
		this.trigger = new PIN(this, [0]);
		Kefir.zip([core.tickStream, this.trigger.triggerStream, this.attack.stream, this.decay.stream, this.sustain.stream, this.release.stream])
			.onValue(_apply(
				(time, trig, a, d, s, r) => {
					//console.log('ADSR', time, trig, a, d, s, r);
					if (trig > 0) {
						this.pgain.cancelScheduledValues(time);
						this.pgain.setTargetAtTime(1, time, a / 4);
						this.pgain.setTargetAtTime(s, time + a, d / 4);
					}
					if (trig < 0) {
						this.pgain.cancelScheduledValues(time);
						this.pgain.setTargetAtTime(0, time, r / 4);
					}
				}
			));
	}
}

const OSCTypes = ['sine', 'square', 'sawtooth', 'triangle'];

class Osc extends BaseNode {
	constructor(parent, [type]) {
		super(...arguments);
		this.trigger = new PIN(this, [1]);
		this.stype = OSCTypes[type || 0];
		this.osc = null;
		this.out = new AOUT(this, []);
		this.freq = new AIN(this, [440]);
		this.detune = new AIN(this, []);
		Kefir.zip([core.tickStream, this.trigger.triggerStream])
			.onValue(_apply(
				(t, trig) => {
					if (trig > 0) {
						this.killOsc(t);
						this.makeOsc(t);
					}
				}
			));
	}
	makeOsc(t) {
		if (this.osc) return this.osc;
		this.osc = Tone.context.createOscillator();
		this.osc.type = this.stype;
		this.osc.frequency.value = 0;
		this.out.bind(this.osc);
		this.freq.bind(this.osc.frequency);
		this.detune.bind(this.osc.detune);
		this.osc.start(t);
		return this.osc;
	}
	killOsc(t) {
		if (!this.osc) return this.osc;
		this.osc.stop(t);
		this.out.unbind(this.osc);
		this.freq.unbind(this.osc.frequency);
		this.detune.unbind(this.osc.detune);
		this.osc = null;
		return this.osc;
	}
}

class Dest extends BaseNode {
	constructor(parent) {
		super(...arguments);
		this.inp = new AIN(this, []);
		this.gain = global.mainGain || Tone.context.createGain();
		global.mainGain = this.gain;
		global.mainVolume = this.gain.gain;
		this.inp.gain.connect(this.gain);
		this.gain.connect(Tone.context.destination);
	}
}

class Gain extends BaseNode {
	constructor(parent, [def]) {
		super(...arguments);
		this.g = Tone.context.createGain();
		this.g.gain.value = 0;
		this.inp = new AIN(this, []).bind(this.g);
		this.gain = new AIN(this, [def]).bind(this.g.gain);
		this.out = new AOUT(this, []).bind(this.g);
	}
}

class Delay extends BaseNode {
	constructor(parent, [def]) {
		super(...arguments);
		this.d = Tone.context.createDelay();
		this.d.delayTime.value = 0;
		this.inp = new AIN(this, []).bind(this.d);
		this.time = new AIN(this, [def]).bind(this.d.delayTime);
		this.out = new AOUT(this, []).bind(this.d);
	}
}

class Pan extends BaseNode {
	constructor(parent, [def]) {
		super(...arguments);
		this.p = Tone.context.createStereoPanner();
		this.p.pan.value = 0;
		this.inp = new AIN(this, []).bind(this.p);
		this.pan = new AIN(this, [def]).bind(this.p.pan);
		this.out = new AOUT(this, []).bind(this.p);
	}
}

class Const extends BaseNode {
	constructor(parent, [v]) {
		super(...arguments);
		this.c = this.getAudioBias();
		this.g = Tone.context.createGain();
		this.g.gain.value = v;
		this.c.connect(this.g);
		this.out = new AOUT(this, []); //.bind(this.g);
		this.inp = new AIN(this, []);
		this.g.connect(this.out.gain);
		this.inp.gain.connect(this.out.gain);
		this.pout = new POUT(this, [v]);
	}
}

class Noise extends BaseNode {
	constructor(parent, [def]) {
		super(...arguments);
		this.n = new Tone.Noise();
		this.n.start();
		this.out = new AOUT(this, []).bind(this.n);
	}
}

const FLTTypes = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'];

class Filter extends BaseNode {
	constructor(parent, [type]) {
		super(...arguments);
		this.stype = FLTTypes[type || 0];
		this.flt = Tone.context.createBiquadFilter();
		this.flt.type = this.stype;
		this.out = new AOUT(this, []).bind(this.flt);
		this.inp = new AIN(this, []).bind(this.flt);
		this.freq = new AIN(this, [440]).bind(this.flt.frequency);
		this.detune = new AIN(this, []).bind(this.flt.detune);
		this.q = new AIN(this, []).bind(this.flt.Q);
	}
}

class Clock extends BaseNode {
	constructor(parent) {
		super(...arguments);
		this.value = 0;
		this.trigger = new PIN(this, [1]);
		this.out = new POUT(this, []);
		this.out.plugStream(
			Kefir.zip([core.tickStream, this.trigger.triggerStream],
				(t, trig) => {
					if (trig > 0) {
						this.value = 0;
					}
					return this.value++;
				}
			)
		)
	}
}

class Count extends BaseNode {
	constructor(parent) {
		super(...arguments);
		this.inp = new PIN(this, []);
		this.reset = new PIN(this, [1]);
		this.value = 0;
		this.out = new POUT(this, []);
		this.out.plugStream(
			Kefir.zip([this.inp.stream, this.inp.triggerStream, this.reset.triggerStream], (v, vt, t) => {
				if (t > 0) {
					this.value = 0;
				}
				if (vt > 0) {
					this.value += 1;
				}
				return this.value;
			})
		);
	}
}

class PINLog extends BaseNode {
	constructor(parent) {
		super(...arguments);
		this.inp = new PIN(this, []);
		this.out = new POUT(this, []);
		this.out.plugStream(this.inp.stream);
		this.value;
		this.inp.stream.onValue(v => {
			if (v !== this.value) {
				console.log(this.name || this.id, v);
			}
			this.value = v;
		});
	}
}

class Vec extends BaseNode {
	constructor(parent, values) {
		super(...arguments);
		this.values = values;
		this.inp = new PIN(this, []);
		this.pout = new POUT(this, []);
		this.pout.plugStream(
			this.inp.stream.map((idx) => {
				return this.values[(idx || 0) % this.values.length];
			})
		);
		this.midiOut = new MIDIOUT(this, []);
	}
}

class BinDemux extends BaseNode {
	constructor(parent) {
		super(...arguments);
		this.inp = new PIN(this, []);
		for (var i = 0; i < 16; i++) {
			var out = this['out_' + i] = new POUT(this, []);
			let bi = i;
			let b = 1 << bi;
			out.plugStream(
				this.inp.stream.map(v => (v & b) >> bi)
			);
		}
	}
}

class QDemux extends BaseNode {
	constructor(parent) {
		super(...arguments);
		this.inp = new PIN(this, []);
		for (var i = 0; i < 16; i++) {
			var out = this['out_' + i] = new POUT(this, []);
			let bi = i*2;
			let b = 3 << bi;
			out.plugStream(
				this.inp.stream.map(v => (v & b) >> bi)
			);
		}
	}
}

// abstract base for modules
class Module extends BaseNode {
	constructor(parent) {
		super(...arguments);
	}
}
// abstract base for proc nodes
class Proc extends BaseNode {
	constructor(parent) {
		super(...arguments);
	}
	getFuncStream(argList) {
		return this._pinStream.map(pins => {
			var self = this;
			return function() {
				var args = pins;
				for (var i = 0; i < argList.length; i++) {
					var an = argList[i];
					if (typeof an == 'number') an = self._procParams[an];
					if (!an) continue;
					var arg = arguments[i];
					if ($.isArray(arg)) {
						var af = self._procAgr[an] || [(a, b) => a + b, 0];
						arg = arg.reduce(af[0], af[1]);
					}
					args[an] = arg;
				};
				return self._procFunc(args);
			};
		});
	}
}

global.BC = global.BC || {};
Object.assign(global.BC, {
	BaseNode,
	Port,
	MIDIPort,
	MIDIOUT,
	MIDIIN,
	PPort,
	POUT,
	PIN,
	APort,
	AOUT,
	AIN,
	Core,
	P2A,
	ADSR,
	Osc,
	Dest,
	Gain,
	Delay,
	Pan,
	Const,
	Noise,
	Filter,
	Clock,
	Count,
	Vec,
	BinDemux,
	QDemux,
	PINLog,
	Proc,
	Module,
	
	_getObjId,
	core,
});

})(this);
