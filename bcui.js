(function(global) {
"use strict";

var keysToNotes = {
	81: 60,
	50: 61,
	87: 62,
	51: 63,
	69: 64,
	82: 65,
	53: 66,
	84: 67,
	54: 68,
	89: 69,
	55: 70,
	85: 71,
	73: 72,
	57: 73,
	79: 74,
	48: 75,
	80: 76,
	219: -1,
	221: +1,
	// 219: 77, 
	// 187: 78,
	// 221: 79,
	
	90: 48,
	83: 49,
	88: 50,
	68: 51,
	67: 52,
	86: 53,
	71: 54,
	66: 55,
	72: 56,
	78: 57,
	74: 58,
	77: 59,
	188: 60,
	76: 61,
	190: 62,
	186: 63,
	191: 64,
};

window.keyNoteStream = Kefir.pool();

window.bcKeyboardEnabled = true;

var mouseCapturer = null;

function setDialValue(elem, v) {
	if (v < -1) v = -1;
	if (v > +1) v = +1;
	$(elem).data('value', v);
	$(elem).css('transform', 'rotate(' + (v*120) + 'deg)');
}

function getDialValue(elem) {
	return $(elem).data('value') || 0;
}

class UIManager {
	constructor() {
		this.drawers = [];
	}
	start() {
		$('.UIDial')
			.on('mousedown', e => {
				var elem = e.target;
				var vStep = e.shiftKey ? 1000 : 100;
				mouseCapturer = {
					elem,
					x0: e.screenX, y0: e.screenY,
					v0: getDialValue(elem),
					move(e) {
						var dy = this.y0 - e.screenY;
						var dv = dy/vStep;
						setDialValue(this.elem, this.v0 + dv);
					}
				}
			})
			.on('dblclick', e => {
				setDialValue(e.target, 0);
			})
		;
		$(document).on('mousemove', e => {
			if (mouseCapturer) {
				mouseCapturer.move(e);
			}
		});
		$(document).on('mouseup', e => {
			if (mouseCapturer) {
				mouseCapturer.move(e);
				if (mouseCapturer.up) {
					mouseCapturer.up(e);
				}
				mouseCapturer = null;
			}
		});
		this.draw();
	}
	addDrawer(func) {
		this.drawers.push(func);
	}
	draw() {
		requestAnimationFrame(() => this.draw());
		for (var func of this.drawers) {
			func();
		}
	}
}

class UIBasis extends BC.BaseNode {
	constructor() {
		super(...arguments);
		this.elem = null;
	}
	getId() {
		return `ui_${BC._getObjId(this)}`;
	}
	getHTML(css) {
		return `<div class="${this.getCSSClasses(css)}"
			style="${this.getStyle(css)}"
			id="${this.getId()}"
			data-title="${this.title || this.name || this.id}">${this.getInnerHTML(css)}</div>`;
	}
	getCSSClasses(css) {
		return `UI ${this.constructor.name} ${css}`;
	}
	getStyle(css) {
		return '';
	}
	getInnerHTML() {
		return '';
	}
	onStartUI() {
		this.elem = document.getElementById(this.getId());
	}
}

class UIDial extends UIBasis {
	constructor() {
		super(...arguments);
		this.out = new BC.POUT(this, []);
		this.out.produceFromField(this, 'value');
	}
	get value() {
		if (!this.elem) return 0;
		return getDialValue(this.elem);
	}
	// getHTML() {
	// 	return `<div class="UI UIDial" id="${this.getId()}"></div>`;
	// }
}

class UIDigits extends UIBasis {
	constructor(parent, [num]) {
		super(...arguments);
		this.numDigits = num || 2;
		this.inp = new BC.PIN(this, []);
		this.value = 0;
		this.prevValue = null;
		this.inp.onValue(v => {
			this.setDigits(v);
			// this.value = v;
		});
		// this.isConsumer(t => {
		// 	this.setDigits(this.value);
		// });
	}
	setDigits(v) {
		if (!this.elem) return;
		v = Math.round(v);
		if (this.prevValue == v) return;
		var s = '' + v;
		var mc = this.numDigits;
		if (v < 0) {
			//mc--;
			s = '' + (-v);
		}
		if (s.length > mc) s = s.replace(/./g, '9');
		while (s.length < mc) s = '0' + s;
		//if (v < 0) s = '-' + s;
		for (var i = 0; i < this.numDigits; i++) {
			var $d = $(this.elem).find('._' + i).removeClass('minus null d-0 d-1 d-2 d-3 d-4 d-5 d-6 d-7 d-8 d-9');
			if (s[i] == '-') $d.addClass('minus');
			else $d.addClass('d-' + s[i]);
		}
		if (v < 0) $(this.elem).removeClass('positive').addClass('negative');
		else $(this.elem).addClass('positive').removeClass('negative');
		this.prevValue = v;
	}
	getStyle() {
		return `width:${this.numDigits*10}px;`;
	}
	getInnerHTML() {
		var html = []; //`<div class="UI UIDigits" id="${this.getId()}" style="width:${this.numDigits*10}px;">`];
		for (var i = 0; i < this.numDigits; i++) {
			html.push(`<div class="seven-seg _${i}">
				<span class="t m"></span>
				<span class="t l"></span>
				<span class="t r"></span>
				<span class="m u"></span>
				<span class="m d"></span>
				<span class="b l"></span>
				<span class="b r"></span>
				<span class="b m"></span>
			</div>`);
		};
		//html.push('</div>');
		return html.join('');
	}
}

class UIHexDigits extends UIDigits {
	setDigits(v) {
		if (!this.elem) return;
		v = Math.round(v);
		if (this.prevValue == v) return;
		var s = (v || 0).toString(16);
		var mc = this.numDigits;
		if (v < 0) {
			//mc--;
			s = (-v).toString(16);
		}
		if (s.length > mc) s = s.replace(/./g, 'f');
		while (s.length < mc) s = '0' + s;
		//if (v < 0) s = '-' + s;
		for (var i = 0; i < this.numDigits; i++) {
			var $d = $(this.elem).find('._' + i).removeClass('minus null d-0 d-1 d-2 d-3 d-4 d-5 d-6 d-7 d-8 d-9 d-a d-b d-c d-d d-e d-f');
			if (s[i] == '-') $d.addClass('minus');
			else $d.addClass('d-' + s[i]);
		}
		if (v < 0) $(this.elem).removeClass('positive').addClass('negative');
		else $(this.elem).addClass('positive').removeClass('negative');
		this.prevValue = v;
	}
}

class UIValue extends UIBasis {
	constructor(parent, [num]) {
		super(...arguments);
		this.width = num || 2;
		this.inp = new BC.PIN(this, []);
		//this.value = 0;
		this.prevValue = null;
		this.inp.onValue(v => {
			this.showValue(v);
		});
		// this.isConsumer(t => {
		// 	this.showValue(this.value);
		// });
	}
	showValue(v) {
		if (!this.elem) return;
		v = Math.round(v*1000)/1000;
		if (this.prevValue == v) return;
		var s = ('' + v).replace('-', '&ndash;')
		if (v > 0) s = '+' + s;
		$(this.elem).html(s);
		this.prevValue = v;
	}
	getStyle() {
		return `width:${this.width*20}px;`;
	}
	// getHTML() {
	// 	return `<div class="UI UIValue" style="width:${this.width*20}px;" id="${this.getId()}"></div>`;
	// }
}

class UILED extends UIBasis {
	constructor(parent, [color]) {
		super(...arguments);
		color = color || 0xFF0000
		this.color = color; // 0xRRGGBB
		this.r = ((color >> 16) & 0xFF)/255;
		this.g = ((color >> 8) & 0xFF)/255;
		this.b = (color & 0xFF)/255;
		this.inp = new BC.PIN(this, []);
		// this.value = 0;
		this.prevValue = null;
		this.inp.onValue(v => {
			this.showValue(v);
			// this.value = v;
		});
		// this.isConsumer(t => {
		// });
	}
	showValue(v) {
		if (!this.elem) return;
		//v = Math.round(v*1000)/1000;
		if (this.prevValue !== null && Math.abs(this.prevValue - v) < 0.001) return;
		if (v < 0) v = 0;
		if (v > 1) v = 1;

		$(this.elem).css('color', 
			//`rgba(${Math.round(this.r*255)}, ${Math.round(this.g*255)}, ${Math.round(this.b*255)}, ${v})`);
			`rgb(${Math.round(this.r*v*255)}, ${Math.round(this.g*v*255)}, ${Math.round(this.b*v*255)})`);
		this.prevValue = v;
	}
	getStyle() {
		return `width:${this.width*20}px;`;
	}
	// getHTML() {
	// 	return `<div class="UI UILED" style="width:${this.width*20}px;" id="${this.getId()}"></div>`;
	// }
}

function isMidiKeys(keyNoteStream) {
	this.out = new BC.MIDIOUT(this, []);
	this.octave = 0;
	// var noteOns = {};
	// this.noteOns = noteOns;
	this.buffer = [];
	var maxBuf = 100;
	var midis = keyNoteStream
		.filter(v => {
			var note = v.note;
			// if (v.down && noteOns[note]) return false;
			if (note > 1) return true;
			if (!v.down) {
				if (note === +1) this.octave++;
				else if (note === -1) this.octave--;
				if (this.octave < -4) this.octave = -4;
				if (this.octave > 5) this.octave = 5;
			}
		})
		.map(v => {
			var note = v.note;
			// if (v.down) noteOns[note] = 1;
			// else delete noteOns[note];
			return {
				t: v.down ? BC.midi.ON : BC.midi.OFF,
				c: 0,
				n: note + this.octave*12,
				//o: this.octave,
				v: 64/127,
			};
		})
		.onValue(v => {
			this.buffer.push(v);
			while (this.buffer.length > maxBuf) this.buffer.shift(); // sanity
			//console.log(this.buffer);
		});
	//this.out.plug(midis);
	this.out.produceFromBuffer(this, 'buffer');
}

class Keyboard extends BC.BaseNode {
	constructor() {
		super(...arguments);
		var keysDown = {};
		var keyFilter = e => window.bcKeyboardEnabled && !e.metaKey && !e.shiftKey && !e.ctrlKey && keysToNotes[e.keyCode];
		var kdns = Kefir.fromEvents(window, 'keydown')
			.filter(keyFilter)
			.filter(e => !keysDown[e.keyCode])
			.map(e => {
				keysDown[e.keyCode] = 1;
				return {note: keysToNotes[e.keyCode], down: true};
			});
		var kups = Kefir.fromEvents(window, 'keyup')
			.filter(keyFilter)
			.map(e => {
				delete keysDown[e.keyCode];
				return {note: keysToNotes[e.keyCode], down: false};
			});
		
		var keyNoteStream = Kefir.merge([kdns, kups]);
		window.keyNoteStream.plug(keyNoteStream);
		
		isMidiKeys.call(this, keyNoteStream);
	}
}

class UIKeyboard extends UIBasis {
	constructor() {
		super(...arguments);
		this.keyNoteStream = Kefir.pool(); //merge([uiKbdDown, uiKbdUp]);
		window.keyNoteStream.plug(this.keyNoteStream);
		
		isMidiKeys.call(this, this.keyNoteStream);
		this.inp = new BC.MIDIIN(this, []);
		this.range = [24, 113];
	}
	getInnerHTML(css) {
		function isWhite(n) {
			return {
				 0: ['C', 'bl'],
				 2: ['D', ' '],
				 4: ['E', 'br'],
				 5: ['F', 'w1 bl'],
				 7: ['G', 'w1'],
				 9: ['A', 'w1'],
				11: ['B', 'w1 br']
			}[n%12];
		}
		//<div class="UIKeyboard ${css}" id="${this.getId()}" data-title="${this.title || this.name || this.id}">
		var html = `
			<div class="kbd-top"></div>
			<div class="kbd" style="display:block">
				<div class="kbd-up">`
		for (var n = this.range[0]; n < this.range[1]; n++) {
			var w = isWhite(n);
			if (w) {
				// if (n == this.range[1] - 1) s += ' br';
				// if (n == this.range[0]) s += ' bl';
				var s = w[1];
				html += `<span data-note="${n}" class="w up ${s}">&nbsp;</span>`;
			} else {
				html += `<span data-note="${n}" class="k up"><span class="keylabel"></span></span>`;
			}
		}
		html += '</div>';
		html += '<div class="kbd-down">';
		for (var n = this.range[0]; n < this.range[1]; n++) {
			var w = isWhite(n);
			if (w) {
				var l = w[0];
				var o = Math.floor(n/12);
				if (o > 5) {
					l = l.toLowerCase();
					while (--o >= 6) l += "'";
				} else {
					while (++o <= 5) l += ',';
				}

				html += `<span data-note="${n}" class="w down bl br"><span class="keylabel">${l}</span></span>`;
			}
		}

		html += `</div>`; //</div>`;
		return html;
	}
	onStartUI() {
		// this.elem = document.getElementById(this.getId());
		super.onStartUI(...arguments);
		var $elem = $(this.elem);

		var notePressed = null;
		var uiKbdDown = Kefir.fromEvents($elem.find('.kbd span[data-note]'), 'mousedown').map(e => {
			notePressed = $(e.target).data('note');
			return {note: notePressed, down: true};
		});
		var uiKbdUp = Kefir.fromEvents(document, 'mouseup').map(e => {
			if (notePressed) {
				var res = {note: notePressed, down: false};
				notePressed = false;
				return res;
			}
		})
		.filter(e => e);
		
		this.keyNoteStream.plug(uiKbdDown).plug(uiKbdUp);
		
		this.inp.stream.onValue(vs => {
			for (var v of vs) {
				if (v.t == BC.midi.ON) {
					$elem.find('.kbd span[data-note=' + v.n + ']').addClass('is-down');
				}
				if (v.t == BC.midi.OFF) {
					$elem.find('.kbd span[data-note=' + v.n + ']').removeClass('is-down');
				}
			}
		})
	}
}

class UIButton extends UIBasis {
	constructor() {
		super(...arguments);
		this.out = new BC.POUT(this, []);
		this.out.produceFromField(this, 'value');
	}
	get value() {
		if (!this.elem) return 0;
		return $(this.elem).hasClass('on');
	}
	// getHTML() {
	// 	return `<div class="UI UIButton glyphicon glyphicon-play" id="${this.getId()}"></div>`;
	// }
	getCSSClasses(css) {
		css += ' glyphicon ' + css.replace(/\b([\w-]+)\b/g, 'glyphicon-$1');
		return super.getCSSClasses(css);
	}
	onStartUI() {
		// this.elem = document.getElementById(this.getId());
		super.onStartUI(...arguments);
		$(this.elem).on('click', function() { $(this).toggleClass('on') });
	}
}

class UIAbstractScope extends UIBasis {
	constructor() {
		super(...arguments);
		this.init(...arguments);
	}
	init() {
		this.inp = new BC.AIN(this, []);
		this.lyser = Tone.context.createAnalyser();
		this.lyser.fftSize = 2048;
		this.inp.bind(this.lyser);
		this.dataArray = new Uint8Array(this.lyser.frequencyBinCount);
		this.width = this.dataArray.length;
		this.height = 256;
		this.bgHeight = 264;
		this.mode = 'exp';
	}
	getInnerHTML() {
		return `
			<canvas class="UICanvas scope-bg" width="${this.width}" height="${this.bgHeight}"></canvas>
			<canvas class="UICanvas scope-data" width="${this.width}" height="${this.height}"></canvas>
			`;
	}
	getCSSClasses(css) {
		return super.getCSSClasses(css) + ' UIScope';
	}
	onStartUI() {
		super.onStartUI(...arguments);
		this.dataCanvas = $('canvas.scope-data', this.elem)[0];
		this.bgCanvas = $('canvas.scope-bg', this.elem)[0];
		this.ctx = this.dataCanvas.getContext('2d');
		this.bgCtx = this.bgCanvas.getContext('2d');
		
		this.drawBG(this.bgCtx);

		this.ctx.clearRect(0, 0, this.width, this.height);
		
		this.imageData = this.ctx.createImageData(this.width, this.height);
		BC.ui.addDrawer(() => this.draw());
	}
	drawBG(ctx) {
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, this.width, this.bgHeight);
		
		ctx.beginPath();
		for (var i = 0; i < 100; i++) {
			ctx.moveTo(i * 40, 0);
			ctx.lineTo(i * 40, this.bgHeight);
		}
		for (var i = 0; i < 50; i++) {
			ctx.moveTo(0, i * 20, 0);
			ctx.lineTo(this.width, i * 20);
		}
		ctx.lineWidth = 0.4;
		ctx.strokeStyle = 'white';
		ctx.stroke();
	}
	draw() {
		this.drawData(this.ctx);
	}
}

class UISpectrograph extends UIAbstractScope {
	init() {
		this.inp = new BC.AIN(this, []);
		this.lyser = Tone.context.createAnalyser();
		this.lyser.fftSize = 2048;
		this.inp.bind(this.lyser);
		this.dataArray = new Uint8Array(this.lyser.frequencyBinCount);
		this.width = this.dataArray.length;
		this.height = 256;
		this.bgHeight = 264;
		this.mode = 'exp';
		this.dw = 1;
		this.minNote = 20;
		this.maxNote = 125;
	}
	drawBG(ctx) {
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, this.width, this.bgHeight);

		ctx.beginPath();
		// for (var i = 0; i < 100; i++) {
		// 	ctx.moveTo(i * 40, 0);
		// 	ctx.lineTo(i * 40, this.height);
		// }
		for (var i = 10; i < 100000; i *= 10) {
			for (var f2 of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
				var x = Math.round(this.getXForFreq(i*f2)*4)/4;
				ctx.moveTo(x, 0);
				ctx.lineTo(x, this.bgHeight);
			}
		}
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = 'white';
		ctx.stroke();

		ctx.beginPath();
		var x = Math.round(this.getXForFreq(444)*2)/2;
		ctx.moveTo(x, 0);
		ctx.lineTo(x, this.height);
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'red';
		ctx.stroke();
		
		this.cx = 0;
	}
	getXForFreq(f) {
		var minn = this.minNote;
		var cntn = this.maxNote - this.minNote;
		var n = Math.log2(f/440)*12 + 69;
		return (n - minn)/cntn*this.width;
	}
	getColor(i) {
		var dw = this.dw;
		var d = this.dataArray;
		var w = this.width/dw;
		var maxj = d.length;
		var maxf = BC.core.context.sampleRate;
		var minn = this.minNote;
		var cntn = this.maxNote - this.minNote;
		var df = maxf / 2 / maxj;
		function getJi(i) {
			var n = i/w*cntn + minn;
			var f = Math.pow(2, (n - 69)/12)*440;
			return f/df;
		}
		function getIj(j) {
			var f = (j + 1)*df;
			var n = Math.log2(f/440)*12 + 69;
			return (n - minn)/cntn*w;
		}
		function getV(j) {
			var fj = Math.floor(j);
			return (d[fj] || 0)*(1 - j + fj) + (d[fj + 1] || 0)*(j - fj);
		}
		if (this.mode == 'exp') {
			var j0 = getJi(i);
			var j1 = getJi(i + 1);
			var fs = [];
			fs.push([i, getV(j0)]);
			for (var j = Math.ceil(j0); j < j1; j = j + 1) {
				fs.push([getIj(j), d[j] || 0]);
			}
			fs.push([i + 1, getV(j1)]);
			var v = 0;
			for (var fi = 0; fi < fs.length - 1; fi++) {
				let [i0, vj0] = fs[fi];
				let [i1, vj1] = fs[fi + 1];
				v += (i1 - i0)*(vj0 + vj1)/2;
			}
			//v = Math.sqrt(v/255)*255;
		} else {
			var v = d[i];
		}
		v = Math.floor(v);
		var r = v >= 128 ? (v - 128)*2 : 0;
		var g = v < 128 ? v*2 : (255 - v)*2;
		var b = 0;
		var a = Math.min(g + r, 255);
		return {r, g, b, a, v};
	}
	drawData(ctx) {
		this.lyser.getByteFrequencyData(this.dataArray);
		var w = this.width/this.dw;
		for (var i = 0; i < w; i++) {
			var {r, g, b, a} = this.getColor(i);
			var pos = (this.height - this.cx - 1)*this.width*4 + i*4;
			this.imageData.data[pos] = r;
			this.imageData.data[pos + 1] = g;
			this.imageData.data[pos + 2] = b;
			this.imageData.data[pos + 3] = a;
		};
		ctx.putImageData(this.imageData, 0, - this.height + this.cx + 1, 0, this.height - this.cx - 1, this.width, this.cx);
		ctx.putImageData(this.imageData, 0, this.cx, 0, 0, this.width, this.height - this.cx);
		this.cx += 1;
		if (this.cx >= this.height) this.cx -= this.height;
	}
}

class UISpectrum extends UISpectrograph {
	// constructor() {
	// 	super(...arguments);
	init() {
		this.inp = new BC.AIN(this, []);
		this.lyser = Tone.context.createAnalyser();
		this.lyser.fftSize = 2048;
		this.inp.bind(this.lyser);
		this.dataArray = new Uint8Array(this.lyser.frequencyBinCount);
		this.width = 1024; //this.dataArray.length;
		this.height = 256;
		this.bgHeight = 264;
		this.mode = 'exp';
		this.dw = 16;
		this.minNote = 20;
		this.maxNote = 125;
	}
	drawBG(ctx) {
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, this.width, this.bgHeight);
		
		ctx.beginPath();
		for (var i = 1; i < 100000; i *= 10) {
			for (var f2 of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
				var x = Math.round(this.getXForFreq(i*f2)*4)/4;
				ctx.moveTo(x, 0);
				ctx.lineTo(x, this.bgHeight);
			}
		}
		for (var iy = 0; iy <= 256; iy += 32) {
			var y = this.bgHeight - iy - 1;
			ctx.moveTo(0, y, 0);
			ctx.lineTo(this.width, y);
		}
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = 'white';
		ctx.stroke();
		
		ctx.beginPath();
		var x = Math.round(this.getXForFreq(444)*2)/2;
		ctx.moveTo(x, 0);
		ctx.lineTo(x, this.bgHeight);
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'red';
		ctx.stroke();
	}
	drawData(ctx) {
		this.lyser.getByteFrequencyData(this.dataArray);
		ctx.clearRect(0, 0, this.width, this.height);
		var dw = this.dw;
		var w = this.width/dw;
		for (var i = 0; i < w; i++) {
			var {r, g, b, a, v} = this.getColor(i);
			ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${255/255})`;
			ctx.fillRect(i*dw, this.height - v, (dw - 1) || 1, v);
		};
	}
}

class UISamplograph extends UIBasis {
	constructor() {
		super(...arguments);
		this.inp = new BC.AIN(this, []);
		this.lyser = Tone.context.createAnalyser();
		this.lyser.fftSize = 4096;
		this.inp.bind(this.lyser);
		this.dataArray = new Uint8Array(this.lyser.fftSize);
		this.width = this.dataArray.length/4;
		this.height = 256;
		this.bgHeight = 264;
	}
	getHTML() {
		return `<canvas class="UI UISpectrograph UICanvas UIScope" id="${this.getId()}"
			width="${this.width}" height="${this.height}"></canvas>`;
	}
	onStartUI() {
		//this.elem = document.getElementById(this.getId());
		super.onStartUI(...arguments);
		// this.backBuf = document.createElement('canvas');
		// this.backCtx = this.backBuf.getContext('2d');
		this.ctx = this.elem.getContext('2d');
		this.ctx.strokeStyle = 'black';
		this.ctx.fillStyle = 'black';
		//this.ctx.fillRect(0, 0, this.width, this.height);
		this.ctx.clearRect(0, 0, this.width, this.height);
		this.imageData = this.ctx.createImageData(this.width, this.height);
		BC.ui.addDrawer(() => this.draw());
		this.cx = 0;
		this.dx = 1;
	}
	draw() {
		this.lyser.getByteTimeDomainData(this.dataArray);
		var d = this.dataArray;
		var j0 = 0;
		var maxdj = 0;
		for (var j = 0; j < d.length - this.width; j++) {
			if (d[j] <= 128 && d[j + 1] > 128 && (d[j + 1] - d[j]) > maxdj) {
				maxdj = d[j + 1] - d[j];
				j0 = j;
			}
		}
		for (var i = 0; i < this.width; i++) {
			var v = d[i + j0];
			var iv = v;
			var r, g, b, a;
			if (v < 128) {
				v = (128 - v)/128;
				g = Math.min(255, v*2*255);
				r = Math.max((v - 0.5)*2*255, 0);
				b = 0;
				a = Math.min(v, 0.5)*2*255;
			} else {
				v = (v - 128)/127;
				r = Math.min(255, v*2*255);
				g = Math.max((v - 0.5)*2*255, 0);
				b = 0;
				a = Math.min(v, 0.5)*2*255;
			}
			if (iv == 255) {
				b = 200;
			}
			if (iv == 0) {
				b = 200;
			}
			// var r = (v < 128 ? 128 - v : 0)*8;
			// var g = (v >= 128 ? v - 128 : 0)*8;
			//if (i == 0) console.log(v, r, g);
			var pos = (this.height - this.cx - 1)*this.width*4 + i*4;
			this.imageData.data[pos] = r;
			this.imageData.data[pos + 1] = g;
			this.imageData.data[pos + 2] = b;
			this.imageData.data[pos + 3] = a;
		};
		// this.ctx.drawImage(this.elem, 0, 0, this.width, this.height - 1, 0, 1, this.width, this.height - 1);
		// this.ctx.putImageData(this.imageData, 0, 0);

		this.ctx.putImageData(this.imageData, 0, - this.height + this.cx + 1, 0, this.height - this.cx - 1, this.width, this.cx);
		this.ctx.putImageData(this.imageData, 0, this.cx, 0, 0, this.width, this.height - this.cx);

		this.cx += this.dx;
		if (this.cx >= this.height) this.cx -= this.height;
	}
}

class UIScope extends UIBasis {
	constructor() {
		super(...arguments);
		this.inp = new BC.AIN(this, []);
		this.lyser = Tone.context.createAnalyser();
		this.lyser.fftSize = 4096;
		this.inp.bind(this.lyser);
		this.dataArray = new Uint8Array(this.lyser.fftSize);
		this.width = this.dataArray.length/4;
		this.height = 256;
		this.bgHeight = 264;
	}
	getHTML() {
		return `<canvas class="UI UISpectrograph UICanvas UIScope" id="${this.getId()}"
			width="${this.width}" height="${this.height}"></canvas>`;
	}
	onStartUI() {
		// this.elem = document.getElementById(this.getId());
		super.onStartUI(...arguments);
		this.ctx = this.elem.getContext('2d');
		
		this.ctx.strokeStyle = '#4F4';
		this.ctx.fillStyle = '#000';
		this.ctx.lineWidth = 4;
		this.ctx.fillRect(0, 0, this.width, this.height);
		BC.ui.addDrawer(() => this.draw());
	}
	draw() {
		this.lyser.getByteTimeDomainData(this.dataArray);
		var d = this.dataArray;
		var dl = d.length;
		var j0 = 0;
		var maxdj = 0;
		for (var j = 0; j < d.length - this.width; j++) {
			if (d[j] <= 128 && d[j + 1] > 128 && (d[j + 1] - d[j]) > maxdj) {
				maxdj = d[j + 1] - d[j];
				j0 = j;
			}
		}
		//this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
		//this.ctx.fillRect(0, 0, this.width, this.height);
		this.ctx.clearRect(0, 0, this.width, this.height);
		this.ctx.beginPath();
		for (var ix = 0; ix < this.width; ix++) {
			var j = ix;
			var iy = this.height - d[j0 + j] - 1;
			if (!ix) this.ctx.moveTo(ix, iy);
			else this.ctx.lineTo(ix, iy);
		};
		this.ctx.stroke();
	}
}


class UILabel extends UIBasis {
	constructor() {
		super(...arguments);
	}
	getInnerHTML() {
		var slabel = this.title || this.name || this.id;
		
		//style="width: ${slabel.length*10}px;"
		// return slabel.split('').map((c, i) => `<span ${c == ' ' && (i == 0 || i == slabel.length - 1) ? 'class="half"': ''}>${c}</span>`).join('');
		return slabel.split('').map((c, i) => `<span ${c.match(/[ ,.:;'"|!]/) ? 'class="half"': ''}>${c}</span>`).join('');
	}
}

class UIHSpacing extends UIBasis {
	constructor(parent, [len]) {
		super(...arguments);
		this.len = len;
	}
	getHTML() {
		return `<div class="UI ${this.constructor.name}" id="${this.getId()}" style="width: ${this.len*10}px;"></div>`;
	}
}

class UIHLine extends UIHSpacing {
}

class UIVSlider extends UIBasis {
	constructor(parent, [def]) {
		super(...arguments);
		this.out = new BC.POUT(this, []);
		this.out.produceFromField(this, 'value');
		this.max = 999;
		this.def = def || 0;
	}
	get value() {
		if (!this.elem) return 0;
		var v = $('input', this.elem)[0].value;
		return (this.max - v)/this.max;
	}
	getInnerHTML() {
		return `<input type="range" min="0" max="${this.max}" value="${(1 - this.def)*this.max}" />`;
	}
}

BC.ui = new UIManager();

Object.assign(BC, {
	UIBasis,
	UILabel,
	UIHSpacing,
	UIHLine,
	UIDial,
	UIDigits,
	UIHexDigits,
	UIValue,
	UILED,
	Keyboard,
	UIKeyboard,
	UIButton,
	UISpectrograph,
	UISamplograph,
	UIScope,
	UISpectrum,
	UIVSlider,
});

})(this);
