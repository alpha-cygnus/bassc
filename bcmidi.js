(function(global) {
"use strict";

class MidiProc {
	constructor() {
		navigator.requestMIDIAccess()
			.then(ma => {
				this.midi = ma;
				this.connectInputs();
				this.midi.onstatechange = e => this.connectInputs();
			})
		this.listeners = {};
	}
	connectInputs() {
		for (var inp of this.midi.inputs) {
			var inpId = inp[0];
			var input = inp[1];
			//console.log('MIDI Input', input.id, ':', input.name);
			input.onmidimessage = mm => this.midiMessageHandler(mm);
		}
	}
	midiMessageHandler(mm) {
		var v = this.decode(mm.data);
		//console.log('MIDI', mm.data, v);
		if (!v) return;
		for (let id in this.listeners) {
			this.listeners[id](v);
		}
	}
	decode(data) {
		var hi = data[0] >> 4;
		var lo = data[0] & 0xF;
		switch(hi) {
			case midi.ON:
			case midi.OFF:
				return {
					t: data[2] > 0 ? hi : midi.OFF,
					c: lo,
					n: data[1],
					v: data[2],
				};
			case midi.PITCH:
				var v = data[2]*128.0 + data[1] - 8192;
				return {
					t: hi,
					c: lo,
					n: 0,
					v: v > 0 ? v/8191 : v/8192,
				}
			case midi.CC:
				if (data[1] < 120) {
					return {
						t: hi,
						c: lo,
						n: data[1],
						v: data[2]/127,
					}
				} else {
					return; // TBD
				}
			case midi.PAT:
				return {
					t: hi,
					c: lo,
					n: data[1],
					v: data[2]/127,
				}
			case midi.CAT:
				return {
					t: hi,
					c: lo,
					n: 0,
					v: data[1]/127,
				}
			case midi.PC:
				return {
					t: hi,
					c: lo,
					n: 0,
					v: data[1]/127,
				}
		}
	}
	addListener(fun) {
		let id = _getObjId(fun);
		this.listeners[id] = fun;
	}
}

const midi = {
	OFF: 0x8,
	ON: 0x9,
	PAT: 0xA,
	CC: 0xB,
	PC: 0xC,
	CAT: 0xD,
	PITCH: 0xE,
	proc: new MidiProc(),
};

class MidiNotesBaseNode extends BC.BaseNode { // abstract
	constructor(parent, [mode]) {
		super(...arguments);
		this.inp = new BC.MIDIIN(this, []);
		this.out = new BC.POUT(this, []);

		this.noteSet = {};
		this.noteList = {};
		this.nc = 0;
		this.value = 0;
		this.out.plugStream(
			this.inp.stream.map(vs => {
				for (var v of vs) {
					if (v.t === midi.ON) {
						if (this.noteSet[v.n]) continue;
						this.nc++;
						this.noteSet[v.n] = this.nc;
						this.noteList[this.nc] = v.n;
					}
					if (v.t === midi.OFF) {
						var nc = this.noteSet[v.n];
						delete this.noteSet[v.n];
						delete this.noteList[nc];
					}
				}
				this.value = this.getValue();
				return this.value;
			})
		)
	}
	getValue() {
		throw "Define getValue";
	}
}

const MTModes = ['bool', 'retrig', 'count']

class MidiTrigger extends MidiNotesBaseNode {
	constructor(parent, [mode]) {
		super(...arguments);
		this.smode = MTModes[mode];
	}
	getValue() {
		switch(this.smode) {
			case 'count':
				return Object.keys(this.noteSet).length;
			case 'retrig':
				return Object.keys(this.noteSet).length ? this.nc : 0;
			default: return Object.keys(this.noteSet).length > 0 ? 1 : 0;
		}
		
	}
}

const MNModes = ['max', 'min', 'last', 'first'];

class MidiNote extends MidiNotesBaseNode {
	constructor(parent, [mode]) {
		super(...arguments);
		this.smode = MNModes[mode];
	}
	getEffectives() {
		switch(this.smode) {
			case 'min': return [Math.min, this.noteSet];
			case 'first': return [Math.min, this.noteList];
			case 'last': return [Math.max, this.noteList];
			default: return [Math.max, this.noteSet]; // defaults to max
		}
	}
	getValue() {
		var efs = this.getEffectives();
		var f = efs[0], set = efs[1];
		var lst = Object.keys(set);
		if (lst.length < 1) return this.value;
		var n = f.apply(Math, lst);
		if (set === this.noteList) n = this.noteList[n];
		this.value = n;
		return n;
	}
}

class MidiHub extends BC.BaseNode {
	constructor(parent, [procFilter]) {
		super(...arguments);
		var filter = x => 1;
		if (procFilter instanceof BC.Proc) {
			
		}
		this.inp = new BC.MIDIIN(this, []);
		this.out = new BC.MIDIOUT(this, []);
		this.out.plugStream(this.inp.stream);
	}
}

class MidiLog extends BC.BaseNode {
	constructor(parent) {
		super(...arguments);
		this.inp = new BC.MIDIIN(this, []);
		this.inp.stream.onValue(vs => {
			for (var v of vs) {
				console.log(this.name || 'MidiLog',  this.msgToString(v));
			}
		});
	}
	msgToString(m) {
		function noteString(n) {
			return 'CCDDEFFGGAAB'[n%12] + '-#-#--#-#-#-'[n%12] + Math.floor(n/12);
		}
		function chanString(c) {
			return c.toString(16);
		}
		function hexString(n) {
			var res = n.toString(16);
			if (res.length < 2) res = '0' + res;
			return res
		}
		function ccnString(n) {
			return hexString(n);
		}
		function byteString(v) {
			return hexString(v);
		}
		m.c = m.c || 0;
		m.t = m.t || 0;
		m.n = m.n || 0;
		m.v = m.v || 0;
		switch(m.t) {
			case midi.ON:
				return `[${chanString(m.c)}] ON ${noteString(m.n)} ${byteString(m.v*127)}`;
			case midi.OFF:
				return `[${chanString(m.c)}] FF ${noteString(m.n)} ${byteString(m.v*127)}`;
			case midi.PITCH:
				return `[${chanString(m.c)}] PITCH ${m.v}`;
			case midi.CC:
				return `[${chanString(m.c)}] CC ${ccnString(m.n)} ${byteString(m.v*127)}`;
			case midi.PAT:
				return `[${chanString(m.c)}] AT ${noteString(m.n)} ${byteString(m.v*127)}`;
			case midi.CAT:
				return `[${chanString(m.c)}] AT ${byteString(m.v*127)}`;
			case midi.PC:
				return `[${chanString(m.c)}] PC ${byteString(m.v*127)}`;
			default:
				return JSON.stringify(m);
		}
	}
}

class WebMidi extends BC.BaseNode {
	constructor(parent) {
		super(...arguments);
		this.out = new BC.MIDIOUT(this, []);
		this.buffer = [];
		midi.proc.addListener(v => this.addToBuffer(v));
		this.out.produceFromBuffer(this, 'buffer');
	}
	addToBuffer(v) {
		var maxBuf = 100;
		this.buffer.push(v);
		while (this.buffer.length > maxBuf) this.buffer.shift(); // sanity
		//console.log(this.buffer);
	}
}

const MaxPolyVoices = 16;

class MidiPoly extends BC.BaseNode {
	constructor(parent, [vc]) {
		super(...arguments);
		this.inp = new BC.MIDIIN(this, []);
		this.voices = {
			fromNote: {},
			list: [],
			allocated: [],
			free: [],
			max: 4,
			allocate(noteOn) {
				var n = noteOn.n;
				var i = this.fromNote[n];
				if (i) {
					this.deallocate(i);
				}
				if (this.allocated.length >= this.max) {
					this.deallocate(this.allocated[0]);
				}
				i = this.free.shift();
				this.allocated.push(i);
				this.fromNote[n] = i;
				this.list[i - 1].note = n;
				this.list[i - 1].buffer.push(noteOn);
				return this;
			},
			deallocate(i, noteOff) {
				if (!i) return;
				var n = this.list[i - 1].note;
				if (!noteOff) {
					noteOff = {
						t: midi.OFF, n: n, v: 0,
					}
				}
				this.list[i - 1].buffer.push(noteOff);
				this.free.push(i);
				var ai = this.allocated.indexOf(i);
				this.allocated.splice(ai, 1);
				delete this.fromNote[n];
				return this;
			},
		}
		for (var i = 0; i < MaxPolyVoices; i++) {
			this['out_' + i] = new BC.MIDIOUT(this, []);
			this.voices.list[i] = {
				buffer: [],
				note: 0,
			};
		}
		if (!vc) vc = 4;
		if (vc <= 0) vc = 1;
		if (vc > MaxPolyVoices) vc = MaxPolyVoices;
		this.voices.max = vc;
		for (var i = 0; i < vc; i++) {
			this.voices.free.push([i + 1]);
		}
		var scan = this.inp.stream.scan((vs, es) => {
			for (var e of es) {
				switch(e.t) {
					case midi.ON:
						vs.allocate(e);
						break;
					case midi.OFF:
						vs.deallocate(vs.fromNote[e.n], e);
						break;
					case midi.PITCH:
					case midi.CC:
					case midi.CAT:
					case midi.PAT:
						for (var i = 0; i < vc; i++) {
							vs.list[i].buffer.push(e);
						}
						break;
				}
			}
			return vs;
		}, this.voices);
		for (var i = 0; i < MaxPolyVoices; i++) {
			let ii = i;
			this['out_' + i].plugStream(
				scan.map(vs => {
					var buf = vs.list[ii].buffer;
					vs.list[ii].buffer = [];
					//if (buf.length > 0) console.log('out_' + ii, buf);
					return buf;
				})
			);
		}
	}
}

class MidiCC extends BC.BaseNode {
	constructor(parent, [n]) {
		super(...arguments);
		this.ccn = n;
		this.inp = new BC.MIDIIN(this, []);
		this.out = new BC.POUT(this, []);
		this.value = 0;
		this.out.plugStream(
			this.inp.stream.scan((v, es) => {
				for (var e of es) {
					if (e.t == midi.CC && e.n == this.ccn) v = e.v;
				}
				return v;
			}, 0)
		);
	}
}

class MidiPitchWheel extends BC.BaseNode {
	constructor(parent, [n]) {
		super(...arguments);
		this.ccn = n;
		this.inp = new BC.MIDIIN(this, []);
		this.out = new BC.POUT(this, []);
		this.value = 0;
		this.out.plugStream(
			this.inp.stream.scan((v, es) => {
				for (var e of es) {
					if (e.t == midi.PITCH) v = e.v;
				}
				return v;
			}, 0)
		);
	}
}

class MidiFilter extends BC.BaseNode {
	constructor(parent, [procFilter]) {
		super(...arguments);
		var filter = x => 1;
		this.inp = new BC.MIDIIN(this, []);
		this.out = new BC.MIDIOUT(this, []);
		var stream = this.inp.stream;
		if (procFilter instanceof BC.Proc) {
			stream = Kefir.zip([this.inp.stream, procFilter.getFuncStream(['t', 'c', 'n', 'v'])], (ms, func) => {
				var res = [];
				for (var m of ms) {
					var {t, c, n, v} = m;
					if (func(t, c, n, v)) {
						res.push(m);
					}
				}
				return res;
			});
		}
		this.out.plugStream(stream);
	}
}

class MidiExtract extends BC.BaseNode {
	constructor(parent, [proc]) {
		super(...arguments);
		this.inp = new BC.MIDIIN(this, []);
		this.out = new BC.MIDIOUT(this, []);
		this.prev = 0;
		var stream = this.inp.stream;
		if (proc instanceof BC.Proc) {
			stream = Kefir.zip([this.inp.stream, proc.getFuncStream(['t', 'c', 'n', 'v', 'prev'])], (ms, func) => {
				for (var m of ms) {
					var {t, c, n, v} = m;
					var res = func(t, c, n, v, this.prev);
					this.prev = res;
				}
				if (!$.isArray(res)) res = [res];
				return res[0];
			});
		}
		this.out.plugStream(stream);
	}
}

Object.assign(BC, {
	MidiHub,
	WebMidi,
	MidiPoly,
	MidiLog,
	MidiTrigger,
	MidiNote,
	MidiCC,
	MidiPitchWheel,
	MidiFilter,
	MidiExtract,
	midi,
});

})(this);
