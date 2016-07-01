define(
	[
		'bassc/pu',
		// 'pegjs',
	],
function(BCPU) {
	// PEG = PEG || window.PEG;
	return {
		load: function (name, parentRequire, onload, config) {
			var fullName = name + '.pegjs';
			var path = parentRequire.toUrl(fullName);
			$.get(path, function(source) {
				var grammar = source.replace(/\t*"include BCPU";\n?/,
					'\tvar BCPU = options.BCPU;\n'
					+ Object.keys(BCPU.cls)
						.map(k => 
							`\tvar ${k} = function (a, b, c, d, e) { var obj = new BCPU.cls.${k}(a, b, c, d, e); obj.type = '${k}'; return obj; }\n`
						)
						.join('')
					+ Object.keys(BCPU.fun)
						.map(k => 
							`\tvar ${k} = BCPU.fun.${k};\n`
						)
						.join('')
					+ '\tBCPU.location = location;\n\tBCPU.error = error;\n'
				);
				//console.log(PEG.buildParser(grammar, {output: 'source'}));
				var parser = BCPU.run('parsing ' + name, grammar, s => PEG.buildParser(s));
				// var parser = PEG.buildParser(grammar);
				onload(parser);
			});
		},
	};
});