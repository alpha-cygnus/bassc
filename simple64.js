(function(global) {
	function encode64(data) {
		var r = "";
		for (var i = 0; i < data.length; i += 3) {
			if (i + 2 == data.length) {
				r +=append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0);
			} else if (i + 1 == data.length) {
				r += append3bytes(data.charCodeAt(i), 0, 0);
			} else {
				r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), data.charCodeAt(i + 2));
			}
		}
		return r;
	}

	function append3bytes(b1, b2, b3) {
		var c1 = b1 >> 2;
		var c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
		var c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
		var c4 = b3 & 0x3F;
		r = "";
		r += encode6bit(c1 & 0x3F);
		r += encode6bit(c2 & 0x3F);
		r += encode6bit(c3 & 0x3F);
		r += encode6bit(c4 & 0x3F);
		return r;
	}

	var char64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

	function encode6bit(b) {
		return char64[b] || '?';
		// if (b < 10) {
		// 	return String.fromCharCode(48 + b);
		// }
		// b -= 10;
		// if (b < 26) {
		// 	return String.fromCharCode(65 + b);
		// }
		// b -= 26;
		// if (b < 26) {
		// 	return String.fromCharCode(97 + b);
		// }
		// b -= 26;
		// if (b == 0) {
		// 	return '-';
		// }
		// if (b == 1) {
		// 	return '_';
		// }
		// return '?';
	}

	function decode6bit(c) {
		var b = char64.indexOf(c);
		if (b < 0) b = 0;
		return b;
	}
	function decode64(data) {
		var r = [];
		var b, c;
		for (var i = 0; i < data.length; i += 4) {
			b = 0;
			for (var j = 0; j < 4; j++) {
				b = (b << 6) + decode6bit(data[i + j]);
			};
			for (j = 0; j < 3; j++) {
				c = (b & 0xFF0000) >> 16;
				//if (c)
				r.push(c);
				b <<= 8;
			}
		}
		return r.map(b => String.fromCharCode(b)).join('');
	}
	global.Simple64 = global.Simple64 || {};
	global.Simple64.encode = encode64;
	global.Simple64.decode = decode64;
})(this);